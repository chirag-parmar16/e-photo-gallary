const simulatedGateway = require('./SimulatedGateway');

class PaymentService {
    /**
     * Fetch plan definition from the DB
     */
    async _getPlan(db, planKey) {
        const plan = await db.get('SELECT * FROM subscription_plans WHERE plan_key = ? AND is_active = 1', [planKey]);
        if (!plan) throw new Error(`Invalid or inactive plan: "${planKey}"`);
        return plan;
    }

    /**
     * Create a new payment record and initiate simulated transaction
     */
    async createPayment(db, { userId, planId }) {
        const plan = await this._getPlan(db, planId);

        // Create Mock Transaction
        const transaction = await simulatedGateway.createTransaction({
            amount: plan.price,
            currency: plan.currency || 'INR',
            planId,
            userId
        });

        // Store pending payment in DB
        await db.run(
            `INSERT INTO payments (user_id, plan_id, razorpay_order_id, amount, currency, status, gateway) 
             VALUES (?, ?, ?, ?, ?, 'pending', 'simulated')`,
            [userId, planId, transaction.id, plan.price, plan.currency || 'INR']
        );

        return {
            transactionId: transaction.id,
            amount: plan.price,
            currency: plan.currency || 'INR',
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

        // 4. Fetch plan from DB and update user subscription
        const plan = await this._getPlan(db, payment.plan_id);
        await this._activateSubscription(db, payment.user_id, plan);

        console.log(`[SIM_PAYMENT_SUCCESS] User: ${payment.user_id}, Plan: ${payment.plan_id}, Tx: ${transactionId}`);
        return { success: true };
    }

    async _activateSubscription(db, userId, plan) {
        const user = await db.get('SELECT subscription_end FROM users WHERE id = ?', [userId]);

        const currentEnd = (user && user.subscription_end && new Date(user.subscription_end) > new Date())
            ? new Date(user.subscription_end)
            : new Date();

        currentEnd.setDate(currentEnd.getDate() + (plan.days || 30));
        const formattedDate = currentEnd.toISOString().slice(0, 19).replace('T', ' ');

        await db.run(
            'UPDATE users SET subscription_plan = ?, subscription_end = ? WHERE id = ?',
            [plan.plan_key, formattedDate, userId]
        );
    }
}

module.exports = new PaymentService();
