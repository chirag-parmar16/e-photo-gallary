const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processAndSaveImage(fileBuffer, fullPath) {
    await sharp(fileBuffer)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(fullPath);
}

module.exports = {
    processAndSaveImage
};
