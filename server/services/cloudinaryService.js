const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadToCloudinary(fileBuffer) {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto' },
            (error, result) => {
                if (result) {
                    resolve(result.secure_url);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
}

async function deleteFromCloudinary(fileUrl) {
    try {
        const parts = fileUrl.split('/upload/');
        if (parts.length > 1) {
            let pathPart = parts[1];
            
            const versionMatch = pathPart.match(/^v\d+\//);
            if (versionMatch) {
                pathPart = pathPart.substring(versionMatch[0].length);
            }
            
            const publicId = pathPart.substring(0, pathPart.lastIndexOf('.')) || pathPart;
            
            let resourceType = 'image';
            if (fileUrl.match(/\.(mp4|mov|avi|webm|mkv|flv|wmv)$/i)) {
                resourceType = 'video';
            }

            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
    } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
    }
}

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary
};
