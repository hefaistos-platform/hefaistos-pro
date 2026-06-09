import uuid
from django.db import models
from django.conf import settings

class MitreDomain(models.TextChoices):
    ENTERPRISE = 'enterprise-attack', 'Enterprise'
    MOBILE = 'mobile-attack', 'Mobile'
    ICS = 'ics-attack', 'ICS'

class MitreAttackTechnique(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    technique_id = models.CharField(max_length=20)
    stix_id = models.CharField(max_length=100, unique=True, null=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=512)
    domain = models.CharField(max_length=50, choices=MitreDomain.choices, default=MitreDomain.ENTERPRISE)
    # Tactic(s) the technique belongs to (e.g. "Execution", "Defense Evasion")
    tactic = models.CharField(
        max_length=255,
        blank=True,
        help_text="ATT&CK tactic(s) for this technique (comma-separated if multiple)",
    )
    # Lifecycle flags imported from the ATT&CK Excel 'revoked' / 'deprecated' columns
    revoked = models.BooleanField(
        default=False,
        help_text="Technique has been revoked by MITRE (superseded or removed)",
    )
    deprecated = models.BooleanField(
        default=False,
        help_text="Technique has been deprecated by MITRE",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['technique_id', 'domain'], name='unique_technique_per_domain')
        ]

    def __str__(self): return f"{self.technique_id}: {self.name}"

# --- NEW MODEL ---
class MitreDetectionStrategy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stix_id = models.CharField(max_length=100, unique=True)
    def_id = models.CharField(max_length=50, null=True) # e.g. DET0001
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=512, null=True)
    domain = models.CharField(max_length=50, choices=MitreDomain.choices, default=MitreDomain.ENTERPRISE)
    
    # The crucial link: Strategy -> detects -> Technique
    techniques = models.ManyToManyField(MitreAttackTechnique, related_name="detection_strategies", blank=True)

    def __str__(self): return f"{self.def_id}: {self.name}"

    class Meta:
        verbose_name_plural = "Mitre detection strategies"

