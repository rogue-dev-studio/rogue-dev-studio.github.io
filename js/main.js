let gitHubProjectsData = [];
let currentProjectsPage = 1;
const projectsPerPage = 9;

const OWNER = 'rogue-dev-studio';
const TOPIC_LAB = 'experiment-arishadisopiyan';
const TOPIC_PORTFOLIO = 'portfolio-arishadisopiyan';
const ARCHIVE_EXCLUDE = new Set([
    'rogue-dev-studio.github.io',
    'ArisHadisopiyan'
]);

/** Shared topic cache so Karya + Proyek Lainnya don't double-hit search API */
const topicCache = new Map();
const contentImageCache = new Map();
/** Static catalog from Actions (preferred — no browser API key) */
let staticCatalog = null;

/** Enrichment for Karya cards keyed by repo name */
const FEATURED_META = {
    'laravel-project-management-system-aris': {
        title: 'Project Management System',
        category: 'Sistem Bisnis',
        problem: 'Tim kesulitan melihat gambaran kerja proyek sebelum membangun sistem sendiri.',
        approach: 'Menyediakan demo sistem manajemen proyek yang bisa langsung dicoba.',
        result: 'Alur tugas, progress, dan kolaborasi tim terlihat jelas di browser.',
        url: 'https://demo-pms.netlify.app/'
        // images: only from repo github-contents/ (via catalog sync)
    },
    'sistem-antrian': {
        title: 'Sistem Antrian',
        category: 'Sistem Operasional',
        problem: 'Bisnis layanan butuh alur antrian yang rapi dan bisa dipantau secara realtime.',
        approach: 'Membangun aplikasi antrian berbasis web untuk operasional harian.',
        result: 'Proses panggil antrian lebih teratur dan mudah diikuti staf maupun pelanggan.',
        url: 'https://github.com/rogue-dev-studio/sistem-antrian'
    },
    'sistem-informasi-klinik': {
        title: 'Sistem Informasi Klinik',
        category: 'Sistem Informasi',
        problem: 'Klinik membutuhkan pencatatan pasien, poliklinik, dan pendaftaran dalam satu alur.',
        approach: 'Merancang aplikasi klinik yang menghubungkan data pasien dan layanan.',
        result: 'Administrasi klinik lebih tertata dari pendaftaran hingga pelayanan.',
        url: 'https://github.com/rogue-dev-studio/sistem-informasi-klinik'
    },
    'rental-mobil-new': {
        title: 'Rental Mobil',
        category: 'Sistem Bisnis',
        problem: 'Bisnis rental perlu mengelola armada, sewa, dan data pelanggan tanpa catatan terpisah-pisah.',
        approach: 'Membangun sistem rental mobil berbasis web untuk operasional usaha.',
        result: 'Proses sewa dan inventaris kendaraan lebih mudah dikelola.',
        url: 'https://github.com/rogue-dev-studio/rental-mobil-new'
    }
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const SOCIAL_FALLBACK = [
    { label: 'GitHub', url: 'https://github.com/rogue-dev-studio', icon: 'github' },
    { label: 'GitLab', url: 'https://gitlab.com/aris.hadisopiyan', icon: 'gitlab' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/arishadisopiyan/', icon: 'linkedin' },
    { label: 'Instagram', url: 'https://www.instagram.com/aya.erisu/', icon: 'instagram' }
];

window.svgFallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="100%" height="100%" fill="%23F5F5F0"/><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23000000" stroke-width="1" opacity="0.06"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/><rect x="250" y="200" width="300" height="200" fill="none" stroke="%23000000" stroke-width="2"/><text x="400" y="295" font-family="'Space Grotesk', sans-serif" font-size="24" font-weight="bold" fill="%23000000" text-anchor="middle" letter-spacing="2">ROGUE.DEV</text><text x="400" y="335" font-family="'Inter', sans-serif" font-size="14" fill="%23666666" text-anchor="middle" letter-spacing="1">NO IMAGE</text></svg>`;

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function prettyTitle(name) {
    return String(name || '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function liveOrRepoUrl(repo) {
    if (repo.homepage && /^https?:\/\//i.test(repo.homepage)) return repo.homepage;
    return repo.html_url;
}

async function loadStaticCatalog() {
    if (staticCatalog) return staticCatalog;
    try {
        const response = await fetch('data/catalog.json', { cache: 'no-cache' });
        if (!response.ok) return null;
        staticCatalog = await response.json();
        // Warm image cache from catalog so cards never need live GitHub API
        for (const section of ['karya', 'lab', 'archive']) {
            for (const item of staticCatalog[section] || []) {
                if (item?.name && Array.isArray(item.images) && item.images.length) {
                    contentImageCache.set(item.name, item.images);
                }
            }
        }
        return staticCatalog;
    } catch (error) {
        console.warn('Static catalog unavailable:', error);
        return null;
    }
}

async function fetchReposByTopic(topic) {
    if (topicCache.has(topic)) return topicCache.get(topic);

    const q = encodeURIComponent(`user:${OWNER} topic:${topic}`);
    const response = await fetch(`https://api.github.com/search/repositories?q=${q}&per_page=100&sort=updated`);
    if (!response.ok) {
        console.warn(`Topic search ${topic} failed:`, response.status);
        topicCache.set(topic, []);
        return [];
    }
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    topicCache.set(topic, items);
    return items;
}

async function fetchAllUserRepos() {
    const all = [];
    for (let page = 1; page <= 5; page += 1) {
        const response = await fetch(`https://api.github.com/users/${OWNER}/repos?sort=updated&per_page=100&page=${page}`);
        if (!response.ok) {
            console.warn('Repos fetch failed:', response.status);
            break;
        }
        const batch = await response.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 100) break;
    }
    return all;
}

function observeElements() {
    document.querySelectorAll('.project-card, .service-card, .about-image, .about-text').forEach((el) => {
        if (el.style.opacity !== '1') {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        }
    });
}

async function loadPartials() {
    const containers = document.querySelectorAll('[data-include]');

    await Promise.all([...containers].map(async (el) => {
        const url = el.getAttribute('data-include');
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Gagal memuat partial: ${url}`);
        }

        el.outerHTML = await response.text();
    }));

    initApp();
}

function renderIcons() {
    const iconElements = document.querySelectorAll('i.icon');
    iconElements.forEach((el) => {
        let iconName = '';
        el.classList.forEach((cls) => {
            if (cls.startsWith('icon-') && cls !== 'icon') {
                iconName = cls.substring(5);
            }
        });

        if (iconName) {
            let biIconName = iconName;
            if (iconName === 'twitter') {
                biIconName = 'x';
            } else if (iconName === 'link') {
                biIconName = 'link-45deg';
            }

            el.classList.add('bi', `bi-${biIconName}`);
            el.setAttribute('aria-hidden', 'true');
        }
    });
}

function renderAvailability() {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3);
    const ranges = [
        'Januari–Maret',
        'April–Juni',
        'Juli–September',
        'Oktober–Desember'
    ];
    const label = `${ranges[quarter]} ${year}`;

    document.querySelectorAll('.availability-label').forEach((el) => {
        el.textContent = label;
    });

    document.querySelectorAll('.dynamic-year').forEach((el) => {
        el.textContent = String(year);
    });
}

async function fetchRepoContentImages(repo) {
    if (!repo) return [];
    if (contentImageCache.has(repo)) return contentImageCache.get(repo);

    try {
        const response = await fetch(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(repo)}/contents/github-contents`);
        if (!response.ok) {
            contentImageCache.set(repo, []);
            return [];
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) {
            contentImageCache.set(repo, []);
            return [];
        }

        const urls = entries
            .filter((entry) => entry.type === 'file' && IMAGE_EXT.test(entry.name || '') && entry.download_url)
            .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
            .map((entry) => entry.download_url);
        contentImageCache.set(repo, urls);
        return urls;
    } catch (error) {
        console.error(`Gagal memuat github-contents/${repo}:`, error);
        contentImageCache.set(repo, []);
        return [];
    }
}

function ensureLightbox() {
    let root = document.getElementById('image-lightbox');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'image-lightbox';
    root.className = 'image-lightbox';
    root.hidden = true;
    root.innerHTML = `
        <div class="lightbox-backdrop" data-lightbox-close></div>
        <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Pratinjau gambar penuh">
            <button type="button" class="lightbox-close" data-lightbox-close aria-label="Tutup">×</button>
            <button type="button" class="lightbox-nav lightbox-prev" aria-label="Gambar sebelumnya">‹</button>
            <img class="lightbox-image" alt="">
            <button type="button" class="lightbox-nav lightbox-next" aria-label="Gambar berikutnya">›</button>
            <p class="lightbox-caption"></p>
            <div class="lightbox-strip" aria-label="Semua gambar"></div>
        </div>
    `;
    document.body.appendChild(root);

    root._state = { urls: [], index: 0, title: '' };

    const render = () => {
        const { urls, index, title } = root._state;
        const img = root.querySelector('.lightbox-image');
        const caption = root.querySelector('.lightbox-caption');
        const prev = root.querySelector('.lightbox-prev');
        const next = root.querySelector('.lightbox-next');
        const strip = root.querySelector('.lightbox-strip');
        if (!urls.length) return;
        img.src = urls[index];
        img.alt = `${title} — gambar ${index + 1}`;
        caption.textContent = urls.length > 1
            ? `${title} · ${index + 1} / ${urls.length}`
            : title;
        const multi = urls.length > 1;
        prev.hidden = !multi;
        next.hidden = !multi;

        strip.innerHTML = urls.map((src, i) => `
            <button type="button" class="lightbox-strip-item${i === index ? ' is-active' : ''}" data-strip-index="${i}" aria-label="Gambar ${i + 1}">
                <img src="${escapeHTML(src)}" alt="">
            </button>
        `).join('');
        strip.querySelectorAll('.lightbox-strip-item').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                root._state.index = Number(btn.dataset.stripIndex || 0);
                render();
            });
        });
    };

    root.open = (urls, index, title) => {
        root._state = { urls: [...urls], index, title: title || '' };
        root.hidden = false;
        document.body.classList.add('lightbox-open');
        render();
    };

    root.close = () => {
        root.hidden = true;
        document.body.classList.remove('lightbox-open');
        root.querySelector('.lightbox-image').removeAttribute('src');
    };

    root.querySelectorAll('[data-lightbox-close]').forEach((el) => {
        el.addEventListener('click', () => root.close());
    });
    root.querySelector('.lightbox-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        const s = root._state;
        s.index = (s.index - 1 + s.urls.length) % s.urls.length;
        render();
    });
    root.querySelector('.lightbox-next').addEventListener('click', (e) => {
        e.stopPropagation();
        const s = root._state;
        s.index = (s.index + 1) % s.urls.length;
        render();
    });
    document.addEventListener('keydown', (e) => {
        if (root.hidden) return;
        if (e.key === 'Escape') root.close();
        if (e.key === 'ArrowLeft') root.querySelector('.lightbox-prev').click();
        if (e.key === 'ArrowRight') root.querySelector('.lightbox-next').click();
    });

    return root;
}

