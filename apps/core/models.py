from django.db import models


class PlatformConfig(models.Model):
    """Singleton model for global platform settings."""
    
    fee_type = models.CharField(max_length=20, choices=(('PERCENTAGE', 'Percentage'), ('FLAT', 'Flat Fee')), default='PERCENTAGE')
    fee_value = models.DecimalField(max_digits=5, decimal_places=2, default=10.00, help_text="e.g., 10.00 for 10% or $10")
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Platform Configuration'
        verbose_name_plural = 'Platform Configurations'

    def save(self, *args, **kwargs):
        # Ensure only one instance exists
        if not self.pk and PlatformConfig.objects.exists():
            return
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        config, created = cls.objects.get_or_create(id=1)
        return config

    def __str__(self):
        return f"Platform Fee: {self.fee_value} ({self.fee_type})"