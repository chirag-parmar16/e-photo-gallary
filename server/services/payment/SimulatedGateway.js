const crypto = require('crypto');

class SimulatedGateway {
    /**
     * Create a Mock Transaction
     */
    async createTransaction({ amount, currency, planId, userId }) {
        // Generate a mock order ID
        const orderId = `order_sim_${crypto.randomBytes(4).toString('hex')}`;
        
        console.log(`[SIM_GATEWAY] Created Mock Order: ${orderId} for Plan: ${planId}`);
        
        return {
            id: orderId,
            amount,
            currency,
            status: 'created'
        };
    }

    /**
     * Verify a Mock Signature
     * In a simulation, we just check if it matches our expected "test" format
     */
    verifyMockSignature(orderId, paymentId) {
        return paymentId.startsWith('pay_sim_');
    }
}

module.exports = new SimulatedGateway();
