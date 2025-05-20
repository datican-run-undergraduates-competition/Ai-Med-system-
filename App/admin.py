from django.contrib import admin
from .models import GeminiChatHistory, Profile

# Register your models here.

admin.site.register(GeminiChatHistory)
admin.site.register(Profile)