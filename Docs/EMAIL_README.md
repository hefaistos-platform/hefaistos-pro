# HEFAISTOS Email Notification System

This document describes how email notifications are implemented in the HEFAISTOS platform, including configuration, user preferences, and all available notification types.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Mailgun Configuration](#mailgun-configuration)
3. [User Email Preferences](#user-email-preferences)
4. [Email Notification Types](#email-notification-types)
5. [Testing Emails](#testing-emails)
6. [Customizing Email URLs](#customizing-email-urls)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

HEFAISTOS uses **Mailgun** as its email delivery service. The implementation uses Mailgun's HTTP API (more reliable than SMTP) through a singleton service class.

### Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| `MailgunEmailService` | `backend/core/email_service.py` | Core email service class |
| `get_email_service()` | `backend/core/email_service.py` | Singleton accessor function |
| Email Templates | `backend/core/email_templates.py` | HTML/text template helpers |
| User Preferences | `backend/identity/models.py` | `email_notify_*` boolean fields |

### Email Flow

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  GraphQL        │     │  MailgunEmailService │     │  Mailgun API    │
│  Mutation       │────▶│  .send_message()     │────▶│  (EU Region)    │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────────┐
│  Check user     │     │  is_configured()     │
│  preferences    │     │  validation          │
└─────────────────┘     └──────────────────────┘
```

---

## Mailgun Configuration

### Required Configuration

The email service requires three configuration values, provided via Docker secrets or environment variables:

| Secret/Env Var | Docker Secret Path | Description |
|----------------|-------------------|-------------|
| `MAILGUN_API_KEY` | `/run/secrets/mailgun_api` | Mailgun API key (starts with `key-`) |
| `MAILGUN_DOMAIN` | N/A (env only) | Your Mailgun domain (e.g., `mg.hefaistos.org`) |
| `MAILGUN_FROM_EMAIL` | N/A (env only) | Sender address (e.g., `automaton@hefaistos.org`) |

### Optional Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `MAILGUN_API_BASE` | `https://api.eu.mailgun.net` | API endpoint (EU or US region) |

### Docker Compose Setup

```yaml
services:
  backend:
    environment:
      - MAILGUN_DOMAIN=mg.yourdomain.com
      - MAILGUN_FROM_EMAIL=notifications@yourdomain.com
      - MAILGUN_API_BASE=https://api.eu.mailgun.net  # Use https://api.mailgun.net for US
    secrets:
      - mailgun_api

secrets:
  mailgun_api:
    file: ./.secrets/mailgun_api
```

### Service Initialization

The email service uses lazy initialization with a singleton pattern:

```python
from core.email_service import get_email_service

service = get_email_service()

# Always check if configured before sending
if service.is_configured():
    service.send_message(
        to=["user@example.com"],
        subject="Hello",
        text="Plain text body",
        html="<h1>HTML body</h1>"
    )
```

---

## User Email Preferences

Users can control their email notification preferences from the **Profile** page under **"Email Notifications"** section.

### Available Preferences

| Setting | Model Field | Default | Description |
|---------|-------------|---------|-------------|
| **Review Approved** | `email_notify_review_approved` | `True` | Email when my review is approved |
| **System Messages** | `email_notify_system_message` | `False` | Email for new system messages/announcements |
| **Chat Messages** | `email_notify_chat_message` | `False` | Email when I receive a chat message |
| **Workbench Edits** | `email_notify_workbench_edited` | `True` | Email when someone edits my workbench |

### How Preferences Are Enforced

Before sending any notification email, the system checks the user's preference:

```python
# Example: Workbench edit notification
if getattr(user, 'email_notify_workbench_edited', False) and user.email:
    service = get_email_service()
    if service.is_configured():
        service.send_message(...)
```

### GraphQL Schema

User preferences are exposed via the `UpdateProfile` mutation:

```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    user {
      emailNotifyReviewApproved
      emailNotifySystemMessage
      emailNotifyChatMessage
      emailNotifyWorkbenchEdited
    }
  }
}
```

---

## Email Notification Types

### 1. User Management Emails

These emails are **always sent** (not subject to preferences) as they are security/account related.

| Event | Subject | Trigger | Location |
|-------|---------|---------|----------|
| **User Invitation** | `🎉 Welcome to {org} - Your HEFAISTOS Account` | Admin invites new user | `identity/schema.py` → `InviteUser` |
| **Password Changed** | `🔐 Password Changed - HEFAISTOS` | User changes password | `identity/schema.py` → `ChangePassword` |
| **Profile Updated by Admin** | `👤 Your HEFAISTOS Profile Was Updated` | Admin modifies user profile | `identity/schema.py` → `admin_update_user` |

---

### 2. News & Announcements

| Event | Subject | Trigger | Preference |
|-------|---------|---------|------------|
| **News Published** | `{emoji} [{category}] {title}` | Admin publishes news | `email_notify_system_message` |
| **News Digest** | `Hefaistos News Digest ({date})` | Scheduled command | N/A (batch job) |

**Category Emojis:**
- 🔄 UPDATE
- ⚠️ OUTAGE
- 🚀 FEATURE
- 🔧 MAINTENANCE
- 📢 ANNOUNCEMENT
- 🔒 SECURITY

**Location:** `news/schema.py` → `PublishNewsPost`, `news/management/commands/send_news_digest.py`

---

### 3. Review Workflow Emails

| Event | Subject | Trigger | Preference |
|-------|---------|---------|------------|
| **Review Approved** | `✅ Your Review Was Approved - HEFAISTOS` | Reviewer approves review request | `email_notify_review_approved` |

**Location:** `review/schema.py` → `ApproveReview`

---

### 4. Workbench Emails

All workbench emails respect the `email_notify_workbench_edited` preference and are only sent when someone **other than the author** makes changes.

| Event | Subject | Trigger | Location |
|-------|---------|---------|----------|
| **Status Changed** | `📊 Workbench Status Changed - {title}` | Status updated by another user | `playbooks/schema.py` → `UpdatePlaybookGraphStatus` |
| **Owner Status Changed** | `📊 Workbench Status Changed - {title}` | Owner updates their own status | `playbooks/schema.py` → `UpdateOwnPlaybookGraphStatus` |
| **Workbench Renamed** | `✏️ Workbench Renamed - {title}` | Title changed | `playbooks/schema.py` → `UpdatePlaybookGraphTitle` |
| **Metadata Updated** | `📝 Workbench Metadata Updated - {title}` | Description/tags modified | `playbooks/schema.py` → `UpdatePlaybookGraphMetadata` |

---

### 5. Generic Notification Emails

The `CreateNotification` mutation can trigger emails based on content type:

| Content Type | Subject | Preference |
|--------------|---------|------------|
| `reviewrequest` | `✅ Your Review Was Approved - HEFAISTOS` | `email_notify_review_approved` |
| `system` | `📢 New System Message - HEFAISTOS` | `email_notify_system_message` |
| `chat` | `💬 New Chat Message from {user} - HEFAISTOS` | `email_notify_chat_message` |
| `playbookgraph` | `📝 Workbench Updated - HEFAISTOS` | `email_notify_workbench_edited` |

**Location:** `notifications/schema.py` → `CreateNotification`

---

## Email Format

All emails include both **HTML** and **plain text** versions for maximum compatibility.

### Example Email Structure

```python
service.send_message(
    to=[user.email],
    subject='✅ Your Review Was Approved - HEFAISTOS',
    text="""Hello {username},

Your review request has been approved.

Workbench: {title}
Approved by: {approver}

Best regards,
The HEFAISTOS Team""",
    html="""<html><body>
<h2>✅ Review Approved</h2>
<p>Hello <strong>{username}</strong>,</p>
<p>Your review request has been approved.</p>
<ul>
<li><strong>Workbench:</strong> {title}</li>
<li><strong>Approved by:</strong> {approver}</li>
</ul>
<p>Best regards,<br/>The HEFAISTOS Team</p>
</body></html>"""
)
```

---

## Testing Emails

### Using the Test Command

```bash
# Check configuration only
docker compose exec backend python manage.py test_email --check-only

# Send a test email
docker compose exec backend python manage.py test_email --to your@email.com

# Send news digest (dry run)
docker compose exec backend python manage.py send_news_digest --dry-run
```

### Expected Output

```
[OK] MAILGUN_API_KEY: key-abc1...xyz9
[OK] MAILGUN_DOMAIN: mg.hefaistos.org
[OK] MAILGUN_FROM_EMAIL: automaton@hefaistos.org
[OK] MAILGUN_API_BASE: https://api.eu.mailgun.net
Email service is fully configured!
```

---

## Customizing Email URLs

Email templates use the `FRONTEND_URL` environment variable to generate login links. Set it in `.env` to match your installation domain:

```bash
# In .env
FRONTEND_URL=https://your-domain.com
```

The install script sets this automatically from the `SERVER_DOMAIN` you provide. If you change it later, update `.env` and restart the backend:

```bash
docker compose restart backend
```

If `FRONTEND_URL` is not set, it defaults to `https://localhost:8443`.

The URL is used in the following email templates:
- Password reset emails
- Account activation emails
- Review request notifications

**Important:** The URL should include the protocol (`https://` or `http://`) and should NOT end with a trailing slash.

---

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid API key | Verify `MAILGUN_API_KEY` or `/run/secrets/mailgun_api` |
| `403 Forbidden` | Domain not authorized | Verify domain in Mailgun dashboard, check DNS records |
| `404 Not Found` | Wrong domain | Check `MAILGUN_DOMAIN` matches your Mailgun account |
| `Service not configured` | Missing secrets | Ensure all three config values are set |

### Checking Logs

```bash
# View email-related logs
docker compose logs backend | grep -i mailgun

# View detailed email service logs
docker compose logs backend | grep -i "email"
```

### Verifying DNS Records

For custom domains, ensure these DNS records are configured:
- **SPF** record for sending authorization
- **DKIM** records for email signing
- **MX** records if receiving email

Check your Mailgun dashboard → Domain settings → DNS Records for exact values.

---

## API Reference

### `MailgunEmailService`

```python
class MailgunEmailService:
    def is_configured(self) -> bool:
        """Check if the service has valid configuration."""
        
    def send_message(
        self,
        to: List[str],           # Recipient email addresses
        subject: str,            # Email subject line
        text: Optional[str],     # Plain text body
        html: Optional[str],     # HTML body
        headers: Optional[Dict]  # Additional headers
    ) -> bool:
        """Send an email. Returns True on success."""
        
    def verify_recipient(self, email: str) -> bool:
        """Verify recipient for sandbox domains."""
```

### `get_email_service()`

```python
from core.email_service import get_email_service

service = get_email_service()  # Returns singleton instance
```

---

## Summary Table

| Email Type | Always Sent | User Preference | Location |
|------------|-------------|-----------------|----------|
| User Invitation | ✅ | - | `identity/schema.py` |
| Password Changed | ✅ | - | `identity/schema.py` |
| Profile Updated | ✅ | - | `identity/schema.py` |
| News Published | ❌ | `email_notify_system_message` | `news/schema.py` |
| Review Approved | ❌ | `email_notify_review_approved` | `review/schema.py` |
| Chat Message | ❌ | `email_notify_chat_message` | `notifications/schema.py` |
| Workbench Edit | ❌ | `email_notify_workbench_edited` | `playbooks/schema.py` |

---

*Last updated: January 2, 2026*
