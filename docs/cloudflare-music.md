# Music catalog deployment

The music page is a static React page. Its extension discovery endpoint is a Cloudflare Pages Function at `/api/music/sources`.

Deploy this repository through Cloudflare Pages as usual. Pages automatically publishes the `functions/` directory alongside the Vite build output.

The endpoint searches public GitHub repositories for LX Music source projects and caches its response for fifteen minutes at Cloudflare's edge. It works without credentials at GitHub's low anonymous API rate limit. To raise that limit, add a `GITHUB_TOKEN` environment variable in the Pages project settings. Use a fine-grained token with read-only public repository metadata access.

`/api/music/sources` returns repository metadata only: repository name, URL, description, star count, and update time.

The player uses two private Pages Function adapters:

- `GET /api/music/search?q=...` calls the endpoint in `MUSIC_SEARCH_ENDPOINT` and normalizes its results.
- `GET /api/music/resolve?id=...&source=...` calls the endpoint in `MUSIC_RESOLVE_ENDPOINT` and returns only the final audio URL.

Set these two values, and optionally `MUSIC_SOURCE_TOKEN`, as encrypted Pages environment variables. They are never sent to the browser or committed to Git. Audio itself is not proxied: once a URL is resolved, the browser connects to it directly.
