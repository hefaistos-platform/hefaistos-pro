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
