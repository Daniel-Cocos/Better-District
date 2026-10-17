.DEFAULT_GOAL := help

NIX_RUN := nix develop path:. --command

.PHONY: help install dev emulator android ios lint typecheck

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "\nMobile commands\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2} END {printf "\n"}' $(MAKEFILE_LIST)

install: ## Install locked JavaScript dependencies
	$(NIX_RUN) npm ci

dev: ## Start Expo with a QR code for Expo Go
	$(NIX_RUN) npm start

emulator: ## Boot the project Android emulator (x86_64 Linux)
	nix run path:.\#emulator

android: ## Start Expo on an Android device or running emulator
	$(NIX_RUN) npm run android

ios: ## Start Expo on the iOS simulator (macOS)
	$(NIX_RUN) npm run ios

lint: ## Run ESLint on the application
	$(NIX_RUN) npm run lint

typecheck: ## Check TypeScript types
	$(NIX_RUN) npm run typecheck
