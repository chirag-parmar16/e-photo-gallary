require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ─── MySQL Pool ────────────────────────────────────────────────────────────────
let pool;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'photo_gallery',
            waitForConnections: true,
            connectionLimit: 10,
            multipleStatements: true
        });
    }
    return pool;
}

// ─── SQLite-compatible Wrapper ────────────────────────────────────────────────
// Wraps mysql2 so that the rest of the codebase (index.js) stays unchanged.
//   db.get(sql, params)  → first row or undefined
//   db.all(sql, params)  → array of rows
//   db.run(sql, params)  → { lastID, changes }
//   db.exec(sql)         → executes raw SQL (DDL etc.)

function createDbWrapper(pool) {
    return {
        async get(sql, params) {
            const [rows] = await pool.execute(sql, toArray(params));
            return rows[0] || undefined;
        },
        async all(sql, params) {
            const [rows] = await pool.execute(sql, toArray(params));
            return rows;
        },
        async run(sql, params) {
            const [result] = await pool.execute(sql, toArray(params));
            return {
                lastID: result.insertId,
                changes: result.affectedRows
            };
        },
        async exec(sql) {
            // For multi-statement DDL — use query (not execute) on a single connection
            const conn = await pool.getConnection();
            try {
                await conn.query(sql);
            } finally {
                conn.release();
            }
        }
    };
}

// mysql2 needs params as an array (not a single value)
function toArray(params) {
    if (params === undefined || params === null) return [];
    return Array.isArray(params) ? params : [params];
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initDb() {
    const p = getPool();
    const db = createDbWrapper(p);

    // 1. Users
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            email      VARCHAR(255) UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            role       VARCHAR(20) DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Books
    await db.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            user_id          INT NOT NULL,
            title            VARCHAR(255) DEFAULT 'Untitled Album',
            cover_title      TEXT DEFAULT 'Our Timeless Journey',
            cover_subtitle   TEXT DEFAULT 'A collection of memories, frozen in time.',
            instruction_text TEXT DEFAULT 'Tap to open',
            end_title        TEXT DEFAULT 'THE END',
            uuid             VARCHAR(36) UNIQUE NOT NULL,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 3. Pages
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            book_id      INT,
            text_content TEXT,
            page_order   INT DEFAULT 0,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )
    `);

    // 4. Page Media
    await db.exec(`
        CREATE TABLE IF NOT EXISTS page_media (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            page_id    INT,
            type       VARCHAR(20) NOT NULL,
            media_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
    `);

    // ── Seed: Default Admin ───────────────────────────────────────────────────
    const adminEmail = 'admin@gmail.com';
    let admin = await db.get('SELECT * FROM users WHERE email = ?', adminEmail);
    let adminId;

    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin', 10);
        const result = await db.run(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [adminEmail, hashedPassword, 'admin']
        );
        adminId = result.lastID;
        console.log('Admin user created → admin@gmail.com / admin');
    } else {
        adminId = admin.id;
    }

    // ── Seed: Default Book for Admin ─────────────────────────────────────────
    let bookRow = await db.get('SELECT * FROM books WHERE user_id = ?', adminId);
    let defaultBookId;

    if (!bookRow) {
        const uuid = crypto.randomUUID();
        const result = await db.run(
            `INSERT INTO books (user_id, title, cover_title, end_title, uuid)
             VALUES (?, 'My First Photo Album', 'Our Timeless Journey', 'THE END', ?)`,
            [adminId, uuid]
        );
        defaultBookId = result.lastID;
        console.log('Default book created for Admin.');
    } else {
        defaultBookId = bookRow.id;
    }

    // ── Migrate orphaned pages (safety) ──────────────────────────────────────
    const orphan = await db.run(
        'UPDATE pages SET book_id = ? WHERE book_id IS NULL',
        defaultBookId
    );
    if (orphan.changes > 0) {
        console.log(`Migrated ${orphan.changes} orphaned pages → Book ID ${defaultBookId}`);
    }

    console.log('Connected to MySQL database ✓');
    return db;
}

module.exports = { initDb };
