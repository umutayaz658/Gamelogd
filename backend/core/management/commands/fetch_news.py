import feedparser
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import News, NewsSource
from datetime import datetime, timedelta
import time
from time import mktime

class Command(BaseCommand):
    help = 'Fetches news from RSS feeds'

    def handle(self, *args, **options):
        # Auto-seed sources
        sources_data = [
            {'category': 'invest', 'name': 'GamesIndustry.biz', 'url': 'https://www.gamesindustry.biz/feed', 'icon': 'https://www.google.com/s2/favicons?domain=gamesindustry.biz&sz=256'},
            {'category': 'devs', 'name': 'Game Developer', 'url': 'https://www.gamedeveloper.com/rss.xml', 'icon': 'https://www.gamedeveloper.com/favicon.ico'},
            {'category': 'hardware', 'name': 'Tom\'s Hardware', 'url': 'https://www.tomshardware.com/feeds/all', 'icon': 'https://www.tomshardware.com/favicon.ico'},
            {'category': 'general', 'name': 'IGN', 'url': 'https://www.ign.com/rss/articles/feed?tags=games', 'icon': 'https://www.google.com/s2/favicons?domain=ign.com&sz=256'},
        ]

        for s in sources_data:
            NewsSource.objects.get_or_create(
                rss_url=s['url'],
                defaults={'name': s['name'], 'category': s['category'], 'icon': s['icon']}
            )

        sources = NewsSource.objects.all()
        for source in sources:
            self.stdout.write(f"Fetching {source.name}...")
            try:
                feed = feedparser.parse(source.rss_url)
                
                for entry in feed.entries[:10]: # Limit to 10 latest
                    if News.objects.filter(link=entry.link).exists():
                        continue

                    # Parse image
                    image_url = None
                    if hasattr(entry, 'media_content') and entry.media_content:
                        image_url = entry.media_content[0]['url']
                    elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                        image_url = entry.media_thumbnail[0]['url']
                    else:
                        # Fallback: parse HTML description for img tag
                        soup = BeautifulSoup(entry.description, 'html.parser')
                        img = soup.find('img')
                        if img and 'src' in img.attrs:
                            image_url = img['src']

                    # Clean description
                    soup = BeautifulSoup(entry.description, 'html.parser')
                    description = soup.get_text()[:500] + "..." if len(soup.get_text()) > 500 else soup.get_text()

                    # Smart Categorization
                    final_category = self.classify_news(entry.title, description, source.category)

                    # Parse date
                    pub_date = timezone.now()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                         # timestamp to datetime
                         dt = datetime.fromtimestamp(mktime(entry.published_parsed))
                         pub_date = timezone.make_aware(dt) if timezone.is_naive(dt) else dt

                    News.objects.create(
                        source=source,
                        title=entry.title,
                        link=entry.link,
                        image_url=image_url,
                        description=description,
                        pub_date=pub_date,
                        category=final_category
                    )
                    self.stdout.write(f"  Saved: {entry.title} [{final_category}]")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error fetching {source.name}: {e}"))

        self.stdout.write(self.style.SUCCESS('Successfully fetched news'))

        # Retention Policy
        cutoff_date = timezone.now() - timedelta(days=90)
        deleted_count, _ = News.objects.filter(pub_date__lt=cutoff_date).delete()
        if deleted_count > 0:
            self.stdout.write(self.style.WARNING(f'Cleaned up {deleted_count} old articles (older than 90 days).'))

    def classify_news(self, title, description, default_category):
        # Keywords
        KEYWORDS_INVEST = ['stock', 'share', 'market cap', 'revenue', 'acquisition', 'merger', 'quarterly report', 'earnings', 'funding', 'ipo', 'layoff']
        KEYWORDS_DEVS = ['unreal engine', 'unity', 'godot', 'programming', 'c++', 'python', 'source code', 'developer', 'gdc', 'postmortem', 'devlog', 'api', 'sdk']
        KEYWORDS_HARDWARE = ['nvidia', 'rtx', 'amd', 'ryzen', 'intel', 'core i', 'gpu', 'cpu', 'graphics card', 'monitor', 'keyboard', 'mouse', 'console', 'ps5', 'xbox series', 'switch 2', 'specs', 'benchmark']
        KEYWORDS_ESPORTS = ['tournament', 'championship', 'finals', 'esports', 'roster', 'team', 'winner', 'league of legends', 'counter-strike', 'valorant', 'dota']

        text = (title + " " + description).lower()

        # Priority Check
        if any(k in text for k in KEYWORDS_INVEST):
            return 'invest'
        if any(k in text for k in KEYWORDS_DEVS):
            return 'devs'
        if any(k in text for k in KEYWORDS_HARDWARE):
            return 'hardware'
        if any(k in text for k in KEYWORDS_ESPORTS):
            return 'general' # Redirect content like 'tournaments' to General instead of source default

        return default_category
