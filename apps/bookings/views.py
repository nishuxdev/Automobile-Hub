from rest_framework import generics, status
from rest_framework.response import Response
from apps.users.views import IsAdmin, IsMechanic
from .models import Booking
from .serializers import BookingSerializer, MechanicJobUpdateSerializer

class AdminBookingListView(generics.ListAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = Booking.objects.all().order_by('-created_at')
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        return queryset

class AdminBookingOverrideView(generics.GenericAPIView):
    permission_classes = (IsAdmin,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
            new_status = request.data.get('status')
            
            if new_status not in dict(Booking.STATUS_CHOICES).keys():
                return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
                
            booking.status = new_status
            booking.save()
            return Response({'message': f'Booking status updated to {new_status}'})
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

# Mechanic Dashboard APIs
class MechanicJobListView(generics.ListAPIView):
    permission_classes = (IsMechanic,)
    serializer_class = BookingSerializer

    def get_queryset(self):
        # Only show jobs assigned to this mechanic
        queryset = Booking.objects.filter(mechanic=self.request.user).order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

class MechanicJobDetailView(generics.RetrieveAPIView):
    permission_classes = (IsMechanic,)
    serializer_class = BookingSerializer
    
    def get_queryset(self):
        return Booking.objects.filter(mechanic=self.request.user)

class MechanicJobUpdateStatusView(generics.UpdateAPIView):
    permission_classes = (IsMechanic,)
    serializer_class = MechanicJobUpdateSerializer
    
    def get_queryset(self):
        return Booking.objects.filter(mechanic=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')
        current_status = instance.status

        # Strict State Machine Validation
        valid_transitions = {
            'ASSIGNED': ['ACCEPTED', 'REJECTED'],
            'ACCEPTED': ['ON_THE_WAY', 'CANCELLED'],
            'PAID': ['ACCEPTED', 'REJECTED', 'ON_THE_WAY'],
            'ON_THE_WAY': ['IN_PROGRESS'],
            'IN_PROGRESS': ['COMPLETED'],
        }

        if current_status not in valid_transitions:
            return Response({'error': f'Cannot transition from {current_status}'}, status=status.HTTP_400_BAD_REQUEST)

        if new_status not in valid_transitions[current_status]:
            return Response({'error': f'Invalid transition from {current_status} to {new_status}'}, status=status.HTTP_400_BAD_REQUEST)

        # Additional Logic
        if new_status == 'IN_PROGRESS':
            # Check OTP if required
            # For simplicity, we just check if it's provided if stored
            if instance.service_otp and request.data.get('service_otp') != instance.service_otp:
                return Response({'error': 'Invalid Service OTP'}, status=status.HTTP_400_BAD_REQUEST)

        return super().update(request, *args, **kwargs)

class MechanicEarningsView(generics.GenericAPIView):
    permission_classes = (IsMechanic,)

    def get(self, request):
        completed_jobs = Booking.objects.filter(mechanic=request.user, status='COMPLETED')
        total_earnings = sum(job.total_amount for job in completed_jobs)
        
        # Today's earnings
        from django.utils import timezone
        today = timezone.now().date()
        today_jobs = completed_jobs.filter(updated_at__date=today)
        today_earnings = sum(job.total_amount for job in today_jobs)

        return Response({
            "total_earnings": total_earnings,
            "today_earnings": today_earnings,
            "completed_jobs_count": completed_jobs.count(),
        })