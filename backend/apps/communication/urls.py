from django.urls import path
from .views import (
    ComplaintTicketListCreateView,
    ComplaintTicketUpdateView,
    NoticeListCreateView,
    NoticeDetailView,
    ChatContactsView,
    ChatConversationView,
    DeleteConversationView,
)

urlpatterns = [
    path('complaints/', ComplaintTicketListCreateView.as_view(), name='complaints_list_create'),
    path('complaints/<int:pk>/', ComplaintTicketUpdateView.as_view(), name='complaint_update'),
    path('notices/', NoticeListCreateView.as_view(), name='notices_list_create'),
    path('notices/<int:pk>/', NoticeDetailView.as_view(), name='notice_detail'),
    path('contacts/', ChatContactsView.as_view(), name='chat_contacts'),
    path('messages/<int:other_user_id>/', ChatConversationView.as_view(), name='chat_conversation'),
    path('messages/<int:other_user_id>/delete/', DeleteConversationView.as_view(), name='delete_conversation'),
]