from django.urls import re_path
from .consumers import DirectChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<user_a>\d+)/(?P<user_b>\d+)/$', DirectChatConsumer.as_asgi()),
]