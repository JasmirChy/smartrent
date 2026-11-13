import os
import json
import random
import threading
import urllib.request
from decimal import Decimal
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.conf import settings
from django.db import transaction, connection, IntegrityError
from django.db.models import Q
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.shortcuts import get_object_or_404

from apps.rooms.models import Room, Tenancy, RoomReservation, MoveOutRequest
from apps.rooms.views import IsAdminUserRole
from apps.billing.models import MonthlyBill, HouseExpense
from apps.communication.models import ComplaintTicket, ChatMessage, Notice
from .models import User, EmailOTP, KYCProfile
from .serializers import (
    UserProfileSerializer,
    SignupSerializer,
    VerifyOTPSerializer,
    LoginSerializer,
    RequestPasswordOTPSerializer,
    ConfirmPasswordOTPSerializer,
    KYCProfileSerializer,
)

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic', '.heif', '.avif', '.jfif'
}

BANNERS_DIR = os.path.join(settings.MEDIA_ROOT, 'profile_banners')
BANNERS_META_FILE = os.path.join(BANNERS_DIR, 'banners_metadata.json')


def build_https_safe_uri(request, relative_url):
    """
    Builds an absolute URI and automatically upgrades http:// to https://
    on production hosts (Render / Vercel) so browsers never block images.
    """
    if not relative_url:
        return None
    try:
        full_url = request.build_absolute_uri(relative_url)
    except Exception:
        full_url = str(relative_url)

    if (
        full_url.startswith('http://')
        and 'localhost' not in full_url
        and '127.0.0.1' not in full_url
        and '192.168.' not in full_url
    ):
        full_url = 'https://' + full_url[len('http://'):]
    return full_url


