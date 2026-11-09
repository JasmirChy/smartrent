from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    SignupView,
    VerifyOTPView,
    ResendOTPView,
    LoginView,
    MeProfileView,
    RequestPasswordChangeOTPView,
    ConfirmPasswordChangeOTPView,
    AdminTenantListView,
    KYCProfileView,
    AdminKYCListView,
    AdminKYCAuditView,
    AcceptDigitalLeaseView,
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeProfileView.as_view(), name='me_profile'),
    path('password/request-otp/', RequestPasswordChangeOTPView.as_view(), name='password_request_otp'),
    path('password/confirm-otp/', ConfirmPasswordChangeOTPView.as_view(), name='password_confirm_otp'),
    path('users/', AdminTenantListView.as_view(), name='admin_users_list'),
    path('kyc/', KYCProfileView.as_view(), name='kyc_profile'),
    path('kyc/admin-list/', AdminKYCListView.as_view(), name='admin_kyc_list'),
    path('kyc/<int:pk>/audit/', AdminKYCAuditView.as_view(), name='admin_kyc_audit'),
    path('kyc/accept-lease/', AcceptDigitalLeaseView.as_view(), name='accept_digital_lease'),
]