const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {
    // Initiate payment and create Razorpay order
    router.post('/initiate', authenticateToken, (req, res) => paymentController.initiatePayment(req, res, db));

    // Verify payment after frontend success
    router.post('/verify', authenticateToken, (req, res) => paymentController.verifyPayment(req, res, db));

    // Razorpay Webhook
    // Note: If you use a global body-parser, ensure this route gets the raw body if needed.
    // Razorpay SDK verifyWebhookSignature usually needs the raw string body.
    router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res, db));

    return router;
};
