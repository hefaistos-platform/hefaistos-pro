from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rules", "0022_alter_detectionrule_format_add_eql"),
    ]

    operations = [
        migrations.AddField(
            model_name="rulerepository",
            name="rag_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Enable RAG dataset sync for this repository",
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_dataset_path",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Path or glob pattern for JSONL/KQL files in the repo "
                    "(e.g. rules/*.jsonl or detections/kql)"
                ),
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_branch",
            field=models.CharField(
                blank=True,
                help_text="Branch to sync RAG dataset from (defaults to repo default branch)",
                max_length=200,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_schedule",
            field=models.CharField(
                choices=[
                    ("DISABLED", "Disabled"),
                    ("24H", "Every 24 hours"),
                    ("48H", "Every 48 hours"),
                    ("72H", "Every 72 hours"),
                    ("WEEKLY", "Weekly"),
                ],
                default="DISABLED",
                help_text="Schedule for automatic RAG dataset synchronisation",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_last_sync_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Timestamp of the last RAG sync attempt",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_last_sync_status",
            field=models.CharField(
                blank=True,
                help_text="Status of the last RAG sync: ok | error | pending",
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_last_sync_error",
            field=models.TextField(
                blank=True,
                help_text="Error message from the last failed RAG sync",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_next_scheduled_sync",
            field=models.DateTimeField(
                blank=True,
                help_text="When the next scheduled RAG sync should occur",
                null=True,
            ),
        ),
    ]
