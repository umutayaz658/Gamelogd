from django.contrib import admin
from .models import News, NewsSource

@admin.register(NewsSource)
class NewsSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'rss_url')

@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ('title', 'source', 'category', 'pub_date')
    list_filter = ('category', 'source', 'pub_date')
    search_fields = ('title', 'description')
