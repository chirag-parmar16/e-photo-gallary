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

module.exports = {
    getSettings,
    getStats,
    updateSettings
};
