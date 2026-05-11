from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserRegistrationView, CurrentUserView, VerifyOTPView, 
    ResendOTPView, AdminStatsView, AdminUserListView, AdminUserToggleActiveView
)

from apps.marketplace.views import (
    MechanicOnboardingView, MechanicAvailabilityToggleView,
    AdminMechanicVerificationListView, AdminMechanicVerifyActionView, AdminMechanicDetailView,
    MechanicServiceListView, MechanicServiceDetailView
)
from apps.bookings.views import (
    AdminBookingListView, AdminBookingOverrideView,
    MechanicJobListView, MechanicJobDetailView, MechanicJobUpdateStatusView, MechanicEarningsView
)
from apps.bookings.customer_views import (
    NearbyMechanicListView, CustomerBookingCreateView, CustomerBookingListView,
    CustomerBookingDetailView, CustomerSelectMechanicView, CustomerBookingCancelView,
    CustomerConfirmPaymentView, CustomerRatingCreateView, CustomerStatsView,
)
from apps.bookings.chat_views import (
    BookingChatListView, BookingChatSendView, BookingUnreadCountView,
)
from apps.operations.views import (
    AdminDisputeListView, AdminDisputeActionView, AdminPaymentListView,
    AdminVideoLectureListCreateView, AdminVideoLectureDeleteView, MechanicVideoLectureListView
)
from apps.core.views import AdminPlatformConfigView

urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', CurrentUserView.as_view(), name='current_user'),
    path('mechanic/onboarding/', MechanicOnboardingView.as_view(), name='mechanic_onboarding_api'),
    
    # Mechanic API
    path('mechanic/jobs/', MechanicJobListView.as_view(), name='mechanic_jobs'),
    path('mechanic/jobs/<int:pk>/', MechanicJobDetailView.as_view(), name='mechanic_job_detail'),
    path('mechanic/jobs/<int:pk>/status/', MechanicJobUpdateStatusView.as_view(), name='mechanic_job_status'),
    path('mechanic/availability/', MechanicAvailabilityToggleView.as_view(), name='mechanic_availability'),
    path('mechanic/earnings/', MechanicEarningsView.as_view(), name='mechanic_earnings'),
    path('mechanic/services/', MechanicServiceListView.as_view(), name='mechanic_services'),
    path('mechanic/services/<int:pk>/', MechanicServiceDetailView.as_view(), name='mechanic_service_detail'),
    path('mechanic/lectures/', MechanicVideoLectureListView.as_view(), name='mechanic_lectures'),

    # Customer API
    path('customer/nearby-mechanics/', NearbyMechanicListView.as_view(), name='nearby_mechanics'),
    path('customer/bookings/', CustomerBookingListView.as_view(), name='customer_bookings'),
    path('customer/bookings/create/', CustomerBookingCreateView.as_view(), name='customer_booking_create'),
    path('customer/bookings/<int:pk>/', CustomerBookingDetailView.as_view(), name='customer_booking_detail'),
    path('customer/bookings/<int:pk>/select-mechanic/', CustomerSelectMechanicView.as_view(), name='customer_select_mechanic'),
    path('customer/bookings/<int:pk>/cancel/', CustomerBookingCancelView.as_view(), name='customer_booking_cancel'),
    path('customer/bookings/<int:pk>/confirm-payment/', CustomerConfirmPaymentView.as_view(), name='customer_confirm_payment'),
    path('customer/bookings/<int:pk>/rate/', CustomerRatingCreateView.as_view(), name='customer_rating'),
    path('customer/stats/', CustomerStatsView.as_view(), name='customer_stats'),

    # Chat API (shared by customer + mechanic)
    path('bookings/<int:pk>/chat/', BookingChatListView.as_view(), name='booking_chat'),
    path('bookings/<int:pk>/chat/send/', BookingChatSendView.as_view(), name='booking_chat_send'),
    path('bookings/<int:pk>/chat/unread/', BookingUnreadCountView.as_view(), name='booking_chat_unread'),

    # Admin API - Users
    path('admin/stats/', AdminStatsView.as_view(), name='admin_stats'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_users'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin_user_toggle_active'),
    
    # Admin API - Marketplace (Mechanics)
    path('admin/mechanics/verifications/', AdminMechanicVerificationListView.as_view(), name='admin_mechanic_verifications'),
    path('admin/mechanics/<int:pk>/verify/', AdminMechanicVerifyActionView.as_view(), name='admin_mechanic_verify'),
    path('admin/mechanics/<int:pk>/', AdminMechanicDetailView.as_view(), name='admin_mechanic_detail'),
    
    # Admin API - Bookings
    path('admin/bookings/', AdminBookingListView.as_view(), name='admin_bookings'),
    path('admin/bookings/<int:pk>/override/', AdminBookingOverrideView.as_view(), name='admin_booking_override'),
    
    # Admin API - Operations
    path('admin/disputes/', AdminDisputeListView.as_view(), name='admin_disputes'),
    path('admin/disputes/<int:pk>/action/', AdminDisputeActionView.as_view(), name='admin_disputes_action'),
    path('admin/payments/', AdminPaymentListView.as_view(), name='admin_payments'),
    
    # Admin API - Core
    path('admin/config/', AdminPlatformConfigView.as_view(), name='admin_config'),

    # Admin API - Lectures
    path('admin/lectures/', AdminVideoLectureListCreateView.as_view(), name='admin_lectures'),
    path('admin/lectures/<int:pk>/', AdminVideoLectureDeleteView.as_view(), name='admin_lecture_delete'),
]