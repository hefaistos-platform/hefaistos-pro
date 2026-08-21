"""
REST API views for the Waiting Room module.
Provides an ingest endpoint for external integrations like KQL Striker.
"""
import logging

from django.db import transaction, IntegrityError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from identity.authentication import PersonalTokenAuthentication
from identity.models import PersonalAPIToken

logger = logging.getLogger(__name__)

SEVERITY_CHOICES = ['low', 'medium', 'high', 'critical']
MAX_ARTIFACTS = 50
MAX_DESCRIPTION_LEN = 10000
MAX_TITLE_LEN = 255
MAX_SOURCE_LEN = 128
MAX_EXTERNAL_ID_LEN = 255


class ArtifactSerializer(serializers.Serializer):
    type = serializers.CharField(max_length=64)
    value = serializers.CharField(max_length=1024)


class WaitingRoomIngestSerializer(serializers.Serializer):
    source = serializers.CharField(max_length=MAX_SOURCE_LEN)
    external_id = serializers.CharField(max_length=MAX_EXTERNAL_ID_LEN)
    title = serializers.CharField(max_length=MAX_TITLE_LEN)
    severity = serializers.ChoiceField(choices=SEVERITY_CHOICES, default='medium')
    description = serializers.CharField(max_length=MAX_DESCRIPTION_LEN)
    artifacts = ArtifactSerializer(many=True, required=False, default=list)
    raw_output = serializers.JSONField(required=False, default=dict)
    detected_at = serializers.DateTimeField(required=False, allow_null=True, default=None)


class HasTokenScope(IsAuthenticated):
    """
    Extends IsAuthenticated: if the request was authenticated via a
    PersonalAPIToken, also verifies the required scope.

    JWT-authenticated users (i.e. regular logged-in users accessing the API
    directly or via the frontend) always pass scope enforcement because they
    are already authorised to interact with the Waiting Room through the normal
    application flow.  Scope checks apply exclusively to personal API tokens
    issued to external integrations.
    """
    required_scope = 'waiting_room:create'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        token = request.auth
        if isinstance(token, PersonalAPIToken):
            return token.has_scope(self.required_scope)
        # JWT-authenticated users (normal session) are trusted without scope.
        return True


class WaitingRoomIngestView(APIView):
    """
    POST /api/waiting-room/cases

    Create a new case in the Waiting Room from an external system.
    Requires authentication (****** or ****** personal token with
    waiting_room:create scope).

    Idempotent: repeated requests with the same (source, external_id) for the
    same organisation return the existing case rather than creating a duplicate.
    """
    authentication_classes = [PersonalTokenAuthentication]
    permission_classes = [HasTokenScope]

    def post(self, request):
        from waiting_room.models import WaitingCase
        from organizations.models import Organization

        serializer = WaitingRoomIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = request.user

        if not user.organization:
            return Response(
                {'detail': 'Your account is not associated with an organization.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        source = data['source']
        external_id = data['external_id']
        title = data['title']
        severity = data.get('severity', 'medium')
        description = data.get('description', '')
        artifacts = data.get('artifacts', [])
        raw_output = data.get('raw_output', {})
        detected_at = data.get('detected_at')

        raw_payload = {
            'severity': severity,
            'description': description,
            'artifacts': list(artifacts),
            'raw_output': raw_output,
        }
        if detected_at:
            raw_payload['detected_at'] = detected_at.isoformat()

        try:
            with transaction.atomic():
                case = WaitingCase.objects.create(
                    organization=user.organization,
                    created_by=user,
                    source_type=WaitingCase.SourceType.API,
                    api_source=source,
                    api_external_id=external_id,
                    title=title,
                    short_description=description[:400],
                    raw_payload=raw_payload,
                    status=WaitingCase.LifecycleStatus.NEW,
                )
            created = True
        except IntegrityError:
            # Idempotency: return existing case
            try:
                case = WaitingCase.objects.get(
                    organization=user.organization,
                    api_source=source,
                    api_external_id=external_id,
                )
                created = False
            except WaitingCase.DoesNotExist:
                return Response(
                    {'detail': 'Duplicate request; could not retrieve existing case.'},
                    status=status.HTTP_409_CONFLICT,
                )

        logger.info(
            "WaitingRoom API ingest: case=%s source=%s external_id=%s user=%s created=%s",
            case.id, source, external_id, user.username, created,
        )

        return Response(
            {
                'case_id': str(case.id),
                'status': 'created' if created else 'existing',
                'waiting_room': True,
                'url': f'/waiting-room/{case.id}',
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
