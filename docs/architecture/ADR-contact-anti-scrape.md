# Architecture — Contact anti-scrape (static)

## Context

GitHub Pages static site. Kirim via `mailto:` setelah gate.

## Decision

| Decision | Choice | Why |
|----------|--------|-----|
| CAPTCHA UI | Mini-game basket **3D** (Three.js mesh models) | Tampil model 3D: bola, rim, papan, tiang, net |
| Runtime | `three@0.170` CDN | Tanpa build step; WebGL di browser |
| Interaction | Drag di lantai (raycast plane) → shoot physics | Pointer nyata, sulit untuk bot naif |
| Blender GLB | Ditunda (MCP Blender offline) | Procedural mesh dulu; bisa diganti GLB nanti |

## Flow

```
User → /contact/ → load Three.js → drag bola 3D → skor lewat rim → enable kirim → mailto
```
