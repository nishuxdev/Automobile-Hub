from rest_framework import serializers
from .models import MechanicProfile, MechanicService
from apps.users.serializers import UserSerializer

class MechanicProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = MechanicProfile
        fields = '__all__'
        read_only_fields = ('user', 'verified_at', 'verified_by', 'total_jobs', 'rating', 'reliability_score', 'rejection_rate', 'created_at', 'updated_at')

class MechanicServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MechanicService
        fields = '__all__'
        read_only_fields = ('mechanic', 'created_at', 'updated_at')