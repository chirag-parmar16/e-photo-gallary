console.log('Admin JS Loaded - v8');
// State Management
let currentUser = null;
let currentRole = localStorage.getItem('role');
let currentBookId = null;
let allAdminUsers = [];
let isAdminViewingOther = false;

// Determine current view from URL if not already set
if (!window.currentViewName) {
    const path = window.location.pathname;
    if (path.includes('/dashboard')) window.currentViewName = 'dashboard';
    else if (path.includes('/albums')) window.currentViewName = 'albums';
    else if (path.includes('/subscriptions')) window.currentViewName = 'subscriptions';
    else if (path.includes('/subscription_plans')) window.currentViewName = 'subscription_plans';
    else if (path.includes('/users')) window.currentViewName = 'users';
    else if (path.includes('/profile')) window.currentViewName = 'profile';
    else if (path.includes('/book/')) window.currentViewName = 'editor';
    else if (path.includes('/login')) window.currentViewName = 'login';
}

// Standardized Date Formatter
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB');
}

// Ensure $ is globally defined for inline scripts
if (typeof jQuery !== 'undefined' && typeof $ === 'undefined') {
    window.$ = jQuery;
}

// Global Application Initialization
async function initApp() {
    initTheme();
    await loadModals();

    // Initial library setup after modals are loaded
    initFlatpickr();

    await checkAuth();

    // Ensure loader is removed after everything is ready
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 500);
    }
}

async function loadModals() {
    const container = document.getElementById('modal-container');
    if (!container) return;
    try {
        const res = await fetch(`/components/modals.html?v=${Date.now()}`);
        if (res.ok) {
            container.innerHTML = await res.text();
        }
    } catch (err) {
        console.error('Failed to load modals:', err);
    }
}

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Global iziToast Config
    if (window.iziToast) {
        iziToast.settings({
            position: 'topRight',
            transitionIn: 'fadeInDown',
            transitionOut: 'fadeOut',
            timeout: 5000
        });
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}


// Reveal Animations
function initRevealAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-up').forEach(el => observer.observe(el));
}


function initFlatpickr() {
    if (typeof flatpickr === 'undefined') return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    flatpickr('input[type="date"]', {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        allowInput: true,
        theme: isDark ? "dark" : "light"
    });
}

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
const sidebarNav = document.getElementById('sidebarNav');
const navUsername = document.getElementById('navUsername');

// Dashboards
let superAdminDash, userDash, bookEditor;

// --- MPA VIEW INITIALIZATION ---
window.viewUserAlbums = function(userId, email) {
    localStorage.setItem('targetUserId', userId);
    localStorage.setItem('targetEmail', email);
    localStorage.setItem('isAdminViewingOther', 'true');
    window.navigateTo('/albums');
};

window.navigateTo = function (path) {
    // Clear admin viewing flag if navigating to main admin pages or global explorer
    if (['/dashboard', '/users', '/profile', '/subscriptions', '/subscription_plans', '/album_explorer'].includes(path)) {
        localStorage.removeItem('targetUserId');
        localStorage.removeItem('targetEmail');
        localStorage.removeItem('isAdminViewingOther');
        isAdminViewingOther = false;
    }
    
    // In an MPA, this just reloads. But for SPA-like consistency:
    const viewTitleMap = {
        '/dashboard': 'System Overview',
        '/albums': 'Photo Collections',
        '/editor': 'Album Designer',
        '/profile': 'Account Settings',
        '/users': 'User Management',
        '/subscriptions': 'Service Plans',
        '/subscription_plans': 'Manage Subscription Tiers'
    };
    const titleElement = document.getElementById('current-view-title');
    if (titleElement) {
        titleElement.textContent = viewTitleMap[path] || 'Memoria ERP';
    }
    window.location.href = path;
};


function initView() {
    if (window.currentViewName === 'dashboard') {
        const superAdminDash = document.getElementById('super-admin-dashboard');
        const userDash = document.getElementById('user-dashboard');
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
                subEl.textContent = currentUser?.subscription_end ? formatDate(currentUser.subscription_end) : 'Lifetime / Auto';
            }
            fetchUserBooks();
            bindUserDashboardEvents();

            const upgradeBanner = document.getElementById('upgrade-banner');
            const planName = document.getElementById('current-plan-name');
            if (upgradeBanner && currentUser) {
                if (currentUser.subscription_plan === 'pro') {
                    upgradeBanner.style.display = 'none';
                } else {
                    upgradeBanner.style.display = 'block';
                    if (planName) planName.textContent = currentUser.subscription_plan || 'free';
                }
            }
        }
    } else if (window.currentViewName === 'albums') {
        const targetUserId = localStorage.getItem('targetUserId');
        const targetEmail = localStorage.getItem('targetEmail');
        
        if (targetUserId && currentRole === 'admin') {
            isAdminViewingOther = true;
            const titleEl = document.getElementById('current-view-title');
            if (titleEl) titleEl.textContent = `Albums for ${targetEmail || 'User'}`;
            // Hide "Create New Album" button
            const createBtn = document.getElementById('openCreateBookModal');
            if (createBtn) createBtn.style.display = 'none';
        }

        fetchUserBooks();
        bindUserDashboardEvents();
    } else if (window.currentViewName === 'album_explorer') {
        if (currentRole === 'admin') {
            fetchGlobalBooks();
        } else {
            navigateTo('/dashboard');
        }
    } else if (window.currentViewName === 'profile') {
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profile-email-val');
        const typeInput = document.getElementById('profileType');

        if (nameInput) nameInput.value = currentUser?.display_name || 'User';
        if (emailInput) emailInput.value = currentUser?.email || 'user@example.com';
        if (typeInput) typeInput.value = (currentUser?.role === 'admin' ? 'Administrator' : 'Standard Member');

        const profileSubtitle = document.querySelector('.profile-subtitle');
        if (profileSubtitle && currentUser?.email) {
            profileSubtitle.textContent = currentUser.email;
            profileSubtitle.style.opacity = '0.7';
            profileSubtitle.style.fontSize = '0.9rem';
        }

        const openPassBtn = document.getElementById('openSettingsPasswordModal');
        if (openPassBtn) {
            openPassBtn.addEventListener('click', () => {
                const modal = document.getElementById('passwordModal');
                if (modal) modal.classList.add('active');
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
                        if (currentUser) currentUser.display_name = newName;
                        const navUn = document.getElementById('navUsername');
                        if (navUn) navUn.textContent = newName || 'User';
                        const profDisp = document.getElementById('profile-display-name');
                        if (profDisp) profDisp.textContent = newName || 'User';
                        const sideUn = document.getElementById('sidebarUsername');
                        if (sideUn) sideUn.textContent = newName || 'User';
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
        fetchProfileDetails();
    } else if (window.currentViewName === 'editor') {
        // Detect if we came from an admin view
        if (localStorage.getItem('isAdminViewingOther') === 'true') {
             isAdminViewingOther = true;
        }

        const pathParts = window.location.pathname.split('/');
        currentBookId = pathParts[pathParts.length - 1];
        if (typeof initEditorView === 'function') initEditorView();
        fetchBookDetails(currentBookId);
        fetchPages(currentBookId);

        if (isAdminViewingOther) {
            setTimeout(() => {
                const addBtn = document.getElementById('openAddModal');
                const saveBtn = document.getElementById('saveBookSettings');
                const settingsForm = document.getElementById('bookSettingsForm');
                
                if (addBtn) addBtn.style.display = 'none';
                if (saveBtn) saveBtn.style.display = 'none';
                if (settingsForm) {
                    // Disable all inputs in the settings form
                    const inputs = settingsForm.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => input.disabled = true);
                }
            }, 500); // Wait for view to settle
        }
    } else if (window.currentViewName === 'users') {
        fetchAdminUserList();
        const openCreate = document.getElementById('openCreateUserModal');
        if (openCreate) {
            openCreate.addEventListener('click', () => {
                document.getElementById('createUserModal').classList.add('active');
            });
        }
        document.addEventListener('click', (e) => {
            if (e.target.closest('.assign-sub-btn')) {
                const btn = e.target.closest('.assign-sub-btn');
                openAssignSubModal(btn.dataset.userId, btn.dataset.userEmail);
            }
        });
        const assignBtn = document.getElementById('assignSubBtn');
        if (assignBtn) assignBtn.addEventListener('click', assignSubscription);

    } else if (window.currentViewName === 'subscriptions') {
        // Delegate to the page's onSubscriptionsPageReady callback with user context
        if (typeof onSubscriptionsPageReady === 'function') {
            onSubscriptionsPageReady(currentUser);
        } else {
            // Fallback: show admin vs user view
            const adminSubView = document.getElementById('admin-subscription-view');
            const userSubView = document.getElementById('user-subscription-view');
            if (currentRole === 'admin') {
                if (adminSubView) adminSubView.style.display = 'block';
                if (userSubView) userSubView.style.display = 'none';
                if (typeof fetchAuditLogs === 'function') fetchAuditLogs();
            } else {
                if (adminSubView) adminSubView.style.display = 'none';
                if (userSubView) userSubView.style.display = 'block';
            }
        }
        // Always attempt to fetch usage details on this page if it's a user
        if (currentRole !== 'admin') {
            fetchProfileDetails();
        }
    } else if (window.currentViewName === 'subscription_plans') {
        if (typeof onSubscriptionPlansPageReady === 'function') {
            onSubscriptionPlansPageReady(currentUser);
        }
    }
}


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

        // App Initialization logic for MPA
        if (window.currentViewName !== 'login' && window.location.pathname !== '/login') {
            await loadComponents();
            setupSidebar();
            bindGlobalEvents();

            // Show App container
            const appC = document.getElementById('app-container');
            if (appC) appC.style.display = 'flex';

            // Make sure the active view is displayed
            updateNavActive(window.currentViewName || 'dashboard');

            // Initialize Animations
            initRevealAnimation();

            // Boot the specific page's logic
            initView();
        } else {
            // Already authenticated but on login page -> redirect
            if (window.location.pathname === '/login' || window.currentViewName === 'login') {
                window.location.href = '/dashboard';
            }
        }

    } catch (err) {
        console.error("Auth check failed:", err.message);
        // Not authenticated
        currentUser = null;
        currentRole = null;
        localStorage.removeItem('role');

        if (window.currentViewName === 'login' || window.location.pathname === '/login') {
            const extLogin = document.getElementById('login-screen');
            if (extLogin) {
                extLogin.style.display = 'flex';
                bindLoginEvents();
            }
        } else {
            window.location.href = '/login';
        }
    }
}

