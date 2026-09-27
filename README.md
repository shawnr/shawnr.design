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

1. Copy `.siteconfig.example` to `.siteconfig` (gitignored) and fill in:
   - `MEDIA_DIR` — absolute path to the media folder (outside this repo)
   - `MEDIA_BASE_URL` / `R2_PUBLIC_URL` — the Cloudflare R2 public bucket URL
   - `R2_REMOTE` / `R2_BUCKET` — the rclone remote and bucket name
     (set up the remote once with `rclone config`)
2. In `config.toml`, `params.mediaBaseUrl` must point at the same R2 public URL.

## Commands (`./run.sh`)

| Command | What it does |
|---|---|
| `./run.sh cms` | Local CMS at http://localhost:3000 |
| `./run.sh serve` | Hugo dev server + local media server on :8888 |
| `./run.sh build` | Build the site to `public/` |
| `./run.sh deploy` | Dry run of the media upload to R2 |
| `./run.sh deploy --go` | Upload media to R2 for real (`rclone sync`) |
| `./run.sh media-server` | Serve media locally on :8888 |

## Publishing

Text and media are published separately:

1. **Media → Cloudflare R2.** Run `./run.sh deploy --go`, or use the CMS
   **SYNC ↑ → RUN SYNC** button (same `rclone sync` command). Only slug
   subfolders are uploaded; loose files and dotfiles in the media root are skipped.
   `rclone sync` also deletes files from R2 that no longer exist locally.
2. **Site → GitHub Pages.** Commit and push `content/` (and any template
   changes) to `main`. The `.github/workflows/hugo.yml` action builds with
   `hugo --minify` and deploys. No need to build or upload `public/` by hand.

Sync media first, so new pages don't go live pointing at images that aren't uploaded yet.

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

Example: `{R2 public URL}/titanium-sebenza-31/01.jpg`

The CMS also writes an 800px copy of each image to `{slug}/preview/`. Gallery
and project pages use the preview; the lightbox loads the full-size file.

To test locally, `./run.sh serve` starts a media server on :8888 alongside
`hugo server` (the dev media URL is set in `config/`).
