const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// The original getMe in index.js did not use `authenticateToken` middleware 
// because it gracefully returns { authenticated: false } if the token is invalid/missing.
// However, the `getMe` inside authController expects `req.user.id` to be set by `authenticateToken`.
// Let's modify the route to match how authController expects it or add a custom wrapper.

const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticateToken } = require('../middleware/authMiddleware');

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return acc;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
}

function getTokenFromRequest(req) {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    if (bearerToken) return bearerToken;
    const cookies = parseCookies(req.headers.cookie);
    return cookies.session || null;
}

module.exports = (db) => {
    router.post('/login', (req, res) => authController.login(req, res, db));
    router.post('/register', (req, res) => authController.register(req, res, db));

    // /me is special: it shouldn't 401, just returns authenticated: false
    router.get('/me', async (req, res) => {
        try {
            const token = getTokenFromRequest(req);
            if (!token) return res.json({ authenticated: false });

            jwt.verify(token, JWT_SECRET, async (err, payload) => {
                if (err || !payload?.id) return res.json({ authenticated: false });
                const user = await db.get('SELECT id, email, role, display_name, subscription_end FROM users WHERE id = ?', payload.id);
                if (!user) return res.json({ authenticated: false });
                res.json({
                    authenticated: true,
                    id: user.id,
                    role: user.role,
                    display_name: user.display_name,
                    subscription_end: user.subscription_end
                });
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/logout', (req, res) => {
        res.clearCookie('session', {
            httpOnly: false,
            secure: false, // process.env.NODE_ENV === 'production'
            sameSite: 'lax'
        });
        res.json({ success: true });
    });

    router.put('/profile', authenticateToken, async (req, res) => {
        const { display_name } = req.body;
        try {
            await db.run('UPDATE users SET display_name = ? WHERE id = ?', [display_name || '', req.user.id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
