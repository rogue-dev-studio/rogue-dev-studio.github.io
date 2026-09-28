# Google Sitelinks — Rogue GitHub Pages

Target sites:

- https://rogue-dev-studio.github.io/
- https://rogue-dev-studio.github.io/rogue-asset-store/

## Apa yang terlihat di screenshot itch.io

Itu **Google Sitelinks**: hasil utama + beberapa tautan subhalaman (Free, Pixel Art, 2D, …). Google yang memilih; **tidak bisa diaktifkan manual**.

Sitelinks biasanya muncul saat:

1. Query **brand** (mis. `rogue developer`, `rogue asset store`)
2. Situs Anda **peringkat #1** untuk query itu
3. Ada cukup **halaman hub** yang terindeks, punya judul unik, dan saling terhubung

## Yang sudah disiapkan di kode

| Item | Status |
|------|--------|
| `sitemap.xml` (studio + asset store) | ditambah |
| `robots.txt` → URL sitemap benar | diperbaiki |
| Schema `Organization` + `WebSite` | homepage + asset store |
| Canonical + title unik hub | contact, servers, skills, assets, search |
| Favicon di hasil pencarian | logo studio dipakai ulang di asset store |
| Google Search Console | sudah diverifikasi via `googlebd9a7eba3d5be834.html` |

**Dikecualikan dari SEO sitelinks (tidak diubah, tidak masuk sitemap):** `/lab/`, `/cv/`, `/3d/`

## Langkah di Google Search Console

Property sudah terverifikasi. Tinggal:

1. **Sitemaps** → submit:
   - `https://rogue-dev-studio.github.io/sitemap.xml`
   - `https://rogue-dev-studio.github.io/rogue-asset-store/sitemap.xml`
2. **URL Inspection** → Request indexing untuk:
   - `/`
   - `/contact/`
   - `/rogue-asset-store/`
   - `/rogue-asset-store/servers/`
   - `/rogue-asset-store/skills/`
   - `/rogue-asset-store/assets/`
3. Cek query brand: `rogue developer`, `rogue-dev-studio`, `rogue asset store`

## Calon sitelinks yang realistis

| Label | URL |
|-------|-----|
| Asset Store | `/rogue-asset-store/` |
| MCP Servers | `/rogue-asset-store/servers/` |
| Agent Skills | `/rogue-asset-store/skills/` |
| Assets | `/rogue-asset-store/assets/` |
| Kontak | `/contact/` |

Hindari mengandalkan anchor `#projects` / `#toolkit` sebagai sitelinks — Google butuh URL halaman terpisah.

## Ekspektasi waktu

Setelah deploy + submit sitemap: **beberapa hari hingga beberapa minggu**. Sitelinks tidak dijamin; otoritas brand + klik pengguna mempengaruhi.

## Deploy

1. Push / publish `rogue-dev-studio.github.io` (sitemap + robots + schema)
2. Push `rogue-asset-store` → workflow Pages deploy folder `site/`
3. Submit sitemap di Search Console (verifikasi file sudah ada)
