from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, GameViewSet, ReviewViewSet, PostViewSet, RegisterView, 
    GoogleLoginView, CurrentUserView, NotificationViewSet, ConversationViewSet, MessageViewSet, 
    LibraryViewSet, CustomAuthToken, VerifyEmailView, ResendVerificationView
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
from .views import NewsViewSet, LikeViewSet, BookmarkViewSet, ProjectViewSet, JobPostingViewSet, ProjectMemberViewSet, OrganisationViewSet, OrganisationMemberViewSet, OrganisationInvitationViewSet
router.register(r'news', NewsViewSet, basename='news')
router.register(r'likes', LikeViewSet, basename='like')
router.register(r'bookmarks', BookmarkViewSet, basename='bookmark')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'project-members', ProjectMemberViewSet, basename='project-member')
router.register(r'job-postings', JobPostingViewSet, basename='job-posting')
router.register(r'organisations', OrganisationViewSet, basename='organisation')
router.register(r'organisation-members', OrganisationMemberViewSet, basename='organisation-member')
router.register(r'organisation-invitations', OrganisationInvitationViewSet, basename='organisation-invitation')
from .views import PitchViewSet, InvestorCallViewSet, SupportTicketViewSet, FeedViewSet, WorkspaceStateViewSet
router.register(r'pitches', PitchViewSet, basename='pitch')
router.register(r'investor-calls', InvestorCallViewSet, basename='investor-call')
router.register(r'support-tickets', SupportTicketViewSet, basename='support-ticket')
router.register(r'feed', FeedViewSet, basename='feed')
router.register(r'workspace-state', WorkspaceStateViewSet, basename='workspace-state')
from .views import ExplorePostsViewSet
router.register(r'explore/posts', ExplorePostsViewSet, basename='explore-posts')

urlpatterns = [
    path('users/me/', CurrentUserView.as_view(), name='current-user'),
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('google-login/', GoogleLoginView.as_view(), name='google-login'),
    path('login/', CustomAuthToken.as_view(), name='api_token_auth'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
]