function openLightbox(urls, index, title) {
    ensureLightbox().open(urls, index, title);
}

function mountThumbnailGallery(container, images, title) {
    const urls = images.length ? images : [];
    if (!urls.length) {
        container.innerHTML = `<img src="${window.svgFallback}" alt="${escapeHTML(title)}" class="is-fallback">`;
        return;
    }

    let index = 0;
    container.classList.add('thumb-gallery', 'has-peek');
    container.innerHTML = `
        <div class="thumb-track" role="group" aria-label="Pratinjau ${escapeHTML(title)}">
            ${urls.map((src, i) => `
                <img src="${escapeHTML(src)}" alt="${escapeHTML(title)} — gambar ${i + 1}" class="thumb-slide${i === 0 ? ' is-active' : ''}" loading="${i === 0 ? 'eager' : 'lazy'}" onerror="this.classList.add('is-broken')">
            `).join('')}
        </div>
        <div class="thumb-peek" hidden>
            <p class="thumb-peek-title">${escapeHTML(title)} · ${urls.length} gambar</p>
            <div class="thumb-peek-grid">
                ${urls.map((src, i) => `
                    <button type="button" class="thumb-peek-item${i === 0 ? ' is-active' : ''}" data-peek-index="${i}" aria-label="Gambar ${i + 1}">
                        <img src="${escapeHTML(src)}" alt="" loading="lazy">
                    </button>
                `).join('')}
            </div>
            <button type="button" class="thumb-peek-open" data-open-full>Lihat penuh</button>
        </div>
        <button type="button" class="thumb-zoom" aria-label="Lihat gambar penuh">Perbesar</button>
        ${urls.length > 1 ? `
            <button type="button" class="thumb-nav thumb-prev" aria-label="Gambar sebelumnya">‹</button>
            <button type="button" class="thumb-nav thumb-next" aria-label="Gambar berikutnya">›</button>
            <div class="thumb-dots" aria-hidden="true">
                ${urls.map((_, i) => `<span class="thumb-dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}
            </div>
        ` : ''}
    `;

    const slides = [...container.querySelectorAll('.thumb-slide')];
    const dots = [...container.querySelectorAll('.thumb-dot')];
    const peekItems = [...container.querySelectorAll('.thumb-peek-item')];
    const peek = container.querySelector('.thumb-peek');
    const prev = container.querySelector('.thumb-prev');
    const next = container.querySelector('.thumb-next');
    const zoom = container.querySelector('.thumb-zoom');
    const openBtn = container.querySelector('[data-open-full]');

    const show = (nextIndex) => {
        index = (nextIndex + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        peekItems.forEach((item, i) => item.classList.toggle('is-active', i === index));
    };

    const openFull = (at = index) => openLightbox(urls, at, title);

    let timer = null;
    const stopTimer = () => {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
    };
    const startTimer = () => {
        stopTimer();
        if (urls.length < 2) return;
        timer = window.setInterval(() => show(index + 1), 4200);
    };

    let hidePeekTimer = null;
    const showPeek = () => {
        window.clearTimeout(hidePeekTimer);
        peek.hidden = false;
        container.classList.add('is-peeking');
        stopTimer();
    };
    const hidePeek = () => {
        hidePeekTimer = window.setTimeout(() => {
            peek.hidden = true;
            container.classList.remove('is-peeking');
            startTimer();
        }, 180);
    };

    container.addEventListener('mouseenter', showPeek);
    container.addEventListener('mouseleave', hidePeek);
    peek.addEventListener('mouseenter', showPeek);
    peek.addEventListener('mouseleave', hidePeek);

    peekItems.forEach((item) => {
        item.addEventListener('mouseenter', () => {
            const i = Number(item.dataset.peekIndex || 0);
            show(i);
        });
        item.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const i = Number(item.dataset.peekIndex || 0);
            show(i);
            openFull(i);
        });
    });

    slides.forEach((slide, i) => {
        slide.style.cursor = 'zoom-in';
        slide.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            show(i);
            openFull(i);
        });
    });

    [zoom, openBtn].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openFull(index);
        });
    });

    if (urls.length > 1) {
        prev.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            show(index - 1);
        });
        next.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            show(index + 1);
        });
        startTimer();
    }
}

async function hydrateCardGallery(card, repoName, title, fallbackImages = []) {
    const media = card.querySelector('.project-image');
    if (!media) return;

    const cached = contentImageCache.get(repoName);
    const initial = (cached && cached.length ? cached : fallbackImages).filter(Boolean);
    media.classList.add('thumb-gallery');
    if (initial.length) {
        mountThumbnailGallery(media, initial, title);
    } else {
        media.innerHTML = `<img src="${window.svgFallback}" alt="${escapeHTML(title)}" class="is-fallback">`;
    }

    // Only hit live GitHub API if catalog/cache had no images
    if (cached && cached.length) return;

    const contentImages = await fetchRepoContentImages(repoName);
    if (contentImages.length) {
        mountThumbnailGallery(media, contentImages, title);
    }
}

async function renderFeaturedProjects() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="section-lead">Memuat karya…</p>';

    const catalog = await loadStaticCatalog();
    let portfolioRepos = [];

    if (catalog?.karya?.length) {
        portfolioRepos = catalog.karya.map((item) => ({
            name: item.name,
            description: item.description,
            homepage: item.homepage,
            html_url: item.html_url,
            language: item.language,
            default_branch: item.default_branch,
            images: item.images || []
        }));
    } else {
        try {
            portfolioRepos = await fetchReposByTopic(TOPIC_PORTFOLIO);
        } catch (error) {
            console.error('Gagal memuat topic portfolio:', error);
        }
    }

    const byName = new Map(portfolioRepos.map((r) => [r.name, r]));
    const orderedNames = [
        ...Object.keys(FEATURED_META),
        ...portfolioRepos.map((r) => r.name).filter((n) => !FEATURED_META[n])
    ];

    const names = [...new Set(orderedNames)];

    grid.innerHTML = '';

    await Promise.all(names.map(async (repoName) => {
        const remote = byName.get(repoName);
        const meta = FEATURED_META[repoName] || {};
        const title = meta.title || prettyTitle(repoName);
        const category = meta.category || remote?.language || 'Karya';
        const url = meta.url || (remote ? liveOrRepoUrl(remote) : `https://github.com/${OWNER}/${repoName}`);
        const desc = remote?.description || '';
        if (Array.isArray(remote?.images) && remote.images.length) {
            contentImageCache.set(repoName, remote.images);
        }

        const card = document.createElement('article');
        card.className = 'project-card featured-card';

        const caseBlock = meta.problem
            ? `<ul class="case-meta">
                    <li><strong>Tantangan:</strong> ${escapeHTML(meta.problem)}</li>
                    <li><strong>Solusi:</strong> ${escapeHTML(meta.approach)}</li>
                    <li><strong>Hasil:</strong> ${escapeHTML(meta.result)}</li>
               </ul>`
            : `<p class="project-desc">${escapeHTML(desc || 'Proyek portfolio.')}</p>`;

        card.innerHTML = `
            <div class="project-image thumb-gallery" data-repo="${escapeHTML(repoName)}"></div>
            <div class="project-info">
                <div class="project-category">${escapeHTML(category)}</div>
                <h3 class="project-title">${escapeHTML(title)}</h3>
                ${caseBlock}
                <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="project-link">Buka →</a>
            </div>
        `;
        grid.appendChild(card);
        await hydrateCardGallery(card, repoName, title);
    }));

    observeElements();
}

