"""Helpers for GitHub-based OpenTIDE publishing."""

import re



def sanitize_filename(title: str) -> str:
    """
    Convert a detection rule title to a safe filename.

    Converts to lowercase, replaces spaces and special characters with underscores,
    strips leading/trailing underscores, and truncates to 80 characters.
    """
    name = title.lower()
    name = re.sub(r'[^a-z0-9]+', '_', name)
    name = name.strip('_')
    return name[:80] or 'detection_rule'
