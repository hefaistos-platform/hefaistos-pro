from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('organizations', '0001_initial'),
        ('data_catalog', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AttackDataImportJob',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('version', models.CharField(blank=True, default='', max_length=20)),
                (
                    'status',
                    models.CharField(
                        choices=[('PENDING', 'Pending'), ('RUNNING', 'Running'), ('SUCCESS', 'Success'), ('FAILED', 'Failed')],
                        default='PENDING',
                        max_length=10,
                    ),
                ),
                ('progress_percent', models.PositiveSmallIntegerField(default=0)),
                ('progress_message', models.CharField(blank=True, default='', max_length=255)),
                ('created_count', models.PositiveIntegerField(default=0)),
                ('skipped_count', models.PositiveIntegerField(default=0)),
                ('failed_count', models.PositiveIntegerField(default=0)),
                ('total_candidates', models.PositiveIntegerField(default=0)),
                ('log', models.TextField(blank=True, default='')),
                ('error', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='attack_data_import_jobs',
                        to='organizations.organization',
                    ),
                ),
                (
                    'triggered_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='attack_data_import_jobs',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'ATT&CK Data Import Job',
                'verbose_name_plural': 'ATT&CK Data Import Jobs',
                'ordering': ['-created_at'],
            },
        ),
    ]
