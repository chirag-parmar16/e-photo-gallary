// State Management
let currentUser = null;
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentBookId = null;

// UI Elements
const appContainer = document.getElementById('app-container');
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('loginForm');
const sidebarNav = document.getElementById('sidebar-nav');
const navUsername = document.getElementById('navUsername');

// Dashboards
const superAdminDash = document.getElementById('super-admin-dashboard');
const userDash = document.getElementById('user-dashboard');
const bookEditor = document.getElementById('book-editor');

// --- AUTHENTICATION ---

async function checkAuth() {
    if (currentToken) {
        // Show app, hide login
        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        navUsername.textContent = localStorage.getItem('email') || 'User';
        setupDashboard();
    } else {
        loginScreen.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('email', data.email);
            currentToken = data.token;
            currentRole = data.role;
            checkAuth();
        } else {
            errorEl.textContent = data.error || 'Login failed';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Connection error';
        errorEl.style.display = 'block';
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});

// --- DASHBOARD SETUP ---

function setupDashboard() {
    sidebarNav.innerHTML = '';

    if (currentRole === 'admin') {
        sidebarNav.innerHTML = `
            <li class="active"><a href="#" data-view="super-admin-dashboard"><i class="fas fa-users-cog"></i> User Management</a></li>
            <li><a href="#" data-view="user-dashboard"><i class="fas fa-book"></i> My Books</a></li>
        `;
        showView('super-admin-dashboard');
        fetchAdminStats();
        fetchUsers();
    } else {
        sidebarNav.innerHTML = `
            <li class="active"><a href="#" data-view="user-dashboard"><i class="fas fa-book"></i> My Books</a></li>
        `;
        showView('user-dashboard');
        fetchUserBooks();
    }

    // Bind view switching for all roles
    document.querySelectorAll('.nav-links a[data-view]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            showView(view);
            if (view === 'super-admin-dashboard') {
                fetchAdminStats();
                fetchUsers();
            } else if (view === 'user-dashboard') {
                fetchUserBooks();
            }
        });
    });
}

// --- MOBILE MENU ---
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
appContainer.appendChild(overlay);

document.getElementById('mobileMenuToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.add('active');
    overlay.classList.add('active');
});

overlay.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('active');
    overlay.classList.remove('active');
});

// Close menu when clicking links on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 && e.target.closest('.nav-links a')) {
        document.querySelector('.sidebar').classList.remove('active');
        overlay.classList.remove('active');
    }
});

function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-links a[data-view="${viewId}"]`);
    if (activeLink) activeLink.parentElement.classList.add('active');
}

// --- ADMIN LOGIC ---

async function fetchAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await res.json();
        document.getElementById('sa-total-users').textContent = data.totalUsers;
        document.getElementById('sa-total-books').textContent = data.totalBooks;
    } catch (err) { console.error(err); }
}

async function fetchUsers() {
    const userList = document.getElementById('userList');
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const users = await res.json();
        userList.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'table-row user-row';
            row.innerHTML = `
                <div>${user.id}</div>
                <div style="font-weight:600;">${user.email}</div>
                <div><span class="badge ${user.role}">${user.role}</span></div>
                <div style="color:#888;">${new Date(user.created_at).toLocaleDateString()}</div>
                <div class="action-btns">
                    <button class="action-btn delete-btn" onclick="deleteUser(${user.id})" title="Delete User"><i class="fas fa-trash"></i></button>
                </div>
            `;
            userList.appendChild(row);
        });
    } catch (err) { console.error(err); }
}

async function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user? All their books and pages will be permanently removed.')) {
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (res.ok) {
                fetchUsers();
                fetchAdminStats();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch (err) { console.error(err); }
    }
}

document.getElementById('openAddUserModal').addEventListener('click', () => {
    document.getElementById('createUserModal').classList.add('active');
});

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ email, password, role })
        });
        if (res.ok) {
            document.getElementById('createUserModal').classList.remove('active');
            document.getElementById('createUserForm').reset();
            fetchUsers();
            fetchAdminStats();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    } catch (err) { console.error(err); }
});

// --- USER & BOOK LOGIC ---

async function fetchUserBooks() {
    try {
        const res = await fetch('/api/books', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const books = await res.json();
        document.getElementById('user-total-books').textContent = books.length;
        renderBooks(books);
    } catch (err) { console.error(err); }
}

function renderBooks(books) {
    const list = document.getElementById('booksList');
    list.innerHTML = '';
    books.forEach(book => {
        const card = document.createElement('div');
        card.style.cssText = 'background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #efefef; transition: transform 0.2s;';
        card.innerHTML = `
            <div style="font-family: 'Playfair Display', serif; font-size: 1.2rem; color: var(--primary-color); margin-bottom: 0.5rem;">${book.title}</div>
            <div style="font-size: 0.85rem; color: #888; margin-bottom: 1.5rem;">Created: ${new Date(book.created_at).toLocaleDateString()}</div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-primary" style="flex:1; padding: 8px;" onclick="openEditor(${book.id})">Edit Pages</button>
                <button class="btn-secondary" style="padding: 8px;" onclick="copyLink('${book.uuid}')" title="Copy Share Link"><i class="fas fa-share-alt"></i></button>
                <button class="btn-outline" style="padding: 8px; border-color: #ff4d6d; color: #ff4d6d;" onclick="deleteBook(${book.id})" title="Delete Album"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

