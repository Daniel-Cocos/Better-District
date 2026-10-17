PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    closes_at TEXT,
    likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
    dislikes INTEGER NOT NULL DEFAULT 0 CHECK (dislikes >= 0)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    user_email TEXT REFERENCES users(email) ON DELETE SET NULL,
    owner_key TEXT,
    likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
    dislikes INTEGER NOT NULL DEFAULT 0 CHECK (dislikes >= 0)
);

CREATE INDEX IF NOT EXISTS comments_event_id ON comments(event_id);

CREATE TABLE IF NOT EXISTS event_votes (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    voter TEXT NOT NULL,
    vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
    PRIMARY KEY (event_id, voter)
);

CREATE TABLE IF NOT EXISTS comment_votes (
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    voter TEXT NOT NULL,
    vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
    PRIMARY KEY (comment_id, voter)
);
