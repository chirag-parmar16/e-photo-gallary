require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDb } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// --- LOCAL FILE STORAGE ---
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'images'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'videos'), { recursive: true });

// Database connection & Routes Initialization
initDb().then(db => {
    // Mount routes
    app.use('/api/auth', authRoutes(db));
    app.use('/api/books', bookRoutes(db));
    app.use('/api/admin', adminRoutes(db));
    app.use('/api', apiRoutes(db));

    // Fallback for HTML5 History API routing (Single Page Application)
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, '../public/index.html'));
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
