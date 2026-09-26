const OWNER = 'rogue-dev-studio';
const TOPIC_KARYA = 'business-system-arishadisopiyan';

/** Shared topic cache so Karya fallback doesn't re-hit search API */
const topicCache = new Map();
/** Static catalog from Actions (preferred — no browser API key) */
let staticCatalog = null;

/** Proyek siap pakai yang ditampilkan di section 03 Karya (bukan semua topic portfolio) */
const KARYA_PROJECTS = [
    'sijama',
    'laravel-pms',
    'sistem-antrian',
    'sistem-informasi-klinik',
    'rental-mobil-new'
];

/** Section 04 — Toolkit (AI Agents Rogue editions + Asset Store) */
const AGENTS_PROJECTS = [
    'rogue-asset-store',
    'ai-agents-rogue-programmer',
    'ai-agents-rogue'
];

const AGENTS_META = {
    'rogue-asset-store': {
        title: 'Rogue Asset Store',
        category: 'Store',
        audience: 'Pengguna Cursor, Claude Code, dan host AI lain',
        stack: 'Skills · MCP Servers · GitHub Pages',
        requirements: [
            'Katalog publik skill & MCP server Rogue',
            'Listing dari topic rogue-asset-skills / rogue-asset-mcp',
            'Install lewat CLI host (skills add / MCP config)'
        ],
        problem: 'Skill dan MCP tersebar di banyak repo tanpa satu tempat discovery.',
        approach: 'Asset Store statis di GitHub Pages yang menarik listing dari topic org.',
        result: 'Satu katalog installable untuk skill dan MCP Rogue Developer.',
        url: 'https://rogue-dev-studio.github.io/rogue-asset-store/',
        linkLabel: 'Buka store →',
        en: {
            audience: 'Users of Cursor, Claude Code, and other AI hosts',
            requirements: [
                'Public catalog of Rogue skills & MCP servers',
                'Listings from rogue-asset-skills / rogue-asset-mcp topics',
                'Install via host CLI (skills add / MCP config)'
            ],
            problem: 'Skills and MCP servers are scattered across repos without one discovery place.',
            approach: 'A static Asset Store on GitHub Pages that pulls org topic listings.',
            result: 'One installable catalog for Rogue Developer skills and MCP servers.',
            linkLabel: 'Open store →'
        }
    },
    'ai-agents-rogue-programmer': {
        title: 'AI Agents Rogue Programmer',
        category: 'AI Agents',
        audience: 'Developer & coding assistant workflow',
        stack: 'Skills · Roles · Rules · Commands',
        requirements: [
            'Edisi fokus engineering (API, DB, FE, BE)',
            'Bebas dipakai — tanpa wajib fork atau star',
            'Install ke Cursor, Claude Code, dan host sejenis'
        ],
        problem: 'Tim butuh paket agent coding yang ringkas tanpa katalog penuh semua domain.',
        approach: 'Memisahkan edisi Programmer dari katalog utama agar onboarding coding lebih cepat.',
        result: 'Satu paket agent siap pakai khusus alur pengembangan software.',
        url: 'https://github.com/rogue-dev-studio/ai-agents-rogue-programmer',
        en: {
            audience: 'Developers & coding-assistant workflows',
            requirements: [
                'Engineering-focused edition (API, DB, FE, BE)',
                'Free to use — no required fork or star',
                'Install on Cursor, Claude Code, and similar hosts'
            ],
            problem: 'Teams need a lean coding-agent pack without the full multi-domain catalog.',
            approach: 'Split the Programmer edition from the main catalog for faster coding onboarding.',
            result: 'A ready-to-use agent pack focused on software development workflows.'
        }
    },
    'ai-agents-rogue': {
        title: 'AI Agents Rogue',
        category: 'AI Agents',
        audience: 'Tim produk & engineering',
        stack: 'Multi-agent · E2E delivery · 68+ skills',
        requirements: [
            'Katalog agents, skills, rules, dan command workflows',
            'Mode e2e atau manual lewat WORKMODE',
            'Portable lintas Cursor, Claude Code, Antigravity, OpenCode'
        ],
        problem: 'AI coding assistant sering jalan tanpa role, rule, dan alur delivery yang konsisten.',
        approach: 'Menstandarkan multi-agent software house (orchestrator, BA, engineer, QA) sebagai katalog terbuka.',
        result: 'Satu sistem agents yang bisa di-install dan dipakai lintas host.',
        url: 'https://github.com/rogue-dev-studio/ai-agents-rogue',
        en: {
            audience: 'Product & engineering teams',
            requirements: [
                'Catalog of agents, skills, rules, and command workflows',
                'E2E or manual mode via WORKMODE',
                'Portable across Cursor, Claude Code, Antigravity, OpenCode'
            ],
            problem: 'AI coding assistants often run without consistent roles, rules, and delivery flow.',
            approach: 'Standardize a multi-agent software house (orchestrator, BA, engineer, QA) as an open catalog.',
            result: 'One agent system you can install and use across hosts.'
        }
    }
};

