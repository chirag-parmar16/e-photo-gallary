const paymentService = require('../services/payment/PaymentService');

const initiatePayment = async (req, res, db) => {
    try {
        const { planId } = req.body;
        const userId = req.user.id;

        if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        const paymentData = await paymentService.createPayment(db, { userId, planId });
        res.json(paymentData);
    } catch (err) {
        console.error('[INITIATE_SIM_PAYMENT_ERROR]', err);
        res.status(500).json({ error: err.message });
    }
};

const verifyPayment = async (req, res, db) => {
    try {
        const { transactionId, mockPaymentId, paymentDetails } = req.body;

        if (!transactionId || !mockPaymentId) {
            return res.status(400).json({ error: 'Missing simulation data' });
        }

        const result = await paymentService.handlePaymentSuccess(db, {
            transactionId,
            mockPaymentId,
            paymentDetails
        });

        res.json(result);
    } catch (err) {
        console.error('[VERIFY_SIM_PAYMENT_ERROR]', err);
        res.status(500).json({ error: err.message });
    }
};

const handleWebhook = async (req, res, db) => {
    // Webhooks are fully disabled for simulation
    res.status(200).json({ status: 'simulation_active_no_webhooks' });
};

module.exports = {
    initiatePayment,
    verifyPayment,
    handleWebhook
};
