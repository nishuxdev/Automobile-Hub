from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework import serializers

from .models import Booking
from .chat_models import ChatMessage


# ───────────────── Serializers ─────────────────

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.name', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ('id', 'sender', 'sender_name', 'sender_role', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'sender', 'sender_name', 'sender_role', 'is_read', 'created_at')


class ChatSendSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)


# ───────────────── Permissions ─────────────────

class IsBookingParticipant(permissions.BasePermission):
    """Allow only the booking's customer or assigned mechanic."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        booking_pk = view.kwargs.get('pk')
        try:
            booking = Booking.objects.get(pk=booking_pk)
        except Booking.DoesNotExist:
            return False
        return request.user in (booking.customer, booking.mechanic)


# ───────────────── Views ─────────────────

class BookingChatListView(generics.GenericAPIView):
    """
    GET /auth/bookings/<pk>/chat/?after=<msg_id>
    Returns chat messages for a booking.
    Optional `after` param returns only messages with id > after (for polling).
    """
    permission_classes = (IsBookingParticipant,)

    def get(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        messages = ChatMessage.objects.filter(booking=booking)

        # Support incremental polling: only return messages after a given ID
        after = request.query_params.get('after')
        if after:
            messages = messages.filter(id__gt=int(after))

        # Mark received messages as read
        messages.exclude(sender=request.user).filter(is_read=False).update(is_read=True)

        serializer = ChatMessageSerializer(messages, many=True)
        return Response({
            'booking_id': booking.id,
            'messages': serializer.data,
        })


class BookingChatSendView(generics.GenericAPIView):
    """
    POST /auth/bookings/<pk>/chat/send/
    Body: { "message": "Hello!" }
    """
    permission_classes = (IsBookingParticipant,)

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ChatSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        msg = ChatMessage.objects.create(
            booking=booking,
            sender=request.user,
            message=serializer.validated_data['message'],
        )

        return Response({
            'id': msg.id,
            'sender': msg.sender.id,
            'sender_name': msg.sender.name,
            'sender_role': msg.sender.role,
            'message': msg.message,
            'created_at': msg.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class BookingUnreadCountView(generics.GenericAPIView):
    """
    GET /auth/bookings/<pk>/chat/unread/
    Returns the count of unread messages for the requesting user.
    """
    permission_classes = (IsBookingParticipant,)

    def get(self, request, pk):
        count = ChatMessage.objects.filter(
            booking_id=pk, is_read=False
        ).exclude(sender=request.user).count()
        return Response({'unread_count': count})
