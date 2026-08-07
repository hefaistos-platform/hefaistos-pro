from django.test import TestCase

from organizations.models import SharedSmtpProfile, get_default_shared_smtp_profile


class TestDefaultSharedSmtpProfile(TestCase):
    def _mk(self, name: str) -> SharedSmtpProfile:
        return SharedSmtpProfile.objects.create(
            name=name,
            smtp_server='smtp.example.com',
            smtp_port=587,
            encryption=SharedSmtpProfile.Encryption.STARTTLS,
            login_method=SharedSmtpProfile.LoginMethod.PLAIN,
            is_active=True,
        )

    def test_prefers_system_shared_name(self):
        self._mk('Backup Shared SMTP')
        expected = self._mk('System Shared SMTP')

        resolved = get_default_shared_smtp_profile()

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.pk, expected.pk)

    def test_falls_back_to_legacy_default_shared_name(self):
        self._mk('Shared SMTP A')
        expected = self._mk('Default Shared SMTP')

        resolved = get_default_shared_smtp_profile()

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.pk, expected.pk)

    def test_returns_latest_active_when_no_named_default(self):
        older = self._mk('Shared SMTP A')
        newer = self._mk('Shared SMTP B')

        resolved = get_default_shared_smtp_profile()

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.pk, newer.pk)
        self.assertNotEqual(resolved.pk, older.pk)

