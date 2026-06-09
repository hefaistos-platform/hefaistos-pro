import uuid
from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from cryptography.fernet import Fernet, InvalidToken

MISP_INSTANCE_LIMIT = 5

# ---------------------------------------------------------------------------
# Field-level encryption helpers (same pattern as rules/models.py)
# ---------------------------------------------------------------------------
try:
    _FERNET = Fernet(settings.FIELD_ENCRYPTION_KEY)
except Exception:
    _FERNET = None


def _encrypt(text: str) -> str | None:
    if not _FERNET or not text:
        return None
    return _FERNET.encrypt(text.encode()).decode()


def _decrypt(encrypted_text: str) -> str | None:
    if not _FERNET or not encrypted_text:
        return None
    try:
        return _FERNET.decrypt(encrypted_text.encode()).decode()
    except InvalidToken:
        return None


class Entity(models.Model):
    """Top-level holding company / MSSP that owns organizations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Entities"

    def __str__(self):
        return self.name


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Link to parent Entity (nullable so existing orgs are valid)
    entity = models.ForeignKey(
        Entity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organizations",
    )

    def __str__(self):
        return self.name


class MISPInstance(models.Model):
    """A MISP instance configured for an organization (max 5 per org)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="misp_instances",
    )
    name = models.CharField(max_length=255)
    url = models.CharField(max_length=512)
    auth_key = models.TextField()
    verify_ssl = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        unique_together = [("organization", "name")]

    def __str__(self):
        return f"{self.name} ({self.organization.name})"


class PlatformCredential(models.Model):
    """Encrypted API credentials for a SIEM/EDR deployment platform."""

    PLATFORM_CHOICES = [
        ('defender', 'Microsoft Defender'),
        ('sentinel', 'Azure Sentinel'),
        ('splunk', 'Splunk'),
        ('qradar', 'IBM QRadar'),
        ('wazuh', 'Wazuh'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='platform_credentials',
    )
    platform = models.CharField(max_length=50, choices=PLATFORM_CHOICES)
    # Credential fields – all stored encrypted
    _credentials_json = models.TextField(
        db_column='credentials_json',
        help_text='Encrypted JSON blob of platform credentials (do not access directly)',
        blank=True,
        default='',
    )
    enabled = models.BooleanField(default=True)

    # Connection test metadata
    last_tested = models.DateTimeField(null=True, blank=True)
    test_status = models.BooleanField(null=True, blank=True)
    test_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_platform_credentials',
    )

    class Meta:
        unique_together = [('organization', 'platform')]
        verbose_name = "Platform Credential"
        verbose_name_plural = "Platform Credentials"
        ordering = ['platform']

    def __str__(self):
        return f"{self.get_platform_display()} credentials ({self.organization.name})"

    @property
    def credentials(self) -> dict:
        """Return decrypted credentials dict."""
        raw = _decrypt(self._credentials_json)
        if not raw:
            return {}
        import json
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {}

    @credentials.setter
    def credentials(self, value: dict) -> None:
        """Encrypt and store the credentials dict."""
        import json
        self._credentials_json = _encrypt(json.dumps(value)) or ''

    def set_credentials(self, credentials_dict: dict) -> None:
        """Encrypt and store credentials dict (alias for property setter)."""
        self.credentials = credentials_dict

    def get_credentials(self) -> dict:
        """Decrypt and return credentials dict (alias for property getter)."""
        return self.credentials

    def test_connection(self) -> tuple[bool, str]:
        """
        Test platform connectivity using stored credentials.

        Returns:
            (success: bool, message: str)
        """
        import logging
        from django.utils import timezone
        from rules.deployers import PLATFORM_DEPLOYER_MAP

        logger = logging.getLogger(__name__)

        try:
            creds = self.get_credentials()
            if not creds:
                return False, "No credentials configured"

            deployer_class = PLATFORM_DEPLOYER_MAP.get(self.platform)
            if not deployer_class:
                return False, f"Unknown platform: {self.platform}"

            deployer = deployer_class(creds)
            valid, error = deployer.validate_credentials()
            if not valid:
                success, msg = False, f"Credential validation failed: {error}"
            else:
                try:
                    authenticated = deployer.authenticate()
                    success = bool(authenticated)
                    msg = "Connection successful" if success else "Authentication failed"
                except Exception as exc:
                    success, msg = False, str(exc)

            self.last_tested = timezone.now()
            self.test_status = success
            self.test_message = msg
            self.save(update_fields=['last_tested', 'test_status', 'test_message'])

            return success, msg

        except Exception as exc:
            logger.error("Connection test failed for %s: %s", self.platform, exc)
            return False, str(exc)


