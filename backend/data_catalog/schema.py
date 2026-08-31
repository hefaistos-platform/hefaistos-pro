import graphene
from graphene_django import DjangoObjectType
from django.db.models import Q
from django.db.models.functions import Lower
from.models import DataSource, DataSourceField, AttackDataImportJob
from identity.decorators import role_required, Roles
from .attack_import import import_attack_data_sources_for_organization


def _is_data_catalog_admin(user) -> bool:
    if user.is_anonymous:
        return False
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    return getattr(user, 'role', None) == Roles.ADMIN


def _ensure_authenticated_user(info):
    user = info.context.user
    if user.is_anonymous:
        raise Exception("Authentication credentials were not provided")
    return user


def _filtered_data_sources(user, search: str | None = None, platform: str | None = None):
    qs = DataSource.objects.filter(organization=user.organization)

    clean_search = (search or "").strip()
    if clean_search:
        qs = qs.filter(
            Q(name__icontains=clean_search)
            | Q(platform__icontains=clean_search)
            | Q(description__icontains=clean_search)
        )

    clean_platform = (platform or "").strip()
    if clean_platform and clean_platform.upper() != "ALL":
        qs = qs.filter(platform__iexact=clean_platform)

    return qs.order_by("name", "id")

class DataSourceFieldType(DjangoObjectType):
    class Meta:
        model = DataSourceField
        fields = "__all__"

class DataSourceType(DjangoObjectType):
    fields = graphene.List(DataSourceFieldType)

    class Meta:
        model = DataSource
        fields = "__all__"

    def resolve_fields(self, info):
        return self.fields.all()


class AttackDataImportJobType(DjangoObjectType):
    duration_seconds = graphene.Float(description="Wall-clock duration in seconds, or null if not finished.")

    class Meta:
        model = AttackDataImportJob
        fields = (
            "id",
            "version",
            "status",
            "progress_percent",
            "progress_message",
            "created_count",
            "skipped_count",
            "failed_count",
            "total_candidates",
            "log",
            "error",
            "created_at",
            "updated_at",
            "started_at",
            "finished_at",
            "triggered_by",
        )

    def resolve_duration_seconds(self, info):
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return None

