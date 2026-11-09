from rest_framework import serializers
from .models import Room, Tenancy, HeroBanner, HouseRule, RoomReservation


class HeroBannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = HeroBanner
        fields = [
            'id',
            'title',
            'subtitle',
            'badge_text',
            'image',
            'image_url',
            'is_active',
            'display_order',
            'created_at',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class HouseRuleSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = HouseRule
        fields = [
            'id',
            'category',
            'category_display',
            'title',
            'description',
            'fine_amount',
            'display_order',
            'is_active',
        ]


class ActiveTenantBriefSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(source='tenant.id', read_only=True)
    full_name = serializers.CharField(source='tenant.full_name', read_only=True)
    email = serializers.EmailField(source='tenant.email', read_only=True)
    phone_number = serializers.CharField(source='tenant.phone_number', read_only=True)
    next_due_date = serializers.SerializerMethodField()

    class Meta:
        model = Tenancy
        fields = [
            'id',
            'tenant_id',
            'full_name',
            'email',
            'phone_number',
            'entry_date',
            'starting_meter_reading',
            'next_due_date',
        ]

    def get_next_due_date(self, obj):
        return obj.get_next_due_date()


class RoomSerializer(serializers.ModelSerializer):
    floor_display = serializers.CharField(source='get_floor_display', read_only=True)
    active_tenancy = serializers.SerializerMethodField()
    pending_reservations_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id',
            'room_number',
            'floor',
            'floor_display',
            'room_type',
            'title',
            'area_sqft',
            'features',
            'base_rent',
            'fixed_water_bill',
            'electricity_rate_per_unit',
            'current_meter_reading',
            'is_occupied',
            'active_tenancy',
            'pending_reservations_count',
        ]

    def get_active_tenancy(self, obj):
        tenancy = obj.tenancies.filter(is_active=True).select_related('tenant').first()
        if tenancy:
            return ActiveTenantBriefSerializer(tenancy).data
        return None

    def get_pending_reservations_count(self, obj):
        return obj.reservations.filter(status='PENDING').count()


class AssignTenantSerializer(serializers.Serializer):
    tenant_id = serializers.IntegerField()
    entry_date = serializers.DateField()
    starting_meter_reading = serializers.DecimalField(max_digits=10, decimal_places=2)


class RoomReservationSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    room_title = serializers.CharField(source='room.title', read_only=True)
    room_floor_display = serializers.CharField(source='room.get_floor_display', read_only=True)
    base_rent = serializers.DecimalField(source='room.base_rent', max_digits=10, decimal_places=2, read_only=True)
    current_meter_reading = serializers.DecimalField(source='room.current_meter_reading', max_digits=10, decimal_places=2, read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_screenshot_url = serializers.SerializerMethodField()
    citizenship_document_url = serializers.SerializerMethodField()

    class Meta:
        model = RoomReservation
        fields = [
            'id',
            'room',
            'room_number',
            'room_title',
            'room_floor_display',
            'base_rent',
            'current_meter_reading',
            'user',
            'user_email',
            'user_full_name',
            'request_type',
            'request_type_display',
            'expected_move_in_date',
            'occupants_count',
            'phone_number',
            'occupation',
            'message',
            'token_amount',
            'payment_screenshot',
            'payment_screenshot_url',
            'citizenship_document',
            'citizenship_document_url',
            'status',
            'status_display',
            'admin_remarks',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'status', 'admin_remarks', 'created_at', 'updated_at']

    def get_user_full_name(self, obj):
        return getattr(obj.user, 'full_name', '') or obj.user.username or obj.user.email

    def get_payment_screenshot_url(self, obj):
        if obj.payment_screenshot:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.payment_screenshot.url)
            return obj.payment_screenshot.url
        return None

    def get_citizenship_document_url(self, obj):
        if obj.citizenship_document:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.citizenship_document.url)
            return obj.citizenship_document.url
        return None

    def validate(self, attrs):
        room = attrs.get('room')
        if room and room.is_occupied:
            raise serializers.ValidationError({"room": f"Room {room.room_number} is already occupied."})
        return attrs