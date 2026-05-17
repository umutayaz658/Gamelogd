from core.models import Game
games = Game.objects.exclude(cover_image="")[:5]
for g in games:
    print(f"Title: {g.title}, SteamID: {g.steam_appid}, IGDB: {g.igdb_id}, Cover: {g.cover_image}")
