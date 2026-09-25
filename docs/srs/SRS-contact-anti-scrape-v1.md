# SRS — Contact page + anti-scrape

Version: 1.0.0  
Date: 2026-09-25

## 1. Problem & goal

**Problem:** Form kontak di homepage dan string inbox di JS mudah diambil scraper/bot.  
**Goal:** Halaman `/contact/` terpisah; inbox tidak muncul sebagai plaintext di HTML/DOM/source yang trivially scrapable; hanya dibuka lewat `mailto:` setelah gate manusia.

## 2. Actors

- Pengunjung proyek (manusia)
- Bot/scraper email
- Maintainer Rogue Development

## 3. In scope

- Halaman baru `contact/`
- CTA homepage menggantikan form inline
- Update semua link Kontak → `/contact/`
- Proteksi: encode inbox, honeypot, dwell time, interaksi field, tanpa render email di DOM
- `robots.txt` + meta `noarchive` pada halaman kontak

## 4. Out of scope

- Backend form / API / CAPTCHA pihak ketiga berbayar
- Mengubah marketplace/social links
- Deploy otomatis ke production tanpa permintaan user

## 5. Functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Nav/hero/subpage link Kontak ke `/contact/` | P0 |
| FR-02 | Homepage menampilkan CTA ke halaman kontak (bukan form penuh) | P0 |
| FR-03 | Halaman kontak punya form setara field sebelumnya | P0 |
| FR-04 | Submit valid membuka mail client dengan subject/body terisi | P0 |
| FR-05 | Inbox tidak pernah sebagai string contigous plaintext di HTML | P0 |
| FR-06 | Honeypot + timing + human checkbox menolak submit bot | P0 |
| FR-07 | Inbox tidak di-inject ke DOM (text/href) | P0 |

## 6. Non-functional

| ID | Requirement |
|----|-------------|
| NFR-01 | Selaras tema brutalist existing (`styles.css`) |
| NFR-02 | Mobile-first, a11y label/fokus |
| NFR-03 | Loading/error form state jelas (validasi, bot blocked) |
| NFR-04 | Proteksi mengurangi scrape otomatis; bukan jaminan absolut vs reverse-engineer JS |

## 7. Acceptance criteria

- **AC-01:** Given homepage, When klik Kontak/Diskusi Proyek, Then navigasi ke `/contact/`.
- **AC-02:** Given view-source homepage/contact HTML, When cari `@gmail` / `mailto:`, Then tidak ada alamat inbox.
- **AC-03:** Given form diisi cepat + honeypot terisi, When submit, Then tidak membuka mailto.
- **AC-04:** Given form valid + checkbox manusia + dwell ≥ threshold, When submit, Then mail client terbuka.
- **AC-05:** Given lab/3d nav Kontak, When klik, Then ke `/contact/`.

## 8. Risks / assumptions

- Scraper cerdas yang mengeksekusi JS penuh masih bisa reverse-engineer decode — mitigasi: obfuscation + gates, bukan secret server-side.
- Mailto bergantung pada client email user.
