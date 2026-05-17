import math
import random
from decimal import Decimal

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.conf import settings
from django.shortcuts import redirect
import stripe

stripe.api_key = settings.STRIPE_SECRET_KEY

from apps.users.views import IsCustomer
from apps.marketplace.models import MechanicProfile, MechanicService
from apps.core.models import PlatformConfig
from apps.operations.models import Payment
from .models import Booking, Rating
from .serializers import (
    BookingSerializer, CustomerBookingCreateSerializer,
    RatingSerializer, NearbyMechanicSerializer
)


def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance (km) between two points."""
    R = 6371  # Earth radius in km
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(float(lat1)))
        * math.cos(math.radians(float(lat2)))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ───────────────────────────── Discovery ─────────────────────────────

class NearbyMechanicListView(generics.GenericAPIView):
    """
    GET /auth/customer/nearby-mechanics/?lat=...&lon=...&radius=...
    Returns verified, available mechanics sorted by distance then rating.
    """
    permission_classes = (IsCustomer,)

    def get(self, request):
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        radius = float(request.query_params.get('radius', 25))  # default 25 km

        if not lat or not lon:
            return Response(
                {'error': 'lat and lon query parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lat = float(lat)
        lon = float(lon)

        mechanics = MechanicProfile.objects.filter(
            verification_status='VERIFIED',
            is_available=True,
            latitude__isnull=False,
            longitude__isnull=False,
        ).select_related('user').prefetch_related('services')

        results = []
        for m in mechanics:
            dist = haversine(lat, lon, m.latitude, m.longitude)
            if dist <= radius:
                m.distance_km = round(dist, 2)
                results.append(m)

        # Sort: distance first, then rating descending, reliability descending
        results.sort(key=lambda x: (x.distance_km, -float(x.rating), -float(x.reliability_score)))

        serializer = NearbyMechanicSerializer(results, many=True)
        return Response(serializer.data)


# ───────────────────────────── Bookings ──────────────────────────────

class CustomerBookingCreateView(generics.CreateAPIView):
    """POST /auth/customer/bookings/create/ — Create a new PENDING booking."""
    permission_classes = (IsCustomer,)
    serializer_class = CustomerBookingCreateSerializer

    def perform_create(self, serializer):
        bike_id = serializer.validated_data.pop('bike_id', None)
        bike = None

        if bike_id:
            from apps.bikes.models import Bike
            try:
                bike = Bike.objects.get(pk=bike_id, owner=self.request.user, is_active=True)
            except Bike.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'bike_id': 'Bike not found or does not belong to you.'})

            # Auto-populate bike_model from the registered bike
            bike_model = serializer.validated_data.get('bike_model', '')
            if not bike_model:
                serializer.validated_data['bike_model'] = f"{bike.brand} {bike.model}"

        serializer.save(customer=self.request.user, status='PENDING', bike=bike)


class CustomerBookingListView(generics.ListAPIView):
    """GET /auth/customer/bookings/ — List the customer's own bookings."""
    permission_classes = (IsCustomer,)
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = Booking.objects.filter(customer=self.request.user).order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset


class CustomerBookingDetailView(generics.RetrieveAPIView):
    """GET /auth/customer/bookings/<pk>/ — Single booking detail."""
    permission_classes = (IsCustomer,)
    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.filter(customer=self.request.user)