/** Enrichment for Karya cards keyed by repo name (topic: business-system-arishadisopiyan) */
const FEATURED_META = {
    'sijama': {
        title: 'SIJAMA',
        category: 'Sistem Informasi',
        audience: 'Pengurus organisasi',
        stack: 'Laravel 11 · React · PostgreSQL · Docker',
        requirements: [
            'Menu: Informasi, Laporan, Transaksi, Master, Aplikasi (RBAC)',
            'Absensi pengajian dengan face recognition kamera lokal',
            'Master jamaah, keluarga, lokasi & wilayah berjenjang',
            'Jadwal rutin, kalender kegiatan, dan laporan kehadiran',
            'Responsive PC + mobile (bottom navigation)'
        ],
        problem: 'Pendataan anggota, jadwal, dan absensi masih terpisah dan sulit diaudit.',
        approach: 'Membangun SIJAMA dengan unggulan face recognition kamera lokal (tanpa cloud) untuk absensi pengajian, plus master wilayah, anggota, dan kegiatan.',
        result: 'Operasional organisasi punya satu aplikasi web dengan Docker Compose.',
        url: 'https://sijama-web.onrender.com',
        en: {
            category: 'Information System',
            audience: 'Organization admins',
            requirements: [
                'Menus: Information, Reports, Transactions, Master, Apps (RBAC)',
                'Study attendance with local-camera face recognition',
                'Master members, families, locations & hierarchical regions',
                'Routine schedules, event calendar, and attendance reports',
                'Responsive PC + mobile (bottom navigation)'
            ],
            problem: 'Member data, schedules, and attendance were fragmented and hard to audit.',
            approach: 'Build SIJAMA with local-camera face recognition (no cloud) for study attendance, plus region, member, and event masters.',
            result: 'Organization ops run in one web app with Docker Compose.'
        }
    },
    'laravel-pms': {
        title: 'Project Management System',
        category: 'Sistem Bisnis',
        audience: 'Project manager & tim',
        stack: 'Laravel 11 · demo Netlify',
        requirements: [
            'Kelola tugas & status progress',
            'Kolaborasi anggota tim',
            'Dashboard progres proyek',
            'Demo publik tanpa instalasi lokal'
        ],
        problem: 'Tim kesulitan melihat gambaran kerja proyek sebelum membangun sistem sendiri.',
        approach: 'Menyediakan demo UI manajemen proyek yang bisa langsung dicoba. Bukan PMS produksi.',
        result: 'Alur tugas dan progress terlihat di browser.',
        url: 'https://demo-pms.netlify.app/',
        en: {
            category: 'Business System',
            audience: 'Project managers & teams',
            requirements: [
                'Manage tasks & progress status',
                'Team member collaboration',
                'Project progress dashboard',
                'Public demo without local install'
            ],
            problem: 'Teams struggle to see project work before building their own system.',
            approach: 'Provide a project-management UI demo you can try immediately. Not a production PMS.',
            result: 'Task flow and progress are visible in the browser.'
        }
    },
    'sistem-antrian': {
        title: 'Sistem Antrian',
        category: 'Sistem Operasional',
        audience: 'Loket layanan & pelanggan',
        stack: 'Laravel 11 · MySQL',
        requirements: [
            'Ambil nomor antrian',
            'Panggil & update status',
            'Dashboard & sisa antrian',
            'Tampilan siap monitor loket'
        ],
        problem: 'Bisnis layanan butuh alur antrian yang rapi dan bisa dipantau secara realtime.',
        approach: 'Membangun aplikasi antrian berbasis web untuk operasional harian.',
        result: 'Proses panggil antrian lebih teratur dan mudah diikuti staf maupun pelanggan.',
        url: 'https://github.com/rogue-dev-studio/sistem-antrian',
        en: {
            category: 'Operations System',
            audience: 'Service counters & customers',
            title: 'Queue System',
            requirements: [
                'Take a queue number',
                'Call & update status',
                'Dashboard & remaining queue',
                'Display ready for counter monitors'
            ],
            problem: 'Service businesses need a tidy queue flow that can be monitored in realtime.',
            approach: 'Build a web-based queue app for daily operations.',
            result: 'Calling the queue is more orderly for staff and customers.'
        }
    },
    'sistem-informasi-klinik': {
        title: 'Sistem Informasi Klinik',
        category: 'Sistem Informasi',
        audience: 'Admin & staf klinik',
        stack: 'Laravel 11 · MySQL · Vite',
        requirements: [
            'Login terautentikasi',
            'CRUD pasien & pencarian',
            'CRUD poliklinik',
            'Pendaftaran layanan',
            'Laporan pasien & pendaftaran'
        ],
        problem: 'Klinik membutuhkan pencatatan pasien, poliklinik, dan pendaftaran dalam satu alur.',
        approach: 'Merancang aplikasi klinik yang menghubungkan data pasien dan layanan.',
        result: 'Administrasi klinik lebih tertata dari pendaftaran hingga pelayanan.',
        url: 'https://github.com/rogue-dev-studio/sistem-informasi-klinik',
        en: {
            category: 'Information System',
            audience: 'Clinic admins & staff',
            title: 'Clinic Information System',
            requirements: [
                'Authenticated login',
                'Patient CRUD & search',
                'Clinic/polyclinic CRUD',
                'Service registration',
                'Patient & registration reports'
            ],
            problem: 'Clinics need patient, clinic unit, and registration records in one flow.',
            approach: 'Design a clinic app that connects patient data and services.',
            result: 'Clinic admin is clearer from registration through care.'
        }
    },
    'rental-mobil-new': {
        title: 'Rental Mobil',
        category: 'Sistem Bisnis',
        audience: 'Pemilik & staf rental',
        stack: 'Laravel · MySQL',
        requirements: [
            'Manajemen armada',
            'Data pelanggan',
            'Transaksi sewa',
            'Status ketersediaan kendaraan'
        ],
        problem: 'Bisnis rental perlu mengelola armada, sewa, dan data pelanggan tanpa catatan terpisah-pisah.',
        approach: 'Membangun sistem rental mobil berbasis web untuk operasional usaha.',
        result: 'Proses sewa dan inventaris kendaraan lebih mudah dikelola.',
        url: 'https://github.com/rogue-dev-studio/rental-mobil-new',
        en: {
            category: 'Business System',
            audience: 'Rental owners & staff',
            title: 'Car Rental',
            requirements: [
                'Fleet management',
                'Customer data',
                'Rental transactions',
                'Vehicle availability status'
            ],
            problem: 'Rental businesses need fleet, rentals, and customer data without scattered notes.',
            approach: 'Build a web-based car rental system for day-to-day ops.',
            result: 'Rentals and vehicle inventory are easier to manage.'
        }
    }
};

