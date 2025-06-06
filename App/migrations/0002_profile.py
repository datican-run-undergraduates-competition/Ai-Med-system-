# Generated by Django 5.0 on 2025-05-17 02:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('App', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Profile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('profile_picture', models.FileField(upload_to='Profile Piceture')),
                ('ethnicity', models.CharField(blank=True, choices=[('african', 'African'), ('african_american', 'African American'), ('white', 'White / Caucasian'), ('hispanic', 'Hispanic / Latino'), ('asian', 'Asian'), ('south_asian', 'South Asian (e.g., Indian, Pakistani)'), ('native_american', 'Native American / Alaska Native'), ('pacific_islander', 'Native Hawaiian / Pacific Islander'), ('middle_eastern', 'Middle Eastern / North African'), ('mixed', 'Mixed / Multiracial'), ('other', 'Other')], max_length=50, null=True)),
                ('smoking_status', models.CharField(blank=True, choices=[('never', 'Never'), ('former', 'Former'), ('current', 'Current Smoker')], max_length=20, null=True)),
                ('alcohol_use', models.CharField(blank=True, choices=[('none', 'None'), ('occasional', 'Occasional'), ('frequent', 'Frequent')], max_length=20, null=True)),
                ('physical_activity', models.CharField(blank=True, choices=[('sedentary', 'Sedentary'), ('moderate', 'Moderate'), ('active', 'Active')], max_length=20, null=True)),
                ('known_allergies', models.TextField(blank=True, null=True)),
                ('current_medications', models.TextField(blank=True, null=True)),
                ('chronic_conditions', models.TextField(blank=True, null=True)),
                ('family_history', models.TextField(blank=True, null=True)),
                ('is_pregnant', models.BooleanField(default=False)),
                ('age', models.IntegerField()),
                ('gender', models.CharField(max_length=50)),
                ('weight', models.IntegerField()),
                ('height', models.IntegerField()),
                ('city', models.CharField(max_length=50)),
                ('state', models.CharField(max_length=50)),
                ('country', models.CharField(max_length=50)),
            ],
        ),
    ]
