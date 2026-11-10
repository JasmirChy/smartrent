from rest_framework import serializers
from .models import ComplaintTicket, ChatMessage, Notice


class ComplaintTicketSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.full_name', read_only=True)
    tenant_email = serializers.EmailField(source='tenant.email', read_only=True)
    room_number = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = ComplaintTicket
        fields = [
            'id', 'tenant', 'tenant_name', 'tenant_email', 'room', 'room_number',
            'title', 'description', 'attachment', 'attachment_url', 'priority',
            'priority_display', 'status', 'status_display', 'admin_response',
            'created_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'tenant', 'room', 'created_at', 'resolved_at']

    def get_room_number(self, obj):
        if obj.room:
            return obj.room.room_number
        active = obj.tenant.tenancies.filter(is_active=True).select_related('room').first()
        return active.room.room_number if active else 'Unassigned'

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    receiver_name = serializers.CharField(source='receiver.full_name', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'sender', 'sender_name', 'sender_role', 'receiver', 'receiver_name',
            'message', 'attachment', 'attachment_url', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'sender', 'is_read', 'created_at']

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class NoticeSerializer(serializers.ModelSerializer):
    posted_by_name = serializers.CharField(source='posted_by.full_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Notice
        fields = [
            'id', 'title', 'content', 'category', 'category_display',
            'posted_by', 'posted_by_name', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'posted_by', 'created_at']