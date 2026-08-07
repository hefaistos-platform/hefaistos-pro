from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rules", "0023_rulerepository_add_rag_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="rulerepository",
            name="rag_last_sync_upserted",
            field=models.IntegerField(
                blank=True,
                help_text="Number of vectors successfully upserted in the last RAG sync",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="rulerepository",
            name="rag_last_sync_skipped",
            field=models.IntegerField(
                blank=True,
                help_text="Number of entries skipped (embed/upsert failure) in the last RAG sync",
                null=True,
            ),
        ),
    ]
