"""Load the repeatable development seed: python -m app.seed."""

from app.database import BACKEND_DIR, DEFAULT_DATABASE, connect, initialize

# Loaded in order: accounts and community events, then the consultations that use them
SEED_FILES = ("seed.sql", "seed_consultations.sql")


def main():
    """Initialize the schema, then load the base seed and the Southampton consultations."""
    initialize()
    with connect(DEFAULT_DATABASE) as database:
        for name in SEED_FILES:
            database.executescript(
                (BACKEND_DIR / "sql" / name).read_text(encoding="utf-8")
            )
    print(f"Seeded {DEFAULT_DATABASE}")


if __name__ == "__main__":
    main()
