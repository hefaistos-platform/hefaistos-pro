from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken
from django.utils import timezone
from datetime import timedelta
import hashlib
import secrets
from organizations.models import Organization


def _get_fernet():
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if not key:
        return None
    try:
        return Fernet(key)
    except Exception:
        return None


def _encrypt(value: str) -> str:
    value = value or ''
    if not value:
        return ''
    if value.startswith('enc:'):
        return value
    f = _get_fernet()
    if not f:
        return value
    return 'enc:' + f.encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    value = value or ''
    if not value:
        return ''
    if not value.startswith('enc:'):
        return value
    token = value[4:]
    f = _get_fernet()
    if not f:
        return ''
    try:
        return f.decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        return ''


class CustomUser(AbstractUser):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    # --- ADD THIS ---
    class Roles(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        ANALYST = 'ANALYST', 'Analyst'
        REVIEWER = 'REVIEWER', 'Reviewer'
        VIEWER = 'VIEWER', 'Viewer'

    role = models.CharField(
        max_length=10,
        choices=Roles.choices,
        default=Roles.ANALYST, # Default new users to 'Analyst'
        help_text="The user's role, which determines their permissions."
    )
    # --- END ADD ---

    # --- PROFILE FIELDS (Phase: User Profiles) ---
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        help_text="Optional profile avatar image (requires Pillow)."
    )
    bio = models.TextField(
        max_length=500,
        blank=True,
        help_text="Short 'About Me' summary."
    )
    job_title = models.CharField(
        max_length=100,
        blank=True,
        help_text="e.g. Senior Threat Hunter"
    )
    slack_handle = models.CharField(
        max_length=50,
        blank=True,
        help_text="Slack username or handle (e.g. @hunter01)"
    )
    # --- END PROFILE FIELDS ---

    # --- EMAIL NOTIFICATION PREFERENCES ---
    email_notify_review_approved = models.BooleanField(
        default=False,
        help_text="Email me when my review is approved"
    )
    email_notify_system_message = models.BooleanField(
        default=False,
        help_text="Email me when there is a new system message"
    )
    email_notify_chat_message = models.BooleanField(
        default=False,
        help_text="Email me when I have a new chat message"
    )
    email_notify_workbench_edited = models.BooleanField(
        default=False,
        help_text="Email me when someone edits my workbench"
    )
    email_notify_news_digest = models.BooleanField(
        default=False,
        help_text="Email me when there is a news digest"
    )

    def __str__(self):
        return self.username


class PasswordResetToken(models.Model):
    """One-time token for password reset. Expires after 1 hour."""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_expired(self):
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(hours=1)

    def __str__(self):
        return f"PasswordResetToken({self.user.username}, used={self.used})"


class UserAiCredential(models.Model):
    class Provider(models.TextChoices):
        GEMINI = 'gemini', 'Google Gemini'
        OPENAI = 'openai', 'OpenAI GPT'
        ANTHROPIC = 'anthropic', 'Anthropic Claude'

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ai_credentials')
    provider = models.CharField(max_length=32, choices=Provider.choices)
    # Store encrypted value; encryption handled in code path, not DB
    encrypted_key = models.TextField()
    key_fingerprint = models.CharField(max_length=64, help_text='SHA-256 hex of the raw key for auditing', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'provider')

    def __str__(self):
        return f"{self.user.username}:{self.provider}"


