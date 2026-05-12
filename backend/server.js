const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Default route → serve game map
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Database ──────────────────────────────────────────────────────────────────
const dbPath = path.resolve(__dirname, 'game.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {

        // ── Users (extended with auth + gamification fields) ────────────────
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            email         TEXT UNIQUE,
            password_hash TEXT,
            color         TEXT DEFAULT '#6366f1',
            score         INTEGER DEFAULT 0,
            xp            INTEGER DEFAULT 0,
            level         INTEGER DEFAULT 1,
            streak        INTEGER DEFAULT 0,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // ── Stats (one row per user, auto-aggregated) ───────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS stats (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER UNIQUE,
            total_distance  REAL DEFAULT 0,
            avg_speed       REAL DEFAULT 0,
            calories_burned REAL DEFAULT 0,
            workout_count   INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // ── Workout Sessions ────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            distance    REAL NOT NULL,
            avg_speed   REAL NOT NULL,
            duration    INTEGER NOT NULL,
            calories    REAL NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // ── Territories (unchanged) ─────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS territories (
            grid_id  TEXT PRIMARY KEY,
            owner_id INTEGER,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`);

        // ── Messages ────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            content    TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed defaults
        db.run(`INSERT OR IGNORE INTO messages (id, content) VALUES (1, 'Welcome to Cardio Wars! 🏃')`);

        console.log('✅ Database schema ready.');
    });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth (register / login / me)
app.use('/api/auth', require('./routes/auth')(db));

// Sessions (protected — workout tracking)
app.use('/api/sessions', require('./routes/sessions')(db));

// Leaderboard (public)
app.use('/api/leaderboard', require('./routes/leaderboard')(db));

// ── Territory game routes (original, preserved) ─────────────────────────────

// Helper: Convert Lat/Lng to Grid ID (~11m resolution)
function getGridId(lat, lng) {
    const latIndex = Math.floor(lat * 10000);
    const lngIndex = Math.floor(lng * 10000);
    return `${latIndex},${lngIndex}`;
}

// GET all territories
app.get('/api/territories', (req, res) => {
    const sql = `SELECT t.grid_id, u.color 
                 FROM territories t 
                 JOIN users u ON t.owner_id = u.id`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ territories: rows });
    });
});

// POST update location / conquer territory
app.post('/api/update-location', (req, res) => {
    const { lat, lng, userId } = req.body;

    if (!lat || !lng || !userId) {
        return res.status(400).json({ error: 'Missing lat, lng, or userId' });
    }

    const gridId = getGridId(lat, lng);

    db.get(`SELECT owner_id FROM territories WHERE grid_id = ?`, [gridId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row || row.owner_id !== userId) {
            const sql = `INSERT INTO territories (grid_id, owner_id) 
                         VALUES (?, ?) 
                         ON CONFLICT(grid_id) DO UPDATE SET owner_id = ?`;
            db.run(sql, [gridId, userId, userId], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                updateTerritoryScores();
                res.json({ message: 'Territory captured', gridId, captured: true });
            });
        } else {
            res.json({ message: 'Already owned', gridId, captured: false });
        }
    });
});

function updateTerritoryScores() {
    db.run(
        `UPDATE users SET score = (SELECT COUNT(*) FROM territories WHERE owner_id = users.id)`,
        (err) => { if (err) console.error('Score update error:', err); }
    );
}

// GET scores
app.get('/api/scores', (req, res) => {
    db.all(`SELECT id, username, color, score, xp, level FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ scores: rows });
    });
});

// GET / POST messages
app.get('/api/message', (req, res) => {
    db.get('SELECT content FROM messages ORDER BY id DESC LIMIT 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { content: 'No messages yet.' });
    });
});

app.post('/api/message', (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    db.run('INSERT INTO messages (content) VALUES (?)', [content], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Message posted', id: this.lastID });
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Cardio Wars server running on http://localhost:${PORT}`);
});
