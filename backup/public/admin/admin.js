const pageList = document.getElementById('pageList');
const uploadForm = document.getElementById('uploadForm');
const pageModal = document.getElementById('pageModal');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');
const editPageId = document.getElementById('editPageId');
const mediaUploadField = document.getElementById('mediaUploadField');

// Simple prompt for basic auth
const credentials = btoa('admin:premium-memory');
const headers = { 'Authorization': `Basic ${credentials}` };

// View Switching
document.querySelectorAll('.nav-links a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');

        // Update active link
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        link.parentElement.classList.add('active');

        // Show active view
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById(view).classList.add('active');

        if (view === 'dashboard') fetchStats();
        if (view === 'pages') fetchPages();
    });
});

// Modal Logic
document.getElementById('openAddModal').addEventListener('click', () => {
    modalTitle.textContent = 'Add New Memory';
    submitBtn.textContent = 'Create Memory';
    editPageId.value = '';
    uploadForm.reset();
    selectedFiles = []; // Clear files for new memory
    existingMediaToRemove = [];
    currentlyEditingMedia = [];
    renderPreviews();
    quill.setContents([]);
    mediaUploadField.style.display = 'block';
    document.getElementById('mediaNote').textContent = 'Add up to 4 photos or videos.';
    pageModal.classList.add('active');
});

document.querySelector('.close-modal').addEventListener('click', () => {
    pageModal.classList.remove('active');
});

// Stats
async function fetchStats() {
    try {
        const res = await fetch('/api/admin/stats', { headers });
        const data = await res.json();
        document.getElementById('stat-pages').textContent = data.totalPages;
        document.getElementById('stat-media').textContent = data.totalMedia;
    } catch (err) { console.error(err); }
}

// Pages
async function fetchPages() {
    const res = await fetch('/api/pages');
    const pages = await res.json();
    renderPages(pages);
}

