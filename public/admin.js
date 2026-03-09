// State Management
let currentUser = null;
let currentRole = localStorage.getItem('role');
let currentBookId = null;

// UI Elements
window.confirmAction = function (message, onConfirm) {
    iziToast.question({
        timeout: 20000,
        close: false,
        overlay: true,
        displayMode: 'once',
        id: 'question',
        zindex: 999,
        title: 'Confirm',
        message: message,
        position: 'center',
        buttons: [
            ['<button><b>Yes</b></button>', function (instance, toast) {
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                onConfirm();
            }, true],
            ['<button>No</button>', function (instance, toast) {
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            }]
        ]
    });
};

window.toggleButtonLoader = function (btnIdOrEl, isLoading, originalText = '') {
    const btn = typeof btnIdOrEl === 'string' ? document.getElementById(btnIdOrEl) : btnIdOrEl;
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
    } else {
        btn.innerHTML = originalText || btn.dataset.originalText;
        btn.disabled = false;
    }
};
const appContainer = document.getElementById('app-container');
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('loginForm');
const sidebarNav = document.getElementById('sidebar-nav');
const navUsername = document.getElementById('navUsername');

// Dashboards
let superAdminDash, userDash, bookEditor;

// --- ROUTER ENGINE ---

async function loadView(viewName) {
    try {
        const response = await fetch(`/views/${viewName}.html`);
        if (!response.ok) throw new Error(`View not found: ${viewName}`);
        const html = await response.text();
        document.getElementById('main-view').innerHTML = html;

        // Re-bind DOM elements for the loaded view
        superAdminDash = document.getElementById('super-admin-dashboard');
        userDash = document.getElementById('user-dashboard');
        bookEditor = document.getElementById('book-editor');
        const albumsView = document.getElementById('albums-view');
        const settingsView = document.getElementById('settings-view');

        // Execute specific view logic
        if (viewName === 'dashboard') {
            if (currentRole === 'admin') {
                if (superAdminDash) superAdminDash.style.display = 'block';
                if (userDash) userDash.style.display = 'none';
                fetchAdminStats();
                fetchUsers();
                bindAdminDashboardEvents();
            } else {
                if (superAdminDash) superAdminDash.style.display = 'none';
                if (userDash) userDash.style.display = 'block';
                const subEl = document.getElementById('user-subscription-end');
                if (subEl) {
                    subEl.textContent = currentUser.subscription_end ? new Date(currentUser.subscription_end).toLocaleDateString() : 'Lifetime / Auto';
                }
                fetchUserBooks();
                bindUserDashboardEvents();
            }
        } else if (viewName === 'editor') {
            if (bookEditor) bookEditor.style.display = 'block';
        } else if (viewName === 'albums') {
            if (albumsView) albumsView.style.display = 'block';
        } else if (viewName === 'settings') {
            if (settingsView) settingsView.style.display = 'block';
        }
    } catch (err) {
        console.error('Routing Error:', err);
    }
}

window.navigateTo = function (path) {
    history.pushState(null, '', path);
    handleRoute();
};

