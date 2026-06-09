from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserMfaSettings, MfaAuditEvent, WebAuthnCredential, WebAuthnChallenge

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'organization', 'role', 'is_staff') # <-- Add 'role'

    # Add 'role' to the fieldset
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        # --- ADD THIS SECTION ---
        ('Organization', {'fields': ('organization', 'role')}),
        # --- END ADD ---
    )


@admin.register(UserMfaSettings)
class UserMfaSettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'totp_enabled', 'backup_codes_count', 'failed_attempts', 'locked_until', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at', 'backup_codes_generated_at')

    def backup_codes_count(self, obj):
        return len(obj.backup_codes_hashes or [])


@admin.register(MfaAuditEvent)
class MfaAuditEventAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'created_at')
    search_fields = ('user__username', 'event')
    readonly_fields = ('user', 'event', 'details', 'created_at')


@admin.register(WebAuthnCredential)
class WebAuthnCredentialAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'created_at', 'last_used_at')
    search_fields = ('user__username', 'name')


@admin.register(WebAuthnChallenge)
class WebAuthnChallengeAdmin(admin.ModelAdmin):
    list_display = ('challenge_type', 'user', 'username', 'used', 'expires_at', 'created_at')
    search_fields = ('user__username', 'username', 'challenge_type')
