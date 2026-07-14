from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_alter_message_created_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='pendingregistration',
            name='failed_attempts',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
