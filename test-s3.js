require('dotenv').config();
try {
    console.log('Attempting to load S3 config...');
    const s3Config = require('./server/s3-config');
    console.log('S3 Config loaded successfully:', Object.keys(s3Config));
} catch (err) {
    console.error('FAILED TO LOAD S3 CONFIG:');
    console.error(err);
}
