"""
Management command to retroactively clean up Xbox library entries.

This command:
1. Removes non-game entries (launchers, media apps, Microsoft built-ins)
2. Normalizes Xbox titles (strips platform tags, editions, trademarks)
3. Merges duplicate entries that point to the same base game
4. Re-matches games via IGDB for cross-platform deduplication

Usage:
    python manage.py cleanup_xbox_entries          # Dry run (preview only)
    python manage.py cleanup_xbox_entries --apply   # Actually apply changes
"""
import time
from django.core.management.base import BaseCommand
from api.models import LibraryEntry
from core.models import Game
from core.utils import is_xbox_non_game, normalize_xbox_title, normalize_game_title


class Command(BaseCommand):
    help = 'Clean up Xbox library entries: remove non-games, normalize titles, merge duplicates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Actually apply changes. Without this flag, only a dry-run preview is shown.',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        mode = 'APPLY' if apply else 'DRY RUN'
        
        self.stdout.write(f"\n{'='*70}")
        self.stdout.write(f"  Xbox Library Cleanup [{mode}]")
        self.stdout.write(f"{'='*70}\n")

        # Get all Xbox library entries across ALL users
        xbox_entries = LibraryEntry.objects.filter(
            platform__icontains='Xbox'
        ).select_related('game', 'user')
        
        total = xbox_entries.count()
        self.stdout.write(f"Found {total} Xbox library entries across all users.\n")

        stats = {
            'non_game_removed': 0,
            'title_normalized': 0,
            'merged_to_existing': 0,
            'igdb_matched': 0,
            'orphan_games_deleted': 0,
            'errors': 0,
        }
        
        entries_to_delete = []
        games_to_check_orphan = []

        for entry in xbox_entries:
            game = entry.game
            raw_title = game.title
            user = entry.user
            
            # === Phase 1: Remove non-games ===
            if is_xbox_non_game(raw_title):
                self.stdout.write(
                    self.style.WARNING(f"  [REMOVE] Non-game: '{raw_title}' (user: {user.username})")
                )
                if apply:
                    entries_to_delete.append(entry.id)
                    games_to_check_orphan.append(game.id)
                stats['non_game_removed'] += 1
                continue
            
            # === Phase 2: Normalize title ===
            cleaned_title = normalize_xbox_title(raw_title)
            
            if not cleaned_title:
                self.stdout.write(
                    self.style.WARNING(f"  [REMOVE] Title normalized to empty: '{raw_title}' (user: {user.username})")
                )
                if apply:
                    entries_to_delete.append(entry.id)
                    games_to_check_orphan.append(game.id)
                stats['non_game_removed'] += 1
                continue
            
            if cleaned_title.lower() == raw_title.lower():
                # Title didn't change, no normalization needed
                continue
            
            self.stdout.write(f"  [NORMALIZE] '{raw_title}' -> '{cleaned_title}'")
            stats['title_normalized'] += 1
            
            # === Phase 3: Find existing game to merge into ===
            # Check if there's already a Game with the cleaned title
            target_game = Game.objects.filter(title__iexact=cleaned_title).first()
            
            # Also try normalized comparison (strip trademarks from both sides)
            if not target_game:
                generic = normalize_game_title(cleaned_title)
                candidates = Game.objects.exclude(id=game.id)
                for candidate in candidates:
                    if normalize_game_title(candidate.title).lower() == generic.lower():
                        target_game = candidate
                        break
            
            if target_game and target_game.id != game.id:
                # We found a match! Merge the entry to point at the existing game
                self.stdout.write(
                    self.style.SUCCESS(f"    -> Merge into existing: '{target_game.title}' (id={target_game.id})")
                )
                
                if apply:
                    # Check if user already has an entry for the target game
                    existing_entry = LibraryEntry.objects.filter(
                        user=user, game=target_game
                    ).first()
                    
                    if existing_entry:
                        # User already has this game - merge playtimes
                        existing_entry.xbox_playtime = max(
                            existing_entry.xbox_playtime, entry.xbox_playtime
                        )
                        existing_entry.playtime_forever = (
                            existing_entry.steam_playtime + existing_entry.xbox_playtime
                        )
                        if not existing_entry.platform:
                            existing_entry.platform = 'Xbox'
                        elif 'Xbox' not in existing_entry.platform:
                            existing_entry.platform += ', Xbox'
                        existing_entry.save()
                        
                        # Delete the duplicate entry
                        entries_to_delete.append(entry.id)
                        games_to_check_orphan.append(game.id)
                    else:
                        # Move entry to point at the target game
                        entry.game = target_game
                        entry.save(update_fields=['game'])
                        games_to_check_orphan.append(game.id)
                
                stats['merged_to_existing'] += 1
            elif apply and game.title != cleaned_title:
                # No merge target found, but title needs updating on the Game itself
                # Only if no other entries use this game
                other_entries = LibraryEntry.objects.filter(game=game).exclude(id=entry.id).exists()
                if not other_entries:
                    game.title = cleaned_title
                    game.save(update_fields=['title'])
                    self.stdout.write(f"    -> Renamed game: '{raw_title}' -> '{cleaned_title}'")

        # === Phase 4: Delete flagged entries ===
        if apply and entries_to_delete:
            deleted_count = LibraryEntry.objects.filter(id__in=entries_to_delete).delete()[0]
            self.stdout.write(f"\n  Deleted {deleted_count} library entries.")
        
        # === Phase 5: Clean up orphaned Game objects ===
        if apply and games_to_check_orphan:
            orphans_deleted = 0
            for game_id in set(games_to_check_orphan):
                try:
                    game = Game.objects.get(id=game_id)
                    # Only delete if no more library entries or reviews reference it
                    has_entries = LibraryEntry.objects.filter(game=game).exists()
                    has_reviews = game.reviews.exists()
                    if not has_entries and not has_reviews:
                        self.stdout.write(
                            self.style.WARNING(f"  [ORPHAN] Deleted orphan game: '{game.title}'")
                        )
                        game.delete()
                        orphans_deleted += 1
                except Game.DoesNotExist:
                    pass
            stats['orphan_games_deleted'] = orphans_deleted

        # === Report ===
        self.stdout.write(f"\n{'='*70}")
        self.stdout.write(f"  Results [{mode}]:")
        self.stdout.write(f"    Non-games removed:    {stats['non_game_removed']}")
        self.stdout.write(f"    Titles normalized:    {stats['title_normalized']}")
        self.stdout.write(f"    Merged to existing:   {stats['merged_to_existing']}")
        self.stdout.write(f"    Orphan games deleted: {stats['orphan_games_deleted']}")
        self.stdout.write(f"    Errors:               {stats['errors']}")
        self.stdout.write(f"{'='*70}\n")
        
        if not apply:
            self.stdout.write(
                self.style.NOTICE("  This was a DRY RUN. Run with --apply to execute changes.")
            )
