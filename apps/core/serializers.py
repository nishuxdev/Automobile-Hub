from rest_framework import serializers
from .models import PlatformConfig

class PlatformConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformConfig
        fields = '__all__'
        read_only_fields = ('updated_at',)