from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from organizations.models import Organization
from unittest.mock import MagicMock
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
