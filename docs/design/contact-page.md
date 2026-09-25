# Design — Contact page

## Theme gate

Brand existing: brutalist minimal — Space Grotesk + Inter, outline stroke headings, `--outline-color`, tidak purple-gradient / cream-serif AI slop.

## Page composition

1. Nav (logo → home, Kontak aktif)
2. Satu section: judul + satu kalimat + form
3. Fallback copy tanpa menampilkan email
4. Link sponsor (sudah publik) opsional ringkas
5. Footer

## Homepage

Section `#connect`: CTA “Buka halaman kontak” + marketplace + social (tetap).

## States

- Default form
- Validation error (field required)
- Blocked (bot gate) — pesan generik, tanpa detail teknis
- Success redirect ke mail client (tidak render email)
