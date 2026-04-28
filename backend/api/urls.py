from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, GameViewSet, ReviewViewSet, PostViewSet, RegisterView, 
    GoogleLoginView, CurrentUserView, NotificationViewSet, ConversationViewSet, MessageViewSet, 
    LibraryViewSet, CustomAuthToken
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'games', GameViewSet)
router.register(r'reviews', ReviewViewSet)

router.register(r'posts', PostViewSet)
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'library', LibraryViewSet, basename='library')
from .views import NewsViewSet, LikeViewSet, ProjectViewSet, JobPostingViewSet
router.register(r'news', NewsViewSet, basename='news')
router.register(r'likes', LikeViewSet, basename='like')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'job-postings', JobPostingViewSet, basename='job-posting')
from .views import PitchViewSet, InvestorCallViewSet
router.register(r'pitches', PitchViewSet, basename='pitch')
router.register(r'investor-calls', InvestorCallViewSet, basename='investor-call')

# Recommendation & Feed Ranking endpoints
from .views import RankedFeedView, FriendSuggestionView, PostInteractionView, PostScoreDebugView

urlpatterns = [
    path('users/me/', CurrentUserView.as_view(), name='current-user'),

    # Recommendation API (router'dan ONCE tanimlanmali)
    path('feed/ranked/', RankedFeedView.as_view(), name='ranked-feed'),
    path('users/suggestions/', FriendSuggestionView.as_view(), name='friend-suggestions'),
    path('posts/<int:post_id>/interact/', PostInteractionView.as_view(), name='post-interact'),
    path('posts/<int:post_id>/debug-score/', PostScoreDebugView.as_view(), name='post-debug-score'),

    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('google-login/', GoogleLoginView.as_view(), name='google-login'),
    path('login/', CustomAuthToken.as_view(), name='api_token_auth'),
]