async function loadComponents() {
    try {
        const [sidebarHtml, navbarHtml, modalsHtml] = await Promise.all([
            fetch('/components/sidebar.html').then(r => r.text()),
            fetch('/components/navbar.html').then(r => r.text()),
            fetch('/components/modals.html').then(r => r.text())
        ]);

        const sideC = document.getElementById('sidebar-container');
        if (sideC) sideC.innerHTML = sidebarHtml;

        const navC = document.getElementById('navbar-container');
        if (navC) navC.innerHTML = navbarHtml;

        const modC = document.getElementById('modals-container');
        if (modC) modC.innerHTML = modalsHtml;

        // Populate elements safely
        const navUn = document.getElementById('navUsername');
        if (navUn) {
            navUn.textContent = currentUser?.display_name || currentUser?.email?.split('@')[0] || (currentRole === 'admin' ? 'Admin' : 'User');
        }

        // Add Theme Toggle Listener
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', toggleTheme);
        }

        // Set initial navbar title based on view
        const viewTitleMap = {
            'dashboard': 'System Overview',
            'albums': 'Photo Collections',
            'editor': 'Album Designer',
            'profile': 'Account Settings',
            'users': 'User Management',
            'subscriptions': 'Service Audits',
            'subscription_plans': 'Manage Subscription Tiers'
        };
        const titleElement = document.getElementById('current-view-title');
        if (titleElement && window.currentViewName) {
            titleElement.textContent = viewTitleMap[window.currentViewName] || 'Memoria ERP';
        }

    } catch (e) {
        console.error('Failed to load components', e);
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
        const name = document.getElementById('registerName').value;
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
                body: JSON.stringify({ name, email, password, display_name: name })
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

    // Global Search Listener removed as per user request

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
    const sidebarUsername = document.getElementById('sidebarUsername');
    const navUsername = document.getElementById('navUsername');
    const nameStr = currentUser?.display_name || currentUser?.email?.split('@')[0] || (currentRole === 'admin' ? 'Admin' : 'User');

    if (sidebarUsername) sidebarUsername.textContent = nameStr;
    if (navUsername) navUsername.textContent = nameStr;

    const adminLinks = `
        <li><a href="/dashboard" class="nav-dashboard"><i class="fas fa-chart-line"></i> System Overview</a></li>
        <li><a href="/users" class="nav-users"><i class="fas fa-users-cog"></i> Member Registry</a></li>
        <li><a href="/album_explorer" class="nav-album-explorer"><i class="fas fa-images"></i> Album Explorer</a></li>
        <li><a href="/subscriptions" class="nav-subscriptions"><i class="fas fa-shield-alt"></i> Service Audits</a></li>
        <li><a href="/subscription_plans" class="nav-subscription_plans"><i class="fas fa-cubes-stacked"></i> Manage Plans</a></li>
        <li><a href="/profile" class="nav-profile"><i class="fas fa-cog"></i> System Settings</a></li>
    `;

    const userLinks = `
        <li><a href="/dashboard" class="nav-dashboard"><i class="fas fa-tachometer-alt"></i> Dashboard</a></li>
        <li><a href="/albums" class="nav-albums"><i class="fas fa-layer-group"></i> Personal Archives</a></li>
        <li><a href="/subscriptions" class="nav-subscriptions"><i class="fas fa-shield-alt"></i> Manage Subscription</a></li>
        <li><a href="/profile" class="nav-profile"><i class="fas fa-user-shield"></i> Account Settings</a></li>
    `;

    const sidebarNav = document.getElementById('sidebarNav');
    if (sidebarNav) {
        sidebarNav.innerHTML = currentRole === 'admin' ? adminLinks : userLinks;
    }

}

