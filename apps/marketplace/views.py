from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.views import IsAdmin, IsMechanic
from .models import MechanicProfile, MechanicService
from .serializers import MechanicProfileSerializer, MechanicServiceSerializer

class AdminMechanicVerificationListView(generics.ListAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = MechanicProfileSerializer

    def get_queryset(self):
        queryset = MechanicProfile.objects.all().order_by('-created_at')
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(verification_status=status)
        return queryset

class AdminMechanicVerifyActionView(generics.GenericAPIView):
    permission_classes = (IsAdmin,)

    def post(self, request, pk):
        try:
            profile = MechanicProfile.objects.get(pk=pk)
            action_type = request.data.get('action') # 'APPROVE' or 'REJECT'
            notes = request.data.get('notes', '')

            if action_type == 'APPROVE':
                profile.verification_status = 'VERIFIED'
            elif action_type == 'REJECT':
                profile.verification_status = 'REJECTED'
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

            profile.internal_notes = notes
            profile.verified_by = request.user
            from django.utils import timezone
            profile.verified_at = timezone.now()
            profile.save()

            return Response({'message': f'Mechanic {action_type.lower()}ed successfully'})
        except MechanicProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminMechanicDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = MechanicProfileSerializer
    queryset = MechanicProfile.objects.all()

class MechanicOnboardingView(generics.RetrieveUpdateAPIView):
    """
    View for mechanics to submit their profile details and documents during onboarding.
    Requires authentication.
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = MechanicProfileSerializer

    def get_object(self):
        # Create profile if it doesn't exist
        profile, created = MechanicProfile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        # When mechanic updates profile, ensure status is PENDING for review
        serializer.save(verification_status='PENDING')

class MechanicAvailabilityToggleView(generics.GenericAPIView):
    permission_classes = (IsMechanic,)

    def patch(self, request):
        try:
            profile = MechanicProfile.objects.get(user=request.user)
            is_available = request.data.get('is_available')
            
            if is_available is None:
                return Response({'error': 'is_available field is required'}, status=status.HTTP_400_BAD_REQUEST)
                
            profile.is_available = is_available
            profile.save()
            
            return Response({
                'message': f"Availability set to {'ON' if profile.is_available else 'OFF'}",
                'is_available': profile.is_available
            })
        except MechanicProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

class MechanicServiceListView(generics.ListCreateAPIView):
    permission_classes = (IsMechanic,)
    serializer_class = MechanicServiceSerializer

    def get_queryset(self):
        profile, _ = MechanicProfile.objects.get_or_create(user=self.request.user)
        return MechanicService.objects.filter(mechanic=profile)

    def perform_create(self, serializer):
        profile, created = MechanicProfile.objects.get_or_create(user=self.request.user)
        print(f"Adding service for mechanic: {self.request.user.email}, Profile created: {created}")
        serializer.save(mechanic=profile)

class MechanicServiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsMechanic,)
    serializer_class = MechanicServiceSerializer

    def get_queryset(self):
        profile, _ = MechanicProfile.objects.get_or_create(user=self.request.user)
        return MechanicService.objects.filter(mechanic=profile)