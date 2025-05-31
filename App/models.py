from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class VoiceNote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    audio_file = models.FileField(upload_to='voice_notes/')
    transcribed_text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}'s voice note - {self.timestamp}"

# To get chat history of logged in user 
class GeminiChatHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    voice_note = models.ForeignKey(VoiceNote, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}: {self.message[:30]}"
    
GENDER_CHOICES = (
    ('male', 'Male'),
    ('female', 'Female'),
)

SMOKING_STATUS = (
    ('never', 'Never'),
    ('former', 'Former'),
    ('current', 'Current Smoker'),
)

ALCOHOL_USAGE = (
    ('none', 'None'),
    ('occasional', 'Occasional'),
    ('frequent', 'Frequent'),
)

ACTIVITY_LEVEL = (
    ('sedentary', 'Sedentary'),
    ('moderate', 'Moderate'),
    ('active', 'Active'),
)
ETHNICITY_CHOICES = [
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
]


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True)
    profile_picture = models.FileField(upload_to='Profile Piceture', max_length=100)
    gender =  models.CharField(max_length=50, choices=GENDER_CHOICES, blank=True, null=True)
    
    ethnicity = models.CharField(max_length=50, choices=ETHNICITY_CHOICES, blank=True, null=True)
    smoking_status = models.CharField(max_length=20, choices=SMOKING_STATUS, blank=True, null=True)
    alcohol_use = models.CharField(max_length=20, choices=ALCOHOL_USAGE, blank=True, null=True)
    physical_activity = models.CharField(max_length=20, choices=ACTIVITY_LEVEL, blank=True, null=True)

    known_allergies = models.TextField(blank=True, null=True)
    current_medications = models.TextField(blank=True, null=True)
    chronic_conditions = models.TextField(blank=True, null=True)
    family_history = models.TextField(blank=True, null=True)
    
    is_pregnant = models.BooleanField(default=False)
     
    age = models.IntegerField(default=0) 
    weight = models.IntegerField(default=0)
    height = models.IntegerField(default=0) 
    
    city =  models.CharField(max_length=50)
    state = models.CharField(max_length=50)
    country = models.CharField(max_length=50)
    lat = models.IntegerField(default=0)
    lon = models.IntegerField(default=0)
    
    def __str__(self):
        return str(self.user)

class MedicationRecommendation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    medication_name = models.CharField(max_length=100)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)
    warnings = models.TextField()
    contraindications = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    chat_history = models.ForeignKey(GeminiChatHistory, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.medication_name} for {self.user.username} - {self.timestamp}"

class ChatImage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='chat_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    chat_history = models.ForeignKey('GeminiChatHistory', on_delete=models.CASCADE, null=True, blank=True)
    
    def __str__(self):
        return f"Image uploaded by {self.user.username} at {self.uploaded_at}"