def _read_banners_map():
    os.makedirs(BANNERS_DIR, exist_ok=True)
    if os.path.exists(BANNERS_META_FILE):
        try:
            with open(BANNERS_META_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _write_banners_map(data):
    os.makedirs(BANNERS_DIR, exist_ok=True)
    with open(BANNERS_META_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def get_user_cover_urls(request, user_id):
    banners_map = _read_banners_map()
    rel_path = banners_map.get(str(user_id))
    if rel_path and default_storage.exists(rel_path):
        rel_url = default_storage.url(rel_path)
        return build_https_safe_uri(request, rel_url), rel_url
    return None, None


def build_enriched_user_dossier(request, u):
    serializer = UserProfileSerializer(u, context={'request': request})
    base_data = dict(serializer.data)

    active_tenancy = u.tenancies.filter(is_active=True).select_related('room').first()
    kyc = getattr(u, 'kyc_profile', None)
    cover_abs_url, cover_rel_path = get_user_cover_urls(request, u.id)

    # Clean up any leftover UNPAID/REJECTED bills belonging to closed tenancies
    try:
        MonthlyBill.objects.filter(
            tenant=u,
            tenancy__is_active=False,
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()
    except Exception:
        pass

    user_bills = list(u.bills.select_related('room').all().order_by('-due_date', '-created_at'))
    pending_bills_qs = [
        b for b in user_bills if b.status in ('UNPAID', 'PENDING_VERIFICATION', 'REJECTED')
    ]
    paid_bills_qs = [
        b for b in user_bills if b.status in ('APPROVED', 'PAID_CASH')
    ]

    total_pending_amount = sum((b.total_payable or Decimal('0.00')) for b in pending_bills_qs)
    total_paid_amount = sum((b.total_payable or Decimal('0.00')) for b in paid_bills_qs)

    recent_bills_payload = []
    for b in user_bills[:6]:
        recent_bills_payload.append({
            "id": b.id,
            "room_number": b.room.room_number if b.room else None,
            "billing_month_label": b.billing_month_label,
            "due_date": str(b.due_date) if b.due_date else None,
            "base_rent": float(b.base_rent or 0),
            "water_bill": float(b.water_bill or 0),
            "units_consumed": float(b.units_consumed or 0),
            "electricity_amount": float(b.electricity_amount or 0),
            "damage_fine_amount": float(b.damage_fine_amount or 0),
            "total_payable": float(b.total_payable or 0),
            "status": b.status,
            "status_display": b.get_status_display(),
            "transaction_reference": b.transaction_reference,
            "meter_photo_url": build_https_safe_uri(request, b.meter_photo_proof.url) if b.meter_photo_proof else None,
            "payment_screenshot_url": build_https_safe_uri(request, b.payment_screenshot_proof.url) if b.payment_screenshot_proof else None,
        })

    room_details = None
    if active_tenancy and active_tenancy.room:
        rm = active_tenancy.room
        room_details = {
            "id": rm.id,
            "room_number": rm.room_number,
            "floor": getattr(rm, 'floor', 'Ground Floor'),
            "base_rent": float(rm.base_rent or 0),
            "fixed_water_bill": float(getattr(rm, 'fixed_water_bill', 100) or 100),
            "electricity_rate": float(getattr(rm, 'electricity_rate_per_unit', 15) or 15),
            "current_meter_reading": float(rm.current_meter_reading or 0),
            "entry_date": str(active_tenancy.entry_date) if active_tenancy.entry_date else None,
            "next_due_date": str(active_tenancy.get_next_due_date()) if hasattr(active_tenancy, 'get_next_due_date') else None,
        }

    base_data.update({
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "phone_number": u.phone_number,
        "role": u.role,
        "is_active": u.is_active,
        "joined_at": u.created_at.strftime("%b %d, %Y") if hasattr(u, 'created_at') and u.created_at else None,
        "room_number": active_tenancy.room.room_number if active_tenancy else None,
        "entry_date": str(active_tenancy.entry_date) if active_tenancy else None,
        "room_details": room_details,
        "kyc_id": kyc.id if kyc else None,
        "kyc_status": kyc.status if kyc else "NOT_SUBMITTED",
        "full_name_legal": kyc.full_name_legal if kyc and kyc.full_name_legal else u.full_name,
        "citizenship_number": kyc.citizenship_number if kyc else None,
        "emergency_contact_name": getattr(kyc, 'emergency_contact_name', None) if kyc else None,
        "emergency_contact_phone": getattr(kyc, 'emergency_contact_phone', None) if kyc else None,
        "has_accepted_lease": getattr(kyc, 'has_accepted_lease', False) if kyc else False,
        "lease_accepted_at": kyc.lease_accepted_at.strftime("%b %d, %Y") if kyc and getattr(kyc, 'lease_accepted_at', None) else None,
        "citizenship_front_url": build_https_safe_uri(request, kyc.citizenship_front.url) if kyc and kyc.citizenship_front else None,
        "citizenship_back_url": build_https_safe_uri(request, kyc.citizenship_back.url) if kyc and kyc.citizenship_back else None,
        "profile_picture_url": build_https_safe_uri(request, u.profile_picture.url) if u.profile_picture else None,
        "profile_picture_path": u.profile_picture.url if u.profile_picture else None,
        "cover_picture_url": cover_abs_url,
        "cover_picture_path": cover_rel_path,
        "pending_bills_count": len(pending_bills_qs),
        "total_pending_amount": float(total_pending_amount),
        "paid_bills_count": len(paid_bills_qs),
        "total_paid_amount": float(total_paid_amount),
        "recent_bills": recent_bills_payload,
    })
    return base_data


def get_admin_emails():
    """Returns all active Admin email addresses to receive landlord notifications."""
    admin_emails = list(
        User.objects.filter(
            Q(role='ADMIN') | Q(is_superuser=True) | Q(is_staff=True),
            is_active=True,
        )
        .exclude(email='')
        .values_list('email', flat=True)
    )
    default_from = getattr(settings, 'EMAIL_HOST_USER', '') or getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    if default_from and '@' in default_from and default_from not in admin_emails:
        admin_emails.append(default_from)
    return list(dict.fromkeys(admin_emails))


def _send_smartrent_email_worker(recipient_list, subject, message_body):
    """
    Background worker:
    1) Tries Google Apps Script HTTPS Webhook FIRST (Port 443 — instant on Render Free Tier)
    2) Falls back to Standard Django SMTP if Webhook is not configured or fails
    """
    valid_recipients = [r.strip() for r in recipient_list if r and '@' in str(r)]
    if not valid_recipients:
        return False

    webhook_url = getattr(settings, 'GOOGLE_SCRIPT_WEBHOOK_URL', '').strip()
    webhook_secret = getattr(settings, 'GOOGLE_SCRIPT_SECRET', 'SMARTRENT_SECRET_2026').strip()

    for recipient_email in valid_recipients:
        sent_via_webhook = False
        if webhook_url:
            try:
                payload = json.dumps({
                    "secret": webhook_secret,
                    "to": recipient_email,
                    "subject": subject,
                    "message": message_body,
                }).encode('utf-8')
                req = urllib.request.Request(
                    webhook_url,
                    data=payload,
                    headers={'Content-Type': 'application/json'},
                    method='POST',
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    body = resp.read().decode('utf-8', errors='ignore')
                    if resp.status in (200, 302) and 'Unauthorized' not in body and '<!DOCTYPE html>' not in body:
                        sent_via_webhook = True
            except Exception as wh_err:
                print(f"[SmartRent Webhook Notice]: {wh_err}")

        if not sent_via_webhook and getattr(settings, 'EMAIL_HOST_USER', '') and getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
            try:
                send_mail(
                    subject=subject,
                    message=message_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False,
                )
            except Exception as smtp_err:
                print(f"[SmartRent SMTP Notice]: {smtp_err}")

    return True


def send_smartrent_email(recipient_email, subject, message_body):
    """
    Dispatches email asynchronously in a background thread (supports single email string or list of emails)
    so OTP and notification endpoints respond immediately (<100ms) without hanging the browser.
    """
    if not recipient_email:
        return False
    if isinstance(recipient_email, str):
        recipient_list = [recipient_email]
    else:
        recipient_list = list(recipient_email)
    if not recipient_list:
        return False
    threading.Thread(
        target=_send_smartrent_email_worker,
        args=(recipient_list, subject, message_body),
        daemon=True,
    ).start()
    return True


def generate_and_send_otp(email, purpose='PASSWORD_RESET'):
    EmailOTP.objects.filter(email=email, purpose=purpose, is_used=False).update(is_used=True)
    otp_code = f"{random.randint(100000, 999999)}"
    EmailOTP.objects.create(email=email, otp_code=otp_code, purpose=purpose)

    subject = "SmartRent - Password Change OTP Verification"
    message = (
        f"Namaste!\n\n"
        f"Your SmartRent password change verification code is: {otp_code}\n\n"
        f"This 6-digit OTP is valid for 10 minutes. Please do not share this code with anyone.\n\n"
        f"— SmartRent House Management"
    )

    email_sent = send_smartrent_email(email, subject, message)
    print(f"\n==========================================")
    print(f"🔑 SMARTRENT OTP FOR {email}: {otp_code} (Dispatched Async: {email_sent})")
    print(f"==========================================\n")
    return otp_code, email_sent


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
            tokens = get_tokens_for_user(user)

            # 1. Welcome Email to New Tenant
            send_smartrent_email(
                user.email,
                "🏠 Welcome to SmartRent Portal!",
                (
                    f"Namaste {user.full_name},\n\n"
                    f"Your SmartRent account ({user.email}) has been created successfully!\n\n"
                    f"Next Steps:\n"
                    f"• Complete your KYC Identity Verification and Digital Lease in your Tenant Dashboard.\n"
                    f"• Browse available rooms or view your assigned room telemetry.\n\n"
                    f"— SmartRent House Management"
                ),
            )

            # 2. Alert Admin(s) of New Tenant Signup
            send_smartrent_email(
                get_admin_emails(),
                f"👤 New Tenant Registered — {user.full_name}",
                (
                    f"Namaste Admin,\n\n"
                    f"A new user has registered on SmartRent:\n"
                    f"• Name: {user.full_name}\n"
                    f"• Email: {user.email}\n"
                    f"• Phone: {user.phone_number}\n\n"
                    f"— SmartRent Automated Alert"
                ),
            )

            return Response(
                {
                    "message": "Account created successfully!",
                    "tokens": tokens,
                    "user": build_enriched_user_dossier(request, user),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])

        tokens = get_tokens_for_user(user)
        return Response(
            {
                "message": "Login successful!",
                "tokens": tokens,
                "user": build_enriched_user_dossier(request, user),
            },
            status=status.HTTP_200_OK,
        )


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

        tokens = get_tokens_for_user(user)
        return Response(
            {
                "message": "OTP verified successfully!",
                "tokens": tokens,
                "user": build_enriched_user_dossier(request, user),
            },
            status=status.HTTP_200_OK,
        )


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        if not User.objects.filter(email=email).exists():
            return Response(
                {"error": "No account found with this email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        otp_code, email_sent = generate_and_send_otp(email, purpose='PASSWORD_RESET')
        msg = (
            f"A fresh 6-digit password reset OTP has been sent to {email}."
            if email_sent
            else f"OTP generated! (Check terminal or use code: {otp_code})"
        )
        return Response({"message": msg}, status=status.HTTP_200_OK)


class MeProfileView(APIView):
    """
    Handles retrieving and updating the logged-in user's profile, avatar, cover banner,
    and returns full room, billing, and KYC telemetry for the Profile Settings dashboard.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _validate_image_file(self, file_obj, label):
        if hasattr(file_obj, 'size') and file_obj.size > MAX_IMAGE_SIZE:
            return f"{label} exceeds the 5 MB limit. Please upload an image under 5 MB."
        ext = os.path.splitext(file_obj.name)[1].lower()
        content_type = (getattr(file_obj, 'content_type', '') or '').lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS and not content_type.startswith('image/'):
            return f"Unsupported format for {label}. Please upload a valid image (JPG, JPEG, PNG, WEBP, HEIC, etc.)."
        return None

    def get(self, request):
        return Response(build_enriched_user_dossier(request, request.user), status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        uploaded_avatar = request.FILES.get('profile_picture')
        uploaded_cover = request.FILES.get('cover_picture')
        remove_cover = str(request.data.get('remove_cover_picture') or '').lower() in ('true', '1', 'yes')

        if uploaded_avatar:
            err = self._validate_image_file(uploaded_avatar, "Profile picture")
            if err:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
            user.profile_picture = uploaded_avatar

        if uploaded_cover:
            err = self._validate_image_file(uploaded_cover, "Cover banner image")
            if err:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

            banners_map = _read_banners_map()
            old_path = banners_map.get(str(user.id))
            if old_path and default_storage.exists(old_path):
                try:
                    default_storage.delete(old_path)
                except Exception:
                    pass

            ext = os.path.splitext(uploaded_cover.name)[1].lower() or '.jpg'
            saved_path = default_storage.save(
                f"profile_banners/user_{user.id}_cover_{int(timezone.now().timestamp())}{ext}",
                uploaded_cover,
            )
            banners_map[str(user.id)] = saved_path
            _write_banners_map(banners_map)
        elif remove_cover:
            banners_map = _read_banners_map()
            old_path = banners_map.pop(str(user.id), None)
            if old_path and default_storage.exists(old_path):
                try:
                    default_storage.delete(old_path)
                except Exception:
                    pass
            _write_banners_map(banners_map)

        if 'full_name' in request.data:
            new_name = str(request.data.get('full_name') or '').strip()
            if new_name:
                user.full_name = new_name

        if 'phone_number' in request.data:
            new_phone = str(request.data.get('phone_number') or '').strip()
            if new_phone and new_phone != user.phone_number:
                conflicting_users = User.objects.filter(phone_number=new_phone).exclude(id=user.id)
                if conflicting_users.exists():
                    for other_u in conflicting_users:
                        other_u.phone_number = f"900{random.randint(1000000, 9999999)}"
                        other_u.save(update_fields=['phone_number'])
                user.phone_number = new_phone

        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            return Response(
                {"error": "That phone number is already in use by another account. Please enter a different number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = build_enriched_user_dossier(request, user)
        payload['message'] = "Profile, avatar, and cover banner updated successfully!"
        return Response(payload, status=status.HTTP_200_OK)


class RequestPasswordChangeOTPView(APIView):
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

        otp_code, email_sent = generate_and_send_otp(email, purpose='PASSWORD_RESET')
        msg = (
            f"Password verification OTP sent to {email}."
            if email_sent
            else f"OTP generated for {email}! (Email relay not active yet — use OTP code: {otp_code})"
        )
        return Response({"message": msg}, status=status.HTTP_200_OK)


class ConfirmPasswordChangeOTPView(APIView):
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

        send_smartrent_email(
            user.email,
            "🔒 SmartRent Security Alert — Password Updated",
            (
                f"Namaste {user.full_name},\n\n"
                f"Your SmartRent account password was successfully updated.\n"
                f"If you did not perform this action, please contact SmartRent House Management immediately.\n\n"
                f"— SmartRent House Management"
            ),
        )

        return Response(
            {"message": "Password updated successfully! You can now log in with your new password."},
            status=status.HTTP_200_OK,
        )


class AdminTenantListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_queryset(self):
        if self.request.user.role != 'ADMIN' and not self.request.user.is_superuser:
            return User.objects.filter(id=self.request.user.id)
        return User.objects.all().order_by('-created_at')


class AdminUserManagementListView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        users = User.objects.all().prefetch_related('tenancies__room', 'kyc_profile', 'bills__room').order_by('-created_at')
        data = [build_enriched_user_dossier(request, u) for u in users]
        return Response(data)


class AdminEvictOrManageUserView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)
        active_tenancies = Tenancy.objects.filter(tenant=target_user, is_active=True).select_related('room')

        vacated_rooms = []
        for t in active_tenancies:
            room = t.room
            room.is_occupied = False
            room.save(update_fields=['is_occupied', 'updated_at'])
            t.is_active = False
            t.move_out_date = timezone.localdate()
            t.save(update_fields=['is_active', 'move_out_date'])
            vacated_rooms.append(room.room_number)

        # Clear any open unpaid advance bills and pending move-out requests for this vacated tenant
        MonthlyBill.objects.filter(
            tenant=target_user,
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()
        MoveOutRequest.objects.filter(tenant=target_user, status='PENDING').update(
            status='APPROVED',
            resolved_at=timezone.now(),
        )

        action_type = request.data.get('action_type', 'VACATE')
        if action_type == 'BAN':
            target_user.is_active = False
            target_user.save(update_fields=['is_active'])

        if target_user.email:
            send_smartrent_email(
                target_user.email,
                f"SmartRent Notice — Room Tenancy Update ({', '.join(vacated_rooms) if vacated_rooms else 'Account'})",
                (
                    f"Namaste {target_user.full_name},\n\n"
                    f"Your tenancy for Room(s): {', '.join(vacated_rooms) if vacated_rooms else 'N/A'} "
                    f"has been officially closed/vacated by the Landlord Admin on {timezone.localdate()}.\n\n"
                    f"Please contact House Management if you have any final settlement questions.\n"
                    f"— SmartRent House Management"
                ),
            )

        return Response({
            "message": f"Successfully processed request for {target_user.full_name}. Vacated rooms: {', '.join(vacated_rooms) if vacated_rooms else 'None'}."
        })


class AdminManageAdminsView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request):
        action = (request.data.get('action') or '').upper()
        target_email = request.data.get('email', '').lower().strip()

        if action == 'CREATE':
            full_name = request.data.get('full_name', '')
            phone_number = request.data.get('phone_number', '')
            password = request.data.get('password', '')

            if not target_email or not password or not full_name or not phone_number:
                return Response({"error": "All fields (email, full name, phone number, password) are required."}, status=status.HTTP_400_BAD_REQUEST)

            if User.objects.filter(email=target_email).exists():
                return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

            new_admin = User.objects.create_user(
                email=target_email,
                full_name=full_name,
                phone_number=phone_number,
                password=password,
                role='ADMIN',
                is_staff=True,
                is_email_verified=True,
            )

            send_smartrent_email(
                new_admin.email,
                "🛡️ SmartRent — Administrator Account Created",
                (
                    f"Namaste {new_admin.full_name},\n\n"
                    f"You have been granted Landlord Administrator access on SmartRent Portal.\n"
                    f"• Login Email: {new_admin.email}\n\n"
                    f"— SmartRent Executive Command"
                ),
            )

            return Response({"message": f"Successfully created new Admin account for {new_admin.email}!"}, status=status.HTTP_201_CREATED)

        if action == 'REMOVE':
            target_id = request.data.get('user_id')
            user = get_object_or_404(User, id=target_id)

            if user == request.user:
                return Response({"error": "You cannot remove your own admin privileges."}, status=status.HTTP_400_BAD_REQUEST)

            if User.objects.filter(role='ADMIN', is_active=True).count() <= 1:
                return Response({"error": "Cannot remove the last active administrator."}, status=status.HTTP_400_BAD_REQUEST)

            user.role = 'TENANT'
            user.is_staff = False
            user.save(update_fields=['role', 'is_staff', 'updated_at'])
            return Response({"message": f"Successfully removed admin privileges from {user.full_name}."})

        return Response({"error": "Invalid action specified."}, status=status.HTTP_400_BAD_REQUEST)


class AdminResetDatabaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser and user.email != 'rentals.rooms77@gmail.com':
            return Response(
                {"error": "Only Admin can reset the database."},
                status=status.HTTP_403_FORBIDDEN,
            )

        confirm_phrase = (request.data.get('confirm_phrase') or '').strip().upper()
        if confirm_phrase != 'RESET':
            return Response(
                {"error": "Confirmation phrase 'RESET' is required to wipe the database."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with connection.cursor() as cursor:
                tables_to_wipe = [
                    'communication_chatmessage',
                    'communication_complaintticket',
                    'communication_notice',
                    'billing_monthlybill',
                    'billing_houseexpense',
                    'rooms_roomreservation',
                    'rooms_moveoutrequest',
                    'rooms_tenancy',
                    'accounts_emailotp',
                    'accounts_kycprofile',
                ]
                for table in tables_to_wipe:
                    try:
                        with transaction.atomic():
                            cursor.execute(f'DELETE FROM "{table}";')
                    except Exception:
                        pass

            with transaction.atomic():
                Room.objects.all().update(
                    is_occupied=False,
                    current_meter_reading=Decimal('0.00'),
                )

            with transaction.atomic():
                tenants_to_delete = User.objects.exclude(id=user.id)
                deleted_count = tenants_to_delete.count()
                tenants_to_delete.delete()

        except Exception as e:
            return Response(
                {"error": f"Database reset failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": (
                    f"System reset complete! Erased {deleted_count} user account(s), all bills, chats, and KYC records. "
                    f"All rooms are now Vacant (0.00 units) and your logged-in Admin account is preserved."
                )
            },
            status=status.HTTP_200_OK,
        )


class KYCProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = KYCProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, created = KYCProfile.objects.get_or_create(
            user=self.request.user,
            defaults={'full_name_legal': getattr(self.request.user, 'full_name', '') or self.request.user.email}
        )
        return profile

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status != 'VERIFIED':
            instance.status = 'PENDING'
            instance.save(update_fields=['status', 'updated_at'])

        user = self.request.user
        front_url = build_https_safe_uri(self.request, instance.citizenship_front.url) if instance.citizenship_front else 'Not uploaded'
        back_url = build_https_safe_uri(self.request, instance.citizenship_back.url) if instance.citizenship_back else 'Not uploaded'

        # 1. Notify All Admins of KYC Submission
        send_smartrent_email(
            get_admin_emails(),
            f"🪪 KYC Documents Submitted — {user.full_name}",
            (
                f"Namaste Admin,\n\n"
                f"A tenant has submitted / updated their KYC Identity Verification documents:\n\n"
                f"• Tenant: {user.full_name} ({user.email})\n"
                f"• Legal Full Name: {instance.full_name_legal}\n"
                f"• Citizenship No: {instance.citizenship_number}\n"
                f"• Emergency Contact: {instance.emergency_contact_name} ({instance.emergency_contact_phone})\n"
                f"• Citizenship Front: {front_url}\n"
                f"• Citizenship Back: {back_url}\n\n"
                f"Please inspect and Verify or Reject their KYC in the Admin Command Center -> Tenants Directory.\n"
                f"— SmartRent Automated Alert"
            ),
        )

        # 2. Notify Tenant
        send_smartrent_email(
            user.email,
            "SmartRent — KYC Documents Received for Verification",
            (
                f"Namaste {user.full_name},\n\n"
                f"Your KYC identity documents (Citizenship No: {instance.citizenship_number}) have been saved "
                f"and submitted to the Landlord Admin for verification.\n\n"
                f"You will receive an email as soon as your KYC status is verified.\n\n"
                f"— SmartRent House Management"
            ),
        )


class AdminKYCListView(generics.ListAPIView):
    serializer_class = KYCProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', '') == 'ADMIN' or user.is_staff or user.is_superuser:
            return KYCProfile.objects.select_related('user').all()
        return KYCProfile.objects.filter(user=user)


class AdminKYCAuditView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            profile = KYCProfile.objects.select_related('user').get(pk=pk)
        except KYCProfile.DoesNotExist:
            return Response({"detail": "KYC profile not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not (getattr(user, 'role', '') == 'ADMIN' or user.is_staff or user.is_superuser):
            return Response({"detail": "Admin privileges required."}, status=status.HTTP_403_FORBIDDEN)

        action = (request.data.get('action') or '').upper()
        notes = request.data.get('admin_notes', '')

        if action == 'VERIFY':
            profile.status = 'VERIFIED'
            profile.admin_notes = notes
            profile.save(update_fields=['status', 'admin_notes', 'updated_at'])

            send_smartrent_email(
                profile.user.email,
                "✅ SmartRent — Your KYC Identity is Verified!",
                (
                    f"Namaste {profile.user.full_name},\n\n"
                    f"Great news! Your KYC identity documents (Citizenship No: {profile.citizenship_number or 'Verified'}) "
                    f"have been reviewed and VERIFIED by the Landlord Admin.\n\n"
                    f"Admin Notes: {notes or 'Identity verified.'}\n\n"
                    f"Thank you,\n— SmartRent House Management"
                ),
            )

            return Response({
                "message": f"KYC verified for {profile.user.email} and email notification sent!",
                "profile": KYCProfileSerializer(profile, context={'request': request}).data
            })

        if action == 'REJECT':
            profile.status = 'REJECTED'
            profile.admin_notes = notes
            profile.save(update_fields=['status', 'admin_notes', 'updated_at'])

            send_smartrent_email(
                profile.user.email,
                "⚠️ SmartRent — KYC Verification Action Required",
                (
                    f"Namaste {profile.user.full_name},\n\n"
                    f"Your KYC identity submission could not be verified at this time.\n"
                    f"Reason / Admin Notes: {notes or 'Please upload clearer citizenship front and back photos.'}\n\n"
                    f"Please log in to your SmartRent Tenant Dashboard (Tab 2: KYC Verification) to update your documents.\n\n"
                    f"— SmartRent House Management"
                ),
            )

            return Response({
                "message": f"KYC rejected for {profile.user.email} and tenant notified via email.",
                "profile": KYCProfileSerializer(profile, context={'request': request}).data
            })

        return Response({"detail": "Invalid action. Use VERIFY or REJECT."}, status=status.HTTP_400_BAD_REQUEST)


class AcceptDigitalLeaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, created = KYCProfile.objects.get_or_create(
            user=request.user,
            defaults={'full_name_legal': getattr(request.user, 'full_name', '') or request.user.email}
        )
        profile.has_accepted_lease = True
        profile.lease_accepted_at = timezone.now()
        profile.save(update_fields=['has_accepted_lease', 'lease_accepted_at', 'updated_at'])

        # Notify Tenant
        send_smartrent_email(
            request.user.email,
            "📜 SmartRent — Digital Lease Agreement Signed",
            (
                f"Namaste {request.user.full_name},\n\n"
                f"You have officially accepted and signed the SmartRent Digital Lease Agreement on "
                f"{profile.lease_accepted_at.strftime('%b %d, %Y %I:%M %p')}.\n\n"
                f"— SmartRent House Management"
            ),
        )

        # Notify Admin(s)
        send_smartrent_email(
            get_admin_emails(),
            f"📜 Digital Lease Signed — {request.user.full_name}",
            (
                f"Namaste Admin,\n\n"
                f"Tenant {request.user.full_name} ({request.user.email}) has accepted and signed the Digital Lease Agreement.\n\n"
                f"— SmartRent Automated Alert"
            ),
        )

        return Response({
            "message": "Digital lease agreement accepted successfully!",
            "profile": KYCProfileSerializer(profile, context={'request': request}).data
        })