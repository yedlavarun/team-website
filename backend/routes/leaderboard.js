const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

module.exports = (db) => {

    /**
     * GET /api/leaderboard
     * Public leaderboard by XP (top 50)
     */
    router.get('/', (req, res) => {
        db.all(
            `SELECT u.id, u.username, u.color, u.xp, u.level,
                    s.total_distance, s.workout_count,
                    (SELECT COUNT(*) FROM territories WHERE owner_id = u.id) AS territory_count
             FROM users u
             LEFT JOIN stats s ON s.user_id = u.id
             WHERE u.password_hash IS NOT NULL
             ORDER BY u.xp DESC
             LIMIT 50`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
                res.json({ leaderboard: rows });
            }
        );
    });

    /**
     * GET /api/leaderboard/territory
     * Leaderboard by territory count
     */
    router.get('/territory', (req, res) => {
        db.all(
            `SELECT u.id, u.username, u.color,
                    COUNT(t.grid_id) AS territory_count
             FROM users u
             LEFT JOIN territories t ON t.owner_id = u.id
             WHERE u.password_hash IS NOT NULL
             GROUP BY u.id
             ORDER BY territory_count DESC
             LIMIT 20`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch territory leaderboard.' });
                res.json({ leaderboard: rows });
            }
        );
    });

    return router;
};
