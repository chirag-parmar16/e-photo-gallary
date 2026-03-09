const crypto = require('crypto');

const getBooks = async (req, res, db) => {
    try {
        const books = await db.all('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createBook = async (req, res, db) => {
    try {
        let { title, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style } = req.body;
        const uuid = crypto.randomUUID();

        // Theme Analysis Defaults
        if (template_type === 'birthday') {
            cover_title = cover_title || 'Happy Birthday!';
            color_schema = color_schema || '#ffc107'; // Golden Yellow
        } else if (template_type === 'wedding') {
            cover_title = cover_title || 'Our Wedding Day';
            color_schema = color_schema || '#b76e79'; // Rose Gold
        } else if (template_type === 'anniversary') {
            cover_title = cover_title || 'Happy Anniversary';
            color_schema = color_schema || '#e83e8c'; // Deep Pink
        }

        template_type = template_type || 'default';

        const result = await db.run(
            `INSERT INTO books (user_id, title, cover_title, cover_subtitle, instruction_text, end_title, uuid, template_type, color_schema, border_style)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                title || 'Untitled Album',
                cover_title || 'Our Journey',
                cover_subtitle || 'A collection of memories, frozen in time.',
                instruction_text || 'Tap to open',
                end_title || 'The End',
                uuid,
                template_type,
                color_schema || null,
                border_style || 'none'
            ]
        );

        const bookId = result.lastID;

        // --- DEFAULT PAGES INJECTION ---
        let defaultPages = [];
        if (template_type === 'birthday') {
            defaultPages = [
                { content: '<h1>Happy Birthday!</h1><p>Wishing you a day filled with love and laughter.</p>', order: 0 },
                { content: '<h1>Best Wishes</h1><p>May all your dreams come true this year!</p>', order: 1 }
            ];
        } else if (template_type === 'wedding') {
            defaultPages = [
                { content: '<h1>Our Wedding</h1><p>The beginning of our forever.</p>', order: 0 },
                { content: '<h1>Congratulations</h1><p>To a lifetime of love and happiness.</p>', order: 1 }
            ];
        } else if (template_type === 'anniversary') {
            defaultPages = [
                { content: '<h1>Happy Anniversary</h1><p>Another year of beautiful memories together.</p>', order: 0 },
                { content: '<h1>To Many More</h1><p>Cheers to our love story.</p>', order: 1 }
            ];
        } else {
            defaultPages = [
                { content: '<h1>Welcome</h1><p>Start adding your memories here.</p>', order: 0 }
            ];
        }

        for (const pg of defaultPages) {
            await db.run(
                'INSERT INTO pages (book_id, text_content, page_order) VALUES (?, ?, ?)',
                [bookId, pg.content, pg.order]
            );
        }

        res.json({ success: true, id: bookId, uuid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getBook = async (req, res, db) => {
    try {
        const book = await db.get('SELECT * FROM books WHERE uuid = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!book) return res.status(404).json({ error: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateBook = async (req, res, db) => {
    try {
        const { title, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style } = req.body;
        const result = await db.run(
            `UPDATE books SET
                title = COALESCE(?, title),
                cover_title = COALESCE(?, cover_title),
                cover_subtitle = COALESCE(?, cover_subtitle),
                instruction_text = COALESCE(?, instruction_text),
                end_title = COALESCE(?, end_title),
                template_type = COALESCE(?, template_type),
                color_schema = COALESCE(?, color_schema),
                border_style = COALESCE(?, border_style)
             WHERE uuid = ? AND user_id = ?`,
            [title, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style, req.params.id, req.user.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Book not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteBook = async (req, res, db) => {
    try {
        const bookId = req.params.id; // This is now a UUID
        const userId = req.user.id;

        const book = await db.get('SELECT id FROM books WHERE uuid = ? AND user_id = ?', [bookId, userId]);
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const internalId = book.id;

        await db.run('DELETE FROM page_media WHERE page_id IN (SELECT id FROM pages WHERE book_id = ?)', [internalId]);
        await db.run('DELETE FROM pages WHERE book_id = ?', [internalId]);
        await db.run('DELETE FROM books WHERE id = ?', [internalId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getBooks,
    createBook,
    getBook,
    updateBook,
    deleteBook
};
