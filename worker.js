import { onRequestGet as searchMusic } from './functions/api/music/search.js';
import { onRequestGet as resolveMusic } from './functions/api/music/resolve.js';
import { onRequestGet as listSources } from './functions/api/music/sources.js';

const methodNotAllowed = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/music/search') return request.method === 'GET' ? searchMusic({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/resolve') return request.method === 'GET' ? resolveMusic({ request, env, ctx }) : methodNotAllowed();
    if (pathname === '/api/music/sources') return request.method === 'GET' ? listSources({ request, env, ctx }) : methodNotAllowed();
    return env.ASSETS.fetch(request);
  },
};
