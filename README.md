# shawnr.design — Hugo templates

Complete Hugo site templates for the craft gallery.

## File structure

```
shawnr.design/
├── config.toml                          ← site config + mediaBaseUrl param
├── content/
│   └── projects/
│       ├── _index.md                    ← section index (required)
│       └── your-project-slug.md        ← one per project (written by CMS)
├── layouts/
│   ├── _default/
│   │   └── baseof.html                 ← base layout (nav, footer, spectrum bar)
│   └── projects/
│       ├── list.html                   ← gallery index with filter bar
│       └── single.html                 ← project page: masonry + lightbox
└── static/
    └── css/
        └── main.css                    ← full stylesheet (titanium oxide palette)
```

## Setup

1. Copy all files into your Hugo repo root
2. Edit `config.toml`:
   - Set `baseURL` to your actual domain
   - Set `params.mediaBaseUrl` to where your media lives on the server
     (must match the rsync destination in the CMS config)
3. Build: `hugo`
4. Output is in `public/` — rsync that to your Ionos server

## How projects render

Each `.md` file in `content/projects/` becomes:
- A card on the gallery list page (`/projects/`)
- A full project page at `/projects/your-slug/`

The `media` frontmatter array drives the masonry grid:
- `type: image` → click-to-expand lightbox
- `type: video` → inline `<video>` player with controls

## Grid layout

The asymmetric grid repeats every 5 cards:
- Position 0 → featured (spans 2 columns) with spectrum bar accent
- Position 1 → tall (spans 2 rows)
- Positions 2–4 → normal cards

So with 5 projects you get one full asymmetric group.
With 10 you get two, etc. Works fine with any count.

## Filtering

The filter bar on the list page is built from actual frontmatter values —
no manual configuration needed. Technique chips use gold, material chips use teal.
JavaScript filters cards client-side with no page reload.

## Lightbox

- Click any image on a project page to open the lightbox
- Arrow keys or on-screen buttons to navigate
- Escape to close
- Touch swipe left/right on mobile
- Videos are NOT in the lightbox — they play inline

## mediaBaseUrl

Media files live outside the Hugo repo and are served from a separate path.
The URL is constructed as:

  `{mediaBaseUrl}/{slug}/{filename}`

Example: `https://shawnr.design/media/titanium-sebenza-31/01.jpg`

To test locally with `hugo server`, you can temporarily point `mediaBaseUrl`
at your local media directory via a simple HTTP server:

  ```bash
  cd /your/media/dir && python3 -m http.server 8080
  # then set mediaBaseUrl = "http://localhost:8080" in config.toml
  ```
