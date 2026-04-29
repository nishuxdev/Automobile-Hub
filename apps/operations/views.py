from rest_framework import generics, status
from rest_framework.response import Response
from apps.users.views import IsAdmin
from .models import Dispute, Payment
from .serializers import DisputeSerializer, PaymentSerializer

class AdminDisputeListView(generics.ListAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = DisputeSerializer

    def get_queryset(self):
        queryset = Dispute.objects.all().order_by('-created_at')
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        return queryset

class AdminDisputeActionView(generics.GenericAPIView):
    permission_classes = (IsAdmin,)

    def post(self, request, pk):
        try:
            dispute = Dispute.objects.get(pk=pk)
            action = request.data.get('action') # 'RESOLVE', 'REFUND'
            notes = request.data.get('notes', '')

            dispute.resolution_notes = notes
            
            if action == 'RESOLVE':
                dispute.status = 'RESOLVED'
            elif action == 'REFUND':
                # Trigger refund logic here...
                dispute.status = 'RESOLVED'
                if hasattr(dispute.booking, 'payment'):
                    dispute.booking.payment.status = 'REFUNDED'
                    dispute.booking.payment.save()
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

            dispute.save()
            return Response({'message': f'Dispute marked as {action}'})
        except Dispute.DoesNotExist:
            return Response({'error': 'Dispute not found'}, status=status.HTTP_404_NOT_FOUND)

class AdminPaymentListView(generics.ListAPIView):
    permission_classes = (IsAdmin,)
    serializer_class = PaymentSerializer

    def get_queryset(self):
        return Payment.objects.all().order_by('-created_at')