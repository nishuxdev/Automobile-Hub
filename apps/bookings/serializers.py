from rest_framework import serializers
from .models import Booking, Rating
from apps.users.serializers import UserSerializer
from apps.marketplace.serializers import MechanicProfileSerializer, MechanicServiceSerializer

class BookingSerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    mechanic = UserSerializer(read_only=True)
    has_rating = serializers.SerializerMethodField()
    bike_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def get_has_rating(self, obj):
        return hasattr(obj, 'rating')

    def get_bike_name(self, obj):
        if obj.bike:
            return obj.bike.display_name
        return obj.bike_model or None

class MechanicJobUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ('status', 'service_otp', 'before_photo', 'after_photo', 'rejection_reason')
        extra_kwargs = {
            'status': {'required': True},
        }

class CustomerBookingCreateSerializer(serializers.ModelSerializer):
    bike_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = Booking
        fields = ('id', 'service_details', 'bike_model', 'location', 'latitude', 'longitude', 'bike_id')
        read_only_fields = ('id',)

class RatingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Rating
        fields = ('id', 'booking', 'mechanic', 'customer', 'customer_name', 'score', 'review', 'created_at')
        read_only_fields = ('id', 'booking', 'mechanic', 'customer', 'customer_name', 'created_at')

class NearbyMechanicSerializer(serializers.ModelSerializer):
    """Serializer for mechanic discovery results with distance and services."""
    from apps.marketplace.models import MechanicProfile
    user = UserSerializer(read_only=True)
    services = MechanicServiceSerializer(many=True, read_only=True)
    distance_km = serializers.FloatField(read_only=True, required=False)

    class Meta:
        from apps.marketplace.models import MechanicProfile
        model = MechanicProfile
        fields = (
            'id', 'user', 'verification_status', 'address', 'location',
            'latitude', 'longitude', 'service_radius_km', 'is_available',
            'total_jobs', 'rating', 'reliability_score', 'services', 'distance_km'
        )