.PHONY: up up-workers up-obs up-devtools up-full down ps logs migrate seed

up:
	docker compose up -d

up-workers:
	docker compose --profile workers up -d

up-obs:
	docker compose --profile obs up -d

up-devtools:
	docker compose --profile devtools up -d

up-full:
	docker compose --profile workers --profile obs --profile devtools up -d

down:
	docker compose down

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose --profile batch run --rm migrate

seed:
	docker compose --profile batch run --rm seed
