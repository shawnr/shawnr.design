# shawnr.design / Local CMS

A zero-dependency local content management tool for the shawnr.design craft gallery.

## Setup

1. **Edit `config.json`** with your actual paths:
   ```json
   {
     "hugoContentDir": "/path/to/shawnr.design/content/projects",
     "mediaDir": "/path/to/your/media/shawnrdesign",
     "mediaBaseUrl": "https://shawnr.design/media",
     "rsync": {
       "site": {
         "src": "/path/to/shawnr.design/public/",
         "dest": "user@your-ionos-host:/var/www/shawnr.design/public/"
       },
       "media": {
         "src": "/path/to/your/media/shawnrdesign/",
         "dest": "user@your-ionos-host:/var/www/shawnr.design/media/"
       }
     }
   }
   ```

2. **Start the server** (requires Node.js, no npm install needed):
   ```bash
   node server.js
   ```

3. **Open the CMS** in your browser:
   ```
   http://localhost:3000
   ```

## Workflow

1. Click **NEW PROJECT**
2. Fill in title → slug auto-generates
3. Add techniques, materials, tags via quick-add buttons or type + Enter
4. Write your artist statement in the description field
5. Drag & drop media files — they upload immediately to the media directory
6. Reorder media and add captions in the order panel
7. Set cover image filename (must match a file you uploaded)
8. Click **SAVE PROJECT** — writes the `.md` file to your Hugo content dir
9. Run `hugo` to build the site
10. Click **SYNC ↑** in the header → **RUN RSYNC** to push site + media to Ionos

## File Layout

```
Hugo repo/
  content/
    projects/
      slug-name.md      ← written by CMS

Media dir (separate from repo)/
  slug-name/
    01.jpg
    02.mp4
    ...

Ionos server/
  public/               ← Hugo output, rsync'd from repo
  media/                ← media files, rsync'd from media dir
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
