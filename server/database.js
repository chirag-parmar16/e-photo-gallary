const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function initDb() {
    const db = await open({
        filename: path.join(__dirname, '../database/database.sqlite'),
        driver: sqlite3.Database
    });

    await db.run('PRAGMA foreign_keys = ON;');

    // 1. Create Users Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user', -- 'admin' or 'user'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Migration: Rename username to email if necessary
    const userColumns = await db.all(`PRAGMA table_info(users);`);
    const hasEmail = userColumns.some(col => col.name === 'email');
    const hasUsername = userColumns.some(col => col.name === 'username');

    if (!hasEmail && hasUsername) {
        console.log('Migrating users table: renaming username to email');
        await db.exec(`ALTER TABLE users RENAME COLUMN username TO email;`);
    }

    // Migration: Add cover_subtitle and instruction_text to books if they don't exist
    const bookColumns = await db.all(`PRAGMA table_info(books);`);
    if (!bookColumns.some(col => col.name === 'cover_subtitle')) {
        await db.exec(`ALTER TABLE books ADD COLUMN cover_subtitle TEXT DEFAULT 'A collection of memories, frozen in time.';`);
    }
    if (!bookColumns.some(col => col.name === 'instruction_text')) {
        await db.exec(`ALTER TABLE books ADD COLUMN instruction_text TEXT DEFAULT 'Tap to open';`);
    }

    // 2. Create Books Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT 'Untitled Album',
            cover_title TEXT DEFAULT 'Our Timeless Journey',
            cover_subtitle TEXT DEFAULT 'A collection of memories, frozen in time.',
            instruction_text TEXT DEFAULT 'Tap to open',
            end_title TEXT DEFAULT 'THE END',
            uuid TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // 3. Create/Update Pages Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER,
            text_content TEXT,
            page_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        );
    `);

    const columns = await db.all(`PRAGMA table_info(pages);`);
    const hasBookId = columns.some(col => col.name === 'book_id');
    if (!hasBookId) {
        await db.exec(`ALTER TABLE pages ADD COLUMN book_id INTEGER REFERENCES books(id) ON DELETE CASCADE;`);
    }

    // 4. Create Page Media Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS page_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_id INTEGER,
            type TEXT NOT NULL,
            media_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
    `);

    // --- SEEDING & MIGRATION ---

    // A. Create Default Admin User
    const adminEmail = 'admin@gmail.com';
    const adminExists = await db.get('SELECT * FROM users WHERE email = ?', adminEmail);
    let adminId;

    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin', 10);
        const result = await db.run(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [adminEmail, hashedPassword, 'admin']
        );
        adminId = result.lastID;
        console.log('Admin user created (admin@gmail.com / admin).');
    } else {
        adminId = adminExists.id;
    }

    // B. Create Default Book for Admin (if none exists)
    const bookExists = await db.get('SELECT * FROM books WHERE user_id = ?', adminId);
    let defaultBookId;

    if (!bookExists) {
        const uuid = crypto.randomUUID();
        const result = await db.run(
            `INSERT INTO books (user_id, title, cover_title, end_title, uuid) 
             VALUES (?, 'My First Photo Album', 'Our Timeless Journey', 'THE END', ?)`,
            [adminId, uuid]
        );
        defaultBookId = result.lastID;
        console.log('Default book created for Admin.');

        // Attempt to migrate settings from old 'settings' table to this book
        try {
            // Check if settings table exists first
            const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
            if (tableCheck) {
                const oldSettings = await db.all('SELECT * FROM settings');
                const coverT = oldSettings.find(s => s.key === 'cover_title')?.value;
                const endT = oldSettings.find(s => s.key === 'end_title')?.value;

                if (coverT || endT) {
                    await db.run('UPDATE books SET cover_title = ?, end_title = ? WHERE id = ?',
                        [coverT || 'Our Timeless Journey', endT || 'THE END', defaultBookId]);
                    console.log('Migrated old titles to default book.');
                }
            }
        } catch (e) {
            console.log('Skipping settings migration (table might not exist).');
        }

    } else {
        defaultBookId = bookExists.id;
    }

    // C. Migrate Orphaned Pages to Default Book
    const result = await db.run(
        'UPDATE pages SET book_id = ? WHERE book_id IS NULL',
        defaultBookId
    );
    if (result.changes > 0) {
        console.log(`Migrated ${result.changes} orphaned pages to Default Book ID ${defaultBookId}.`);
    }

    return db;
}

module.exports = { initDb };
