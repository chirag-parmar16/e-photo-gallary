const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function maskEmail(email) {
    if (!email || !email.includes('@')) return 'hidden';
    const [local, domain] = email.split('@');
    const localMasked = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}`;
    return `${localMasked}@${domain}`;
}

const login = async (req, res, db) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('session', token, {
            httpOnly: false,
            secure: false, // Set to true in prod with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({ success: true, token, role: user.role, id: user.id });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const register = async (req, res, db) => {
    const { email, password, display_name } = req.body;
    try {
        const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        // First user created logic handled by initDb for admin, but let's just make sure others are 'user'
        const result = await db.run(
            'INSERT INTO users (email, password, role, display_name) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, 'user', display_name]
        );

        // Auto login after registration
        const token = jwt.sign(
            { id: result.lastID, email, role: 'user', display_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('session', token, {
            httpOnly: false,
            secure: false, // Set to true in prod with HTTPS
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({ success: true, token, role: 'user', id: result.lastID });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getMe = async (req, res, db) => {
    try {
        const user = await db.get('SELECT id, email, role, display_name, subscription_plan, subscription_end FROM users WHERE id = ?', req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getUsers = async (req, res, db) => {
    try {
        const users = await db.all("SELECT id, email, role, subscription_plan, subscription_end, created_at FROM users WHERE role != 'admin'");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteUser = async (req, res, db) => {
    try {
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        await db.run('DELETE FROM users WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    login,
    register,
    getMe,
    getUsers,
    deleteUser
};
