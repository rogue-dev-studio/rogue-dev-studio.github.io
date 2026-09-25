# Discovery — Contact page + anti-scrape

Date: 2026-09-25  
Site: https://rogue-dev-studio.github.io/

## Brief

Contact Us di homepage (`#contact`) perlu dipindah ke halaman baru. Alamat inbox tidak boleh mudah di-scrape dari HTML/JS plain text.

## Current state

- Form contact di `partials/contact.html` (section homepage)
- Submit → `mailto:` dengan inbox `['aris.hadisopiyan','gmail.com'].join('@')` di `js/main.js` (masih mudah di-scrape)
- Link nav/hero/lab/3d mengarah ke `#contact`

## Assumptions

- Stack tetap static GitHub Pages (tanpa backend form)
- Alur kirim tetap mailto client-side setelah gate anti-bot
- Marketplace + social tetap di homepage (bukan PII inbox)
- Tidak deploy otomatis; user push sendiri