function handleRoute() {
    if (!currentUser) {
        if (window.location.pathname !== '/login') {
            history.replaceState(null, '', '/login');
        }
        return; // Wait for checkAuth
    }

    let path = window.location.pathname;

    // Redirect root and login to dashboard if already authenticated
    if (path === '/' || path === '/login') {
        history.replaceState(null, '', '/dashboard');
        path = '/dashboard';
    }

    if (path === '/dashboard') {
        loadView('dashboard');
        updateNavActive('dashboard');
    } else if (path === '/albums') {
        loadView('albums').then(() => {
            fetchUserBooks();
            bindUserDashboardEvents();
        });
        updateNavActive('albums');
    } else if (path === '/settings') {
        loadView('settings').then(() => {
            // Populate form
            const nameInput = document.getElementById('profileName');
            if (nameInput) nameInput.value = currentUser.display_name || 'User';

            // bind settings events below
            const openPassBtn = document.getElementById('openSettingsPasswordModal');
            if (openPassBtn) {
                openPassBtn.addEventListener('click', () => {
                    document.getElementById('passwordModal').classList.add('active');
                });
            }

            const profileForm = document.getElementById('profileForm');
            if (profileForm) {
                profileForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const newName = nameInput.value;
                    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
                    window.toggleButtonLoader(btn, true);

                    try {
                        const res = await fetch('/api/auth/profile', {
                            method: 'PUT',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                            },
                            body: JSON.stringify({ display_name: newName })
                        });

                        if (res.ok) {
                            iziToast.success({ title: 'Success', message: 'Profile updated!' });
                            currentUser.display_name = newName;
                            document.getElementById('navUsername').textContent = newName || 'User';
                        } else {
                            const data = await res.json();
                            iziToast.error({ title: 'Error', message: data.error || 'Failed to update profile' });
                        }
                    } catch (err) {
                        console.error(err);
                        iziToast.error({ title: 'Error', message: 'Connection error' });
                    } finally {
                        window.toggleButtonLoader(btn, false);
                    }
                });
            }
        });
        updateNavActive('settings');
    } else if (path.startsWith('/book/')) {
        currentBookId = path.split('/')[2];
        loadView('editor').then(() => {
            initEditorView();
            fetchBookDetails(currentBookId);
            fetchPages(currentBookId);
        });
        updateNavActive('albums');
    }
}

window.addEventListener('popstate', handleRoute);

function updateNavActive(viewName) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => {
        if (a.classList.contains('nav-' + viewName)) {
            a.parentElement.classList.add('active');
        }
    });
}

// --- AUTHENTICATION ---

async function checkAuth() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/auth/me', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${token || ''}` }
        });
        const me = await res.json();
        if (!me.authenticated) throw new Error('Unauthorized');
        currentUser = me;
        currentRole = me.role;
        localStorage.setItem('role', me.role);

        // Hide login, show app
        document.getElementById('login-screen').style.display = 'none';
        appContainer.style.display = 'flex';
        navUsername.textContent = me.role === 'admin' ? 'Admin' : 'User';

        setupSidebar();
        bindGlobalEvents();
        handleRoute(); // Boot router

    } catch (err) {
        // If the login screen is already in index.html, just show it and bind
        const existingLogin = document.getElementById('login-screen');
        if (existingLogin && existingLogin.innerHTML.trim() !== '') {
            appContainer.style.display = 'none';
            existingLogin.style.display = 'flex';
            bindLoginEvents();
        } else {
            appContainer.style.display = 'none';
            fetch('/views/login.html').then(r => r.text()).then(html => {
                document.getElementById('login-screen').outerHTML = html;
                document.getElementById('login-screen').style.display = 'flex';
                bindLoginEvents();
            });
        }

        currentUser = null;
        currentRole = null;
        localStorage.removeItem('role');

        if (window.location.pathname !== '/login') {
            history.replaceState(null, '', '/login');
        }
    }
}

function bindLoginEvents() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            tabLogin.style.color = 'var(--accent-color)';
            tabLogin.style.borderBottom = '2px solid var(--accent-color)';
            tabRegister.style.color = '#999';
            tabRegister.style.borderBottom = 'none';
        });
        tabRegister.addEventListener('click', () => {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            tabRegister.style.color = 'var(--accent-color)';
            tabRegister.style.borderBottom = '2px solid var(--accent-color)';
            tabLogin.style.color = '#999';
            tabLogin.style.borderBottom = 'none';
        });
    }

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        const btn = e.submitter || e.target.querySelector('button[type="submit"]');
        window.toggleButtonLoader(btn, true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                currentRole = data.role;
                checkAuth();
            } else {
                errorEl.textContent = data.error || 'Login failed';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error';
            errorEl.style.display = 'block';
        } finally {
            window.toggleButtonLoader(btn, false);
        }
    });

    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const errorEl = document.getElementById('registerError');

        const btn = e.submitter || e.target.querySelector('button[type="submit"]');
        window.toggleButtonLoader(btn, true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                currentRole = data.role;
                checkAuth();
            } else {
                errorEl.textContent = data.error || 'Registration failed';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error';
            errorEl.style.display = 'block';
        } finally {
            window.toggleButtonLoader(btn, false);
        }
    });
}

function bindGlobalEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            } catch (err) {
                console.error(err);
            } finally {
                localStorage.clear();
                location.reload();
            }
        });
    }

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    if (appContainer) appContainer.appendChild(overlay);

    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.add('active');
            overlay.classList.add('active');
        });
    }

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
}

// --- DASHBOARD SETUP ---

function setupSidebar() {
    const items = currentRole === 'admin'
        ? `<li><a href="#" class="nav-dashboard" onclick="navigateTo('/dashboard'); return false;"><i class="fas fa-users-cog"></i> Dashboard</a></li>`
        : `<li><a href="#" class="nav-dashboard" onclick="navigateTo('/dashboard'); return false;"><i class="fas fa-chart-line"></i> Dashboard</a></li>`;

    sidebarNav.innerHTML = items + `
        <li><a href="#" class="nav-albums" onclick="navigateTo('/albums'); return false;"><i class="fas fa-book"></i> Albums</a></li>
        <li><a href="#" class="nav-settings" onclick="navigateTo('/settings'); return false;"><i class="fas fa-cog"></i> Settings</a></li>
    `;
}

// --- ADMIN LOGIC ---

async function fetchAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
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
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const users = await res.json();
        userList.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'table-row user-row';
            row.innerHTML = `
                <div>${user.id}</div>
                <div style="font-weight:600;">${user.email || 'hidden'}</div>
                <div><span class="badge ${user.role}">${user.role}</span></div>
                <div style="color:#888;">${new Date(user.created_at).toLocaleDateString()}</div>
                <div style="font-size:12px; color:#555;">${user.subscription_end ? new Date(user.subscription_end).toLocaleDateString() : 'N/A'}</div>
                <div class="action-btns">
                    <button class="action-btn" onclick="extendSubscription(${user.id})" title="Add 1 Month"><i class="fas fa-calendar-plus" style="color:var(--primary);"></i></button>
                    ${user.role !== 'admin' ? `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})" title="Delete User"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            userList.appendChild(row);
        });
    } catch (err) { console.error(err); }
}

async function extendSubscription(id) {
    window.confirmAction("Add 1 month to this user's subscription?", async () => {
        try {
            const res = await fetch(`/api/admin/users/${id}/subscription`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            });
            if (res.ok) {
                iziToast.success({ title: 'Success', message: 'Subscription extended!' });
                fetchUsers();
            } else {
                const data = await res.json();
                iziToast.error({ title: 'Error', message: data.error || 'Failed to extend subscription' });
            }
        } catch (err) { console.error(err); }
    });
}

async function deleteUser(id) {
    window.confirmAction('Are you sure you want to delete this user? All their books and pages will be permanently removed.', async () => {
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            });
            if (res.ok) {
                fetchUsers();
                fetchAdminStats();
            } else {
                const data = await res.json();
                iziToast.error({ title: 'Error', message: data.error || 'Failed to delete user' });
            }
        } catch (err) { console.error(err); }
    });
}

function bindAdminDashboardEvents() {
    const addUserBtn = document.getElementById('openAddUserModal');
    const userForm = document.getElementById('createUserForm');

    if (addUserBtn && !addUserBtn.dataset.bound) {
        addUserBtn.addEventListener('click', () => {
            document.getElementById('createUserModal').classList.add('active');
        });
        addUserBtn.dataset.bound = "true";
    }

    if (userForm && !userForm.dataset.bound) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('newEmail').value;
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;

            const btn = e.submitter || e.target.querySelector('button[type="submit"]');
            window.toggleButtonLoader(btn, true);

            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
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
                    iziToast.error({ title: 'Error', message: data.error || 'Failed to create user' });
                }
            } catch (err) { console.error(err); } finally {
                window.toggleButtonLoader(btn, false);
            }
        });
        userForm.dataset.bound = "true";
    }
}

// --- USER & BOOK LOGIC ---

