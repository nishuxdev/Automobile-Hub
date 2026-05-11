from django.db import models
from django.conf import settings


class Bike(models.Model):
    """A customer's registered bike with identifying details."""

    FUEL_CHOICES = (
        ('PETROL', 'Petrol'),
        ('DIESEL', 'Diesel'),
        ('ELECTRIC', 'Electric'),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bikes',
        limit_choices_to={'role': 'customer'},
    )

    # Identity
    nickname = models.CharField(max_length=100, blank=True, default='',
                                help_text='A friendly name, e.g. "My Daily Ride"')
    brand = models.CharField(max_length=100, help_text='e.g. Honda, Yamaha, Royal Enfield')
    model = models.CharField(max_length=100, help_text='e.g. Activa 6G, R15 V4')
    year = models.PositiveIntegerField(null=True, blank=True, help_text='Manufacturing year')
    registration_no = models.CharField(max_length=30, blank=True, default='',
                                       help_text='e.g. KA-01-AB-1234')
    color = models.CharField(max_length=50, blank=True, default='')
    engine_cc = models.PositiveIntegerField(null=True, blank=True, help_text='Engine displacement in cc')
    fuel_type = models.CharField(max_length=10, choices=FUEL_CHOICES, default='PETROL')
    photo = models.ImageField(upload_to='bikes/', blank=True, null=True)
    notes = models.TextField(blank=True, default='', help_text='Private notes for the owner')

    is_active = models.BooleanField(default=True, help_text='Soft-delete flag')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        label = self.nickname or f"{self.brand} {self.model}"
        return f"{label} ({self.owner.name})"

    @property
    def display_name(self):
        """Short display name for dropdowns."""
        parts = [self.brand, self.model]
        if self.registration_no:
            parts.append(f"({self.registration_no})")
        return ' '.join(parts)
