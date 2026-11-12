import os
import calendar
from datetime import date, datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
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


class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or request.user.is_superuser or request.user.is_staff)
        )


def add_one_month(orig_date):
    """Calculates exactly 1 month ahead from the tenant's entry_date."""
    year = orig_date.year
    month = orig_date.month + 1
    if month > 12:
        month = 1
        year += 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(orig_date.day, max_day))


class PublicLandingDataView(APIView):
    """
    Single fast endpoint for the Homepage (/api/rooms/landing/):
    Returns Hero Images, Rooms (A1-A4, B1-B5), House Rules, AND Active Notices!
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Auto-heal any legacy 'SECOND' floor values to 'FIRST' so B1-B5 always appear
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
        # Ensure every banner has both absolute image_url and relative image_path for mobile safety
        for idx, b_obj in enumerate(banners):
            if b_obj.image and idx < len(banners_data):
                try:
                    banners_data[idx]['image_url'] = request.build_absolute_uri(b_obj.image.url)
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


# Alias so whether urls.py imports PublicLandingView or PublicLandingDataView, both work identically
PublicLandingView = PublicLandingDataView


class RoomListUpdateView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RoomSerializer
    queryset = Room.objects.all().prefetch_related('tenancies__tenant', 'reservations')


class AdminRoomDetailUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = RoomSerializer
    queryset = Room.objects.all()


class AdminAssignTenantToRoomView(APIView):
    """
    Assigns a user to a room (e.g. A3), sets the initial meter reading & entry_date,
    marks the room as occupied, and generates their first MonthlyBill cycle.
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

        # Deactivate any existing active tenancy for this room or tenant
        Tenancy.objects.filter(room=room, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate()
        )
        Tenancy.objects.filter(tenant=tenant, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate()
        )

        # Create the new active Tenancy
        tenancy = Tenancy.objects.create(
            room=room,
            tenant=tenant,
            entry_date=entry_date,
            starting_meter_reading=starting_meter,
            is_active=True,
        )

        # Update Room status & initial meter reading
        room.is_occupied = True
        room.current_meter_reading = starting_meter
        room.save(update_fields=['is_occupied', 'current_meter_reading', 'updated_at'])

        # Ensure user role is TENANT (unless Admin)
        if getattr(tenant, 'role', '') not in ['ADMIN', 'TENANT']:
            tenant.role = 'TENANT'
            tenant.save(update_fields=['role'])

        # Automatically initialize the first MonthlyBill cycle (entry_date -> +1 month)
        first_due_date = add_one_month(entry_date)
        month_label = first_due_date.strftime("%B %Y")

        MonthlyBill.objects.create(
            tenancy=tenancy,
            room=room,
            tenant=tenant,
            billing_month_label=month_label,
            cycle_start_date=entry_date,
            cycle_end_date=first_due_date,
            due_date=first_due_date,
            base_rent=room.base_rent,
            water_bill=room.fixed_water_bill,
            electricity_rate=room.electricity_rate_per_unit,
            previous_meter_reading=starting_meter,
            status='UNPAID',
        )

        # Reject any pending reservation requests for this newly occupied room
        RoomReservation.objects.filter(room=room, status='PENDING').update(
            status='REJECTED',
            admin_remarks='Room has been occupied.'
        )

        return Response(
            {
                "message": f"{tenant.full_name} assigned to Room {room.room_number} successfully!",
                "room": RoomSerializer(room, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminVacateRoomView(APIView):
    """Marks a room as available/vacant and closes the active tenancy."""
    permission_classes = [IsAdminUserRole]

    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        Tenancy.objects.filter(room=room, is_active=True).update(
            is_active=False,
            move_out_date=timezone.localdate(),
        )
        room.is_occupied = False
        room.save(update_fields=['is_occupied', 'updated_at'])

        return Response(
            {
                "message": f"Room {room.room_number} is now marked as Available.",
                "room": RoomSerializer(room, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class RoomReservationListCreateView(generics.ListCreateAPIView):
    """
    GET: Returns all reservations for Admin, or only the logged-in user's reservations for Tenants.
    POST: Allows any authenticated user to submit a room reservation / visit request.
    """
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
        serializer.save(user=user, phone_number=phone)


class RoomReservationActionView(APIView):
    """
    POST /api/rooms/reservations/<pk>/action/
    """
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

        # 1. User or Admin cancelling a PENDING reservation
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

        # 2. Admin-only actions: APPROVE or REJECT
        if not is_admin:
            return Response({"detail": "Only Admin can approve or reject reservations."}, status=status.HTTP_403_FORBIDDEN)

        remarks = request.data.get('admin_remarks', '')

        if action == 'REJECT':
            reservation.status = 'REJECTED'
            reservation.admin_remarks = remarks
            reservation.save(update_fields=['status', 'admin_remarks', 'updated_at'])
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

            first_due_date = add_one_month(entry_date)
            month_label = first_due_date.strftime("%B %Y")

            MonthlyBill.objects.create(
                tenancy=tenancy,
                room=room,
                tenant=tenant,
                billing_month_label=month_label,
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

            return Response({
                "message": f"Reservation approved! {tenant.full_name or tenant.email} is now assigned to Room {room.room_number} & initial bill cycle created.",
                "reservation": RoomReservationSerializer(reservation, context={'request': request}).data,
                "room": RoomSerializer(room, context={'request': request}).data,
            })

        return Response({"detail": "Invalid action. Use APPROVE, REJECT, or CANCEL."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================================
# ITEM B: MOVE-OUT & DEPOSIT SETTLEMENT VIEWS
# ============================================================================

class MoveOutStatusView(APIView):
    """Returns whether the logged-in tenant has an active move-out request."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            req = MoveOutRequest.objects.filter(tenant=request.user).order_by('-created_at').first()
            if not req or req.status == 'REJECTED':
                return Response({"has_active_request": False, "request": None})
            return Response({
                "has_active_request": True,
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
    """Allows an active tenant to submit a move-out settlement request."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        active_tenancy = Tenancy.objects.filter(tenant=request.user, is_active=True).select_related('room').first()
        if not active_tenancy:
            return Response({"error": "You do not have an active room tenancy to vacate."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            existing = MoveOutRequest.objects.filter(tenancy=active_tenancy, status='PENDING').first()
            if existing:
                return Response({"error": "You already have a pending move-out request."}, status=status.HTTP_400_BAD_REQUEST)

            requested_date = request.data.get('requested_date') or timezone.localdate()
            reason = request.data.get('reason', '')

            mo = MoveOutRequest.objects.create(
                tenancy=active_tenancy,
                room=active_tenancy.room,
                tenant=request.user,
                requested_date=requested_date,
                reason=reason,
                status='PENDING',
            )

            return Response({
                "message": "Move-out request submitted successfully!",
                "id": mo.id,
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Could not create move-out request: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class PendingMoveOutListView(APIView):
    """Returns all pending move-out requests for Admin Command Center."""
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        try:
            qs = MoveOutRequest.objects.filter(status='PENDING').select_related('room', 'tenant')
            data = [
                {
                    "id": mo.id,
                    "room_number": mo.room.room_number,
                    "tenant_name": mo.tenant.full_name,
                    "tenant_email": mo.tenant.email,
                    "requested_date": mo.requested_date,
                    "reason": mo.reason,
                    "status": mo.status,
                    "status_display": mo.get_status_display(),
                }
                for mo in qs
            ]
            return Response(data)
        except Exception:
            return Response([])


class ProcessMoveOutRequestView(APIView):
    """Allows Admin to approve (generate final settlement bill & vacate room) or reject a move-out request."""
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def post(self, request, pk):
        mo = get_object_or_404(MoveOutRequest.objects.select_related('tenancy', 'room', 'tenant'), pk=pk)
        action = (request.data.get('action') or '').upper()

        if action == 'REJECT':
            mo.status = 'REJECTED'
            mo.resolved_at = timezone.now()
            mo.save(update_fields=['status', 'resolved_at'])
            return Response({"message": f"Move-out request for Room {mo.room.room_number} rejected."})

        if action == 'APPROVE':
            raw_meter = request.data.get('final_meter_reading')
            room = mo.room
            final_meter = Decimal(str(raw_meter)) if raw_meter not in [None, ''] else room.current_meter_reading

            if final_meter < room.current_meter_reading:
                return Response(
                    {"detail": f"Final meter reading ({final_meter}) cannot be less than current reading ({room.current_meter_reading})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            today = timezone.localdate()
            MonthlyBill.objects.create(
                tenancy=mo.tenancy,
                room=room,
                tenant=mo.tenant,
                billing_month_label=f"Final Move-Out Settlement ({today.strftime('%b %Y')})",
                cycle_start_date=mo.tenancy.entry_date,
                cycle_end_date=today,
                due_date=today,
                base_rent=room.base_rent,
                water_bill=room.fixed_water_bill,
                electricity_rate=room.electricity_rate_per_unit,
                previous_meter_reading=room.current_meter_reading,
                current_meter_reading=final_meter,
                status='UNPAID',
                admin_remarks='Final move-out settlement invoice.',
            )

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

            return Response({
                "message": f"Move-out approved! Final bill generated and Room {mo.room.room_number} is now vacant."
            })

        return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)


class HeroBannerListCreateView(generics.ListCreateAPIView):
    """
    Admin can upload single OR multiple homepage hero viewer images at once (up to 5 MB each, any image format).
    Anyone can view active hero banners in the landing page slideshow.
    """
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
        # Support both multiple files ('images' or 'image') and single file ('image')
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

        return Response(
            {
                "message": f"Successfully uploaded {len(created_banners)} hero banner slide(s)!",
                "banners": serialized,
            },
            status=status.HTTP_201_CREATED,
        )


class HeroBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin can update or delete homepage hero viewer images."""
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