from django.contrib import admin
from .models import (
    MitreAttackTechnique,
    MitreDataSource,
    MitreDataComponent,
    MitreAnalytic,
    MitreDetectionStrategy,
    MitreIcsTechnique,
    MitreMobileTechnique,
    D3fendDefensiveTechnique,
    D3fendDigitalArtifact,
    D3fendAttackMapping,
    ShareTideIndexEntry,
    PlatformDataVersion,
    MitreImportJob,
)

# --- 1. Techniques ---
@admin.register(MitreAttackTechnique)
class MitreAttackTechniqueAdmin(admin.ModelAdmin):
    list_display = ('technique_id', 'name', 'domain', 'tactic', 'revoked', 'deprecated', 'stix_id')
    list_filter = ('domain', 'revoked', 'deprecated')
    search_fields = ('technique_id', 'name', 'stix_id')

@admin.register(MitreIcsTechnique)
class MitreIcsTechniqueAdmin(admin.ModelAdmin):
    list_display = ('technique_id', 'name', 'url')
    search_fields = ('technique_id', 'name')

@admin.register(MitreMobileTechnique)
class MitreMobileTechniqueAdmin(admin.ModelAdmin):
    list_display = ('technique_id', 'name', 'url')
    search_fields = ('technique_id', 'name')

# --- 2. Data Sources ---
@admin.register(MitreDataSource)
class MitreDataSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'stix_id')
    search_fields = ('name', 'stix_id')

# --- 3. Data Components ---
@admin.register(MitreDataComponent)
class MitreDataComponentAdmin(admin.ModelAdmin):
    list_display = ('name', 'data_source', 'domain')
    list_filter = ('domain', 'data_source')
    search_fields = ('name', 'data_source__name')
    filter_horizontal = ('techniques',)

# --- 4. Detection Strategies (NEW) ---
@admin.register(MitreDetectionStrategy)
class MitreDetectionStrategyAdmin(admin.ModelAdmin):
    list_display = ('def_id', 'name', 'domain')
    list_filter = ('domain',)
    search_fields = ('def_id', 'name', 'description')
    filter_horizontal = ('techniques',)

# --- 5. Analytics ---
@admin.register(MitreAnalytic)
class MitreAnalyticAdmin(admin.ModelAdmin):
    # Updated to show the new strategy link
    list_display = ('name', 'detection_strategy', 'domain')
    list_filter = ('domain',)
    search_fields = ('name', 'description')

# --- D3FEND Models ---
@admin.register(D3fendDefensiveTechnique)
class D3fendDefensiveTechniqueAdmin(admin.ModelAdmin):
    list_display = ('d3fend_id', 'name', 'tactic', 'parent')
    list_filter = ('tactic',)
    search_fields = ('d3fend_id', 'name', 'definition')
    filter_horizontal = ()

@admin.register(D3fendDigitalArtifact)
class D3fendDigitalArtifactAdmin(admin.ModelAdmin):
    list_display = ('artifact_id', 'name')
    search_fields = ('artifact_id', 'name', 'definition')
    filter_horizontal = ('techniques',)

@admin.register(D3fendAttackMapping)
class D3fendAttackMappingAdmin(admin.ModelAdmin):
    list_display = ('d3fend_technique', 'attack_technique', 'relationship')
    list_filter = ('relationship',)
    search_fields = ('d3fend_technique__name', 'attack_technique__technique_id')

# --- ShareTide Index ---
@admin.register(ShareTideIndexEntry)
class ShareTideIndexEntryAdmin(admin.ModelAdmin):
    list_display = ('category', 'value', 'sort_order', 'description')
    list_filter = ('category',)
    search_fields = ('category', 'value', 'description')
    ordering = ('category', 'sort_order', 'value')


# --- Framework Version Tracking ---
@admin.register(PlatformDataVersion)
class PlatformDataVersionAdmin(admin.ModelAdmin):
    list_display = ('framework', 'version', 'imported_at')
    readonly_fields = ('imported_at',)


# --- MITRE Import Jobs ---
@admin.register(MitreImportJob)
class MitreImportJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'version', 'mode', 'status', 'triggered_by', 'created_at', 'finished_at')
    list_filter = ('status', 'mode')
    readonly_fields = ('id', 'created_at', 'updated_at', 'started_at', 'finished_at', 'log', 'error')
