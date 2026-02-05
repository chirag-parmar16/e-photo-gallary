const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1'
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            const type = file.mimetype.startsWith('video/') ? 'videos' : 'images';
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = type + '/' + uniqueSuffix + path.extname(file.originalname);
            cb(null, filename);
        }
    })
});

async function deleteObjectFromS3(url) {
    if (!url || !url.includes('.amazonaws.com/')) return;
    try {
        // Extract key from URL
        const urlParts = new URL(url);
        const key = urlParts.pathname.substring(1); // Remove leading slash

        await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key
        }));
    } catch (err) {
        console.error('S3 Delete Error:', err);
    }
}

module.exports = { s3, upload, deleteObjectFromS3 };
