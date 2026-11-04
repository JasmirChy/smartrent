from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, EmailOTP


class UserProfileSerializer(serializers.ModelSerializer):
    assigned_room = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'phone_number',
            'role',
            'profile_picture',
            'profile_picture_url',
            'is_email_verified',
            'assigned_room',
            'created_at',
        ]
        read_only_fields = ['id', 'email', 'role', 'is_email_verified', 'created_at']

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_assigned_room(self, obj):
        active_tenancy = obj.tenancies.filter(is_active=True).select_related('room').first()
        if not active_tenancy:
            return None
        return {
            'tenancy_id': active_tenancy.id,
            'room_id': active_tenancy.room.id,
            'room_number': active_tenancy.room.room_number,
            'floor': active_tenancy.room.get_floor_display(),
            'room_type': active_tenancy.room.room_type,
            'base_rent': str(active_tenancy.room.base_rent),
            'fixed_water_bill': str(active_tenancy.room.fixed_water_bill),
            'electricity_rate_per_unit': str(active_tenancy.room.electricity_rate_per_unit),
            'current_meter_reading': str(active_tenancy.room.current_meter_reading),
            'entry_date': active_tenancy.entry_date,
            'next_due_date': active_tenancy.get_next_due_date(),
        }


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['email', 'full_name', 'phone_number', 'password', 'profile_picture']

    def validate_email(self, value):
        return value.lower().strip()

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,
            is_email_verified=False,
            **validated_data
        )
        return user


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)
    purpose = serializers.ChoiceField(
        choices=['SIGNUP', 'PASSWORD_RESET'],
        default='SIGNUP'
    )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password')

        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")

        attrs['user'] = user
        return attrs


class RequestPasswordOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmPasswordOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(write_only=True, min_length=6)