module.exports = {
    // Simulated Gateway Configuration
    gateway: {
        name: 'Memoria Premium Gateway',
        processingDelay: 2000, // ms
        currency: 'INR'
    },
    // Production-ready: prices are defined here, not on the frontend
    plans: {
        'basic': {
            id: 'basic',
            name: 'Basic Plan',
            amount: 500, // INR 500
            currency: 'INR',
            days: 30
        },
        'pro': {
            id: 'pro',
            name: 'Pro Plan',
            amount: 1200, // INR 1200
            currency: 'INR',
            days: 30
        }
    }
};
