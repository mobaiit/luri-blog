import { onRequestGet as searchMusic } from './functions/api/music/search.js';
import { onRequestGet as resolveMusic } from './functions/api/music/resolve.js';
import { onRequestGet as listSources } from './functions/api/music/sources.js';
import { onRequestGet as getLyrics } from './functions/api/music/lyrics.js';
import { onRequestGet as getArtwork } from './functions/api/music/art.js';

const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/music/search') return request.method === 'GET' ? searchMusic({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/resolve') return request.method === 'GET' ? resolveMusic({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/lyrics') return request.method === 'GET' ? getLyrics({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/art') return request.method === 'GET' ? getArtwork({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/sources') return request.method === 'GET' ? listSources({ request, env, ctx }) : methodNotAllowed();
    return env.ASSETS.fetch(request);
  },
};
