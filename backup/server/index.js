require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.mimetype.startsWith('video/') ? 'videos' : 'images';
        cb(null, path.join(__dirname, `../public/uploads/${type}`));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Database connection
let db;
initDb().then(database => {
    db = database;
    console.log('Connected to SQLite database');
});

// Admin Auth Middleware (Basic)
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required');
    }
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    // Simple check - in production use env vars
    if (user === 'admin' && pass === 'premium-memory') {
        next();
    } else {
        res.status(401).send('Invalid credentials');
    }
};

// API Routes

// Get all settings
app.get('/api/settings', async (req, res) => {
    try {
        const settingsArr = await db.all('SELECT * FROM settings');
        const settings = {};
        settingsArr.forEach(s => settings[s.key] = s.value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get dashboard stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
        const pageCount = await db.get('SELECT COUNT(*) as count FROM pages');
        const mediaCount = await db.get('SELECT COUNT(*) as count FROM page_media');
        res.json({
            totalPages: pageCount.count,
            totalMedia: mediaCount.count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update settings
app.put('/api/admin/settings', adminAuth, async (req, res) => {
    try {
        const { cover_title, end_title } = req.body;
        if (cover_title !== undefined) {
            await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES ("cover_title", ?)', [cover_title]);
        }
        if (end_title !== undefined) {
            await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES ("end_title", ?)', [end_title]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all pages with their media
app.get('/api/pages', async (req, res) => {
    try {
        const pages = await db.all('SELECT * FROM pages ORDER BY page_order ASC');
        for (let page of pages) {
            page.media = await db.all('SELECT * FROM page_media WHERE page_id = ?', [page.id]);
        }
        res.json(pages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload multiple media and create page
app.post('/api/admin/pages', adminAuth, upload.array('media', 4), async (req, res) => {
    try {
        const { text_content } = req.body;

        // Auto-calculate next page_order
        const lastPage = await db.get('SELECT MAX(page_order) as maxOrder FROM pages');
        const page_order = (lastPage.maxOrder || 0) + 1;

        const result = await db.run(
            'INSERT INTO pages (text_content, page_order) VALUES (?, ?)',
            [text_content, page_order]
        );
        const page_id = result.lastID;

        // Associate media if any files were uploaded
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaPath = `/uploads/${file.mimetype.startsWith('video/') ? 'videos' : 'images'}/${file.filename}`;
                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path) VALUES (?, ?, ?)',
                    [page_id, file.mimetype.startsWith('video/') ? 'video' : 'image', mediaPath]
                );
            }
        }

        res.json({ success: true, pageId: page_id });
    } catch (err) {
        console.error('Server error during upload:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single page for editing
app.get('/api/admin/pages/:id', adminAuth, async (req, res) => {
    try {
        const page = await db.get('SELECT * FROM pages WHERE id = ?', [req.params.id]);
        if (!page) return res.status(404).json({ error: 'Page not found' });

        const media = await db.all('SELECT * FROM page_media WHERE page_id = ?', [req.params.id]);
        page.media = media;
        res.json(page);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update page content & media
app.put('/api/admin/pages/:id', adminAuth, upload.array('media', 4), async (req, res) => {
    try {
        const { text_content, remove_media_ids } = req.body;
        const pageId = req.params.id;

        // Update text
        await db.run(
            'UPDATE pages SET text_content = ? WHERE id = ?',
            [text_content, pageId]
        );

        // Handle selective removals (the 'x' button on existing images)
        if (remove_media_ids) {
            const idsToRemove = JSON.parse(remove_media_ids);
            if (idsToRemove.length > 0) {
                const fs = require('fs');
                for (const mediaId of idsToRemove) {
                    const media = await db.get('SELECT media_path FROM page_media WHERE id = ? AND page_id = ?', [mediaId, pageId]);
                    if (media) {
                        // Check if file is shared
                        const otherUsage = await db.get('SELECT id FROM page_media WHERE media_path = ? AND id != ?', [media.media_path, mediaId]);
                        if (!otherUsage) {
                            const fullPath = path.join(__dirname, '../public', media.media_path);
                            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                        }
                        await db.run('DELETE FROM page_media WHERE id = ?', [mediaId]);
                    }
                }
            }
        }

        // Insert new media
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaPath = `/uploads/${file.mimetype.startsWith('video/') ? 'videos' : 'images'}/${file.filename}`;
                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path) VALUES (?, ?, ?)',
                    [pageId, file.mimetype.startsWith('video/') ? 'video' : 'image', mediaPath]
                );
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete page
app.delete('/api/admin/pages/:id', adminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const media = await db.all('SELECT media_path FROM page_media WHERE page_id = ?', [req.params.id]);

        // Before deleting the page, we need to check if its media is used elsewhere
        for (const m of media) {
            try {
                // Check if this media_path is used by any OTHER page
                const otherUsage = await db.get(
                    'SELECT id FROM page_media WHERE media_path = ? AND page_id != ?',
                    [m.media_path, req.params.id]
                );

                if (!otherUsage) {
                    const fullPath = path.join(__dirname, '../public', m.media_path);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                }
            } catch (err) {
                console.error('Failed to delete file:', m.media_path, err);
            }
        }

        await db.run('DELETE FROM pages WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
