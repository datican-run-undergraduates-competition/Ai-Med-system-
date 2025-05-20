from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User, auth
from .models import GeminiChatHistory, Profile
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
            'role': 'user' if msg.role == 'user' else 'ai',  # Convert 'model' to 'ai' for frontend
            'message': msg.message,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M')
        }
        for msg in chat_history
    ]
    
    return JsonResponse({'chat_history': data})

@login_required(login_url='login')
def chat_history(request):
    return render(request, 'chatHistory.html')


@csrf_exempt
def diagnose(request):
    """API endpoint to process user symptoms and return medical advice"""
    if request.method == 'POST':
        try:
            # Voice note handling
            if 'voice_note' in request.FILES:
                voice_note = request.FILES['voice_note']
                user_symptoms = convert_voice_to_text(voice_note)
            else:
                # Get text from the form data
                user_symptoms = request.POST.get('symptoms', '').strip()

            if not user_symptoms:
                return JsonResponse({'error': 'No symptoms provided.'}, status=400)

            # Search your custom medical knowledge
            context_texts = search_textbook(user_symptoms)

            # Ask Gemini (or whatever AI model you're using)
            answer = ask_gemini(user_symptoms, context_texts, request.user)

            return JsonResponse({'answer': answer})
        
        except Exception as e:
            import traceback
            print("Error in diagnose view:", e)
            print(traceback.format_exc())
            return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)

    return JsonResponse({'error': 'Only POST requests are accepted.'}, status=405)

def convert_voice_to_text(audio_file):
    """Convert uploaded audio file to text, supports long audio by chunking"""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        for chunk in audio_file.chunks():
            temp_file.write(chunk)
        temp_file.flush()

    # Convert to proper WAV if needed
    audio = AudioSegment.from_file(temp_file.name)
    wav_path = temp_file.name  # Already in .wav format if uploaded correctly

    # Split into 30-second chunks
    chunk_length_ms = 30 * 1000
    chunks = make_chunks(audio, chunk_length_ms)

    recognizer = sr.Recognizer()
    full_text = ""

    for i, chunk in enumerate(chunks):
        with tempfile.NamedTemporaryFile(suffix=f"_chunk{i}.wav", delete=False) as chunk_file:
            chunk.export(chunk_file.name, format="wav")

            try:
                with sr.AudioFile(chunk_file.name) as source:
                    audio_data = recognizer.record(source)
                    text = recognizer.recognize_google(audio_data)
                    full_text += text + " "
            except sr.UnknownValueError:
                print(f"Chunk {i+1}: Could not understand audio.")
            except sr.RequestError as e:
                print(f"Chunk {i+1}: API request error - {e}")
            finally:
                os.unlink(chunk_file.name)

    os.unlink(temp_file.name)
    return full_text.strip()



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

 