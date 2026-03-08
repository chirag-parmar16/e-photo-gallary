require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const LEGACY_SETTINGS_DEFAULTS = {
    cover_title: 'Our Timeless Journey',
    cover_subtitle: 'A collection of memories, frozen in time.',
    instruction_text: 'Tap to open',
    end_title: 'THE END'
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// --- LOCAL FILE STORAGE ---
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
fs.mkdirSync(path.join(UPLOAD_DIR, 'images'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'videos'), { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function deleteFile(filePath) {
    if (!filePath || filePath.startsWith('http')) return;
    try {
        const fullPath = filePath.startsWith('/uploads/')
            ? path.join(__dirname, '../public', filePath)
            : filePath;
        fs.unlink(fullPath, () => { });
    } catch (err) {
        console.warn('File delete skipped:', err.message);
    }
}

// Database connection
let db;
initDb().then(database => {
    db = database;
});

// --- AUTH MIDDLEWARE ---

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return acc;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
}

function getTokenFromRequest(req) {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    if (bearerToken) return bearerToken;
    const cookies = parseCookies(req.headers.cookie);
    return cookies.session || null;
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return 'hidden';
    const [local, domain] = email.split('@');
    const localMasked = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}`;
    return `${localMasked}@${domain}`;
}

const authenticateToken = (req, res, next) => {
    const token = getTokenFromRequest(req);
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

async function tableExists(tableName) {
    const row = await db.get(
        'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [tableName]
    );
    return Boolean(row);
}

async function getLegacySettingsFromBooks() {
    const book = await db.get(`
        SELECT cover_title, cover_subtitle, instruction_text, end_title
        FROM books
        ORDER BY id ASC
        LIMIT 1
    `);
    return book || {};
}

// Legacy Admin Auth
const adminAuth = [authenticateToken, requireAdmin];

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({ role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) return res.json({ authenticated: false });

        jwt.verify(token, JWT_SECRET, async (err, payload) => {
            if (err || !payload?.id) return res.json({ authenticated: false });
            const user = await db.get('SELECT id, email, role FROM users WHERE id = ?', payload.id);
            if (!user) return res.json({ authenticated: false });
            res.json({ authenticated: true, id: user.id, role: user.role });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.json({ success: true });
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Incorrect current password' });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SETTINGS ---

app.get('/api/settings', async (req, res) => {
    try {
        const settings = {};
        if (await tableExists('settings')) {
            const settingsArr = await db.all('SELECT * FROM settings');
            settingsArr.forEach(s => { settings[s.key] = s.value; });
        }
        const bookSettings = await getLegacySettingsFromBooks();
        res.json({ ...LEGACY_SETTINGS_DEFAULTS, ...bookSettings, ...settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN ROUTES ---

app.get('/api/admin/users', adminAuth, async (req, res) => {
    try {
        const users = await db.all('SELECT id, email, role, created_at FROM users');
        const safeUsers = users.map(u => ({
            id: u.id,
            role: u.role,
            created_at: u.created_at,
            email_masked: maskEmail(u.email)
        }));
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

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

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
    try {
        const userIdToDelete = req.params.id;
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

app.get('/api/admin/stats', adminAuth, async (req, res) => {
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

app.put('/api/admin/settings', adminAuth, async (req, res) => {
    try {
        const { cover_title, end_title } = req.body;

        const adminBook = await db.get(
            'SELECT id FROM books WHERE user_id = ? ORDER BY id ASC LIMIT 1',
            [req.user.id]
        );

        if (adminBook && (cover_title !== undefined || end_title !== undefined)) {
            await db.run(
                `UPDATE books SET
                    cover_title = COALESCE(?, cover_title),
                    end_title = COALESCE(?, end_title)
                 WHERE id = ?`,
                [cover_title, end_title, adminBook.id]
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BOOK & PAGE ROUTES ---

app.get('/api/books', authenticateToken, async (req, res) => {
    try {
        const books = await db.all('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

app.get('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const book = await db.get('SELECT * FROM books WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!book) return res.status(404).json({ error: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

app.delete('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const bookId = req.params.id;
        const userId = req.user.id;

        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [bookId, userId]);
        if (!book) return res.status(404).json({ error: 'Book not found' });

        await db.run('DELETE FROM page_media WHERE page_id IN (SELECT id FROM pages WHERE book_id = ?)', [bookId]);
        await db.run('DELETE FROM pages WHERE book_id = ?', [bookId]);
        await db.run('DELETE FROM books WHERE id = ?', [bookId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PAGE ROUTES ---

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

app.post('/api/books/:id/pages', authenticateToken, upload.array('media'), async (req, res) => {
    try {
        const bookId = req.params.id;
        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [bookId, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const { text_content, media_frames } = req.body;
        const lastPage = await db.get('SELECT MAX(page_order) as maxOrder FROM pages WHERE book_id = ?', bookId);
        const newOrder = (lastPage && lastPage.maxOrder !== null) ? lastPage.maxOrder + 1 : 1;

        const result = await db.run(
            'INSERT INTO pages (book_id, text_content, page_order) VALUES (?, ?, ?)',
            [bookId, text_content || '', newOrder]
        );
        const pageId = result.lastID;

        if (req.files && req.files.length > 0) {
            const framesArray = media_frames ? JSON.parse(media_frames) : [];
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const frameStyle = framesArray[i] || 'square';
                const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
                const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const filename = unique + (type === 'video' ? path.extname(file.originalname) : '.webp');
                const relativePath = '/uploads/' + (type === 'video' ? 'videos/' : 'images/') + filename;
                const fullPath = path.join(__dirname, '../public', relativePath);

                if (type === 'image') {
                    await sharp(file.buffer)
                        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(fullPath);
                } else {
                    fs.writeFileSync(fullPath, file.buffer);
                }

                await db.run(
                    // insert with frame_style
                    'INSERT INTO page_media (page_id, type, media_path, frame_style) VALUES (?, ?, ?, ?)',
                    [pageId, type, relativePath, frameStyle]
                );
            }
        }

        res.json({ success: true, id: pageId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/pages/:id', authenticateToken, upload.array('media'), async (req, res) => {
    try {
        const pageId = req.params.id;
        const page = await db.get(`
            SELECT p.id, p.book_id, b.user_id
            FROM pages p
            JOIN books b ON p.book_id = b.id
            WHERE p.id = ?`, pageId);

        if (!page || page.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        const { text_content, delete_media_ids, media_frames, existing_media_frames } = req.body;
        await db.run('UPDATE pages SET text_content = ? WHERE id = ?', [text_content, pageId]);

        if (existing_media_frames) {
            const parsedFrames = JSON.parse(existing_media_frames);
            for (const mediaId in parsedFrames) {
                await db.run('UPDATE page_media SET frame_style = ? WHERE id = ? AND page_id = ?', [parsedFrames[mediaId], mediaId, pageId]);
            }
        }

        if (delete_media_ids) {
            const ids = JSON.parse(delete_media_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                const mediaToDelete = await db.all(`SELECT media_path FROM page_media WHERE id IN (${placeholders}) AND page_id = ?`, [...ids, pageId]);
                for (const m of mediaToDelete) { await deleteFile(m.media_path); }
                await db.run(`DELETE FROM page_media WHERE id IN (${placeholders}) AND page_id = ?`, [...ids, pageId]);
            }
        }

        if (req.files && req.files.length > 0) {
            const framesArray = media_frames ? JSON.parse(media_frames) : [];
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const frameStyle = framesArray[i] || 'square';
                const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
                const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const filename = unique + (type === 'video' ? path.extname(file.originalname) : '.webp');
                const relativePath = '/uploads/' + (type === 'video' ? 'videos/' : 'images/') + filename;
                const fullPath = path.join(__dirname, '../public', relativePath);

                if (type === 'image') {
                    await sharp(file.buffer)
                        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(fullPath);
                } else {
                    fs.writeFileSync(fullPath, file.buffer);
                }

                await db.run(
                    // insert with frame_style mapping
                    'INSERT INTO page_media (page_id, type, media_path, frame_style) VALUES (?, ?, ?, ?)',
                    [pageId, type, relativePath, frameStyle]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pages/:id', authenticateToken, async (req, res) => {
    try {
        const media = await db.all('SELECT media_path FROM page_media WHERE page_id = ?', req.params.id);
        for (const m of media) { await deleteFile(m.media_path); }
        await db.run('DELETE FROM pages WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/books/:id/reorder', authenticateToken, async (req, res) => {
    try {
        const bookId = req.params.id;
        const { orderedPageIds } = req.body; // array of page ids in new order

        const book = await db.get('SELECT id FROM books WHERE id = ? AND user_id = ?', [bookId, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        if (!Array.isArray(orderedPageIds)) {
            return res.status(400).json({ error: 'orderedPageIds must be an array' });
        }

        for (let i = 0; i < orderedPageIds.length; i++) {
            await db.run('UPDATE pages SET page_order = ? WHERE id = ? AND book_id = ?', [i + 1, orderedPageIds[i], bookId]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    try {
        const media = await db.get(`
            SELECT m.id, m.media_path, b.user_id
            FROM page_media m
            JOIN pages p ON m.page_id = p.id
            JOIN books b ON p.book_id = b.id
            WHERE m.id = ?`, req.params.id);

        if (!media || media.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        await deleteFile(media.media_path);
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