class Query(graphene.ObjectType):
    all_data_sources = graphene.List(
        DataSourceType,
        limit=graphene.Int(description="Optional max number of rows to return."),
        offset=graphene.Int(default_value=0, description="Optional offset for paging."),
        search=graphene.String(description="Optional free-text filter."),
        platform=graphene.String(description="Optional exact platform filter."),
        description="Retrieves data sources for the user's organization.",
    )
    data_source_count = graphene.Int(
        search=graphene.String(description="Optional free-text filter."),
        platform=graphene.String(description="Optional exact platform filter."),
        description="Returns count of data sources after filters.",
    )
    data_source_platforms = graphene.List(
        graphene.String,
        description="Returns distinct platform names in the user's organization.",
    )
    existing_data_source_names = graphene.List(
        graphene.String,
        names=graphene.List(graphene.NonNull(graphene.String), required=True),
        description="Returns subset of input names that already exist in the Data Catalog.",
    )
    attack_data_import_job = graphene.Field(
        AttackDataImportJobType,
        id=graphene.UUID(required=True),
        description="Get a single ATT&CK data import job by ID.",
    )
    attack_data_import_jobs = graphene.List(
        AttackDataImportJobType,
        limit=graphene.Int(default_value=10),
        description="List recent ATT&CK data import jobs for the current organization.",
    )
    data_source = graphene.Field(DataSourceType, id=graphene.ID(required=True), description="Retrieves a single data source by its ID.")
    search_data_sources = graphene.List(
        DataSourceType,
        query=graphene.String(required=True),
        limit=graphene.Int(default_value=10),
        description="Search data sources by name or platform for autocomplete."
    )

    def resolve_all_data_sources(self, info, limit=None, offset=0, search=None, platform=None):
        user = _ensure_authenticated_user(info)
        qs = _filtered_data_sources(user, search=search, platform=platform)

        safe_offset = max(offset or 0, 0)
        if safe_offset:
            qs = qs[safe_offset:]

        if limit is not None:
            safe_limit = max(min(limit, 500), 0)
            qs = qs[:safe_limit]

        return qs

    def resolve_data_source_count(self, info, search=None, platform=None):
        user = _ensure_authenticated_user(info)
        return _filtered_data_sources(user, search=search, platform=platform).count()

    def resolve_data_source_platforms(self, info):
        user = _ensure_authenticated_user(info)
        return list(
            DataSource.objects.filter(
                organization=user.organization,
                platform__isnull=False,
            )
            .exclude(platform="")
            .values_list("platform", flat=True)
            .distinct()
            .order_by("platform")
        )

    def resolve_existing_data_source_names(self, info, names):
        user = _ensure_authenticated_user(info)

        cleaned = [value for value in {str(n or "").strip() for n in names} if value]
        if not cleaned:
            return []

        lowered = {name.lower() for name in cleaned}
        return list(
            DataSource.objects.filter(organization=user.organization)
            .annotate(name_lc=Lower("name"))
            .filter(name_lc__in=lowered)
            .values_list("name", flat=True)
        )

    def resolve_attack_data_import_job(self, info, id):
        user = _ensure_authenticated_user(info)
        if not _is_data_catalog_admin(user):
            raise Exception("Permission denied")
        return AttackDataImportJob.objects.filter(id=id, organization=user.organization).first()

    def resolve_attack_data_import_jobs(self, info, limit=10):
        user = _ensure_authenticated_user(info)
        if not _is_data_catalog_admin(user):
            raise Exception("Permission denied")
        safe_limit = max(min(limit or 10, 50), 1)
        return AttackDataImportJob.objects.filter(organization=user.organization)[:safe_limit]

    def resolve_data_source(self, info, id):
        user = _ensure_authenticated_user(info)

        # Security Check: Filter by both ID and the user's organization
        return DataSource.objects.filter(pk=id, organization=user.organization).first()

    def resolve_search_data_sources(self, info, query, limit=10):
        user = _ensure_authenticated_user(info)

        # Search by name or platform (case-insensitive)
        qs = DataSource.objects.filter(
            organization=user.organization
        ).filter(
            Q(name__icontains=query) | Q(platform__icontains=query) | Q(description__icontains=query)
        )[:limit]
        
        return qs

