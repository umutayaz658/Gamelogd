import sys
from django.core.management.base import BaseCommand
from core.models import Game
from api.services.igdb_service import fetch_game_details

class Command(BaseCommand):
    help = 'Fetches full details (cover, genres, summary, etc.) for games missing them'

    def handle(self, *args, **options):
        # We need to find games that are missing either cover_image or genres
        games_to_fix = Game.objects.filter(cover_image__isnull=True) | Game.objects.filter(cover_image='') | Game.objects.filter(genres__isnull=True) | Game.objects.filter(genres=[])
        
        # We will also just check games that might be empty dictionaries
        all_games = Game.objects.all()
        to_fix = []
        for g in all_games:
            if not g.cover_image or not g.genres or len(g.genres) == 0:
                to_fix.append(g)

        self.stdout.write(f"Found {len(to_fix)} games needing details fetch.")
        
        fixed_count = 0
        for game in to_fix:
            self.stdout.write(f"Fetching details for: {game.title} (ID: {game.id})")
            try:
                # Disable HLTB temporarily to prevent crashes during bulk import
                import api.services.igdb_service
                original_hltb = api.services.igdb_service.fetch_hltb_times
                api.services.igdb_service.fetch_hltb_times = lambda x: {'hltb_main': None, 'hltb_main_extra': None, 'hltb_completionist': None}
                
                fetch_game_details(game)
                
                # Restore
                api.services.igdb_service.fetch_hltb_times = original_hltb
                
                fixed_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error fetching for {game.title}: {e}"))
                
        self.stdout.write(self.style.SUCCESS(f"Successfully fetched details for {fixed_count} games."))
