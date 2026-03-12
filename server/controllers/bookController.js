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
        let { title, recipient_name, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style } = req.body;
        const uuid = crypto.randomUUID();

        // --- SUBSCRIPTION ENFORCEMENT ---
        const user = await db.get('SELECT subscription_plan, subscription_end FROM users WHERE id = ?', req.user.id);
        const bookCountResult = await db.get('SELECT COUNT(*) as count FROM books WHERE user_id = ?', req.user.id);
        const bookCount = bookCountResult.count;

        const plan = user.subscription_plan || 'free';
        const isExpired = user.subscription_end && new Date(user.subscription_end) < new Date();

        if (plan === 'free' && bookCount >= 1) {
            return res.status(403).json({ error: 'Free plan is limited to 1 album. Please upgrade to create more.' });
        }
        if (plan === 'basic' && bookCount >= 5) {
            return res.status(403).json({ error: 'Basic plan is limited to 5 albums. Please upgrade to Pro for unlimited albums.' });
        }
        if (isExpired && plan !== 'free') {
            return res.status(403).json({ error: 'Your subscription has expired. Please renew to create new albums.' });
        }

        // Theme Analysis Defaults
        if (template_type === 'birthday') {
            cover_title = cover_title || 'Happy Birthday!';
            color_schema = color_schema || '#ffc107'; 
        } else if (template_type === 'wedding') {
            cover_title = cover_title || 'Our Wedding Day';
            color_schema = color_schema || '#b76e79'; 
        } else if (template_type === 'anniversary') {
            cover_title = cover_title || 'Happy Anniversary';
            color_schema = color_schema || '#e83e8c'; 
        } else {
            color_schema = color_schema || '#ff4d6d';
        }

        template_type = template_type || 'default';

        const result = await db.run(
            `INSERT INTO books (user_id, title, recipient_name, cover_title, cover_subtitle, instruction_text, end_title, uuid, template_type, color_schema, border_style)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                title || 'Untitled Album',
                recipient_name || '',
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
        const { title, recipient_name, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style } = req.body;
        const result = await db.run(
            `UPDATE books SET
                title = COALESCE(?, title),
                recipient_name = COALESCE(?, recipient_name),
                cover_title = COALESCE(?, cover_title),
                cover_subtitle = COALESCE(?, cover_subtitle),
                instruction_text = COALESCE(?, instruction_text),
                end_title = COALESCE(?, end_title),
                template_type = COALESCE(?, template_type),
                color_schema = COALESCE(?, color_schema),
                border_style = COALESCE(?, border_style)
             WHERE uuid = ? AND user_id = ?`,
            [title, recipient_name, cover_title, cover_subtitle, instruction_text, end_title, template_type, color_schema, border_style, req.params.id, req.user.id]
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