class MitreAnalytic(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stix_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField()
    domain = models.CharField(max_length=50, choices=MitreDomain.choices, default=MitreDomain.ENTERPRISE)
    
    # UPDATED LINK: Analytic belongs to a Strategy
    detection_strategy = models.ForeignKey(MitreDetectionStrategy, on_delete=models.SET_NULL, null=True, blank=True, related_name="analytics")

    def __str__(self): return self.name

# (Keep DataSource and DataComponent models if you wish, but they are secondary in this chain)
class MitreDataSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stix_id = models.CharField(max_length=100, unique=True, null=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class MitreDataComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stix_id = models.CharField(max_length=100, unique=True, null=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    domain = models.CharField(max_length=50, choices=MitreDomain.choices, default=MitreDomain.ENTERPRISE)
    
    data_source = models.ForeignKey(MitreDataSource, on_delete=models.CASCADE, related_name="components", null=True)
    techniques = models.ManyToManyField(MitreAttackTechnique, related_name="data_components", blank=True)

    def __str__(self):
        return f"{self.data_source.name}: {self.name}"

# --- 4. ICS Technique ---
class MitreIcsTechnique(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    technique_id = models.CharField(max_length=20, unique=True, help_text="e.g., T0800")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=512)

    def __str__(self):
        return f"{self.technique_id}: {self.name}"

# --- 5. Mobile Technique ---
class MitreMobileTechnique(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    technique_id = models.CharField(max_length=20, unique=True, help_text="e.g., T1400")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=512)

    def __str__(self):
        return f"{self.technique_id}: {self.name}"

# --- D3FEND MODELS ---

class D3fendDefensiveTechnique(models.Model):
    """D3FEND defensive technique (e.g., D3-PSA Process Spawn Analysis)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    d3fend_id = models.CharField(max_length=20, unique=True)  # e.g., "D3-PSA"
    name = models.CharField(max_length=255)
    definition = models.TextField(blank=True)
    iri = models.URLField(max_length=512, blank=True)  # Ontology IRI reference
    
    # Hierarchical structure
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    tactic = models.CharField(max_length=100, blank=True)  # Detect, Harden, Deceive, Evict, Isolate
    
    class Meta:
        ordering = ['d3fend_id']
    
    def __str__(self):
        return f"{self.d3fend_id}: {self.name}"


class D3fendDigitalArtifact(models.Model):
    """D3FEND Digital Artifacts that techniques analyze/produce"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    artifact_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    definition = models.TextField(blank=True)
    iri = models.URLField(max_length=512, blank=True)
    
    # Link to techniques that use this artifact
    techniques = models.ManyToManyField(D3fendDefensiveTechnique, related_name='digital_artifacts', blank=True)
    
    def __str__(self):
        return self.name


class D3fendAttackMapping(models.Model):
    """ATT&CK → D3FEND countermeasure mappings"""
    attack_technique = models.ForeignKey(MitreAttackTechnique, on_delete=models.CASCADE, related_name='d3fend_countermeasures')
    d3fend_technique = models.ForeignKey(D3fendDefensiveTechnique, on_delete=models.CASCADE, related_name='countered_attacks')
    relationship = models.CharField(max_length=50, default='counters')
    
    class Meta:
        unique_together = ['attack_technique', 'd3fend_technique']
    
    def __str__(self):
        return f"{self.d3fend_technique.d3fend_id} counters {self.attack_technique.technique_id}"


# ---------------------------------------------------------------------------
# ShareTide Vocabulary Index
# ---------------------------------------------------------------------------

class ShareTideIndexEntry(models.Model):
    """
    An offline copy of ShareTide schema vocabulary entries.

    Mirrors the index files from
    https://github.com/OpenTideHQ/ShareTide/tree/main/Schemas/Indexes
    so that the OpenTIDE compiler can resolve valid vocabulary values without
    requiring an internet connection at compile time.

    Categories:
        - ``bdr_criticality``   – BDR criticality levels
        - ``bdr_domains``       – BDR applicable domains
        - ``bdr_targets``       – BDR target asset types
        - ``bdr_platforms``     – BDR operating platforms
        - ``mdr_alert_severities`` – MDR alert severity levels
        - ``mdr_responders``    – MDR responder team identifiers
        - ``dom_priorities``    – DOM detection priority levels
        - ``mdr_platforms``     – MDR supported SIEM/platform names
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Vocabulary category, e.g. 'bdr_platforms', 'mdr_responders'.",
    )
    value = models.CharField(
        max_length=255,
        help_text="Vocabulary entry value, e.g. 'Windows', 'High'.",
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description or notes for this vocabulary entry.",
    )
    source_url = models.URLField(
        max_length=512,
        blank=True,
        help_text="URL to the upstream ShareTide index file.",
    )
    sort_order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Display ordering within category.",
    )

    class Meta:
        unique_together = [('category', 'value')]
        ordering = ['category', 'sort_order', 'value']
        verbose_name = "ShareTide Index Entry"
        verbose_name_plural = "ShareTide Index Entries"

    def __str__(self):
        return f"{self.category}: {self.value}"


# ---------------------------------------------------------------------------
# ATT&CK / Framework version tracking
# ---------------------------------------------------------------------------

class PlatformDataVersion(models.Model):
    """
    Records the version of each framework dataset currently loaded in the
    database.  Updated automatically by management import commands so that
    the admin UI and diagnostic endpoints can show freshness at a glance.
    """

    FRAMEWORK_CHOICES = [
        ('enterprise-attack', 'MITRE ATT&CK Enterprise'),
        ('ics-attack', 'MITRE ATT&CK ICS'),
        ('mobile-attack', 'MITRE ATT&CK Mobile'),
        ('d3fend', 'MITRE D3FEND'),
    ]

    framework = models.CharField(
        max_length=50,
        choices=FRAMEWORK_CHOICES,
        unique=True,
        help_text="Framework identifier (e.g. 'enterprise-attack')",
    )
    version = models.CharField(
        max_length=20,
        help_text="Loaded version string (e.g. '19.0')",
    )
    imported_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp of the last successful import for this framework",
    )

    class Meta:
        verbose_name = "Platform Data Version"
        verbose_name_plural = "Platform Data Versions"

    def __str__(self):
        return f"{self.get_framework_display()} v{self.version}"


# ---------------------------------------------------------------------------
# MITRE Import Jobs
# ---------------------------------------------------------------------------

class MitreImportJob(models.Model):
    """
    Tracks async MITRE ATT&CK import runs triggered from the UI.
    """

    class Mode(models.TextChoices):
        REMOTE = 'REMOTE', 'Remote'
        LOCAL = 'LOCAL', 'Local'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=20, help_text="ATT&CK version to import, e.g. '19.1'")
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.REMOTE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    log = models.TextField(blank=True, default='')
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='mitre_import_jobs',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = "MITRE Import Job"
        verbose_name_plural = "MITRE Import Jobs"

    def __str__(self):
        return f"MitreImportJob v{self.version} [{self.status}] @ {self.created_at}"