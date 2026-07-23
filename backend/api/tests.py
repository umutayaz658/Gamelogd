from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from api.models import User
from core.models import Organisation, OrganisationMember, Review


def make_user(username, **extra):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='testpass123', **extra
    )


class OrganisationTakeoverTests(TestCase):
    """Regression tests for the org-membership/invitation self-escalation bugs (P0 #1, #2):
    previously any authenticated user could POST themselves into any organisation as admin,
    either directly via /organisation-members/ or via a self-sent /organisation-invitations/
    that they then accepted.
    """

    def setUp(self):
        self.attacker = make_user('attacker')
        self.owner = make_user('owner')
        self.org = Organisation.objects.create(name='Target Org', slug='target-org')
        OrganisationMember.objects.create(organisation=self.org, user=self.owner, role='owner')

        self.client = APIClient()
        self.client.force_authenticate(user=self.attacker)

    def test_non_member_cannot_self_add_as_member(self):
        resp = self.client.post('/api/organisation-members/', {
            'organisation': self.org.id, 'user_id': self.attacker.id, 'role': 'admin',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            OrganisationMember.objects.filter(organisation=self.org, user=self.attacker).exists()
        )

    def test_non_member_cannot_self_invite_and_accept(self):
        resp = self.client.post('/api/organisation-invitations/', {
            'organisation': self.org.id, 'user_id': self.attacker.id, 'role': 'admin',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            OrganisationMember.objects.filter(organisation=self.org, user=self.attacker).exists()
        )

    def test_admin_can_add_member(self):
        target = make_user('newmember')
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/organisation-members/', {
            'organisation': self.org.id, 'user_id': target.id, 'role': 'member',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            OrganisationMember.objects.filter(organisation=self.org, user=target, role='member').exists()
        )

    def test_owner_role_cannot_be_granted_via_create(self):
        target = make_user('wannabeowner')
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/organisation-members/', {
            'organisation': self.org.id, 'user_id': target.id, 'role': 'owner',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class UserSerializerPrivacyTests(TestCase):
    """Regression test for the mass-PII-exposure bug (P0 #3): email/phone_number were returned
    for every non-private user in list/nested responses (feed, search, followers, etc.).
    """

    def setUp(self):
        self.viewer = make_user('viewer')
        self.other = make_user('other', phone_number='+15551234567')
        self.client = APIClient()

    def test_other_users_email_and_phone_are_never_exposed(self):
        self.client.force_authenticate(user=self.viewer)
        resp = self.client.get(f'/api/users/{self.other.username}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn('email', resp.data)
        self.assertNotIn('phone_number', resp.data)

    def test_owner_still_sees_own_email(self):
        self.client.force_authenticate(user=self.other)
        resp = self.client.get('/api/users/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('email'), self.other.email)

    def test_anonymous_list_never_exposes_email(self):
        resp = self.client.get('/api/users/', {'search': self.other.username})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = str(resp.data)
        self.assertNotIn(self.other.email, payload)


class ExtraLinksValidationTests(TestCase):
    """Regression test for the stored-XSS bug (P0 #4): javascript:/data: URLs posted directly to
    the API (bypassing client-side sanitisation) must be rejected server-side.
    """

    def setUp(self):
        self.owner = make_user('linkowner')
        self.org = Organisation.objects.create(name='Link Org', slug='link-org')
        OrganisationMember.objects.create(organisation=self.org, user=self.owner, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_javascript_url_rejected_on_website_field(self):
        resp = self.client.patch(f'/api/organisations/{self.org.slug}/', {
            'website': 'javascript:alert(1)',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_javascript_url_rejected_in_extra_links(self):
        resp = self.client.patch(f'/api/organisations/{self.org.slug}/', {
            'extra_links': [{'label': 'evil', 'url': 'javascript:alert(document.cookie)'}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_https_url_accepted(self):
        resp = self.client.patch(f'/api/organisations/{self.org.slug}/', {
            'website': 'https://example.com',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.org.refresh_from_db()
        self.assertEqual(self.org.website, 'https://example.com')


class PasswordChangeTokenRotationTests(TestCase):
    """Regression test: change_password must rotate the auth token so a previously-issued
    (possibly stolen) token stops working immediately (P1 #12).
    """

    def test_old_token_invalid_after_password_change(self):
        user = make_user('rotator')
        client = APIClient()
        client.force_authenticate(user=user)

        from rest_framework.authtoken.models import Token
        old_token = Token.objects.create(user=user)

        resp = client.post('/api/users/change-password/', {
            'current_password': 'testpass123',
            'new_password': 'NewStrongPass456!',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)
        self.assertFalse(Token.objects.filter(key=old_token.key).exists())


class ReviewRatingConstraintTests(TestCase):
    """Regression test for the missing rating-range validation (P1 #10)."""

    def setUp(self):
        from core.models import Game
        self.user = make_user('reviewer')
        self.game = Game.objects.create(title='Test Game')

    def test_out_of_range_rating_rejected(self):
        with self.assertRaises(Exception):
            Review.objects.create(user=self.user, game=self.game, rating=99.9)
