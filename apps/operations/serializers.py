from rest_framework import serializers
from .models import Payment, Dispute
from apps.bookings.serializers import BookingSerializer

class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('booking', 'created_at', 'updated_at')

class DisputeSerializer(serializers.ModelSerializer):
    booking = BookingSerializer(read_only=True)
    
    class Meta:
        model = Dispute
        fields = '__all__'
        read_only_fields = ('booking', 'created_at', 'updated_at')