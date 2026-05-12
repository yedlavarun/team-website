const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

module.exports = (db) => {

    /**
     * POST /api/auth/register
     * Body: { username, email, password }
     */
    router.post('/register', async (req, res) => {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        try {
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            const sql = `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`;
            db.run(sql, [username, email, passwordHash], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Username or email already taken.' });
                    }
                    return res.status(500).json({ error: 'Registration failed.' });
                }

                const userId = this.lastID;

                // Create default stats row
                db.run(`INSERT INTO stats (user_id) VALUES (?)`, [userId]);

                // Generate token
                const token = jwt.sign(
                    { id: userId, username, email },
                    JWT_SECRET,
                    { expiresIn: TOKEN_EXPIRY }
                );

                res.status(201).json({
                    message: 'Account created successfully!',
                    token,
                    user: { id: userId, username, email }
                });
            });
        } catch (err) {
            res.status(500).json({ error: 'Server error during registration.' });
        }
    });

    /**
     * POST /api/auth/login
     * Body: { email, password }
     */
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Server error.' });
            if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

            try {
                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

                const token = jwt.sign(
                    { id: user.id, username: user.username, email: user.email },
                    JWT_SECRET,
                    { expiresIn: TOKEN_EXPIRY }
                );

                res.json({
                    message: 'Login successful!',
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        xp: user.xp,
                        level: user.level,
                        streak: user.streak,
                        color: user.color
                    }
                });
            } catch (err) {
                res.status(500).json({ error: 'Server error during login.' });
            }
        });
    });

    /**
     * GET /api/auth/me
     * Returns current user profile (requires token)
     */
    router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
        db.get(
            `SELECT u.id, u.username, u.email, u.xp, u.level, u.streak, u.color,
                    s.total_distance, s.avg_speed, s.calories_burned, s.workout_count
             FROM users u
             LEFT JOIN stats s ON s.user_id = u.id
             WHERE u.id = ?`,
            [req.user.id],
            (err, row) => {
                if (err) return res.status(500).json({ error: 'Server error.' });
                if (!row) return res.status(404).json({ error: 'User not found.' });
                res.json({ user: row });
            }
        );
    });

    return router;
};
