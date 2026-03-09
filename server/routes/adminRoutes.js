const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

const adminAuth = [authenticateToken, requireAdmin];

module.exports = (db) => {
    router.get('/users', adminAuth, (req, res) => authController.getUsers(req, res, db));

    // Admin user creation bypassing self-register logic
    const bcrypt = require('bcryptjs');
    router.post('/users', adminAuth, async (req, res) => {
        try {
            const { email, password, role } = req.body;
            if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
            const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
            if (existing) return res.status(400).json({ error: 'Email already taken' });
            const hashedPassword = await bcrypt.hash(password, 10);
            const userRole = role === 'admin' ? 'admin' : 'user';
            await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
                [email, hashedPassword, userRole]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/users/:id', adminAuth, (req, res) => authController.deleteUser(req, res, db));

    router.put('/users/:id/subscription', adminAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const user = await db.get('SELECT subscription_end FROM users WHERE id = ?', id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            // Add 1 month to existing or current date
            const currentEnd = user.subscription_end ? new Date(user.subscription_end) : new Date();
            if (currentEnd < new Date()) currentEnd.setTime(new Date().getTime());
            currentEnd.setMonth(currentEnd.getMonth() + 1);

            const formattedDate = currentEnd.toISOString().slice(0, 19).replace('T', ' ');
            await db.run('UPDATE users SET subscription_end = ? WHERE id = ?', [formattedDate, id]);

            res.json({ success: true, subscription_end: formattedDate });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/stats', adminAuth, (req, res) => adminController.getStats(req, res, db));
    router.put('/settings', adminAuth, (req, res) => adminController.updateSettings(req, res, db));

    return router;
};
