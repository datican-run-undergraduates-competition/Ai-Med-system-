from django.contrib import admin
from .models import GeminiChatHistory, Profile, VoiceNote, MedicationRecommendation, ChatImage

# Register your models here.

admin.site.register(GeminiChatHistory)
admin.site.register(Profile)
admin.site.register(VoiceNote)
admin.site.register(MedicationRecommendation)
admin.site.register(ChatImage)