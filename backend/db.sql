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

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Message
INSERT OR IGNORE INTO messages (id, content) VALUES (1, 'Welcome to Cardio Territory Wars!');
