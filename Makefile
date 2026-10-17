.DEFAULT_GOAL := help

.PHONY: help dev phone logs stop test

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "\nBetter District\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2} END {printf "\n"}' $(MAKEFILE_LIST)

dev: ## Demo everything: seeded backend, admin website, Android emulator and the app (EMULATOR=0 for a phone)
	@./scripts/dev.sh

phone: ## Demo on your Android phone plugged in over USB (USB debugging on); no Wi-Fi needed
	@PHONE=1 ./scripts/dev.sh

logs: ## Follow the backend, website and emulator logs from make dev
	@tail -n 20 -F .dev/logs/*.log

stop: ## Shut down the Android emulator left running by make dev
	@nix develop path:mobile --command sh -c 'for d in $$(adb devices | awk "/^emulator-/ {print \$$1}"); do adb -s $$d emu kill; done'

test: ## Run the backend, website and mobile checks
	$(MAKE) -C backend test
	cd web && nix develop path:../mobile --command sh -c 'npx tsc -b && npx oxlint'
	$(MAKE) -C mobile test typecheck lint
