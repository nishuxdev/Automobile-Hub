from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'phone', 'role', 'is_active', 'is_superuser', 'created_at')
        read_only_fields = ('id', 'created_at')

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('email', 'name', 'phone', 'role', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            phone=validated_data.get('phone', ''),
            role=validated_data.get('role', 'customer'),
            password=validated_data['password']
        )
        return user

class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Block unapproved mechanics from logging in."""

    def validate(self, attrs):
        data = super().validate(attrs)

        if self.user.role == 'mechanic':
            from apps.marketplace.models import MechanicProfile
            try:
                profile = MechanicProfile.objects.get(user=self.user)
                if profile.verification_status == 'PENDING':
                    raise serializers.ValidationError(
                        {'detail': 'Your account is pending admin approval. Please wait for verification.'},
                        code='mechanic_pending',
                    )
                elif profile.verification_status == 'REJECTED':
                    raise serializers.ValidationError(
                        {'detail': 'Your mechanic application has been rejected. Please contact support.'},
                        code='mechanic_rejected',
                    )
            except MechanicProfile.DoesNotExist:
                raise serializers.ValidationError(
                    {'detail': 'Mechanic profile not found. Please complete onboarding first.'},
                    code='mechanic_no_profile',
                )

        return data