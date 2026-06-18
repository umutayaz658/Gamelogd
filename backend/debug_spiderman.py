import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Game

games = Game.objects.filter(title__icontains='spider-man')
print(f"Found {games.count()} Spider-Man games:")
for g in games:
    print(f"ID: {g.id}, IGDB ID: {g.igdb_id}, AppID: {g.steam_appid}, Cover: '{g.cover_image}', Title: {g.title}")