const CONNECT_SOCIALS = [
    { label: 'GitHub', url: 'https://github.com/rogue-dev-studio', icon: 'github' },
    { label: 'GitLab', url: 'https://gitlab.com/rogue-dev-studio', icon: 'gitlab' },
    { label: 'Patreon', url: 'https://www.patreon.com/c/roguedevstudio', icon: 'patreon' },
    { label: 'itch.io', url: 'https://rogue-dev-studio.itch.io', icon: 'itch' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/arishadisopiyan/', icon: 'linkedin' },
    { label: 'Instagram', url: 'https://www.instagram.com/aya.erisu/', icon: 'instagram' }
];

const SOCIAL_FALLBACK = CONNECT_SOCIALS;

/** Bootstrap Icons has no bi-patreon — use brand logomark (circle + stem). */
const PATREON_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><circle cx="14.48" cy="9.73" r="7.23"/><rect x="2" y="2.5" width="4.5" height="19" rx="0.5"/></svg>';

function ensureBootstrapIcons() {
    if (document.querySelector('link[data-bootstrap-icons]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    link.setAttribute('data-bootstrap-icons', '');
    document.head.appendChild(link);
}

function connectIconInner(icon) {
    if (icon === 'patreon') {
        return `<span class="site-footer-icon-svg" aria-hidden="true">${PATREON_ICON_SVG}</span>`;
    }
    const bi = icon === 'itch' ? 'controller' : icon;
    return `<i class="bi bi-${bi}" aria-hidden="true"></i>`;
}

function connectSocialMarkup(item, className) {
    return (
        `<a class="${className}" href="${escapeHTML(item.url)}" rel="noopener" target="_blank" ` +
        `aria-label="${escapeHTML(item.label)}" data-tooltip="${escapeHTML(item.label)}" title="${escapeHTML(item.label)}">` +
        connectIconInner(item.icon) +
        '</a>'
    );
}

function renderConnectIcons() {
    ensureBootstrapIcons();
    const footerHtml = CONNECT_SOCIALS.map((item) => connectSocialMarkup(item, 'site-footer-social')).join('');

    document.querySelectorAll('.site-footer-socials').forEach((el) => {
        el.innerHTML = footerHtml;
    });
}
window.svgFallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="100%" height="100%" fill="%23F5F5F0"/><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23000000" stroke-width="1" opacity="0.06"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/><rect x="250" y="200" width="300" height="200" fill="none" stroke="%23000000" stroke-width="2"/><text x="400" y="295" font-family="'Space Grotesk', sans-serif" font-size="22" font-weight="bold" fill="%23000000" text-anchor="middle" letter-spacing="1">ROGUE DEVELOPER</text></svg>`;

function defaultThumbSrc() {
    if (window.location.protocol === 'file:') return window.svgFallback;
    return `${window.location.origin}/thumbnail-default.png`;
}

function mountDefaultThumb(container, title) {
    const png = defaultThumbSrc();
    container.classList.add('thumb-gallery', 'is-default-thumb');
    container.innerHTML = `<img src="${png}" alt="${escapeHTML(title)}" class="is-fallback">`;
    const img = container.querySelector('img');
    img.addEventListener('error', () => {
        img.onerror = null;
        img.src = window.svgFallback;
    });
}

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
    const items = (Array.isArray(data.items) ? data.items : []).filter((repo) => !repo.fork);
    topicCache.set(topic, items);
    return items;
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
            if (iconName === 'patreon') {
                el.classList.add('icon-svg');
                el.innerHTML = PATREON_ICON_SVG;
                el.setAttribute('aria-hidden', 'true');
                return;
            }

            let biIconName = iconName;
            if (iconName === 'twitter') {
                biIconName = 'x';
            } else if (iconName === 'link') {
                biIconName = 'link-45deg';
            } else if (iconName === 'itch') {
                biIconName = 'controller';
            }

            el.classList.add('bi', `bi-${biIconName}`);
            el.setAttribute('aria-hidden', 'true');
        }
    });
}

