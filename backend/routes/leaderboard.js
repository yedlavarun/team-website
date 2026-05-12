const express = require('express');
const router = express.Router();

module.exports = (db) => {
    router.get('/', (req, res) => {
        db.all(
            `SELECT u.id, u.username, u.color, u.xp, u.level,
                    s.total_distance, s.workout_count
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

    return router;
};
