from rest_framework import serializers
from .models import Bike
from apps.bookings.models import Booking, Rating


class BikeSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for bike management."""
    total_services = serializers.SerializerMethodField()
    last_service_date = serializers.SerializerMethodField()

    class Meta:
        model = Bike
        fields = (
            'id', 'nickname', 'brand', 'model', 'year', 'registration_no',
            'color', 'engine_cc', 'fuel_type', 'photo', 'notes',
            'is_active', 'total_services', 'last_service_date',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'is_active', 'created_at', 'updated_at')

    def get_total_services(self, obj):
        return obj.bookings.filter(status='COMPLETED').count()

    def get_last_service_date(self, obj):
        last = obj.bookings.filter(status='COMPLETED').order_by('-updated_at').first()
        return last.updated_at.isoformat() if last else None


class BikeSelectSerializer(serializers.ModelSerializer):
    """Lightweight serializer for booking form dropdown."""
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Bike
        fields = ('id', 'nickname', 'brand', 'model', 'registration_no', 'display_name')


class BikeServiceHistorySerializer(serializers.ModelSerializer):
    """Serializer for a single service entry in the bike report."""
    mechanic_name = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            'id', 'service_details', 'status', 'location',
            'total_amount', 'price_breakdown',
            'before_photo', 'after_photo',
            'mechanic_name', 'rating',
            'created_at', 'updated_at',
        )

    def get_mechanic_name(self, obj):
        return obj.mechanic.name if obj.mechanic else None

    def get_rating(self, obj):
        try:
            r = obj.rating
            return {'score': r.score, 'review': r.review}
        except Rating.DoesNotExist:
            return None


class BikeReportSerializer(serializers.ModelSerializer):
    """Full bike report with service history and aggregate stats."""
    service_history = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Bike
        fields = (
            'id', 'nickname', 'brand', 'model', 'year', 'registration_no',
            'color', 'engine_cc', 'fuel_type', 'photo', 'notes',
            'stats', 'service_history',
            'created_at', 'updated_at',
        )

    def get_service_history(self, obj):
        bookings = obj.bookings.exclude(
            status__in=['CANCELLED', 'REJECTED']
        ).order_by('-created_at')
        return BikeServiceHistorySerializer(bookings, many=True).data

    def get_stats(self, obj):
        completed = obj.bookings.filter(status='COMPLETED')
        total_spent = sum(b.total_amount for b in completed)
        total_services = completed.count()
        last = completed.order_by('-updated_at').first()

        # Average rating given by this customer for this bike's services
        ratings = Rating.objects.filter(booking__in=completed)
        avg_rating = None
        if ratings.exists():
            avg_rating = round(sum(r.score for r in ratings) / ratings.count(), 1)

        return {
            'total_services': total_services,
            'total_spent': str(total_spent),
            'last_service_date': last.updated_at.isoformat() if last else None,
            'avg_rating_given': avg_rating,
        }
