# Public Asset Manifest

The handover assembly copies the following public media to `assets/public/` while preserving each file’s `/manus-storage/...` key. In portable local mode, the server exposes this directory at the same URL prefix.

| Asset group | Source key pattern | Purpose |
| --- | --- | --- |
| Global visual system | `mohamed-adel-global-texture_*`, `mohamed-adel-rotating-star_*` | Fixed background texture and rotating star. |
| Hero | `mohamed-adel-hero-portrait_*` | Primary portrait used by the homepage. |
| Work fallback media | `mohamed-adel-project-*` | Default gallery/project imagery. |
| Current CMS project media | `portfolio/.../projects/*` | Images referenced by current CMS projects. |
| Arabic typography | `thmanyahseriftext-*.otf` | Five Thmanyah Serif font weights used by RTL pages. |

The build script writes `assets/public/manifest.txt` with the exact exported paths and checksums.
