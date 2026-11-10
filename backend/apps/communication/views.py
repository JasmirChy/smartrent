from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.models import User
from apps.rooms.models import Tenancy, RoomReservation
from apps.rooms.views import IsAdminUserRole
from .models import ComplaintTicket, ChatMessage, Notice
from .serializers import ComplaintTicketSerializer, ChatMessageSerializer, NoticeSerializer


class ComplaintTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplaintTicketSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = ComplaintTicket.objects.select_related('tenant', 'room').all()
        if getattr(user, 'role', '') == 'ADMIN':
            return qs
        return qs.filter(tenant=user)

    def perform_create(self, serializer):
        user = self.request.user
        active_tenancy = user.tenancies.filter(is_active=True).select_related('room').first()
        room = active_tenancy.room if active_tenancy else None
        serializer.save(tenant=user, room=room)


class ComplaintTicketUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        ticket = get_object_or_404(ComplaintTicket, pk=pk)
        if getattr(request.user, 'role', '') != 'ADMIN':
            return Response(
                {"error": "Only Admin can update ticket status."},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_status = request.data.get('status', ticket.status)
        admin_response = request.data.get('admin_response', ticket.admin_response)
        priority = request.data.get('priority', ticket.priority)

        ticket.status = new_status
        ticket.admin_response = admin_response
        ticket.priority = priority
        if new_status == 'RESOLVED' and not ticket.resolved_at:
            ticket.resolved_at = timezone.now()
        ticket.save()

        return Response(
            ComplaintTicketSerializer(ticket, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


class NoticeListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = NoticeSerializer

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'role', '') == 'ADMIN':
            return Notice.objects.all().order_by('-created_at')
        return Notice.objects.filter(is_active=True).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated or getattr(request.user, 'role', '') != 'ADMIN':
            return Response({"error": "Only Admin can publish notices."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notice = serializer.save(posted_by=request.user, is_active=True)

        active_tenant_emails = list(
            Tenancy.objects.filter(is_active=True)
            .select_related('tenant')
            .values_list('tenant__email', flat=True)
        )
        reserved_tenant_emails = list(
            RoomReservation.objects.filter(status__in=['PENDING', 'APPROVED'])
            .select_related('user')
            .values_list('user__email', flat=True)
        )
        all_tenant_emails = list(
            User.objects.filter(role='TENANT', is_active=True).values_list('email', flat=True)
        )

        recipient_set = {
            email.strip()
            for email in (active_tenant_emails + reserved_tenant_emails + all_tenant_emails)
            if email and email.strip()
        }

        emailed_count = 0
        if recipient_set:
            subject = f"SmartRent Notice [{notice.get_category_display()}]: {notice.title}"
            message = (
                f"Namaste,\n\n"
                f"A new official house announcement has been published on SmartRent:\n\n"
                f"Title: {notice.title}\n"
                f"Category: {notice.get_category_display()}\n"
                f"----------------------------------------\n"
                f"{notice.content}\n"
                f"----------------------------------------\n\n"
                f"Log in to your SmartRent Tenant Dashboard to view all house updates.\n\n"
                f"— SmartRent House Management"
            )
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=list(recipient_set),
                    fail_silently=True,
                )
                emailed_count = len(recipient_set)
            except Exception:
                pass

        data = NoticeSerializer(notice, context={'request': request}).data
        data['emailed_count'] = emailed_count
        return Response(data, status=status.HTTP_201_CREATED)


class NoticeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = NoticeSerializer
    queryset = Notice.objects.all()


class ChatContactsView(APIView):
    """
    STRICT ROLE SEPARATION:
    - If user.role == 'ADMIN': Returns only TENANT users so Admin can message any tenant.
    - If user.role != 'ADMIN' (Tenant): Returns ONLY the Landlord Admin (role='ADMIN').
      No other tenants will ever be returned to a tenant!
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Check strictly user.role == 'ADMIN' (matches frontend isAdmin)
        if getattr(user, 'role', '') == 'ADMIN':
            contacts = (
                User.objects.filter(role='TENANT')
                .exclude(id=user.id)
                .prefetch_related('tenancies__room')
            )
        else:
            # Tenant ONLY gets the Landlord / Admin card(s) where role == 'ADMIN'
            contacts = User.objects.filter(role='ADMIN').exclude(id=user.id)

        contact_list = []
        for c in contacts:
            if c.role == 'ADMIN':
                room_badge = "Landlord / Admin"
            else:
                active_tenancy = c.tenancies.filter(is_active=True).select_related('room').first()
                room_badge = f"Room {active_tenancy.room.room_number}" if active_tenancy else "Unassigned"

            last_msg = ChatMessage.objects.filter(
                Q(sender=user, receiver=c) | Q(sender=c, receiver=user)
            ).order_by('-created_at').first()

            unread_count = ChatMessage.objects.filter(
                sender=c, receiver=user, is_read=False
            ).count()

            profile_pic_url = (
                request.build_absolute_uri(c.profile_picture.url)
                if c.profile_picture
                else None
            )

            contact_list.append({
                "id": c.id,
                "full_name": c.full_name or "Landlord Admin",
                "email": c.email,
                "phone_number": c.phone_number,
                "role": c.role,
                "room_badge": room_badge,
                "profile_picture_url": profile_pic_url,
                "last_message": last_msg.message if last_msg else "Start a conversation",
                "last_message_time": last_msg.created_at if last_msg else None,
                "unread_count": unread_count,
            })

        return Response(contact_list)


class ChatConversationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)

        # Tenants can ONLY view conversation with an ADMIN
        if getattr(request.user, 'role', '') != 'ADMIN' and getattr(other_user, 'role', '') != 'ADMIN':
            return Response(
                {"error": "Tenants can only chat with the Landlord Admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ChatMessage.objects.filter(
            sender=other_user, receiver=request.user, is_read=False
        ).update(is_read=True)

        messages = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=other_user)
            | Q(sender=other_user, receiver=request.user)
        ).select_related('sender', 'receiver').order_by('created_at')

        return Response(
            ChatMessageSerializer(messages, many=True, context={'request': request}).data
        )

    def post(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)

        # Tenants can ONLY send messages to an ADMIN
        if getattr(request.user, 'role', '') != 'ADMIN' and getattr(other_user, 'role', '') != 'ADMIN':
            return Response(
                {"error": "Tenants can only chat with the Landlord Admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        message_text = request.data.get('message', '').strip()
        attachment = request.FILES.get('attachment')

        if not message_text and not attachment:
            return Response(
                {"error": "Message text or image attachment is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = ChatMessage.objects.create(
            sender=request.user,
            receiver=other_user,
            message=message_text,
            attachment=attachment,
        )

        return Response(
            ChatMessageSerializer(msg, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class DeleteConversationView(APIView):
    """Allows Admin to delete the entire message history with a specific contact."""
    permission_classes = [IsAdminUserRole]

    def delete(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)
        deleted_count, _ = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=other_user) | Q(sender=other_user, receiver=request.user)
        ).delete()

        return Response({
            "message": f"Successfully deleted {deleted_count} messages in conversation with {other_user.full_name}."
        }, status=status.HTTP_200_OK)