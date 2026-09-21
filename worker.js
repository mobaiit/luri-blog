import { handleLuriMusic, isAboutPageEnabled, isBlogPostsEnabled, isBlogSiteEnabled, isDocsPageEnabled, isMusicPageEnabled } from './functions/luri-music/index.js';

export default {
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname.startsWith('/api/music/') || pathname.startsWith('/api/luri-music/music/')) {
      return new Response(JSON.stringify({ error: 'Music capabilities are provided by the configured Provider' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (pathname.startsWith('/api/luri-music/')) {
      try { return await handleLuriMusic(request, env); }
      catch (error) {
        console.error('Luri Music API failed', pathname, error?.stack || error);
        return new Response(JSON.stringify({ error: `后台服务异常（${pathname.endsWith('/admin/login') ? '登录' : '请求'}未完成），请稍后重试` }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      }
    }
    if (pathname === '/admin') return Response.redirect(new URL('/?admin=1', request.url), 302);
    if (pathname === '/luri-music' || pathname === '/luri-music/') {
      if (!await isMusicPageEnabled(env)) return Response.redirect(new URL('/', request.url), 302);
      return Response.redirect(new URL('/music', request.url), 301);
    }
    if (pathname === '/music/' || pathname === '/music') {
      if (!await isMusicPageEnabled(env)) return Response.redirect(new URL('/', request.url), 302);
      if (pathname === '/music/') return Response.redirect(new URL('/music', request.url), 301);
    }
    const isAdminEntry = pathname === '/' && searchParams.get('admin') === '1';
    const isBlogRoute = !isAdminEntry && (pathname === '/' || pathname === '/blog' || pathname === '/blog/' || pathname.startsWith('/blog/') || pathname === '/about' || pathname === '/about/');
    if (isBlogRoute && !await isBlogSiteEnabled(env)) {
      if (await isMusicPageEnabled(env)) return Response.redirect(new URL('/music', request.url), 302);
      return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if ((pathname === '/blog' || pathname === '/blog/' || pathname.startsWith('/blog/')) && !await isBlogPostsEnabled(env)) return Response.redirect(new URL('/', request.url), 302);
    if ((pathname === '/about' || pathname === '/about/') && !await isAboutPageEnabled(env)) return Response.redirect(new URL('/', request.url), 302);
    if (pathname === '/docs' || pathname === '/docs/') {
      if (!await isDocsPageEnabled(env)) return Response.redirect(new URL('/', request.url), 302);
      if (pathname === '/docs/') return Response.redirect(new URL('/docs', request.url), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
