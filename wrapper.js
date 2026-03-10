const fs = require('fs');
const files = ['albums.html', 'settings.html', 'users.html', 'subscriptions.html', 'editor.html'];
const header = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Memoria</title>\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">\n    <link rel="stylesheet" href="/admin.css?v=4">\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/izitoast/1.4.0/css/iziToast.min.css">\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/izitoast/1.4.0/js/iziToast.min.js"></script>\n`;

const editorScripts = `    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">\n    <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>\n    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>\n`;

const bodyStart = `</head>\n<body>\n    <div id="app-container" style="display: none;">\n        <div id="sidebar-container"></div>\n        <main class="main-wrapper">\n            <div id="navbar-container"></div>\n            <div id="main-view">\n`;

const footer = (viewName) => `\n            </div>\n            <footer>\n                <p>&copy; 2026 Timeless Memories. Built with ❤️</p>\n            </footer>\n        </main>\n    </div>\n    <div id="modals-container"></div>\n    <script>\n        window.currentViewName = '${viewName}';\n    </script>\n    <script src="/admin.js?v=5"></script>\n</body>\n</html>`;

files.forEach(f => {
    let content = fs.readFileSync('public/views/' + f, 'utf8');
    const viewName = f.replace('.html', '');
    let finalHeader = header + (f === 'editor.html' ? editorScripts : '') + bodyStart;
    fs.writeFileSync('public/views/' + f, finalHeader + content + footer(viewName));
});
