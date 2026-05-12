const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

module.exports = (db) => {

    /**
     * POST /api/sessions
     * Create a new workout session.
     * Body: { distance, avgSpeed, duration, calories }
     * Token: required — userId comes from token (never from body)
     */
    router.post('/', authenticateToken, (req, res) => {
        const userId = req.user.id;
        const { distance, avgSpeed, duration, calories } = req.body;

        if (!distance || !avgSpeed || !duration || !calories) {
            return res.status(400).json({ error: 'distance, avgSpeed, duration, and calories are required.' });
        }

        const sessionSql = `
            INSERT INTO sessions (user_id, distance, avg_speed, duration, calories)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(sessionSql, [userId, distance, avgSpeed, duration, calories], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to save session.' });

            const sessionId = this.lastID;

            // Update aggregated stats
            const statsSql = `
                UPDATE stats SET
                    total_distance = total_distance + ?,
                    calories_burned = calories_burned + ?,
                    workout_count = workout_count + 1,
                    avg_speed = (
                        SELECT AVG(avg_speed) FROM sessions WHERE user_id = ?
                    )
                WHERE user_id = ?
            `;
            db.run(statsSql, [distance, calories, userId, userId], (err) => {
                if (err) console.error('Stats update error:', err);
            });

            // Award XP: 10 per km + speed bonus
            const xpGained = Math.round(distance * 10 + avgSpeed * 2);
            db.run(
                `UPDATE users SET xp = xp + ?, streak = streak + 1 WHERE id = ?`,
                [xpGained, userId],
                (err) => {
                    if (err) console.error('XP update error:', err);
                }
            );

            // Check for level up (every 500 XP)
            db.get(`SELECT xp FROM users WHERE id = ?`, [userId], (err, row) => {
                if (row) {
                    const newLevel = Math.floor(row.xp / 500) + 1;
                    db.run(`UPDATE users SET level = ? WHERE id = ?`, [newLevel, userId]);
                }
            });

            res.status(201).json({
                message: 'Session saved!',
                sessionId,
                xpGained
            });
        });
    });

    /**
     * GET /api/sessions
     * Get the authenticated user's workout history.
     * Query params: limit (default 20), offset (default 0)
     */
    router.get('/', authenticateToken, (req, res) => {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        db.all(
            `SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [userId, limit, offset],
            (err, rows) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch sessions.' });
                res.json({ sessions: rows });
            }
        );
    });

    /**
     * GET /api/sessions/stats
     * Get current user's aggregated stats.
     */
    router.get('/stats', authenticateToken, (req, res) => {
        const userId = req.user.id;

        db.get(
            `SELECT s.*, u.xp, u.level, u.streak
             FROM stats s
             JOIN users u ON u.id = s.user_id
             WHERE s.user_id = ?`,
            [userId],
            (err, row) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch stats.' });
                if (!row) return res.status(404).json({ error: 'Stats not found.' });
                res.json({ stats: row });
            }
        );
    });

    return router;
};
