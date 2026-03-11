const simulatedGateway = require('./SimulatedGateway');
const config = require('./paymentConfig');

class PaymentService {
    /**
     * Create a new payment record and initiate simulated transaction
     */
    async createPayment(db, { userId, planId }) {
        const plan = config.plans[planId];
        if (!plan) throw new Error('Invalid plan selection');

        // Create Mock Transaction
        const transaction = await simulatedGateway.createTransaction({
            amount: plan.amount,
            currency: plan.currency,
            planId,
            userId
        });

        // Store pending payment in DB (Reusing table for consistency)
        await db.run(
            `INSERT INTO payments (user_id, plan_id, razorpay_order_id, amount, currency, status, gateway) 
             VALUES (?, ?, ?, ?, ?, 'pending', 'simulated')`,
            [userId, planId, transaction.id, plan.amount, plan.currency]
        );

        return {
            transactionId: transaction.id,
            amount: plan.amount,
            currency: plan.currency,
            planName: plan.name
        };
    }

    /**
     * Verify and complete a simulated payment
     */
    async handlePaymentSuccess(db, { transactionId, mockPaymentId }) {
        // 1. Check if already processed
        const payment = await db.get('SELECT * FROM payments WHERE razorpay_order_id = ?', [transactionId]);
        if (!payment) throw new Error('Transaction record not found');
        if (payment.status === 'success') return { success: true, message: 'Already processed' };

        // 2. Mock verification
        if (!mockPaymentId || !mockPaymentId.startsWith('pay_sim_')) {
            throw new Error('Invalid simulator signal');
        }

        // 3. Mark payment as SUCCESS
        await db.run(
            'UPDATE payments SET status = "success", razorpay_payment_id = ? WHERE id = ?',
            [mockPaymentId, payment.id]
        );

        // 4. Update User Subscription
        const plan = config.plans[payment.plan_id];
        await this._activateSubscription(db, payment.user_id, plan);

        console.log(`[SIM_PAYMENT_SUCCESS] User: ${payment.user_id}, Tx: ${transactionId}`);
        return { success: true };
    }

    async _activateSubscription(db, userId, plan) {
        const user = await db.get('SELECT subscription_end FROM users WHERE id = ?', userId);
        
        const currentEnd = (user.subscription_end && new Date(user.subscription_end) > new Date())
            ? new Date(user.subscription_end)
            : new Date();

        currentEnd.setDate(currentEnd.getDate() + plan.days);
        const formattedDate = currentEnd.toISOString().slice(0, 19).replace('T', ' ');

        await db.run(
            'UPDATE users SET subscription_plan = ?, subscription_end = ? WHERE id = ?',
            [plan.id, formattedDate, userId]
        );

        // Track in legacy table
        await db.run(
            'INSERT INTO transactions (user_id, plan, amount, status) VALUES (?, ?, ?, "completed")',
            [userId, plan.id, plan.amount, 'completed']
        );
    }
}

module.exports = new PaymentService();
