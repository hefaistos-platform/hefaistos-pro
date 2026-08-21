from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('waiting_room', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='waitingcase',
            name='api_source',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
        migrations.AddField(
            model_name='waitingcase',
            name='api_external_id',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddConstraint(
            model_name='waitingcase',
            constraint=models.UniqueConstraint(
                condition=models.Q(api_source__gt='', api_external_id__gt=''),
                fields=['organization', 'api_source', 'api_external_id'],
                name='waiting_case_api_source_external_id_unique',
            ),
        ),
    ]
