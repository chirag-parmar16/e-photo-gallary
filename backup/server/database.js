const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function initDb() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.run('PRAGMA foreign_keys = ON;');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text_content TEXT,
            page_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS page_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_id INTEGER,
            type TEXT NOT NULL,
            media_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES ('cover_title', 'Our Timeless Journey');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('end_title', 'THE END');
    `);

    // Add initial pages if empty (optional, for demo)
    const count = await db.get('SELECT COUNT(*) as count FROM pages');
    if (count.count === 0) {
        // You can add a welcome page here if desired
    }

    return db;
}

module.exports = { initDb };
