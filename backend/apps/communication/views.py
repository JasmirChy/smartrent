from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.models import User
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
        if user.role == 'ADMIN' or user.is_superuser:
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
        if request.user.role != 'ADMIN' and not request.user.is_superuser:
            return Response({"error": "Only Admin can update ticket status."}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status', ticket.status)
        admin_response = request.data.get('admin_response', ticket.admin_response)
        priority = request.data.get('priority', ticket.priority)

        ticket.status = new_status
        ticket.admin_response = admin_response
        ticket.priority = priority
        if new_status == 'RESOLVED' and not ticket.resolved_at:
            ticket.resolved_at = timezone.now()
        ticket.save()

        return Response(ComplaintTicketSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


class NoticeListCreateView(generics.ListCreateAPIView):
    """Anyone authenticated can read active notices; only Admin can create them."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NoticeSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN' or user.is_superuser:
            return Notice.objects.all()
        return Notice.objects.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(posted_by=self.request.user)


class NoticeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = NoticeSerializer
    queryset = Notice.objects.all()


class ChatContactsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'ADMIN' or user.is_superuser:
            contacts = User.objects.exclude(id=user.id).prefetch_related('tenancies__room')
        else:
            contacts = User.objects.filter(Q(role='ADMIN') | Q(is_superuser=True))

        contact_list = []
        for c in contacts:
            active_tenancy = c.tenancies.filter(is_active=True).select_related('room').first()
            room_badge = (
                f"Room {active_tenancy.room.room_number}"
                if active_tenancy
                else ("Landlord / Admin" if c.role == 'ADMIN' else "Unassigned")
            )

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
                "full_name": c.full_name,
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
        ChatMessage.objects.filter(
            sender=other_user, receiver=request.user, is_read=False
        ).update(is_read=True)

        messages = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=other_user)
            | Q(sender=other_user, receiver=request.user)
        ).select_related('sender', 'receiver').order_by('created_at')

        return Response(ChatMessageSerializer(messages, many=True, context={'request': request}).data)

    def post(self, request, other_user_id):
        other_user = get_object_or_404(User, id=other_user_id)
        message_text = request.data.get('message', '').strip()
        attachment = request.FILES.get('attachment')

        if not message_text and not attachment:
            return Response({"error": "Message text or image attachment is required."}, status=status.HTTP_400_BAD_REQUEST)

        msg = ChatMessage.objects.create(
            sender=request.user,
            receiver=other_user,
            message=message_text,
            attachment=attachment,
        )

        return Response(ChatMessageSerializer(msg, context={'request': request}).data, status=status.HTTP_201_CREATED)