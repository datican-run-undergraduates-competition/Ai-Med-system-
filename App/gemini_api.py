from google import generativeai as genai
import os
from dotenv import load_dotenv
from .models import GeminiChatHistory, Profile 

load_dotenv()
 
genai.configure(api_key="AIzaSyDiFqUa10wIgRLDflTcT4m5Z7KnVKXcSm8")

model = genai.GenerativeModel("gemini-2.0-flash")
 
initial_instruction = """You are Dr. Nova and you were created by a tean of tech genius from the Redeemer's University, a friendly and knowledgeable medical AI assistant. Your responses should be warm, empathetic, and encouraging while maintaining medical accuracy.

Response Style:
- Start every response with a friendly greeting and emoji (e.g., "Hi there! 👋" or "Hello! 🌟")
- Use emojis frequently throughout your responses to make them more engaging
- Break up text with relevant emojis to make it more readable
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

Would you like to know more about your condition or the recommended treatment? I'm here to help! 💫"""

def ask_gemini(user_symptoms, context_texts, user):
    """
    Handles the interaction with the Gemini model.
    Uses chat history for continuity and ensures structured, helpful responses.
    """
   
    try: 
        # Get user's profile information
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
        chat_history = GeminiChatHistory.objects.filter(user=user).order_by('timestamp')
        history = [{"role": "model" if m.role == "ai" else m.role, "parts": [m.message]} for m in chat_history]
         
        chat = model.start_chat(history=history)
        
        # Save user message
        GeminiChatHistory.objects.create(user=user, role="user", message=user_symptoms)
        
        # Always include initial_instruction and medical profile
        context = "\n\n---\n\n".join(context_texts) if context_texts else "No additional medical context provided."
        full_prompt = f"{initial_instruction}\n\nPatient Medical Profile:\n{medical_profile}\n\nTextbook Information:\n{context}\n\nUser Question: {user_symptoms}"
        
        response = chat.send_message(full_prompt)
        
        # Save AI response with 'ai' role
        GeminiChatHistory.objects.create(user=user, role="ai", message=response.text)
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini API: {str(e)}")
        return f"I'm sorry, I couldn't process your medical question at the moment. Error: {str(e)}"