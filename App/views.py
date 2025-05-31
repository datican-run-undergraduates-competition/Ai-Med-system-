from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User, auth
from .models import GeminiChatHistory, Profile, VoiceNote, MedicationRecommendation
import json
from django.http import JsonResponse
from django.conf import settings
import os
from django.views.decorators.csrf import csrf_exempt

import speech_recognition as sr
from pydub import AudioSegment
from pydub.utils import make_chunks

import io
import tempfile
import requests

from .search_chunks import search_textbook
from .gemini_api import ask_gemini

def register(request):
    if request.method == 'POST':
        username = request.POST['username'].strip()
        email = request.POST['email'].strip()
        password = request.POST['password'].strip()
        password2 = request.POST['password2'].strip()
        
        if password == password2:
            if User.objects.filter(email=email).exists():
                messages.error(request, 'Email Already Exists')
            elif User.objects.filter(username=username).exists():
                messages.error(request, 'Username Already Exists')
            else:
                # Create user using Django's create_user method
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password
                )
                user.save()
                messages.success(request, 'Successfully Registered')
                return redirect('login')
        else:
            messages.error(request, 'Password does not match')

    return render(request, 'register.html')

def login(request):
    """User login view"""
    if request.method == 'POST':
        email = request.POST['email'].strip()
        password = request.POST['password'].strip()
        
        # Authenticate user
        user = auth.authenticate(username=email, password=password)
        
        if user is not None:
            auth.login(request, user)
            messages.success(request, f"Successfully logged in as {user}")
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid Credentials')
            return redirect('login')
        
    return render(request, 'login.html')

def logout(request):
    auth.logout(request)
    return redirect('login')
 
@login_required(login_url='login') 
def index(request):
    return render(request, 'index.html')

@login_required(login_url='login')
def dashboard(request):
    
    return render(request, 'dashboard.html')

@login_required(login_url='login')
def chat(request):  
    user_obj = request.user 
    chat_history = GeminiChatHistory.objects.filter(user=user_obj, role = 'user').order_by('timestamp')[:7]
    context= {
        'chat_history':chat_history
    }
    return render(request, 'chat.html', context)


@login_required
def get_chat_history(request):
    user_obj = request.user
    chat_history = GeminiChatHistory.objects.filter(user=user_obj).order_by('timestamp')
    
    data = [
        {
            'role': 'user' if msg.role == 'user' else 'ai',
            'message': msg.message,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M'),
            'voice_note': {
                'url': msg.voice_note.audio_file.url,
                'transcribed_text': msg.voice_note.transcribed_text
            } if msg.voice_note else None
        }
        for msg in chat_history
    ]
    
    return JsonResponse({
        'chat_history': data,
        'total_messages': len(data)
    })

@login_required(login_url='login')
def chat_history(request):
    return render(request, 'chatHistory.html')


@csrf_exempt
def diagnose(request):
    """API endpoint to process user symptoms and return medical advice"""
    if request.method == 'POST':
        try:
            # Handle JSON data (assume text input)
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                # This part will be moved to a new view or handled differently
                # For now, we return an error as this view will only handle voice notes or be removed
                return JsonResponse({'error': 'This endpoint is for voice note transcription only.'}, status=400)

            # Handle form data with voice note
            elif 'voice_note' in request.FILES:
                voice_note = request.FILES['voice_note']
                if not voice_note.name.endswith('.wav'):
                    return JsonResponse({'error': 'Only WAV files are supported for voice notes.'}, status=400)
                try:
                    transcribed_text = convert_voice_to_text(voice_note)
                    if not transcribed_text:
                        return JsonResponse({'error': 'Could not convert voice note to text. Please try again.'}, status=400)
                    
                    # Return only the transcribed text for frontend review
                    return JsonResponse({'transcribed_text': transcribed_text})

                except Exception as e:
                    print(f"Error converting voice note: {str(e)}")
                    return JsonResponse({'error': 'Error processing voice note. Please try again.'}, status=500)
            else:
                 return JsonResponse({'error': 'No voice note file provided.'}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)
        except Exception as e:
            import traceback
            print("Error in diagnose view:", e)
            print(traceback.format_exc())
            return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)

    return JsonResponse({'error': 'Only POST requests are accepted.'}, status=405)