async function fetchUserBooks() {
    try {
        const res = await fetch('/api/books', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const books = await res.json();

        if (!Array.isArray(books)) {
            console.warn('API returned non-array books list:', books);
            const totalBooksEl = document.getElementById('user-total-books');
            if (totalBooksEl) totalBooksEl.textContent = 0;
            renderBooks([]);
            return;
        }

        const totalBooksEl = document.getElementById('user-total-books');
        if (totalBooksEl) totalBooksEl.textContent = books.length;

        renderBooks(books);
        renderRecentActivity(books);
    } catch (err) { console.error('Error fetching user books:', err); }
}

function renderBooks(books) {
    const list = document.getElementById('booksList');
    if (!list) return; // Prevent crash when on Dashboard instead of Albums view
    list.innerHTML = '';
    books.forEach(book => {
        const card = document.createElement('div');
        card.style.cssText = 'background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #efefef; transition: transform 0.2s;';
        card.innerHTML = `
            <div style="font-family: 'Playfair Display', serif; font-size: 1.2rem; color: var(--primary-color); margin-bottom: 0.5rem;">${book.title}</div>
            <div style="font-size: 0.85rem; color: #888; margin-bottom: 1.5rem;">Created: ${new Date(book.created_at).toLocaleDateString()}</div>
            <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" style="flex: 1; padding: 8px;" onclick="navigateTo('/book/${book.uuid}')">Edit Pages</button>
                <button class="btn-secondary" style="padding: 8px;" onclick="copyLink('${book.uuid}')" title="Copy Share Link"><i class="fas fa-share-alt"></i></button>
                <button class="btn-outline" style="padding: 8px; border-color: #ff4d6d; color: #ff4d6d;" onclick="deleteBook('${book.uuid}')" title="Delete Album"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderRecentActivity(books) {
    const activityList = document.getElementById('recentActivityList');
    if (!activityList) return;

    activityList.innerHTML = '';

    if (!books || books.length === 0) {
        activityList.innerHTML = '<p style="color: #888;">No recent albums found.</p>';
        return;
    }

    // Sort array by created_at DESC to get recent first, then slice top 3
    const recentBooks = [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

    recentBooks.forEach(book => {
        const item = document.createElement('div');
        item.style.cssText = 'background: white; padding: 1rem 1.5rem; border-radius: 12px; border: 1px solid #efefef; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
        item.onmouseover = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = 'none'; };

        // Wrap onClick handler instead of inline to keep scope
        item.addEventListener('click', () => navigateTo('/book/' + book.uuid));

        const dateStr = new Date(book.created_at).toLocaleDateString();

        item.innerHTML = `
            <div>
                <div style="font-weight: 600; color: var(--text-color); margin-bottom: 4px;">${book.title}</div>
                <div style="font-size: 0.8rem; color: #888;">Created on ${dateStr} • Template: <span style="text-transform: capitalize;">${book.template_type || 'default'}</span></div>
            </div>
            <div>
                <i class="fas fa-chevron-right" style="color: #ccc;"></i>
            </div>
        `;
        activityList.appendChild(item);
    });
}

async function deleteBook(id) {
    window.confirmAction('Are you sure you want to delete this entire album and all its pages? This cannot be undone.', async () => {
        try {
            const res = await fetch(`/api/books/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            });
            if (res.ok) {
                fetchUserBooks();
            } else {
                const data = await res.json();
                iziToast.error({ title: 'Error', message: data.error || 'Failed to delete album' });
            }
        } catch (err) { console.error(err); }
    });
}

function copyLink(uuid) {
    const url = `${window.location.origin}/book.html?id=${uuid}`;
    navigator.clipboard.writeText(url).then(() => iziToast.success({ title: 'Success', message: 'Share link copied to clipboard!' }));
}

function bindUserDashboardEvents() {
    const createBookBtn = document.getElementById('openCreateBookModal');
    const bookForm = document.getElementById('createBookForm');

    if (createBookBtn && !createBookBtn.dataset.bound) {
        createBookBtn.addEventListener('click', () => {
            document.getElementById('createBookModal').classList.add('active');
        });
        createBookBtn.dataset.bound = "true";
    }

    if (bookForm && !bookForm.dataset.bound) {
        bookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('newBookTitle').value;
            const template_type = document.getElementById('newBookTemplate').value;

            const btn = e.submitter || e.target.querySelector('button[type="submit"]');
            window.toggleButtonLoader(btn, true);

            try {
                const res = await fetch('/api/books', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    },
                    body: JSON.stringify({ title, template_type })
                });
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('createBookModal').classList.remove('active');
                    document.getElementById('createBookForm').reset();
                    navigateTo('/book/' + data.uuid);
                }
            } catch (err) { console.error(err); } finally {
                window.toggleButtonLoader(btn, false);
            }
        });
        bookForm.dataset.bound = "true";
    }
}

