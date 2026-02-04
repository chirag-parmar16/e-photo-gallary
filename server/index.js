require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { initDb } = require('./database');
const sharp = require('sharp');
const fs = require('fs').promises;

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

// --- AUTH MIDDLEWARE ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy Admin Auth Replacement (for existing routes temporarily)
const adminAuth = [authenticateToken, requireAdmin];

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

// --- ADMIN ROUTES ---

// Get all users
app.get('/api/admin/users', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const users = await db.all('SELECT id, email, role, created_at FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new user
app.post('/api/admin/users', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        // Check if user exists
        const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
        if (existing) return res.status(400).json({ error: 'Email already taken' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'user';

        await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, hashedPassword, userRole]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user
app.delete('/api/admin/users/:id', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const userIdToDelete = req.params.id;

        // Safety: Prevent admin from deleting themselves
        if (parseInt(userIdToDelete) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }

        const result = await db.run('DELETE FROM users WHERE id = ?', userIdToDelete);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get dashboard stats (Global)
app.get('/api/admin/stats', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const bookCount = await db.get('SELECT COUNT(*) as count FROM books');
        const mediaCount = await db.get('SELECT COUNT(*) as count FROM page_media');

        res.json({
            totalUsers: userCount.count,
            totalBooks: bookCount.count,
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

// --- BOOK & PAGE ROUTES ---

// List user's books
app.get('/api/books', authenticateToken, async (req, res) => {
    try {
        const books = await db.all('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new book
app.post('/api/books', authenticateToken, async (req, res) => {
    try {
        const { title, cover_title, cover_subtitle, instruction_text, end_title } = req.body;
        const uuid = crypto.randomUUID();

        const result = await db.run(
            `INSERT INTO books (user_id, title, cover_title, cover_subtitle, instruction_text, end_title, uuid) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                title || 'Untitled Album',
                cover_title || 'Our Journey',
                cover_subtitle || 'A collection of memories, frozen in time.',
                instruction_text || 'Tap to open',
                end_title || 'The End',
                uuid
            ]
        );
        res.json({ success: true, id: result.lastID, uuid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific book (Settings/Details)
app.get('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const book = await db.get('SELECT * FROM books WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!book) return res.status(404).json({ error: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update book settings
app.put('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const { title, cover_title, cover_subtitle, instruction_text, end_title } = req.body;
        const result = await db.run(
            `UPDATE books SET 
                title = COALESCE(?, title), 
                cover_title = COALESCE(?, cover_title),
                cover_subtitle = COALESCE(?, cover_subtitle),
                instruction_text = COALESCE(?, instruction_text),
                end_title = COALESCE(?, end_title)
             WHERE id = ? AND user_id = ?`,
            [title, cover_title, cover_subtitle, instruction_text, end_title, req.params.id, req.user.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Book not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete book
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const bookId = req.params.id;
        const userId = req.user.id;

        // Verify ownership
        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [bookId, userId]);
        if (!book) return res.status(404).json({ error: 'Book not found' });

        // Delete associated media files (optional, but keep DB clean)
        // For simplicity, we just delete DB entries as file cleanup is handled by disk management usually
        await db.run('DELETE FROM page_media WHERE page_id IN (SELECT id FROM pages WHERE book_id = ?)', [bookId]);
        await db.run('DELETE FROM pages WHERE book_id = ?', [bookId]);
        await db.run('DELETE FROM books WHERE id = ?', [bookId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete book
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const result = await db.run('DELETE FROM books WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Book not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SCOPED PAGE MANAGEMENT ---

// Get pages for a specific book
app.get('/api/books/:id/pages', authenticateToken, async (req, res) => {
    try {
        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const pages = await db.all('SELECT * FROM pages WHERE book_id = ? ORDER BY page_order ASC', req.params.id);
        for (let page of pages) {
            page.media = await db.all('SELECT * FROM page_media WHERE page_id = ? ORDER BY id ASC', page.id);
        }
        res.json(pages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add page to book
app.post('/api/books/:id/pages', authenticateToken, upload.array('media'), async (req, res) => {
    try {
        const bookId = req.params.id;
        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [bookId, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const { text_content } = req.body;

        // Auto-calculate order
        const lastPage = await db.get('SELECT MAX(page_order) as maxOrder FROM pages WHERE book_id = ?', bookId);
        const newOrder = (lastPage && lastPage.maxOrder !== null) ? lastPage.maxOrder + 1 : 1;

        const result = await db.run(
            'INSERT INTO pages (book_id, text_content, page_order) VALUES (?, ?, ?)',
            [bookId, text_content || '', newOrder]
        );

        const pageId = result.lastID;

        // Handle Media
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                let finalPath = file.path;
                const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('gif');
                const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

                if (isImage) {
                    const webpPath = file.path.replace(path.extname(file.path), '.webp');
                    await sharp(file.path)
                        .webp({ quality: 80 })
                        .toFile(webpPath);

                    // Delete original
                    await fs.unlink(file.path);
                    finalPath = webpPath;
                }

                // Convert absolute path to relative for public serving
                const relativePath = '/uploads/' + (type === 'video' ? 'videos/' : 'images/') + path.basename(finalPath);

                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path) VALUES (?, ?, ?)',
                    [pageId, type, relativePath]
                );
            }
        }

        res.json({ success: true, id: pageId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Page Content
app.put('/api/pages/:id', authenticateToken, upload.array('media'), async (req, res) => {
    try {
        const pageId = req.params.id;
        const page = await db.get(`
            SELECT p.id, p.book_id, b.user_id 
            FROM pages p 
            JOIN books b ON p.book_id = b.id 
            WHERE p.id = ?`, pageId);

        if (!page || page.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        const { text_content, delete_media_ids } = req.body;

        // Update text
        await db.run('UPDATE pages SET text_content = ? WHERE id = ?', [text_content, pageId]);

        // Remove marked media
        if (delete_media_ids) {
            const ids = JSON.parse(delete_media_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                await db.run(`DELETE FROM page_media WHERE id IN (${placeholders}) AND page_id = ?`, [...ids, pageId]);
            }
        }

        // Add New Media
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                let finalPath = file.path;
                const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('gif');
                const type = file.mimetype.startsWith('video/') ? 'video' : 'image';

                if (isImage) {
                    const webpPath = file.path.replace(path.extname(file.path), '.webp');
                    await sharp(file.path)
                        .webp({ quality: 80 })
                        .toFile(webpPath);

                    await fs.unlink(file.path);
                    finalPath = webpPath;
                }

                const relativePath = '/uploads/' + (type === 'video' ? 'videos/' : 'images/') + path.basename(finalPath);

                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path) VALUES (?, ?, ?)',
                    [pageId, type, relativePath]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Page
app.delete('/api/pages/:id', authenticateToken, async (req, res) => {
    try {
        const page = await db.get(`
            SELECT p.id, b.user_id 
            FROM pages p 
            JOIN books b ON p.book_id = b.id 
            WHERE p.id = ?`, req.params.id);

        if (!page || page.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        await db.run('DELETE FROM pages WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove single media item
app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    try {
        const media = await db.get(`
            SELECT m.id, b.user_id 
            FROM page_media m
            JOIN pages p ON m.page_id = p.id
            JOIN books b ON p.book_id = b.id
            WHERE m.id = ?`, req.params.id);

        if (!media || media.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        await db.run('DELETE FROM page_media WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PUBLIC ACCESS ---

app.get('/api/public/books/:uuid', async (req, res) => {
    try {
        const book = await db.get('SELECT * FROM books WHERE uuid = ?', req.params.uuid);
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const pages = await db.all('SELECT * FROM pages WHERE book_id = ? ORDER BY page_order ASC', book.id);
        for (let page of pages) {
            page.media = await db.all('SELECT * FROM page_media WHERE page_id = ? ORDER BY id ASC', page.id);
        }

        res.json({ book, pages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
