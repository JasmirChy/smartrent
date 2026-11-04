from django.urls import path
from .views import (
    ComplaintTicketListCreateView,
    ComplaintTicketUpdateView,
    ChatContactsView,
    ChatConversationView,
)

urlpatterns = [
    path('complaints/', ComplaintTicketListCreateView.as_view(), name='complaints_list_create'),
    path('complaints/<int:pk>/', ComplaintTicketUpdateView.as_view(), name='complaint_update'),
    path('contacts/', ChatContactsView.as_view(), name='chat_contacts'),
    path('messages/<int:other_user_id>/', ChatConversationView.as_view(), name='chat_conversation'),
]