/**
 * @Author: rogue-dev-studio
 * @Date: 2026-09-26 13:41:00
 * @Last Modified by: rogue-dev-studio
 * @Last Modified time: 2026-09-26 13:41:00
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'site-lang';

    const PACKS = {
        id: {
            langHeading: 'Bahasa',
            browseHeading: 'Jelajah',
            storeHeading: 'Toko',
            studioHeading: 'Studio',
            supportHeading: 'Dukung',
            navProjects: 'Karya',
            navToolkit: 'Toolkit',
            navAssets: 'Assets',
            navLab: 'Lab',
            navCv: 'CV',
            navGallery: 'Galeri 3D',
            navHome: 'Beranda',
            navContact: 'Kontak',
            navConnect: 'Connect',
            navMenu: 'Menu',
            navClose: 'Tutup',
            navMenuAria: 'Buka menu',
            heroTagline: 'Website, aplikasi web, dan sistem untuk bisnis — plus aset 3D & stock siap pakai.',
            heroAvailable: 'Tersedia untuk proyek baru',
            heroCtaWork: 'Lihat Karya',
            heroCtaTalk: 'Diskusi Proyek',
            aboutTitle: 'Tentang Saya',
            aboutP1: 'Saya <strong>Aris Hadisopiyan</strong> dari Rogue Developer. Saya membantu bisnis punya kehadiran digital yang jelas: website, aplikasi web, dan sistem informasi — dengan desain sederhana dan hasil yang rapi.',
            aboutP2: 'Saya juga membuat aset 3D dan visual yang bisa dibeli di Sketchfab, TurboSquid, Shutterstock, dan platform serupa.',
            skillWeb: 'Website & Landing',
            skillApp: 'Aplikasi Web',
            skillInfo: 'Sistem Informasi',
            skillDesign: 'Desain Minimal',
            skill3d: 'Aset 3D',
            skillStock: 'Stock Visual',
            servicesTitle: 'Layanan',
            svcWebTitle: 'Website & Landing Bisnis',
            svcWebDesc: 'Situs profil, halaman produk, dan halaman yang mendorong pengunjung untuk menghubungi atau membeli.',
            svcAppTitle: 'Aplikasi Web',
            svcAppDesc: 'Alat berbasis web untuk operasional harian atau produk digital di tahap awal.',
            svcSysTitle: 'Sistem Informasi Bisnis',
            svcSysDesc: 'Sistem seperti antrian, klinik, rental, atau manajemen proyek — disesuaikan cara kerja Anda.',
            svcAssetTitle: 'Aset 3D & Stock',
            svcAssetDesc: 'Model 3D dan visual siap unduh jika Anda butuh aset jadi, bukan proyek kustom dari nol.',
            linkLab: 'Buka Lab →',
            linkGallery: 'Buka galeri 3D →',
            linkTurbo: 'Buka TurboSquid →',
            linkShutter: 'Buka Shutterstock →',
            priceSignal: 'Proyek dimulai dari <strong>Rp5.000.000</strong>, menyesuaikan kompleksitas. Diskusi awal gratis.',
            projectsTitle: 'Karya',
            projectsLead: 'Sistem digital untuk bisnis — dengan spek kebutuhan, tantangan, dan hasil yang jelas.',
            toolkitTitle: 'Toolkit',
            toolkitLead: 'Peralatan terbuka untuk coding assistant — edisi penuh dan edisi Programmer.',
            linkAssetStore: 'Buka Rogue Asset Store →',
            linkMoreGithub: 'Proyek lainnya di GitHub →',
            connectTitle: 'Mari Berkolaborasi',
            connectLead: 'Siap mulai proyek baru? Ceritakan kebutuhan Anda lewat halaman kontak.',
            connectCta: 'Buka halaman kontak',
            connectSponsor: '<a href="https://github.com/sponsors/rogue-dev-studio" target="_blank" rel="noopener noreferrer">Sponsor di GitHub</a> · <a href="https://www.patreon.com/c/roguedevstudio" target="_blank" rel="noopener noreferrer">Patreon</a> — dukung eksperimen open source &amp; aset digital.',
            marketTitle: 'Toko Aset',
            marketDesc: 'Aset 3D, game, dan stock siap unduh:',
            marketGallery: 'Galeri 3D',
            footerBrand: 'Website, SaaS, dan sistem untuk bisnis — plus aset 3D & stock siap pakai.',
            sponsorsAria: 'Tautan sponsor',
            loadingWork: 'Memuat karya…',
            loadingToolkit: 'Memuat toolkit…',
            labelFor: 'Untuk:',
            labelChallenge: 'Tantangan:',
            labelSolution: 'Solusi:',
            labelResult: 'Hasil:',
            labelNeeds: 'Kebutuhan:',
            labelStack: 'Stack:',
            openLink: 'Buka →',
            openGithub: 'Buka di GitHub →',
            fallbackProject: 'Proyek portfolio.',
            fallbackAgents: 'Katalog AI agents Rogue Developer.',
            categoryDigital: 'Sistem Digital',
            q0: 'Januari–Maret',
            q1: 'April–Juni',
            q2: 'Juli–September',
            q3: 'Oktober–Desember',
            contactEyebrow: 'Rogue Developer · Kontak',
            contactTitle: 'Mari Berkolaborasi',
            contactLead: 'Ceritakan kebutuhan proyek Anda. Saya akan membalas ke email yang Anda cantumkan.',
            labelName: 'Nama',
            labelEmail: 'Email Anda',
            labelNeed: 'Kebutuhan',
            labelBudget: 'Budget',
            labelTimeline: 'Timeline',
            needPlaceholder: 'Contoh: landing bisnis, SaaS ringan, sistem informasi...',
            budgetPlaceholder: 'Pilih kisaran',
            budgetA: 'Rp5–10 jt',
            budgetB: 'Rp10–25 jt',
            budgetC: 'Rp25 jt+',
            budgetD: 'Belum pasti / diskusi dulu',
            timelinePlaceholder: 'Pilih target',
            timelineA: '1–4 minggu',
            timelineB: '1–2 bulan',
            timelineC: 'Fleksibel',
            captchaCheck: 'Saya bukan robot',
            captchaRetry: 'Ulangi',
            contactSubmit: 'Kirim Pesan',
            msgInvalid: 'Lengkapi semua field yang wajib diisi.',
            msgCaptcha: 'Masukkan bola ke keranjang dulu sebelum mengirim.',
            msgBlocked: 'Tidak dapat mengirim. Muat ulang halaman dan coba lagi.',
            msgReady: 'Siap dikirim — aplikasi email Anda akan terbuka.',
            msgNoWebgl: 'Gagal memuat library 3D. Cek koneksi internet, lalu muat ulang halaman.',
            msgMiss: 'Meleset — bola baru siap sebentar.'
        },
        en: {
            langHeading: 'Language',
            browseHeading: 'Browse',
            storeHeading: 'Store',
            studioHeading: 'Studio',
            supportHeading: 'Support',
            navProjects: 'Work',
            navToolkit: 'Toolkit',
            navAssets: 'Assets',
            navLab: 'Lab',
            navCv: 'CV',
            navGallery: '3D Gallery',
            navHome: 'Home',
            navContact: 'Contact',
            navConnect: 'Connect',
            navMenu: 'Menu',
            navClose: 'Close',
            navMenuAria: 'Open menu',
            heroTagline: 'Websites, web apps, and business systems — plus ready-to-use 3D assets & stock.',
            heroAvailable: 'Available for new projects',
            heroCtaWork: 'View Work',
            heroCtaTalk: 'Discuss a Project',
            aboutTitle: 'About',
            aboutP1: 'I am <strong>Aris Hadisopiyan</strong> of Rogue Developer. I help businesses get a clear digital presence: websites, web apps, and information systems — with simple design and tidy delivery.',
            aboutP2: 'I also create 3D assets and visuals available on Sketchfab, TurboSquid, Shutterstock, and similar platforms.',
            skillWeb: 'Website & Landing',
            skillApp: 'Web Apps',
            skillInfo: 'Information Systems',
            skillDesign: 'Minimal Design',
            skill3d: '3D Assets',
            skillStock: 'Visual Stock',
            servicesTitle: 'Services',
            svcWebTitle: 'Business Website & Landing',
            svcWebDesc: 'Profile sites, product pages, and pages that drive visitors to contact or buy.',
            svcAppTitle: 'Web Applications',
            svcAppDesc: 'Browser-based tools for daily operations or early-stage digital products.',
            svcSysTitle: 'Business Information Systems',
            svcSysDesc: 'Systems such as queues, clinics, rentals, or project management — fitted to how you work.',
            svcAssetTitle: '3D Assets & Stock',
            svcAssetDesc: 'Ready-to-download 3D models and visuals when you need finished assets, not a custom build from scratch.',
            linkLab: 'Open Lab →',
            linkGallery: 'Open 3D gallery →',
            linkTurbo: 'Open TurboSquid →',
            linkShutter: 'Open Shutterstock →',
            priceSignal: 'Projects start from <strong>Rp5,000,000</strong>, depending on complexity. Intro chat is free.',
            projectsTitle: 'Work',
            projectsLead: 'Digital systems for business — with clear needs, challenges, and outcomes.',
            toolkitTitle: 'Toolkit',
            toolkitLead: 'Open tooling for coding assistants — full edition and Programmer edition.',
            linkAssetStore: 'Open Rogue Asset Store →',
            linkMoreGithub: 'More projects on GitHub →',
            connectTitle: 'Let\'s Collaborate',
            connectLead: 'Ready to start a new project? Tell us what you need on the contact page.',
            connectCta: 'Open contact page',
            connectSponsor: '<a href="https://github.com/sponsors/rogue-dev-studio" target="_blank" rel="noopener noreferrer">Sponsor on GitHub</a> · <a href="https://www.patreon.com/c/roguedevstudio" target="_blank" rel="noopener noreferrer">Patreon</a> — support open-source experiments &amp; digital assets.',
            marketTitle: 'Asset Store',
            marketDesc: '3D assets, games, and stock ready to download:',
            marketGallery: '3D Gallery',
            footerBrand: 'Websites, SaaS, and business systems — plus ready-to-use 3D assets & stock.',
            sponsorsAria: 'Sponsor links',
            loadingWork: 'Loading work…',
            loadingToolkit: 'Loading toolkit…',
            labelFor: 'For:',
            labelChallenge: 'Challenge:',
            labelSolution: 'Solution:',
            labelResult: 'Outcome:',
            labelNeeds: 'Needs:',
            labelStack: 'Stack:',
            openLink: 'Open →',
            openGithub: 'Open on GitHub →',
            fallbackProject: 'Portfolio project.',
            fallbackAgents: 'Rogue Developer AI agents catalog.',
            categoryDigital: 'Digital System',
            q0: 'January–March',
            q1: 'April–June',
            q2: 'July–September',
            q3: 'October–December',
            contactEyebrow: 'Rogue Developer · Contact',
            contactTitle: 'Let\'s Collaborate',
            contactLead: 'Tell us what you need. I will reply to the email you provide.',
            labelName: 'Name',
            labelEmail: 'Your email',
            labelNeed: 'What you need',
            labelBudget: 'Budget',
            labelTimeline: 'Timeline',
            needPlaceholder: 'e.g. business landing, light SaaS, information system...',
            budgetPlaceholder: 'Choose a range',
            budgetA: 'Rp5–10M',
            budgetB: 'Rp10–25M',
            budgetC: 'Rp25M+',
            budgetD: 'Not sure / discuss first',
            timelinePlaceholder: 'Choose a target',
            timelineA: '1–4 weeks',
            timelineB: '1–2 months',
            timelineC: 'Flexible',
            captchaCheck: 'I am not a robot',
            captchaRetry: 'Retry',
            contactSubmit: 'Send Message',
            msgInvalid: 'Please fill in all required fields.',
            msgCaptcha: 'Score a basket first before sending.',
            msgBlocked: 'Unable to send. Reload the page and try again.',
            msgReady: 'Ready to send — your email app will open.',
            msgNoWebgl: 'Failed to load the 3D library. Check your connection, then reload.',
            msgMiss: 'Miss — a new ball is ready shortly.'
        }
    };

    function normalize(lang) {
        return lang === 'en' ? 'en' : 'id';
    }

    function getLang() {
        try {
            return normalize(localStorage.getItem(STORAGE_KEY) || 'id');
        } catch (e) {
            return 'id';
        }
    }

    function setLang(lang) {
        const next = normalize(lang);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (e) { /* ignore */ }
        return next;
    }

    function t(key, lang) {
        const pack = PACKS[normalize(lang || getLang())] || PACKS.id;
        return pack[key] != null ? pack[key] : (PACKS.id[key] || key);
    }

    function availabilityLabel(lang) {
        const L = normalize(lang || getLang());
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3);
        return `${t('q' + quarter, L)} ${year}`;
    }

    function apply(lang, opts) {
        const silent = opts && opts.silent;
        const L = normalize(lang || getLang());
        const pack = PACKS[L] || PACKS.id;
        document.documentElement.lang = L;

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (key && pack[key] != null) el.textContent = pack[key];
        });

        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const key = el.getAttribute('data-i18n-html');
            if (key && pack[key] != null) el.innerHTML = pack[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key && pack[key] != null) el.setAttribute('placeholder', pack[key]);
        });

        document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
            const key = el.getAttribute('data-i18n-aria');
            if (key && pack[key] != null) el.setAttribute('aria-label', pack[key]);
        });

        document.querySelectorAll('.availability-label').forEach((el) => {
            el.textContent = availabilityLabel(L);
        });

        document.querySelectorAll('[data-site-lang]').forEach((sel) => {
            if (sel.value !== L) sel.value = L;
        });

        document.querySelectorAll('.nav-toggle').forEach((toggle) => {
            const open = toggle.getAttribute('aria-expanded') === 'true';
            toggle.textContent = open ? pack.navClose : pack.navMenu;
            toggle.setAttribute('aria-label', pack.navMenuAria);
        });

        if (!silent) {
            global.dispatchEvent(new CustomEvent('site-lang-change', { detail: { lang: L } }));
        }
    }

    function bind() {
        const initial = getLang();
        apply(initial, { silent: true });
        document.querySelectorAll('[data-site-lang]').forEach((sel) => {
            if (sel.dataset.i18nBound) return;
            sel.dataset.i18nBound = '1';
            sel.addEventListener('change', () => {
                const next = setLang(sel.value);
                apply(next);
            });
        });
    }

    global.RogueSiteI18n = {
        PACKS,
        getLang,
        setLang,
        t,
        apply,
        bind,
        availabilityLabel
    };
})(typeof window !== 'undefined' ? window : globalThis);
