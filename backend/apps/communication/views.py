import json
import threading
import urllib.request
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


def build_https_safe_uri(request, relative_url):
    """
    Builds an absolute URI and automatically upgrades http:// to https://
    on production hosts (Render / Vercel) so browsers never block images.
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


def get_admin_emails():
    """Returns all active Admin email addresses to receive support & ticket alerts."""
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


def _send_email_worker(recipient_list, subject, message_body):
    """
    Background worker:
    1) Tries Google Apps Script HTTPS Webhook FIRST (Port 443 — instant on Render Free Tier)
    2) Falls back to Django SMTP with a short timeout
    """
    valid_recipients = [r.strip() for r in recipient_list if r and '@' in str(r)]
    if not valid_recipients:
        return False

    webhook_url = getattr(settings, 'GOOGLE_SCRIPT_WEBHOOK_URL', '').strip()
    webhook_secret = getattr(settings, 'GOOGLE_SCRIPT_SECRET', 'SMARTRENT_SECRET_2026').strip()

    for recipient_email in valid_recipients:
        sent_via_webhook = False
        if webhook_url:
            try:
                payload = json.dumps({
                    "secret": webhook_secret,
                    "to": recipient_email,
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
                print(f"[SmartRent Communication Webhook Notice]: {wh_err}")

        if not sent_via_webhook and getattr(settings, 'EMAIL_HOST_USER', '') and getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
            try:
                send_mail(
                    subject=subject,
                    message=message_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False,
                )
            except Exception as smtp_err:
                print(f"[SmartRent Communication SMTP Notice]: {smtp_err}")

    return True


def send_communication_email(recipients, subject, message_body):
    """Dispatches emails asynchronously in a background thread so API responses return in <100ms."""
    if not recipients:
        return False
    if isinstance(recipients, str):
        recipient_list = [recipients]
    else:
        recipient_list = list(recipients)
    if not recipient_list:
        return False
    threading.Thread(
        target=_send_email_worker,
        args=(recipient_list, subject, message_body),
        daemon=True,
    ).start()
    return True


def enrich_ticket_dict(request, ticket_dict):
    """Ensures attachment_url on serialized complaint tickets uses HTTPS in production."""
    if ticket_dict.get('attachment_url'):
        ticket_dict['attachment_url'] = build_https_safe_uri(request, ticket_dict['attachment_url'])
    return ticket_dict


def enrich_chat_message_dict(request, msg_dict):
    """Ensures attachment_url on serialized chat messages uses HTTPS in production."""
    if msg_dict.get('attachment_url'):
        msg_dict['attachment_url'] = build_https_safe_uri(request, msg_dict['attachment_url'])
    return msg_dict


class ComplaintTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplaintTicketSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = ComplaintTicket.objects.select_related('tenant', 'room').all().order_by('-created_at')
        if getattr(user, 'role', '') == 'ADMIN' or user.is_superuser:
            return qs
        return qs.filter(tenant=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        data = [enrich_ticket_dict(request, dict(item)) for item in serializer.data]
        return Response(data)

    def perform_create(self, serializer):
        user = self.request.user
        active_tenancy = user.tenancies.filter(is_active=True).select_related('room').first()
        room = active_tenancy.room if active_tenancy else None
        ticket = serializer.save(tenant=user, room=room)

        room_label = f"Room {room.room_number}" if room else "Unassigned Unit"
        proof_url = (
            build_https_safe_uri(self.request, ticket.attachment.url)
            if getattr(ticket, 'attachment', None)
            else "No photo attached"
        )

        # 1. Notify All Admins of New Maintenance Ticket
        send_communication_email(
            recipients=get_admin_emails(),
            subject=f"🔧 New Maintenance Ticket #{ticket.id} — {room_label} ({user.full_name})",
            message_body=(
                f"Namaste Admin,\n\n"
                f"A new maintenance / support ticket has been reported by {user.full_name} ({user.email}):\n\n"
                f"• Ticket ID: #{ticket.id}\n"
                f"• Room: {room_label}\n"
                f"• Urgency / Priority: {ticket.get_priority_display()}\n"
                f"• Subject: {ticket.title}\n"
                f"• Description: {ticket.description}\n"
                f"• Photo Proof: {proof_url}\n\n"
                f"Open your SmartRent Support & Real-Time Hub to reply or mark this ticket as Resolved.\n"
                f"— SmartRent Automated Alert"
            ),
        )

        # 2. Send Confirmation Email to Tenant
        if user.email:
            send_communication_email(
                recipients=[user.email],
                subject=f"SmartRent — Maintenance Ticket #{ticket.id} Received ({ticket.title})",
                message_body=(
                    f"Namaste {user.full_name},\n\n"
                    f"We have received your maintenance report for {room_label}:\n"
                    f"• Ticket #{ticket.id}: {ticket.title}\n"
                    f"• Priority: {ticket.get_priority_display()}\n"
                    f"• Details: {ticket.description}\n\n"
                    f"The Landlord Admin has been notified and will respond shortly.\n\n"
                    f"— SmartRent House Management"
                ),
            )


class ComplaintTicketUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        ticket = get_object_or_404(
            ComplaintTicket.objects.select_related('tenant', 'room'),
            pk=pk,
        )
        if getattr(request.user, 'role', '') != 'ADMIN' and not request.user.is_superuser:
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

        if ticket.tenant and ticket.tenant.email:
            room_label = f"Room {ticket.room.room_number}" if ticket.room else "Your Account"
            status_emoji = "✅" if new_status == 'RESOLVED' else "🛠️"
            send_communication_email(
                recipients=[ticket.tenant.email],
                subject=f"{status_emoji} SmartRent Ticket #{ticket.id} Update — {ticket.get_status_display()}",
                message_body=(
                    f"Namaste {ticket.tenant.full_name},\n\n"
                    f"Your maintenance ticket #{ticket.id} ({ticket.title} — {room_label}) has been updated by the Landlord Admin:\n\n"
                    f"• Current Status: {ticket.get_status_display()}\n"
                    f"• Official Landlord Response: {ticket.admin_response or 'Issue reviewed by Admin.'}\n\n"
                    f"You can view full details anytime in your SmartRent Support & Real-Time Hub.\n\n"
                    f"— SmartRent House Management"
                ),
            )

        serialized = enrich_ticket_dict(
            request,
            dict(ComplaintTicketSerializer(ticket, context={'request': request}).data),
        )
        return Response(serialized, status=status.HTTP_200_OK)


class NoticeListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = NoticeSerializer

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and (getattr(user, 'role', '') == 'ADMIN' or user.is_superuser):
            return Notice.objects.all().order_by('-created_at')
        return Notice.objects.filter(is_active=True).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated or (
            getattr(request.user, 'role', '') != 'ADMIN' and not request.user.is_superuser
        ):
            return Response(
                {"error": "Only Admin can publish notices."},
                status=status.HTTP_403_FORBIDDEN,
            )

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
            if email and '@' in email.strip()
        }

        emailed_count = len(recipient_set)
        if recipient_set:
            subject = f"📢 SmartRent Notice [{notice.get_category_display()}]: {notice.title}"
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
            send_communication_email(list(recipient_set), subject, message)

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

        if getattr(user, 'role', '') == 'ADMIN' or user.is_superuser:
            contacts = (
                User.objects.filter(role='TENANT')
                .exclude(id=user.id)
                .prefetch_related('tenancies__room')
            )
        else:
            contacts = User.objects.filter(
                Q(role='ADMIN') | Q(is_superuser=True)
            ).exclude(id=user.id)

        contact_list = []
        for c in contacts:
            if c.role == 'ADMIN' or c.is_superuser:
                room_badge = "Landlord / Admin"
            else:
                active_tenancy = c.tenancies.filter(is_active=True).select_related('room').first()
                room_badge = (
                    f"Room {active_tenancy.room.room_number}"
                    if active_tenancy and active_tenancy.room
                    else "Unassigned"
                )

            last_msg = ChatMessage.objects.filter(
                Q(sender=user, receiver=c) | Q(sender=c, receiver=user)
            ).order_by('-created_at').first()

            unread_count = ChatMessage.objects.filter(
                sender=c, receiver=user, is_read=False
            ).count()

            profile_pic_url = (
                build_https_safe_uri(request, c.profile_picture.url)
                if c.profile_picture
                else None
            )
            profile_pic_path = c.profile_picture.url if c.profile_picture else None

            if last_msg:
                last_msg_preview = (
                    last_msg.message.strip()
                    if last_msg.message and last_msg.message.strip()
                    else "📷 Photo attachment"
                )
            else:
                last_msg_preview = "Start a conversation"

            contact_list.append({
                "id": c.id,
                "full_name": c.full_name or "Landlord Admin",
                "email": c.email,
                "phone_number": c.phone_number,
                "role": "ADMIN" if (c.role == 'ADMIN' or c.is_superuser) else c.role,
                "room_badge": room_badge,
                "profile_picture_url": profile_pic_url,
                "profile_picture_path": profile_pic_path,
                "last_message": last_msg_preview,
                "last_message_time": last_msg.created_at if last_msg else None,
                "unread_count": unread_count,
            })

        return Response(contact_list)


class ChatConversationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)

        is_req_admin = getattr(request.user, 'role', '') == 'ADMIN' or request.user.is_superuser
        is_other_admin = getattr(other_user, 'role', '') == 'ADMIN' or other_user.is_superuser

        # Tenants can ONLY view conversation with an ADMIN
        if not is_req_admin and not is_other_admin:
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

        serialized = ChatMessageSerializer(
            messages, many=True, context={'request': request}
        ).data
        enriched = [enrich_chat_message_dict(request, dict(m)) for m in serialized]
        return Response(enriched)

    def post(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)

        is_req_admin = getattr(request.user, 'role', '') == 'ADMIN' or request.user.is_superuser
        is_other_admin = getattr(other_user, 'role', '') == 'ADMIN' or other_user.is_superuser

        # Tenants can ONLY send messages to an ADMIN
        if not is_req_admin and not is_other_admin:
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

        serialized = enrich_chat_message_dict(
            request,
            dict(ChatMessageSerializer(msg, context={'request': request}).data),
        )
        return Response(serialized, status=status.HTTP_201_CREATED)


class DeleteConversationView(APIView):
    """Allows Admin to delete the entire message history with a specific contact."""
    permission_classes = [IsAdminUserRole]

    def delete(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)
        deleted_count, _ = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=other_user)
            | Q(sender=other_user, receiver=request.user)
        ).delete()

        return Response(
            {
                "message": f"Successfully deleted {deleted_count} messages in conversation with {other_user.full_name}."
            },
            status=status.HTTP_200_OK,
        )