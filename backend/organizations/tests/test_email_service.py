from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from core.email_service import SMTPEmailService


class TestSMTPEmailServiceConnect(SimpleTestCase):
    def _make_service(self, *, login_method: str, username: str, password: str) -> SMTPEmailService:
        service = SMTPEmailService.__new__(SMTPEmailService)
        service.smtp_server = 'smtp.example.com'
        service.smtp_port = 587
        service.encryption = 'NONE'
        service.login_method = login_method
        service.smtp_username = username
        service.smtp_password = password
        return service

    @patch('core.email_service.smtplib.SMTP')
    def test_connect_authenticates_for_plain_when_credentials_present(self, mock_smtp):
        mock_server = MagicMock()
        mock_smtp.return_value = mock_server
        service = self._make_service(
            login_method='PLAIN',
            username='mailer@example.com',
            password='super-secret',
        )

        service._connect()

        mock_server.login.assert_called_once_with('mailer@example.com', 'super-secret')

    @patch('core.email_service.smtplib.SMTP')
    def test_connect_skips_auth_when_username_missing(self, mock_smtp):
        mock_server = MagicMock()
        mock_smtp.return_value = mock_server
        service = self._make_service(
            login_method='PLAIN',
            username='',
            password='super-secret',
        )

        service._connect()

        mock_server.login.assert_not_called()

