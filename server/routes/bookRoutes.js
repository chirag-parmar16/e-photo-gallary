const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const pageController = require('../controllers/pageController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

module.exports = (db) => {
    // Book CRUD
    router.get('/', authenticateToken, (req, res) => bookController.getBooks(req, res, db));
    router.post('/', authenticateToken, (req, res) => bookController.createBook(req, res, db));
    router.get('/:id', authenticateToken, (req, res) => bookController.getBook(req, res, db));
    router.put('/:id', authenticateToken, (req, res) => bookController.updateBook(req, res, db));
    router.delete('/:id', authenticateToken, (req, res) => bookController.deleteBook(req, res, db));

    // Book Pages (since they are nested under /books/:id/pages)
    router.get('/:id/pages', authenticateToken, (req, res) => pageController.getPages(req, res, db));
    router.post('/:id/pages', authenticateToken, upload.array('media'), (req, res) => pageController.createPage(req, res, db));

    // Page Reorder
    router.put('/:id/reorder', authenticateToken, (req, res) => pageController.reorderPages(req, res, db));

    return router;
};