async function fetchGitHubProfile() {
    try {
        const response = await fetch(`https://api.github.com/users/${OWNER}`);
        if (response.ok) {
            const data = await response.json();
            const avatarImg = document.querySelector('.about-image img');
            if (avatarImg && data.avatar_url) {
                avatarImg.src = escapeHTML(data.avatar_url);
                avatarImg.alt = escapeHTML(data.name || 'Aris Hadisopiyan');
            }
        }
    } catch (error) {
        console.error('Gagal mengambil data profil GitHub:', error);
    }
}

async function fetchGitHubProjects() {
    const grid = document.querySelector('.archive-grid');
    if (grid) {
        grid.innerHTML = '<p class="section-lead" id="archive-status">Memuat proyek lainnya…</p>';
    }

    try {
        const catalog = await loadStaticCatalog();
        if (catalog?.archive?.length) {
            gitHubProjectsData = catalog.archive.map((item) => ({
                name: item.name,
                description: item.description,
                homepage: item.homepage,
                html_url: item.html_url,
                language: item.language,
                default_branch: item.default_branch,
                images: item.images || [],
                fork: false
            }));
            setupPagination();
            renderProjectsPage(1);
            return;
        }

        const [repos, labRepos, portfolioRepos] = await Promise.all([
            fetchAllUserRepos(),
            fetchReposByTopic(TOPIC_LAB),
            fetchReposByTopic(TOPIC_PORTFOLIO)
        ]);

        const exclude = new Set([
            ...ARCHIVE_EXCLUDE,
            ...Object.keys(FEATURED_META),
            ...labRepos.map((r) => r.name),
            ...portfolioRepos.map((r) => r.name)
        ]);

        gitHubProjectsData = repos.filter((repo) => {
            if (!repo || repo.fork) return false;
            if (exclude.has(repo.name)) return false;
            return true;
        });

        setupPagination();
        renderProjectsPage(1);
    } catch (error) {
        console.error('Gagal mengambil repositori GitHub:', error);
        if (grid) {
            grid.innerHTML = '<p class="section-lead">Gagal memuat proyek lainnya. Muat ulang halaman sebentar lagi.</p>';
        }
    }
}

function setupPagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn && nextBtn) {
        prevBtn.replaceWith(prevBtn.cloneNode(true));
        nextBtn.replaceWith(nextBtn.cloneNode(true));

        const newPrevBtn = document.getElementById('prev-page');
        const newNextBtn = document.getElementById('next-page');

        newPrevBtn.addEventListener('click', () => {
            if (currentProjectsPage > 1) {
                currentProjectsPage--;
                renderProjectsPage(currentProjectsPage);
                document.getElementById('archive').scrollIntoView({ behavior: 'smooth' });
            }
        });

        newNextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(gitHubProjectsData.length / projectsPerPage);
            if (currentProjectsPage < totalPages) {
                currentProjectsPage++;
                renderProjectsPage(currentProjectsPage);
                document.getElementById('archive').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

function renderProjectsPage(page) {
    const grid = document.querySelector('.archive-grid');
    if (!grid) return;

    grid.innerHTML = '';
    currentProjectsPage = page;

    if (!gitHubProjectsData.length) {
        grid.innerHTML = '<p class="section-lead">Belum ada proyek lain di luar Karya dan Lab.</p>';
        const pageNumEl = document.getElementById('page-num');
        const totalPagesEl = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        if (pageNumEl) pageNumEl.textContent = '1';
        if (totalPagesEl) totalPagesEl.textContent = '1';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }

    const totalPages = Math.ceil(gitHubProjectsData.length / projectsPerPage) || 1;
    const startIdx = (page - 1) * projectsPerPage;
    const endIdx = startIdx + projectsPerPage;
    const pageProjects = gitHubProjectsData.slice(startIdx, endIdx);

    const status = document.createElement('p');
    status.className = 'section-lead';
    status.style.gridColumn = '1 / -1';
    status.textContent = `${gitHubProjectsData.length} proyek`;
    grid.appendChild(status);

    pageProjects.forEach((repo) => {
        const title = prettyTitle(repo.name);
        const category = repo.language || 'Open Source';
        const desc = repo.description || 'Proyek yang dipublikasikan secara terbuka.';
        const url = liveOrRepoUrl(repo);

        const card = document.createElement('article');
        card.className = 'project-card';

        card.innerHTML = `
            <div class="project-image thumb-gallery" data-repo="${escapeHTML(repo.name)}"></div>
            <div class="project-info">
                <div class="project-category">${escapeHTML(category)}</div>
                <h3 class="project-title">${escapeHTML(title)}</h3>
                <p class="project-desc">${escapeHTML(desc)}</p>
                <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="project-link">${repo.homepage ? 'Buka →' : 'Lihat proyek →'}</a>
            </div>
        `;
        grid.appendChild(card);

        if (Array.isArray(repo.images) && repo.images.length) {
            contentImageCache.set(repo.name, repo.images);
        }
        hydrateCardGallery(card, repo.name, title);
    });

    const pageNumEl = document.getElementById('page-num');
    const totalPagesEl = document.getElementById('total-pages');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (pageNumEl) pageNumEl.textContent = page;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = page === 1;
    if (nextBtn) nextBtn.disabled = page === totalPages || totalPages <= 1;

    observeElements();
}

function renderSocialFallback() {
    const container = document.querySelector('.social-links');
    if (!container || container.children.length > 0) return;

    SOCIAL_FALLBACK.forEach((account) => {
        const link = document.createElement('a');
        link.href = account.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', account.label);
        link.innerHTML = `<i class="icon icon-${escapeHTML(account.icon)}"></i>`;
        container.appendChild(link);
    });

    renderIcons();
}

async function fetchGitHubSocials() {
    try {
        const response = await fetch(`https://api.github.com/users/${OWNER}/social_accounts`);
        if (!response.ok) {
            renderSocialFallback();
            return;
        }

        const socials = await response.json();
        const container = document.querySelector('.social-links');
        if (!container) return;

        container.innerHTML = '';

        const githubLink = document.createElement('a');
        githubLink.href = `https://github.com/${OWNER}`;
        githubLink.target = '_blank';
        githubLink.rel = 'noopener noreferrer';
        githubLink.setAttribute('aria-label', 'GitHub');
        githubLink.innerHTML = '<i class="icon icon-github"></i>';
        container.appendChild(githubLink);

        const ensured = [...socials];
        const urls = ensured.map((s) => (s.url || '').toLowerCase());
        if (!urls.some((u) => u.includes('gitlab.com'))) {
            ensured.push({ provider: 'generic', url: 'https://gitlab.com/aris.hadisopiyan' });
        }
        if (!urls.some((u) => u.includes('shutterstock.com'))) {
            ensured.push({ provider: 'generic', url: 'https://www.shutterstock.com/g/ArisHadisopiyan' });
        }

        ensured.forEach((account) => {
            const provider = escapeHTML((account.provider || 'generic').toLowerCase());
            const rawUrl = account.url;
            const url = escapeHTML(rawUrl);
            let iconName = provider;
            let label = provider.charAt(0).toUpperCase() + provider.slice(1);

            if (provider === 'generic') {
                if (rawUrl.includes('gitlab.com')) {
                    iconName = 'gitlab';
                    label = 'GitLab';
                } else if (rawUrl.includes('shutterstock.com')) {
                    iconName = 'camera';
                    label = 'Shutterstock';
                } else if (rawUrl.includes('linkedin.com')) {
                    iconName = 'linkedin';
                    label = 'LinkedIn';
                } else if (rawUrl.includes('instagram.com')) {
                    iconName = 'instagram';
                    label = 'Instagram';
                } else if (rawUrl.includes('twitter.com') || rawUrl.includes('x.com')) {
                    iconName = 'twitter';
                    label = 'Twitter';
                } else {
                    iconName = 'link';
                    label = 'Website';
                }
            }

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', escapeHTML(label));
            link.innerHTML = `<i class="icon icon-${escapeHTML(iconName)}"></i>`;
            container.appendChild(link);
        });

        renderIcons();
    } catch (error) {
        console.error('Gagal mengambil akun sosial GitHub:', error);
        renderSocialFallback();
    }
}

function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const need = document.getElementById('contact-need').value.trim();
        const budget = document.getElementById('contact-budget').value;
        const timeline = document.getElementById('contact-timeline').value;

        if (!name || !email || !need || !budget || !timeline) {
            return;
        }

        const subject = encodeURIComponent(`Pesan untuk Rogue Development — ${name}`);
        const body = encodeURIComponent(
            `Nama: ${name}\nEmail: ${email}\nBudget: ${budget}\nTimeline: ${timeline}\n\nKebutuhan:\n${need}`
        );

        window.location.href = `mailto:aris.hadisopiyan@gmail.com?subject=${subject}&body=${body}`;
    });
}

async function initApp() {
    renderIcons();
    renderAvailability();
    setupContactForm();

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href !== '#' && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Load sections independently so one failure does not wipe the others
    await Promise.allSettled([
        renderFeaturedProjects(),
        fetchGitHubProfile(),
        fetchGitHubProjects(),
        fetchGitHubSocials()
    ]);

    observeElements();
}

document.addEventListener('DOMContentLoaded', () => {
    loadPartials().catch((error) => {
        console.error(error);
    });
});
