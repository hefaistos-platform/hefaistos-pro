from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from organizations.models import Organization
from unittest.mock import MagicMock, patch
import pyotp

from identity.models import AccountSetupToken, UserMfaSettings
from identity.schema import InviteUser, PrepareAccountActivation, CompleteAccountActivation, StartMfaLogin
from identity.decorators import role_required, Roles

User = get_user_model()


def _make_info(user):
    """Build a minimal GraphQL info mock with the given user on its context."""
    info = MagicMock()
    info.context.user = user
    return info


def _dummy_func(*args, **kwargs):
    return "ok"


class CustomUserModelTests(TestCase):

    def setUp(self):
        """
        Set up a test organization to be used by all tests.
        """
        self.organization = Organization.objects.create(name="Test Organization")

    def test_create_user(self):
        """
        Tests that a user can be created and linked to an organization.
        """
        user = User.objects.create_user(
            username="testuser",
            email="normal@user.com",
            password="foo",
            organization=self.organization
        )
        self.assertEqual(user.email, "normal@user.com")
        self.assertEqual(user.organization.name, "Test Organization")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)


class RoleRequiredDecoratorTests(TestCase):
    """Tests for the role_required decorator — org-scoped admin vs platform admins."""

    def setUp(self):
        self.org = Organization.objects.create(name="Decorator Test Org")

    def _make_user(self, role=Roles.VIEWER, is_superuser=False, is_staff=False, username="tester"):
        user = User(username=username, role=role, is_superuser=is_superuser, is_staff=is_staff, organization=self.org)
        user.is_anonymous = False
        return user

    def test_admin_role_allowed(self):
        """A user with ADMIN role passes the org-scoped check."""
        user = self._make_user(role=Roles.ADMIN)
        info = _make_info(user)
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        result = wrapped(info)
        self.assertEqual(result, "ok")

    def test_non_admin_role_denied(self):
        """A user with VIEWER role is denied access to an ADMIN-only mutation."""
        user = self._make_user(role=Roles.VIEWER)
        info = _make_info(user)
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        with self.assertRaises(PermissionDenied):
            wrapped(info)

    def test_bot_auditor_denied_even_if_role_allowed(self):
        """Bot auditor roles are hard read-only and denied from role-gated writes."""
        user = self._make_user(role=Roles.BOT_AUDITOR_ORG)
        info = _make_info(user)
        wrapped = role_required([Roles.BOT_AUDITOR_ORG, Roles.ADMIN])(_dummy_func)
        with self.assertRaises(PermissionDenied):
            wrapped(info)

    def test_bot_auditor_allowed_for_query_operation(self):
        """Bot auditor roles can call role-gated QUERY resolvers (read-only visibility)."""
        user = self._make_user(role=Roles.BOT_AUDITOR_ORG)
        info = _make_info(user)
        info.operation = MagicMock()
        info.operation.operation = "query"
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        self.assertEqual(wrapped(info), "ok")

    def test_superuser_bypasses_role_check(self):
        """A superuser (platform admin) bypasses org-scoped role checks regardless of their role field."""
        user = self._make_user(role=Roles.VIEWER, is_superuser=True)
        info = _make_info(user)
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        result = wrapped(info)
        self.assertEqual(result, "ok")

    def test_staff_bypasses_role_check(self):
        """A staff member (platform admin) bypasses org-scoped role checks regardless of their role field."""
        user = self._make_user(role=Roles.ANALYST, is_staff=True)
        info = _make_info(user)
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        result = wrapped(info)
        self.assertEqual(result, "ok")

    def test_anonymous_user_denied(self):
        """Anonymous users are always denied."""
        anon = MagicMock()
        anon.is_anonymous = True
        info = _make_info(anon)
        wrapped = role_required([Roles.ADMIN])(_dummy_func)
        with self.assertRaises(PermissionDenied):
            wrapped(info)


class AccountSetupFlowTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Activation Org")
        self.admin = User.objects.create_user(
            username="orgadmin",
            email="admin@example.com",
            password="AdminPass123!",
            role=Roles.ADMIN,
            organization=self.org,
        )

    def _make_info(self, user=None):
        info = MagicMock()
        if user is not None:
            info.context.user = user
        info.context.META = {"REMOTE_ADDR": "127.0.0.1"}
        return info

    @patch("identity.schema.emit_security_event")
    @patch("core.email_service.get_email_service")
    def test_invite_user_creates_unusable_password_and_setup_token(self, mock_get_email_service, _mock_emit):
        service = MagicMock()
        service.is_configured.return_value = False
        mock_get_email_service.return_value = service

        info = self._make_info(self.admin)
        result = InviteUser.mutate(
            None,
            info,
            username="newuser",
            email="newuser@example.com",
            role=Roles.ANALYST,
        )

        created = User.objects.get(username="newuser")
        self.assertFalse(created.has_usable_password())
        self.assertEqual(AccountSetupToken.objects.filter(user=created, used=False).count(), 1)
        self.assertIsNotNone(result.setup_link)
        self.assertIn("activate-account?token=", result.setup_link)

    @patch("identity.schema.emit_security_event")
    def test_admin_activation_requires_totp_and_enables_mfa(self, _mock_emit):
        invited = User.objects.create_user(
            username="newadmin",
            email="newadmin@example.com",
            role=Roles.ADMIN,
            organization=self.org,
        )
        invited.set_unusable_password()
        invited.save(update_fields=["password"])

        _token_obj, raw_token = AccountSetupToken.issue_for_user(user=invited, created_by=self.admin, hours_valid=24)

        public_info = self._make_info()
        prepared = PrepareAccountActivation.mutate(None, public_info, token=raw_token)
        self.assertTrue(prepared.requires_mfa)
        self.assertTrue(prepared.totp_secret)
        otp = pyotp.TOTP(prepared.totp_secret).now()

        completed = CompleteAccountActivation.mutate(
            None,
            public_info,
            token=raw_token,
            new_password="NewAdminPass123!",
            otp_code=otp,
        )
        self.assertTrue(completed.ok)
        self.assertGreater(len(completed.backup_codes), 0)

        invited.refresh_from_db()
        self.assertTrue(invited.check_password("NewAdminPass123!"))

        mfa_settings = UserMfaSettings.objects.get(user=invited)
        self.assertTrue(mfa_settings.totp_enabled)
        self.assertTrue(bool(mfa_settings.totp_secret))
        self.assertEqual(AccountSetupToken.objects.filter(user=invited, used=False).count(), 0)