class CreateDataSource(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        platform = graphene.String()
        description = graphene.String()

    data_source = graphene.Field(DataSourceType)

    class Meta:
        description = "Creates a new data source for the user's organization."

    @staticmethod
    @role_required([Roles.ADMIN, Roles.ANALYST, Roles.REVIEWER, Roles.VIEWER])
    def mutate(root, info, name, **kwargs):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        data_source = DataSource(name=name, organization=user.organization, **kwargs)
        data_source.save()
        return CreateDataSource(data_source=data_source)

class AddDataSourceField(graphene.Mutation):
    class Arguments:
        data_source_id = graphene.ID(required=True)
        field_name = graphene.String(required=True)
        data_type = graphene.String()
        description = graphene.String()
        example_value = graphene.String()

    data_source_field = graphene.Field(DataSourceFieldType)

    class Meta:
        description = "Adds a new field to an existing data source. The data source must belong to the user's organization."

    @staticmethod
    def mutate(root, info, data_source_id, field_name, **kwargs):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        # Security Check: Ensure the parent data source belongs to the user's org
        try:
            data_source = DataSource.objects.get(pk=data_source_id, organization=user.organization)
        except DataSource.DoesNotExist:
            raise Exception("Data source not found or you do not have permission")

        field = DataSourceField(data_source=data_source, field_name=field_name, **kwargs)
        field.save()
        return AddDataSourceField(data_source_field=field)

# --- New mutation classes for updating/deleting data sources and fields ---
class UpdateDataSource(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        name = graphene.String()
        platform = graphene.String()
        description = graphene.String()

    data_source = graphene.Field(DataSourceType)

    @staticmethod
    def mutate(root, info, id, **kwargs):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        try:
            data_source = DataSource.objects.get(pk=id, organization=user.organization)
        except DataSource.DoesNotExist:
            raise Exception("Data source not found or you do not have permission")

        for field, value in kwargs.items():
            setattr(data_source, field, value)

        data_source.save()
        return UpdateDataSource(data_source=data_source)


class DeleteDataSource(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    @staticmethod
    def mutate(root, info, id):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        try:
            data_source = DataSource.objects.get(pk=id, organization=user.organization)
        except DataSource.DoesNotExist:
            raise Exception("Data source not found or you do not have permission")

        data_source.delete()
        return DeleteDataSource(ok=True)


class UpdateDataSourceField(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        field_name = graphene.String()
        data_type = graphene.String()
        description = graphene.String()
        example_value = graphene.String()

    data_source_field = graphene.Field(DataSourceFieldType)

    @staticmethod
    def mutate(root, info, id, **kwargs):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        try:
            # Security Check: Ensure the field belongs to a data source in the user's org
            field = DataSourceField.objects.get(pk=id, data_source__organization=user.organization)
        except DataSourceField.DoesNotExist:
            raise Exception("Field not found or you do not have permission")

        for field_name, value in kwargs.items():
            setattr(field, field_name, value)

        field.save()
        return UpdateDataSourceField(data_source_field=field)


class DeleteDataSourceField(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    ok = graphene.Boolean()

    @staticmethod
    def mutate(root, info, id):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        try:
            field = DataSourceField.objects.get(pk=id, data_source__organization=user.organization)
        except DataSourceField.DoesNotExist:
            raise Exception("Field not found or you do not have permission")

        field.delete()
        return DeleteDataSourceField(ok=True)


class ImportAttackDataSources(graphene.Mutation):
    class Arguments:
        version = graphene.String(required=False, description="Optional ATT&CK version, e.g. '19.1'")

    created_count = graphene.Int()
    skipped_count = graphene.Int()
    failed_count = graphene.Int()
    total_candidates = graphene.Int()
    version = graphene.String()

    class Meta:
        description = (
            "Admin-only bulk import of ATT&CK data components into the organization's Data Catalog."
        )

    @staticmethod
    @role_required([Roles.ADMIN])
    def mutate(root, info, version=None):
        user = _ensure_authenticated_user(info)

        result = import_attack_data_sources_for_organization(
            organization=user.organization,
            version=version,
        )
        return ImportAttackDataSources(**result)


class RunAttackDataImport(graphene.Mutation):
    class Arguments:
        version = graphene.String(required=False, description="Optional ATT&CK version, e.g. '19.1'")

    job = graphene.Field(AttackDataImportJobType)

    class Meta:
        description = "Admin-only async ATT&CK import job for Data Catalog."

    @staticmethod
    @role_required([Roles.ADMIN])
    def mutate(root, info, version=None):
        from .tasks import run_attack_data_import_job

        user = _ensure_authenticated_user(info)
        if not _is_data_catalog_admin(user):
            raise Exception("Permission denied")

        running_job = AttackDataImportJob.objects.filter(
            organization=user.organization,
            status__in=[AttackDataImportJob.Status.PENDING, AttackDataImportJob.Status.RUNNING],
        ).first()
        if running_job:
            raise Exception("An ATT&CK import job is already running for your organization.")

        normalized_version = str(version or '').lstrip('v').strip()[:20]
        job = AttackDataImportJob.objects.create(
            organization=user.organization,
            version=normalized_version,
            status=AttackDataImportJob.Status.PENDING,
            progress_percent=0,
            progress_message='Queued',
            triggered_by=user,
            log='Job queued.',
        )
        run_attack_data_import_job(str(job.id))
        return RunAttackDataImport(job=job)

class Mutation(graphene.ObjectType):
    create_data_source = CreateDataSource.Field()
    add_data_source_field = AddDataSourceField.Field()
    update_data_source = UpdateDataSource.Field()
    delete_data_source = DeleteDataSource.Field()
    update_data_source_field = UpdateDataSourceField.Field()
    delete_data_source_field = DeleteDataSourceField.Field()
    import_attack_data_sources = ImportAttackDataSources.Field()
    run_attack_data_import = RunAttackDataImport.Field()
