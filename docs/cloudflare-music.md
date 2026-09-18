# Music catalog deployment

The music page is a static React page. Its extension discovery endpoint is a Cloudflare Pages Function at `/api/music/sources`.

Deploy this repository through Cloudflare Pages as usual. Pages automatically publishes the `functions/` directory alongside the Vite build output.

The endpoint searches public GitHub repositories for LX Music source projects and caches its response for fifteen minutes at Cloudflare's edge. It works without credentials at GitHub's low anonymous API rate limit. To raise that limit, add a `GITHUB_TOKEN` environment variable in the Pages project settings. Use a fine-grained token with read-only public repository metadata access.

`/api/music/sources` returns repository metadata only: repository name, URL, description, star count, and update time. It does not proxy audio, lyrics, or search traffic. The browser must connect to an enabled source directly, keeping audio bandwidth and per-track traffic outside Cloudflare Workers.
