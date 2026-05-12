const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'cardio_wars_secret_key_change_in_prod';

/**
 * Middleware: Verify JWT token on protected routes.
 * Sets req.user = { id, username, email } on success.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { authenticateToken, JWT_SECRET };
