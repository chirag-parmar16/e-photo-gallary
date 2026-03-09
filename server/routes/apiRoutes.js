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

    return router;
};
