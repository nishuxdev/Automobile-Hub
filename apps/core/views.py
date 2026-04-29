from rest_framework import generics, status
from rest_framework.response import Response
from apps.users.views import IsAdmin
from .models import PlatformConfig
from .serializers import PlatformConfigSerializer

class AdminPlatformConfigView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = PlatformConfigSerializer

    def get_object(self):
        return PlatformConfig.get_config()