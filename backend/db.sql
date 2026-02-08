-- Database Schema for Cardio Wars

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    color TEXT,
    score INTEGER DEFAULT 0
);

-- Territories Table
-- grid_id is a string representation of coordinates (e.g., "1294,3049")
CREATE TABLE IF NOT EXISTS territories (
    grid_id TEXT PRIMARY KEY,
    owner_id INTEGER,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

-- Default Users
INSERT OR IGNORE INTO users (id, username, color) VALUES (1, 'You', '#6366f1');
INSERT OR IGNORE INTO users (id, username, color) VALUES (2, 'Rival', '#ef4444');
