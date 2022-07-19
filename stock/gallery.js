const PROFILE_URL = 'https://www.shutterstock.com/g/ArisHadisopiyan';
const CATALOG_URL = 'catalog.json';
const PAGE_SIZE = 9;

const galleryEl = document.getElementById('gallery');
const statusEl = document.getElementById('gallery-status');
const actionsEl = document.getElementById('gallery-actions');
const paginationEl = document.getElementById('pagination');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageNumEl = document.getElementById('page-num');
const totalPagesEl = document.getElementById('total-pages');
const yearEl = document.getElementById('year');

let allItems = [];
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

function createCard(item) {
    const title = escapeHTML(item.title || 'Stock asset');
    const kind = escapeHTML(item.kind || 'Stock');
    const url = escapeHTML(item.url || PROFILE_URL);
    const thumb = escapeHTML(item.thumb || '');

    const link = document.createElement('a');
    link.className = 'card';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `
        <div class="thumb">
            <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.style.opacity='0.2'">
        </div>
        <figcaption>
            <strong>${title}</strong>
            <span class="kind">${kind}</span>
        </figcaption>
    `;
    return link;
}

function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', isError);
}

function getTotalPages() {
    return Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
}

function updatePagination() {
    if (!paginationEl) return;

    const totalPages = getTotalPages();
    paginationEl.hidden = allItems.length === 0;

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
    allItems.slice(start, start + PAGE_SIZE).forEach((item) => {
        galleryEl.appendChild(createCard(item));
    });

    updatePagination();
    if (actionsEl) actionsEl.hidden = false;

    if (allItems.length === 0) {
        setStatus('Koleksi lengkap tersedia di halaman Shutterstock.');
    } else {
        setStatus('');
    }
}

async function loadCatalog() {
    setStatus('Sedang membuka galeri…');

    try {
        const response = await fetch(CATALOG_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Catalog ${response.status}`);
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        allItems = items.filter((item) => item && item.url && item.thumb);
        renderPage(1);
    } catch (error) {
        console.error(error);
        allItems = [];
        renderPage(1);
        setStatus('Galeri lokal belum tersedia. Silakan buka koleksi di Shutterstock.', true);
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

    loadCatalog();
}

document.addEventListener('DOMContentLoaded', init);