function renderAvailability() {
    const year = new Date().getFullYear();
    const label = window.RogueSiteI18n
        ? window.RogueSiteI18n.availabilityLabel()
        : `Juli–September ${year}`;

    document.querySelectorAll('.availability-label').forEach((el) => {
        el.textContent = label;
    });

    document.querySelectorAll('.dynamic-year').forEach((el) => {
        el.textContent = String(year);
    });
}

function ui(key) {
    return window.RogueSiteI18n ? window.RogueSiteI18n.t(key) : key;
}

function localizeMeta(meta) {
    if (!meta) return {};
    const lang = window.RogueSiteI18n ? window.RogueSiteI18n.getLang() : 'id';
    if (lang === 'en' && meta.en) {
        return Object.assign({}, meta, meta.en);
    }
    return meta;
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
    const urls = (images || []).filter(Boolean);
    if (!urls.length) {
        mountDefaultThumb(container, title);
        return;
    }

    let index = 0;
    container.classList.add('thumb-gallery');
    container.classList.remove('is-default-thumb');
    container.innerHTML = `
        <div class="thumb-track" role="group" aria-label="Pratinjau ${escapeHTML(title)}">
            ${urls.map((src, i) => `
                <img src="${escapeHTML(src)}" alt="${escapeHTML(title)} — gambar ${i + 1}" class="thumb-slide${i === 0 ? ' is-active' : ''}" loading="${i === 0 ? 'eager' : 'lazy'}">
            `).join('')}
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
    const prev = container.querySelector('.thumb-prev');
    const next = container.querySelector('.thumb-next');
    const zoom = container.querySelector('.thumb-zoom');
    const live = slides.map(() => true);

    const show = (nextIndex) => {
        const n = slides.length;
        const ok = live.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        if (!ok.length) {
            stopTimer();
            mountDefaultThumb(container, title);
            return;
        }
        let wrapped = ((nextIndex % n) + n) % n;
        if (!live[wrapped]) {
            const dir = nextIndex >= index ? 1 : -1;
            for (let step = 1; step <= n; step += 1) {
                const i = (wrapped + dir * step + n) % n;
                if (live[i]) {
                    wrapped = i;
                    break;
                }
            }
        }
        index = wrapped;
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index && live[i]));
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    };

    const openFull = (at = index) => {
        const okUrls = urls.filter((_, i) => live[i]);
        if (!okUrls.length) return;
        const mapped = Math.max(0, urls.slice(0, at + 1).filter((_, i) => live[i]).length - 1);
        openLightbox(okUrls, mapped, title);
    };

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

    slides.forEach((slide, i) => {
        slide.addEventListener('error', () => {
            live[i] = false;
            slide.classList.add('is-broken');
            if (!live.some(Boolean)) {
                stopTimer();
                mountDefaultThumb(container, title);
                return;
            }
            if (i === index) show(index + 1);
        });
        slide.style.cursor = 'zoom-in';
        slide.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!live[i]) return;
            show(i);
            openFull(i);
        });
    });

    if (zoom) {
        zoom.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openFull(index);
        });
    }

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

async function hydrateCardGallery(card, repoName, title, catalogImages = []) {
    const media = card.querySelector('.project-image');
    if (!media) return;

    media.classList.add('thumb-gallery');
    if (catalogImages.length) {
        mountThumbnailGallery(media, catalogImages, title);
        return;
    }
    mountDefaultThumb(media, title);
}

async function renderFeaturedProjects() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    grid.innerHTML = `<p class="section-lead">${escapeHTML(ui('loadingWork'))}</p>`;

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
            portfolioRepos = await fetchReposByTopic(TOPIC_KARYA);
        } catch (error) {
            console.error('Gagal memuat topic karya:', error);
        }
    }

    const byName = new Map(portfolioRepos.map((r) => [r.name, r]));
    const names = KARYA_PROJECTS.filter((name) => FEATURED_META[name] || byName.has(name));

    grid.innerHTML = '';

    await Promise.all(names.map(async (repoName) => {
        const remote = byName.get(repoName);
        const meta = localizeMeta(FEATURED_META[repoName] || {});
        const title = meta.title || prettyTitle(repoName);
        const category = meta.category || ui('categoryDigital');
        const url = meta.url || (remote ? liveOrRepoUrl(remote) : `https://github.com/${OWNER}/${repoName}`);
        const desc = remote?.description || '';
        const card = document.createElement('article');
        card.className = 'project-card featured-card';

        const reqList = Array.isArray(meta.requirements) && meta.requirements.length
            ? `<li><strong>${escapeHTML(ui('labelNeeds'))}</strong> ${meta.requirements.map((r) => escapeHTML(r)).join(' · ')}</li>`
            : '';
        const audienceLine = meta.audience
            ? `<li><strong>${escapeHTML(ui('labelFor'))}</strong> ${escapeHTML(meta.audience)}</li>`
            : '';
        const stackLine = meta.stack
            ? `<li><strong>${escapeHTML(ui('labelStack'))}</strong> ${escapeHTML(meta.stack)}</li>`
            : '';

        const caseBlock = meta.problem
            ? `<ul class="case-meta">
                    ${audienceLine}
                    <li><strong>${escapeHTML(ui('labelChallenge'))}</strong> ${escapeHTML(meta.problem)}</li>
                    <li><strong>${escapeHTML(ui('labelSolution'))}</strong> ${escapeHTML(meta.approach)}</li>
                    <li><strong>${escapeHTML(ui('labelResult'))}</strong> ${escapeHTML(meta.result)}</li>
                    ${reqList}
                    ${stackLine}
               </ul>`
            : `<p class="project-desc">${escapeHTML(desc || ui('fallbackProject'))}</p>`;

        card.innerHTML = `
            <div class="project-image thumb-gallery" data-repo="${escapeHTML(repoName)}"></div>
            <div class="project-info">
                <div class="project-category">${escapeHTML(category)}</div>
                <h3 class="project-title">${escapeHTML(title)}</h3>
                ${caseBlock}
                <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="project-link">${escapeHTML(ui('openLink'))}</a>
            </div>
        `;
        grid.appendChild(card);
        await hydrateCardGallery(card, repoName, title, remote?.images || []);
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
                avatarImg.alt = escapeHTML(data.name || 'Rogue Developer');
            }
        }
    } catch (error) {
        console.error('Gagal mengambil data profil GitHub:', error);
    }
}

