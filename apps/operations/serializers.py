from rest_framework import serializers
from .models import Payment, Dispute, VideoLecture
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


class VideoLectureSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True, default='Admin')
    video_url = serializers.SerializerMethodField()

    class Meta:
        model = VideoLecture
        fields = ['id', 'title', 'description', 'video_file', 'video_url', 'uploaded_by', 'uploaded_by_name', 'is_active', 'created_at']
        read_only_fields = ('uploaded_by', 'created_at')

    def get_video_url(self, obj):
        request = self.context.get('request')
        if obj.video_file and request:
            return request.build_absolute_uri(obj.video_file.url)
        elif obj.video_file:
            return obj.video_file.url
        return None