import graphene
from graphene_django import DjangoObjectType
from .models import LogSource, LogField
from platform_data.models import MitreDataComponent

class LogSourceType(DjangoObjectType):
    class Meta:
        model = LogSource
        fields = "__all__"

class CreateLogSource(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        mitre_component_id = graphene.String() # STIX ID or DB ID
        mitre_log_provider = graphene.String()
        mitre_channel = graphene.String()
        index_pattern = graphene.String()

    log_source = graphene.Field(LogSourceType)

    def mutate(self, info, name, **kwargs):
        # 1. Resolve Component if ID provided
        comp = None
        if 'mitre_component_id' in kwargs:
            cid = kwargs.pop('mitre_component_id')
            # Try finding by DB ID first, then STIX ID
            try:
                comp = MitreDataComponent.objects.get(pk=cid)
            except:
                comp = MitreDataComponent.objects.filter(stix_id=cid).first()

        # 2. Create
        source = LogSource.objects.create(
            name=name,
            mitre_component=comp,
            **kwargs
        )
        return CreateLogSource(log_source=source)

class Mutation(graphene.ObjectType):
    create_log_source = CreateLogSource.Field()

class Query(graphene.ObjectType):
    all_log_sources = graphene.List(LogSourceType)
    def resolve_all_log_sources(self, info):
        return LogSource.objects.all()
