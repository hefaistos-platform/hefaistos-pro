from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ai_assistant', '0016_shared_ai_profiles_and_org_assignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgaisettings',
            name='azure_openai_embedding_deployment',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Azure OpenAI embedding deployment name for RAG',
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name='sharedaiprofile',
            name='azure_openai_embedding_deployment',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