class SmtpSettings(models.Model):
    """Singleton SMTP settings used by email service (overrides Mailgun when configured)."""

    class Encryption(models.TextChoices):
        NONE = 'NONE', 'None'
        SSL = 'SSL', 'SSL'
        STARTTLS = 'STARTTLS', 'STARTTLS'

    class LoginMethod(models.TextChoices):
        PLAIN = 'PLAIN', 'PLAIN'
        LOGIN = 'LOGIN', 'LOGIN'

    singleton_key = models.CharField(max_length=32, unique=True, default='default')
    smtp_server = models.CharField(max_length=255)
    smtp_port = models.PositiveIntegerField(default=587)
    encryption = models.CharField(max_length=16, choices=Encryption.choices, default=Encryption.STARTTLS)
    login_method = models.CharField(max_length=16, choices=LoginMethod.choices, default=LoginMethod.PLAIN)
    smtp_username = models.CharField(max_length=255, blank=True, default='')
    _smtp_password = models.TextField(
        db_column='smtp_password',
        help_text='Encrypted SMTP password (do not access directly)',
        blank=True,
        default='',
    )
    from_email = models.EmailField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'SMTP Settings'
        verbose_name_plural = 'SMTP Settings'

    def __str__(self):
        return f"SMTP({self.smtp_server}:{self.smtp_port}, {self.encryption}, {self.login_method})"

    @property
    def smtp_password(self) -> str:
        return _decrypt(self._smtp_password) or ''

    @smtp_password.setter
    def smtp_password(self, value: str) -> None:
        self._smtp_password = _encrypt(value or '') or ''

    @property
    def has_password(self) -> bool:
        return bool(self._smtp_password)

    def clean(self):
        errors = {}

        if not (self.smtp_server or '').strip():
            errors['smtp_server'] = 'This field cannot be blank.'

        if not (1 <= int(self.smtp_port or 0) <= 65535):
            errors['smtp_port'] = 'Port must be between 1 and 65535.'

        if self.login_method == self.LoginMethod.LOGIN:
            if not (self.smtp_username or '').strip():
                errors['smtp_username'] = 'Username is required when login method is LOGIN.'
            if not self.has_password:
                errors['smtp_password'] = 'Password is required when login method is LOGIN.'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class OrganizationAITaskConfig(models.Model):
    """Per-organization configuration for scheduled AI-assisted operational tasks."""

    class Schedule(models.TextChoices):
        DAILY = 'DAILY', 'Daily'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'

    class LastStatus(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        SKIPPED = 'SKIPPED', 'Skipped'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='ai_task_configs',
    )
    task_key = models.CharField(max_length=64)
    enabled = models.BooleanField(default=False)

    schedule = models.CharField(
        max_length=16,
        choices=Schedule.choices,
        default=Schedule.WEEKLY,
    )
    day_of_week = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(6)],
        help_text='For WEEKLY schedules: 0=Monday ... 6=Sunday.',
    )
    day_of_month = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
        help_text='For MONTHLY schedules: day 1-28.',
    )
    run_hour = models.PositiveSmallIntegerField(
        default=8,
        validators=[MinValueValidator(0), MaxValueValidator(23)],
    )
    run_minute = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(59)],
    )

    next_run_at = models.DateTimeField(null=True, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(
        max_length=16,
        choices=LastStatus.choices,
        blank=True,
        null=True,
    )
    last_message = models.TextField(blank=True, default='')

    updated_by = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_org_ai_task_configs',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['task_key']
        unique_together = [('organization', 'task_key')]
        verbose_name = 'Organization AI Task Configuration'
        verbose_name_plural = 'Organization AI Task Configurations'

    def __str__(self):
        return f'AITaskConfig({self.organization.name}, {self.task_key}, enabled={self.enabled})'


class OrganizationAITaskRun(models.Model):
    """Execution log for organization AI-assisted operational tasks."""

    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        SKIPPED = 'SKIPPED', 'Skipped'

    class Trigger(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        MANUAL = 'MANUAL', 'Manual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='ai_task_runs',
    )
    task_config = models.ForeignKey(
        OrganizationAITaskConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='runs',
    )
    task_key = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices)
    trigger = models.CharField(
        max_length=16,
        choices=Trigger.choices,
        default=Trigger.SCHEDULED,
    )

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)

    run_by = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='org_ai_task_runs',
    )

    output_summary = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['organization', 'task_key']),
            models.Index(fields=['organization', 'started_at']),
        ]
        verbose_name = 'Organization AI Task Run'
        verbose_name_plural = 'Organization AI Task Runs'

    def __str__(self):
        return f'AITaskRun({self.organization.name}, {self.task_key}, {self.status})'


