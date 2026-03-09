const fs = require('fs');
const path = require('path');

async function deleteFile(filePath) {
    if (!filePath || filePath.startsWith('http')) return;
    try {
        const fullPath = filePath.startsWith('/uploads/')
            ? path.join(__dirname, '../../public', filePath)
            : filePath;
        fs.unlink(fullPath, () => { });
    } catch (err) {
        console.warn('File delete skipped:', err.message);
    }
}

module.exports = {
    deleteFile
};
