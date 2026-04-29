from rest_framework import serializers
from .models import Booking
from apps.users.serializers import UserSerializer

class BookingSerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    mechanic = UserSerializer(read_only=True)
    
    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class MechanicJobUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ('status', 'service_otp', 'before_photo', 'after_photo', 'rejection_reason')
        extra_kwargs = {
            'status': {'required': True},
        }