import calendar
from datetime import date
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.models import User
from apps.billing.models import MonthlyBill
from .models import Room, Tenancy, HeroBanner, HouseRule
from .serializers import (
    RoomSerializer,
    HeroBannerSerializer,
    HouseRuleSerializer,
    AssignTenantSerializer,
)


class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or request.user.is_superuser)
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
        rooms = Room.objects.all().prefetch_related('tenancies__tenant')
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
    queryset = Room.objects.all().prefetch_related('tenancies__tenant')


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