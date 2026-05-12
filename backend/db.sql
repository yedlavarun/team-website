-- ══════════════════════════════════════════════════════
-- Cardio Wars — Full Database Schema v2
-- SQLite (managed automatically by server.js)
-- ══════════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────
-- Includes auth fields + gamification columns.
-- Legacy rows (id=1 'You', id=2 'Rival') are seeded by
-- server.js for the territory map game.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    username      TEXT     UNIQUE NOT NULL,
    email         TEXT     UNIQUE,
    password_hash TEXT,                      -- NULL for legacy/seeded users
    color         TEXT     DEFAULT '#6366f1',
    score         INTEGER  DEFAULT 0,        -- territory count
    xp            INTEGER  DEFAULT 0,        -- experience points
    level         INTEGER  DEFAULT 1,
    streak        INTEGER  DEFAULT 0,        -- consecutive active days
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Stats (one-to-one with users) ────────────────────
-- Auto-updated by sessionService on every workout save.
CREATE TABLE IF NOT EXISTS stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER UNIQUE,
    total_distance  REAL    DEFAULT 0,       -- km
    avg_speed       REAL    DEFAULT 0,       -- km/h
    calories_burned REAL    DEFAULT 0,
    workout_count   INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ── Workout Sessions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL,
    distance   REAL     NOT NULL,   -- km
    avg_speed  REAL     NOT NULL,   -- km/h
    duration   INTEGER  NOT NULL,   -- minutes
    calories   REAL     NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ── Territories (map game) ────────────────────────────
-- grid_id: "latIndex,lngIndex" at ~11m resolution
CREATE TABLE IF NOT EXISTS territories (
    grid_id  TEXT    PRIMARY KEY,
    owner_id INTEGER,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

-- ── Messages (admin broadcast) ────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    content    TEXT     NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Seed Data ─────────────────────────────────────────
-- Legacy map-game players (no auth — password_hash NULL)
INSERT OR IGNORE INTO users (id, username, color) VALUES (1, 'You',   '#6366f1');
INSERT OR IGNORE INTO users (id, username, color) VALUES (2, 'Rival', '#ef4444');

-- Default message
INSERT OR IGNORE INTO messages (id, content)
    VALUES (1, 'Welcome to Cardio Wars! 🏃');

-- ══════════════════════════════════════════════════════
-- XP Formula (applied in routes/sessions.js):
--   xpGained = ROUND(distance * 10 + avgSpeed * 2)
--
-- Level Formula:
--   level = FLOOR(totalXP / 500) + 1
--
-- Migration Notes:
--   To switch to PostgreSQL/Firestore later, replace
--   sqlite3 calls in server.js with your ORM adapter.
--   Service-layer pattern keeps business logic intact.
-- ══════════════════════════════════════════════════════
