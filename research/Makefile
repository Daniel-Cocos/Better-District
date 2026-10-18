.PHONY: data data-offline test benchmark fetch-model

data:
	./data_aggregation.sh

data-offline:
	./data_aggregation.sh --offline

test:
	nix develop path:. --command python -m pytest -q

benchmark:
	nix develop path:. --command python -m research benchmark

fetch-model:
	nix develop path:. --command python -m research fetch

.PHONY: format lint check analysis prepare

format:
	nix develop path:. --command black consultations research tests main.py

lint:
	nix develop path:. --command pylint --rcfile=pyproject.toml consultations research tests main.py
	nix develop path:. --command pyright

check:
	nix develop path:. --command black --check consultations research tests main.py
	$(MAKE) lint
	$(MAKE) test

analysis:
	nix develop path:. --command python -m research.analysis

prepare:
	nix develop path:. --command python -m research.prepare
