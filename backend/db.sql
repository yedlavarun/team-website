-- ══════════════════════════════════════════════════════
-- Cardio Wars — Full Database Schema v2
-- SQLite (managed automatically by server.js)
-- ══════════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    username      TEXT     UNIQUE NOT NULL,
    email         TEXT     UNIQUE,
    password_hash TEXT,
    color         TEXT     DEFAULT '#6366f1',
    xp            INTEGER  DEFAULT 0,
    level         INTEGER  DEFAULT 1,
    streak        INTEGER  DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Stats ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER UNIQUE,
    total_distance  REAL    DEFAULT 0,
    avg_speed       REAL    DEFAULT 0,
    calories_burned REAL    DEFAULT 0,
    workout_count   INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ── Workout Sessions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL,
    distance   REAL     NOT NULL,
    avg_speed  REAL     NOT NULL,
    duration   INTEGER  NOT NULL,
    calories   REAL     NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ── Messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    content    TEXT     NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Seed Data ────────────────────────────────────────

INSERT OR IGNORE INTO messages (id, content)
    VALUES (1, 'Welcome to Cardio Wars! 🏃');

-- ── Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    action     TEXT NOT NULL,
    details    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);