// --- EDITOR LOGIC ---

// --- EDITOR LOGIC ---

let quill;

function initEditorView() {
    // Small delay to ensure the dynamically injected DOM from views/editor.html is painted
    setTimeout(() => {
        if (!quill && document.getElementById('editor-container')) {
            quill = new Quill('#editor-container', {
                theme: 'snow',
                placeholder: 'Add a poem or description...',
                modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'header': [1, 2, 3, false] }], [{ 'align': [] }], ['clean']] }
            });
        }
    }, 100);

    const backBtn = document.getElementById('backToDashBtn');
    if (backBtn) {
        // Prevent multiple bindings
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener('click', () => {
            navigateTo('/albums');
        });
    }

    const bookSettingsForm = document.getElementById('bookSettingsForm');
    if (bookSettingsForm) {
        bookSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('editBookTitle').value,
                cover_title: document.getElementById('editCoverTitle').value,
                cover_subtitle: document.getElementById('editCoverSubtitle').value,
                instruction_text: document.getElementById('editInstructionText').value,
                end_title: document.getElementById('editEndTitle').value,
                template_type: document.getElementById('editTemplateType').value,
                color_schema: document.getElementById('editColorSchema').value,
                border_style: document.getElementById('editBorderStyle').value
            };

            const btn = e.submitter || e.target.querySelector('button[type="submit"]');
            window.toggleButtonLoader(btn, true);

            try {
                const res = await fetch(`/api/books/${currentBookId}`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    },
                    body: JSON.stringify(data)
                });
                if (res.ok) iziToast.success({ title: 'Success', message: 'Settings updated!' });
            } catch (err) { console.error(err); } finally {
                window.toggleButtonLoader(btn, false);
            }
        });
    }

    const openAddModal = document.getElementById('openAddModal');
    if (openAddModal) {
        openAddModal.addEventListener('click', () => {
            document.getElementById('editPageId').value = '';
            document.getElementById('submitBtn').textContent = 'Create Page';
            document.getElementById('editPageBorderStyle').value = 'none';
            quill.root.innerHTML = '';
            selectedFiles = [];
            deletedMediaIds = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('pageModal').classList.add('active');
        });
    }

    bindModalEvents();
}

