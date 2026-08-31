import uuid

from django.conf import settings
from django.db import models
from organizations.models import Organization

class DataSource(models.Model):
    name = models.CharField(max_length=255)
    platform = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., Windows, Linux, AWS")
    description = models.TextField(blank=True, null=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="data_sources"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensures that a data source name is unique within an organization
        unique_together = ('name', 'organization')

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class DataSourceField(models.Model):
    data_source = models.ForeignKey(DataSource, on_delete=models.CASCADE, related_name='fields')
    field_name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=50, blank=True, null=True, help_text="e.g., string, integer, timestamp")
    description = models.TextField(blank=True, null=True)
    example_value = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        # Ensures that a field name is unique for a given data source
        unique_together = ('data_source', 'field_name')

    def __str__(self):
        return f"{self.data_source.name}.{self.field_name}"


class AttackDataImportJob(models.Model):
    """
    Tracks async ATT&CK → Data Catalog import runs per organization.
    """

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='attack_data_import_jobs',
    )
    version = models.CharField(max_length=20, blank=True, default='')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    progress_message = models.CharField(max_length=255, blank=True, default='')

    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    total_candidates = models.PositiveIntegerField(default=0)

    log = models.TextField(blank=True, default='')
    error = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='attack_data_import_jobs',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'ATT&CK Data Import Job'
        verbose_name_plural = 'ATT&CK Data Import Jobs'

    def __str__(self):
        suffix = self.version or 'auto'
        return f"AttackDataImportJob v{suffix} [{self.status}] @ {self.created_at}"
