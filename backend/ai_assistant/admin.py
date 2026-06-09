from django.contrib import admin
from .models import OrgAISettings, AIGenerationTask


@admin.register(OrgAISettings)
class OrgAISettingsAdmin(admin.ModelAdmin):
    list_display = ('organization', 'ollama_base_url', 'ollama_model', 'updated_at')
    search_fields = ('organization__name', 'ollama_model')


@admin.register(AIGenerationTask)
class AIGenerationTaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'task_type', 'status', 'created_at', 'completed_at')
    list_filter = ('task_type', 'status')
    search_fields = ('user__username',)
    readonly_fields = ('id', 'user', 'task_type', 'input_data', 'result_data',
                       'error_message', 'created_at', 'started_at', 'completed_at')
