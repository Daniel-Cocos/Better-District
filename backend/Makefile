.DEFAULT_GOAL := help

NIX_RUN := nix develop path:. --command

.PHONY: help dev test format format-check lint typecheck db-shell

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "\nBackend commands\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2} END {printf "\n"}' $(MAKEFILE_LIST)

dev: ## Start FastAPI with automatic reload
	$(NIX_RUN) python -m uvicorn app.main:app --reload

test: ## Run API tests against temporary databases
	$(NIX_RUN) python -m pytest

format: ## Format Python source and tests
	$(NIX_RUN) python -m black app tests

format-check: ## Check Python formatting
	$(NIX_RUN) python -m black --check app tests

lint: ## Run Pylint on the application
	$(NIX_RUN) python -m pylint app

typecheck: ## Check Python types with Pyright
	$(NIX_RUN) pyright app

db-shell: ## Open the local SQLite database (start the API first)
	$(NIX_RUN) sqlite3 -ifexists data/app.db
