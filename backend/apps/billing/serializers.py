from decimal import Decimal
from rest_framework import serializers
from .models import MonthlyBill, HouseExpense


class MonthlyBillSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    floor_display = serializers.CharField(source='room.get_floor_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.full_name', read_only=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    tenant_phone = serializers.CharField(source='tenant.phone_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    meter_photo_url = serializers.SerializerMethodField()
    payment_screenshot_url = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyBill
        fields = [
            'id',
            'tenancy',
            'room',
            'room_number',
            'floor_display',
            'tenant',
            'tenant_name',
            'tenant_email',
            'tenant_phone',
            'billing_month_label',
            'cycle_start_date',
            'cycle_end_date',
            'due_date',
            'base_rent',
            'water_bill',
            'electricity_rate',
            'previous_meter_reading',
            'current_meter_reading',
            'units_consumed',
            'electricity_amount',
            'damage_fine_amount',
            'damage_fine_reason',
            'total_payable',
            'meter_photo_proof',
            'meter_photo_url',
            'payment_screenshot_proof',
            'payment_screenshot_url',
            'transaction_reference',
            'payment_method',
            'status',
            'status_display',
            'admin_remarks',
            'reminder_email_sent',
            'paid_at',
            'created_at',
        ]
        read_only_fields = [
            'units_consumed',
            'electricity_amount',
            'total_payable',
            'paid_at',
            'created_at',
        ]

    def get_meter_photo_url(self, obj):
        if obj.meter_photo_proof:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.meter_photo_proof.url)
            return obj.meter_photo_proof.url
        return None

    def get_payment_screenshot_url(self, obj):
        if obj.payment_screenshot_proof:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.payment_screenshot_proof.url)
            return obj.payment_screenshot_proof.url
        return None


class TenantOnlineBillSubmitSerializer(serializers.Serializer):
    current_meter_reading = serializers.DecimalField(max_digits=10, decimal_places=2)
    meter_photo_proof = serializers.ImageField(required=True)
    payment_screenshot_proof = serializers.ImageField(required=True)
    transaction_reference = serializers.CharField(max_length=100, required=False, allow_blank=True)


class AdminBillAuditSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['APPROVE', 'REJECT'])
    admin_remarks = serializers.CharField(required=False, allow_blank=True)


class AdminCashOverrideSerializer(serializers.Serializer):
    bill_id = serializers.IntegerField()
    current_meter_reading = serializers.DecimalField(max_digits=10, decimal_places=2)
    damage_fine_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=Decimal('0.00')
    )
    damage_fine_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    admin_remarks = serializers.CharField(required=False, allow_blank=True)
    meter_photo_proof = serializers.ImageField(required=False, allow_null=True)


class AdminApplyFineSerializer(serializers.Serializer):
    damage_fine_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    damage_fine_reason = serializers.CharField(max_length=255)


class HouseExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    receipt_image_url = serializers.SerializerMethodField()

    class Meta:
        model = HouseExpense
        fields = [
            'id',
            'category',
            'category_display',
            'title',
            'amount',
            'expense_date',
            'receipt_image',
            'receipt_image_url',
            'notes',
            'recorded_by',
            'created_at',
        ]
        read_only_fields = ['id', 'recorded_by', 'created_at']

    def get_receipt_image_url(self, obj):
        if obj.receipt_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.receipt_image.url)
            return obj.receipt_image.url
        return None