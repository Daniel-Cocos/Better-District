"""Load the repeatable development seed: python -m app.seed."""

from app.database import BACKEND_DIR, DEFAULT_DATABASE, connect, initialize


def main():
    """Initialize the schema and load fictional council projects and comments."""
    initialize()
    with connect(DEFAULT_DATABASE) as database:
        database.executescript((BACKEND_DIR / "sql" / "seed.sql").read_text())
    print(f"Seeded {DEFAULT_DATABASE}")


if __name__ == "__main__":
    main()
