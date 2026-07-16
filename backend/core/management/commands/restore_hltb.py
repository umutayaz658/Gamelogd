import concurrent.futures
from django.core.management.base import BaseCommand
from core.models import Game
from api.services.hltb_service import fetch_hltb_times

class Command(BaseCommand):
    help = 'Restores HLTB data for games missing it (where hltb_main is null)'

    def handle(self, *args, **options):
        # We need to find games where HLTB is None
        games_to_fix = Game.objects.filter(hltb_main__isnull=True)
        self.stdout.write(f"Found {games_to_fix.count()} games missing HLTB data.")
        
        fixed_count = 0
        for game in games_to_fix:
            self.stdout.write(f"Fetching HLTB for: {game.title}")
            try:
                times = fetch_hltb_times(game.title)
                if times['hltb_main'] is not None:
                    game.hltb_main = times['hltb_main']
                    game.hltb_main_extra = times['hltb_main_extra']
                    game.hltb_completionist = times['hltb_completionist']
                    game.save(update_fields=['hltb_main', 'hltb_main_extra', 'hltb_completionist'])
                    fixed_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error for {game.title}: {e}"))
                
        self.stdout.write(self.style.SUCCESS(f"Successfully restored HLTB for {fixed_count} games."))