@csrf_exempt
def process_text_message(request):
    """API endpoint to process text messages and return medical advice"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_symptoms = data.get('symptoms', '').strip()
            
            if not user_symptoms:
                return JsonResponse({'error': 'No symptoms provided.'}, status=400)

            try:
                # Search your custom medical knowledge
                context_texts = search_textbook(user_symptoms)

                # Ask Gemini without profile information
                answer = ask_gemini(user_symptoms, context_texts, request.user)

                # Extract and save medication recommendations if present
                if "Recommended Medication" in answer:
                    try:
                        # Split the answer to get the medication section
                        med_section = answer.split("Recommended Medication")[1].split("\n\n")[0]
                        
                        # Extract medication details
                        lines = med_section.split("\n")
                        medication_name = lines[0].strip()
                        
                        # Extract dosage if present
                        dosage = ""
                        for line in lines:
                            if "Dosage:" in line:
                                dosage = line.split("Dosage:")[1].strip()
                                break
                        
                        # Find the AI response object just saved
                        ai_response_obj = GeminiChatHistory.objects.filter(user=request.user, role='ai').order_by('-timestamp').first()
                        
                        if ai_response_obj:
                            # Create medication recommendation
                            MedicationRecommendation.objects.create(
                                user=request.user,
                                medication_name=medication_name,
                                dosage=dosage,
                                frequency="",  # You might want to add more sophisticated parsing
                                duration="",   # You might want to add more sophisticated parsing
                                warnings="",   # You might want to add more sophisticated parsing
                                contraindications="",  # You might want to add more sophisticated parsing
                                chat_history=ai_response_obj # Link to the AI message
                            )
                    except Exception as e:
                        print(f"Error saving medication recommendation: {str(e)}")

                return JsonResponse({
                    'answer': answer,
                })
            except requests.exceptions.Timeout:
                return JsonResponse({
                    'error': 'The request to the AI service timed out. Please check your internet connection and try again.',
                    'status': 'timeout'
                }, status=504)
            except requests.exceptions.ConnectionError:
                return JsonResponse({
                    'error': 'Unable to connect to the AI service. Please check your internet connection and try again.',
                    'status': 'connection_error'
                }, status=503)
            except Exception as e:
                return JsonResponse({
                    'error': 'An error occurred while processing your request. Please try again.',
                    'status': 'error',
                    'details': str(e)
                }, status=500)
        
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)
        except Exception as e:
            import traceback
            print("Error in process_text_message view:", e)
            print(traceback.format_exc())
            return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)

    return JsonResponse({'error': 'Only POST requests are accepted.'}, status=405)

def convert_voice_to_text(audio_file):
    """Convert uploaded audio file to text"""
    temp_files = []  # Keep track of all temporary files
    try:
        print(f"Processing audio file: {audio_file.name}, size: {audio_file.size} bytes")
        
        # Create temporary file for the original audio
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_files.append(temp_file.name)
        for chunk in audio_file.chunks():
            temp_file.write(chunk)
        temp_file.flush()
        temp_file.close()  # Close the file handle
        print(f"Saved temporary file: {temp_file.name}")

        try:
            # Convert to proper WAV if needed
            print("Loading audio file with pydub...")
            audio = AudioSegment.from_file(temp_file.name)
            print(f"Audio loaded successfully. Duration: {len(audio)/1000} seconds")
            
            # Split into 30-second chunks
            chunk_length_ms = 30 * 1000
            chunks = make_chunks(audio, chunk_length_ms)
            print(f"Split audio into {len(chunks)} chunks")

            recognizer = sr.Recognizer()
            full_text = ""

            for i, chunk in enumerate(chunks):
                print(f"Processing chunk {i+1}/{len(chunks)}")
                chunk_file = tempfile.NamedTemporaryFile(suffix=f"_chunk{i}.wav", delete=False)
                temp_files.append(chunk_file.name)
                chunk.export(chunk_file.name, format="wav")
                chunk_file.close()  # Close the file handle
                print(f"Exported chunk to: {chunk_file.name}")

                try:
                    with sr.AudioFile(chunk_file.name) as source:
                        print(f"Reading audio data from chunk {i+1}")
                        audio_data = recognizer.record(source)
                        print(f"Sending chunk {i+1} to Google Speech Recognition")
                        text = recognizer.recognize_google(audio_data)
                        print(f"Received text for chunk {i+1}: {text}")
                        full_text += text + " "
                except sr.UnknownValueError:
                    print(f"Chunk {i+1}: Could not understand audio")
                except sr.RequestError as e:
                    print(f"Chunk {i+1}: API request error - {e}")
                    raise
                except Exception as e:
                    print(f"Chunk {i+1}: Unexpected error - {e}")
                    raise

            if not full_text.strip():
                print("No text was recognized from the audio")
                return None
                
            print(f"Final recognized text: {full_text.strip()}")
            return full_text.strip()
            
        except Exception as e:
            print(f"Error processing audio file: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise
            
    except Exception as e:
        print(f"Error in convert_voice_to_text: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise
    finally:
        # Clean up all temporary files
        import time
        for file_path in temp_files:
            try:
                # Add a small delay to ensure files are released
                time.sleep(0.1)
                if os.path.exists(file_path):
                    os.unlink(file_path)
                    print(f"Cleaned up temporary file: {file_path}")
            except Exception as e:
                print(f"Warning: Could not delete temporary file {file_path}: {e}")

def get_hospitals_nearby_from_user_location(user):
    city = user.city
    state = user.state
    country = user.country
    lat = user.latitude
    lon = user.longitude

    location = f"hospital in {city}, {state}, {country}"
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location,
        "format": "json",
        "limit": 7,
    }
    headers = {
         "User-Agent": "MedicalChatbotLocal/0.1"
    }
    response = requests.get(url, params=params, headers=headers)
    results = response.json()

    if not results and lat and lon:
        params = {
            "q": "hospital",
            "format": "json",
            "limit": 7,
            "bounded": 1,
            "viewbox": f"{lon - 0.05},{lat + 0.05},{lon + 0.05},{lat - 0.05}"
        }
        response = requests.get(url, params=params, headers=headers)
        results = response.json()

    return results




@login_required
def settings(request):
    user = request.user
    profile, created = Profile.objects.get_or_create(user=user)

    if request.method == 'POST':
        # Get all submitted form data from POST
        profile.gender = request.POST.get('gender', '')
        profile.ethnicity = request.POST.get('ethnicity', '')
        profile.smoking_status = request.POST.get('smoking_status', '')
        profile.alcohol_use = request.POST.get('alcohol_use', '')
        profile.physical_activity = request.POST.get('physical_activity', '')
        
        profile.known_allergies = request.POST.get('known_allergies', '')
        profile.current_medications = request.POST.get('current_medications', '')
        profile.chronic_conditions = request.POST.get('chronic_conditions', '')
        profile.family_history = request.POST.get('family_history', '')

        profile.is_pregnant = request.POST.get('is_pregnant') == 'on'

        # Convert to int safely with defaults
        try:
            profile.age = int(request.POST.get('age', 0))
        except ValueError:
            profile.age = 0
        try:
            profile.weight = int(request.POST.get('weight', 0))
        except ValueError:
            profile.weight = 0
        try:
            profile.height = int(request.POST.get('height', 0))
        except ValueError:
            profile.height = 0

        profile.city = request.POST.get('city', '')
        profile.state = request.POST.get('state', '')
        profile.country = request.POST.get('country', '')

        try:
            profile.lat = float(request.POST.get('lat', 0))
        except ValueError:
            profile.lat = 0
        try:
            profile.lon = float(request.POST.get('lon', 0))
        except ValueError:
            profile.lon = 0

        # Handle profile picture upload
        if 'profile_picture' in request.FILES:
            profile.profile_picture = request.FILES['profile_picture']

        profile.save()
        return redirect('settings')   
    user.refresh_from_db()
    profile = user.profile
    
    context = {
        'user': user,
        'GENDER_CHOICES': [
            ('male', 'Male'),
            ('female', 'Female'),
        ],
        'ETHNICITY_CHOICES': [
            ('african', 'African'),
            ('african_american', 'African American'),
            ('white', 'White / Caucasian'),
            ('hispanic', 'Hispanic / Latino'),
            ('asian', 'Asian'),
            ('south_asian', 'South Asian (e.g., Indian, Pakistani)'),
            ('native_american', 'Native American / Alaska Native'),
            ('pacific_islander', 'Native Hawaiian / Pacific Islander'),
            ('middle_eastern', 'Middle Eastern / North African'),
            ('mixed', 'Mixed / Multiracial'),
            ('other', 'Other'),
        ],
        'SMOKING_STATUS': [
            ('never', 'Never'),
            ('former', 'Former'),
            ('current', 'Current Smoker'),
        ],
        'ALCOHOL_USAGE': [
            ('none', 'None'),
            ('occasional', 'Occasional'),
            ('frequent', 'Frequent'),
        ],
        'ACTIVITY_LEVEL': [
            ('sedentary', 'Sedentary'),
            ('moderate', 'Moderate'),
            ('active', 'Active'),
        ],
    }
    return render(request, 'settings.html', context)

 