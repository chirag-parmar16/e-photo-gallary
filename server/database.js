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
            id               INT AUTO_INCREMENT PRIMARY KEY,
            email            VARCHAR(255) UNIQUE NOT NULL,
            password         TEXT NOT NULL,
            role             VARCHAR(20) DEFAULT 'user',
            display_name     VARCHAR(255) DEFAULT 'User',
            subscription_plan VARCHAR(20) DEFAULT 'free',
            subscription_end DATETIME DEFAULT NULL,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Books
    await db.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            user_id          INT NOT NULL,
            title            VARCHAR(255) DEFAULT 'Untitled Album',
            recipient_name   VARCHAR(255) DEFAULT '',
            cover_title      TEXT DEFAULT 'Our Timeless Journey',
            cover_subtitle   TEXT DEFAULT 'A collection of memories, frozen in time.',
            instruction_text TEXT DEFAULT 'Tap to open',
            end_title        TEXT DEFAULT 'THE END',
            uuid             VARCHAR(36) UNIQUE NOT NULL,
            template_type    VARCHAR(50) DEFAULT 'default',
            color_schema     VARCHAR(20) DEFAULT '#ff4d6d',
            border_style     VARCHAR(50) DEFAULT 'none',
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    try { await db.exec('ALTER TABLE books ADD COLUMN recipient_name VARCHAR(255) DEFAULT ""'); } catch (err) { }

    // 3. Pages
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            book_id      INT NOT NULL,
            text_content TEXT,
            page_order   INT DEFAULT 0,
            border_style VARCHAR(50) DEFAULT 'none',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
        )
    `);

    // 4. Page Media
    await db.exec(`
        CREATE TABLE IF NOT EXISTS page_media (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            page_id     INT NOT NULL,
            type        VARCHAR(20) NOT NULL,
            media_path  TEXT NOT NULL,
            frame_style VARCHAR(50) DEFAULT 'square',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
    `);

    // 6. Payments (Modular Gateway Implementation)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id                 INT AUTO_INCREMENT PRIMARY KEY,
            user_id            INT NOT NULL,
            plan_id            VARCHAR(50) NOT NULL,
            gateway            VARCHAR(50) DEFAULT 'simulated',
            txn_order_id       VARCHAR(255) UNIQUE,
            txn_payment_id     VARCHAR(255) UNIQUE,
            txn_signature      VARCHAR(255),
            amount             INT NOT NULL, -- In paise
            currency           VARCHAR(10) DEFAULT 'INR',
            status             VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
            payment_method     VARCHAR(20), -- card, upi, netbanking
            upi_id             VARCHAR(255),
            bank_name          VARCHAR(255),
            card_last4         VARCHAR(4),
            card_expiry        VARCHAR(10),
            card_holder        VARCHAR(255),
            card_network       VARCHAR(50),
            error_reason       TEXT,
            notes              JSON,
            created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 7. Subscription Plans
    await db.exec(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            plan_key     VARCHAR(50) UNIQUE NOT NULL,
            name         VARCHAR(100) NOT NULL,
            price        INT NOT NULL DEFAULT 0,
            currency     VARCHAR(10) DEFAULT 'INR',
            days         INT NOT NULL DEFAULT 30,
            max_books    INT NOT NULL DEFAULT 1,
            features     JSON,
            is_active    TINYINT(1) DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ── Seed: Default Subscription Plans ──────────────────────────────────────
    const plansExist = await db.get('SELECT id FROM subscription_plans LIMIT 1');
    if (!plansExist) {
        await db.run(`INSERT INTO subscription_plans (plan_key, name, price, days, max_books, features) VALUES (?, ?, ?, ?, ?, ?)`,
            ['free', 'Essential', 0, 36500, 1, JSON.stringify(['1 Live Album', '100 Photos/Videos'])]);
        await db.run(`INSERT INTO subscription_plans (plan_key, name, price, days, max_books, features) VALUES (?, ?, ?, ?, ?, ?)`,
            ['basic', 'Basic', 500, 30, 5, JSON.stringify(['5 Live Albums', '500 Photos/Videos', 'Email Support'])]);
        await db.run(`INSERT INTO subscription_plans (plan_key, name, price, days, max_books, features) VALUES (?, ?, ?, ?, ?, ?)`,
            ['pro', 'Professional', 1200, 30, 999, JSON.stringify(['Unlimited Albums', 'Premium Layouts', 'Priority Support', 'All Templates'])]);
        console.log('Default subscription plans seeded ✓');
    }

    // ── Seed: Default Admin (Only if not exists) ──────────────────────────────
    const adminEmail = 'admin@gmail.com';
    const existingAdmin = await db.get('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin', 10);
        const result = await db.run(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [adminEmail, hashedPassword, 'admin']
        );
        console.log('Admin user created → admin@gmail.com / admin');
    }

    console.log('Database initialized ✓');
    return db;
}

module.exports = { initDb };
