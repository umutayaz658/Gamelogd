# Data migration: Reset details_fetched for games missing stats so they get re-fetched with Metacritic & HLTB data

from django.db import migrations


def reset_details_fetched(apps, schema_editor):
    """
    Reset details_fetched to False for all games that don't have metacritic_score yet.
    This forces the system to re-fetch from IGDB (which now includes aggregated_rating)
    and from HowLongToBeat the next time someone visits the game page.
    """
    Game = apps.get_model('core', 'Game')
    updated = Game.objects.filter(
        details_fetched=True,
        metacritic_score__isnull=True
    ).update(details_fetched=False)
    print(f"\n  -> Reset details_fetched for {updated} games (will re-fetch with Metacritic & HLTB data)")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0038_game_stats'),
    ]

    operations = [
        migrations.RunPython(reset_details_fetched, noop),
    ]
