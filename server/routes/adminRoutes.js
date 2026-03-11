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
            const { plan, days, directDate } = req.body;

            const user = await db.get('SELECT subscription_end FROM users WHERE id = ?', id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            let formattedDate = null;

            if (directDate) {
                // Use the specific date provided
                formattedDate = `${directDate} 23:59:59`;
            } else if (days !== undefined) {
                if (days > 0) {
                    // Add days to current date or existing end date if it's in the future
                    const currentEnd = (user.subscription_end && new Date(user.subscription_end) > new Date())
                        ? new Date(user.subscription_end)
                        : new Date();

                    currentEnd.setDate(currentEnd.getDate() + parseInt(days));
                    formattedDate = currentEnd.toISOString().slice(0, 19).replace('T', ' ');
                } else if (days === 0) {
                    // Lifetime / Far future
                    formattedDate = '2099-12-31 23:59:59';
                }
            }

            // Keep existing end date if nothing new provided (though usually one will be)
            if (formattedDate === null && user.subscription_end) {
                formattedDate = user.subscription_end;
            }

            await db.run(
                'UPDATE users SET subscription_plan = ?, subscription_end = ? WHERE id = ?',
                [plan || 'free', formattedDate, id]
            );

            // Record Transaction if plan is basic or pro
            if (plan === 'basic' || plan === 'pro') {
                const amount = plan === 'basic' ? 5.00 : 12.00; // Mock prices
                await db.run(
                    'INSERT INTO transactions (user_id, plan, amount) VALUES (?, ?, ?)',
                    [id, plan, amount]
                );
            }

            res.json({ success: true, subscription_plan: plan, subscription_end: formattedDate });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/stats', adminAuth, (req, res) => adminController.getStats(req, res, db));
    router.get('/payments', adminAuth, (req, res) => adminController.getPayments(req, res, db));
    router.put('/settings', adminAuth, (req, res) => adminController.updateSettings(req, res, db));

    return router;
};
