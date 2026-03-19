async function tableExists(db, tableName) {
    const row = await db.get(
        'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [tableName]
    );
    return Boolean(row);
}

async function getLegacySettingsFromBooks(db) {
    const book = await db.get(`
        SELECT cover_title, cover_subtitle, instruction_text, end_title
        FROM books
        ORDER BY id ASC
        LIMIT 1
    `);
    return book || {};
}

const LEGACY_SETTINGS_DEFAULTS = {
    cover_title: 'Our Timeless Journey',
    cover_subtitle: 'A collection of memories, frozen in time.',
    instruction_text: 'Tap to open',
    end_title: 'THE END'
};

const getSettings = async (req, res, db) => {
    try {
        const settings = {};
        if (await tableExists(db, 'settings')) {
            const settingsArr = await db.all('SELECT * FROM settings');
            settingsArr.forEach(s => { settings[s.key] = s.value; });
        }
        const bookSettings = await getLegacySettingsFromBooks(db);
        res.json({ ...LEGACY_SETTINGS_DEFAULTS, ...bookSettings, ...settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getStats = async (req, res, db) => {
    try {
        const userCount = await db.get("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        const bookCount = await db.get('SELECT COUNT(*) as count FROM books');
        const mediaCount = await db.get('SELECT COUNT(*) as count FROM page_media');

        // Distribution of users by plan
        const planCounts = await db.all(`
            SELECT subscription_plan as plan, COUNT(*) as count 
            FROM users 
            WHERE role != 'admin'
            GROUP BY subscription_plan
        `);

        // Revenue over time (Last 30 days) - Using payments table
        const revenueTimeline = await db.all(`
            SELECT DATE(created_at) as date, SUM(amount) / 100 as total
            FROM payments
            WHERE status = 'success' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Growth metrics (New users and books per day)
        const userGrowth = await db.all(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND role != 'admin'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        const bookGrowth = await db.all(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM books
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            totalUsers: userCount.count,
            totalBooks: bookCount.count,
            totalMedia: mediaCount.count,
            planDistribution: planCounts,
            revenueData: revenueTimeline,
            growth: {
                users: userGrowth,
                books: bookGrowth
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateSettings = async (req, res, db) => {
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
};

const getPayments = async (req, res, db) => {
    try {
        const payments = await db.all(`
            SELECT p.*, u.email as user_email 
            FROM payments p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePaymentStatus = async (req, res, db) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['success', 'pending', 'failed', 'cancel'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await db.run('UPDATE payments SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getUserBooks = async (req, res, db) => {
    try {
        const { id } = req.params;
        const books = await db.all('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC', [id]);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAllBooks = async (req, res, db) => {
    try {
        const books = await db.all(`
            SELECT b.*, u.email as owner_email 
            FROM books b 
            JOIN users u ON b.user_id = u.id 
            ORDER BY b.created_at DESC
        `);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getSettings,
    getStats,
    updateSettings,
    getPayments,
    updatePaymentStatus,
    getUserBooks,
    getAllBooks
};
