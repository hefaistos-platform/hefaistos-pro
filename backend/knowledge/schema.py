import graphene
from graphene_django import DjangoObjectType
from .models import KnowledgeBaseCategory, KnowledgeBaseArticle
from tags.models import TenantTag
from django.utils.text import slugify
from identity.schema import UserType
from django.core.exceptions import PermissionDenied
from identity.models import CustomUser

# Helper function to check superuser status
def require_superuser(user):
    """Raises PermissionDenied if user is not a superuser."""
    if not user or user.is_anonymous:
        raise PermissionDenied("Authentication required.")
    if not user.is_superuser:
        raise PermissionDenied("Superuser status required to edit Knowledge Base.")

# --- TYPES ---

class KnowledgeBaseArticleType(DjangoObjectType):
    author = graphene.Field(UserType)
    tags = graphene.List(graphene.String)

    class Meta:
        model = KnowledgeBaseArticle
        # Keep model fields explicit and provide custom resolvers for author/tags.
        fields = (
            "id",
            "title",
            "content",
            "category",
            "author",
            "organization",
            "created_at",
            "updated_at",
        )

    def resolve_tags(self, info):
        try:
            return list(self.tags.names())
        except Exception:
            return []

class KnowledgeBaseCategoryType(DjangoObjectType):
    # Resolver to get all articles within this category
    articles = graphene.List(KnowledgeBaseArticleType)

    class Meta:
        model = KnowledgeBaseCategory
        fields = ("id", "name", "description", "organization", "articles")

    def resolve_articles(self, info):
        # self is the Category instance.
        # We can access articles via the related_name
        return self.articles.all()


# --- QUERIES ---

