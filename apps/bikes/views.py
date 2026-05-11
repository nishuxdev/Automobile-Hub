from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.users.views import IsCustomer
from .models import Bike
from .serializers import BikeSerializer, BikeReportSerializer, BikeSelectSerializer


class CustomerBikeListCreateView(generics.ListCreateAPIView):
    """
    GET  /auth/customer/bikes/         — List all bikes for the logged-in customer.
    POST /auth/customer/bikes/         — Register a new bike.
    """
    permission_classes = (IsCustomer,)
    serializer_class = BikeSerializer

    def get_queryset(self):
        return Bike.objects.filter(owner=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class CustomerBikeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /auth/customer/bikes/<pk>/  — Retrieve a specific bike.
    PATCH  /auth/customer/bikes/<pk>/  — Update bike details.
    DELETE /auth/customer/bikes/<pk>/  — Soft-delete the bike.
    """
    permission_classes = (IsCustomer,)
    serializer_class = BikeSerializer

    def get_queryset(self):
        return Bike.objects.filter(owner=self.request.user, is_active=True)

    def perform_destroy(self, instance):
        """Soft-delete: mark as inactive instead of hard delete."""
        instance.is_active = False
        instance.save()


class CustomerBikeReportView(generics.RetrieveAPIView):
    """
    GET /auth/customer/bikes/<pk>/report/
    Full service report for a specific bike, including all linked bookings
    and aggregate statistics.
    """
    permission_classes = (IsCustomer,)
    serializer_class = BikeReportSerializer

    def get_queryset(self):
        return Bike.objects.filter(owner=self.request.user, is_active=True)


class CustomerBikeSelectListView(generics.ListAPIView):
    """
    GET /auth/customer/bikes/select/
    Lightweight list for populating the bike dropdown in booking form.
    """
    permission_classes = (IsCustomer,)
    serializer_class = BikeSelectSerializer
    pagination_class = None  # No pagination for dropdown data

    def get_queryset(self):
        return Bike.objects.filter(owner=self.request.user, is_active=True)
