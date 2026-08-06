"""Management command to run RAG sync for all enabled repositories."""

from django.core.management.base import BaseCommand

from rules.rag_sync import run_due_rag_syncs, sync_repository_rag


class Command(BaseCommand):
    help = "Sync RAG templates from enabled rule repositories into the Qdrant vector store."

    def add_arguments(self, parser):
        parser.add_argument(
            "--repo-id",
            type=int,
            dest="repo_id",
            default=None,
            help="Sync a specific repository by ID (ignores schedule). Omit to run all due repos.",
        )

    def handle(self, *args, **options):
        repo_id = options.get("repo_id")
        if repo_id is not None:
            self.stdout.write(f"Running RAG sync for repository ID={repo_id}...")
            result = sync_repository_rag(repo_id)
            if result["ok"]:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"RAG sync succeeded: upserted={result['upserted']} skipped={result['skipped']}"
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f"RAG sync failed: {result['error']}")
                )
        else:
            self.stdout.write("Checking for due RAG syncs...")
            result = run_due_rag_syncs()
            self.stdout.write(
                self.style.SUCCESS(
                    f"RAG sync check complete: ran={result['ran']} failed={result['failed']}"
                )
            )
