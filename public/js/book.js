document.addEventListener('DOMContentLoaded', () => {
    const book = document.getElementById('book');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');

    // Pagination and state
    let currentPage = 0;
    let totalPages = 0;
    let pages = [];
    let isMobile = window.innerWidth <= 932;
    let isLandscape = window.innerWidth > window.innerHeight;

    // Get Book UUID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookUuid = urlParams.get('id');

    async function loadBookData() {
        try {
            const url = bookUuid ? `/api/public/books/${bookUuid}` : '/api/pages';
            const response = await fetch(url);
            const data = await response.json();

            let originalPages = [];
            let settings = { cover_title: 'Our Timeless Journey', end_title: 'THE END' };

            if (data.pages) {
                originalPages = data.pages;
                if (data.book) {
                    settings.recipient_name = data.book.recipient_name;
                    settings.cover_title = data.book.cover_title;
                    settings.cover_subtitle = data.book.cover_subtitle;
                    settings.instruction_text = data.book.instruction_text;
                    settings.template_type = data.book.template_type;
                    settings.color_schema = data.book.color_schema;
                    settings.border_style = data.book.border_style;
                    window.bookData = data.book;
                }
            } else {
                originalPages = data;
                // Fetch legacy settings if single book
                const sRes = await fetch('/api/settings');
                const sData = await sRes.json();
                settings = { ...settings, ...sData };
            }

            initBook(originalPages, settings);
        } catch (error) {
            console.error('Error loading book:', error);
        }
    }

    function initBook(originalData, settings) {
        updateDimensions();
        
        // Remove the grid-splitting logic to preserve exact 2-page spread as requested
        let processedData = [...originalData];

        setTimeout(() => createThemeParticles(settings.template_type || 'default'), 100);
        setupBookUI(processedData, settings);
        
        // Initial scale update
        updateBookScale();
    }

    function updateDimensions() {
        isMobile = window.innerWidth <= 932;
        isLandscape = window.innerWidth > window.innerHeight;
    }

    // Dynamic Scaling Logic
    function updateBookScale() {
        if (!book) return;
        
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;
        
        if (isMobile && isLandscape) {
            const padding = 10;
            const baseWidth = 920;
            const baseHeight = 600;
            
            const availableWidth = window.innerWidth - padding;
            const availableHeight = window.innerHeight - padding - 30;
            
            const scaleX = availableWidth / baseWidth;
            const scaleY = availableHeight / baseHeight;
            
            let scale = Math.min(scaleX, scaleY) * 1.08;
            scale = Math.min(scale, 1.18); 
            
            // Handle horizontal shift for covers on mobile landscape
            let xOffset = -50;
            if (currentPage === 0) xOffset -= 25;
            else if (currentPage === totalPages) xOffset += 25;
            
            book.style.transform = `translate(${xOffset}%, -50%) scale(${scale})`;
            book.style.left = '50%';
            book.style.top = '50%';
            book.style.position = 'absolute';
        } else {
            // Reset for desktop/portrait
            book.style.transform = '';
            book.style.left = '';
            book.style.top = '';
            book.style.position = '';
            
            // Re-apply desktop translateX if needed
            if (!isMobile) {
                if (currentPage === 0) book.style.transform = 'translateX(-25%)';
                else if (currentPage === totalPages) book.style.transform = 'translateX(25%)';
                else book.style.transform = 'translateX(0)';
            }

            if (typeof updatePageInfo === 'function') updatePageInfo(); 
        }
    }

    function createPageContent(pageData, side, settings) {
        if (!pageData) return `<div class="page-content ${side} empty"></div>`;
        const borderStyle = settings && settings.border_style && settings.border_style !== 'none' ? settings.border_style : null;
        const borderClass = borderStyle ? `border-style-${borderStyle}` : '';

        const isTextOnly = !pageData.media || pageData.media.length === 0;
        const mediaItems = (pageData.media || []).map(m => `
            <div class="media-item frame-${m.frame_style || 'square'}">
                ${m.type === 'video'
                ? `<video src="${m.media_path}" loop muted preload="metadata" loading="lazy"></video>`
                : `<img src="${m.media_path}" alt="Memory" loading="lazy">`
            }
            </div>
        `).join('');

        return `
            <div class="page-content ${side} ${isTextOnly ? 'poem-page' : ''} ${borderClass}">
                ${!isTextOnly ? `
                <div class="media-grid count-${pageData.media.length}">
                    ${mediaItems}
                </div>` : ''}
                <div class="minimal-text">${pageData.text_content || ''}</div>
            </div>
        `;
    }

    let currentMobileView = 'front';

    function setupBookUI(data, settings) {
        book.innerHTML = '';
        currentPage = 0;

        // Apply Global Themes
        if (settings.color_schema) {
            const root = document.documentElement;
            const color = settings.color_schema;
            
            // Set primary
            root.style.setProperty('--primary-color', color);
            
            // Generate variations for a premium look
            // Simple hex to HSL adjustment (simulated for brevity or use CSS color-mix if possible)
            // But we can just set them slightly different if the user didn't provide multiple
            root.style.setProperty('--accent-color', color);
            
            // Attempt to make a "warm" version or lighter version via CSS filter or mix
            // For now, we'll set a gradient variable that uses the color
            root.style.setProperty('--warm-accent', color);
            root.style.setProperty('--gradient-cover', `linear-gradient(135deg, ${color}, ${adjustColor(color, 20)})`);
        }
        document.body.className = 'template-' + (settings.template_type || 'default');

        const recipientName = settings.recipient_name || 'Someone Special';
        const coverSubtitle = settings.cover_subtitle || 'A collection of memories, frozen in time.';
        const instructionText = settings.instruction_text || 'Tap to open';
        const endTitle = settings.end_title || 'THE END';

        // 1. Cover Sheet
        const coverSheet = document.createElement('div');
        coverSheet.className = 'page';
        coverSheet.style.zIndex = data.length + 10;
        coverSheet.innerHTML = `
            <div class="page-content front cover-front">
                <div class="cover-glow"></div>
                <div class="cover-design-element-top"></div>
                <div class="cover-content">
                    <div class="cover-pre-title-wrapper">
                        <span class="cover-pre-title">A Memory Book For</span>
                    </div>
                    <h1 class="recipient-display-name">${recipientName}</h1>
                    <div class="cover-divider"></div>
                    <p class="cover-tagline">${coverSubtitle}</p>
                    <div class="instruction">${instructionText}</div>
                </div>
                <div class="cover-design-element-bottom"></div>
            </div>
            ${createPageContent(data[0], 'back', settings)}
        `;
        book.appendChild(coverSheet);

        // 2. Middle Sheets
        for (let i = 1; i < data.length; i += 2) {
            const sheet = document.createElement('div');
            sheet.className = 'page';
            sheet.style.zIndex = data.length - i;
            sheet.innerHTML = `
                ${createPageContent(data[i], 'front', settings)}
                ${createPageContent(data[i + 1], 'back', settings)}
            `;
            book.appendChild(sheet);
        }

        // 3. End Cover
        const allSheets = book.querySelectorAll('.page');
        const lastSheet = allSheets[allSheets.length - 1];

        if (lastSheet && !lastSheet.querySelector('.page-content.back:not(.empty)')) {
            const backSide = lastSheet.querySelector('.page-content.back');
            backSide.innerHTML = `
                <h1>${endTitle}</h1>
                <p>Thank you for being part of this story.</p>
                <button onclick="window.location.reload()" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
            `;
            backSide.classList.remove('empty');
            backSide.classList.add('cover-back');
        } else {
            const endSheet = document.createElement('div');
            endSheet.className = 'page';
            endSheet.style.zIndex = 0;
            endSheet.innerHTML = `
                <div class="page-content front empty"></div>
                <div class="page-content back cover-back">
                    <h1>${endTitle}</h1>
                    <p>Thank you for being part of this story.</p>
                    <button onclick="window.location.reload()" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
                </div>
            `;
            book.appendChild(endSheet);
        }

        pages = document.querySelectorAll('.page');
        totalPages = pages.length;

        // Navigation interactions
        pages.forEach((page, index) => {
            page.addEventListener('click', (e) => {
                const rect = page.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                
                // If it's the front cover or we are at the end, behave differently?
                // Actually the current logic works well:
                if (index === currentPage) {
                    flipPage(currentPage, 'next');
                } else if (index === currentPage - 1) {
                    flipPage(currentPage - 1, 'prev');
                }
            });
        });

        // Touch Swipe Navigation
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchStartX - touchEndX > swipeThreshold) {
                // Swipe Left -> Next
                if (currentPage < totalPages) flipPage(currentPage, 'next');
            } else if (touchEndX - touchStartX > swipeThreshold) {
                // Swipe Right -> Prev
                if (currentPage > 0) flipPage(currentPage - 1, 'prev');
            }
        }

        animateContent(pages[0], true);
        updatePageInfo();

        const fsTrigger = () => {
            if (isMobile && isLandscape && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
            window.removeEventListener('click', fsTrigger);
        };
        window.addEventListener('click', fsTrigger);

        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('fade-out');
        }, 800);
    }

    function flipPage(index, direction) {
        if (direction === 'next' && currentPage < totalPages) {
            const page = pages[currentPage];
            page.classList.add('flipped');
            setTimeout(() => { page.style.zIndex = currentPage; }, 600);
            currentPage++;
            if (currentPage < totalPages) animateContent(pages[currentPage], true);
        } else if (direction === 'prev' && currentPage > 0) {
            currentPage--;
            const page = pages[currentPage];
            page.classList.remove('flipped');
            page.style.zIndex = totalPages + 10 - currentPage;
            animateContent(page, true);
        }
        updatePageInfo();
    }

    function animateContent(page, isVisible) {
        if (!page) return;
        const mediaItems = page.querySelectorAll('.page-content img, .page-content video');
        const texts = page.querySelectorAll('.minimal-text');

        if (mediaItems.length > 0) {
            gsap.to(mediaItems, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out", stagger: 0.2, delay: 0.2 });
        }
        if (texts.length > 0) {
            gsap.to(texts, { opacity: 1, y: 0, duration: 1, ease: "power2.out", delay: 0.4 });
        }

        mediaItems.forEach(m => {
            if (m.tagName === 'VIDEO' && isVisible) m.play().catch(() => { });
            else if (m.tagName === 'VIDEO') m.pause();
        });
    }

    function updatePageInfo() {
        updateDimensions();
        
        // If scaled via JS, we don't need the translateX centering logic
        if (isMobile && isLandscape) {
            pageNumbers.textContent = `Spread ${currentPage} of ${totalPages - 1}`;
            if (currentPage === 0) pageNumbers.textContent = 'Cover';
            if (currentPage === totalPages) pageNumbers.textContent = 'The End';
            updateBookScale();
            return;
        }

        if (currentPage === 0) {
            pageNumbers.textContent = 'Cover';
            book.style.transform = 'translateX(-25%)';
        } else if (currentPage === totalPages) {
            pageNumbers.textContent = 'The End';
            book.style.transform = 'translateX(25%)';
        } else {
            pageNumbers.textContent = `Spread ${currentPage} of ${totalPages - 1}`;
            book.style.transform = 'translateX(0)';
        }
    }

    // Fullscreen buttons
    const fsBtn = document.getElementById('fullscreenBtn');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        });
    }

    const updateFsText = () => {
        const isFS = !!document.fullscreenElement;
        if (fsBtn) fsBtn.textContent = isFS ? '✖ Exit' : '⛶ Fullscreen';
    };

    document.addEventListener('fullscreenchange', updateFsText);

    // Nav buttons
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) flipPage(currentPage, 'next');
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 0) flipPage(currentPage - 1, 'prev');
    });

    // Resize handler
    window.addEventListener('resize', () => {
        updateDimensions();
        updateBookScale();
    });

    // Handle Orientation Change specifically
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            updateDimensions();
            updateBookScale();
        }, 300);
    });

    // Helper to lighten/darken color
    function adjustColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Particles (Petals/Confetti)
    function createThemeParticles(templateType) {
        let container = document.getElementById('petal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'petal-container';
            container.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;';
            document.body.prepend(container);
        }

        container.innerHTML = '';

        let count = 30;
        let classes = ['petal'];
        let useEmoji = false;
        let emojis = [];

        if (templateType === 'birthday') {
            count = 60;
            classes = ['particle', 'confetti'];
        } else if (templateType === 'wedding') {
            count = 40;
            classes = ['petal', 'cherry', 'white'];
        } else if (templateType === 'anniversary') {
            count = 35;
            classes = ['petal', 'heart'];
        } else if (templateType === 'graduation') {
            count = 40;
            useEmoji = true;
            emojis = ['🎓', '✨', '⭐'];
        } else if (templateType === 'travel') {
            count = 30;
            useEmoji = true;
            emojis = ['✈️', '🌍', '🗺️', '⭐'];
        } else if (templateType === 'babyshower') {
            count = 40;
            useEmoji = true;
            emojis = ['👶', '🍼', '🧸', '💖'];
        } else {
            classes = ['petal', 'rose'];
            count = 20;
        }

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            
            if (useEmoji) {
                particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                particle.style.position = 'absolute';
                particle.style.fontSize = `${Math.random() * 15 + 15}px`;
                particle.style.userSelect = 'none';
                particle.className = 'emoji-particle';
                // Add some basic animation styles inline if not in CSS
                particle.style.animation = `fall ${Math.random() * 5 + 5}s linear infinite`;
            } else {
                particle.classList.add(...classes);
            }

            if (templateType === 'birthday') {
                const colors = ['#ff3d68', '#ffc107', '#00c2ff', '#7b61ff'];
                particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                particle.style.width = `${Math.random() * 10 + 10}px`;
                particle.style.height = `${Math.random() * 5 + 5}px`;
                particle.style.animationDuration = `${Math.random() * 3 + 3}s`;
            } else if (!useEmoji) {
                if (classes.includes('white')) {
                    particle.style.filter = 'grayscale(100%) brightness(200%)';
                }
                particle.style.transform = `scale(${Math.random() * 0.5 + 0.8})`;
                particle.style.animationDuration = `${Math.random() * 5 + 5}s, ${Math.random() * 3 + 2}s`;
            }

            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = '-50px';
            particle.style.animationDelay = `${Math.random() * 5}s`;
            particle.style.opacity = Math.random() * 0.5 + 0.5;
            container.appendChild(particle);
        }
    }
    loadBookData();
});