class CustomerStatsView(generics.GenericAPIView):
    """GET /auth/customer/stats/ — Summary statistics for the customer."""
    permission_classes = (IsCustomer,)

    def get(self, request):
        bookings = Booking.objects.filter(customer=request.user)
        active_statuses = ['PENDING', 'ASSIGNED', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']

        return Response({
            'total_bookings': bookings.count(),
            'active_bookings': bookings.filter(status__in=active_statuses).count(),
            'completed_bookings': bookings.filter(status='COMPLETED').count(),
            'cancelled_bookings': bookings.filter(status='CANCELLED').count(),
        })


# ───────────────────── Mechanic Selection + Pricing ──────────────────

class CustomerSelectMechanicView(generics.GenericAPIView):
    """
    POST /auth/customer/bookings/<pk>/select-mechanic/
    Body: { "mechanic_profile_id": <int> }
    Assigns mechanic, calculates pricing, locks the price, sets status=ASSIGNED.
    """
    permission_classes = (IsCustomer,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != 'PENDING':
            return Response(
                {'error': f'Cannot select mechanic for a booking in {booking.status} state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mechanic_profile_id = request.data.get('mechanic_profile_id')
        if not mechanic_profile_id:
            return Response({'error': 'mechanic_profile_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = MechanicProfile.objects.select_related('user').prefetch_related('services').get(
                pk=mechanic_profile_id,
                verification_status='VERIFIED',
                is_available=True,
            )
        except MechanicProfile.DoesNotExist:
            return Response({'error': 'Mechanic not available.'}, status=status.HTTP_404_NOT_FOUND)

        # Calculate pricing
        active_services = profile.services.filter(is_active=True)
        mechanic_base = sum(s.base_cost for s in active_services) if active_services.exists() else Decimal('0.00')

        # If no services defined, use a default base
        if mechanic_base == 0:
            mechanic_base = Decimal('200.00')

        config = PlatformConfig.get_config()
        if config.fee_type == 'PERCENTAGE':
            platform_fee = (mechanic_base * config.fee_value) / Decimal('100')
        else:
            platform_fee = config.fee_value

        total = mechanic_base + platform_fee

        # Generate service OTP for later verification
        service_otp = str(random.randint(1000, 9999))

        booking.mechanic = profile.user
        booking.platform_fee = platform_fee
        booking.total_amount = total
        booking.price_breakdown = {
            'mechanic_cost': str(mechanic_base),
            'platform_fee': str(platform_fee),
            'total': str(total),
        }
        booking.price_locked = True
        booking.service_otp = service_otp
        booking.status = 'ASSIGNED'
        booking.save()

        return Response({
            'message': 'Mechanic assigned successfully.',
            'booking_id': booking.id,
            'mechanic_name': profile.user.name,
            'service_otp': service_otp,
            'price_breakdown': booking.price_breakdown,
            'total_amount': str(total),
            'status': booking.status,
        })


# ───────────────────── Payment (Simulated) ───────────────────────────

class CustomerConfirmPaymentView(generics.GenericAPIView):
    """
    POST /auth/customer/bookings/<pk>/confirm-payment/
    Simulated payment: transitions ASSIGNED → PAID, creates Payment record.
    """
    permission_classes = (IsCustomer,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != 'ASSIGNED':
            return Response(
                {'error': f'Payment can only be confirmed for ASSIGNED bookings. Current: {booking.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create payment record
        import uuid
        txn_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
        Payment.objects.create(
            booking=booking,
            transaction_id=txn_id,
            amount=booking.total_amount,
            status='SUCCESS',
        )

        booking.status = 'PAID'
        booking.save()

        return Response({
            'message': 'Payment confirmed successfully.',
            'transaction_id': txn_id,
            'amount': str(booking.total_amount),
            'booking_status': booking.status,
            'service_otp': booking.service_otp,
        })


class StripeCheckoutSessionCreateView(generics.GenericAPIView):
    """
    POST /auth/customer/bookings/<pk>/stripe-payment/
    Creates a Stripe Checkout session and returns the checkout URL.
    """
    permission_classes = (IsCustomer,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != 'ASSIGNED':
            return Response(
                {'error': f'Payment can only be made for ASSIGNED bookings. Current: {booking.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        domain = request.build_absolute_uri('/')[:-1]
        success_url = domain + f'/auth/customer/bookings/{booking.id}/payment-success/?session_id={{CHECKOUT_SESSION_ID}}'
        cancel_url = domain + f'/auth/customer/bookings/{booking.id}/payment-cancel/'

        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[
                    {
                        'price_data': {
                            'currency': 'inr',
                            'unit_amount': int(booking.total_amount * 100),
                            'product_data': {
                                'name': f'Service Booking #{booking.id}',
                            },
                        },
                        'quantity': 1,
                    },
                ],
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=str(booking.id),
            )
            return Response({'checkout_url': checkout_session.url})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StripePaymentSuccessView(APIView):
    """
    GET /auth/customer/bookings/<pk>/payment-success/
    Handles successful Stripe payment redirect.
    """
    permission_classes = []

    def get(self, request, pk):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'Session ID not provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status == 'paid':
                try:
                    booking = Booking.objects.get(pk=pk)
                except Booking.DoesNotExist:
                    return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

                if booking.status == 'ASSIGNED':
                    import uuid
                    txn_id = session.payment_intent or f"TXN-{uuid.uuid4().hex[:12].upper()}"
                    Payment.objects.get_or_create(
                        booking=booking,
                        defaults={
                            'transaction_id': txn_id,
                            'amount': booking.total_amount,
                            'status': 'SUCCESS',
                        }
                    )
                    booking.status = 'PAID'
                    booking.save()

                return redirect('/customer/dashboard/?success=true')
            else:
                return redirect('/customer/dashboard/')
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StripePaymentCancelView(APIView):
    """
    GET /auth/customer/bookings/<pk>/payment-cancel/
    Handles cancelled Stripe payment redirect.
    """
    permission_classes = []

    def get(self, request, pk):
        return redirect('/customer/dashboard/')


# ───────────────────── Cancellation ──────────────────────────────────

class CustomerBookingCancelView(generics.GenericAPIView):
    """
    POST /auth/customer/bookings/<pk>/cancel/
    Cancel booking — allowed only in PENDING or ASSIGNED states.
    """
    permission_classes = (IsCustomer,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        cancellable = ['PENDING', 'ASSIGNED']
        if booking.status not in cancellable:
            return Response(
                {'error': f'Cannot cancel a booking in {booking.status} state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'CANCELLED'
        booking.save()

        return Response({'message': 'Booking cancelled successfully.', 'status': booking.status})


# ───────────────────── Rating ────────────────────────────────────────

class CustomerRatingCreateView(generics.GenericAPIView):
    """
    POST /auth/customer/bookings/<pk>/rate/
    Body: { "score": 1-5, "review": "optional text" }
    Only for COMPLETED bookings without an existing rating.
    """
    permission_classes = (IsCustomer,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != 'COMPLETED':
            return Response(
                {'error': 'Can only rate completed bookings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(booking, 'rating'):
            return Response(
                {'error': 'You have already rated this booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score = request.data.get('score')
        if not score or int(score) not in range(1, 6):
            return Response({'error': 'Score must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)

        review = request.data.get('review', '')

        rating = Rating.objects.create(
            booking=booking,
            mechanic=booking.mechanic,
            customer=request.user,
            score=int(score),
            review=review,
        )

        # Update mechanic profile rating aggregate
        try:
            profile = MechanicProfile.objects.get(user=booking.mechanic)
            all_ratings = Rating.objects.filter(mechanic=booking.mechanic)
            avg = sum(r.score for r in all_ratings) / all_ratings.count()
            profile.rating = round(Decimal(str(avg)), 2)
            profile.total_jobs = Booking.objects.filter(mechanic=booking.mechanic, status='COMPLETED').count()
            profile.save()
        except MechanicProfile.DoesNotExist:
            pass

        serializer = RatingSerializer(rating)
        return Response({
            'message': 'Rating submitted successfully.',
            'rating': serializer.data,
        }, status=status.HTTP_201_CREATED)
