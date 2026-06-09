import os
from typing import List

from django.utils.html import escape


def get_login_url() -> str:
    """Return the configured frontend login URL."""
    try:
        from django.conf import settings
        base = getattr(settings, 'FRONTEND_URL', None) or os.environ.get('FRONTEND_URL', 'https://hefaistos.org')
    except Exception:
        base = os.environ.get('FRONTEND_URL', 'https://hefaistos.org')
    return base.rstrip('/') + '/login'


def login_link_text() -> str:
    """Return a plain-text login footer line."""
    return f"Login to HEFAISTOS platform: {get_login_url()}"


def login_link_html() -> str:
    """Return an HTML login footer line."""
    url = get_login_url()
    return (
        f'<p style="margin-top:16px">Login to HEFAISTOS platform: '
        f'<a href="{url}" style="color:#2563eb;text-decoration:underline">{url}</a></p>'
    )


def render_news_item_html(title: str, content_md: str, category_label: str, priority: str, author_username: str, published_at_iso: str) -> str:
    # Minimal HTML (no markdown conversion to avoid new deps); escape and wrap
    content_html = "<p>{}</p>".format(escape(content_md).replace('\n', '<br/>'))
    return f"""
    <div style="border:1px solid #eaeaea;border-radius:8px;padding:16px;margin-bottom:12px;font-family:Arial,sans-serif">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:18px">{escape(category_label)}</span>
        <strong style="font-size:16px">{escape(title or 'News Update')}</strong>
        <span style="font-size:12px;color:#555">Priority: {escape(priority)}</span>
      </div>
      {content_html}
      <div style="font-size:12px;color:#777;margin-top:8px">By {escape(author_username)} • {escape(published_at_iso)}</div>
    </div>
    """.strip()


def render_digest_html(items: List[str]) -> str:
    items_html = "\n".join(items)
    login_url = get_login_url()
    return f"""
    <html>
    <body style="background:#f6f8fb;padding:24px">
      <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06);padding:24px">
        <h2 style="font-family:Arial,sans-serif;color:#1f2937;margin-top:0">Hefaistos News Digest</h2>
        {items_html}
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
        <p style="font-size:13px;font-family:Arial,sans-serif">Login to HEFAISTOS platform: <a href="{login_url}" style="color:#2563eb;text-decoration:underline">{login_url}</a></p>
        <div style="font-size:12px;color:#777">You are receiving this because you have an account on Hefaistos.</div>
      </div>
    </body>
    </html>
    """.strip()


def render_simple_text(subject: str, lines: List[str]) -> str:
    return f"{subject}\n\n" + "\n".join(lines) + f"\n\n{login_link_text()}"
