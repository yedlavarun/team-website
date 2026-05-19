const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Database Setup
const dbPath = path.resolve(__dirname, 'game.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            color TEXT,
            score INTEGER DEFAULT 0
        )`);

        // Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Logs table
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            guest_id TEXT,
            action TEXT,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Default message
        db.run(`INSERT OR IGNORE INTO messages (id, content) VALUES (1, 'Welcome to Cardio Wars!')`);
    });
}

// Messages API
app.get('/api/message', (req, res) => {
    db.get('SELECT content FROM messages ORDER BY id DESC LIMIT 1', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json(row || { content: 'No messages yet.' });
    });
});

app.post('/api/message', (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content required' });
    }

    db.run('INSERT INTO messages (content) VALUES (?)', [content], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json({ message: 'Message posted', id: this.lastID });
    });
});

app.post('/api/log-run', (req, res) => {
    const { guestId, distance, time, avg_velocity } = req.body;

    saveLog(null, guestId, "run_completed", {
        distance: distance,
        time: time,
        avg_velocity: avg_velocity
    });

    res.json({ message: "Run logged" });
});

// Logs helper
function saveLog(userId, guest_id, action, details = {}) {
    db.run(
        `INSERT INTO logs (user_id, guest_id, action, details)
         VALUES (?, ?, ?, ?)`,
        [userId || null, guest_id || null, action, JSON.stringify(details)]
    );
}


app.get('/api/logs', (req, res) => {
    const guestId = req.query.guestId;

    db.all(
        'SELECT * FROM logs WHERE guest_id = ? ORDER BY timestamp DESC',
        [guestId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ logs: rows });
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});