class OpenTidePublishProfile(models.Model):
    """Reusable HEF publish configuration linking a repository to deployment targets."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='opentide_publish_profiles',
    )
    repository = models.ForeignKey(
        'rules.RuleRepository',
        on_delete=models.CASCADE,
        related_name='opentide_publish_profiles',
    )
    name = models.CharField(max_length=100)
    branch = models.CharField(max_length=255, default='main')
    target_folder = models.CharField(max_length=255, blank=True, default='')
    push_platform_rules = models.BooleanField(
        default=False,
        help_text='When enabled, also push individual platform rule files (kql/, splunk/, sigma/, etc.) alongside the OpenTide bundle.',
    )
    enabled_platforms = models.JSONField(
        default=list,
        blank=True,
        help_text='Default deployment platforms for HEF publish jobs.',
    )
    use_graph_configured_platforms = models.BooleanField(
        default=True,
        help_text='Use workbench configured_platforms when no explicit platforms are set on the profile.',
    )
    enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_opentide_publish_profiles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = [('organization', 'name')]
        verbose_name = 'OpenTIDE HEF Publish Profile'
        verbose_name_plural = 'OpenTIDE HEF Publish Profiles'

    def __str__(self):
        return f'{self.name} ({self.organization.name})'


class DacDeploymentConfig(models.Model):
    """Organisation-level automation settings for DEPLOYED workbench transitions."""

    class Mode(models.TextChoices):
        NONE = 'NONE', 'Do nothing'
        GIT_PUSH = 'GIT_PUSH', 'Generate and push to GitHub'
        GIT_PUSH_AND_DEPLOY = 'GIT_PUSH_AND_DEPLOY', 'Generate, push, and deploy'
        DEPLOY_ONLY = 'DEPLOY_ONLY', 'Just push rule to target platform'

    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name='dac_deployment_config',
    )
    mode = models.CharField(max_length=32, choices=Mode.choices, default=Mode.NONE)
    target_repository = models.ForeignKey(
        'rules.RuleRepository',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dac_deployment_configs',
    )
    target_branch = models.CharField(max_length=255, default='main')
    target_folder = models.CharField(max_length=255, blank=True, default='')
    target_platforms = models.JSONField(default=list, blank=True)
    publish_profile = models.ForeignKey(
        OpenTidePublishProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dac_deployment_configs',
    )
    updated_by = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_dac_deployment_configs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'DaC Deployment Configuration'
        verbose_name_plural = 'DaC Deployment Configurations'

    def __str__(self):
        return f'DaCConfig({self.organization.name}, mode={self.mode})'


class OpenTideHefPublishJob(models.Model):
    """Tracks asynchronous OpenTIDE HEF publish jobs processed via RabbitMQ."""

    STATUS_CHOICES = [
        ('QUEUED', 'Queued'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    SOURCE_CHOICES = [
        ('MANUAL', 'Manual'),
        ('DAC_AUTOMATION', 'DaC Automation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    playbook = models.ForeignKey(
        'playbooks.PlaybookGraph',
        on_delete=models.CASCADE,
        related_name='hef_publish_jobs',
    )
    user = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='opentide_hef_publish_jobs',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='hef_publish_jobs',
    )
    profile = models.ForeignKey(
        OpenTidePublishProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='publish_jobs',
    )
    repository = models.ForeignKey(
        'rules.RuleRepository',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hef_publish_jobs',
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    source_graph_version = models.IntegerField(null=True, blank=True)
    source_graph_minor_version = models.IntegerField(null=True, blank=True)
    rule = models.ForeignKey(
        'rules.DetectionRule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hef_publish_jobs',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='QUEUED')
    progress = models.TextField(blank=True, default='')
    commit_message = models.TextField(blank=True, default='')
    branch = models.CharField(max_length=255, default='main')
    target_folder = models.CharField(max_length=255, blank=True, default='')
    push_opentide_bundle = models.BooleanField(default=True)
    push_platform_rules = models.BooleanField(default=False)
    requested_platforms = models.JSONField(default=list, blank=True)
    deployed_platforms = models.JSONField(default=list, blank=True)
    deployment_results = models.JSONField(default=list, blank=True)
    commit_sha = models.CharField(max_length=40, blank=True, default='')
    github_url = models.CharField(max_length=1024, blank=True, default='')
    file_paths = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'OpenTIDE HEF Publish Job'
        verbose_name_plural = 'OpenTIDE HEF Publish Jobs'

    def __str__(self):
        return f'HEFPublishJob({self.id}) [{self.status}] – {self.playbook}'


class OpenTideHefImportJob(models.Model):
    """Tracks asynchronous OpenTIDE HEF import jobs processed via RabbitMQ."""

    STATUS_CHOICES = [
        ('QUEUED', 'Queued'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    CONFLICT_MODE_CHOICES = [
        ('NEW_COPY', 'Create new copy'),
        ('OVERWRITE', 'Overwrite existing by MDR UUID'),
        ('SKIP', 'Skip if UUID already exists'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'identity.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='opentide_hef_import_jobs',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='hef_import_jobs',
    )
    profile = models.ForeignKey(
        OpenTidePublishProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='import_jobs',
    )
    # Manual source (when no profile is selected)
    repo_owner = models.CharField(max_length=255, blank=True, default='')
    repo_name = models.CharField(max_length=255, blank=True, default='')
    branch = models.CharField(max_length=255, default='main')
    target_folder = models.CharField(max_length=255, blank=True, default='')
    source_commit_sha = models.CharField(max_length=40, blank=True, default='')

    # Job parameters
    selected_bundles = models.JSONField(
        default=list,
        blank=True,
        help_text='List of bundle paths selected for import',
    )
    conflict_mode = models.CharField(
        max_length=20,
        choices=CONFLICT_MODE_CHOICES,
        default='NEW_COPY',
    )
    import_platform_rules = models.BooleanField(default=True)
    dry_run = models.BooleanField(default=False)

    # Job state
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='QUEUED')
    progress = models.TextField(blank=True, default='')
    results = models.JSONField(
        default=list,
        blank=True,
        help_text='Per-bundle import results [{bundle_path, workbench_id, status, errors}]',
    )
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'OpenTIDE HEF Import Job'
        verbose_name_plural = 'OpenTIDE HEF Import Jobs'

    def __str__(self):
        return f'HEFImportJob({self.id}) [{self.status}]'
