from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from core.models import Game, Review, Post
from api.models import User, Interest, Follow, Notification, Report

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
    list_display = ('user', 'timestamp', 'parent', 'content_preview')
    list_filter = ('timestamp',)

    def content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content



@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'actor', 'verb', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('user', 'game', 'rating', 'timestamp')
    list_filter = ('timestamp', 'rating')

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('reporter', 'target_type', 'target_id', 'reason', 'status', 'created_at')
    list_filter = ('status', 'reason', 'target_type', 'created_at')
    search_fields = ('reporter__username', 'details')
    actions = ['mark_reviewed', 'mark_dismissed', 'mark_actioned']

    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed')
    mark_reviewed.short_description = "Mark selected reports as reviewed"

    def mark_dismissed(self, request, queryset):
        queryset.update(status='dismissed')
    mark_dismissed.short_description = "Mark selected reports as dismissed"

    def mark_actioned(self, request, queryset):
        queryset.update(status='actioned')
    mark_actioned.short_description = "Mark selected reports as actioned"
