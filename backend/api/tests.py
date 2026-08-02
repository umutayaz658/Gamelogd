from django.core.files.uploadedfile import SimpleUploadedFile
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


class CommunityTranslationTests(TestCase):
    """
    Covers the public community-translation feature (core.models.CommunityTranslation): any
    logged-in user (not just project members) can suggest and vote on translations for a
    project's Devs-managed key catalogue, and a permitted project owner/admin can approve one,
    which mirrors it back into the project's WorkspaceState blob for the internal Localisation
    Manager's own export to pick up with no manual copy-paste.
    """

    def setUp(self):
        from core.models import Project, WorkspaceState

        self.owner = make_user('projowner')
        self.project = Project.objects.create(owner=self.owner, title='Indie Game', description='desc')
        self.board_key = f'workspace__solo_board_project_{self.project.id}'
        self.workspace_state = WorkspaceState.objects.create(
            key=self.board_key,
            user_id=self.owner.id,
            organisation=None,
            version=1,
            data={
                'translationKeys': [
                    {'id': 'k1', 'key': 'mainMenu.play', 'namespace': 'mainMenu', 'baseText': 'Play', 'suggestions': {}},
                ],
                'glossary': [
                    {'id': 'g1', 'term': 'Play', 'translations': {'tr': 'Oyna'}},
                ],
                'tasks': [{'id': 'task-1', 'title': 'Secret internal task', 'columnId': 'backlog'}],
                'gddDocs': [{'id': 'doc-1', 'title': 'Secret design doc'}],
                'assets': [{'id': 'asset-1', 'name': 'Secret asset'}],
            },
        )

        self.contributor = make_user('nonmember')
        self.voter = make_user('votinguser')
        self.client = APIClient()

    def test_anonymous_can_read_translation_keys(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/translation-keys/', {'language': 'tr'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['has_key_catalog'])
        self.assertEqual(resp.data['keys'][0]['key'], 'mainMenu.play')

    def test_translation_keys_includes_glossary(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/translation-keys/', {'language': 'tr'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data['glossary']), 1)
        self.assertEqual(resp.data['glossary'][0]['term'], 'Play')
        self.assertEqual(resp.data['glossary'][0]['translations']['tr'], 'Oyna')

    def test_translation_keys_never_leaks_other_blob_fields(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/translation-keys/', {'language': 'tr'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = str(resp.data)
        self.assertNotIn('Secret internal task', payload)
        self.assertNotIn('Secret design doc', payload)
        self.assertNotIn('Secret asset', payload)
        self.assertNotIn('tasks', resp.data)
        self.assertNotIn('gddDocs', resp.data)
        self.assertNotIn('assets', resp.data)

    def test_non_member_can_submit_translation(self):
        self.client.force_authenticate(user=self.contributor)
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'mainMenu.play', 'language': 'tr', 'text': 'Oyna',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_submit_rejects_unknown_key(self):
        self.client.force_authenticate(user=self.contributor)
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'no.such.key', 'language': 'tr', 'text': 'Oyna',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_suggestion_by_same_author_rejected(self):
        self.client.force_authenticate(user=self.contributor)
        self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'mainMenu.play', 'language': 'tr', 'text': 'Oyna',
        })
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'mainMenu.play', 'language': 'tr', 'text': 'Oyna 2',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def _submit(self, user, text='Oyna'):
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'mainMenu.play', 'language': 'tr', 'text': text,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data['id']

    def test_approve_requires_permission(self):
        contribution_id = self._submit(self.contributor)
        self.client.force_authenticate(user=self.voter)
        resp = self.client.post(f'/api/community-translations/{contribution_id}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_approve_unapproves_sibling(self):
        from core.models import CommunityTranslation

        contribution_a = self._submit(self.contributor, text='Oyna A')
        contribution_b = self._submit(self.voter, text='Oyna B')

        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(f'/api/community-translations/{contribution_a}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = self.client.post(f'/api/community-translations/{contribution_b}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.assertEqual(CommunityTranslation.objects.get(pk=contribution_a).status, 'pending')
        approved_b = CommunityTranslation.objects.get(pk=contribution_b)
        self.assertEqual(approved_b.status, 'approved')
        self.assertEqual(approved_b.approved_by_id, self.owner.id)

    def test_approve_never_touches_the_workspace_blob(self):
        """Regression guard: approving a suggestion is a pure CommunityTranslation status change
        now — it must never read or write the project's WorkspaceState row (that mirroring
        mechanism was removed once Devs and the public page were unified onto this one model),
        so a concurrent Kanban/GDD/asset edit on the same board can never be clobbered by it."""
        from core.models import WorkspaceState

        contribution_id = self._submit(self.contributor)
        state_before = WorkspaceState.objects.get(key=self.board_key)

        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(f'/api/community-translations/{contribution_id}/approve/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        state_after = WorkspaceState.objects.get(key=self.board_key)
        self.assertEqual(state_after.version, state_before.version)
        self.assertEqual(state_after.data, state_before.data)

    def test_reject_after_approve_reverts_status(self):
        from core.models import CommunityTranslation

        contribution_id = self._submit(self.contributor)
        self.client.force_authenticate(user=self.owner)
        self.client.post(f'/api/community-translations/{contribution_id}/approve/')
        resp = self.client.post(f'/api/community-translations/{contribution_id}/reject/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        contribution = CommunityTranslation.objects.get(pk=contribution_id)
        self.assertEqual(contribution.status, 'rejected')
        self.assertIsNone(contribution.approved_by)

    def test_delete_allowed_for_author_and_for_permitted_moderator_only(self):
        contribution_id = self._submit(self.contributor)

        # A random other non-member/non-moderator can't delete it.
        self.client.force_authenticate(user=self.voter)
        resp = self.client.delete(f'/api/community-translations/{contribution_id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # The author can delete their own.
        self.client.force_authenticate(user=self.contributor)
        resp = self.client.delete(f'/api/community-translations/{contribution_id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        # The project owner (moderator) can delete someone else's.
        other_contribution_id = self._submit(self.voter, text='Oyna C')
        self.client.force_authenticate(user=self.owner)
        resp = self.client.delete(f'/api/community-translations/{other_contribution_id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)


class LocalisationContributorsTests(TestCase):
    """Covers the public contributors leaderboard (ProjectViewSet.localisation_contributors):
    character-count aggregation (flat + plural), team/org/community role badges, language
    filter/sort, search, and pagination."""

    def setUp(self):
        from core.models import CommunityTranslation, Organisation, OrganisationMember, Project, ProjectMember

        self.owner = make_user('leaderboardowner')
        self.org = Organisation.objects.create(name='Indie Studio', slug='indie-studio')
        OrganisationMember.objects.create(organisation=self.org, user=self.owner, role='owner')
        self.project = Project.objects.create(owner=self.owner, title='Indie Game', description='desc', organisation=self.org)

        self.team_member = make_user('teammate')
        ProjectMember.objects.create(project=self.project, user=self.team_member, role='editor', status='active')

        self.org_member = make_user('orgmate')
        OrganisationMember.objects.create(organisation=self.org, user=self.org_member, role='member')

        self.public_contributor = make_user('publiccontributor')

        # team_member: flat "Merhaba" (7 chars) in tr.
        CommunityTranslation.objects.create(
            project=self.project, key='hud.hello', namespace='hud', language='tr',
            author=self.team_member, text='Merhaba', status='approved',
        )
        # org_member: plural in de — sum of all category values' lengths (5 + 6 = 11).
        CommunityTranslation.objects.create(
            project=self.project, key='hud.enemies', namespace='hud', language='de',
            author=self.org_member, text='Feind', plural_forms={'one': 'Feind', 'other': 'Feinde'},
            status='approved',
        )
        # public_contributor: flat "Bonjour" (7 chars) in fr, plus a pending one that must not count.
        CommunityTranslation.objects.create(
            project=self.project, key='hud.hello', namespace='hud', language='fr',
            author=self.public_contributor, text='Bonjour', status='approved',
        )
        CommunityTranslation.objects.create(
            project=self.project, key='hud.enemies', namespace='hud', language='fr',
            author=self.public_contributor, text='Ennemis', status='pending',
        )

        self.client = APIClient()

    def test_character_counts_and_role_badges(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/contributors/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        by_username = {c['user']['username']: c for c in resp.data['results']}

        self.assertEqual(by_username['teammate']['total_characters'], 7)
        self.assertEqual(by_username['teammate']['role_badge'], 'team')

        self.assertEqual(by_username['orgmate']['total_characters'], 11)
        self.assertEqual(by_username['orgmate']['role_badge'], 'org')
        self.assertEqual(by_username['orgmate']['by_language']['de'], 11)

        # Only the approved fr suggestion (7 chars) counts, not the pending one.
        self.assertEqual(by_username['publiccontributor']['total_characters'], 7)
        self.assertEqual(by_username['publiccontributor']['role_badge'], 'community')

    def test_owner_counts_as_team_even_without_project_member_row(self):
        from core.models import CommunityTranslation
        CommunityTranslation.objects.create(
            project=self.project, key='hud.hello', namespace='hud', language='de',
            author=self.owner, text='Hallo', status='approved',
        )
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/contributors/')
        by_username = {c['user']['username']: c for c in resp.data['results']}
        self.assertEqual(by_username['leaderboardowner']['role_badge'], 'team')

    def test_language_filter_sorts_and_excludes_zero_contributors(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/contributors/', {'language': 'de'})
        usernames = [c['user']['username'] for c in resp.data['results']]
        self.assertEqual(usernames, ['orgmate'])

    def test_search_matches_username_and_real_name(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/contributors/', {'q': 'teamm'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usernames = [c['user']['username'] for c in resp.data['results']]
        self.assertEqual(usernames, ['teammate'])

    def test_pagination(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/contributors/', {'page_size': 1})
        self.assertEqual(resp.data['count'], 3)
        self.assertEqual(len(resp.data['results']), 1)
        self.assertIsNotNone(resp.data['next'])


def _strip_outer_parens(expr):
    expr = expr.strip()
    while expr.startswith('(') and expr.endswith(')'):
        depth = 0
        fully_wraps = True
        for i, c in enumerate(expr):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0 and i != len(expr) - 1:
                    fully_wraps = False
                    break
        if not fully_wraps:
            break
        expr = expr[1:-1].strip()
    return expr


def _c_ternary_to_python(expr):
    """Converts a C-style `cond ? a : b` (nestable, right-associative) expression, already with
    && / || replaced by and / or, into a Python ternary expression string. Used only by tests to
    verify each locale's gettext_plural_expr actually yields the category it claims to."""
    expr = _strip_outer_parens(expr)
    depth = 0
    qpos = None
    for i, c in enumerate(expr):
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif c == '?' and depth == 0:
            qpos = i
            break
    if qpos is None:
        return expr
    cond = expr[:qpos].strip()
    rest = expr[qpos + 1:]
    depth = 0
    nested_q = 0
    colon_pos = None
    for i, c in enumerate(rest):
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif c == '?' and depth == 0:
            nested_q += 1
        elif c == ':' and depth == 0:
            if nested_q == 0:
                colon_pos = i
                break
            nested_q -= 1
    true_expr = rest[:colon_pos].strip()
    false_expr = rest[colon_pos + 1:].strip()
    return f'({_c_ternary_to_python(true_expr)} if ({cond}) else {_c_ternary_to_python(false_expr)})'


def _eval_gettext_plural_index(expr, n):
    py_expr = expr.replace('&&', ' and ').replace('||', ' or ')
    py_expr = _c_ternary_to_python(py_expr)
    return int(eval(py_expr, {'__builtins__': {}}, {'n': n}))  # noqa: S307 — test-only, fixed table, no user input


class LocaleRegistryTests(TestCase):
    """Covers backend/api/locale_registry.py's data integrity — this is the table that would
    have caught the Turkish gettext-plural-form ambiguity (see the module's own docstring) had
    it been wrong."""

    def test_gettext_category_order_matches_nplurals_and_is_subset_of_cldr(self):
        from api.locale_registry import LOCALES
        for code, loc in LOCALES.items():
            with self.subTest(locale=code):
                self.assertEqual(len(loc.gettext_category_order), loc.gettext_nplurals)
                self.assertTrue(set(loc.gettext_category_order).issubset(set(loc.cldr_categories)))
                self.assertTrue(loc.name)
                self.assertTrue(loc.native_name)

    def test_codes_are_unique(self):
        from api.locale_registry import LOCALES
        codes = list(LOCALES.keys())
        self.assertEqual(len(codes), len(set(codes)))

    def test_plural_expressions_yield_valid_indices_across_a_range(self):
        from api.locale_registry import LOCALES
        for code, loc in LOCALES.items():
            with self.subTest(locale=code):
                for n in range(0, 201):
                    idx = _eval_gettext_plural_index(loc.gettext_plural_expr, n)
                    self.assertTrue(0 <= idx < loc.gettext_nplurals, f'{code}: n={n} produced out-of-range index {idx}')

    def test_hand_verified_plural_category_pairs(self):
        from api.locale_registry import LOCALES

        def category_for(code, n):
            loc = LOCALES[code]
            idx = _eval_gettext_plural_index(loc.gettext_plural_expr, n)
            return loc.gettext_category_order[idx]

        # This is the test that would have caught the Turkish gettext-plural ambiguity: CLDR
        # only defines 'one' for n=1 (and 'other' otherwise) for Turkish, i.e. (n != 1) — not the
        # older gettext-tradition (n > 1), which would incorrectly call n=0 'one'.
        self.assertEqual(category_for('tr', 1), 'one')
        self.assertEqual(category_for('tr', 0), 'other')
        self.assertEqual(category_for('en', 1), 'one')
        self.assertEqual(category_for('en', 0), 'other')
        self.assertEqual(category_for('fr', 0), 'one')
        self.assertEqual(category_for('fr', 1), 'one')
        self.assertEqual(category_for('fr', 2), 'other')
        self.assertEqual(category_for('ru', 1), 'one')
        self.assertEqual(category_for('ru', 2), 'few')
        self.assertEqual(category_for('ru', 5), 'many')
        self.assertEqual(category_for('ar', 0), 'zero')
        self.assertEqual(category_for('ar', 2), 'two')
        self.assertEqual(category_for('ja', 5), 'other')

    def test_resolve_project_locales_falls_back_to_defaults(self):
        from api.locale_registry import resolve_project_locales, DEFAULT_PROJECT_LOCALE_CODES
        locales = resolve_project_locales({})
        self.assertEqual([l.code for l in locales], DEFAULT_PROJECT_LOCALE_CODES)

    def test_resolve_project_locales_honours_configured_list(self):
        from api.locale_registry import resolve_project_locales
        locales = resolve_project_locales({'translationLanguages': [{'code': 'ru', 'name': 'Russian'}]})
        self.assertEqual([l.code for l in locales], ['ru'])

    def test_resolve_source_locale_defaults_to_english(self):
        from api.locale_registry import resolve_source_locale
        self.assertEqual(resolve_source_locale({}).code, 'en')


class LegacyLanguageMappingTests(TestCase):
    def test_mapping_is_total_and_injective_and_targets_are_real_codes(self):
        from api.locale_registry import LEGACY_NAME_TO_CODE, LOCALES
        codes = list(LEGACY_NAME_TO_CODE.values())
        self.assertEqual(len(codes), len(set(codes)), 'mapping must be injective')
        for code in codes:
            self.assertIn(code, LOCALES)


class CommunityTranslationPluralValidationTests(TestCase):
    def setUp(self):
        from core.models import Project, WorkspaceState

        self.owner = make_user('pluralowner')
        self.project = Project.objects.create(owner=self.owner, title='Plural Game', description='desc')
        self.board_key = f'workspace__solo_board_project_{self.project.id}'
        WorkspaceState.objects.create(
            key=self.board_key, user_id=self.owner.id, organisation=None, version=1,
            data={
                'translationKeys': [
                    {'id': 'k1', 'key': 'flat.key', 'namespace': 'flat', 'baseText': 'Continue'},
                    {'id': 'k2', 'key': 'hud.enemies', 'namespace': 'hud', 'baseText': '{0} enemies',
                     'isPlural': True, 'basePlural': {'one': '{0} enemy', 'other': '{0} enemies'}},
                ],
                'translationLanguages': [{'code': 'ru', 'name': 'Russian'}],
            },
        )
        self.user = make_user('pluraluser')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_flat_key_rejects_plural_forms_payload(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'flat.key', 'language': 'ru', 'text': 'x',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_plural_key_rejects_flat_text_only(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'hud.enemies', 'language': 'ru', 'text': 'враг',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_plural_key_missing_required_category_rejected(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'hud.enemies', 'language': 'ru',
            'plural_forms': {'one': 'враг'},
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_plural_key_valid_payload_derives_text(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'hud.enemies', 'language': 'ru',
            'plural_forms': {'one': 'враг', 'few': 'врага', 'many': 'врагов'},
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['text'], 'врагов')

    def test_unknown_plural_category_rejected(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'hud.enemies', 'language': 'ru',
            'plural_forms': {'one': 'a', 'few': 'b', 'many': 'c', 'bogus': 'd'},
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_cannot_smuggle_plural_forms_onto_a_flat_key(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'flat.key', 'language': 'ru', 'text': 'x',
        })
        contribution_id = resp.data['id']
        resp = self.client.patch(f'/api/community-translations/{contribution_id}/', {
            'plural_forms': {'one': 'a', 'other': 'b'},
        }, format='json')
        # text is still required and wasn't supplied alongside plural_forms on a flat key —
        # the payload-shape check runs on update now (round-1's version of this method did not).
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_language_not_configured_for_project_rejected(self):
        resp = self.client.post('/api/community-translations/', {
            'project': self.project.id, 'key': 'flat.key', 'language': 'th', 'text': 'x',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class LocalisationFormatRoundTripTests(TestCase):
    """Round-trips a small fixture bundle through every round-2a format. Lossy fields (fields a
    format can't represent) are explicitly excluded from the equality check rather than silently
    ignored, so any new lossiness is a deliberate, reviewed decision."""

    def setUp(self):
        from api.locale_registry import LOCALES
        from api.services.localisation_formats.canonical import BundleEntry, TranslationBundle, TranslationValue

        self.tr = LOCALES['tr']
        self.ru = LOCALES['ru']
        self.en = LOCALES['en']
        self.bundle = TranslationBundle(
            project_id=1, project_title='Astro Drift',
            source=self.en, locales=[self.tr, self.ru],
            entries=[
                BundleEntry(
                    key='hud.health', namespace='hud', base_text='Health',
                    translations={
                        'tr': TranslationValue(text='Can', status='approved'),
                        'ru': TranslationValue(text='Здоровье', status='approved'),
                    },
                ),
                BundleEntry(
                    key='hud.enemies', namespace='hud', base_text='{0} enemies', is_plural=True,
                    base_plural={'one': '{0} enemy', 'other': '{0} enemies'},
                    translations={
                        'ru': TranslationValue(
                            text='{0} врагов',
                            plural_forms={'one': '{0} враг', 'few': '{0} врага', 'many': '{0} врагов'},
                            status='approved',
                        ),
                    },
                ),
            ],
        )

    def test_gettext_po_round_trip(self):
        from api.services.localisation_formats import gettext_po

        raw = gettext_po.export(self.bundle, language='ru')
        parsed = gettext_po.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')
        forms = by_key['hud.enemies'].translations['ru']['plural_forms']
        self.assertEqual(forms['one'], '{0} враг')
        self.assertEqual(forms['few'], '{0} врага')
        self.assertEqual(forms['many'], '{0} врагов')

    def test_xliff12_round_trip(self):
        from api.services.localisation_formats import xliff12

        raw = xliff12.export(self.bundle, language='ru')
        parsed = xliff12.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')
        forms = by_key['hud.enemies'].translations['ru']['plural_forms']
        self.assertEqual(forms['one'], '{0} враг')
        self.assertEqual(forms['few'], '{0} врага')

    def test_flat_json_round_trip(self):
        # Single-language flat_json export is a flat {key: text} map with no per-language
        # identity — only the multi-language ("all") shape {key: {lang: text}} carries enough
        # information for import to know which language a value belongs to.
        from api.services.localisation_formats import flat_json

        raw = flat_json.export(self.bundle, language='all')
        parsed = flat_json.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].translations['tr']['text'], 'Can')
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')

    def test_flat_csv_round_trip(self):
        from api.services.localisation_formats import flat_csv

        raw = flat_csv.export(self.bundle, language='all')
        parsed = flat_csv.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].translations['tr']['text'], 'Can')
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')

    def test_xliff_import_rejects_doctype(self):
        from api.services.localisation_formats import xliff12
        malicious = b'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xliff></xliff>'
        with self.assertRaises(ValueError):
            xliff12.parse(malicious, project_locales=[self.tr], source_locale=self.en)

    def test_xliff_import_rejects_oversized_file(self):
        from api.services.localisation_formats import xliff12
        huge = b'<xliff>' + b'a' * (5 * 1024 * 1024 + 1) + b'</xliff>'
        with self.assertRaises(ValueError):
            xliff12.parse(huge, project_locales=[self.tr], source_locale=self.en)

    # ── Round 2b: engine-specific formats ────────────────────────────────────

    def test_unity_csv_round_trip(self):
        from api.services.localisation_formats import unity_csv

        raw = unity_csv.export(self.bundle, language='all')
        parsed = unity_csv.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].base_text, 'Health')
        self.assertEqual(by_key['hud.health'].translations['tr']['text'], 'Can')
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')
        self.assertEqual(by_key['hud.health'].namespace, 'hud')

        plural_entry = by_key['hud.enemies']
        self.assertTrue(plural_entry.is_plural)
        self.assertEqual(plural_entry.base_plural['one'], '{0} enemy')
        forms = plural_entry.translations['ru']['plural_forms']
        self.assertEqual(forms['one'], '{0} враг')
        self.assertEqual(forms['few'], '{0} врага')
        self.assertEqual(forms['many'], '{0} врагов')

    def test_unity_csv_single_language_export_still_includes_source_column(self):
        from api.services.localisation_formats import unity_csv

        raw = unity_csv.export(self.bundle, language='tr')
        text = raw.decode('utf-8')
        self.assertIn('English(en)', text)
        self.assertIn('Turkish(tr)', text)
        self.assertNotIn('Russian(ru)', text)

    def test_unity_xliff_round_trip(self):
        from api.services.localisation_formats import unity_xliff

        raw = unity_xliff.export(self.bundle, language='ru')
        # Unity's convention is ONE trans-unit per key even for plural strings — confirm we don't
        # emit the generic xliff12.py `key[category]` split here.
        self.assertEqual(raw.count(b'<trans-unit'), 2)

        parsed = unity_xliff.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')
        forms = by_key['hud.enemies'].translations['ru']['plural_forms']
        self.assertEqual(forms['one'], '{0} враг')
        self.assertEqual(forms['few'], '{0} врага')
        self.assertEqual(forms['many'], '{0} врагов')

    def test_unity_xliff_import_rejects_doctype(self):
        from api.services.localisation_formats import unity_xliff
        malicious = b'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xliff></xliff>'
        with self.assertRaises(ValueError):
            unity_xliff.parse(malicious, project_locales=[self.tr], source_locale=self.en)

    def test_unreal_po_round_trip(self):
        from api.services.localisation_formats import unreal_po

        raw = unreal_po.export(self.bundle, language='ru')
        text = raw.decode('utf-8')
        self.assertIn('msgctxt "hud,hud.enemies"', text)
        # No structural plural fields — Unreal doesn't consume them.
        self.assertNotIn('msgid_plural', text)
        self.assertNotIn('Plural-Forms', text)

        parsed = unreal_po.parse(raw, project_locales=[self.tr, self.ru], source_locale=self.en)
        by_key = {e.key: e for e in parsed.entries}
        self.assertEqual(by_key['hud.health'].namespace, 'hud')
        self.assertEqual(by_key['hud.health'].translations['ru']['text'], 'Здоровье')
        forms = by_key['hud.enemies'].translations['ru']['plural_forms']
        self.assertEqual(forms['one'], '{0} враг')
        self.assertEqual(forms['few'], '{0} врага')
        self.assertEqual(forms['many'], '{0} врагов')

    def test_unreal_po_msgctxt_without_namespace(self):
        from api.services.localisation_formats.canonical import BundleEntry, TranslationBundle, TranslationValue
        from api.services.localisation_formats import unreal_po

        bundle = TranslationBundle(
            project_id=1, project_title='Astro Drift', source=self.en, locales=[self.tr],
            entries=[BundleEntry(key='standaloneKey', namespace='', base_text='Continue',
                                  translations={'tr': TranslationValue(text='Devam Et', status='approved')})],
        )
        raw = unreal_po.export(bundle, language='tr')
        self.assertIn('msgctxt ",standaloneKey"', raw.decode('utf-8'))

        parsed = unreal_po.parse(raw, project_locales=[self.tr], source_locale=self.en)
        entry = parsed.entries[0]
        self.assertEqual(entry.namespace, '')
        self.assertEqual(entry.key, 'standaloneKey')
        self.assertEqual(entry.translations['tr']['text'], 'Devam Et')

    def test_unreal_po_plural_form_with_comma_and_parenthesis_is_escaped(self):
        # Exercises the quoting/escaping path for Unreal's `{Count}|plural(...)` argument list —
        # this is the single most bug-prone converter per the round-2 research.
        from api.services.localisation_formats.canonical import BundleEntry, TranslationBundle, TranslationValue
        from api.services.localisation_formats import unreal_po

        tricky_text = 'Health (low), be careful'
        bundle = TranslationBundle(
            project_id=1, project_title='Astro Drift', source=self.en, locales=[self.tr],
            entries=[BundleEntry(
                key='hud.warning', namespace='hud', base_text=tricky_text, is_plural=True,
                base_plural={'one': tricky_text, 'other': tricky_text},
                translations={'tr': TranslationValue(
                    text=tricky_text, status='approved',
                    plural_forms={'one': tricky_text, 'other': tricky_text},
                )},
            )],
        )
        raw = unreal_po.export(bundle, language='tr')
        parsed = unreal_po.parse(raw, project_locales=[self.tr], source_locale=self.en)
        entry = parsed.entries[0]
        self.assertEqual(entry.base_plural['one'], tricky_text)
        self.assertEqual(entry.translations['tr']['plural_forms']['other'], tricky_text)


class LocalisationExportImportEndpointTests(TestCase):
    def setUp(self):
        from core.models import Project, WorkspaceState

        self.owner = make_user('exportowner')
        self.project = Project.objects.create(owner=self.owner, title='Export Game', description='desc')
        self.board_key = f'workspace__solo_board_project_{self.project.id}'
        self.state = WorkspaceState.objects.create(
            key=self.board_key, user_id=self.owner.id, organisation=None, version=1,
            data={'translationKeys': [{'id': 'k1', 'key': 'menu.play', 'namespace': 'menu', 'baseText': 'Play'}]},
        )
        from core.models import CommunityTranslation
        CommunityTranslation.objects.create(
            project=self.project, key='menu.play', namespace='menu', language='tr',
            author=self.owner, text='Oyna', status='approved',
        )
        self.outsider = make_user('outsider')
        self.client = APIClient()

    def test_anonymous_can_export_approved(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/export/', {'fmt': 'flat_json', 'language': 'tr'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn(b'Oyna', resp.content)

    def test_anonymous_cannot_export_pending(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/export/', {'fmt': 'flat_json', 'language': 'tr', 'scope': 'approved_pending'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_export_pending(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/export/', {'fmt': 'flat_json', 'language': 'tr', 'scope': 'approved_pending'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_export_all_languages_gettext_returns_zip(self):
        resp = self.client.get(f'/api/projects/{self.project.id}/localisation/export/', {'fmt': 'gettext_po', 'language': 'all'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'application/zip')

    def test_import_preview_writes_nothing(self):
        self.client.force_authenticate(user=self.owner)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'preview', 'import_keys': 'true',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['keys_added'], 1)
        self.state.refresh_from_db()
        self.assertEqual(len(self.state.data['translationKeys']), 1)  # unchanged

    def test_import_commit_requires_permission(self):
        self.client.force_authenticate(user=self.outsider)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_keys': 'true',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_import_commit_adds_key(self):
        self.client.force_authenticate(user=self.owner)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_keys': 'true',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data['keys_added'], 1)
        self.state.refresh_from_db()
        self.assertEqual(len(self.state.data['translationKeys']), 2)

    def test_import_commit_twice_by_same_user_updates_not_conflicts(self):
        from core.models import CommunityTranslation
        self.client.force_authenticate(user=self.owner)
        upload1 = SimpleUploadedFile('strings.json', b'{"menu.play": {"en": "Play", "tr": "Oyna Yeni"}}', content_type='application/json')
        resp1 = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload1, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_translations': 'true',
        })
        self.assertEqual(resp1.status_code, status.HTTP_200_OK, resp1.data)
        upload2 = SimpleUploadedFile('strings.json', b'{"menu.play": {"en": "Play", "tr": "Oyna Yeni 2"}}', content_type='application/json')
        resp2 = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload2, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_translations': 'true',
        })
        self.assertEqual(resp2.status_code, status.HTTP_200_OK, resp2.data)
        self.assertEqual(
            CommunityTranslation.objects.filter(project=self.project, key='menu.play', language='tr', author=self.owner).count(),
            1,
        )

    def test_import_stale_base_version_conflicts(self):
        self.client.force_authenticate(user=self.owner)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_keys': 'true',
            'base_version': 999,
        })
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_import_non_numeric_base_version_does_not_500(self):
        # A malformed multipart base_version must degrade to "no check", not crash apply_import.
        self.client.force_authenticate(user=self.owner)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'commit', 'import_keys': 'true',
            'base_version': 'not-a-number',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

    def test_import_with_no_flags_rejected(self):
        self.client.force_authenticate(user=self.owner)
        upload = SimpleUploadedFile('strings.json', b'{"menu.settings": "Settings"}', content_type='application/json')
        resp = self.client.post(f'/api/projects/{self.project.id}/localisation/import/', {
            'file': upload, 'fmt': 'flat_json', 'language': 'tr', 'mode': 'preview',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class GameCatalogueWriteProtectionTests(TestCase):
    """P0: the shared game catalogue is read-only over the API — a signed-in user must not be
    able to edit or (cascade-)delete a Game and take every review/library entry with it."""

    def setUp(self):
        from core.models import Game
        self.user = make_user('gamewriter')
        self.game = Game.objects.create(title='Untouchable')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_cannot_patch_game(self):
        resp = self.client.patch(f'/api/games/{self.game.id}/', {'title': 'Hacked'}, format='json')
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED))
        self.game.refresh_from_db()
        self.assertEqual(self.game.title, 'Untouchable')

    def test_cannot_delete_game(self):
        resp = self.client.delete(f'/api/games/{self.game.id}/')
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED))
        from core.models import Game
        self.assertTrue(Game.objects.filter(id=self.game.id).exists())


class WorkspaceStateToolEnforcementTests(TestCase):
    """P0: a project-board save must carry a `tool` (so the per-tool permission check runs) and
    a dict `data` (so a null payload can't wipe the board), and a view-only member must be 403'd."""

    def setUp(self):
        from core.models import Project, WorkspaceState
        self.owner = make_user('wsowner')
        self.project = Project.objects.create(owner=self.owner, title='WS Game', description='d')
        self.key = f'workspace__solo_board_project_{self.project.id}'
        WorkspaceState.objects.create(key=self.key, user_id=self.owner.id, organisation=None,
                                      version=1, data={'columns': [{'id': 'backlog'}], 'tasks': []})
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_missing_tool_rejected(self):
        resp = self.client.post('/api/workspace-state/', {'key': self.key, 'data': {'tasks': []}}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_dict_data_rejected(self):
        resp = self.client.post('/api/workspace-state/', {'key': self.key, 'data': None, 'tool': 'kanban'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ProjectMemberActiveGateTests(TestCase):
    """P1: an invited-but-unaccepted (status='pending') project admin must not be able to manage
    members."""

    def setUp(self):
        from core.models import Project, ProjectMember
        self.owner = make_user('pmowner')
        self.pending_admin = make_user('pendingadmin')
        self.project = Project.objects.create(owner=self.owner, title='PM Game', description='d')
        ProjectMember.objects.create(project=self.project, user=self.pending_admin, role='admin', status='pending')
        self.target = make_user('pmtarget')
        self.client = APIClient()
        self.client.force_authenticate(user=self.pending_admin)

    def test_pending_admin_cannot_add_member(self):
        from core.models import ProjectMember
        resp = self.client.post('/api/project-members/', {
            'project': self.project.id, 'user_id': self.target.id, 'role': 'editor',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(ProjectMember.objects.filter(project=self.project, user=self.target).exists())


class RegistrationEnumerationTests(TestCase):
    """P2: registering with an already-active email returns the same verification_required
    response as a fresh one (no 'already exists' leak)."""

    def setUp(self):
        # make_user derives email as <username>@example.com.
        self.existing = make_user('takenuser')
        self.client = APIClient()

    def test_existing_email_does_not_leak(self):
        resp = self.client.post('/api/register/', {
            'username': 'brandnew', 'email': 'takenuser@example.com', 'password': 'Str0ngPass!23',
            'real_name': 'New Person',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get('status'), 'verification_required')
