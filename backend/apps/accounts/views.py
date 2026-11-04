import random
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, EmailOTP
from .serializers import (
    UserProfileSerializer,
    SignupSerializer,
    VerifyOTPSerializer,
    LoginSerializer,
    RequestPasswordOTPSerializer,
    ConfirmPasswordOTPSerializer,
)


def generate_and_send_otp(email, purpose='SIGNUP'):
    """Generates a 6-digit OTP, invalidates old unused OTPs, and emails it to the user."""
    EmailOTP.objects.filter(email=email, purpose=purpose, is_used=False).update(is_used=True)
    otp_code = f"{random.randint(100000, 999999)}"
    EmailOTP.objects.create(email=email, otp_code=otp_code, purpose=purpose)

    subject = (
        "SmartRent - Verify Your Account (OTP)"
        if purpose == 'SIGNUP'
        else "SmartRent - Password Change OTP Verification"
    )
    message = (
        f"Namaste!\n\n"
        f"Your SmartRent verification code is: {otp_code}\n\n"
        f"This 6-digit OTP is valid for 10 minutes. Please do not share this code with anyone.\n\n"
        f"— SmartRent House Management"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
    return otp_code


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            generate_and_send_otp(user.email, purpose='SIGNUP')
            return Response(
                {
                    "message": "Account created! A 6-digit OTP has been sent to your email.",
                    "email": user.email,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        otp_code = serializer.validated_data['otp_code']
        purpose = serializer.validated_data['purpose']

        otp_record = EmailOTP.objects.filter(
            email=email,
            otp_code=otp_code,
            purpose=purpose,
            is_used=False,
        ).first()

        if not otp_record or not otp_record.is_valid:
            return Response(
                {"error": "Invalid or expired OTP code. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record.is_used = True
        otp_record.save()

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if purpose == 'SIGNUP':
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])

        tokens = get_tokens_for_user(user)
        return Response(
            {
                "message": "Email verified successfully!",
                "tokens": tokens,
                "user": UserProfileSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        purpose = request.data.get('purpose', 'SIGNUP')

        if not User.objects.filter(email=email).exists():
            return Response(
                {"error": "No account found with this email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        generate_and_send_otp(email, purpose=purpose)
        return Response(
            {"message": f"A fresh 6-digit OTP has been sent to {email}."},
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        if not user.is_email_verified:
            generate_and_send_otp(user.email, purpose='SIGNUP')
            return Response(
                {
                    "error": "Email not verified yet. We have sent a fresh OTP to your email.",
                    "requires_otp": True,
                    "email": user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = get_tokens_for_user(user)
        return Response(
            {
                "message": "Login successful!",
                "tokens": tokens,
                "user": UserProfileSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class MeProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RequestPasswordChangeOTPView(APIView):
    """Sends a 6-digit OTP to the user's email to authorize changing their password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RequestPasswordOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {"error": "No registered user found with this email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        generate_and_send_otp(email, purpose='PASSWORD_RESET')
        return Response(
            {"message": f"Password verification OTP sent to {email}."},
            status=status.HTTP_200_OK,
        )


class ConfirmPasswordChangeOTPView(APIView):
    """Validates the email OTP and updates the user's password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ConfirmPasswordOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        otp_record = EmailOTP.objects.filter(
            email=email,
            otp_code=otp_code,
            purpose='PASSWORD_RESET',
            is_used=False,
        ).first()

        if not otp_record or not otp_record.is_valid:
            return Response(
                {"error": "Invalid or expired OTP code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        otp_record.is_used = True
        otp_record.save()

        user.set_password(new_password)
        user.is_email_verified = True
        user.save()

        return Response(
            {"message": "Password updated successfully! You can now log in with your new password."},
            status=status.HTTP_200_OK,
        )


class AdminTenantListView(generics.ListAPIView):
    """Allows Admin to view all registered users/tenants and manage them."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_queryset(self):
        if self.request.user.role != 'ADMIN' and not self.request.user.is_superuser:
            return User.objects.filter(id=self.request.user.id)
        return User.objects.all().order_by('-created_at')