async function fetchProfileDetails() {
    if (!currentUser) return;

    const nameEl = document.getElementById('profile-display-name');
    const roleBadge = document.getElementById('profile-role-badge');
    const planValEl = document.getElementById('profile-plan-val');
    const subEndValEl = document.getElementById('profile-sub-end-val');
    const usageText = document.getElementById('profile-usage-text');
    const usageFill = document.getElementById('profile-usage-fill');

    // Role-based visibility for profile sections
    const subCard = document.getElementById('profile-subscription-card');
    const plansSection = document.getElementById('profile-plans-section');
    if (currentRole === 'admin') {
        if (subCard) subCard.style.display = 'none';
        if (plansSection) plansSection.style.display = 'none';
    } else {
        if (subCard) subCard.style.display = 'block';
        if (plansSection) plansSection.style.display = 'block';
    }

    if (nameEl) nameEl.textContent = currentUser.display_name || currentUser.email.split('@')[0];

    if (roleBadge) {
        roleBadge.innerHTML = `<i class="fas fa-key"></i> ${currentRole || 'Member'}`;
    }

    const emailInput = document.getElementById('profile-email-val');
    if (emailInput) {
        emailInput.value = currentUser.email || 'Email missing';
    }

    if (planValEl) {
        planValEl.textContent = currentUser.subscription_plan || 'free';
    }

    const subDateStr = currentUser.subscription_end
        ? formatDate(currentUser.subscription_end)
        : 'Lifetime Access';

    if (subEndValEl) subEndValEl.textContent = subDateStr;

    // Also update dashboard stat card if it exists
    const dashSubEnd = document.getElementById('user-subscription-end');
    if (dashSubEnd) dashSubEnd.textContent = subDateStr;


    // Fetch books to calculate usage
    try {
        const [booksRes, plansRes] = await Promise.all([
            fetch('/api/books', {
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            }),
            fetch('/api/plans', {
                credentials: 'same-origin',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            })
        ]);

        const books = await booksRes.json();
        const plans = await plansRes.json();
        const count = Array.isArray(books) ? books.length : 0;

        const currentPlanNameOrKey = (currentUser.subscription_plan || 'free').toLowerCase();
        let limit = 1; // Default to free tier limit

        if (Array.isArray(plans)) {
            const myPlan = plans.find(p => 
                (p.plan_key || '').toLowerCase() === currentPlanNameOrKey || 
                (p.name || '').toLowerCase() === currentPlanNameOrKey
            );
            if (myPlan) {
                limit = myPlan.max_books;
            } else if (currentPlanNameOrKey === 'free') {
                limit = 1;
            }
        }

        if (usageText) {
            usageText.textContent = `${count} / ${limit === 9999 || limit === Infinity ? '∞' : limit} used`;
        }

        if (usageFill) {
            const maxVal = (limit === 9999 || limit === Infinity) ? count || 1 : limit;
            const percent = Math.min((count / maxVal) * 100, 100);
            usageFill.style.width = percent + '%';
        }
    } catch (err) { console.error('Error fetching dynamic usage data:', err); }
}

// --- ADMIN LOGIC ---

async function fetchAdminStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const data = await res.json();

        // Update simple stats
        const totalUsersEl = document.getElementById('sa-total-users');
        const totalBooksEl = document.getElementById('sa-total-books');
        if (totalUsersEl) totalUsersEl.textContent = data.totalUsers;
        if (totalBooksEl) totalBooksEl.textContent = data.totalBooks;

        // Render Analytics Charts
        renderAdminCharts(data);
    } catch (err) { console.error('fetchAdminStats Error:', err); }
}

let charts = {}; // Store chart instances for cleanup

