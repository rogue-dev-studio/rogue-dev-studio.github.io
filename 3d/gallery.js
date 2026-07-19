const SKETCHFAB_USER = 'aris.hadisopiyan';
const PAGE_SIZE = 6;
const API_PAGE_SIZE = 24;
const API_BASE = 'https://api.sketchfab.com/v3/models';

const galleryEl = document.getElementById('gallery');
const statusEl = document.getElementById('gallery-status');
const actionsEl = document.getElementById('gallery-actions');
const paginationEl = document.getElementById('pagination');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageNumEl = document.getElementById('page-num');
const totalPagesEl = document.getElementById('total-pages');
const yearEl = document.getElementById('year');

let allModels = [];
let currentPage = 1;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildEmbedSrc(embedUrl) {
    try {
        const url = new URL(embedUrl);
        url.searchParams.set('autostart', '0');
        url.searchParams.set('ui_theme', 'dark');
        return url.toString();
    } catch {
        return `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autostart=0&ui_theme=dark`;
    }
}

function formatViews(count) {
    if (typeof count !== 'number') return '';
    return `${count.toLocaleString('id-ID')} kali dilihat`;
}

function createCard(model) {
    const name = escapeHTML(model.name || 'Untitled');
    const embedSrc = escapeHTML(buildEmbedSrc(model.embedUrl));
    const viewerUrl = escapeHTML(model.viewerUrl || `https://sketchfab.com/models/${model.uid}`);
    const views = formatViews(model.viewCount);

    const figure = document.createElement('figure');
    figure.className = 'card';
    figure.innerHTML = `
        <div class="embed">
            <iframe
                title="${name}"
                src="${embedSrc}"
                allow="autoplay; fullscreen; xr-spatial-tracking"
                allowfullscreen
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
        <figcaption>
            <div>
                <strong>${name}</strong>
                ${views ? `<span class="views">${escapeHTML(views)}</span>` : ''}
            </div>
            <a href="${viewerUrl}" target="_blank" rel="noopener noreferrer">Buka di Sketchfab</a>
        </figcaption>
    `;
    return figure;
}

function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', isError);
}

function getTotalPages() {
    return Math.max(1, Math.ceil(allModels.length / PAGE_SIZE));
}

async function fetchModels(url) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Sketchfab API ${response.status}`);
    }

    return response.json();
}

async function fetchAllModels() {
    const collected = [];
    let url = `${API_BASE}?user=${encodeURIComponent(SKETCHFAB_USER)}&sort_by=-viewCount&count=${API_PAGE_SIZE}`;

    while (url) {
        const data = await fetchModels(url);
        const results = Array.isArray(data.results) ? data.results : [];

        results.forEach((model) => {
            if (model && model.embedUrl && model.uid) {
                collected.push(model);
            }
        });

        url = data.next || null;
    }

    return collected;
}

function updatePagination() {
    if (!paginationEl) return;

    const totalPages = getTotalPages();
    paginationEl.hidden = allModels.length === 0;

    if (pageNumEl) pageNumEl.textContent = String(currentPage);
    if (totalPagesEl) totalPagesEl.textContent = String(totalPages);
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function renderPage(page) {
    if (!galleryEl) return;

    const totalPages = getTotalPages();
    currentPage = Math.min(Math.max(1, page), totalPages);

    galleryEl.innerHTML = '';

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageModels = allModels.slice(start, start + PAGE_SIZE);

    pageModels.forEach((model) => {
        galleryEl.appendChild(createCard(model));
    });

    updatePagination();

    if (actionsEl) actionsEl.hidden = false;
    setStatus(allModels.length === 0 ? 'Belum ada model untuk ditampilkan.' : '');
}

async function initGallery() {
    setStatus('Sedang membuka galeri…');

    try {
        allModels = await fetchAllModels();
        renderPage(1);
    } catch (error) {
        console.error(error);
        setStatus('Galeri belum bisa dibuka. Silakan coba lagi atau kunjungi Sketchfab.', true);
        if (actionsEl) actionsEl.hidden = false;
        if (paginationEl) paginationEl.hidden = true;
    }
}

function init() {
    if (yearEl) {
        yearEl.textContent = String(new Date().getFullYear());
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                renderPage(currentPage - 1);
                galleryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < getTotalPages()) {
                renderPage(currentPage + 1);
                galleryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    initGallery();
}

document.addEventListener('DOMContentLoaded', init);
