from django.contrib import admin
from .models import (
	Entity,
	Organization,
	MISPInstance,
	OpenTidePublishProfile,
	OpenTideHefPublishJob,
	OrganizationAITaskConfig,
	OrganizationAITaskRun,
)


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
	list_display = ("name", "created_at")
	search_fields = ("name",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
	list_display = ("name", "entity", "created_at", "updated_at")
	list_filter = ("entity",)
	search_fields = ("name",)


@admin.register(MISPInstance)
class MISPInstanceAdmin(admin.ModelAdmin):
	list_display = ("name", "organization", "url", "verify_ssl", "created_at")
	list_filter = ("organization", "verify_ssl")
	search_fields = ("name", "url")


@admin.register(OpenTidePublishProfile)
class OpenTidePublishProfileAdmin(admin.ModelAdmin):
	list_display = (
		"name",
		"organization",
		"repository",
		"branch",
		"target_folder",
		"enabled",
		"updated_at",
	)
	list_filter = ("organization", "enabled", "use_graph_configured_platforms")
	search_fields = ("name", "branch", "target_folder")
	readonly_fields = ("id", "created_at", "updated_at", "created_by")


@admin.register(OpenTideHefPublishJob)
class OpenTideHefPublishJobAdmin(admin.ModelAdmin):
	list_display = (
		"id",
		"playbook",
		"organization",
		"status",
		"branch",
		"commit_sha",
		"created_at",
		"completed_at",
	)
	list_filter = ("organization", "status", "branch")
	search_fields = ("commit_sha", "github_url", "commit_message", "error_message")
	readonly_fields = tuple(
		f.name for f in OpenTideHefPublishJob._meta.fields
	)

	def has_add_permission(self, request):  # pragma: no cover - admin-only behavior
		# Jobs are created exclusively by the publish flow.
		return False

	def has_change_permission(self, request, obj=None):  # pragma: no cover
		# View-only in admin – jobs are immutable history.
		return False


@admin.register(OrganizationAITaskConfig)
class OrganizationAITaskConfigAdmin(admin.ModelAdmin):
	list_display = (
		"organization",
		"task_key",
		"enabled",
		"schedule",
		"next_run_at",
		"last_run_at",
		"last_status",
		"updated_at",
	)
	list_filter = ("organization", "enabled", "schedule", "last_status")
	search_fields = ("organization__name", "task_key", "last_message")


@admin.register(OrganizationAITaskRun)
class OrganizationAITaskRunAdmin(admin.ModelAdmin):
	list_display = (
		"organization",
		"task_key",
		"status",
		"trigger",
		"started_at",
		"completed_at",
		"duration_ms",
		"run_by",
	)
	list_filter = ("organization", "status", "trigger", "task_key")
	search_fields = ("organization__name", "task_key", "output_summary", "error_message")
	readonly_fields = tuple(f.name for f in OrganizationAITaskRun._meta.fields)

	def has_add_permission(self, request):  # pragma: no cover
		return False
