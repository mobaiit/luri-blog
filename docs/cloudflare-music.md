# Music source deployment

The music page is a static React page. Cloudflare Pages Functions run only small search and URL-resolution requests; audio is always delivered directly from the source to the visitor's browser.

Deploy this repository through Cloudflare Pages as usual. Pages automatically publishes the `functions/` directory alongside the Vite build output.

The endpoint searches public GitHub repositories for LX Music source projects and caches its response for fifteen minutes at Cloudflare's edge. It works without credentials at GitHub's low anonymous API rate limit. To raise that limit, add a `GITHUB_TOKEN` environment variable in the Pages project settings. Use a fine-grained token with read-only public repository metadata access.

`/api/music/sources` returns repository metadata only: repository name, URL, description, star count, and update time.

The extension discovery endpoint is a Cloudflare Pages Function at `/api/music/sources`; it returns repository metadata only.

- `GET /api/music/search?q=...` runs every loaded source that declares `search`, merges their results, and returns small JSON metadata.
- `GET /api/music/resolve?id=...&source=...` runs `musicUrl` for the selected source and returns a URL only.

Source scripts are kept in `music-sources/`. To add another source, put its script there and add a loader in `music-sources/index.js`; Cloudflare Workers need explicit imports to include scripts in the deployed bundle. A searchable script must register an `lx.on(EVENT_NAMES.request, ...)` handler for the `search` action and return tracks with `id` (or `songmid`/`hash`), `title`, and `source`. Preserve the full source-specific track object as `musicInfo` when resolving needs fields beyond the ID.

The bundled `itunes-preview.js` source provides a working music list using public preview URLs. Search and resolution use Cloudflare, but the browser connects directly to the returned audio URL; Cloudflare never proxies audio bytes. HTTPS deployments require HTTPS audio URLs (browsers block mixed `http` media).
