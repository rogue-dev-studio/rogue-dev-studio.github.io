(function () {
    const PER_PAGE = 9;
    const OWNER = 'rogue-dev-studio';
    const TOPIC = 'experiment-arishadisopiyan';
    const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

    let page = 1;
    let items = [];

    const gallery = document.getElementById('gallery');
    const status = document.getElementById('gallery-status');
    const pagination = document.getElementById('pagination');
    const pageNum = document.getElementById('page-num');
    const totalPagesEl = document.getElementById('total-pages');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const year = document.getElementById('year');

    if (year) year.textContent = String(new Date().getFullYear());

    function escapeHTML(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function liveUrl(repo, homepage) {
        if (homepage && /^https?:\/\//i.test(homepage)) return homepage;
        return `https://${OWNER}.github.io/${encodeURIComponent(repo)}/`;
    }

    function repoUrl(repo) {
        return `https://github.com/${OWNER}/${encodeURIComponent(repo)}`;
    }

    async function fetchTopicRepos() {
        const q = encodeURIComponent(`user:${OWNER} topic:${TOPIC}`);
        const response = await fetch(`https://api.github.com/search/repositories?q=${q}&per_page=100&sort=updated`);
        if (!response.ok) throw new Error(`GitHub search ${response.status}`);
        const data = await response.json();
        return Array.isArray(data.items) ? data.items : [];
    }

    async function fetchContentImages(repo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(repo)}/contents/github-contents`);
            if (!response.ok) return [];
            const entries = await response.json();
            if (!Array.isArray(entries)) return [];
            return entries
                .filter((entry) => entry.type === 'file' && IMAGE_EXT.test(entry.name || '') && entry.download_url)
                .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
                .map((entry) => entry.download_url);
        } catch (_) {
            return [];
        }
    }

    function mountMedia(el, images, title) {
        if (!images.length) {
            el.innerHTML = `<span>${escapeHTML(title)}</span>`;
            return;
        }

        let index = 0;
        el.innerHTML = `
            <div class="thumb-track">
                ${images.map((src, i) => `
                    <img src="${escapeHTML(src)}" alt="" class="thumb-slide${i === 0 ? ' is-active' : ''}" loading="${i === 0 ? 'eager' : 'lazy'}">
                `).join('')}
            </div>
            ${images.length > 1 ? `
                <button type="button" class="thumb-nav thumb-prev" aria-label="Sebelumnya">‹</button>
                <button type="button" class="thumb-nav thumb-next" aria-label="Berikutnya">›</button>
            ` : ''}
        `;

        if (images.length < 2) return;

        const slides = [...el.querySelectorAll('.thumb-slide')];
        const show = (nextIndex) => {
            index = (nextIndex + slides.length) % slides.length;
            slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
        };

        el.querySelector('.thumb-prev').addEventListener('click', (e) => { e.preventDefault(); show(index - 1); });
        el.querySelector('.thumb-next').addEventListener('click', (e) => { e.preventDefault(); show(index + 1); });
        let timer = window.setInterval(() => show(index + 1), 4200);
        el.addEventListener('mouseenter', () => window.clearInterval(timer));
        el.addEventListener('mouseleave', () => { timer = window.setInterval(() => show(index + 1), 4200); });
    }

    function render() {
        if (!items.length) {
            status.textContent = 'Belum ada eksperimen di Lab.';
            gallery.innerHTML = '';
            pagination.hidden = true;
            return;
        }

        const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * PER_PAGE;
        const slice = items.slice(start, start + PER_PAGE);

        status.textContent = `${items.length} eksperimen`;
        gallery.innerHTML = slice.map((item) => `
            <article class="card" data-repo="${escapeHTML(item.repo)}">
                <div class="card-media" data-media></div>
                <div class="card-body">
                    <div class="card-category">${escapeHTML(item.category)}</div>
                    <h2 class="card-title">${escapeHTML(item.title)}</h2>
                    <p class="card-desc">${escapeHTML(item.desc)}</p>
                    <div class="card-actions">
                        <a class="btn btn-primary" href="${escapeHTML(item.live)}" target="_blank" rel="noopener noreferrer">Coba langsung</a>
                        <a class="btn btn-ghost" href="${escapeHTML(item.htmlUrl)}" target="_blank" rel="noopener noreferrer">Repo</a>
                    </div>
                </div>
            </article>
        `).join('');

        slice.forEach(async (item, i) => {
            const card = gallery.children[i];
            if (!card) return;
            const media = card.querySelector('[data-media]');
            const images = item.images?.length
                ? item.images
                : await fetchContentImages(item.repo);
            mountMedia(media, images, item.title);
        });

        pagination.hidden = totalPages <= 1;
        pageNum.textContent = String(page);
        totalPagesEl.textContent = String(totalPages);
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= totalPages;
    }

    prevBtn.addEventListener('click', () => { if (page > 1) { page -= 1; render(); } });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
        if (page < totalPages) { page += 1; render(); }
    });

    (async function init() {
        status.textContent = 'Memuat lab…';
        try {
            let repos = [];
            try {
                const catalogRes = await fetch('../data/catalog.json', { cache: 'no-store' });
                if (catalogRes.ok) {
                    const catalog = await catalogRes.json();
                    if (Array.isArray(catalog.lab) && catalog.lab.length) {
                        repos = catalog.lab;
                    }
                }
            } catch (_) {
                /* fallback API */
            }

            if (!repos.length) {
                repos = await fetchTopicRepos();
            }

            items = repos.map((repo) => ({
                repo: repo.name,
                title: (repo.name || '').replace(/[-_]/g, ' '),
                category: 'Lab',
                desc: repo.description || 'Demo kecil / eksperimen UI.',
                live: liveUrl(repo.name, repo.homepage),
                htmlUrl: repo.html_url || repoUrl(repo.name),
                images: Array.isArray(repo.images) ? repo.images : []
            }));
            render();
        } catch (error) {
            console.error(error);
            status.textContent = 'Gagal memuat daftar eksperimen.';
        }
    })();
})();
