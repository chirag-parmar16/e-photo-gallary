const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Uploads a file buffer to S3
 * @param {Buffer} fileBuffer 
 * @param {string} fileName 
 * @param {string} mimeType 
 * @returns {Promise<string>} The public URL of the uploaded image
 */
async function uploadToS3(fileBuffer, fileName, mimeType) {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `uploads/${Date.now()}-${fileName}`,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    try {
        await s3Client.send(command);
        // Construct the public URL (assuming public-read access is enabled on the bucket)
        return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${command.input.Key}`;
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error('S3 upload failed');
    }
}

/**
 * Deletes an object from S3
 * @param {string} fileUrl 
 */
async function deleteFromS3(fileUrl) {
    if (!fileUrl) return;

    try {
        const bucketName = process.env.AWS_BUCKET_NAME;
        // Extract the key from the URL
        // Example URL: https://bucket.s3.region.amazonaws.com/uploads/key
        const key = fileUrl.split('.amazonaws.com/')[1];
        
        if (!key) {
            console.warn('Could not extract S3 key from URL:', fileUrl);
            return;
        }

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error('Error deleting from S3:', error);
        // Don't throw for delete failures to avoid breaking page deletion, but log it
    }
}

module.exports = {
    uploadToS3,
    deleteFromS3,
};
