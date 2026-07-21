from django.urls import re_path
from api.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'^ws/updates/$', NotificationConsumer.as_asgi()),
]
