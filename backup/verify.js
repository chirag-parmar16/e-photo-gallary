const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function verify() {
    const dbPath = path.join(__dirname, 'server/database.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.run('PRAGMA foreign_keys = ON;');

    await db.exec(`
        CREATE TABLE pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text_content TEXT,
            page_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE page_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_id INTEGER,
            type TEXT NOT NULL,
            media_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
    `);

    const seedData = [
        { text: 'A beautiful morning in the mist.', media: ['/uploads/images/memory_1.png', '/uploads/images/memory_1.png'] },
        { text: 'Laughter shared under the summer sun.', media: ['/uploads/images/memory_1.png', '/uploads/images/memory_1.png', '/uploads/images/memory_1.png', '/uploads/images/memory_1.png'] },
        { text: 'Quiet moments by the lakeside.', media: ['/uploads/images/memory_1.png'] },
        { text: 'Dancing like no one is watching.', media: ['/uploads/images/memory_1.png', '/uploads/images/memory_1.png'] }
    ];

    for (const [index, p] of seedData.entries()) {
        const res = await db.run('INSERT INTO pages (text_content, page_order) VALUES (?, ?)', [p.text, index + 1]);
        const pageId = res.lastID;
        for (const m of p.media) {
            await db.run('INSERT INTO page_media (page_id, type, media_path) VALUES (?, ?, ?)', [pageId, 'image', m]);
        }
    }

    console.log('Verification DB seeded successfully');
    await db.close();
}

verify().catch(console.error);
