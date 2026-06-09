import graphene
from graphene_django import DjangoObjectType
from.models import DataSource, DataSourceField
from identity.decorators import role_required, Roles

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

class Query(graphene.ObjectType):
    all_data_sources = graphene.List(DataSourceType, description="Retrieves all data sources for the user's organization.")
    data_source = graphene.Field(DataSourceType, id=graphene.ID(required=True), description="Retrieves a single data source by its ID.")
    search_data_sources = graphene.List(
        DataSourceType,
        query=graphene.String(required=True),
        limit=graphene.Int(default_value=10),
        description="Search data sources by name or platform for autocomplete."
    )

    def resolve_all_data_sources(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")
        return DataSource.objects.filter(organization=user.organization)

    def resolve_data_source(self, info, id):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        # Security Check: Filter by both ID and the user's organization
        return DataSource.objects.filter(pk=id, organization=user.organization).first()

    def resolve_search_data_sources(self, info, query, limit=10):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")
        
        from django.db.models import Q
        
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

class Mutation(graphene.ObjectType):
    create_data_source = CreateDataSource.Field()
    add_data_source_field = AddDataSourceField.Field()
    update_data_source = UpdateDataSource.Field()
    delete_data_source = DeleteDataSource.Field()
    update_data_source_field = UpdateDataSourceField.Field()
    delete_data_source_field = DeleteDataSourceField.Field()
