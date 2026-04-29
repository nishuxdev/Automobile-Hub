import random
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from .serializers import UserRegistrationSerializer, UserSerializer, VerifyOTPSerializer
from .models import VerificationOTP

User = get_user_model()

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class IsMechanic(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'mechanic'

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate OTP
        otp_code = str(random.randint(100000, 999999))
        VerificationOTP.objects.create(user=user, code=otp_code)
        
        # Send Email
        try:
            send_mail(
                'AutoMobile - Your OTP for Registration',
                f'Your OTP for registration is: {otp_code}. It is valid for 10 minutes.',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception as e:
            # In a real app, you might want to handle this differently
            print(f"Error sending email: {e}")

        return Response({
            "message": "Registration successful! Please check your email for the OTP.",
            "email": user.email
        }, status=status.HTTP_201_CREATED)

class VerifyOTPView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = VerifyOTPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        
        try:
            user = User.objects.get(email=email)
            otp = VerificationOTP.objects.filter(user=user, code=code).latest('created_at')
            
            if otp.is_valid():
                user.is_active = True
                user.save()
                # Delete OTPs after successful verification
                user.otps.all().delete()
                # Automatically log the user in by returning tokens
                from rest_framework_simplejwt.tokens import RefreshToken
                refresh = RefreshToken.for_user(user)
                
                return Response({
                    "message": "Email verified successfully!",
                    "role": user.role,
                    "is_active": user.is_active,
                    "access": str(refresh.access_token),
                    "refresh": str(refresh)
                }, status=status.HTTP_200_OK)
            else:
                return Response({"error": "OTP has expired."}, status=status.HTTP_400_BAD_REQUEST)
                
        except (User.DoesNotExist, VerificationOTP.DoesNotExist):
            return Response({"error": "Invalid email or OTP code."}, status=status.HTTP_400_BAD_REQUEST)

class ResendOTPView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = VerifyOTPSerializer # Reuse to get email

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(email=email)
            if user.is_active:
                return Response({"message": "User is already verified."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Generate new OTP
            otp_code = str(random.randint(100000, 999999))
            VerificationOTP.objects.filter(user=user).delete() # Remove old OTPs
            VerificationOTP.objects.create(user=user, code=otp_code)
            
            # Send Email
            send_mail(
                'AutoMobile - New OTP for Registration',
                f'Your new OTP for registration is: {otp_code}. It is valid for 10 minutes.',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            return Response({"message": "A new OTP has been sent to your email."}, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({"error": "User with this email does not exist."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error sending email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CurrentUserView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

# Admin Specific Views
class AdminStatsView(generics.GenericAPIView):
    permission_classes = (IsAdmin,)

    def get(self, request):
        stats = {
            "total_users": User.objects.count(),
            "customers": User.objects.filter(role='customer').count(),
            "mechanics": User.objects.filter(role='mechanic').count(),
            "admins": User.objects.filter(role='admin').count(),
            "pending_active": User.objects.filter(is_active=False).count(),
        }
        return Response(stats)

class AdminUserListView(generics.ListAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = UserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-created_at')
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

class AdminUserToggleActiveView(generics.GenericAPIView):
    permission_classes = (IsAdmin,)

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = not user.is_active
            user.save()
            return Response({
                "message": f"User {'activated' if user.is_active else 'deactivated'} successfully.",
                "is_active": user.is_active
            })
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)