class Query(graphene.ObjectType):
    all_kb_categories = graphene.List(
        KnowledgeBaseCategoryType,
        description="Retrieves all Knowledge Base categories (platform-wide, readable by all authenticated users)."
    )
    kb_article = graphene.Field(
        KnowledgeBaseArticleType,
        id=graphene.UUID(required=True),
        description="Retrieves a single Knowledge Base article by its ID (platform-wide)."
    )

    def resolve_all_kb_categories(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        # Platform-wide: Return all categories (no organization filter)
        return KnowledgeBaseCategory.objects.all()

    def resolve_kb_article(self, info, id):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication credentials were not provided")

        try:
            # Platform-wide: No organization filter on read
            return KnowledgeBaseArticle.objects.get(pk=id)
        except KnowledgeBaseArticle.DoesNotExist:
            return None


# --- MUTATIONS ---

class CreateKBCategory(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        description = graphene.String()

    category = graphene.Field(KnowledgeBaseCategoryType)

    class Meta:
        description = "Creates a new Knowledge Base category (SuperUser only, platform-wide)."

    @staticmethod
    def mutate(root, info, name, description=None):
        user = info.context.user
        require_superuser(user)

        # Ensure user has an organization
        if not user.organization:
            raise Exception("User must belong to an organization to create Knowledge Base categories")

        # SuperUser creates platform-wide KB (organization can be the first user's org or a dedicated KB org)
        # For now, use the user's organization to avoid NULL org
        category = KnowledgeBaseCategory(
            name=name,
            description=description,
            organization=user.organization
        )
        category.save()
        return CreateKBCategory(category=category)

class CreateKBArticle(graphene.Mutation):
    class Arguments:
        title = graphene.String(required=True)
        content = graphene.String(required=True)
        category_id = graphene.UUID(required=False)
        tags = graphene.List(graphene.String, required=False, description="List of tag names to apply to the article")

    article = graphene.Field(KnowledgeBaseArticleType)

    class Meta:
        description = "Creates a new Knowledge Base article (SuperUser only, platform-wide)."

    @staticmethod
    def mutate(root, info, title, content, category_id=None, tags=None):
        user = info.context.user
        require_superuser(user)

        category = None
        if category_id:
            try:
                # Allow any category (platform-wide)
                category = KnowledgeBaseCategory.objects.get(pk=category_id)
            except KnowledgeBaseCategory.DoesNotExist:
                raise Exception("Category not found")

        article = KnowledgeBaseArticle(
            title=title,
            content=content,
            category=category,
            author=user,
            organization=user.organization  # Platform KB still uses an organization reference
        )
        article.save()

        # Handle tags if provided
        if tags:
            tag_objects = []
            for name in tags:
                cleaned = (name or "").strip()
                if not cleaned:
                    continue
                # Use first organization for platform KB tags (or create tenant-agnostic tags)
                org = user.organization
                tag_obj, _ = TenantTag.objects.get_or_create(
                    name=cleaned,
                    organization=org,
                    defaults={"slug": slugify(cleaned, allow_unicode=True)}
                )
                tag_objects.append(tag_obj)
            article.tags.set(tag_objects)

        return CreateKBArticle(article=article)

class UpdateKBCategory(graphene.Mutation):
    class Arguments:
        id = graphene.UUID(required=True)
        name = graphene.String(required=False)
        description = graphene.String(required=False)

    category = graphene.Field(KnowledgeBaseCategoryType)

    class Meta:
        description = "Updates a Knowledge Base category (SuperUser only)."

    @staticmethod
    def mutate(root, info, id, name=None, description=None):
        user = info.context.user
        require_superuser(user)

        try:
            category = KnowledgeBaseCategory.objects.get(pk=id)
        except KnowledgeBaseCategory.DoesNotExist:
            raise Exception("Category not found")

        if name is not None:
            category.name = name
        if description is not None:
            category.description = description
        category.save()
        return UpdateKBCategory(category=category)

class UpdateKBArticleTags(graphene.Mutation):
    class Arguments:
        id = graphene.UUID(required=True)
        tags = graphene.List(graphene.String, required=True)

    article = graphene.Field(KnowledgeBaseArticleType)

    class Meta:
        description = "Sets the tags for a Knowledge Base article (SuperUser only)."

    @staticmethod
    def mutate(root, info, id, tags):
        user = info.context.user
        require_superuser(user)

        try:
            article = KnowledgeBaseArticle.objects.get(pk=id)
        except KnowledgeBaseArticle.DoesNotExist:
            raise Exception("Article not found")

        # Normalize names and build TenantTag objects
        normalized = []
        for name in tags or []:
            cleaned = (name or "").strip()
            if not cleaned:
                continue
            # Use article's organization for tagging
            org = article.organization
            tag_obj, _ = TenantTag.objects.get_or_create(
                name=cleaned,
                organization=org,
                defaults={"slug": slugify(cleaned, allow_unicode=True)}
            )
            normalized.append(tag_obj)

        # Replace the set
        article.tags.set(normalized)
        return UpdateKBArticleTags(article=article)

class UpdateKBArticle(graphene.Mutation):
    class Arguments:
        id = graphene.UUID(required=True)
        title = graphene.String()
        content = graphene.String()
        category_id = graphene.UUID()

    article = graphene.Field(KnowledgeBaseArticleType)

    class Meta:
        description = "Updates an existing Knowledge Base article (SuperUser only)."

    @staticmethod
    def mutate(root, info, id, **kwargs):
        user = info.context.user
        require_superuser(user)

        try:
            # Platform-wide: No organization filter
            article = KnowledgeBaseArticle.objects.get(pk=id)
        except KnowledgeBaseArticle.DoesNotExist:
            raise Exception("Article not found")

        # Handle category update separately
        if 'category_id' in kwargs:
            category_id = kwargs.pop('category_id')
            if category_id:
                try:
                    category = KnowledgeBaseCategory.objects.get(pk=category_id)
                    article.category = category
                except KnowledgeBaseCategory.DoesNotExist:
                    raise Exception("Category not found")
            else:
                article.category = None # Allow un-setting the category

        # Update all other simple fields
        for field, value in kwargs.items():
            setattr(article, field, value)

        article.save()
        return UpdateKBArticle(article=article)

class DeleteKBArticle(graphene.Mutation):
    class Arguments:
        id = graphene.UUID(required=True)

    ok = graphene.Boolean()

    class Meta:
        description = "Deletes a Knowledge Base article (SuperUser only)."

    @staticmethod
    def mutate(root, info, id):
        user = info.context.user
        require_superuser(user)

        try:
            article = KnowledgeBaseArticle.objects.get(pk=id)
        except KnowledgeBaseArticle.DoesNotExist:
            raise Exception("Article not found")

        article.delete()
        return DeleteKBArticle(ok=True)

class DeleteKBCategory(graphene.Mutation):
    class Arguments:
        id = graphene.UUID(required=True)

    ok = graphene.Boolean()

    class Meta:
        description = "Deletes a Knowledge Base category (SuperUser only). Articles will not be deleted and their category will be set to NULL."

    @staticmethod
    def mutate(root, info, id):
        user = info.context.user
        require_superuser(user)

        try:
            category = KnowledgeBaseCategory.objects.get(pk=id)
        except KnowledgeBaseCategory.DoesNotExist:
            raise Exception("Category not found")

        # Due to on_delete=SET_NULL on KnowledgeBaseArticle.category, deleting the
        # category will automatically null out the FK for related articles.
        category.delete()
        return DeleteKBCategory(ok=True)

class Mutation(graphene.ObjectType):
    create_kb_category = CreateKBCategory.Field()
    create_kb_article = CreateKBArticle.Field()
    update_kb_article = UpdateKBArticle.Field()
    delete_kb_article = DeleteKBArticle.Field()
    update_kb_category = UpdateKBCategory.Field()
    update_kb_article_tags = UpdateKBArticleTags.Field()
    delete_kb_category = DeleteKBCategory.Field()
