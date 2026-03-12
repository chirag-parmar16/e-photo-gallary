require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDb } = require('./database');
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- LOCAL FILE STORAGE ---
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'images'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'videos'), { recursive: true });

// Database connection & Routes Initialization
initDb().then(db => {
    // Landing page at root (MUST be before express.static and other routes)
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/landing.html'));
    });

    app.use(express.static(path.join(__dirname, '../public'), { index: false }));

    // Mount routes
    app.use('/api/auth', authRoutes(db));
    app.use('/api/books', bookRoutes(db));
    app.use('/api/admin', adminRoutes(db));
    app.use('/api/payments', paymentRoutes(db));
    app.use('/api', apiRoutes(db));

    // View Routes (Multi-Page Application)
    app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/views/login.html')));
    app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/views/dashboard.html')));
    app.get('/albums', (req, res) => res.sendFile(path.join(__dirname, '../public/views/albums.html')));
    app.get('/users', (req, res) => res.sendFile(path.join(__dirname, '../public/views/users.html')));
    app.get('/users', (req, res) => res.sendFile(path.join(__dirname, '../public/views/users.html')));
    app.get('/subscriptions', (req, res) => res.sendFile(path.join(__dirname, '../public/views/subscriptions.html')));
    app.get('/subscription_plans', (req, res) => res.sendFile(path.join(__dirname, '../public/views/subscription_plans.html')));
    app.get('/book/:id', (req, res) => res.sendFile(path.join(__dirname, '../public/views/editor.html')));
    app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, '../public/views/profile.html')));

    // 404 handler for non-API routes could go here
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api') && req.method === 'GET') {
            res.status(404).send('Not Found');
        } else {
            next();
        }
    });

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
