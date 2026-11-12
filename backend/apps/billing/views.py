import os
import json
import calendar
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

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
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/jpg'}


def validate_uploaded_image(file_obj, label):
    """Validates image size and content type for Zone 1 & Zone 2 proof uploads."""
    if not file_obj:
        return f"{label} is required."
    if hasattr(file_obj, 'size') and file_obj.size > MAX_PROOF_FILE_SIZE:
        return f"{label} exceeds the 5MB size limit."
    content_type = getattr(file_obj, 'content_type', '')
    if content_type and content_type.lower() not in ALLOWED_IMAGE_TYPES:
        return f"{label} must be a valid JPG, PNG, or WEBP image."
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
    """
    Zero-migration Payment QR Code manager:
    - GET: Returns the current QR image URL, merchant/account name, and note for Tenants & Admin.
    - POST: Allows Admin to upload/replace the QR code image and payment details.
    - DELETE: Allows Admin to remove the current QR code.
    """
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
            qr_url = request.build_absolute_uri(default_storage.url(qr_path))
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
    """
    Returns all bills for Admin, or only the logged-in Tenant's bills.
    Also runs a lightweight check to send due-date reminder emails automatically!
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MonthlyBillSerializer

    def get_queryset(self):
        try:
            dispatch_due_rent_email_reminders()
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


class TenantSubmitOnlineBillView(APIView):
    """
    Tenant enters new meter reading + uploads meter image + payment screenshot.
    System subtracts old reading from new reading, multiplies units by Rs. 15,
    adds base rent + Rs. 100 water + fines, and sets status to PENDING_VERIFICATION.
    """
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

        return Response(
            {
                "message": "Meter reading and payment proof submitted for Admin verification!",
                "bill": MonthlyBillSerializer(bill, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminAuditBillView(APIView):
    """
    Admin inspects meter photo & payment screenshot and either APPROVES or REJECTS.
    """
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, bill_id):
        bill = get_object_or_404(
            MonthlyBill.objects.select_for_update().select_related('room', 'tenant', 'tenancy'),
            id=bill_id,
        )

        if bill.status in ['APPROVED', 'PAID_CASH'] and request.data.get('action') == 'APPROVE':
            return Response(
                {"message": "This bill is already approved.", "bill": MonthlyBillSerializer(bill, context={'request': request}).data},
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

            try:
                send_mail(
                    subject=f"SmartRent - Payment Approved for Room {bill.room.room_number} ({bill.billing_month_label})",
                    message=(
                        f"Namaste {bill.tenant.full_name},\n\n"
                        f"Your payment of Rs. {bill.total_payable} for Room {bill.room.room_number} "
                        f"({bill.billing_month_label}) has been verified and approved!\n\n"
                        f"Breakdown:\n"
                        f"• Room Rent: Rs. {bill.base_rent}\n"
                        f"• Water Bill: Rs. {bill.water_bill}\n"
                        f"• Electricity: {bill.units_consumed} units × Rs. {bill.electricity_rate} = Rs. {bill.electricity_amount}\n"
                        f"• Damage Fine: Rs. {bill.damage_fine_amount}\n"
                        f"• Total Paid: Rs. {bill.total_payable}\n\n"
                        f"Thank you!\n— SmartRent House Management"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[bill.tenant.email],
                    fail_silently=True,
                )
            except Exception:
                pass

            return Response(
                {
                    "message": f"Bill for Room {bill.room.room_number} approved and receipt issued!",
                    "bill": MonthlyBillSerializer(bill, context={'request': request}).data,
                },
                status=status.HTTP_200_OK,
            )

        bill.status = 'REJECTED'
        bill.admin_remarks = remarks or "Please upload a clearer meter photo or valid payment screenshot."
        bill.save()

        return Response(
            {
                "message": f"Bill for Room {bill.room.room_number} rejected. Tenant notified to re-upload.",
                "bill": MonthlyBillSerializer(bill, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminCashOverrideView(APIView):
    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        serializer = AdminCashOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill = get_object_or_404(
            MonthlyBill.objects.select_for_update().select_related('room', 'tenant', 'tenancy'),
            id=serializer.validated_data['bill_id'],
        )
        new_reading = serializer.validated_data['current_meter_reading']

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
        bill.damage_fine_amount = serializer.validated_data.get('damage_fine_amount', Decimal('0.00'))
        bill.damage_fine_reason = serializer.validated_data.get('damage_fine_reason', '')
        bill.admin_remarks = serializer.validated_data.get('admin_remarks', 'Paid via Cash directly to Admin')
        if serializer.validated_data.get('meter_photo_proof'):
            bill.meter_photo_proof = serializer.validated_data['meter_photo_proof']

        bill.payment_method = 'CASH'
        bill.status = 'PAID_CASH'
        bill.transaction_reference = f"CASH-{timezone.now().strftime('%Y%m%d%H%M')}"
        bill.paid_at = timezone.now()
        bill.save()

        bill.room.current_meter_reading = new_reading
        bill.room.save(update_fields=['current_meter_reading', 'updated_at'])

        if bill.tenancy and bill.tenancy.is_active:
            create_next_cycle_bill(bill)

        return Response(
            {
                "message": f"Cash payment of Rs. {bill.total_payable} recorded for Room {bill.room.room_number}!",
                "bill": MonthlyBillSerializer(bill, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class BulkGenerateBillsView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request):
        active_tenancies = Tenancy.objects.filter(is_active=True).select_related('room', 'tenant')
        created_count = 0

        for tenancy in active_tenancies:
            has_open_bill = MonthlyBill.objects.filter(
                tenancy=tenancy,
                status__in=['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'],
            ).exists()

            if not has_open_bill:
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
                    MonthlyBill.objects.create(
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

        return Response({
            "message": (
                f"Auto-generation complete! Created {created_count} new bill(s) across "
                f"{active_tenancies.count()} active room(s)."
            ),
            "created_count": created_count,
        })


class AdminApplyFineView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, bill_id):
        bill = get_object_or_404(MonthlyBill.objects.select_for_update(), id=bill_id)
        serializer = AdminApplyFineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill.damage_fine_amount = serializer.validated_data['damage_fine_amount']
        bill.damage_fine_reason = serializer.validated_data['damage_fine_reason']
        bill.save()

        return Response(
            {
                "message": f"Damage fine of Rs. {bill.damage_fine_amount} applied to Room {bill.room.room_number}.",
                "bill": MonthlyBillSerializer(bill, context={'request': request}).data,
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
        sent_count = dispatch_due_rent_email_reminders()
        return Response({
            "message": f"Checked all active tenancies. Sent {sent_count} rental reminder email(s)."
        })