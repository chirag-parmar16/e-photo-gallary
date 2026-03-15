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
        isMobile = window.innerWidth <= 932;
        isLandscape = window.innerWidth > window.innerHeight;

        let processedData = [...originalData];

        // LOGIC: Shift images to next page ONLY for Mobile Landscape (Splitting grid)
        if (isMobile && isLandscape) {
            let newData = [];
            originalData.forEach((memory) => {
                if (memory.media && memory.media.length > 2) {
                    const chunks = [];
                    for (let i = 0; i < memory.media.length; i += 2) {
                        chunks.push(memory.media.slice(i, i + 2));
                    }
                    chunks.forEach((chunk, i) => {
                        newData.push({
                            ...memory,
                            media: chunk,
                            text_content: i === 0 ? memory.text_content : ''
                        });
                    });
                } else {
                    newData.push(memory);
                }
            });
            processedData = newData;
        }

        setTimeout(() => createThemeParticles(settings.template_type || 'default'), 100);
        setupBookUI(processedData, settings);
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
            document.documentElement.style.setProperty('--primary-color', settings.color_schema);
            document.documentElement.style.setProperty('--accent-color', settings.color_schema);
            document.documentElement.style.setProperty('--warm-accent', settings.color_schema);
            
            document.body.style.setProperty('--primary-color', settings.color_schema);
            document.body.style.setProperty('--accent-color', settings.color_schema);
            document.body.style.setProperty('--warm-accent', settings.color_schema);
        }
        document.body.className = 'template-' + (settings.template_type || 'default');

        const recipientName = settings.recipient_name || 'Someone Special';
        const coverTitle = settings.cover_title || 'A Memory Book For';
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

        // If last sheet's back is empty, we turn it into the end cover
        if (lastSheet && !lastSheet.querySelector('.page-content.back:not(.empty)')) {
            const backSide = lastSheet.querySelector('.page-content.back');
            backSide.innerHTML = `
                <h1>${endTitle}</h1>
                <p>Thank you for being part of this story.</p>
                <button onclick="window.location.href='book.html${bookUuid ? '?id=' + bookUuid : ''}'" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
            `;
            backSide.classList.remove('empty');
            backSide.classList.add('cover-back');
        } else {
            // Otherwise add a dedicated end sheet
            const endSheet = document.createElement('div');
            endSheet.className = 'page';
            endSheet.style.zIndex = 0;
            endSheet.innerHTML = `
                <div class="page-content front empty"></div>
                <div class="page-content back cover-back">
                    <h1>${endTitle}</h1>
                    <p>Thank you for being part of this story.</p>
                    <button onclick="window.location.href='book.html${bookUuid ? '?id=' + bookUuid : ''}'" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
                </div>
            `;
            book.appendChild(endSheet);
        }

        pages = document.querySelectorAll('.page');
        totalPages = pages.length;

        // Click interaction
        pages.forEach((page, index) => {
            page.addEventListener('click', () => {
                const isLandscape = window.innerWidth > window.innerHeight;
                const isMobile = window.innerWidth <= 932;

                if (isMobile && !isLandscape) {
                    handleMobileVerticalClick('next');
                    return;
                }

                if (index === currentPage) {
                    flipPage(currentPage, 'next');
                } else if (index === currentPage - 1) {
                    flipPage(currentPage - 1, 'prev');
                }
            });
        });

        animateContent(pages[0], true);
        if (isMobile) pages.forEach(p => animateContent(p, true));
        updatePageInfo();

        // 4. Auto-Fullscreen on first interaction (Mobile Landscape Only)
        const fsTrigger = () => {
            if (isMobile && isLandscape && !document.fullscreenElement) {
                const de = document.documentElement;
                if (de.requestFullscreen) de.requestFullscreen().catch(() => { });
                else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen().catch(() => { });
            }
            window.removeEventListener('click', fsTrigger);
        };
        window.addEventListener('click', fsTrigger);

        // Fade out preloader
        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('fade-out');
        }, 800);
    }

    function handleMobileVerticalClick(direction) {
        if (direction === 'next') {
            if (currentMobileView === 'front') {
                if (currentPage < totalPages) {
                    flipPage(currentPage, 'next');
                    currentMobileView = 'back';
                }
            } else {
                currentMobileView = 'front';
                updatePageInfo();
            }
        } else {
            if (currentMobileView === 'back') {
                if (currentPage > 0) {
                    flipPage(currentPage - 1, 'prev');
                    currentMobileView = 'front';
                }
            } else {
                if (currentPage > 0) {
                    currentMobileView = 'back';
                    updatePageInfo();
                }
            }
        }
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
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobileBoundary = window.innerWidth <= 932;

        if (isMobileBoundary && !isLandscape) {
            pageNumbers.textContent = `Part ${currentPage * 2 + (currentMobileView === 'back' ? 1 : 0)}`;
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
            const de = document.documentElement;
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                if (de.requestFullscreen) de.requestFullscreen();
                else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen();
                else if (de.mozRequestFullScreen) de.mozRequestFullScreen();
                else if (de.msRequestFullscreen) de.msRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                else if (document.msExitFullscreen) document.msExitFullscreen();
            }
        });
    }

    const updateFsText = () => {
        const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (fsBtn) fsBtn.textContent = isFS ? '✖ Exit' : '⛶ Fullscreen';
    };

    document.addEventListener('fullscreenchange', updateFsText);
    document.addEventListener('webkitfullscreenchange', updateFsText);
    document.addEventListener('mozfullscreenchange', updateFsText);
    document.addEventListener('MSFullscreenChange', updateFsText);

    // Nav buttons
    let hasAttemptedFullscreen = false;
    nextBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;

        if (isMobile && isLandscape && !hasAttemptedFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            hasAttemptedFullscreen = true;
        }

        if (isMobile && !isLandscape) handleMobileVerticalClick('next');
        else if (currentPage < totalPages) flipPage(currentPage, 'next');
    });

    prevBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;
        if (isMobile && !isLandscape) handleMobileVerticalClick('prev');
        else if (currentPage > 0) flipPage(currentPage - 1, 'prev');
    });

    // Resize handler
    let lastOrientation = window.innerWidth > window.innerHeight;
    window.addEventListener('resize', () => {
        const currentOrientation = window.innerWidth > window.innerHeight;
        if (currentOrientation !== lastOrientation) {
            lastOrientation = currentOrientation;
            loadBookData(); // Re-fetch or re-init based on orientation
        }
    });

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

        if (templateType === 'birthday') {
            count = 60;
            classes = ['particle', 'confetti'];
        } else if (templateType === 'wedding') {
            count = 40;
            classes = ['petal', 'cherry', 'white'];
        } else if (templateType === 'anniversary') {
            count = 35;
            classes = ['petal', 'heart'];
        } else {
            // Default
            classes = ['petal', 'rose'];
            count = 20;
        }

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.classList.add(...classes);

            if (templateType === 'birthday') {
            const colors = ['#ff3d68', '#ffc107', '#00c2ff', '#7b61ff'];
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                particle.style.width = `${Math.random() * 10 + 10}px`;
                particle.style.height = `${Math.random() * 5 + 5}px`;
                particle.style.animationDuration = `${Math.random() * 3 + 3}s`;
            } else {
                if (classes.includes('white')) {
                    particle.style.filter = 'grayscale(100%) brightness(200%)';
                }
                particle.style.transform = `scale(${Math.random() * 0.5 + 0.8})`;
                particle.style.animationDuration = `${Math.random() * 5 + 5}s, ${Math.random() * 3 + 2}s`;
            }

            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 5}s`;
            particle.style.opacity = Math.random() * 0.5 + 0.5;
            container.appendChild(particle);
        }
    }
    loadBookData();
});