class UserMfaSettings(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='mfa_settings')
    totp_enabled = models.BooleanField(default=False)
    totp_secret_encrypted = models.TextField(blank=True, default='')
    pending_totp_secret_encrypted = models.TextField(blank=True, default='')
    backup_codes_hashes = models.JSONField(default=list, blank=True)
    backup_codes_generated_at = models.DateTimeField(null=True, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def totp_secret(self) -> str:
        return _decrypt(self.totp_secret_encrypted)

    @totp_secret.setter
    def totp_secret(self, value: str):
        self.totp_secret_encrypted = _encrypt(value)

    @property
    def pending_totp_secret(self) -> str:
        return _decrypt(self.pending_totp_secret_encrypted)

    @pending_totp_secret.setter
    def pending_totp_secret(self, value: str):
        self.pending_totp_secret_encrypted = _encrypt(value)

    def lock_for_minutes(self, minutes: int = 15):
        self.locked_until = timezone.now() + timedelta(minutes=minutes)

    def is_locked(self) -> bool:
        return bool(self.locked_until and timezone.now() < self.locked_until)

    def hash_backup_code(self, code: str) -> str:
        return hashlib.sha256((code or '').strip().encode('utf-8')).hexdigest()

    def verify_and_consume_backup_code(self, code: str) -> bool:
        normalized = (code or '').strip()
        if not normalized:
            return False
        hashed = self.hash_backup_code(normalized)
        if hashed in self.backup_codes_hashes:
            codes = list(self.backup_codes_hashes or [])
            codes.remove(hashed)
            self.backup_codes_hashes = codes
            return True
        return False

    def __str__(self):
        return f"MFA({self.user.username}, enabled={self.totp_enabled})"


def _default_mfa_challenge_id():
    return secrets.token_urlsafe(24)


class MfaLoginChallenge(models.Model):
    challenge_id = models.CharField(max_length=64, unique=True, default=_default_mfa_challenge_id)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='mfa_login_challenges')
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    failed_attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create_for_user(cls, user, minutes_valid: int = 5):
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(minutes=minutes_valid),
        )

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"MFAChallenge({self.user.username}, used={self.used})"


class MfaAuditEvent(models.Model):
    class Event(models.TextChoices):
        TOTP_ENROLL_STARTED = 'TOTP_ENROLL_STARTED', 'TOTP enroll started'
        TOTP_ENROLL_CONFIRMED = 'TOTP_ENROLL_CONFIRMED', 'TOTP enroll confirmed'
        TOTP_DISABLED = 'TOTP_DISABLED', 'TOTP disabled'
        BACKUP_CODES_REGENERATED = 'BACKUP_CODES_REGENERATED', 'Backup codes regenerated'
        LOGIN_CHALLENGE_CREATED = 'LOGIN_CHALLENGE_CREATED', 'MFA login challenge created'
        LOGIN_SUCCESS = 'LOGIN_SUCCESS', 'MFA login success'
        LOGIN_FAILED = 'LOGIN_FAILED', 'MFA login failed'
        LOGIN_LOCKED = 'LOGIN_LOCKED', 'MFA locked'
        ADMIN_RESET = 'ADMIN_RESET', 'Admin reset MFA'

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='mfa_audit_events')
    event = models.CharField(max_length=64, choices=Event.choices)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"MfaAuditEvent({self.user.username}, {self.event})"


class WebAuthnCredential(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='webauthn_credentials')
    name = models.CharField(max_length=128, blank=True, default='')
    credential_id = models.TextField(unique=True)
    public_key = models.TextField()
    sign_count = models.PositiveIntegerField(default=0)
    transports = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"WebAuthnCredential({self.user.username}, {self.name or 'security-key'})"


class WebAuthnChallenge(models.Model):
    class ChallengeType(models.TextChoices):
        REGISTRATION = 'REGISTRATION', 'Registration'
        AUTHENTICATION = 'AUTHENTICATION', 'Authentication'
        PASSWORDLESS = 'PASSWORDLESS', 'Passwordless'

    challenge_id = models.CharField(max_length=64, unique=True, default=_default_mfa_challenge_id)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='webauthn_challenges', null=True, blank=True)
    username = models.CharField(max_length=150, blank=True, default='')
    challenge_type = models.CharField(max_length=16, choices=ChallengeType.choices)
    challenge = models.TextField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def create_challenge(cls, challenge_type: str, challenge: str, user=None, username: str = '', minutes_valid: int = 5):
        return cls.objects.create(
            challenge_type=challenge_type,
            challenge=challenge,
            user=user,
            username=username or '',
            expires_at=timezone.now() + timedelta(minutes=minutes_valid),
        )

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"WebAuthnChallenge({self.challenge_type}, used={self.used})"
