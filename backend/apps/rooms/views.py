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

from apps.accounts.models import User
from apps.billing.models import MonthlyBill
from .models import Room, Tenancy, HeroBanner, HouseRule, RoomReservation
from .serializers import (
    RoomSerializer,
    HeroBannerSerializer,
    HouseRuleSerializer,
    AssignTenantSerializer,
    RoomReservationSerializer,
)


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
    """Single fast endpoint for the Homepage: Hero Images, Rooms (A1-A4, B1-B5), and House Rules."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        rooms = Room.objects.all().prefetch_related('tenancies__tenant', 'reservations')
        banners = HeroBanner.objects.filter(is_active=True)
        rules = HouseRule.objects.filter(is_active=True)

        total_rooms = rooms.count()
        occupied_rooms = rooms.filter(is_occupied=True).count()
        available_rooms = total_rooms - occupied_rooms

        return Response({
            "stats": {
                "total_rooms": total_rooms,
                "occupied_rooms": occupied_rooms,
                "available_rooms": available_rooms,
            },
            "banners": HeroBannerSerializer(banners, many=True, context={'request': request}).data,
            "rooms": RoomSerializer(rooms, many=True, context={'request': request}).data,
            "rules": HouseRuleSerializer(rules, many=True).data,
        })


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
    Body: {
        "action": "APPROVE" | "REJECT" | "CANCEL",
        "admin_remarks": "...",
        "starting_meter_reading": 120.5,
        "entry_date": "2026-11-10"
    }
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

            # Update user's phone number if provided during reservation
            if reservation.phone_number and not getattr(tenant, 'phone_number', ''):
                tenant.phone_number = reservation.phone_number
                tenant.save(update_fields=['phone_number'])

            # Deactivate any prior active tenancy for this room or tenant
            Tenancy.objects.filter(room=room, is_active=True).update(
                is_active=False,
                move_out_date=timezone.localdate()
            )
            Tenancy.objects.filter(tenant=tenant, is_active=True).update(
                is_active=False,
                move_out_date=timezone.localdate()
            )

            # Mark reservation approved
            reservation.status = 'APPROVED'
            reservation.admin_remarks = remarks
            reservation.save(update_fields=['status', 'admin_remarks', 'updated_at'])

            # Create active Tenancy
            tenancy = Tenancy.objects.create(
                room=room,
                tenant=tenant,
                entry_date=entry_date,
                starting_meter_reading=starting_meter,
                is_active=True,
            )

            # Mark room as occupied and sync meter reading
            room.is_occupied = True
            room.current_meter_reading = starting_meter
            room.save(update_fields=['is_occupied', 'current_meter_reading', 'updated_at'])

            # Ensure user role is TENANT (unless Admin)
            if getattr(tenant, 'role', '') not in ['ADMIN', 'TENANT']:
                tenant.role = 'TENANT'
                tenant.save(update_fields=['role'])

            # Initialize first MonthlyBill cycle (entry_date -> +1 month)
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

            # Auto-reject other pending reservations for this same room
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


class HeroBannerListCreateView(generics.ListCreateAPIView):
    """Admin can upload new homepage hero viewer images; anyone can view them."""
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
            return HeroBanner.objects.all()
        return HeroBanner.objects.filter(is_active=True)


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