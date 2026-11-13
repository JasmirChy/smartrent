import os
import json
import calendar
import threading
import urllib.request
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.models import User
from apps.rooms.models import Room, Tenancy
from apps.rooms.views import IsAdminUserRole
from .models import MonthlyBill, HouseExpense
from .serializers import (
    MonthlyBillSerializer,
    TenantOnlineBillSubmitSerializer,
    AdminBillAuditSerializer,
    AdminCashOverrideSerializer,
    AdminApplyFineSerializer,
    HouseExpenseSerializer,
)
from .tasks import create_next_cycle_bill, dispatch_due_rent_email_reminders


MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic', '.heif', '.avif', '.jfif'
}

FINE_PROOFS_DIR = os.path.join(settings.MEDIA_ROOT, 'fine_proofs')
FINE_METADATA_FILE = os.path.join(FINE_PROOFS_DIR, 'fine_evidence_metadata.json')


def cleanup_orphaned_unpaid_bills():
    """
    Automatically removes leftover UNPAID / REJECTED / PENDING_VERIFICATION bills
    belonging to closed tenancies (is_active=False) or vacant rooms (is_occupied=False).
    Preserves all APPROVED and PAID_CASH historical receipts.
    """
    try:
        MonthlyBill.objects.filter(
            Q(tenancy__is_active=False) | Q(room__is_occupied=False),
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()
    except Exception:
        pass


def build_https_safe_uri(request, relative_url):
    """Builds an absolute URI and upgrades http:// to https:// on production hosts."""
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


def _read_fine_metadata():
    os.makedirs(FINE_PROOFS_DIR, exist_ok=True)
    if os.path.exists(FINE_METADATA_FILE):
        try:
            with open(FINE_METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _write_fine_metadata(data):
    os.makedirs(FINE_PROOFS_DIR, exist_ok=True)
    with open(FINE_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def enrich_bill_with_fine_evidence(request, bill_dict):
    """Attaches fine_evidence_urls and fine_applied_at to serialized bill dictionaries."""
    meta_map = _read_fine_metadata()
    bill_id_str = str(bill_dict.get('id'))
    entry = meta_map.get(bill_id_str, {})
    rel_paths = entry.get('paths', [])
    urls = []
    for p in rel_paths:
        if p and default_storage.exists(p):
            urls.append(build_https_safe_uri(request, default_storage.url(p)))
    bill_dict['fine_evidence_urls'] = urls
    bill_dict['fine_applied_at'] = entry.get('applied_at')
    return bill_dict


def get_admin_emails():
    """Returns all active Admin email addresses to receive billing & proof alerts."""
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


def _send_email_worker(recipient_list, subject, message_body):
    """
    Background worker:
    1) Tries Google Apps Script HTTPS Webhook FIRST (Port 443 — instant on Render Free Tier)
    2) Falls back to Django SMTP with a short timeout
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
                    if resp.status in (200, 302) and 'Unauthorized' not in body:
                        sent_via_webhook = True
            except Exception as wh_err:
                print(f"[SmartRent Billing Webhook Notice]: {wh_err}")

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
                print(f"[SmartRent Billing SMTP Notice]: {smtp_err}")

    return True


def send_billing_notification_email(recipient_email, subject, message_body):
    """
    Dispatches email asynchronously in a background thread (supports single email string or list of emails)
    so API responses return in <100ms.
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
        target=_send_email_worker,
        args=(recipient_list, subject, message_body),
        daemon=True,
    ).start()
    return True


def validate_uploaded_image(file_obj, label):
    """Validates image size (up to 5 MB) and allows all standard mobile/desktop image formats."""
    if not file_obj:
        return f"{label} is required."
    if hasattr(file_obj, 'size') and file_obj.size > MAX_PROOF_FILE_SIZE:
        return f"{label} exceeds the 5 MB size limit."
    ext = os.path.splitext(getattr(file_obj, 'name', '') or '')[1].lower()
    content_type = (getattr(file_obj, 'content_type', '') or '').lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS and not content_type.startswith('image/'):
        return f"{label} must be a valid image file (JPG, JPEG, PNG, WEBP, HEIC, etc.)."
    return None


def add_one_month_safe(orig_date):
    year = orig_date.year
    month = orig_date.month + 1
    if month > 12:
        month = 1
        year += 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(orig_date.day, max_day))


class PaymentQRConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    CONFIG_DIR = os.path.join(settings.MEDIA_ROOT, 'payment_qr')
    CONFIG_FILE = os.path.join(settings.MEDIA_ROOT, 'payment_qr', 'qr_metadata.json')

    def _read_config(self):
        os.makedirs(self.CONFIG_DIR, exist_ok=True)
        if os.path.exists(self.CONFIG_FILE):
            try:
                with open(self.CONFIG_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "qr_path": None,
            "merchant_name": "SmartRent Official eSewa / Fonepay",
            "payment_note": "Scan this QR with eSewa, Khalti, or your Mobile Banking app and upload the payment screenshot below.",
            "updated_at": None,
        }

    def _write_config(self, data):
        os.makedirs(self.CONFIG_DIR, exist_ok=True)
        with open(self.CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def _build_response(self, request, cfg):
        qr_url = None
        qr_path = cfg.get("qr_path")
        if qr_path and default_storage.exists(qr_path):
            qr_url = build_https_safe_uri(request, default_storage.url(qr_path))
        return {
            "qr_image_url": qr_url,
            "merchant_name": cfg.get("merchant_name") or "SmartRent Official QR",
            "payment_note": cfg.get("payment_note") or "Scan to pay your monthly bill.",
            "updated_at": cfg.get("updated_at"),
        }

    def get(self, request):
        cfg = self._read_config()
        return Response(self._build_response(request, cfg), status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser:
            return Response(
                {"error": "Only Admin can upload or update the Payment QR code."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cfg = self._read_config()
        qr_file = request.FILES.get('qr_image')

        if qr_file:
            err = validate_uploaded_image(qr_file, "Payment QR Code Image")
            if err:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

            old_path = cfg.get("qr_path")
            if old_path and default_storage.exists(old_path):
                try:
                    default_storage.delete(old_path)
                except Exception:
                    pass

            ext = os.path.splitext(qr_file.name)[1].lower() or '.png'
            saved_path = default_storage.save(
                f"payment_qr/smartrent_qr_{int(timezone.now().timestamp())}{ext}",
                qr_file,
            )
            cfg["qr_path"] = saved_path

        if 'merchant_name' in request.data:
            cfg["merchant_name"] = request.data.get('merchant_name', '').strip() or "SmartRent Official QR"
        if 'payment_note' in request.data:
            cfg["payment_note"] = request.data.get('payment_note', '').strip()

        cfg["updated_at"] = timezone.now().isoformat()
        self._write_config(cfg)

        return Response(
            {
                "message": "Official Payment QR Code updated successfully!",
                **self._build_response(request, cfg),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        user = request.user
        if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser:
            return Response(
                {"error": "Only Admin can remove the Payment QR code."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cfg = self._read_config()
        old_path = cfg.get("qr_path")
        if old_path and default_storage.exists(old_path):
            try:
                default_storage.delete(old_path)
            except Exception:
                pass

        cfg["qr_path"] = None
        cfg["updated_at"] = timezone.now().isoformat()
        self._write_config(cfg)

        return Response(
            {
                "message": "Payment QR code removed.",
                **self._build_response(request, cfg),
            },
            status=status.HTTP_200_OK,
        )


class BillListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MonthlyBillSerializer

    def get_queryset(self):
        cleanup_orphaned_unpaid_bills()

        try:
            threading.Thread(target=dispatch_due_rent_email_reminders, daemon=True).start()
        except Exception:
            pass

        user = self.request.user
        qs = MonthlyBill.objects.select_related('room', 'tenant', 'tenancy').all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        if user.role == 'ADMIN' or user.is_superuser:
            return qs
        return qs.filter(tenant=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        enriched = [enrich_bill_with_fine_evidence(request, dict(item)) for item in serializer.data]
        return Response(enriched)


class TenantSubmitOnlineBillView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, bill_id):
        bill = get_object_or_404(
            MonthlyBill.objects.select_for_update().select_related('room', 'tenant'),
            id=bill_id,
        )

        if request.user.role != 'ADMIN' and bill.tenant != request.user:
            return Response(
                {"error": "You can only submit bills for your own assigned room."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if bill.status in ['APPROVED', 'PAID_CASH']:
            return Response(
                {"error": "This bill has already been paid and verified."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meter_file = request.FILES.get('meter_photo_proof')
        payment_file = request.FILES.get('payment_screenshot_proof')

        meter_err = validate_uploaded_image(meter_file, "Zone 1 (Meter Photo Proof)")
        if meter_err:
            return Response({"error": meter_err}, status=status.HTTP_400_BAD_REQUEST)

        payment_err = validate_uploaded_image(payment_file, "Zone 2 (Payment Screenshot)")
        if payment_err:
            return Response({"error": payment_err}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TenantOnlineBillSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_reading = serializer.validated_data['current_meter_reading']
        if new_reading < bill.previous_meter_reading:
            return Response(
                {
                    "error": (
                        f"New meter reading ({new_reading}) cannot be less than "
                        f"the previous reading ({bill.previous_meter_reading})."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        bill.current_meter_reading = new_reading
        bill.meter_photo_proof = serializer.validated_data['meter_photo_proof']
        bill.payment_screenshot_proof = serializer.validated_data['payment_screenshot_proof']
        bill.transaction_reference = serializer.validated_data.get('transaction_reference', '')
        bill.payment_method = 'ONLINE'
        bill.status = 'PENDING_VERIFICATION'
        bill.save()

        meter_url = build_https_safe_uri(request, bill.meter_photo_proof.url) if bill.meter_photo_proof else 'N/A'
        pay_url = build_https_safe_uri(request, bill.payment_screenshot_proof.url) if bill.payment_screenshot_proof else 'N/A'

        # 1. Notify All Admins of New Payment & Meter Proof Submission
        send_billing_notification_email(
            recipient_email=get_admin_emails(),
            subject=f"💳 Payment Proof Submitted — Room {bill.room.room_number} ({bill.tenant.full_name})",
            message_body=(
                f"Namaste Admin,\n\n"
                f"Tenant {bill.tenant.full_name} ({bill.tenant.email}) has submitted their sub-meter reading "
                f"and online payment receipt for verification:\n\n"
                f"• Room: Room {bill.room.room_number} ({bill.billing_month_label})\n"
                f"• Meter Reading: {bill.previous_meter_reading} → {bill.current_meter_reading} ({bill.units_consumed} units)\n"
                f"• Total Payable Submitted: Rs. {bill.total_payable}\n"
                f"• Transaction Reference: {bill.transaction_reference or 'Not specified'}\n"
                f"• Zone 1 (Meter Photo): {meter_url}\n"
                f"• Zone 2 (Payment Receipt): {pay_url}\n\n"
                f"Open your SmartRent Admin Command Center (Remittance & Meter Audit Clearing) to Approve or Reject.\n"
                f"— SmartRent Automated Alert"
            ),
        )

        # 2. Notify Tenant that Proof is Under Review
        send_billing_notification_email(
            recipient_email=bill.tenant.email,
            subject=f"SmartRent — Payment Proof Received for Room {bill.room.room_number} ({bill.billing_month_label})",
            message_body=(
                f"Namaste {bill.tenant.full_name},\n\n"
                f"We have received your sub-meter reading ({bill.current_meter_reading} units) and payment screenshot "
                f"for Room {bill.room.room_number} ({bill.billing_month_label} — Total: Rs. {bill.total_payable}).\n\n"
                f"The Landlord Admin will verify your submission shortly and issue your official receipt by email.\n\n"
                f"— SmartRent House Management"
            ),
        )

        bill_data = enrich_bill_with_fine_evidence(
            request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
        )
        return Response(
            {
                "message": "Meter reading and payment proof submitted! Admin has been notified.",
                "bill": bill_data,
            },
            status=status.HTTP_200_OK,
        )


class AdminAuditBillView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, bill_id):
        bill = get_object_or_404(
            MonthlyBill.objects.select_for_update().select_related('room', 'tenant', 'tenancy'),
            id=bill_id,
        )

        if bill.status in ['APPROVED', 'PAID_CASH'] and request.data.get('action') == 'APPROVE':
            return Response(
                {
                    "message": "This bill is already approved.",
                    "bill": enrich_bill_with_fine_evidence(
                        request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
                    ),
                },
                status=status.HTTP_200_OK,
            )

        serializer = AdminBillAuditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        remarks = serializer.validated_data.get('admin_remarks', '')

        if action == 'APPROVE':
            bill.status = 'APPROVED'
            bill.admin_remarks = remarks
            bill.paid_at = timezone.now()
            bill.save()

            if bill.current_meter_reading is not None:
                bill.room.current_meter_reading = bill.current_meter_reading
                bill.room.save(update_fields=['current_meter_reading', 'updated_at'])

            if bill.tenancy and bill.tenancy.is_active:
                create_next_cycle_bill(bill)

            send_billing_notification_email(
                recipient_email=bill.tenant.email,
                subject=f"✅ SmartRent - Payment Approved for Room {bill.room.room_number} ({bill.billing_month_label})",
                message_body=(
                    f"Namaste {bill.tenant.full_name},\n\n"
                    f"Your payment of Rs. {bill.total_payable} for Room {bill.room.room_number} "
                    f"({bill.billing_month_label}) has been verified and APPROVED!\n\n"
                    f"Official Receipt Breakdown:\n"
                    f"• Room Rent: Rs. {bill.base_rent}\n"
                    f"• Water Bill: Rs. {bill.water_bill}\n"
                    f"• Electricity: {bill.units_consumed} units × Rs. {bill.electricity_rate} = Rs. {bill.electricity_amount}\n"
                    f"• Damage / Rule Fine: Rs. {bill.damage_fine_amount}\n"
                    f"• Total Paid: Rs. {bill.total_payable}\n"
                    f"• Admin Remarks: {remarks or 'Verified'}\n\n"
                    f"You can print your official PDF receipt anytime from your SmartRent Tenant Dashboard.\n\n"
                    f"Thank you!\n— SmartRent House Management"
                ),
            )

            return Response(
                {
                    "message": f"Bill for Room {bill.room.room_number} approved and receipt emailed to {bill.tenant.email}!",
                    "bill": enrich_bill_with_fine_evidence(
                        request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
                    ),
                },
                status=status.HTTP_200_OK,
            )

        bill.status = 'REJECTED'
        bill.admin_remarks = remarks or "Please upload a clearer meter photo or valid payment screenshot."
        bill.save()

        # Notify Tenant when Bill Proof is Rejected
        send_billing_notification_email(
            recipient_email=bill.tenant.email,
            subject=f"⚠️ SmartRent - Action Required: Payment Proof Rejected (Room {bill.room.room_number})",
            message_body=(
                f"Namaste {bill.tenant.full_name},\n\n"
                f"Your submitted meter photo / payment screenshot for Room {bill.room.room_number} "
                f"({bill.billing_month_label}) could not be verified.\n\n"
                f"Admin Remarks: {bill.admin_remarks}\n\n"
                f"Please log in to your SmartRent Tenant Dashboard and re-upload a clear meter reading photo and valid payment receipt.\n\n"
                f"— SmartRent House Management"
            ),
        )

        return Response(
            {
                "message": f"Bill for Room {bill.room.room_number} rejected and tenant notified by email.",
                "bill": enrich_bill_with_fine_evidence(
                    request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
                ),
            },
            status=status.HTTP_200_OK,
        )


def _get_or_create_open_bill_for_tenant(target_user):
    open_bill = (
        MonthlyBill.objects.select_for_update()
        .select_related('room', 'tenant', 'tenancy')
        .filter(tenant=target_user, status__in=['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'])
        .order_by('-due_date', '-created_at')
        .first()
    )
    if open_bill:
        return open_bill

    tenancy = (
        Tenancy.objects.filter(tenant=target_user, is_active=True)
        .select_related('room')
        .first()
    )
    today = timezone.localdate()

    if tenancy:
        room = tenancy.room
        due_date = (
            tenancy.get_next_due_date()
            if hasattr(tenancy, 'get_next_due_date')
            else add_one_month_safe(today)
        )
        base_rent = room.base_rent
        water_bill = room.fixed_water_bill
        elec_rate = room.electricity_rate_per_unit
        prev_meter = room.current_meter_reading
    else:
        room = Room.objects.first()
        if not room:
            room = Room.objects.create(
                room_number='A1',
                floor='GROUND',
                room_type='STANDARD',
                title='Ground Floor Unit A1',
                base_rent=Decimal('3800.00'),
                fixed_water_bill=Decimal('100.00'),
                electricity_rate_per_unit=Decimal('15.00'),
            )
        tenancy = Tenancy.objects.filter(tenant=target_user).order_by('-id').first()
        if not tenancy:
            tenancy = Tenancy.objects.create(
                room=room,
                tenant=target_user,
                entry_date=today,
                starting_meter_reading=room.current_meter_reading,
                is_active=False,
                move_out_date=today,
            )
        due_date = add_one_month_safe(today)
        base_rent = Decimal('0.00')
        water_bill = Decimal('0.00')
        elec_rate = room.electricity_rate_per_unit
        prev_meter = room.current_meter_reading

    return MonthlyBill.objects.create(
        tenancy=tenancy,
        room=room,
        tenant=target_user,
        billing_month_label=due_date.strftime("%B %Y"),
        cycle_start_date=today,
        cycle_end_date=due_date,
        due_date=due_date,
        base_rent=base_rent,
        water_bill=water_bill,
        electricity_rate=elec_rate,
        previous_meter_reading=prev_meter,
        status='UNPAID',
    )


class AdminCashOverrideView(APIView):
    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        bill_id = request.data.get('bill_id')
        tenant_id = request.data.get('tenant_id')

        if bill_id and str(bill_id).isdigit() and int(bill_id) > 0:
            bill = get_object_or_404(
                MonthlyBill.objects.select_for_update().select_related('room', 'tenant', 'tenancy'),
                id=int(bill_id),
            )
        elif tenant_id and str(tenant_id).isdigit() and int(tenant_id) > 0:
            target_user = get_object_or_404(User, id=int(tenant_id))
            bill = _get_or_create_open_bill_for_tenant(target_user)
        else:
            return Response(
                {"error": "Please select a valid bill or tenant to record cash payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_reading = request.data.get('current_meter_reading')
        new_reading = (
            Decimal(str(raw_reading))
            if raw_reading not in (None, '')
            else bill.previous_meter_reading
        )

        if new_reading < bill.previous_meter_reading:
            return Response(
                {
                    "error": (
                        f"New meter reading ({new_reading}) cannot be less than "
                        f"previous reading ({bill.previous_meter_reading})."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        bill.current_meter_reading = new_reading
        if request.data.get('damage_fine_amount') not in (None, ''):
            bill.damage_fine_amount = Decimal(str(request.data.get('damage_fine_amount')))
        if request.data.get('damage_fine_reason'):
            bill.damage_fine_reason = str(request.data.get('damage_fine_reason')).strip()
        bill.admin_remarks = request.data.get('admin_remarks', 'Paid via Cash directly to Admin')

        if request.FILES.get('meter_photo_proof'):
            bill.meter_photo_proof = request.FILES['meter_photo_proof']

        bill.payment_method = 'CASH'
        bill.status = 'PAID_CASH'
        bill.transaction_reference = f"CASH-{timezone.now().strftime('%Y%m%d%H%M')}"
        bill.paid_at = timezone.now()
        bill.save()

        bill.room.current_meter_reading = new_reading
        bill.room.save(update_fields=['current_meter_reading', 'updated_at'])

        if bill.tenancy and bill.tenancy.is_active:
            create_next_cycle_bill(bill)

        # Send Official Cash Receipt Email to Tenant
        send_billing_notification_email(
            recipient_email=bill.tenant.email,
            subject=f"✅ SmartRent Cash Payment Receipt — Room {bill.room.room_number} ({bill.billing_month_label})",
            message_body=(
                f"Namaste {bill.tenant.full_name},\n\n"
                f"Your cash payment of Rs. {bill.total_payable} for Room {bill.room.room_number} "
                f"({bill.billing_month_label}) has been recorded by the Admin!\n\n"
                f"Receipt Breakdown:\n"
                f"• Receipt Reference: {bill.transaction_reference}\n"
                f"• Room Rent: Rs. {bill.base_rent}\n"
                f"• Water Bill: Rs. {bill.water_bill}\n"
                f"• Electricity ({bill.previous_meter_reading} → {bill.current_meter_reading} = {bill.units_consumed} units × Rs. {bill.electricity_rate}): Rs. {bill.electricity_amount}\n"
                f"• Damage / Rule Fine: Rs. {bill.damage_fine_amount}\n"
                f"• Total Paid (CASH): Rs. {bill.total_payable}\n\n"
                f"Thank you!\n— SmartRent House Management"
            ),
        )

        return Response(
            {
                "message": (
                    f"Cash payment of Rs. {bill.total_payable} recorded for "
                    f"{bill.tenant.full_name} (Room {bill.room.room_number}) and receipt emailed!"
                ),
                "bill": enrich_bill_with_fine_evidence(
                    request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
                ),
            },
            status=status.HTTP_200_OK,
        )


class BulkGenerateBillsView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request):
        cleanup_orphaned_unpaid_bills()
        active_tenancies = Tenancy.objects.filter(is_active=True).select_related('room', 'tenant')
        created_count = 0

        for tenancy in active_tenancies:
            has_open_bill = MonthlyBill.objects.filter(
                tenancy=tenancy,
                status__in=['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'],
            ).exists()

            if not has_open_bill:
                new_bill = None
                last_paid = (
                    MonthlyBill.objects.filter(tenancy=tenancy, status__in=['APPROVED', 'PAID_CASH'])
                    .order_by('-due_date')
                    .first()
                )
                if last_paid:
                    new_bill = create_next_cycle_bill(last_paid)
                    if new_bill:
                        created_count += 1
                else:
                    due_date = tenancy.get_next_due_date()
                    new_bill = MonthlyBill.objects.create(
                        tenancy=tenancy,
                        room=tenancy.room,
                        tenant=tenancy.tenant,
                        billing_month_label=due_date.strftime("%B %Y"),
                        cycle_start_date=tenancy.entry_date,
                        cycle_end_date=due_date,
                        due_date=due_date,
                        base_rent=tenancy.room.base_rent,
                        water_bill=tenancy.room.fixed_water_bill,
                        electricity_rate=tenancy.room.electricity_rate_per_unit,
                        previous_meter_reading=tenancy.room.current_meter_reading,
                        status='UNPAID',
                    )
                    created_count += 1

                if new_bill and tenancy.tenant and tenancy.tenant.email:
                    send_billing_notification_email(
                        recipient_email=tenancy.tenant.email,
                        subject=f"📄 SmartRent — New Monthly Bill Generated for Room {tenancy.room.room_number} ({new_bill.billing_month_label})",
                        message_body=(
                            f"Namaste {tenancy.tenant.full_name},\n\n"
                            f"Your monthly billing invoice for Room {tenancy.room.room_number} ({new_bill.billing_month_label}) is now open.\n\n"
                            f"• Base Rent: Rs. {new_bill.base_rent}\n"
                            f"• Fixed Water Bill: Rs. {new_bill.water_bill}\n"
                            f"• Previous Sub-Meter Reading: {new_bill.previous_meter_reading} units\n"
                            f"• Due Date: {new_bill.due_date}\n\n"
                            f"Please log in to your SmartRent Tenant Dashboard to enter your current sub-meter reading and upload your payment receipt.\n\n"
                            f"— SmartRent House Management"
                        ),
                    )

        return Response({
            "message": (
                f"Auto-generation complete! Created {created_count} new bill(s) across "
                f"{active_tenancies.count()} active room(s) and emailed tenants."
            ),
            "created_count": created_count,
        })


class AdminApplyFineView(APIView):
    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request, bill_id=0):
        target_bill_id = bill_id or request.data.get('bill_id')
        target_tenant_id = request.data.get('tenant_id')

        if target_bill_id and str(target_bill_id).isdigit() and int(target_bill_id) > 0:
            bill = get_object_or_404(
                MonthlyBill.objects.select_for_update().select_related('room', 'tenant', 'tenancy'),
                id=int(target_bill_id),
            )
        elif target_tenant_id and str(target_tenant_id).isdigit() and int(target_tenant_id) > 0:
            target_user = get_object_or_404(User, id=int(target_tenant_id))
            bill = _get_or_create_open_bill_for_tenant(target_user)
        else:
            return Response(
                {"error": "Please select a Tenant or an active Bill to apply the fine."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mode = str(request.data.get('fine_mode') or 'SET').upper()

        if mode == 'UNDO':
            bill.damage_fine_amount = Decimal('0.00')
            bill.damage_fine_reason = ''
            bill.save()

            meta_map = _read_fine_metadata()
            bill_key = str(bill.id)
            if bill_key in meta_map:
                for p in meta_map[bill_key].get("paths", []):
                    if p and default_storage.exists(p):
                        try:
                            default_storage.delete(p)
                        except Exception:
                            pass
                del meta_map[bill_key]
                _write_fine_metadata(meta_map)

            email_subject = f"✅ SmartRent Notice — Fine Removed (Room {bill.room.room_number})"
            email_body = (
                f"Namaste {bill.tenant.full_name},\n\n"
                f"The property damage / rule violation fine previously applied to your account "
                f"for Room {bill.room.room_number} ({bill.billing_month_label}) has been "
                f"successfully REMOVED by the Admin.\n\n"
                f"Your updated Grand Total Payable is: Rs. {bill.total_payable}.\n\n"
                f"Thank you,\n— SmartRent House Management"
            )
            email_sent = send_billing_notification_email(
                bill.tenant.email, email_subject, email_body
            )

            serialized_bill = enrich_bill_with_fine_evidence(
                request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
            )
            return Response(
                {
                    "message": f"Fine successfully removed from {bill.tenant.full_name}'s bill.",
                    "email_sent": email_sent,
                    "bill": serialized_bill,
                },
                status=status.HTTP_200_OK,
            )

        raw_amount = request.data.get('damage_fine_amount')
        reason = str(request.data.get('damage_fine_reason') or '').strip()

        if raw_amount in (None, '') or Decimal(str(raw_amount)) <= Decimal('0.00'):
            return Response(
                {"error": "Please enter a valid fine amount greater than Rs. 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not reason:
            return Response(
                {"error": "Please enter a clear reason for the fine."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fine_amount = Decimal(str(raw_amount))
        if mode == 'ADD':
            bill.damage_fine_amount = (bill.damage_fine_amount or Decimal('0.00')) + fine_amount
            if bill.damage_fine_reason:
                bill.damage_fine_reason = f"{bill.damage_fine_reason} | {reason}"
            else:
                bill.damage_fine_reason = reason
        else:
            bill.damage_fine_amount = fine_amount
            bill.damage_fine_reason = reason

        bill.save()

        evidence_files = (
            request.FILES.getlist('evidence_images')
            or request.FILES.getlist('evidence_image')
            or ([request.FILES['evidence_image']] if 'evidence_image' in request.FILES else [])
        )

        meta_map = _read_fine_metadata()
        bill_key = str(bill.id)
        existing_entry = meta_map.get(bill_key, {"paths": []})
        saved_paths = list(existing_entry.get("paths", [])) if mode == 'ADD' else []

        if mode == 'SET' and evidence_files:
            for old_p in existing_entry.get("paths", []):
                if old_p and default_storage.exists(old_p):
                    try:
                        default_storage.delete(old_p)
                    except Exception:
                        pass
        elif mode == 'SET' and not evidence_files:
            saved_paths = list(existing_entry.get("paths", []))

        for idx, img_file in enumerate(evidence_files):
            err = validate_uploaded_image(img_file, f"Evidence Image #{idx + 1}")
            if err:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
            ext = os.path.splitext(img_file.name)[1].lower() or '.jpg'
            rel_path = default_storage.save(
                f"fine_proofs/bill_{bill.id}_fine_{int(timezone.now().timestamp())}_{idx}{ext}",
                img_file,
            )
            saved_paths.append(rel_path)

        meta_map[bill_key] = {
            "paths": saved_paths,
            "applied_at": timezone.now().strftime("%b %d, %Y %I:%M %p"),
            "reason": bill.damage_fine_reason,
            "amount": float(bill.damage_fine_amount),
        }
        _write_fine_metadata(meta_map)

        evidence_urls = []
        for p in saved_paths:
            if default_storage.exists(p):
                evidence_urls.append(build_https_safe_uri(request, default_storage.url(p)))

        evidence_email_section = ""
        if evidence_urls:
            links_formatted = "\n".join(
                [f"• Photo {i + 1}: {u}" for i, u in enumerate(evidence_urls)]
            )
            evidence_email_section = f"\nAttached Evidence Photo(s):\n{links_formatted}\n"

        email_subject = (
            f"⚠️ SmartRent Official Fine Notice — Rs. {bill.damage_fine_amount} "
            f"({bill.billing_month_label})"
        )
        email_body = (
            f"Namaste {bill.tenant.full_name},\n\n"
            f"An official property damage / rule violation fine has been applied to your SmartRent account.\n\n"
            f"Fine Details:\n"
            f"• Tenant Name: {bill.tenant.full_name}\n"
            f"• Room / Unit: Room {bill.room.room_number} ({bill.billing_month_label})\n"
            f"• Fine Amount: Rs. {bill.damage_fine_amount}\n"
            f"• Reason / Violation: {bill.damage_fine_reason}\n"
            f"• Updated Grand Total Payable: Rs. {bill.total_payable}\n"
            f"{evidence_email_section}\n"
            f"You can view the full breakdown and attached inspection photos in your SmartRent Tenant Dashboard.\n\n"
            f"— SmartRent House Management"
        )
        email_sent = send_billing_notification_email(
            bill.tenant.email, email_subject, email_body
        )

        serialized_bill = enrich_bill_with_fine_evidence(
            request, dict(MonthlyBillSerializer(bill, context={'request': request}).data)
        )

        return Response(
            {
                "message": (
                    f"Fine of Rs. {bill.damage_fine_amount} applied to {bill.tenant.full_name} "
                    f"(Room {bill.room.room_number}) and email notification dispatched!"
                ),
                "email_sent": email_sent,
                "bill": serialized_bill,
            },
            status=status.HTTP_200_OK,
        )


class HouseExpenseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = HouseExpenseSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = HouseExpense.objects.all()

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class HouseExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = HouseExpenseSerializer
    queryset = HouseExpense.objects.all()


class AdminAnalyticsDashboardView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        cleanup_orphaned_unpaid_bills()

        paid_bills = MonthlyBill.objects.filter(status__in=['APPROVED', 'PAID_CASH'])
        pending_bills = MonthlyBill.objects.filter(status='PENDING_VERIFICATION')
        unpaid_bills = MonthlyBill.objects.filter(status='UNPAID')
        expenses = HouseExpense.objects.all()

        total_revenue = paid_bills.aggregate(total=Sum('total_payable'))['total'] or Decimal('0.00')
        total_electricity_collected = paid_bills.aggregate(total=Sum('electricity_amount'))['total'] or Decimal('0.00')
        total_water_collected = paid_bills.aggregate(total=Sum('water_bill'))['total'] or Decimal('0.00')
        total_fines_collected = paid_bills.aggregate(total=Sum('damage_fine_amount'))['total'] or Decimal('0.00')
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net_profit = total_revenue - total_expenses

        category_labels = dict(HouseExpense.CATEGORY_CHOICES)
        expense_by_category = []
        for code, label in category_labels.items():
            cat_sum = expenses.filter(category=code).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            expense_by_category.append({
                "category": code,
                "name": label,
                "value": float(cat_sum),
            })

        income_vs_expense_pie = [
            {"name": "Total Rental & Utility Income", "value": float(total_revenue), "color": "#4F46E5"},
            {"name": "Total House Expenses", "value": float(total_expenses), "color": "#EF4444"},
        ]

        monthly_revenue_map = {}
        for b in paid_bills:
            label = b.billing_month_label
            monthly_revenue_map[label] = monthly_revenue_map.get(label, Decimal('0.00')) + b.total_payable

        monthly_expense_map = {}
        for exp in expenses:
            label = exp.expense_date.strftime("%B %Y")
            monthly_expense_map[label] = monthly_expense_map.get(label, Decimal('0.00')) + exp.amount

        all_months = list(dict.fromkeys(list(monthly_revenue_map.keys()) + list(monthly_expense_map.keys())))
        monthly_trend = []
        for m in all_months[-6:]:
            inc = float(monthly_revenue_map.get(m, Decimal('0.00')))
            out = float(monthly_expense_map.get(m, Decimal('0.00')))
            monthly_trend.append({
                "month": m,
                "income": inc,
                "expenses": out,
                "net": inc - out,
            })

        total_rooms = Room.objects.count()
        occupied_rooms = Room.objects.filter(is_occupied=True).count()

        return Response({
            "kpis": {
                "total_revenue": float(total_revenue),
                "total_expenses": float(total_expenses),
                "net_profit": float(net_profit),
                "electricity_collected": float(total_electricity_collected),
                "water_collected": float(total_water_collected),
                "fines_collected": float(total_fines_collected),
                "pending_verifications_count": pending_bills.count(),
                "unpaid_bills_count": unpaid_bills.count(),
                "total_rooms": total_rooms,
                "occupied_rooms": occupied_rooms,
                "vacant_rooms": total_rooms - occupied_rooms,
            },
            "expense_pie_chart": expense_by_category,
            "income_vs_expense_pie": income_vs_expense_pie,
            "monthly_trend_chart": monthly_trend,
        })


class TriggerDueRemindersView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request):
        threading.Thread(target=dispatch_due_rent_email_reminders, daemon=True).start()
        return Response({
            "message": "Rental reminder email check started in background!"
        })