from google import generativeai as genai
import os
from dotenv import load_dotenv
from .models import GeminiChatHistory, Profile 

load_dotenv()
 
genai.configure(api_key="AIzaSyDiFqUa10wIgRLDflTcT4m5Z7KnVKXcSm8")

model = genai.GenerativeModel("gemini-2.0-flash")
 
initial_instruction = """You are Dr. Nova, a friendly and knowledgeable medical AI assistant. Your responses should be warm, empathetic, and encouraging while maintaining medical accuracy.

Response Style:
- Start every response with a friendly greeting and emoji (e.g., "Hi there! 👋" or "Hello! 🌟")
- Use emojis frequently throughout your responses to make them more engaging 
- Use bullet points with emojis for lists (e.g., "• 🥗 Eat a balanced diet")
- Keep responses conversational and easy to understand
- Avoid explicitly stating personal information from the user's profile
- Instead of saying "as a 19-year-old male", use phrases like "based on your profile" or "for someone in your age group"

Formatting Rules:
- Use bold headers with emojis for main sections
- Add line breaks between sections
- Keep paragraphs short and easy to read
- Use bullet points for lists 
- Include relevant emojis for each topic

Prescription Format:
When recommending medications, always include:
- Exact dosage (e.g., "500mg")
- Frequency (e.g., "every 6 hours")
- Duration (e.g., "for 3 days")
- Number of tablets/capsules per dose
- Example: "Take 2 tablets of Paracetamol 500mg every 6 hours for 3 days"

Example Response Format:
🌟 **Health Assessment** 🌟

Hi there! 👋 Let me help you with that!

**💊 Recommended Medication:**
• Take 2 tablets of Paracetamol 500mg every 6 hours for 3 days
• Take 1 tablet of Ibuprofen 400mg every 8 hours for 2 days

**⚠️ Important Notes:**
- Take with food to avoid stomach upset
- Don't exceed the recommended dosage
- Stop if you experience any side effects

**🏥 Self-Care Tips:**
• 🥤 Stay hydrated
• 😴 Get plenty of rest
• 🌡️ Monitor your temperature

**❓ Follow-up:**
- How are you feeling after taking the medication?
- Any side effects to report?
- Need any clarification about the dosage?

Remember: This is general advice. Always consult a healthcare provider for persistent symptoms! 🌟

Would you like to know more about your condition or the recommended treatment? I'm here to help! 💫

Remember only if someone ask you who made you,  you tell them you were created by a tean of tech genius or any cool term  from the Redeemer's University.
If you are not asked dont say who made
There names are 
Oluyemi Emmanuel -Full Stack Developer & Software Engineer
Olokor Samuel -Full Stack Developer

"""

def ask_gemini(user_symptoms, context_texts, user, image_data=None, saved_images=None):
    """
    Handles the interaction with the Gemini model.
    Uses chat history for continuity and ensures structured, helpful responses.
    """
   
    try: 
        # Initialize medical profile as empty
        medical_profile = ""
        
        # Get user's profile information if available
        if user and hasattr(user, 'profile'):
            profile = user.profile
            # Create a medical profile summary
            medical_profile = f"""
            Patient Medical Profile:
            - Age: {profile.age}
            - Gender: {profile.gender}
            - Pregnancy Status: {'Pregnant' if profile.is_pregnant else 'Not Pregnant'}
            - Known Allergies: {profile.known_allergies or 'None reported'}
            - Current Medications: {profile.current_medications or 'None reported'}
            - Chronic Conditions: {profile.chronic_conditions or 'None reported'}
            - Family History: {profile.family_history or 'None reported'}
            - Smoking Status: {profile.smoking_status or 'Not specified'}
            - Alcohol Use: {profile.alcohol_use or 'Not specified'}
            - Physical Activity Level: {profile.physical_activity or 'Not specified'}
            """

        # Get chat history
        chat_history = GeminiChatHistory.objects.filter(user=user).order_by('timestamp') if user else []
        history = [{"role": "model" if m.role == "ai" else m.role, "parts": [m.message]} for m in chat_history]
         
        chat = model.start_chat(history=history)
        
        # Save user message if user is provided
        if user:
            user_chat_history = GeminiChatHistory.objects.create(
                user=user,
                role="user",
                message=user_symptoms
            )
            
            # Link saved images to user's chat history if any
            if saved_images:
                for saved_image in saved_images:
                    saved_image.chat_history = user_chat_history
                    saved_image.save()
        
        # Always include initial_instruction and medical profile
        context = "\n\n---\n\n".join(context_texts) if context_texts else "No additional medical context provided."
        
        # Prepare the prompt with or without images
        if image_data and len(image_data) > 0:
            try:
                # Create message parts
                parts = []
                
                # Add text part first
                text_prompt = f"{initial_instruction}\n\n{medical_profile}\n\nTextbook Information:\n{context}\n\nUser Question: {user_symptoms}"
                parts.append({"text": text_prompt})
                
                # Add image parts
                for img in image_data:
                    try:
                        # Create image part with proper format for Gemini
                        image_part = {
                            "inline_data": {
                                "mime_type": img['mime_type'],
                                "data": img['data']
                            }
                        }
                        parts.append(image_part)
                    except Exception as e:
                        print(f"Error processing image part: {str(e)}")
                        continue
                
                print(f"Sending message with {len(parts)-1} images")  # -1 because first part is text
                
                # Send message with images
                response = chat.send_message({"parts": parts})
            except Exception as e:
                print(f"Error sending message with images: {str(e)}")
                # Fallback to text-only if image processing fails
                full_prompt = f"{initial_instruction}\n\n{medical_profile}\n\nTextbook Information:\n{context}\n\nUser Question: {user_symptoms}"
                response = chat.send_message(full_prompt)
        else:
            # Text-only message
            full_prompt = f"{initial_instruction}\n\n{medical_profile}\n\nTextbook Information:\n{context}\n\nUser Question: {user_symptoms}"
            response = chat.send_message(full_prompt)
        
        # Save AI response with 'ai' role if user is provided
        if user:
            ai_chat_history = GeminiChatHistory.objects.create(
                user=user,
                role="ai",
                message=response.text
            )
            
            # Link saved images to user's chat history if any
            if 'saved_images' in locals() and saved_images:
                for saved_image in saved_images:
                    saved_image.chat_history = user_chat_history
                    saved_image.save()
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini API: {str(e)}")
        return f"I'm sorry, I couldn't process your medical question at the moment. Error: {str(e)}"