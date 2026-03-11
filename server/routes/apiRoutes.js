const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

module.exports = (db) => {
    // Pages endpoints (PUT and DELETE for /api/pages/:id)
    router.put('/pages/:id', authenticateToken, upload.array('media'), (req, res) => pageController.updatePage(req, res, db));
    router.delete('/pages/:id', authenticateToken, (req, res) => pageController.deletePage(req, res, db));

    // Media endpoint (DELETE /api/media/:id)
    router.delete('/media/:id', authenticateToken, (req, res) => pageController.deleteMedia(req, res, db));

    // Public endpoints
    router.get('/public/books/:uuid', (req, res) => pageController.getPublicBook(req, res, db));
    router.get('/settings', (req, res) => adminController.getSettings(req, res, db));
    
    // Public: list active subscription plans (used by user-facing subscription page)
    router.get('/plans', async (req, res) => {
        try {
            const plans = await db.all('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC');
            res.json(plans);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
};
