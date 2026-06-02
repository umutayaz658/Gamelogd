# Generated manually to drop unused platform_tag column from core_post table

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_bookmark'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE core_post DROP COLUMN IF EXISTS platform_tag;",
            reverse_sql=""
        )
    ]
