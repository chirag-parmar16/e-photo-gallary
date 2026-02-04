document.addEventListener('DOMContentLoaded', () => {
    const book = document.getElementById('book');
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let pages = [];
    let currentPage = 0;
    let totalPages = 0;
    let currentMobileView = 'front'; // 'front' or 'back'

    const urlParams = new URLSearchParams(window.location.search);
    const bookUuid = urlParams.get('id');

    async function loadBookData() {
        if (!bookUuid) {
            alert('No memory book specified.');
            return;
        }

        try {
            const res = await fetch(`/api/public/books/${bookUuid}`);
            if (!res.ok) throw new Error('Failed to fetch book');
            const data = await res.json();
            renderBook(data.pages, data.cover_title, data.end_title);
        } catch (err) {
            console.error('Error loading book:', err);
            alert('Story not found or private.');
        }
    }

    function renderBook(pageData, coverTitle, endTitle) {
        book.innerHTML = '';

        // 1. Cover
        const coverSheet = document.createElement('div');
        coverSheet.className = 'page';
        coverSheet.style.zIndex = 100;
        coverSheet.innerHTML = `
            <div class="page-content front cover-front">
                <h1>${coverTitle || 'Our Timeless Journey'}</h1>
                <p>A collection of memories, frozen in time.</p>
                <div class="instruction">Tap to open</div>
            </div>
            <div class="page-content back empty"></div>
        `;
        book.appendChild(coverSheet);

        // 2. Inner Pages (2 per sheet)
        for (let i = 0; i < pageData.length; i += 2) {
            const sheet = document.createElement('div');
            sheet.className = 'page';
            sheet.style.zIndex = pageData.length - i;

            const p1 = pageData[i];
            const p2 = pageData[i + 1];

            sheet.innerHTML = `
                <div class="page-content front ${!p1 ? 'empty' : ''}">
                    ${renderPageContent(p1)}
                </div>
                <div class="page-content back ${!p2 ? 'empty' : ''}">
                    ${renderPageContent(p2)}
                </div>
            `;
            book.appendChild(sheet);
        }

        function renderPageContent(p) {
            if (!p) return '';
            const mediaCount = p.media ? p.media.length : 0;
            const gridClass = `media-grid count-${mediaCount}`;

            let mediaHtml = '';
            if (p.media) {
                p.media.forEach(m => {
                    if (m.type === 'video') {
                        mediaHtml += `<div class="media-item"><video src="${m.media_path}" loop muted playsinline></video></div>`;
                    } else {
                        mediaHtml += `<div class="media-item"><img src="${m.media_path}"></div>`;
                    }
                });
            }

            return `
                <div class="${gridClass}">${mediaHtml}</div>
                <div class="minimal-text">${p.text_content || ''}</div>
            `;
        }

        // 3. End Cover
        const allSheets = book.querySelectorAll('.page');
        const lastSheet = allSheets[allSheets.length - 1];

        if (lastSheet && !lastSheet.querySelector('.page-content.back:not(.empty)')) {
            const backSide = lastSheet.querySelector('.page-content.back');
            backSide.innerHTML = `
                <h1>${endTitle || 'THE END'}</h1>
                <p>Thank you for being part of this story.</p>
                <button onclick="location.reload()" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
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
                    <h1>${endTitle || 'THE END'}</h1>
                    <p>Thank you for being part of this story.</p>
                    <button onclick="location.reload()" class="nav-btn secondary" style="margin-top: 20px;">Replay Story</button>
                </div>
            `;
            book.appendChild(endSheet);
        }

        pages = document.querySelectorAll('.page');
        totalPages = pages.length;

        // Interaction
        pages.forEach((page, index) => {
            page.addEventListener('click', () => {
                const isLandscape = window.innerWidth > window.innerHeight;
                const isMobile = window.innerWidth <= 932;
                if (isMobile && !isLandscape) {
                    handleMobileVerticalClick('next');
                    return;
                }
                if (index === currentPage) flipPage(currentPage, 'next');
                else if (index === currentPage - 1) flipPage(currentPage - 1, 'prev');
            });
        });

        animateContent(pages[0], true);
        const isMobile = window.innerWidth <= 932;
        if (isMobile) pages.forEach(p => animateContent(p, true));
        updatePageInfo();

        // Final Loader Reveal
        setTimeout(() => {
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('fade-out');

            // Auto-FS hint
            const landscapeFirstHint = () => {
                const isLandscape = window.innerWidth > window.innerHeight;
                const isMobile = window.innerWidth <= 932;
                if (isMobile && isLandscape && !document.fullscreenElement) {
                    const de = document.documentElement;
                    if (de.requestFullscreen) de.requestFullscreen().catch(() => { });
                    else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen().catch(() => { });
                }
                window.removeEventListener('click', landscapeFirstHint);
            };
            window.addEventListener('click', landscapeFirstHint);
        }, 1000);
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
        gsap.to(mediaItems, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out", stagger: 0.2, delay: 0.2 });
        gsap.to(texts, { opacity: 1, y: 0, duration: 1, ease: "power2.out", delay: 0.4 });
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

    // Fullscreen
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
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => document.addEventListener(evt, updateFsText));

    // Nav
    nextBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;
        if (isMobile && !isLandscape) handleMobileVerticalClick('next');
        else if (currentPage < totalPages) flipPage(currentPage, 'next');
    });

    prevBtn.addEventListener('click', () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 932;
        if (isMobile && !isLandscape) handleMobileVerticalClick('prev');
        else if (currentPage > 0) flipPage(currentPage - 1, 'prev');
    });

    window.addEventListener('resize', updatePageInfo);

    // Petals
    function createPetals() {
        let container = document.getElementById('petal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'petal-container';
            container.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;';
            document.body.prepend(container);
        }
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const petal = document.createElement('div');
            petal.classList.add('petal', Math.random() > 0.5 ? 'rose' : 'cherry');
            petal.style.left = `${Math.random() * 100}%`;
            petal.style.transform = `scale(${Math.random() * 0.5 + 0.8})`;
            petal.style.animationDuration = `${Math.random() * 5 + 5}s, ${Math.random() * 3 + 2}s`;
            petal.style.animationDelay = `${Math.random() * 5}s`;
            petal.style.opacity = Math.random() * 0.5 + 0.3;
            container.appendChild(petal);
        }
    }

    createPetals();
    loadBookData();
});