async function deleteBook(id) {
    if (confirm('Are you sure you want to delete this entire album and all its pages? This cannot be undone.')) {
        try {
            const res = await fetch(`/api/books/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (res.ok) {
                fetchUserBooks();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete album');
            }
        } catch (err) { console.error(err); }
    }
}

function copyLink(uuid) {
    const url = `${window.location.origin}/book.html?id=${uuid}`;
    navigator.clipboard.writeText(url).then(() => alert('Share link copied to clipboard!'));
}

document.getElementById('openCreateBookModal').addEventListener('click', () => {
    document.getElementById('createBookModal').classList.add('active');
});

document.getElementById('createBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('newBookTitle').value;

    try {
        const res = await fetch('/api/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ title })
        });
        if (res.ok) {
            document.getElementById('createBookModal').classList.remove('active');
            document.getElementById('createBookForm').reset();
            fetchUserBooks();
        }
    } catch (err) { console.error(err); }
});

// --- EDITOR LOGIC ---

const quill = new Quill('#editor-container', {
    theme: 'snow',
    placeholder: 'Add a poem or description...',
    modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'header': [1, 2, 3, false] }], [{ 'align': [] }], ['clean']] }
});

async function openEditor(bookId) {
    currentBookId = bookId;
    showView('book-editor');

    try {
        // Fetch book details for settings
        const bRes = await fetch(`/api/books/${bookId}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const book = await bRes.json();
        document.getElementById('editorBookTitle').textContent = book.title;
        document.getElementById('editBookTitle').value = book.title;
        document.getElementById('editCoverTitle').value = book.cover_title;
        document.getElementById('editEndTitle').value = book.end_title;
        document.getElementById('publicLinkBtn').href = `book.html?id=${book.uuid}`;

        fetchPages(bookId);
    } catch (err) { console.error(err); }
}

async function fetchPages(bookId) {
    try {
        const res = await fetch(`/api/books/${bookId}/pages`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const pages = await res.json();
        renderPages(pages);
    } catch (err) { console.error(err); }
}

function renderPages(pages) {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    pages.forEach((page, index) => {
        const row = document.createElement('div');
        row.className = 'table-row page-row';

        const mediaHtml = page.media.map(m =>
            m.type === 'video' ? `<video src="${m.media_path}" muted style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></video>` : `<img src="${m.media_path}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">`
        ).join('');

        const temp = document.createElement('div');
        temp.innerHTML = page.text_content || '';
        const previewText = temp.textContent.substring(0, 50) + '...';

        row.innerHTML = `
            <div>#${index + 1}</div>
            <div style="font-size:0.9rem; color:#666;">${previewText}</div>
            <div style="display:flex; gap:5px;">${mediaHtml}</div>
            <div class="action-btns">
                <button class="action-btn edit-btn" onclick="openEditPage(${page.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" onclick="deletePage(${page.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(row);
    });
}

document.getElementById('backToDashBtn').addEventListener('click', () => {
    fetchUserBooks();
    showView('user-dashboard');
});

// Settings Update
document.getElementById('bookSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        title: document.getElementById('editBookTitle').value,
        cover_title: document.getElementById('editCoverTitle').value,
        end_title: document.getElementById('editEndTitle').value
    };

    try {
        const res = await fetch(`/api/books/${currentBookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(data)
        });
        if (res.ok) alert('Settings updated!');
    } catch (err) { console.error(err); }
});

// Page Creation/Editing
let selectedFiles = [];
let deletedMediaIds = [];
const previewGrid = document.getElementById('previewGrid');

document.getElementById('openAddModal').addEventListener('click', () => {
    document.getElementById('editPageId').value = '';
    document.getElementById('submitBtn').textContent = 'Create Page';
    quill.root.innerHTML = '';
    selectedFiles = [];
    deletedMediaIds = [];
    previewGrid.innerHTML = '';
    document.getElementById('pageModal').classList.add('active');
});

document.getElementById('mediaFile').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    // Count current media (existing + already selected)
    const existingCount = previewGrid.children.length;

    files.forEach(file => {
        if (selectedFiles.length + existingCount < 4) {
            selectedFiles.push(file);
            renderNewMediaPreview(file, selectedFiles.length - 1);
        } else {
            alert('Maximum 4 media items allowed per page.');
        }
    });
    // Clear input so same file can be selected again if removed
    e.target.value = '';
});

