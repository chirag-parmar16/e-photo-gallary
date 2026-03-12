require('dotenv').config();
const mysql = require('mysql2/promise');

async function inspectDb() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'photo_gallery'
    };
    
    console.log('Connecting to MySQL:', config.host, config.database);
    
    try {
        const connection = await mysql.createConnection(config);
        
        console.log('Fetching columns for subscription_plans...');
        const [columns] = await connection.execute('SHOW COLUMNS FROM subscription_plans');
        console.log('Columns:', columns.map(c => c.Field).join(', '));
        
        console.log('Fetching rows from subscription_plans...');
        const [rows] = await connection.execute('SELECT * FROM subscription_plans');
        console.log('Rows:', JSON.stringify(rows, null, 2));
        
        await connection.end();
    } catch (err) {
        console.error('Database inspection failed:', err);
    }
}

inspectDb();
