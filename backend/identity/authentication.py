"""
DRF authentication backend for personal API tokens.

Tokens use the format: hfst_<64 hex chars>
They are authenticated via SHA-256 hash lookup and active-status check.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from identity.models import PersonalAPIToken, TOKEN_PREFIX


class PersonalTokenAuthentication(BaseAuthentication):
    """
    Authenticate requests that carry a ``Authorization: ****** header.
    Falls through (returns None) for tokens that don't start with the expected prefix,
    allowing JWTAuthentication to handle normal JWT tokens.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        raw_token = auth_header[7:].strip()
        if not raw_token.startswith(TOKEN_PREFIX):
            return None  # Let JWTAuthentication handle JWT tokens

        token = PersonalAPIToken.authenticate(raw_token)
        if token is None:
            raise AuthenticationFailed('Invalid, expired, or revoked API token.')

        return (token.user, token)

    def authenticate_header(self, request):
        return '******"hefaistos-api-token"'