function renderNewMediaPreview(file, index) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const item = document.createElement('div');
        item.style.cssText = 'position:relative; width:80px; height:80px;';
        item.dataset.newFileIndex = index;

        const isVideo = file.type.startsWith('video/');
        const mediaHtml = isVideo
            ? `<video src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 2px solid var(--accent-color);"></video>`
            : `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 2px solid var(--accent-color);">`;

        item.innerHTML = `
            ${mediaHtml}
            <button type="button" onclick="removeNewMedia(${index}, this)" style="position:absolute; top:-5px; right:-5px; background:#444; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">&times;</button>
        `;
        previewGrid.appendChild(item);
    };
    reader.readAsDataURL(file);
}

function removeNewMedia(index, btn) {
    // We don't splice because it shifts indexes. 
    // Instead we just null it and filter during submit
    selectedFiles[index] = null;
    btn.parentElement.remove();
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pageId = document.getElementById('editPageId').value;
    const isEdit = pageId !== '';

    const formData = new FormData();
    formData.append('text_content', quill.root.innerHTML);
    formData.append('delete_media_ids', JSON.stringify(deletedMediaIds));
    selectedFiles.filter(f => f !== null).forEach(file => formData.append('media', file));

    const url = isEdit ? `/api/pages/${pageId}` : `/api/books/${currentBookId}/pages`;
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = document.getElementById('submitBtn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (res.ok) {
            document.getElementById('pageModal').classList.remove('active');
            fetchPages(currentBookId);
        } else {
            alert('Upload failed. Please try again.');
        }
    } catch (err) {
        console.error(err);
        alert('Network error during upload.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

async function openEditPage(pageId) {
    document.getElementById('editPageId').value = pageId;
    document.getElementById('submitBtn').textContent = 'Save Changes';
    selectedFiles = [];
    deletedMediaIds = [];
    previewGrid.innerHTML = '';

    try {
        // Fetch current page data
        const res = await fetch(`/api/books/${currentBookId}/pages`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const pages = await res.json();
        const page = pages.find(p => p.id === pageId);

        if (page) {
            quill.root.innerHTML = page.text_content || '';

            // Show existing media
            page.media.forEach(m => {
                const item = document.createElement('div');
                item.style.cssText = 'position:relative; width:80px; height:80px;';

                const mediaHtml = m.type === 'video'
                    ? `<video src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></video>`
                    : `<img src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;

                item.innerHTML = `
                    ${mediaHtml}
                    <button type="button" onclick="markMediaForDelete(${m.id}, this)" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">&times;</button>
                `;
                previewGrid.appendChild(item);
            });
        }
        document.getElementById('pageModal').classList.add('active');
    } catch (err) { console.error(err); }
}

function markMediaForDelete(id, btn) {
    deletedMediaIds.push(id);
    btn.parentElement.remove();
}

async function deletePage(pageId) {
    if (confirm('Delete this page?')) {
        await fetch(`/api/pages/${pageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        fetchPages(currentBookId);
    }
}

// Modal closing helper
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        document.getElementById(modalId).classList.remove('active');
    });
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// --- PASSWORD CHANGE ---
document.getElementById('openPasswordModal').addEventListener('click', () => {
    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('passwordForm').reset();
    document.getElementById('passwordError').style.display = 'none';
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;
    const errorEl = document.getElementById('passwordError');

    if (newPass !== confirmPass) {
        errorEl.textContent = 'New passwords do not match';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
        });

        const data = await res.json();
        if (res.ok) {
            alert('Password changed successfully! Please log in again.');
            localStorage.clear();
            location.reload();
        } else {
            errorEl.textContent = data.error || 'Failed to change password';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Connection error';
        errorEl.style.display = 'block';
    }
});

// Init
checkAuth();