class OrganizationUserLimitEnforcementTests(TestCase):
    def setUp(self):
        self.full_org = Organization.objects.create(name="Full Org", max_users=2)
        self.source_org = Organization.objects.create(name="Source Org", max_users=10)

        # Fill full_org to capacity
        self.resident = User.objects.create_user(
            username="resident",
            email="resident@example.com",
            password="ResidentPass123!",
            role=Roles.ANALYST,
            organization=self.full_org,
        )

        self.org_admin = User.objects.create_user(
            username="orgadmin_limit",
            email="orgadmin_limit@example.com",
            password="AdminPass123!",
            role=Roles.ADMIN,
            organization=self.full_org,
        )
        self.super_admin = User.objects.create_superuser(
            username="superadmin_limit",
            email="superadmin_limit@example.com",
            password="SuperPass123!",
        )
        self.movable_user = User.objects.create_user(
            username="movable_user",
            email="movable@example.com",
            password="MovePass123!",
            role=Roles.ANALYST,
            organization=self.source_org,
        )

    def test_invite_user_blocked_when_org_is_at_capacity(self):
        info = _make_info(self.org_admin)
        with self.assertRaises(Exception) as ctx:
            InviteUser.mutate(
                None,
                info,
                username="new_limited_user",
                email="new_limited_user@example.com",
                role=Roles.ANALYST,
            )
        self.assertIn("maximum user limit", str(ctx.exception))
        self.assertFalse(User.objects.filter(username="new_limited_user").exists())

    def test_admin_update_user_blocks_move_into_full_org(self):
        info = _make_info(self.super_admin)
        from identity.schema import Mutation as IdentityMutation
        root = IdentityMutation()

        with self.assertRaises(Exception) as ctx:
            root.resolve_admin_update_user(
                info,
                user_id=self.movable_user.id,
                organization_id=self.full_org.id,
            )

        self.assertIn("maximum user limit", str(ctx.exception))
        self.movable_user.refresh_from_db()
        self.assertEqual(self.movable_user.organization_id, self.source_org.id)


class BotMfaBypassLoginTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Bot MFA Org")
        self.bot_org = User.objects.create_user(
            username="bot_org_user",
            email="bot_org@example.com",
            password="BotPass123!",
            role=Roles.BOT_AUDITOR_ORG,
            organization=self.org,
        )
        self.bot_global = User.objects.create_user(
            username="bot_global_user",
            email="bot_global@example.com",
            password="BotPass123!",
            role=Roles.BOT_AUDITOR_GLOBAL,
            organization=self.org,
        )

        # Even if MFA is configured, BOT users must not be challenged.
        org_settings, _ = UserMfaSettings.objects.get_or_create(user=self.bot_org)
        org_settings.totp_enabled = True
        org_settings.totp_secret = pyotp.random_base32()
        org_settings.save()

        global_settings, _ = UserMfaSettings.objects.get_or_create(user=self.bot_global)
        global_settings.totp_enabled = True
        global_settings.totp_secret = pyotp.random_base32()
        global_settings.save()

    def _make_login_info(self):
        info = MagicMock()
        info.context = MagicMock()
        info.context.META = {"REMOTE_ADDR": "127.0.0.1"}
        return info

    @patch("identity.schema.emit_security_event")
    def test_org_bot_bypasses_mfa_challenge(self, _mock_emit):
        result = StartMfaLogin.mutate(
            None,
            self._make_login_info(),
            username="bot_org_user",
            password="BotPass123!",
        )
        self.assertFalse(result.mfa_required)
        self.assertIsNone(result.challenge_id)
        self.assertTrue(bool(result.token))

    @patch("identity.schema.emit_security_event")
    def test_global_bot_bypasses_mfa_challenge(self, _mock_emit):
        result = StartMfaLogin.mutate(
            None,
            self._make_login_info(),
            username="bot_global_user",
            password="BotPass123!",
        )
        self.assertFalse(result.mfa_required)
        self.assertIsNone(result.challenge_id)
        self.assertTrue(bool(result.token))
