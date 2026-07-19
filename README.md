# ┌────────────────────────────────────────────────────────┐
# │                   ROGUE DEVELOPMENT                    │
# │       Brutalist-Minimalism & Line-Art Portfolio        │
# └────────────────────────────────────────────────────────┘

## :pencil2: TENTANG PROYEK

Situs ini adalah **Personal Portfolio & Project Showcase** resmi untuk **Rogue Development** (Aris Hadisopiyan). Didesain dengan pendekatan brutalist-minimalism dan gaya seni garis (*line-art*) kontras tinggi, website ini berfungsi sebagai galeri pameran karya teknis dan visual secara digital.

Website ini bukan sekadar resume statis, melainkan representasi interaktif dari gabungan desain minimalis yang thoughtful dengan implementasi kode modern.

---

## :target: TUJUAN UTAMA WEBSITE

* **Pameran Karya Teknis:** Menampilkan proyek-proyek terpilih yang ditarik langsung secara dinamis dari repositori GitHub.
* **Representasi Identitas Visual:** Mengekspresikan filosofi desain "kesederhanaan adalah bentuk tertinggi dari kecanggihan" melalui tata letak brutalist, tanpa warna bayangan lembut, mengutamakan garis pembatas solid, serta grid yang kaku.
* **Integrasi Modern:** Mendemonstrasikan penggunaan vanilla code (HTML, CSS, JS) yang efisien, termasuk pemuatan komponen halaman dinamis (HTML Partials) dan integrasi dinamis dengan API pihak ketiga (GitHub API).

---

## :art: FILOSOFI DESAIN & BRANDING

Konsep visual yang digunakan berpegang teguh pada aturan visual yang tegas untuk menjaga estetika brutalist minimalis:

### :palette: Palet Warna (CSS Variables)
* **Background Utama (`--bg-primary`):** `#F5F5F0` (Warm White) — Memberikan kesan kertas fisik/kanvas klasik.
* **Background Sekunder (`--bg-secondary`):** `#FAFAF5` (Off-White) — Digunakan untuk kontras halus pada kartu proyek.
* **Text & Outline Utama (`--text-primary`):** `#000000` (Solid Black) — Garis pembatas tebal dan tulisan solid.
* **Aksen Coral (`--accent-coral`):** `#F08A7E` (Coral Red) — Sentuhan warna mencolok yang tegas.
* **Aksen Teal (`--accent-teal`):** `#7EB2B2` (Soft Teal) — Keseimbangan kontras terhadap warna coral.

### :desktop_computer: Karakteristik UI
* **Grid Pattern Background:** Implementasi grid berpola modular (60px) dengan transparansi rendah sebagai basis visual halaman.
* **Text-Stroke Header:** Judul besar menggunakan garis tepi (*stroke*) dengan isi transparan untuk menampilkan kekuatan tipografi.
* **Hard Shadow:** Menggunakan bayangan tegas (`4px 4px 0 0`) pada kartu dan tombol interaktif untuk memberikan kedalaman brutalist.
* **Grayscale Image Filter:** Gambar proyek disajikan dalam warna abu-abu (grayscale 80%) dan kontras tinggi yang secara dinamis berubah menjadi berwarna saat diarahkan oleh kursor (*hover*).

---

## :nut_and_bolt: TEKNOLOGI YANG DIGUNAKAN

* **HTML5:** Struktur semantik modular yang bersih.
* **Vanilla CSS3:** Manajemen tata letak responsif (*mobile-first*) menggunakan Grid dan Flexbox, serta CSS Custom Properties.
* **Vanilla JavaScript:**
  * Katalog karya/lab/arsip dari file statis `data/catalog.json` (disinkronkan server-side via GitHub Actions).
  * Fallback opsional ke GitHub API publik tanpa token di browser.
  * Engine perenderan ikon dinamis yang mengubah tag `<i>` menjadi SVG sprite secara instan.
  * Intersection Observer API untuk efek animasi masuk (*fade-in*).

---

## :lock: KATALOG AMAN (TANPA API KEY DI BROWSER)

Situs Pages **tidak** menyimpan atau memanggil GitHub dengan token di JavaScript.

1. Workflow `.github/workflows/sync-catalog.yml` berjalan setiap 6 jam (atau manual) dengan token Actions di secret.
2. Script `scripts/sync-catalog.mjs` menulis `data/catalog.json` (metadata + URL gambar publik).
3. Frontend hanya `fetch('data/catalog.json')` — file publik, tanpa kredensial.

Opsional: set secret repo `GH_CATALOG_TOKEN` (PAT read-only public repo) jika ingin kuota API lebih tinggi; jika kosong, workflow memakai `github.token` bawaan.

Regenerasi lokal:

```bash
# PowerShell
$env:GITHUB_TOKEN = (gh auth token); node scripts/sync-catalog.mjs
```

---

## :envelope: KONTAK & TAUTAN

* **Identitas:** Rogue Development (Aris Hadisopiyan)
* **Email:** aris.hadisopiyan@gmail.com
* **GitHub:** [github.com/rogue-dev-studio](https://github.com/rogue-dev-studio)
