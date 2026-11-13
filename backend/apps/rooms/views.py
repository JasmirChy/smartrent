import os
import json
import calendar
import threading
import urllib.request
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.communication.models import Notice
from apps.communication.serializers import NoticeSerializer
from apps.accounts.models import User
from apps.billing.models import MonthlyBill
from .models import Room, Tenancy, HeroBanner, HouseRule, RoomReservation, MoveOutRequest
from .serializers import (
    RoomSerializer,
    HeroBannerSerializer,
    HouseRuleSerializer,
    AssignTenantSerializer,
    RoomReservationSerializer,
)

MAX_BANNER_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_BANNER_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic', '.heif', '.avif', '.jfif'
}


def add_one_month(orig_date):
    """Calculates 1 month ahead from orig_date."""
    year = orig_date.year
    month = orig_date.month + 1
    if month > 12:
        month = 1
        year += 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(orig_date.day, max_day))


def calculate_pro_rata_rent(monthly_base_rent, days_lived):
    """
    Divides monthly room rent by 30 and multiplies by the number of days lived.
    If days_lived == 30, returns the exact monthly_base_rent.
    """
    rent_dec = Decimal(str(monthly_base_rent or '0.00'))
    days = max(1, int(days_lived))
    if days == 30:
        return rent_dec
    daily_rate = rent_dec / Decimal('30.00')
    return (daily_rate * Decimal(days)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def sync_tenancy_billing_cycles():
    """
    1) Deletes orphaned UNPAID/REJECTED bills belonging to closed/vacated tenancies.
    2) Removes premature auto-created full-month UNPAID bills where < 30 days have elapsed
       (unless the bill has a fine applied or is a Move-Out / Pro-Rata bill).
    3) Automatically generates a pending UNPAID monthly bill (base_rent + water_bill)
       as soon as 30 days (1 full month) are completed for any active tenancy.
    """
    today = timezone.localdate()
    try:
        # 1. Clean up orphaned unpaid bills for inactive tenancies or vacant rooms
        MonthlyBill.objects.filter(
            Q(tenancy__is_active=False) | Q(room__is_occupied=False),
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()

        # 2. Check all active tenancies
        active_tenancies = Tenancy.objects.filter(is_active=True).select_related('room', 'tenant')
        for tenancy in active_tenancies:
            open_bills = list(
                MonthlyBill.objects.filter(
                    tenancy=tenancy,
                    status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
                ).order_by('-created_at')
            )

            last_paid = (
                MonthlyBill.objects.filter(
                    tenancy=tenancy,
                    status__in=['APPROVED', 'PAID_CASH'],
                )
                .order_by('-cycle_end_date', '-paid_at', '-id')
                .first()
            )

            cycle_start = last_paid.cycle_end_date if (last_paid and last_paid.cycle_end_date) else tenancy.entry_date
            days_completed = (today - cycle_start).days

            if open_bills:
                # If an UNPAID bill was prematurely created before 30 days and is NOT a pro-rata/move-out/fine bill, remove it until 30 days complete
                for ob in open_bills:
                    label_str = (ob.billing_month_label or '').upper()
                    is_special_bill = (
                        'PRO-RATA' in label_str
                        or 'MOVE-OUT' in label_str
                        or 'SETTLEMENT' in label_str
                        or 'MANUAL' in label_str
                        or (ob.damage_fine_amount and ob.damage_fine_amount > Decimal('0.00'))
                        or ob.status == 'PENDING_VERIFICATION'
                    )
                    ob_days = (today - (ob.cycle_start_date or cycle_start)).days
                    if not is_special_bill and ob_days < 30 and today < ob.due_date:
                        ob.delete()
            else:
                # 3. If 30 days (1 month) are completed and no open bill exists, generate the pending monthly bill
                if days_completed >= 30:
                    due_date = cycle_start + timedelta(days=30)
                    MonthlyBill.objects.create(
                        tenancy=tenancy,
                        room=tenancy.room,
                        tenant=tenancy.tenant,
                        billing_month_label=due_date.strftime("%B %Y"),
                        cycle_start_date=cycle_start,
                        cycle_end_date=due_date,
                        due_date=due_date,
                        base_rent=tenancy.room.base_rent,
                        water_bill=tenancy.room.fixed_water_bill,
                        electricity_rate=tenancy.room.electricity_rate_per_unit,
                        previous_meter_reading=tenancy.room.current_meter_reading,
                        status='UNPAID',
                    )
    except Exception as e:
        print(f"[SmartRent Billing Sync Notice]: {e}")


def build_https_safe_uri(request, relative_url):
    """
    Builds an absolute URI and upgrades http:// to https:// on production hosts
    so browsers on https://smartrent-portal.vercel.app never block images.
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


def _send_email_worker(recipient_list, subject, message_body):
    valid_recipients = [r.strip() for r in recipient_list if r and '@' in str(r)]
    if not valid_recipients:
        return False

    webhook_url = getattr(settings, 'GOOGLE_SCRIPT_WEBHOOK_URL', '').strip()
    webhook_secret = getattr(settings, 'GOOGLE_SCRIPT_SECRET', 'SMARTRENT_SECRET_2026').strip()

    for recipient in valid_recipients:
        sent_via_webhook = False
        if webhook_url:
            try:
                payload = json.dumps({
                    "secret": webhook_secret,
                    "to": recipient,
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
                print(f"[SmartRent Rooms Webhook Notice]: {wh_err}")

        if not sent_via_webhook and getattr(settings, 'EMAIL_HOST_USER', '') and getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
            try:
                send_mail(
                    subject=subject,
                    message=message_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient],
                    fail_silently=False,
                )
            except Exception as smtp_err:
                print(f"[SmartRent Rooms SMTP Notice]: {smtp_err}")

    return True


def send_rooms_email(recipients, subject, message_body):
    """Dispatches emails in a background thread so API responses return in <100ms."""
    if isinstance(recipients, str):
        recipient_list = [recipients]
    else:
        recipient_list = list(recipients or [])
    if not recipient_list:
        return False
    threading.Thread(
        target=_send_email_worker,
        args=(recipient_list, subject, message_body),
        daemon=True,
    ).start()
    return True


def get_admin_emails():
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


class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or request.user.is_superuser or request.user.is_staff)
        )


class PublicLandingDataView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        sync_tenancy_billing_cycles()

        Room.objects.filter(room_number__istartswith='B').exclude(floor='FIRST').update(floor='FIRST')
        Room.objects.filter(room_number__istartswith='A').exclude(floor='GROUND').update(floor='GROUND')

        rooms = Room.objects.all().prefetch_related('tenancies__tenant', 'reservations')
        banners = HeroBanner.objects.filter(is_active=True).order_by('-id')
        rules = HouseRule.objects.filter(is_active=True)
        notices = Notice.objects.filter(is_active=True).order_by('-created_at')[:5]

        total_rooms = rooms.count()
        occupied_rooms = rooms.filter(is_occupied=True).count()
        available_rooms = total_rooms - occupied_rooms

        banners_data = HeroBannerSerializer(banners, many=True, context={'request': request}).data
        for idx, b_obj in enumerate(banners):
            if b_obj.image and idx < len(banners_data):
                try:
                    banners_data[idx]['image_url'] = build_https_safe_uri(request, b_obj.image.url)
                    banners_data[idx]['image_path'] = b_obj.image.url
                except Exception:
                    pass

        return Response({
            "stats": {
                "total_rooms": total_rooms,
                "occupied_rooms": occupied_rooms,
                "available_rooms": available_rooms,
            },
            "banners": banners_data,
            "rooms": RoomSerializer(rooms, many=True, context={'request': request}).data,
            "rules": HouseRuleSerializer(rules, many=True).data,
            "notices": NoticeSerializer(notices, many=True, context={'request': request}).data,
        })


PublicLandingView = PublicLandingDataView


class RoomListUpdateView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RoomSerializer

    def get_queryset(self):
        sync_tenancy_billing_cycles()
        return Room.objects.all().prefetch_related('tenancies__tenant', 'reservations')


class AdminRoomDetailUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = RoomSerializer
    queryset = Room.objects.all()


class AdminAssignTenantToRoomView(APIView):
    """
    Assigns a user to a room, sets the initial meter reading & entry_date,
    and marks the room as occupied.
     If entry_date is already >= 30 days ago, generates the pending 1-month bill immediately;
    otherwise, the bill becomes pending once 30 days are completed (or if the tenant requests early move-out).
    """
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        serializer = AssignTenantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = get_object_or_404(User, id=serializer.validated_data['tenant_id'])
        entry_date = serializer.validated_data['entry_date']
        starting_meter = serializer.validated_data['starting_meter_reading']

        Tenancy.objects.filter(room=room, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate()
        )
        Tenancy.objects.filter(tenant=tenant, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate()
        )

        MonthlyBill.objects.filter(
            Q(room=room) | Q(tenant=tenant),
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()

        MoveOutRequest.objects.filter(tenant=tenant, status='PENDING').update(
            status='APPROVED',
            resolved_at=timezone.now(),
        )

        tenancy = Tenancy.objects.create(
            room=room,
            tenant=tenant,
            entry_date=entry_date,
            starting_meter_reading=starting_meter,
            is_active=True,
        )

        room.is_occupied = True
        room.current_meter_reading = starting_meter
        room.save(update_fields=['is_occupied', 'current_meter_reading', 'updated_at'])

        if getattr(tenant, 'role', '') not in ['ADMIN', 'TENANT']:
            tenant.role = 'TENANT'
            tenant.save(update_fields=['role'])

        first_due_date = entry_date + timedelta(days=30)

        # Only create the pending UNPAID bill immediately if 30 days have already elapsed since entry_date
        if (timezone.localdate() - entry_date).days >= 30:
            MonthlyBill.objects.create(
                tenancy=tenancy,
                room=room,
                tenant=tenant,
                billing_month_label=first_due_date.strftime("%B %Y"),
                cycle_start_date=entry_date,
                cycle_end_date=first_due_date,
                due_date=first_due_date,
                base_rent=room.base_rent,
                water_bill=room.fixed_water_bill,
                electricity_rate=room.electricity_rate_per_unit,
                previous_meter_reading=starting_meter,
                status='UNPAID',
            )

        RoomReservation.objects.filter(room=room, status='PENDING').update(
            status='REJECTED',
            admin_remarks='Room has been occupied.'
        )

        send_rooms_email(
            recipients=[tenant.email],
            subject=f"🏠 Welcome to SmartRent — Assigned to Room {room.room_number}!",
            message_body=(
                f"Namaste {tenant.full_name},\n\n"
                f"You have been officially assigned to Room {room.room_number} at SmartRent!\n\n"
                f"Tenancy Details:\n"
                f"• Room Number: Room {room.room_number}\n"
                f"• Move-In Date: {entry_date}\n"
                f"• Starting Sub-Meter Reading: {starting_meter} units\n"
                f"• Base Monthly Rent: Rs. {room.base_rent}\n"
                f"• Fixed Water Supply: Rs. {room.fixed_water_bill}/month\n"
                f"• Electricity Rate: Rs. {room.electricity_rate_per_unit}/unit\n"
                f"• 30-Day Billing Cycle Due Date: {first_due_date}\n\n"
                f"— SmartRent House Management"
            ),
        )

        return Response(
            {
                "message": f"{tenant.full_name} assigned to Room {room.room_number} successfully!",
                "room": RoomSerializer(room, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminVacateRoomView(APIView):
    """Marks a room as available/vacant, closes the active tenancy, and cleans up open unpaid bills."""
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        active_tenancies = list(
            Tenancy.objects.filter(room=room, is_active=True).select_related('tenant')
        )
        Tenancy.objects.filter(room=room, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate(),
        )
        MoveOutRequest.objects.filter(room=room, status='PENDING').update(
            status='APPROVED',
            resolved_at=timezone.now(),
        )
        MonthlyBill.objects.filter(
            room=room,
            status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
        ).delete()

        room.is_occupied = False
        room.save(update_fields=['is_occupied', 'updated_at'])

        for t in active_tenancies:
            if t.tenant and t.tenant.email:
                send_rooms_email(
                    recipients=[t.tenant.email],
                    subject=f"SmartRent Notice — Room {room.room_number} Tenancy Closed",
                    message_body=(
                        f"Namaste {t.tenant.full_name},\n\n"
                        f"Your tenancy for Room {room.room_number} has been marked as completed/vacated on {timezone.localdate()}.\n\n"
                        f"Thank you for staying with SmartRent!\n"
                        f"— SmartRent House Management"
                    ),
                )

        return Response(
            {
                "message": f"Room {room.room_number} is now marked as Available.",
                "room": RoomSerializer(room, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class RoomReservationListCreateView(generics.ListCreateAPIView):
    serializer_class = RoomReservationSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', '') == 'ADMIN' or user.is_staff or user.is_superuser:
            return RoomReservation.objects.select_related('room', 'user').all()
        return RoomReservation.objects.select_related('room', 'user').filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        phone = serializer.validated_data.get('phone_number') or getattr(user, 'phone_number', '')
        reservation = serializer.save(user=user, phone_number=phone)

        send_rooms_email(
            recipients=get_admin_emails(),
            subject=f"📅 New Room {reservation.room.room_number} Booking Request — {user.full_name}",
            message_body=(
                f"Namaste Admin,\n\n"
                f"A new room reservation / visit request has been submitted on SmartRent:\n\n"
                f"• Applicant: {user.full_name} ({user.email})\n"
                f"• Phone: {phone or 'Not provided'}\n"
                f"• Room: Room {reservation.room.room_number}\n"
                f"• Request Type: {reservation.get_request_type_display()}\n"
                f"• Expected Move-In / Visit Date: {reservation.expected_move_in_date}\n"
                f"• Notes: {reservation.message or 'None'}\n\n"
                f"Please review and Approve or Reject this request in the Admin Command Center.\n"
                f"— SmartRent Automated Alert"
            ),
        )

        send_rooms_email(
            recipients=[user.email],
            subject=f"SmartRent — Room {reservation.room.room_number} Request Received",
            message_body=(
                f"Namaste {user.full_name},\n\n"
                f"Your {reservation.get_request_type_display()} request for Room {reservation.room.room_number} "
                f"(Expected Date: {reservation.expected_move_in_date}) has been received!\n\n"
                f"Our Landlord Admin will review your request shortly and notify you by email.\n\n"
                f"— SmartRent House Management"
            ),
        )


class RoomReservationActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        reservation = get_object_or_404(
            RoomReservation.objects.select_for_update().select_related('room', 'user'),
            pk=pk
        )

        action = (request.data.get('action') or '').upper()
        user = request.user
        is_admin = getattr(user, 'role', '') == 'ADMIN' or user.is_staff or user.is_superuser

        if action == 'CANCEL':
            if reservation.user != user and not is_admin:
                return Response({"detail": "Not authorized to cancel this reservation."}, status=status.HTTP_403_FORBIDDEN)
            if reservation.status != 'PENDING':
                return Response({"detail": "Only pending reservations can be cancelled."}, status=status.HTTP_400_BAD_REQUEST)
            reservation.status = 'CANCELLED'
            reservation.save(update_fields=['status', 'updated_at'])
            return Response({
                "message": "Reservation cancelled.",
                "reservation": RoomReservationSerializer(reservation, context={'request': request}).data
            })

        if not is_admin:
            return Response({"detail": "Only Admin can approve or reject reservations."}, status=status.HTTP_403_FORBIDDEN)

        remarks = request.data.get('admin_remarks', '')

        if action == 'REJECT':
            reservation.status = 'REJECTED'
            reservation.admin_remarks = remarks
            reservation.save(update_fields=['status', 'admin_remarks', 'updated_at'])

            send_rooms_email(
                recipients=[reservation.user.email],
                subject=f"SmartRent Update — Room {reservation.room.room_number} Request Status",
                message_body=(
                    f"Namaste {reservation.user.full_name},\n\n"
                    f"Your reservation request for Room {reservation.room.room_number} could not be approved at this time.\n"
                    f"Admin Remarks: {remarks or 'Room unavailable.'}\n\n"
                    f"— SmartRent House Management"
                ),
            )

            return Response({
                "message": f"Reservation for Room {reservation.room.room_number} rejected.",
                "reservation": RoomReservationSerializer(reservation, context={'request': request}).data
            })

        if action == 'APPROVE':
            room = reservation.room
            if room.is_occupied:
                return Response({"detail": f"Room {room.room_number} is already occupied!"}, status=status.HTTP_400_BAD_REQUEST)

            raw_meter = request.data.get('starting_meter_reading')
            starting_meter = Decimal(str(raw_meter)) if raw_meter not in [None, ''] else room.current_meter_reading

            raw_date = request.data.get('entry_date')
            if raw_date:
                entry_date = datetime.strptime(str(raw_date), "%Y-%m-%d").date() if isinstance(raw_date, str) else raw_date
            else:
                entry_date = reservation.expected_move_in_date or timezone.localdate()

            tenant = reservation.user

            if reservation.phone_number and not getattr(tenant, 'phone_number', ''):
                try:
                    tenant.phone_number = reservation.phone_number
                    tenant.save(update_fields=['phone_number'])
                except Exception:
                    pass

            Tenancy.objects.filter(room=room, is_active=True).update(
                is_active=False,
                move_out_date=timezone.localdate()
            )
            Tenancy.objects.filter(tenant=tenant, is_active=True).update(
                is_active=False,
                move_out_date=timezone.localdate()
            )

            MonthlyBill.objects.filter(
                Q(room=room) | Q(tenant=tenant),
                status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
            ).delete()

            reservation.status = 'APPROVED'
            reservation.admin_remarks = remarks
            reservation.save(update_fields=['status', 'admin_remarks', 'updated_at'])

            tenancy = Tenancy.objects.create(
                room=room,
                tenant=tenant,
                entry_date=entry_date,
                starting_meter_reading=starting_meter,
                is_active=True,
            )

            room.is_occupied = True
            room.current_meter_reading = starting_meter
            room.save(update_fields=['is_occupied', 'current_meter_reading', 'updated_at'])

            if getattr(tenant, 'role', '') not in ['ADMIN', 'TENANT']:
                tenant.role = 'TENANT'
                tenant.save(update_fields=['role'])

            first_due_date = entry_date + timedelta(days=30)

            if (timezone.localdate() - entry_date).days >= 30:
                MonthlyBill.objects.create(
                    tenancy=tenancy,
                    room=room,
                    tenant=tenant,
                    billing_month_label=first_due_date.strftime("%B %Y"),
                    cycle_start_date=entry_date,
                    cycle_end_date=first_due_date,
                    due_date=first_due_date,
                    base_rent=room.base_rent,
                    water_bill=room.fixed_water_bill,
                    electricity_rate=room.electricity_rate_per_unit,
                    previous_meter_reading=starting_meter,
                    status='UNPAID',
                )

            RoomReservation.objects.filter(room=room, status='PENDING').exclude(pk=reservation.pk).update(
                status='REJECTED',
                admin_remarks='Room was assigned to another approved applicant.'
            )

            send_rooms_email(
                recipients=[tenant.email],
                subject=f"✅ SmartRent Booking Approved — Welcome to Room {room.room_number}!",
                message_body=(
                    f"Namaste {tenant.full_name},\n\n"
                    f"Congratulations! Your reservation for Room {room.room_number} has been APPROVED.\n\n"
                    f"• Assigned Unit: Room {room.room_number}\n"
                    f"• Move-In Date: {entry_date}\n"
                    f"• Starting Sub-Meter Reading: {starting_meter} units\n"
                    f"• Monthly Base Rent: Rs. {room.base_rent}\n"
                    f"• First 30-Day Billing Due Date: {first_due_date}\n\n"
                    f"— SmartRent House Management"
                ),
            )

            return Response({
                "message": f"Reservation approved! {tenant.full_name or tenant.email} is now assigned to Room {room.room_number}.",
                "reservation": RoomReservationSerializer(reservation, context={'request': request}).data,
                "room": RoomSerializer(room, context={'request': request}).data,
            })

        return Response({"detail": "Invalid action. Use APPROVE, REJECT, or CANCEL."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# ITEM B: MOVE-OUT & PRO-RATA SETTLEMENT VIEWS
# ============================================================================

class MoveOutStatusView(APIView):
    """Returns whether the logged-in tenant has an active move-out request and their current cycle day count."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sync_tenancy_billing_cycles()
        try:
            active_tenancy = Tenancy.objects.filter(tenant=request.user, is_active=True).select_related('room').first()
            if not active_tenancy:
                return Response({"has_active_request": False, "request": None})

            last_paid = (
                MonthlyBill.objects.filter(
                    tenancy=active_tenancy,
                    status__in=['APPROVED', 'PAID_CASH'],
                )
                .order_by('-cycle_end_date', '-paid_at', '-id')
                .first()
            )
            cycle_start = last_paid.cycle_end_date if (last_paid and last_paid.cycle_end_date) else active_tenancy.entry_date
            days_lived = max(0, (timezone.localdate() - cycle_start).days)

            req = MoveOutRequest.objects.filter(
                tenant=request.user,
                tenancy=active_tenancy,
            ).order_by('-created_at').first()

            if not req or req.status == 'REJECTED':
                return Response({
                    "has_active_request": False,
                    "request": None,
                    "cycle_start_date": str(cycle_start),
                    "days_lived_in_cycle": days_lived,
                })
            return Response({
                "has_active_request": True,
                "cycle_start_date": str(cycle_start),
                "days_lived_in_cycle": days_lived,
                "request": {
                    "id": req.id,
                    "room_number": req.room.room_number,
                    "requested_date": req.requested_date,
                    "reason": req.reason,
                    "status": req.status,
                    "status_display": req.get_status_display(),
                }
            })
        except Exception:
            return Response({"has_active_request": False, "request": None})


class RequestMoveOutView(APIView):
    """
    Enforces the strict Move-Out & Pro-Rata Billing rules:
    1) If the tenant has any unpaid days (e.g. 10 days, 15 days, or 30+ days) or an existing UNPAID bill,
       calculates their exact bill:
       - If < 30 days: Pro-Rata Room Rent = (monthly_base_rent / 30) * days_lived + water_bill
       - If >= 30 days: Full monthly_base_rent (or pro-rata for exact days) + water_bill
    2) Blocks the Move-Out request until all pending bills are PAID (APPROVED or PAID_CASH).
    3) Once all pending bills are paid, submits the Move-Out request to Admin Command Center!
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        active_tenancy = (
            Tenancy.objects.filter(tenant=request.user, is_active=True)
            .select_related('room')
            .first()
        )
        if not active_tenancy:
            return Response(
                {"error": "You do not have an active room tenancy to vacate."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_mo = MoveOutRequest.objects.filter(tenancy=active_tenancy, status='PENDING').first()
        if existing_mo:
            return Response(
                {"error": "You already have a pending move-out request awaiting Admin review."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room = active_tenancy.room
        today = timezone.localdate()

        raw_req_date = request.data.get('requested_date')
        if raw_req_date:
            try:
                requested_date = (
                    datetime.strptime(str(raw_req_date), "%Y-%m-%d").date()
                    if isinstance(raw_req_date, str)
                    else raw_req_date
                )
            except Exception:
                requested_date = today
        else:
            requested_date = today

        reason = (request.data.get('reason') or '').strip()

        # Find the last paid bill for this tenancy to determine unpaid cycle_start_date
        last_paid = (
            MonthlyBill.objects.filter(
                tenancy=active_tenancy,
                status__in=['APPROVED', 'PAID_CASH'],
            )
            .order_by('-cycle_end_date', '-paid_at', '-id')
            .first()
        )
        cycle_start = (
            last_paid.cycle_end_date
            if (last_paid and last_paid.cycle_end_date)
            else active_tenancy.entry_date
        )

        # Target end date for stay calculation is whichever is later: today or requested_date
        target_end_date = max(today, requested_date)
        raw_days_lived = (target_end_date - cycle_start).days

        # Check if there is an existing open bill
        open_bill = (
            MonthlyBill.objects.filter(
                tenancy=active_tenancy,
                status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
            )
            .order_by('-created_at')
            .first()
        )

        # Case 1: Tenant already has a bill awaiting Admin verification
        if open_bill and open_bill.status == 'PENDING_VERIFICATION':
            return Response(
                {
                    "error": (
                        f"Your payment proof for Rs. {open_bill.total_payable} ({open_bill.billing_month_label}) "
                        f"is currently awaiting Admin verification. Once Admin approves your payment, "
                        f"you can submit your Move-Out request!"
                    ),
                    "requires_payment": True,
                    "bill_id": open_bill.id,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Case 2: Tenant has an open UNPAID/REJECTED bill OR has unpaid days lived not yet billed
        has_paid_current_stay = last_paid is not None and raw_days_lived <= 0

        if open_bill or not has_paid_current_stay:
            days_to_bill = max(1, raw_days_lived)
            pro_rata_rent = calculate_pro_rata_rent(room.base_rent, days_to_bill)

            if days_to_bill < 30:
                bill_label = f"Pro-Rata Move-Out ({days_to_bill} Days)"
            elif days_to_bill == 30:
                bill_label = f"Monthly Bill (30 Days • {target_end_date.strftime('%b %Y')})"
            else:
                bill_label = f"Move-Out Settlement ({days_to_bill} Days)"

            if open_bill:
                open_bill.billing_month_label = bill_label
                open_bill.cycle_start_date = cycle_start
                open_bill.cycle_end_date = target_end_date
                open_bill.due_date = today
                open_bill.base_rent = pro_rata_rent
                open_bill.water_bill = room.fixed_water_bill
                open_bill.electricity_rate = room.electricity_rate_per_unit
                open_bill.save()
                target_bill = open_bill
            else:
                target_bill = MonthlyBill.objects.create(
                    tenancy=active_tenancy,
                    room=room,
                    tenant=request.user,
                    billing_month_label=bill_label,
                    cycle_start_date=cycle_start,
                    cycle_end_date=target_end_date,
                    due_date=today,
                    base_rent=pro_rata_rent,
                    water_bill=room.fixed_water_bill,
                    electricity_rate=room.electricity_rate_per_unit,
                    previous_meter_reading=room.current_meter_reading,
                    status='UNPAID',
                )

            return Response(
                {
                    "error": (
                        f"Pending Bill Generated for {days_to_bill} Day(s) Stayed: "
                        f"Room Rent Rs. {target_bill.base_rent} (Rs. {room.base_rent} ÷ 30 × {days_to_bill} days) "
                        f"+ Water Rs. {target_bill.water_bill}"
                        + (
                            f" + Fine Rs. {target_bill.damage_fine_amount}"
                            if target_bill.damage_fine_amount > 0
                            else ""
                        )
                        + f" = Rs. {target_bill.total_payable} (+ electricity when you enter your meter reading). "
                        f"Please pay this pending bill first; once paid and approved, you can request Move-Out!"
                    ),
                    "requires_payment": True,
                    "bill_id": target_bill.id,
                    "days_billed": days_to_bill,
                    "pro_rata_rent": float(target_bill.base_rent),
                    "total_payable": float(target_bill.total_payable),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Case 3: All pending bills are PAID (APPROVED / PAID_CASH)! Proceed with Move-Out Request
        mo = MoveOutRequest.objects.create(
            tenancy=active_tenancy,
            room=room,
            tenant=request.user,
            requested_date=requested_date,
            reason=reason,
            status='PENDING',
        )

        send_rooms_email(
            recipients=get_admin_emails(),
            subject=f"🚪 Move-Out Request Submitted (All Dues Paid) — Room {room.room_number} ({request.user.full_name})",
            message_body=(
                f"Namaste Admin,\n\n"
                f"Tenant {request.user.full_name} ({request.user.email}) has cleared their pending bills "
                f"and submitted an official Move-Out request:\n\n"
                f"• Tenant: {request.user.full_name}\n"
                f"• Phone: {getattr(request.user, 'phone_number', 'N/A')}\n"
                f"• Room: Room {room.room_number}\n"
                f"• Expected Move-Out Date: {requested_date}\n"
                f"• Current Room Meter Reading: {room.current_meter_reading} units\n"
                f"• Reason: {reason or 'Not specified'}\n\n"
                f"Open your SmartRent Admin Command Center to approve the move-out and vacate the room.\n\n"
                f"— SmartRent Automated Alert"
            ),
        )

        send_rooms_email(
            recipients=[request.user.email],
            subject=f"SmartRent — Move-Out Request Submitted (Room {room.room_number})",
            message_body=(
                f"Namaste {request.user.full_name},\n\n"
                f"Your move-out request for Room {room.room_number} (Planned Date: {requested_date}) "
                f"has been submitted to the Admin.\n\n"
                f"— SmartRent House Management"
            ),
        )

        return Response(
            {
                "message": "Move-out request submitted successfully! Admin has been notified.",
                "id": mo.id,
            },
            status=status.HTTP_201_CREATED,
        )


class PendingMoveOutListView(APIView):
    """Returns all pending move-out requests for Admin Command Center."""
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        sync_tenancy_billing_cycles()
        try:
            qs = MoveOutRequest.objects.filter(status='PENDING').select_related('room', 'tenant').order_by('-created_at')
            data = [
                {
                    "id": mo.id,
                    "room_id": mo.room.id,
                    "room_number": mo.room.room_number,
                    "tenant_id": mo.tenant.id,
                    "tenant_name": mo.tenant.full_name,
                    "tenant_email": mo.tenant.email,
                    "tenant_phone": getattr(mo.tenant, 'phone_number', ''),
                    "requested_date": str(mo.requested_date) if mo.requested_date else None,
                    "reason": mo.reason or "No reason specified",
                    "current_meter_reading": float(mo.room.current_meter_reading or 0),
                    "base_rent": float(mo.room.base_rent or 0),
                    "status": mo.status,
                    "status_display": mo.get_status_display(),
                    "created_at": mo.created_at.strftime("%b %d, %Y") if hasattr(mo, 'created_at') and mo.created_at else None,
                }
                for mo in qs
            ]
            return Response(data)
        except Exception:
            return Response([])


class ProcessMoveOutRequestView(APIView):
    """
    Allows Admin to approve (vacate room & close tenancy) or reject a move-out request.
    """
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, pk):
        mo = get_object_or_404(MoveOutRequest.objects.select_related('tenancy', 'room', 'tenant'), pk=pk)
        action = (request.data.get('action') or '').upper()
        remarks = (request.data.get('admin_remarks') or '').strip()

        if action == 'REJECT':
            mo.status = 'REJECTED'
            mo.resolved_at = timezone.now()
            mo.save(update_fields=['status', 'resolved_at'])

            send_rooms_email(
                recipients=[mo.tenant.email],
                subject=f"SmartRent Notice — Move-Out Request Update (Room {mo.room.room_number})",
                message_body=(
                    f"Namaste {mo.tenant.full_name},\n\n"
                    f"Your move-out request for Room {mo.room.room_number} (Requested Date: {mo.requested_date}) "
                    f"was not approved at this time.\n"
                    f"Admin Remarks: {remarks or 'Please contact Admin for settlement details.'}\n\n"
                    f"— SmartRent House Management"
                ),
            )

            return Response({"message": f"Move-out request for Room {mo.room.room_number} rejected and tenant notified."})

        if action == 'APPROVE':
            raw_meter = request.data.get('final_meter_reading')
            room = mo.room
            prev_meter = room.current_meter_reading
            final_meter = Decimal(str(raw_meter)) if raw_meter not in [None, ''] else prev_meter

            if final_meter < prev_meter:
                return Response(
                    {"error": f"Final meter reading ({final_meter}) cannot be less than current reading ({prev_meter})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Remove any stray unpaid bills so the vacated tenant has a clean slate
            MonthlyBill.objects.filter(
                Q(tenancy=mo.tenancy) | Q(tenant=mo.tenant, room=room),
                status__in=['UNPAID', 'REJECTED', 'PENDING_VERIFICATION'],
            ).delete()

            today = timezone.localdate()
            mo.tenancy.is_active = False
            mo.tenancy.move_out_date = today
            mo.tenancy.save(update_fields=['is_active', 'move_out_date'])

            room.is_occupied = False
            room.current_meter_reading = final_meter
            room.save(update_fields=['is_occupied', 'current_meter_reading', 'updated_at'])

            mo.final_meter_reading = final_meter
            mo.status = 'APPROVED'
            mo.resolved_at = timezone.now()
            mo.save(update_fields=['final_meter_reading', 'status', 'resolved_at'])

            send_rooms_email(
                recipients=[mo.tenant.email],
                subject=f"✅ Move-Out Approved — Room {room.room_number} Tenancy Closed",
                message_body=(
                    f"Namaste {mo.tenant.full_name},\n\n"
                    f"Your move-out request for Room {room.room_number} has been APPROVED by the Admin.\n\n"
                    f"• Room Vacated: Room {room.room_number}\n"
                    f"• Move-Out Date: {today}\n"
                    f"• Final Sub-Meter Reading Recorded: {final_meter} units\n"
                    f"• Admin Remarks: {remarks or 'All dues settled and keys returned.'}\n\n"
                    f"Thank you for staying with SmartRent!\n"
                    f"— SmartRent House Management"
                ),
            )

            return Response({
                "message": f"Move-out approved! Room {mo.room.room_number} is now vacant and tenant has been notified."
            })

        return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)


class HeroBannerListCreateView(generics.ListCreateAPIView):
    serializer_class = HeroBannerSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdminUserRole()]

    def get_queryset(self):
        if self.request.user.is_authenticated and (
            self.request.user.role == 'ADMIN' or self.request.user.is_superuser
        ):
            return HeroBanner.objects.all().order_by('-id')
        return HeroBanner.objects.filter(is_active=True).order_by('-id')

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        uploaded_files = request.FILES.getlist('images') or request.FILES.getlist('image')
        if not uploaded_files and 'image' in request.FILES:
            uploaded_files = [request.FILES['image']]

        if not uploaded_files:
            return Response(
                {"error": "Please select at least one banner image to upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = (request.data.get('title') or 'SmartRent Featured Suite').strip()
        subtitle = (request.data.get('subtitle') or 'Sub-metered Power & 24/7 Water Supply').strip()
        badge_text = (request.data.get('badge_text') or 'Physical Inspection Passed').strip()
        is_active_raw = request.data.get('is_active', True)
        is_active = str(is_active_raw).lower() not in ('false', '0', 'no')

        created_banners = []
        for idx, img_file in enumerate(uploaded_files):
            if hasattr(img_file, 'size') and img_file.size > MAX_BANNER_FILE_SIZE:
                return Response(
                    {"error": f"Image '{img_file.name}' exceeds the 5 MB size limit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ext = os.path.splitext(img_file.name)[1].lower()
            content_type = (getattr(img_file, 'content_type', '') or '').lower()
            if ext not in ALLOWED_BANNER_EXTENSIONS and not content_type.startswith('image/'):
                return Response(
                    {"error": f"File '{img_file.name}' is not a supported image format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            slide_title = title if len(uploaded_files) == 1 else f"{title} ({idx + 1})"
            banner_obj = HeroBanner.objects.create(
                title=slide_title,
                subtitle=subtitle,
                badge_text=badge_text,
                image=img_file,
                is_active=is_active,
            )
            created_banners.append(banner_obj)

        serialized = HeroBannerSerializer(
            created_banners, many=True, context={'request': request}
        ).data

        for idx, b_obj in enumerate(created_banners):
            if b_obj.image and idx < len(serialized):
                try:
                    serialized[idx]['image_url'] = build_https_safe_uri(request, b_obj.image.url)
                    serialized[idx]['image_path'] = b_obj.image.url
                except Exception:
                    pass

        return Response(
            {
                "message": f"Successfully uploaded {len(created_banners)} hero banner slide(s)!",
                "banners": serialized,
            },
            status=status.HTTP_201_CREATED,
        )


class HeroBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = HeroBannerSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = HeroBanner.objects.all()


class HouseRuleListCreateView(generics.ListCreateAPIView):
    serializer_class = HouseRuleSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdminUserRole()]

    def get_queryset(self):
        return HouseRule.objects.filter(is_active=True)


class HouseRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = HouseRuleSerializer
    queryset = HouseRule.objects.all()