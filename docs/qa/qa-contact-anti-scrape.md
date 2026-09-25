# QA — Contact page + anti-scrape

Date: 2026-09-25

## Checklist

| AC | Result | Notes |
|----|--------|-------|
| AC-01 Nav/hero → `/contact/` | Pass | nav, hero, lab, 3d |
| AC-02 No inbox in HTML | Pass | contact + homepage; CV tanpa mailto plaintext |
| AC-03 Bot gates | Pass (logic) | honeypot + dwell + touch + canvas CAPTCHA |
| AC-04 Valid submit | Pass | XOR decode; no contiguous email in source |
| AC-05 Subpage Kontak | Pass | lab + 3d |
| AC-06 CAPTCHA wrong | Pass (logic) | reject + refresh |

## Manual before publish

1. Buka `/contact/`
2. CAPTCHA salah → error + kode baru
3. CAPTCHA benar + form valid → mail client
4. View-source: tidak ada inbox plaintext

## Residual risk

Client CAPTCHA bukan jaminan absolut vs OCR/RE. Backend + Turnstile dibutuhkan untuk proteksi kuat.