function renderPages(pages) {
    pageList.innerHTML = '';
    pages.forEach((page, index) => {
        const row = document.createElement('div');
        row.className = 'table-row';

        const mediaHtml = page.media.map(m => `
            ${m.type === 'video'
                ? `<video src="${m.media_path}" muted></video>`
                : `<img src="${m.media_path}">`
            }
        `).join('');

        // Strip HTML tags for preview
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = page.text_content || '';
        const previewText = tempDiv.textContent || tempDiv.innerText || 'No description';

        row.innerHTML = `
            <div class="page-order-col" style="font-weight: 600; color: var(--accent-color);">#${index + 1}</div>
            <div class="content-preview-col" style="color: #666; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${previewText}</div>
            <div class="media-stack-col">
                <div class="media-stack">${mediaHtml}</div>
            </div>
            <div class="action-btns">
                <button class="action-btn edit-btn" onclick="openEditModal(${page.id})" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" onclick="deletePage(${page.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        pageList.appendChild(row);
    });
}

// Initialize Quill
const quill = new Quill('#editor-container', {
    theme: 'snow',
    placeholder: 'Write your memory description or poem here...',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, false] }],
            [{ 'align': [] }],
            ['clean']
        ]
    }
});

// Preview & File Management
let selectedFiles = []; // Track actual File objects for upload
let existingMediaToRemove = []; // Track IDs of existing media to delete
let currentlyEditingMedia = []; // Existing media from server
const previewGrid = document.getElementById('previewGrid');

document.getElementById('mediaFile').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 4) {
        alert('Max 4 files allowed');
        e.target.value = '';
        return;
    }

    files.forEach(file => {
        // Simple duplicate check
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });

    renderPreviews();
    e.target.value = '';
});

function renderPreviews() {
    previewGrid.innerHTML = '';

    // 1. Existing Media
    currentlyEditingMedia.forEach(m => {
        if (existingMediaToRemove.includes(m.id)) return;

        const div = document.createElement('div');
        div.className = 'preview-item existing';
        div.style.cssText = 'position:relative; width:70px; height:70px; border-radius:10px; overflow:hidden; border:2px solid #ddd;';

        const img = document.createElement(m.type === 'video' ? 'video' : 'img');
        img.src = m.media_path;
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        div.appendChild(img);

        const removeBtn = document.createElement('div');
        removeBtn.innerHTML = '&times;';
        removeBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:rgba(255,0,0,0.7); color:white; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; font-weight:bold; z-index:20;';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            existingMediaToRemove.push(m.id);
            renderPreviews();
        };
        div.appendChild(removeBtn);
        previewGrid.appendChild(div);
    });

    // 2. New Files
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item new';
        div.style.cssText = 'position:relative; width:70px; height:70px; border-radius:10px; overflow:hidden; border:2px solid var(--accent-color);';

        const removeBtn = document.createElement('div');
        removeBtn.innerHTML = '&times;';
        removeBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:white; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; font-weight:bold; z-index:20;';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            selectedFiles.splice(index, 1);
            renderPreviews();
        };
        div.appendChild(removeBtn);

        const reader = new FileReader();
        reader.onload = (event) => {
            const media = file.type.startsWith('image/') ? document.createElement('img') : document.createElement('div');
            if (file.type.startsWith('image/')) {
                media.src = event.target.result;
            } else {
                media.innerHTML = '<i class="fas fa-video"></i>';
                media.className = 'video-placeholder';
                media.style.cssText = 'width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eee; color:#666;';
            }
            media.style.width = '100%';
            media.style.height = '100%';
            media.style.objectFit = 'cover';
            div.appendChild(media);
        };
        reader.readAsDataURL(file);
        previewGrid.appendChild(div);
    });
}

async function openEditModal(id) {
    try {
        const res = await fetch(`/api/admin/pages/${id}`, { headers });
        const page = await res.json();

        modalTitle.textContent = 'Edit Memory';
        submitBtn.textContent = 'Save Changes';
        editPageId.value = page.id;
        quill.root.innerHTML = page.text_content || '';

        selectedFiles = [];
        existingMediaToRemove = [];
        currentlyEditingMedia = page.media || [];

        renderPreviews(currentlyEditingMedia);

        mediaUploadField.style.display = 'block';
        document.getElementById('mediaNote').textContent = 'Add photos/videos or remove existing ones.';

        pageModal.classList.add('active');
    } catch (err) { console.error(err); }
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = editPageId.value !== '';
    const textContent = quill.root.innerHTML;

    if (isEdit) {
        await saveEdit(editPageId.value, textContent);
    } else {
        await handleCreate(textContent);
    }
});

async function saveEdit(id, text) {
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('media', file));
    formData.append('text_content', text);
    formData.append('remove_media_ids', JSON.stringify(existingMediaToRemove));

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`/api/admin/pages/${id}`, {
            method: 'PUT',
            headers: headers,
            body: formData
        });
        if (res.ok) {
            pageModal.classList.remove('active');
            selectedFiles = [];
            existingMediaToRemove = [];
            fetchPages();
            fetchStats();
        }
    } catch (err) { console.error(err); } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

async function handleCreate(text) {
    const formData = new FormData();

    if (selectedFiles.length === 0 && quill.getText().trim().length === 0) {
        alert('Please provide photos or text');
        return;
    }

    selectedFiles.forEach(file => formData.append('media', file));
    formData.append('text_content', text);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
        const res = await fetch('/api/admin/pages', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (res.ok) {
            pageModal.classList.remove('active');
            fetchPages();
            fetchStats();
        }
    } catch (err) { console.error(err); } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Memory';
    }
}

async function deletePage(id) {
    if (confirm('Are you sure you want to delete this memory?')) {
        await fetch(`/api/admin/pages/${id}`, {
            method: 'DELETE',
            headers: headers
        });
        fetchPages();
        fetchStats();
    }
}

// Settings
const settingsForm = document.getElementById('settingsForm');
const coverTitleInput = document.getElementById('coverTitle');
const endTitleInput = document.getElementById('endTitle');

async function fetchSettings() {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    coverTitleInput.value = settings.cover_title || '';
    endTitleInput.value = settings.end_title || '';
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { cover_title: coverTitleInput.value, end_title: endTitleInput.value };
    const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (res.ok) alert('Settings saved!');
});

// Mobile Sidebar Toggle
const sidebar = document.querySelector('.sidebar');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

mobileMenuToggle.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', toggleSidebar);

// Close sidebar on link click (mobile)
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 992) toggleSidebar();
    });
});

// Init
fetchStats();
fetchSettings();
// Also fetch pages initially so the list is ready if user clicks 'Manage Pages'
fetchPages();
