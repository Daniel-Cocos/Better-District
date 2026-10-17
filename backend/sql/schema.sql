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

-- Council staff. Every admin is also a user, so they sign in with the same password.
CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    job_title TEXT NOT NULL DEFAULT ''
);

-- Bearer tokens for the admin website; only a SHA-256 of each token is stored.
CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

-- Unfinished projects from the admin wizard, kept as the raw form so any step can be incomplete.
CREATE TABLE IF NOT EXISTS project_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_by TEXT REFERENCES users(email) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Council details for a published event. Events without a row here were posted elsewhere.
CREATE TABLE IF NOT EXISTS projects (
    event_id INTEGER PRIMARY KEY NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('proposal', 'live_trial', 'built')),
    feedback_opens TEXT,
    feedback_closes TEXT,
    team TEXT NOT NULL,
    contact TEXT NOT NULL,
    radius_m INTEGER NOT NULL CHECK (radius_m BETWEEN 10 AND 5000),
    ward TEXT,
    commitments TEXT NOT NULL DEFAULT '',
    default_questions INTEGER NOT NULL DEFAULT 1,
    custom_comments INTEGER NOT NULL DEFAULT 1,
    comment_replies INTEGER NOT NULL DEFAULT 1,
    demographics TEXT NOT NULL DEFAULT '[]',
    created_by TEXT REFERENCES users(email) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded files. event_id stays NULL while the file only belongs to a draft.
CREATE TABLE IF NOT EXISTS project_documents (
    id TEXT PRIMARY KEY NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size >= 0),
    content_type TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users(email) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_fields (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (event_id, position)
);

-- "What is permanent" and "Your views can change this" lists.
CREATE TABLE IF NOT EXISTS project_terms (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('permanent', 'changeable')),
    position INTEGER NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (event_id, kind, position)
);

CREATE TABLE IF NOT EXISTS project_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'short_text', 'rating')),
    prompt TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    required INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS project_documents_event_id ON project_documents(event_id);
CREATE INDEX IF NOT EXISTS project_questions_event_id ON project_questions(event_id);