async function fetchBookDetails(bookId) {
    try {
        const bRes = await fetch(`/api/books/${bookId}`, {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const book = await bRes.json();
        document.getElementById('editorBookTitle').textContent = book.title;
        document.getElementById('editBookTitle').value = book.title;
        document.getElementById('editCoverTitle').value = book.cover_title;
        document.getElementById('editCoverSubtitle').value = book.cover_subtitle || '';
        document.getElementById('editInstructionText').value = book.instruction_text || '';
        document.getElementById('editEndTitle').value = book.end_title;
        document.getElementById('editTemplateType').value = book.template_type || 'default';
        document.getElementById('editColorSchema').value = book.color_schema || '#ff8ea0';
        document.getElementById('editBorderStyle').value = book.border_style || 'none';
        document.getElementById('publicLinkBtn').href = `/book.html?id=${book.uuid}`;
    } catch (err) { console.error(err); }
}

async function fetchPages(bookId) {
    try {
        const res = await fetch(`/api/books/${bookId}/pages`, {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const pages = await res.json();

        if (!Array.isArray(pages)) {
            console.warn('API returned non-array pages list:', pages);
            renderPages([]);
            return;
        }

        renderPages(pages);
    } catch (err) { console.error('Error fetching pages:', err); }
}

function renderPages(pages) {
    const list = document.getElementById('pageList');
    list.innerHTML = '';
    pages.forEach((page, index) => {
        const row = document.createElement('div');
        row.className = 'table-row page-row';
        row.dataset.id = page.id;

        const mediaHtml = page.media.map(m =>
            m.type === 'video' ? `<video src="${m.media_path}" muted style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></video>` : `<img src="${m.media_path}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">`
        ).join('');

        const temp = document.createElement('div');
        temp.innerHTML = page.text_content || '';
        const previewText = temp.textContent.substring(0, 50) + '...';

        row.innerHTML = `
            <div style="cursor: grab;" class="drag-handle"><i class="fas fa-grip-vertical" style="color: #bbb; margin-right: 5px;"></i> #${index + 1}</div>
            <div style="font-size:0.9rem; color:#666;">${previewText}</div>
            <div style="display:flex; gap:5px;">${mediaHtml}</div>
            <div class="action-btns">
                <button class="action-btn edit-btn" onclick="openEditPage(${page.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" onclick="deletePage(${page.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(row);
    });

    // Initialize Sortable
    if (window.pageSortable) {
        window.pageSortable.destroy();
    }
    if (typeof Sortable !== 'undefined') {
        window.pageSortable = new Sortable(list, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                const itemEls = list.querySelectorAll('.page-row');
                const orderedPageIds = Array.from(itemEls).map(el => parseInt(el.dataset.id));

                try {
                    const res = await fetch(`/api/books/${currentBookId}/reorder`, {
                        method: 'PUT',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                        },
                        body: JSON.stringify({ orderedPageIds })
                    });
                    if (res.ok) {
                        itemEls.forEach((el, idx) => {
                            el.querySelector('.drag-handle').innerHTML = '<i class="fas fa-grip-vertical" style="color: #bbb; margin-right: 5px;"></i> #' + (idx + 1);
                        });
                    } else {
                        fetchPages(currentBookId);
                    }
                } catch (err) {
                    console.error(err);
                    fetchPages(currentBookId);
                }
            }
        });
    }
}

function bindModalEvents() {
    const previewGrid = document.getElementById('previewGrid');

    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) {
        mediaFile.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const existingCount = previewGrid.querySelectorAll('div[data-existing="true"]').length;
            let currentSelectedValidCount = selectedFiles.filter(f => f !== null).length;

            files.forEach(file => {
                if (currentSelectedValidCount + existingCount < 4) {
                    selectedFiles.push(file);
                    currentSelectedValidCount++;
                    renderNewMediaPreview(file, selectedFiles.length - 1);
                } else {
                    iziToast.warning({ title: 'Limit Reached', message: 'Maximum 4 media items allowed per page.' });
                }
            });
            e.target.value = '';
        });
    }

    const pageForm = document.getElementById('pageForm');
    if (pageForm) {
        pageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            savePage();
        });
    }
}

async function savePage() {
    const pageId = document.getElementById('editPageId').value;
    const isEdit = pageId !== '';

    const formData = new FormData();
    formData.append('text_content', quill.root.innerHTML);
    formData.append('border_style', document.getElementById('editPageBorderStyle').value);
    formData.append('delete_media_ids', JSON.stringify(deletedMediaIds));

    // Collect new media frames
    const newMediaFrames = [];
    selectedFiles.forEach((file, index) => {
        if (file !== null) {
            formData.append('media', file);
            const item = previewGrid.querySelector(`div[data-new-file-index="${index}"]`);
            if (item) {
                const select = item.querySelector('.media-frame-style');
                newMediaFrames.push(select ? select.value : 'square');
            } else {
                newMediaFrames.push('square');
            }
        }
    });
    formData.append('media_frames', JSON.stringify(newMediaFrames));

    // Collect existing media frames
    const existingFrames = {};
    const existingItems = previewGrid.querySelectorAll('div[data-existing="true"]');
    existingItems.forEach(item => {
        const id = item.dataset.mediaId;
        const select = item.querySelector('.media-frame-style');
        if (id && select) {
            existingFrames[id] = select.value;
        }
    });
    if (Object.keys(existingFrames).length > 0) {
        formData.append('existing_media_frames', JSON.stringify(existingFrames));
    }

    const url = isEdit ? `/api/pages/${pageId}` : `/api/books/${currentBookId}/pages`;
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = document.getElementById('submitBtn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
        const res = await fetch(url, {
            method: method,
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
            body: formData
        });
        if (res.ok) {
            document.getElementById('pageModal').classList.remove('active');
            fetchPages(currentBookId);
        } else {
            iziToast.error({ title: 'Error', message: 'Upload failed. Please try again.' });
        }
    } catch (err) {
        console.error(err);
        iziToast.error({ title: 'Error', message: 'Network error during upload.' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

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
            <button type="button" onclick="removeNewMedia(${index}, this)" style="position:absolute; top:-5px; right:-5px; background:#444; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; z-index:10;">&times;</button>
            <select class="media-frame-style" style="position:absolute; bottom:0; left:0; width:100%; font-size:10px; padding:2px; background:rgba(255,255,255,0.9); border:none; border-radius:0 0 8px 8px;">
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="circle">Circle</option>
                <option value="polaroid">Polaroid</option>
            </select>
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

async function openEditPage(pageId) {
    document.getElementById('editPageId').value = pageId;
    document.getElementById('submitBtn').textContent = 'Save Changes';
    selectedFiles = [];
    deletedMediaIds = [];
    previewGrid.innerHTML = '';

    try {
        // Fetch current page data
        const res = await fetch(`/api/books/${currentBookId}/pages`, {
            credentials: 'same-origin'
        });
        const pages = await res.json();
        const page = pages.find(p => p.id === pageId);

        if (page) {
            quill.root.innerHTML = page.text_content || '';
            document.getElementById('editPageBorderStyle').value = page.border_style || 'none';

            // Show existing media
            page.media.forEach(m => {
                const item = document.createElement('div');
                item.style.cssText = 'position:relative; width:80px; height:80px;';
                item.dataset.existing = 'true';
                item.dataset.mediaId = m.id;

                const mediaHtml = m.type === 'video'
                    ? `<video src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></video>`
                    : `<img src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;

                item.innerHTML = `
                    ${mediaHtml}
                    <button type="button" onclick="markMediaForDelete(${m.id}, this)" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; z-index:10;">&times;</button>
                    <select class="media-frame-style" style="position:absolute; bottom:0; left:0; width:100%; font-size:10px; padding:2px; background:rgba(255,255,255,0.9); border:none; border-radius:0 0 8px 8px;">
                        <option value="square" ${m.frame_style === 'square' ? 'selected' : ''}>Square</option>
                        <option value="rounded" ${m.frame_style === 'rounded' ? 'selected' : ''}>Rounded</option>
                        <option value="circle" ${m.frame_style === 'circle' ? 'selected' : ''}>Circle</option>
                        <option value="polaroid" ${m.frame_style === 'polaroid' ? 'selected' : ''}>Polaroid</option>
                    </select>
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
    window.confirmAction('Delete this page?', async () => {
        await fetch(`/api/pages/${pageId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        fetchPages(currentBookId);
    });
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
const openPassBtn = document.getElementById('openPasswordModal');
if (openPassBtn) {
    openPassBtn.addEventListener('click', () => {
        const modal = document.getElementById('passwordModal');
        const form = document.getElementById('passwordForm');
        const error = document.getElementById('passwordError');
        if (modal) modal.classList.add('active');
        if (form) form.reset();
        if (error) error.style.display = 'none';
    });
}

const passForm = document.getElementById('passwordForm');
if (passForm) {
    passForm.addEventListener('submit', async (e) => {
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

        const btn = e.submitter || e.target.querySelector('button[type="submit"]');
        window.toggleButtonLoader(btn, true);

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
            });

            const data = await res.json();
            if (res.ok) {
                iziToast.success({ title: 'Success', message: 'Password changed successfully! Please log in again.' });
                localStorage.clear();
                setTimeout(() => location.reload(), 2000);
            } else {
                errorEl.textContent = data.error || 'Failed to change password';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error';
            errorEl.style.display = 'block';
        } finally {
            window.toggleButtonLoader(btn, false);
        }
    });
}

// Init
checkAuth();