function renderAdminCharts(data) {
    if (!window.Chart) return;

    // 1. Revenue Chart
    const revCtx = document.getElementById('revenueChart')?.getContext('2d');
    if (revCtx) {
        if (charts.revenue) charts.revenue.destroy();
        charts.revenue = new Chart(revCtx, {
            type: 'line',
            data: {
                labels: data.revenueData.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Revenue (INR)',
                    data: data.revenueData.map(d => d.total),
                    borderColor: '#ff4d6d',
                    backgroundColor: 'rgba(255, 77, 109, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#ff4d6d'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Plan Distribution Chart
    const planCtx = document.getElementById('planChart')?.getContext('2d');
    if (planCtx) {
        if (charts.plan) charts.plan.destroy();
        const labels = data.planDistribution.map(p => p.plan.toUpperCase());
        const counts = data.planDistribution.map(p => p.count);
        const colorMap = { 'free': '#94a3b8', 'basic': '#0ea5e9', 'pro': '#ff4d6d' };
        const backgroundColors = data.planDistribution.map(p => colorMap[p.plan] || '#cbd5e1');

        charts.plan = new Chart(planCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                layout: {
                    padding: { top: 10, bottom: 20, left: 0, right: 10 }
                },
                plugins: {
                    legend: {
                        position: 'right',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            padding: 12,
                            boxWidth: 8,
                            font: { size: 10, weight: '600', family: "'Inter', sans-serif" },
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
    }

    // 3. Growth Chart
    const growthCtx = document.getElementById('growthChart')?.getContext('2d');
    if (growthCtx) {
        if (charts.growth) charts.growth.destroy();

        // Combine dates for labels
        const dates = [...new Set([
            ...data.growth.users.map(u => u.date),
            ...data.growth.books.map(b => b.date)
        ])].sort();

        charts.growth = new Chart(growthCtx, {
            type: 'bar',
            data: {
                labels: dates.map(d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'New Users',
                        data: dates.map(date => data.growth.users.find(u => u.date === date)?.count || 0),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: 'Albums Created',
                        data: dates.map(date => data.growth.books.find(b => b.date === date)?.count || 0),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

async function fetchUsers() {
    const userList = document.getElementById('userList') || document.getElementById('adminUserList');
    if (!userList) return;
    try {
        const tableSelector = document.getElementById('saUserTable') ? '#saUserTable' : '#adminUserManagementTable';
        const res = await fetch('/api/admin/users', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const users = await res.json();

        // Destroy existing DataTable if it exists
        if ($.fn.DataTable.isDataTable(tableSelector)) {
            $(tableSelector).DataTable().destroy();
        }

        users.forEach((user, idx) => {
            const tr = document.createElement('tr');
            const subEndDisplay = user.subscription_end ? formatDate(user.subscription_end) : 'Active Access';
            const subEndRaw = user.subscription_end || '';
            const roleClass = user.role === 'admin' ? 'pro' : 'basic';

            tr.innerHTML = `
                <td class="col-id">#${idx + 1}</td>
                <td class="col-email">
                    <div class="user-email-text">${user.email || 'hidden'}</div>
                </td>
                <td class="col-role"><span class="badge ${roleClass}">${user.role}</span></td>
                <td class="col-date">${formatDate(user.created_at)}</td>
                <td class="col-expiry">${subEndDisplay}</td>
                <td class="col-actions">
                    <div class="action-btns">
                        <button class="action-btn" onclick="openEditPlanModal(${user.id}, '${user.subscription_plan}', '${subEndRaw}')" title="Edit Subscription Plan"><i class="fa-solid fa-pen-to-square" style="color: var(--adm-accent-color);"></i></button>
                        <button class="action-btn" onclick="extendSubscription(${user.id})" title="Quick Provision 30 Days"><i class="fa-solid fa-clock-rotate-left" style="color: #6366f1;"></i></button>
                        ${user.role !== 'admin' ? `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})" title="Terminate Account"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    </div>
                </td>
            `;
            userList.appendChild(tr);
        });

        // Initialize DataTable
        $(tableSelector).DataTable({
            responsive: true,
            searching: false,
            pageLength: 5,
            lengthMenu: [5, 10, 25],
            dom: '<"dt-top-row">rt<"dt-bottom-row"lp>',
            language: {
                search: "",
                searchPlaceholder: "Search registry..."
            },
            columnDefs: [
                { className: 'all', targets: [0, 1] } // ID and Email always visible
            ]
        });

        initFlatpickr();

    } catch (err) { console.error(err); }
}

window.openEditPlanModal = function (id, currentPlan, currentExpiry) {
    const modal = document.getElementById('editPlanModal');
    if (!modal) return;
    document.getElementById('editPlanUserId').value = id;
    document.getElementById('editPlanDays').value = 0;

    // Show modal FIRST
    modal.classList.add('active');

    // Init libraries AFTER modal is visible
    requestAnimationFrame(() => {
        const $jq = window.jQuery || window.$;

        // Set Plan Selection directly on native select
        const sel = document.getElementById('editUserPlanSelect');
        if (sel) sel.value = currentPlan || 'free';

        // Apply Flatpickr to date input
        const dateEl = document.getElementById('editPlanDirectDate');
        if (dateEl && typeof flatpickr !== 'undefined') {
            if (dateEl._flatpickr) {
                dateEl._flatpickr.destroy();
            }
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const fp = flatpickr(dateEl, {
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'j M Y',
                allowInput: true,
                theme: isDark ? 'dark' : 'light'
            });
            if (currentExpiry && currentExpiry !== '' && currentExpiry !== 'Active Access' && currentExpiry !== 'Lifetime Access') {
                fp.setDate(currentExpiry.slice(0, 10));
            } else {
                fp.clear();
            }
        }
    });
}

window.setLifetime = function () {
    document.getElementById('editPlanDays').value = 0;
    document.getElementById('editPlanDirectDate').value = '2099-12-31';
    iziToast.info({ message: 'Lifetime Access Selected' });
};

// Initialize Admin Edit Plan Form
// Helper to refresh user lists across different views
function refreshUserData() {
    console.log('Refreshing user data for view:', window.currentViewName);
    if (window.currentViewName === 'dashboard') {
        fetchUsers();
        if (typeof fetchAdminStats === 'function') fetchAdminStats();
    } else if (window.currentViewName === 'users') {
        fetchAdminUserList();
    } else {
        // Fallback: try to refresh both if they exist
        if (document.getElementById('userList')) fetchUsers();
        if (document.getElementById('adminUserList')) fetchAdminUserList();
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target.id === 'editPlanForm') {
        e.preventDefault();
        const id = document.getElementById('editPlanUserId').value;
        const plan = document.getElementById('editUserPlanSelect').value;
        const days = document.getElementById('editPlanDays').value;
        const directDate = document.getElementById('editPlanDirectDate').value;

        try {
            const body = { plan };
            if (directDate) {
                body.directDate = directDate;
            } else {
                body.days = parseInt(days);
            }

            const res = await fetch(`/api/admin/users/${id}/subscription`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                iziToast.success({ title: 'Success', message: 'User subscription updated' });
                document.getElementById('editPlanModal').classList.remove('active');
                refreshUserData();
            } else {
                const data = await res.json();
                iziToast.error({ title: 'Error', message: data.error || 'Failed to update plan' });
            }
        } catch (err) {
            console.error(err);
            iziToast.error({ title: 'Error', message: 'Connection failed' });
        }
    }
});

window.extendSubscription = async function (id) {
    try {
        const res = await fetch(`/api/admin/users/${id}/subscription`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({ days: 30 }) // Default quick extension
        });

        if (res.ok) {
            iziToast.success({ title: 'Success', message: 'Added 30 days access' });
            if (typeof fetchUsers === 'function') fetchUsers();
            if (typeof fetchAdminUserList === 'function') fetchAdminUserList();
            if (typeof fetchAdminStats === 'function') fetchAdminStats();
        } else {
            const data = await res.json();
            iziToast.error({ title: 'Error', message: data.error || 'Failed to extend' });
        }
    } catch (err) {
        console.error(err);
        iziToast.error({ title: 'Error', message: 'Request failed' });
    }
};

let allUserBooks = []; // Cache for filtration

window.customConfirm = function (options) {
    const modal = document.getElementById('deleteConfirmModal');
    if (!modal) return window.confirmAction(options.message, options.onConfirm);

    document.getElementById('deleteModalTitle').textContent = options.title || 'Confirm Deletion';
    document.getElementById('deleteModalMessage').textContent = options.message;

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        options.onConfirm();
    });

    modal.classList.add('active');
};

async function fetchAdminUserList() {
    const container = document.getElementById('adminUserList');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/users', {
            credentials: 'same-origin',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const users = await res.json();
        allAdminUsers = users; // Cache for Search

        // Render Stats
        const statsGrid = document.getElementById('userStatsGrid');
        if (statsGrid) {
            const total = users.length;
            const pro = users.filter(u => u.subscription_plan === 'pro').length;
            const basic = users.filter(u => (u.subscription_plan === 'basic')).length;
            const free = total - pro - basic;

            statsGrid.innerHTML = `
                <div class="stat-card premium-card-hover">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card premium-card-hover">
                    <div class="stat-value" style="color:var(--adm-accent-color);">${pro}</div>
                    <div class="stat-label">Pro Users</div>
                </div>
                <div class="stat-card premium-card-hover">
                    <div class="stat-value" style="color:#06b6d4;">${basic}</div>
                    <div class="stat-label">Basic Users</div>
                </div>
                <div class="stat-card premium-card-hover">
                    <div class="stat-value" style="color:var(--adm-text-muted);">${free}</div>
                    <div class="stat-label">Free Users</div>
                </div>
            `;

        }

        renderAdminUserRows(users);

    } catch (err) {
        console.error('Error in fetchAdminUserList:', err);
    }
}

function renderAdminUserRows(users) {
    const container = document.getElementById('adminUserList');
    if (!container) return;

    if ($.fn.DataTable.isDataTable('#adminUserManagementTable')) {
        $('#adminUserManagementTable').DataTable().destroy();
    }

    container.innerHTML = '';
    users.forEach((user, idx) => {
        const tr = document.createElement('tr');
        const subEnd = user.subscription_end ? formatDate(user.subscription_end) : 'Lifetime Access';
        const subEndRaw = user.subscription_end || '';
        const plan = user.subscription_plan || 'free';
        const roleClass = user.role === 'admin' ? 'pro' : 'basic';

        tr.innerHTML = `
                <td class="col-id">${idx + 1}</td>
                <td class="col-email">
                    <div class="user-email-text">${user.email}</div>
                </td>
                <td class="col-role"><span class="badge ${roleClass}">${user.role}</span></td>
                <td class="col-role"><span class="badge ${plan}">${plan}</span></td>
                <td class="col-expiry">${subEnd}</td>
                <td class="col-actions">
                    <div class="action-btns">
                        <button class="action-btn" onclick="viewUserAlbums(${user.id}, '${user.email}')" title="View User Albums">
                            <i class="fa-solid fa-images" style="color:#10b981;"></i>
                        </button>
                        <button class="action-btn" onclick="openEditPlanModal(${user.id}, '${plan}', '${subEndRaw}')" title="Edit Subscription Plan">
                            <i class="fa-solid fa-pen-to-square" style="color:var(--adm-accent-color);"></i>
                        </button>
                        <button class="action-btn" onclick="extendSubscription(${user.id})" title="Quick Provision 30 Days">
                            <i class="fa-solid fa-clock-rotate-left" style="color:#6366f1;"></i>
                        </button>
                        ${user.role !== 'admin' ?
                `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})" title="Terminate Account"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    </div>
                </td>
            `;
        container.appendChild(tr);
    });

    $('#adminUserManagementTable').DataTable({
        responsive: true,
        searching: false,
        pageLength: 10,
        dom: '<"dt-top-row">rt<"dt-bottom-row"lp>',
        language: {
            search: "",
            searchPlaceholder: "Search users..."
        },
        columnDefs: [
            { className: 'all', targets: [0, 1] } // Ref ID and Email always visible
        ]
    });

    initFlatpickr();
}

async function deleteUser(id) {
    window.customConfirm({
        title: 'Delete User Account',
        message: 'Are you sure you want to delete this user? This will permanently remove all their data.',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                if (res.ok) {
                    fetchUsers();
                    fetchAdminStats();
                    iziToast.success({ title: 'Success', message: 'User deleted successfully' });
                } else {
                    const data = await res.json();
                    iziToast.error({ title: 'Error', message: data.error || 'Failed to delete user' });
                }
            } catch (err) { console.error(err); }
        }
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
        const targetUserId = localStorage.getItem('targetUserId');
        
        let url = '/api/books';
        if (targetUserId && currentRole === 'admin') {
            url = `/api/admin/users/${targetUserId}/books`;
            isAdminViewingOther = true;
        }

        const res = await fetch(url, {
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

        allUserBooks = books; // Cache for Search

        const totalBooksEl = document.getElementById('user-total-books');
        if (totalBooksEl) totalBooksEl.textContent = books.length;

        renderBooks(books);
        renderRecentActivity(books);
        // Chart logic removed as per user request for stat cards
    } catch (err) { console.error('Error fetching dashboard books:', err); }
}

async function fetchGlobalBooks() {
    try {
        const res = await fetch('/api/admin/all-books', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const books = await res.json();
        if (res.ok) {
            renderGlobalBooks(books);
        } else {
            iziToast.error({ title: 'Error', message: books.error || 'Failed to fetch global registry' });
        }
    } catch (err) {
        console.error('Error fetching global books:', err);
    }
}

function renderGlobalBooks(books) {
    const list = document.getElementById('globalAlbumList');
    if (!list) return;
    list.innerHTML = '';
    
    if (books.length === 0) {
        list.innerHTML = `
            <div class="no-data-msg reveal-up active" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fas fa-ghost" style="font-size: 3rem; color: var(--adm-text-muted); margin-bottom: 1rem;"></i>
                <p>No albums found across the platform registry.</p>
            </div>
        `;
        return;
    }

    // Group albums by owner_email
    const groups = books.reduce((acc, book) => {
        if (!acc[book.owner_email]) acc[book.owner_email] = [];
        acc[book.owner_email].push(book);
        return acc;
    }, {});

    // Sort users by email for consistency
    const sortedEmails = Object.keys(groups).sort();

    sortedEmails.forEach(email => {
        const userBooks = groups[email];
        const section = document.createElement('div');
        section.className = 'user-explorer-section reveal-up active';
        
        section.innerHTML = `
            <div class="user-explorer-header">
                <div class="user-header-info">
                    <i class="fas fa-user-circle"></i>
                    <span class="user-header-email">${email}</span>
                </div>
                <div class="user-album-count">${userBooks.length} ${userBooks.length === 1 ? 'Album' : 'Albums'}</div>
            </div>
            <div class="user-album-grid">
                ${userBooks.map(book => `
                    <div class="album-card active">
                        <div class="album-card-title" style="font-size: 1.2rem; margin-bottom: 0.25rem;">${book.title}</div>
                        <div style="font-size: 0.85rem; color: var(--adm-text-muted); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-heart" style="color:var(--adm-accent-color); font-size:0.75rem;"></i>
                            <span>Dedicated to: ${book.recipient_name || 'Someone Special'}</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--adm-border-color); font-size: 0.75rem; color: var(--adm-text-muted);">
                            <span><i class="far fa-calendar-alt" style="margin-right:4px;"></i> ${formatDate(book.created_at)}</span>
                            <span style="margin-left:auto; opacity:0.6;"><i class="fas fa-fingerprint" style="margin-right:2px;"></i> ${book.uuid.substring(0,6)}</span>
                        </div>

                        <div class="album-card-actions" style="margin-top:1.25rem;">
                            <a href="/book.html?id=${book.uuid}" target="_blank" class="btn-primary" style="width: 100%; text-decoration: none; height: 34px; font-size: 0.8rem;">
                                <i class="fas fa-external-link-alt"></i> View Live
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        list.appendChild(section);
    });
}


function searchHandler(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allUserBooks.filter(b =>
        b.title.toLowerCase().includes(term) ||
        b.uuid.toLowerCase().includes(term)
    );
    renderBooks(filtered);
}

function renderBooks(books) {
    const list = document.getElementById('booksList');
    if (!list) return;
    list.innerHTML = '';
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'album-card reveal-up active';
        card.innerHTML = `
            <div class="album-card-title">${book.title}</div>
            <div style="font-size: 0.85rem; color: var(--adm-accent-color); font-weight: 600; margin-bottom: 8px;"><i class="fa-solid fa-user-tag" style="font-size:0.75rem; margin-right:4px;"></i> For: ${book.recipient_name || 'Someone Special'}</div>
            <div class="album-card-meta">
                <i class="far fa-calendar-alt"></i> Created: ${formatDate(book.created_at)}
            </div>
            <div class="album-card-actions">
                ${isAdminViewingOther ? `
                <a href="/book.html?id=${book.uuid}" target="_blank" class="btn-primary" style="flex: 1; text-align: center; text-decoration: none;">
                    <i class="fas fa-external-link-alt"></i> View Live
                </a>` : `
                <button class="btn-primary" style="flex: 1;" onclick="navigateTo('/book/${book.uuid}')">
                    <i class="fas fa-edit"></i> Edit Pages
                </button>`}
                ${!isAdminViewingOther ? `
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" onclick="copyLink('${book.uuid}')" title="Copy Share Link">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteBook('${book.uuid}')" title="Delete Album">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}


function renderRecentActivity(books) {
    const activityItems = document.getElementById('activityItems');
    if (!activityItems) return;

    if ($.fn.DataTable.isDataTable('#userActivityTable')) {
        $('#userActivityTable').DataTable().destroy();
    }

    activityItems.innerHTML = '';

    if (!books || books.length === 0) {
        return;
    }

    const recentBooks = [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    recentBooks.forEach(book => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => navigateTo('/book/' + book.uuid);

        const dateStr = formatDate(book.created_at);

        tr.innerHTML = `
            <td>
                <div class="activity-icon-container" style="background: var(--adm-pink-pale); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-book" style="color: var(--adm-accent-color); font-size: 0.8rem;"></i>
                </div>
            </td>
            <td>
                <div style="font-family: 'Playfair Display', serif; font-weight: 800; color: var(--adm-text-color); font-size: 1.1rem; letter-spacing: -0.01em;">${book.title}</div>
            </td>
            <td style="color: var(--adm-text-muted); font-size: 0.85rem; font-weight: 500;">${dateStr}</td>
            <td>
                <span class="badge pro" style="text-transform: capitalize; background: rgba(255, 77, 109, 0.08); color: var(--adm-accent-color); border: 1px solid rgba(255, 77, 109, 0.1);">${book.template_type || 'default'}</span>
            </td>
        `;
        activityItems.appendChild(tr);
    });

    $('#userActivityTable').DataTable({
        responsive: true,
        searching: false,
        pageLength: 5,
        dom: 'rtp', // Minimal UI for dashboard activity
        language: {
            emptyTable: "No recent albums found."
        },
        columnDefs: [
            { className: 'all', targets: [0, 1] } // Thumbnail and Album Name
        ]
    });
}

async function deleteBook(id) {
    window.customConfirm({
        title: 'Delete Album',
        message: 'Are you sure you want to delete this entire album? This cannot be undone.',
        onConfirm: async () => {
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
        }
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
            const recipientName = document.getElementById('newRecipientName').value;
            const confirmNameSpan = document.getElementById('confirmRecipientName');

            if (confirmNameSpan) confirmNameSpan.textContent = recipientName;

            // Show confirmation modal instead of creating directly
            const confirmModal = document.getElementById('confirmCreateBookModal');
            if (confirmModal) {
                confirmModal.classList.add('active');
            } else {
                // Fallback if modal not found
                submitCreateBook();
            }
        });

        // Handle back to edit
        const backBtn = document.getElementById('backToEditBookBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('newRecipientName');
                if (nameInput) setTimeout(() => nameInput.focus(), 100);
            });
        }

        // Handle final confirmation
        const finalBtn = document.getElementById('finalCreateBookBtn');
        if (finalBtn) {
            finalBtn.addEventListener('click', () => {
                submitCreateBook();
            });
        }

        bookForm.dataset.bound = "true";
    }
}

async function submitCreateBook() {
    const bookForm = document.getElementById('createBookForm');
    const finalBtn = document.getElementById('finalCreateBookBtn');
    const title = document.getElementById('newBookTitle').value;
    const recipient_name = document.getElementById('newRecipientName').value;
    const template_type = document.getElementById('newBookTemplate').value;
    const border_style = document.getElementById('newBookBorder').value;

    window.toggleButtonLoader(finalBtn, true);

    try {
        const res = await fetch('/api/books', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({ title, recipient_name, template_type, border_style })
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('confirmCreateBookModal').classList.remove('active');
            document.getElementById('createBookModal').classList.remove('active');
            bookForm.reset();
            iziToast.success({ title: 'Success', message: 'Album created!' });
            navigateTo('/book/' + data.uuid);
        } else {
            const data = await res.json();
            iziToast.error({ title: 'Limit Reached', message: data.error || 'Failed to create album' });
        }
    } catch (err) {
        console.error(err);
        iziToast.error({ title: 'Error', message: 'Something went wrong.' });
    } finally {
        window.toggleButtonLoader(finalBtn, false);
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
        // Theme template to color mapping
        const themeColors = {
            'default': '#ff4d6d',
            'birthday': '#ffc107',
            'wedding': '#b76e79',
            'anniversary': '#e83e8c'
        };

        const templateSelect = document.getElementById('editTemplateType');
        const colorInput = document.getElementById('editColorSchema');

        if (templateSelect && colorInput) {
            templateSelect.addEventListener('change', (e) => {
                const selectedTheme = e.target.value;
                if (themeColors[selectedTheme]) {
                    colorInput.value = themeColors[selectedTheme];
                }
            });
        }

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
                if (res.ok) {
                    iziToast.success({ title: 'Success', message: 'Settings updated!' });
                } else {
                    const data = await res.json();
                    iziToast.error({ title: 'Error', message: data.error || 'Update failed' });
                }
            } catch (err) {
                console.error(err);
                iziToast.error({ title: 'Error', message: 'Something went wrong.' });
            } finally {
                window.toggleButtonLoader(btn, false);
            }
        });
    }

    const openAddModal = document.getElementById('openAddModal');
    if (openAddModal) {
        openAddModal.addEventListener('click', () => {
            const titleEl = document.getElementById('pageModalTitle');
            if (titleEl) titleEl.textContent = 'Add New Page';

            document.getElementById('editPageId').value = '';
            document.getElementById('submitBtn').textContent = 'Create Page';
            if (document.getElementById('editPageBorderStyle')) {
                document.getElementById('editPageBorderStyle').value = 'none';
            }
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
    if (!list) return;

    if ($.fn.DataTable.isDataTable('#pageEditorTable')) {
        $('#pageEditorTable').DataTable().destroy();
    }

    list.innerHTML = '';
    const rows = pages.map((page, index) => {
        const mediaHtml = page.media.map(m =>
            m.type === 'video' ? `<video src="${m.media_path}" muted style="width:40px;height:40px;object-fit:cover;border-radius:4px;" loading="lazy"></video>` : `<img src="${m.media_path}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" loading="lazy">`
        ).join('');

        const temp = document.createElement('div');
        temp.innerHTML = page.text_content || '';
        const previewText = temp.textContent.substring(0, 50) + '...';

        return `
            <tr class="page-row" data-id="${page.id}">
                <td data-order="${index + 1}" style="${isAdminViewingOther ? '' : 'cursor: grab;'}" class="${isAdminViewingOther ? '' : 'drag-handle'}">
                    ${isAdminViewingOther ? '' : '<i class="fas fa-grip-vertical" style="color: #bbb; margin-right: 5px;"></i>'} #${index + 1}
                </td>
                <td style="font-size:0.9rem; color:#666;">${previewText}</td>
                <td style="display:flex; gap:5px;">${mediaHtml}</td>
                <td>
                    ${!isAdminViewingOther ? `
                    <div class="action-btns">
                        <button type="button" class="action-btn edit-btn" onclick="openEditPage(${page.id})"><i class="fas fa-edit"></i></button>
                        <button type="button" class="action-btn delete-btn" onclick="deletePage(${page.id})"><i class="fas fa-trash-alt"></i></button>
                    </div>` : '<span style="font-size:0.8rem; color:#999;">Read Only</span>'}
                </td>
            </tr>
        `;
    });

    list.innerHTML = rows.join('');

    $('#pageEditorTable').DataTable({
        responsive: true,
        searching: false,
        paging: true,
        pageLength: 10, // Changed to 10 to ensure pagination is visible with 11 items
        order: [], // Keep API order
        dom: '<"dt-top-row">rt<"dt-bottom-row"ilp>',
        language: {
            search: "",
            searchPlaceholder: "Search pages...",
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            infoEmpty: "Showing 0 to 0 of 0 entries",
            lengthMenu: "Show _MENU_ entries"
        },
        columnDefs: [
            { className: 'all', targets: [0, 1] },
            { type: 'num', targets: 0 } // Explicitly set column 0 as numeric
        ],
        drawCallback: function() {
            console.log('Table redrawn, total records:', this.api().page.info().recordsTotal);
            // Re-initialize sortable only if we are on the first page and it's the only page
            // Drag-and-drop becomes complex with pagination
            initTableSortable();
        }
    });

    function initTableSortable() {
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
                            // Update display indices
                            itemEls.forEach((el, idx) => {
                                el.querySelector('.drag-handle').innerHTML = '<i class="fas fa-grip-vertical" style="color: #bbb; margin-right: 5px;"></i> #' + (idx + 1);
                                el.querySelector('.drag-handle').setAttribute('data-order', idx + 1);
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

// Client-side Image Compression Helper
async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) {
    // Basic type check, with extension fallback for mobile
    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext);
    
    if (!isImage || file.type === 'image/gif') {
        console.log('Skipping compression for non-image/gif:', file.name, file.type);
        return file;
    }

    console.log(`Compressing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => {
            console.error('FileReader error:', reader.error);
            resolve(file);
        };
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = (err) => {
                console.error('Image load error during compression:', err);
                resolve(file);
            };
            img.onload = () => {
                try {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            console.warn('Canvas toBlob failed, using original file.');
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        console.log(`Compressed ${file.name} to ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                } catch (err) {
                    console.error('Compression logic error:', err);
                    resolve(file);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function savePage() {
    const pageId = document.getElementById('editPageId').value;
    const isEdit = pageId !== '';

    const formData = new FormData();
    formData.append('text_content', quill.root.innerHTML);
    // border_style is global now, but we keep this hidden input for safety
    formData.append('border_style', document.getElementById('editPageBorderStyle')?.value || 'none');
    formData.append('delete_media_ids', JSON.stringify(deletedMediaIds));

    // Collect new media frames
    const newMediaFrames = [];
    for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        if (file !== null) {
            try {
                // Compress image if it's not a video or gif
                const finalFile = await compressImage(file);
                formData.append('media', finalFile);

                const item = previewGrid.querySelector(`div[data-new-file-index="${index}"]`);
                if (item) {
                    const select = item.querySelector('.media-frame-style');
                    newMediaFrames.push(select ? select.value : 'square');
                } else {
                    newMediaFrames.push('square');
                }
            } catch (err) {
                console.error(`Error processing file ${index}:`, err);
                formData.append('media', file); // Fallback to original
                newMediaFrames.push('square');
            }
        }
    }
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
            iziToast.success({ title: 'Success', message: 'Page content saved successfully!' });
            document.getElementById('pageModal').classList.remove('active');
            fetchPages(currentBookId);
        } else {
            const errorData = await res.json().catch(() => ({}));
            const errMsg = errorData.error || `Upload failed (Status: ${res.status})`;
            iziToast.error({ title: 'Upload Error', message: errMsg });
            console.error('Upload Error:', errMsg, errorData);
        }
    } catch (err) {
        console.error('Upload Fetch Error:', err);
        iziToast.error({ title: 'Network Error', message: 'Network error or timeout during upload.' });
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
            ? `<video src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 2px solid var(--accent-color);" loading="lazy"></video>`
            : `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 2px solid var(--accent-color);" loading="lazy">`;

        item.innerHTML = `
            ${mediaHtml}
            <button type="button" class="remove-media-btn" onclick="removeNewMedia(${index}, this)">&times;</button>
            <select class="media-frame-style">
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
    const titleEl = document.getElementById('pageModalTitle');
    if (titleEl) titleEl.textContent = 'Edit Page Content';

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
            if (document.getElementById('editPageBorderStyle')) {
                document.getElementById('editPageBorderStyle').value = page.border_style || 'none';
            }

            // Show existing media
            page.media.forEach(m => {
                const item = document.createElement('div');
                item.style.cssText = 'position:relative; width:80px; height:80px;';
                item.dataset.existing = 'true';
                item.dataset.mediaId = m.id;

                const mediaHtml = m.type === 'video'
                    ? `<video src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" loading="lazy"></video>`
                    : `<img src="${m.media_path}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" loading="lazy">`;

                item.innerHTML = `
                    ${mediaHtml}
                    <button type="button" class="remove-media-btn danger" onclick="markMediaForDelete(${m.id}, this)">&times;</button>
                    <select class="media-frame-style">
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
    window.customConfirm({
        title: 'Remove Page',
        message: 'Are you sure you want to delete this page from the album?',
        onConfirm: async () => {
            await fetch(`/api/pages/${pageId}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            fetchPages(currentBookId);
            iziToast.success({ title: 'Success', message: 'Page removed' });
        }
    });
}

// Improved Global Modal closer using delegation
document.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.remove('active');
        return;
    }
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

// --- EDIT USER PLAN MODAL ---
const EDIT_PLAN_MODAL_HTML = `
<div id="editPlanModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;">
    <div style="width:90%;max-width:460px;background:var(--adm-card-bg);border-radius:20px;padding:2rem;border:1px solid var(--adm-border-color);">
        <h3 style="margin-bottom:1.5rem;font-family:'Playfair Display',serif;">Edit User Subscription</h3>
        <input type="hidden" id="editPlanUserId">
        <div class="form-group">
            <label>Subscription Plan</label>
            <select id="editPlanSelect" class="form-control">
                <option value="free">Essential (Free)</option>
                <option value="basic">Basic – ₹500/2mo</option>
                <option value="pro">Professional – ₹1200/2mo</option>
            </select>
        </div>
        <div class="form-group">
            <label>Expiry Date (leave blank for 60 days from today)</label>
            <input type="date" id="editPlanDate" class="form-control">
        </div>
        <div style="display:flex;gap:10px;margin-top:1.5rem;">
            <button class="btn-primary" style="flex:1;" onclick="saveUserPlanEdit()"><i class="fas fa-save"></i> Save</button>
            <button class="btn-outline" style="flex:1;" onclick="document.getElementById('editPlanModal').remove()">Cancel</button>
        </div>
    </div>
</div>`;

function openEditPlanModal(userId, currentPlan, subEnd) {
    const existing = document.getElementById('editPlanModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', EDIT_PLAN_MODAL_HTML);
    document.getElementById('editPlanUserId').value = userId;
    const sel = document.getElementById('editPlanSelect');
    if (currentPlan) sel.value = currentPlan;
    if (subEnd) {
        try {
            const dateStr = new Date(subEnd).toISOString().split('T')[0];
            document.getElementById('editPlanDate').value = dateStr;
        } catch (e) { }
    }
}

async function saveUserPlanEdit() {
    const userId = document.getElementById('editPlanUserId').value;
    const plan = document.getElementById('editPlanSelect').value;
    const dateVal = document.getElementById('editPlanDate').value;
    const token = localStorage.getItem('token');

    let body = { plan };
    if (dateVal) {
        body.directDate = dateVal;
    } else {
        body.days = 60;
    }

    try {
        const res = await fetch(`/api/admin/users/${userId}/subscription`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        document.getElementById('editPlanModal').remove();
        iziToast.success({ message: `Plan updated to "${plan.toUpperCase()}" successfully` });
        if (typeof loadSuperAdminData === 'function') loadSuperAdminData();
    } catch (err) {
        iziToast.error({ title: 'Save Error', message: err.message });
    }
}

// --- SUBSCRIPTION PRICING LOGIC ---
function updatePricingButtons() {
    const plan = (currentUser?.subscription_plan || 'free').toLowerCase();

    const pricingCards = document.querySelectorAll('.pricing-card');
    if (!pricingCards.length) return;

    // Reset all buttons
    pricingCards.forEach(card => {
        const btn = card.querySelector('button');
        if (!btn) return;

        const isProCard = card.classList.contains('popular');

        if (isProCard) {
            if (plan === 'pro') {
                btn.className = 'btn-outline';
                btn.textContent = 'Your Current Tier';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            } else {
                btn.className = 'btn-primary';
                btn.textContent = 'Upgrade Service';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        } else {
            // Essential (Free/Basic)
            if (plan === 'free' || plan === 'basic') {
                btn.className = 'btn-outline';
                btn.textContent = 'Your Current Tier';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            } else {
                btn.className = 'btn-primary';
                btn.textContent = 'Switch Plan';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});
async function fetchAuditLogs() {
    const logList = document.getElementById('auditLogList');
    if (!logList) return;

    try {
        const res = await fetch('/api/admin/payments', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const payments = await res.json();
        renderAuditLogs(payments);
    } catch (err) {
        console.error('Audit Fetch Error:', err);
    }
}

function renderAuditLogs(payments) {
    const logList = document.getElementById('auditLogList');
    if (!logList) return;

    // Destroy existing table if it exists
    if ($.fn.DataTable.isDataTable('#auditTable')) {
        $('#auditTable').DataTable().destroy();
    }

    // Explicitly clear existing content
    logList.innerHTML = '';

    const hasData = Array.isArray(payments) && payments.length > 0;

    if (hasData) {
        logList.innerHTML = payments.map((p, idx) => {
            const date = formatDate(p.created_at);
            const statusColor = p.status === 'success' ? '#10b981' : (p.status === 'failed' ? '#ef4444' : '#f59e0b');
            const statusIcon = p.status === 'success' ? 'fa-check-circle' : (p.status === 'failed' ? 'fa-times-circle' : 'fa-clock');
            const statusLabel = p.status === 'success' ? 'VERIFIED' : p.status.toUpperCase();

            return `
                <tr>
                    <td class="col-center"><span class="audit-id">#${idx + 1}</span></td>
                    <td>
                        <div class="user-email-text">${p.user_email}</div>
                        <div class="audit-date">${date}</div>
                    </td>
                    <td class="col-center"><span class="badge ${p.plan_id}">${p.plan_id.toUpperCase()}</span></td>
                    <td class="col-center"><span class="audit-amount">₹${(p.amount).toLocaleString()}</span></td>
                    <td class="col-center">
                        <span class="audit-status" style="color: ${statusColor};">
                            <i class="fa-solid ${statusIcon}"></i> ${statusLabel}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Re-initialize DataTable
    $('#auditTable').DataTable({
        responsive: true,
        searching: false,
        pageLength: 10,
        dom: '<"dt-top-row">rt<"dt-bottom-row"lp>',
        columnDefs: [
            { className: 'all', targets: [0, 1, 4] }
        ]
    });
}

window.openEditPaymentStatusModal = function (paymentId, currentStatus) {
    document.getElementById('editPaymentId').value = paymentId;
    document.getElementById('editPaymentStatus').value = currentStatus;
    document.getElementById('paymentStatusModal').classList.add('active');
};

window.submitPaymentStatusUpdate = async function () {
    const id = document.getElementById('editPaymentId').value;
    const status = document.getElementById('editPaymentStatus').value;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`/api/admin/payments/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            iziToast.success({ title: 'Updated', message: 'Payment status changed' });
            document.getElementById('paymentStatusModal').classList.remove('active');
            fetchAuditLogs();
        } else {
            const err = await res.json();
            iziToast.error({ title: 'Error', message: err.error || 'Failed to update' });
        }
    } catch (err) {
        iziToast.error({ title: 'Error', message: 'Connection Error' });
    }
};

// ─── Plan Management CRUD ───────────────────────────────────────────────────

window.fetchSubscriptionPlansAdmin = async function () {
    try {
        const res = await fetch('/api/admin/plans', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const plans = await res.json();
        renderPlanManagementTable(plans || []);
    } catch (err) {
        console.error('Error fetching plans:', err);
    }
};

function renderPlanManagementTable(plans) {
    const list = document.getElementById('planManagementList');
    if (!list) return;

    if ($.fn.DataTable.isDataTable('#planManagementTable')) {
        $('#planManagementTable').DataTable().destroy();
    }

    list.innerHTML = plans.map(plan => {
        const statusBadge = plan.is_active
            ? '<span style="color:#10b981;background:rgba(16,185,129,0.1);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:800;">ACTIVE</span>'
            : '<span style="color:#ef4444;background:rgba(239,68,68,0.1);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:800;">INACTIVE</span>';

        return `
            <tr>
                <td style="text-align: center; vertical-align: middle;"><span style="font-size: 0.85rem; font-weight: 700; color: var(--adm-text-muted);">#${plan.id}</span></td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: 700; color: var(--adm-text-color);">${plan.name}</div>
                    <div style="font-size: 0.7rem; color: var(--adm-text-muted);">${plan.plan_key}</div>
                </td>
                <td style="text-align: center; vertical-align: middle;"><span style="font-weight: 600;">₹${plan.price.toLocaleString()}</span></td>
                <td style="text-align: center; vertical-align: middle;">${plan.days} Days</td>
                <td style="text-align: center; vertical-align: middle;">${plan.max_books === 9999 ? 'UNLIMITED' : plan.max_books}</td>
                <td style="text-align: center; vertical-align: middle;">${statusBadge}</td>
                <td style="text-align: center; vertical-align: middle;">
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="action-btn-premium edit-btn edit-plan-btn" data-plan='${JSON.stringify(plan).replace(/'/g, "&apos;")}' title="Edit Plan">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="action-btn-premium delete-btn" onclick="deleteSubscriptionPlan(${plan.id})" title="Delete Plan">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.onclick = () => {
            const plan = JSON.parse(btn.dataset.plan);
            openEditPlanEditorModal(plan);
        };
    });

    $('#planManagementTable').DataTable({
        responsive: true,
        pageLength: 5,
        dom: '<"dt-top-row">rt<"dt-bottom-row"lp>',
        language: { emptyTable: "No subscription plans defined." },
        columnDefs: [{ className: 'all', targets: [0, 1, 6] }]
    });
}

window.openCreatePlanModal = function () {
    document.getElementById('planModalTitle').textContent = 'Create New Plan';
    document.getElementById('planEditId').value = '';
    document.getElementById('planEditKey').value = '';
    document.getElementById('planEditName').value = '';
    document.getElementById('planEditPrice').value = '0';
    document.getElementById('planEditDays').value = '60';
    document.getElementById('planEditMaxBooks').value = '1';
    document.getElementById('planEditActive').value = '1';
    document.getElementById('planEditFeatures').value = '[]';
    document.getElementById('planEditorModal').classList.add('active');
};

window.openEditPlanEditorModal = function (plan) {
    document.getElementById('planModalTitle').textContent = 'Edit Plan';
    document.getElementById('planEditId').value = plan.id;
    document.getElementById('planEditKey').value = plan.plan_key;
    document.getElementById('planEditName').value = plan.name;
    document.getElementById('planEditPrice').value = plan.price;
    document.getElementById('planEditDays').value = plan.days;
    document.getElementById('planEditMaxBooks').value = plan.max_books;
    document.getElementById('planEditActive').value = plan.is_active;
    let featuresVal = plan.features || '[]';
    try {
        let parsed = typeof featuresVal === 'string' ? JSON.parse(featuresVal) : featuresVal;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Handle double stringify
        featuresVal = JSON.stringify(parsed, null, 2);
    } catch(e) {
        console.error('Feature parse error', e);
    }
    document.getElementById('planEditFeatures').value = featuresVal;
    document.getElementById('planEditorModal').classList.add('active');
};

window.closePlanModal = function () {
    document.getElementById('planEditorModal').classList.remove('active');
};

// Handle Plan Save
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'planEditorForm') {
        e.preventDefault();
        const id = document.getElementById('planEditId').value;
        const data = {
            plan_key: document.getElementById('planEditKey').value,
            name: document.getElementById('planEditName').value,
            price: parseFloat(document.getElementById('planEditPrice').value),
            days: parseInt(document.getElementById('planEditDays').value),
            max_books: parseInt(document.getElementById('planEditMaxBooks').value),
            is_active: parseInt(document.getElementById('planEditActive').value),
            features: document.getElementById('planEditFeatures').value || '[]'
        };

        const btn = document.getElementById('btn-save-plan');
        window.toggleButtonLoader(btn, true);

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/admin/plans/${id}` : '/api/admin/plans';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                iziToast.success({ title: 'Success', message: 'Plan saved successfully' });
                closePlanModal();
                fetchSubscriptionPlansAdmin();
            } else {
                const err = await res.json();
                iziToast.error({ title: 'Error', message: err.error || 'Failed to save plan' });
            }
        } catch (err) {
            iziToast.error({ title: 'Error', message: 'Connection error' });
        } finally {
            window.toggleButtonLoader(btn, false);
        }
    }
});

window.deleteSubscriptionPlan = function (id) {
    window.confirmAction('Are you sure you want to delete this plan? This may affect users subscribed to it.', async () => {
        try {
            const res = await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                iziToast.success({ title: 'Deleted', message: 'Plan removed' });
                fetchSubscriptionPlansAdmin();
            } else {
                const err = await res.json();
                iziToast.error({ title: 'Error', message: err.error || 'Failed to delete plan' });
            }
        } catch (err) {
            iziToast.error({ title: 'Error', message: 'Connection error' });
        }
    });
};
