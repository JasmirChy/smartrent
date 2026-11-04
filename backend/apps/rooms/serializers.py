from rest_framework import serializers
from .models import Room, Tenancy, HeroBanner, HouseRule


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
        ]

    def get_active_tenancy(self, obj):
        tenancy = obj.tenancies.filter(is_active=True).select_related('tenant').first()
        if tenancy:
            return ActiveTenantBriefSerializer(tenancy).data
        return None


class AssignTenantSerializer(serializers.Serializer):
    tenant_id = serializers.IntegerField()
    entry_date = serializers.DateField()
    starting_meter_reading = serializers.DecimalField(max_digits=10, decimal_places=2)