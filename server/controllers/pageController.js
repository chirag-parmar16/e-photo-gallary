const fs = require('fs');
const path = require('path');
const { deleteFile } = require('../services/fileService');
const { processAndSaveImage } = require('../services/imageService');

const getPages = async (req, res, db) => {
    try {
        const book = await db.get('SELECT id FROM books WHERE uuid = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const pages = await db.all('SELECT * FROM pages WHERE book_id = ? ORDER BY page_order ASC', book.id);
        for (let page of pages) {
            page.media = await db.all('SELECT * FROM page_media WHERE page_id = ? ORDER BY id ASC', page.id);
        }
        res.json(pages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createPage = async (req, res, db) => {
    try {
        const bookId = req.params.id; // From URL, this is a UUID
        const book = await db.get('SELECT id FROM books WHERE uuid = ? AND user_id = ?', [bookId, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const internalId = book.id;

        const { text_content, media_frames, border_style } = req.body;
        const lastPage = await db.get('SELECT MAX(page_order) as maxOrder FROM pages WHERE book_id = ?', internalId);
        const newOrder = (lastPage && lastPage.maxOrder !== null) ? lastPage.maxOrder + 1 : 1;

        const result = await db.run(
            'INSERT INTO pages (book_id, text_content, page_order, border_style) VALUES (?, ?, ?, ?)',
            [internalId, text_content || '', newOrder, border_style || 'none']
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
                const fullPath = path.join(__dirname, '../../public', relativePath);

                if (type === 'image') {
                    await processAndSaveImage(file.buffer, fullPath);
                } else {
                    fs.writeFileSync(fullPath, file.buffer);
                }

                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path, frame_style) VALUES (?, ?, ?, ?)',
                    [pageId, type, relativePath, frameStyle]
                );
            }
        }

        res.json({ success: true, id: pageId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePage = async (req, res, db) => {
    try {
        const pageId = req.params.id;
        const page = await db.get(`
            SELECT p.id, p.book_id, b.user_id
            FROM pages p
            JOIN books b ON p.book_id = b.id
            WHERE p.id = ?`, pageId);

        if (!page || page.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        const { text_content, delete_media_ids, media_frames, existing_media_frames, border_style } = req.body;

        await db.run(
            'UPDATE pages SET text_content = ?, border_style = COALESCE(?, border_style) WHERE id = ?',
            [text_content, border_style, pageId]
        );

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
                const fullPath = path.join(__dirname, '../../public', relativePath);

                if (type === 'image') {
                    await processAndSaveImage(file.buffer, fullPath);
                } else {
                    fs.writeFileSync(fullPath, file.buffer);
                }

                await db.run(
                    'INSERT INTO page_media (page_id, type, media_path, frame_style) VALUES (?, ?, ?, ?)',
                    [pageId, type, relativePath, frameStyle]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deletePage = async (req, res, db) => {
    try {
        const media = await db.all('SELECT media_path FROM page_media WHERE page_id = ?', req.params.id);
        for (const m of media) { await deleteFile(m.media_path); }
        await db.run('DELETE FROM pages WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const reorderPages = async (req, res, db) => {
    try {
        const bookId = req.params.id; // From URL, UUID
        const { orderedPageIds } = req.body;

        const book = await db.get('SELECT id FROM books WHERE uuid = ? AND user_id = ?', [bookId, req.user.id]);
        if (!book) return res.status(403).json({ error: 'Unauthorized' });

        const internalId = book.id;

        if (!Array.isArray(orderedPageIds)) {
            return res.status(400).json({ error: 'orderedPageIds must be an array' });
        }

        for (let i = 0; i < orderedPageIds.length; i++) {
            await db.run('UPDATE pages SET page_order = ? WHERE id = ? AND book_id = ?', [i + 1, orderedPageIds[i], internalId]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteMedia = async (req, res, db) => {
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
};

const getPublicBook = async (req, res, db) => {
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
};

module.exports = {
    getPages,
    createPage,
    updatePage,
    deletePage,
    reorderPages,
    deleteMedia,
    getPublicBook
};
