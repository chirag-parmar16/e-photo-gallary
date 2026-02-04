document.addEventListener('DOMContentLoaded', () => {
    const book = document.getElementById('book');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNumbers = document.getElementById('pageNumbers');

    let pages = [];
    let currentPage = 0;
    let totalPages = 0;
    let originalData = [];
    let settingsData = {};

    // Fetch pages and settings from API
    async function loadPages() {
        try {
            const [pagesRes, settingsRes] = await Promise.all([
                fetch('/api/pages'),
                fetch('/api/settings')
            ]);

            originalData = await pagesRes.json();
            settingsData = await settingsRes.json();

            initBook();
        } catch (err) {
            console.error('Failed to load book data:', err);
        }
    }

    function initBook() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;

        let processedData = [...originalData];

        // LOGIC: Shift images to next page ONLY for Mobile Landscape
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

        setupBook(processedData, settingsData);
    }

    function createPageContent(pageData, side) {
        if (!pageData) return `<div class="page-content ${side} empty"></div>`;

        const isTextOnly = !pageData.media || pageData.media.length === 0;
        const mediaItems = pageData.media.map(m => `
            <div class="media-item">
                ${m.type === 'video'
                ? `<video src="${m.media_path}" loop muted></video>`
                : `<img src="${m.media_path}" alt="Memory">`
            }
            </div>
        `).join('');

        return `
            <div class="page-content ${side} ${isTextOnly ? 'poem-page' : ''}">
                ${!isTextOnly ? `
                <div class="media-grid count-${pageData.media.length}">
                    ${mediaItems}
                </div>` : ''}
                <div class="minimal-text">${pageData.text_content || ''}</div>
            </div>
        `;
    }

    let currentView = 'front';

    function setupBook(data, settings) {
        book.innerHTML = '';
        currentPage = 0; // Reset on re-init
        const coverTitle = settings.cover_title || 'Our Timeless Journey';
        const endTitle = settings.end_title || 'THE END';

        // 1. Cover Sheet
        const coverSheet = document.createElement('div');
        coverSheet.className = 'page';
        coverSheet.style.zIndex = data.length + 10;
        coverSheet.innerHTML = `
            <div class="page-content front cover-front">
                <h1>${coverTitle}</h1>
                <p>A collection of memories, frozen in time.</p>
                <div class="instruction">Tap to open</div>
            </div>
            ${createPageContent(data[0], 'back')}
        `;
        book.appendChild(coverSheet);

        // 2. Middle Sheets
        for (let i = 1; i < data.length; i += 2) {
            const sheet = document.createElement('div');
            sheet.className = 'page';
            sheet.style.zIndex = data.length - i;
            sheet.innerHTML = `
                ${createPageContent(data[i], 'front')}
                ${createPageContent(data[i + 1], 'back')}
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
                <p>To be continued...</p>
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
                    <p>To be continued...</p>
                </div>
            `;
            book.appendChild(endSheet);
        }

        pages = document.querySelectorAll('.page');
        totalPages = pages.length;

        pages.forEach((page, index) => {
            page.addEventListener('click', (e) => {
                const isLandscape = window.innerWidth > window.innerHeight;
                const isMobile = window.innerWidth <= 932;

                if (isMobile && !isLandscape) {
                    handleMobileClick('next');
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
        if (window.innerWidth <= 932) pages.forEach(p => animateContent(p, true));
        updatePageInfo();
    }

    function handleMobileClick(direction) {
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) return;

        if (direction === 'next') {
            if (currentView === 'front') {
                if (currentPage < totalPages) {
                    flipPage(currentPage, 'next');
                    currentView = 'back';
                }
            } else {
                currentView = 'front';
                updatePageInfo();
            }
        } else {
            if (currentView === 'back') {
                if (currentPage > 0) {
                    flipPage(currentPage - 1, 'prev');
                    currentView = 'front';
                }
            } else {
                if (currentPage > 0) {
                    currentView = 'back';
                    updatePageInfo();
                }
            }
        }
    }

    function flipPage(index, direction) {
        if (direction === 'next' && currentPage < totalPages) {
            const page = pages[currentPage];
            page.classList.add('flipped');
            setTimeout(() => {
                page.style.zIndex = currentPage;
            }, 600);
            currentPage++;

            if (currentPage < totalPages) {
                animateContent(pages[currentPage], true);
            }
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

        gsap.to(mediaItems, {
            opacity: 1, scale: 1, duration: 1.2, ease: "power2.out", stagger: 0.2, delay: 0.2
        });
        gsap.to(texts, {
            opacity: 1, y: 0, duration: 1, ease: "power2.out", delay: 0.4
        });
        mediaItems.forEach(m => {
            if (m.tagName === 'VIDEO' && isVisible) m.play();
            else if (m.tagName === 'VIDEO') m.pause();
        });
    }

    function updatePageInfo() {
        const isMobile = window.innerWidth <= 932;
        const isLandscape = window.innerWidth > window.innerHeight;

        if (isMobile && !isLandscape) return;

        if (currentPage === 0) {
            pageNumbers.textContent = 'Cover';
            book.style.transform = 'translateX(-25%)';
        } else if (currentPage === totalPages) {
            pageNumbers.textContent = 'The End';
            book.style.transform = 'translateX(25%)';
        } else {
            pageNumbers.textContent = `Page ${currentPage} of ${totalPages - 1}`;
            book.style.transform = 'translateX(0)';
        }
    }

    const fullscreenBtn = document.getElementById('fullscreenBtn');

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            fullscreenBtn.textContent = '✖ Exit Fullscreen';
        } else {
            document.exitFullscreen();
            fullscreenBtn.textContent = '⛶ Fullscreen';
        }
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Attempt fullscreen on first book click (for mobile immersion)
    let hasAttemptedFullscreen = false;

    nextBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;

        if (isMobile && isLandscape && !hasAttemptedFullscreen && !document.fullscreenElement) {
            toggleFullscreen();
            hasAttemptedFullscreen = true;
        }

        if (isMobile && !isLandscape) {
            handleMobileClick('next');
        } else if (currentPage < totalPages) {
            flipPage(currentPage, 'next');
        }
    });

    prevBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;

        if (isMobile && !isLandscape) {
            handleMobileClick('prev');
        } else if (currentPage > 0) {
            flipPage(currentPage - 1, 'prev');
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            fullscreenBtn.textContent = '⛶ Fullscreen';
        } else {
            fullscreenBtn.textContent = '✖ Exit Fullscreen';
        }
    });

    // Handle orientation/resize
    let lastOrientation = window.innerWidth > window.innerHeight;
    window.addEventListener('resize', () => {
        const currentOrientation = window.innerWidth > window.innerHeight;
        if (currentOrientation !== lastOrientation) {
            lastOrientation = currentOrientation;
            initBook();
        }
    });

    // Petal Animation Logic
    function createPetals() {
        const petalContainer = document.createElement('div');
        petalContainer.id = 'petal-container';
        petalContainer.style.position = 'fixed';
        petalContainer.style.top = '0';
        petalContainer.style.left = '0';
        petalContainer.style.width = '100%';
        petalContainer.style.height = '100%';
        petalContainer.style.pointerEvents = 'none';
        petalContainer.style.zIndex = '0';
        document.body.prepend(petalContainer);

        const petalCount = 30; // Number of petals

        for (let i = 0; i < petalCount; i++) {
            const petal = document.createElement('div');
            petal.classList.add('petal');

            // Randomly assign Rose or Cherry Blossom
            if (Math.random() > 0.5) {
                petal.classList.add('rose');
            } else {
                petal.classList.add('cherry');
            }

            // Randomize properties
            const left = Math.random() * 100;
            const animDuration = Math.random() * 5 + 5; // 5s to 10s
            const delay = Math.random() * 5;
            const opacity = Math.random() * 0.5 + 0.3;

            petal.style.left = `${left}%`;
            // Size is defined in CSS but we can scale it slightly for variation
            const scale = Math.random() * 0.5 + 0.8;
            petal.style.transform = `scale(${scale})`;

            petal.style.animationDuration = `${animDuration}s, ${Math.random() * 3 + 2}s`; // fall, sway
            petal.style.animationDelay = `${delay}s`;
            petal.style.opacity = opacity;

            petalContainer.appendChild(petal);
        }
    }

    // Initial load
    createPetals();
    loadPages();
});
