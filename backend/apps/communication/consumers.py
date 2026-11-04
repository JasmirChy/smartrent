import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.accounts.models import User
from .models import ChatMessage


class DirectChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_a = int(self.scope['url_route']['kwargs']['user_a'])
        self.user_b = int(self.scope['url_route']['kwargs']['user_b'])

        # Deterministic room group name for any pair of users (e.g. chat_1_4)
        low_id, high_id = sorted([self.user_a, self.user_b])
        self.room_group_name = f"smartrent_chat_{low_id}_{high_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        message_text = data.get('message', '').strip()

        if not sender_id or not receiver_id or not message_text:
            return

        saved_msg = await self.save_message(sender_id, receiver_id, message_text)
        if saved_msg:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_event',
                    'message_data': saved_msg,
                }
            )

    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps(event['message_data']))

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, message_text):
        sender = User.objects.filter(id=sender_id).first()
        receiver = User.objects.filter(id=receiver_id).first()
        if not sender or not receiver:
            return None

        msg = ChatMessage.objects.create(
            sender=sender,
            receiver=receiver,
            message=message_text,
        )
        return {
            'id': msg.id,
            'sender': sender.id,
            'sender_name': sender.full_name,
            'sender_role': sender.role,
            'receiver': receiver.id,
            'receiver_name': receiver.full_name,
            'message': msg.message,
            'attachment_url': None,
            'is_read': msg.is_read,
            'created_at': msg.created_at.isoformat(),
        }