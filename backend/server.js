const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allow requests from Live Server
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve static files from frontend

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
        // Create Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            color TEXT,
            score INTEGER DEFAULT 0
        )`);

        // Create Territories table
        // grid_id is a string "latIndex,lngIndex"
        db.run(`CREATE TABLE IF NOT EXISTS territories (
            grid_id TEXT PRIMARY KEY,
            owner_id INTEGER,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`);

        // Insert default users if they don't exist
        db.run(`INSERT OR IGNORE INTO users (id, username, color) VALUES (1, 'You', '#6366f1')`);
        db.run(`INSERT OR IGNORE INTO users (id, username, color) VALUES (2, 'Rival', '#ef4444')`);
    });
}

// Helper: Convert Lat/Lng to Grid ID
// Approx 11 meters resolution (0.0001 degrees)
function getGridId(lat, lng) {
    const latIndex = Math.floor(lat * 10000);
    const lngIndex = Math.floor(lng * 10000);
    return `${latIndex},${lngIndex}`;
}

// Routes

// Get all territories
app.get('/api/territories', (req, res) => {
    const sql = `SELECT t.grid_id, u.color 
                 FROM territories t 
                 JOIN users u ON t.owner_id = u.id`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ territories: rows });
    });
});

// Update location and conquer territory
app.post('/api/update-location', (req, res) => {
    const { lat, lng, userId } = req.body;

    if (!lat || !lng || !userId) {
        return res.status(400).json({ error: 'Missing lat, lng, or userId' });
    }

    const gridId = getGridId(lat, lng);

    // Check who owns this grid
    db.get(`SELECT owner_id FROM territories WHERE grid_id = ?`, [gridId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!row || row.owner_id !== userId) {
            // New territory or capturing enemy territory
            const sql = `INSERT INTO territories (grid_id, owner_id) 
                         VALUES (?, ?) 
                         ON CONFLICT(grid_id) DO UPDATE SET owner_id = ?`;

            db.run(sql, [gridId, userId, userId], function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Update scores
                updateScores();

                res.json({
                    message: 'Territory captured',
                    gridId: gridId,
                    captured: true
                });
            });
        } else {
            // Already owned by user
            res.json({
                message: 'Already owned',
                gridId: gridId,
                captured: false
            });
        }
    });
});

function updateScores() {
    // Recalculate scores based on territory count
    const sql = `UPDATE users 
                 SET score = (SELECT COUNT(*) FROM territories WHERE owner_id = users.id)`;
    db.run(sql, (err) => {
        if (err) console.error("Error updating scores:", err);
    });
}

// Get scores
app.get('/api/scores', (req, res) => {
    db.all(`SELECT id, username, score FROM users`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ scores: rows });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
