# Release notes — Contact page

Version: site local change 2026-09-25  
Deploy: GitHub Pages (manual push by maintainer)

## Changes

- Halaman baru: `/contact/`
- Homepage: CTA ke kontak (form dipindah)
- Anti-scrape: inbox XOR-encoded, honeypot, dwell time, human checkbox, no email di DOM/HTML
- `robots.txt` blok archive bots pada `/contact/`
- CV: email plaintext diganti link ke `/contact/`
- Redirect legacy `/#contact` → `/contact/`

## Not done (needs user)

- `git commit` / `git push` ke `rogue-dev-studio.github.io`