async function renderAgentsProjects() {
    const grid = document.getElementById('agents-grid');
    if (!grid) return;

    grid.innerHTML = `<p class="section-lead">${escapeHTML(ui('loadingToolkit'))}</p>`;

    const catalog = await loadStaticCatalog();
    const byName = new Map();
    for (const bucket of [catalog?.karya, catalog?.lab, catalog?.archive]) {
        (bucket || []).forEach((item) => {
            if (item?.name) byName.set(item.name, item);
        });
    }

    grid.innerHTML = '';

    AGENTS_PROJECTS.forEach((repoName) => {
        const remote = byName.get(repoName);
        const meta = localizeMeta(AGENTS_META[repoName] || {});
        const title = meta.title || prettyTitle(repoName);
        const category = meta.category || 'AI Agents';
        const url = meta.url || (remote ? liveOrRepoUrl(remote) : `https://github.com/${OWNER}/${repoName}`);
        const desc = remote?.description || '';

        const reqList = Array.isArray(meta.requirements) && meta.requirements.length
            ? `<li><strong>${escapeHTML(ui('labelNeeds'))}</strong> ${meta.requirements.map((r) => escapeHTML(r)).join(' · ')}</li>`
            : '';
        const audienceLine = meta.audience
            ? `<li><strong>${escapeHTML(ui('labelFor'))}</strong> ${escapeHTML(meta.audience)}</li>`
            : '';
        const stackLine = meta.stack
            ? `<li><strong>${escapeHTML(ui('labelStack'))}</strong> ${escapeHTML(meta.stack)}</li>`
            : '';

        const caseBlock = meta.problem
            ? `<ul class="case-meta">
                    ${audienceLine}
                    <li><strong>${escapeHTML(ui('labelChallenge'))}</strong> ${escapeHTML(meta.problem)}</li>
                    <li><strong>${escapeHTML(ui('labelSolution'))}</strong> ${escapeHTML(meta.approach)}</li>
                    <li><strong>${escapeHTML(ui('labelResult'))}</strong> ${escapeHTML(meta.result)}</li>
                    ${reqList}
                    ${stackLine}
               </ul>`
            : `<p class="project-desc">${escapeHTML(desc || ui('fallbackAgents'))}</p>`;

        const linkLabel = meta.linkLabel || ui('openGithub');
        const card = document.createElement('article');
        card.className = 'project-card featured-card';
        card.innerHTML = `
            <div class="project-image thumb-gallery" data-repo="${escapeHTML(repoName)}"></div>
            <div class="project-info">
                <div class="project-category">${escapeHTML(category)}</div>
                <h3 class="project-title">${escapeHTML(title)}</h3>
                ${caseBlock}
                <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="project-link">${escapeHTML(linkLabel)}</a>
            </div>
        `;
        grid.appendChild(card);
        hydrateCardGallery(card, repoName, title, remote?.images || []);
    });

    observeElements();
}

