from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity', '0018_customuser_workbench_visibility_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='authprovidersettings',
            name='oidc_verify_ssl',
            field=models.BooleanField(
                default=True,
                help_text='Verify TLS certificates for OIDC provider endpoints. Disable only for trusted self-signed endpoints.',
            ),
        ),
    ]

