import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return None

@database_sync_to_async
def get_unread_counts(user):
    from api.models import Message, Notification
    unread_messages = Message.objects.filter(
        conversation__participants=user,
        is_read=False
    ).exclude(sender=user).count()

    unread_notifications = Notification.objects.filter(
        recipient=user,
        is_read=False
    ).count()

    return {
        "messages": unread_messages,
        "notifications": unread_notifications
    }

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # Extract token from query parameters
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token_list = query_params.get('token')

        if not token_list:
            await self.close(code=4003)
            return

        token_key = token_list[0]
        self.user = await get_user_from_token(token_key)

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4003)
            return

        self.group_name = f"user_{self.user.id}"

        # Join room group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

        # Send initial counts on connection
        counts = await get_unread_counts(self.user)
        await self.send_json({
            "type": "counts",
            "messages": counts["messages"],
            "notifications": counts["notifications"]
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            # Leave room group
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive_json(self, content):
        # Handle messages sent from client if needed (e.g. client wants to force-refresh counts)
        action = content.get('action')
        if action == 'refresh_counts':
            counts = await get_unread_counts(self.user)
            await self.send_json({
                "type": "counts",
                "messages": counts["messages"],
                "notifications": counts["notifications"]
            })

    async def update_counts(self, event):
        # Receive update_counts event from group (triggered by signals)
        # Fetch current counts from database and push them to WebSocket client
        counts = await get_unread_counts(self.user)
        await self.send_json({
            "type": "counts",
            "messages": counts["messages"],
            "notifications": counts["notifications"]
        })

def send_user_update(user_id):
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "update_counts"
            }
        )