function renderSocialFallback() {
    renderConnectIcons();
}

async function fetchGitHubSocials() {
    renderConnectIcons();
}

function setupNav() {
    const nav = document.querySelector('nav');
    const toggle = document.querySelector('.nav-toggle');
    if (!nav || !toggle) return;

    const setOpen = (open) => {
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? ui('navMenuAria') : ui('navMenuAria'));
        toggle.textContent = open ? ui('navClose') : ui('navMenu');
    };

    toggle.addEventListener('click', () => {
        setOpen(!nav.classList.contains('is-open'));
    });

    nav.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', () => setOpen(false));
    });
}

function setupSiteLang() {
    if (!window.RogueSiteI18n) return;
    window.RogueSiteI18n.bind();
    window.addEventListener('site-lang-change', () => {
        renderAvailability();
        renderFeaturedProjects();
        renderAgentsProjects();
    });
}

async function initApp() {
    if (window.location.hash === '#contact') {
        window.location.replace('contact/');
        return;
    }

    renderIcons();
    renderAvailability();
    setupNav();
    setupSiteLang();
    renderConnectIcons();

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
        renderAgentsProjects(),
        fetchGitHubProfile(),
        fetchGitHubSocials()
    ]);

    observeElements();
}

document.addEventListener('DOMContentLoaded', () => {
    loadPartials().catch((error) => {
        console.error(error);
    });
});
