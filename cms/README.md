# shawnr.design / Local CMS

A zero-dependency local content management tool for the shawnr.design craft gallery.

## Setup

The CMS reads its settings from `../.siteconfig` (see the main README).
It uses `MEDIA_DIR` for uploads and `R2_REMOTE` / `R2_BUCKET` for sync.
Project files are always written to `../content/projects/`.

Requirements: Node.js (no npm install), macOS `sips` for preview images,
and `rclone` with the R2 remote configured for sync.

Start it from the repo root:

```bash
./run.sh cms
```

Then open http://localhost:3000.

## Workflow

1. Click **NEW PROJECT**
2. Fill in title → slug auto-generates
3. Add techniques, materials, tags via quick-add buttons or type + Enter
4. Write your artist statement in the description field
5. Drag & drop media files. They upload immediately to `MEDIA_DIR/{slug}/`,
   and images get an 800px copy in `{slug}/preview/`
6. Reorder media and add captions in the order panel
7. Set cover image filename (must match a file you uploaded)
8. Click **SAVE PROJECT**. This writes `content/projects/{slug}.md`
9. Click **SYNC ↑** in the header → **RUN SYNC** to upload media to Cloudflare R2.
   It runs `rclone sync` and can take several minutes for large batches.
   `./run.sh deploy --go` does the same thing from the terminal with live progress.
10. Commit and push to `main`. GitHub Pages builds and publishes the site.

## File Layout

```
Hugo repo/
  .siteconfig           ← local settings (gitignored)
  content/
    projects/
      slug-name.md      ← written by CMS

Media dir (MEDIA_DIR, separate from repo)/
  slug-name/
    01.jpg
    02.mp4
    preview/
      01.jpg            ← 800px copy made by the CMS

Cloudflare R2 bucket/
  slug-name/...         ← mirror of the media dir (rclone sync)

GitHub Pages            ← site, built by .github/workflows/hugo.yml on push to main
```

## Frontmatter Schema

```yaml
---
title: "Sebenza 31 — Titanium Anodize + Clip Swap"
date: 2025-04-15
slug: titanium-sebenza-31
cover: 01.jpg
tags: ["knife", "edc"]
techniques: ["anodizing", "part-swap"]
materials: ["titanium"]
media:
  - file: 01.jpg
    type: image
    caption: "Voltage 3 color ramp on the blade"
  - file: 02.mp4
    type: video
    caption: "Color shift under light"
draft: false
---

Artist statement goes here.
```
