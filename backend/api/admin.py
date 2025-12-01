from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from core.models import Game, Review, Post
from api.models import User, Interest, Follow, Notification

@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

# Unregister existing User admin if needed, or just overwrite
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Profile Info', {
            'fields': (
                'phone_number', 
                'gender', 
                'birth_date', 
                'is_gamer', 
                'is_developer', 
                'is_investor', 
                'interests', 
                'top_favorites',
                'platforms'
            )
        }),
    )
    filter_horizontal = ('interests',)
    list_display = ('username', 'email', 'is_staff', 'is_gamer', 'is_developer')


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ('title', 'release_date', 'igdb_id')
    search_fields = ('title',)

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('user', 'timestamp', 'content_preview')
    list_filter = ('timestamp',)

    def content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('user', 'game', 'rating', 'timestamp')
    list_filter = ('rating', 'timestamp')

@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'actor', 'verb', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at')
