/**
 * vite-plugin-posts.js
 *
 * 虚拟模块（所有解析在 Node 侧完成，浏览器侧不引入 gray-matter）：
 *
 *   import posts from 'virtual:posts'
 *     → 按日期倒序的文章 meta 列表（title/date/tags/excerpt/slug）
 *
 *   import postsMap from 'virtual:posts-map'
 *     → 以 slug 为 key 的完整文章 Map：{ [slug]: { meta, content } }
 *       供 PostDetail 按 slug 直接查找，无需运行时动态 import
 *
 * 文件命名：src/posts/YYYY-MM-DD-slug.md
 *
 * SEO 功能（仅在 build 时生效）：
 *   - 为每篇文章和静态页面生成独立 HTML 入口（含完整 <head> meta）
 *   - 生成 sitemap.xml
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.resolve(__dirname, '../src/posts');

const VIRTUAL_LIST          = 'virtual:posts';
const VIRTUAL_MAP           = 'virtual:posts-map';
const VIRTUAL_POST_PREFIX   = 'virtual:post/';
const RESOLVED_LIST         = '\0virtual:posts';
const RESOLVED_MAP          = '\0virtual:posts-map';
const RESOLVED_POST_PREFIX  = '\0virtual:post/';

/** 把 gray-matter 解析出的 date 字段统一转成 YYYY-MM-DD 字符串 */
function normalizeDate(raw) {
  if (!raw) return '';
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw).slice(0, 10);
}

/** 读取全部文章（meta + content），按日期倒序 */
function loadAllPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];

  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
      const { data, content } = matter(raw);
      const slug = filename.replace(/\.md$/, '');
      const dateFromName = filename.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
      const meta = {
        slug,
        title:   data.title   ?? slug,
        date:    data.date    ? normalizeDate(data.date) : (dateFromName ?? ''),
        tags:    data.tags    ?? [],
        excerpt: data.excerpt ?? '',
      };
      return { meta, content };
    })
    .filter((p) => p.meta.date)
    .sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}

/**
 * 基于 Vite 构建出的 dist/index.html，替换 <head> 里的 SEO 相关标签，
 * 生成指定页面的 HTML。这样可以保留 Vite 注入的正确 JS/CSS 资源路径。
 *
 * @param {string} baseHtml   - dist/index.html 的原始内容
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.canonical
 * @param {string} [opts.date]  - 文章发布日期，有值时插入 og:article 标签
 */
function injectMeta(baseHtml, opts) {
  const { title, description, canonical, date } = opts;
  const fullTitle = title.includes('LURI') ? title : `${title} · LURI 落墨留白`;
  const ogType = date ? 'article' : 'website';

  const articleTag = date
    ? `\n    <meta property="article:published_time" content="${date}" />`
    : '';

  const seoBlock = `
    <title>${fullTitle}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />

    <!-- Open Graph -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />${articleTag}`;

  // 替换原有的 <title> 标签
  let html = baseHtml.replace(/<title>[^<]*<\/title>/, '');

  // 替换原有的 <meta name="description"> 标签（如果有）
  html = html.replace(/<meta name="description"[^>]*\/?>/, '');

  // 替换原有的 <link rel="canonical"> 标签（如果有）
  html = html.replace(/<link rel="canonical"[^>]*\/?>/, '');

  // 在 </head> 前插入完整 SEO block
  html = html.replace('</head>', `${seoBlock}\n  </head>`);

  return html;
}

/**
 * 生成 sitemap.xml 内容
 */
function buildSitemap(urls, lastmod) {
  const items = urls
    .map(
      (url) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

/** 从项目根目录的 .env 文件解析指定 key 的值 */
function readEnvFile(rootDir, key) {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    if (trimmed.slice(0, eqIdx).trim() === key) {
      return trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

export default function postsPlugin(userOptions = {}) {
  let siteUrl = '';
  let outDir = 'dist';

  return {
    name: 'vite-plugin-posts',

    configResolved(config) {
      outDir = config.build?.outDir ?? 'dist';
      // 优先级：插件选项 → .env 文件 → 默认值
      siteUrl =
        userOptions.siteUrl ||
        readEnvFile(config.root, 'VITE_SITE_URL') ||
        'https://luri.cc.cd';
    },

    resolveId(id) {
      if (id === VIRTUAL_LIST) return RESOLVED_LIST;
      if (id === VIRTUAL_MAP)  return RESOLVED_MAP;
      if (id.startsWith(VIRTUAL_POST_PREFIX))
        return RESOLVED_POST_PREFIX + id.slice(VIRTUAL_POST_PREFIX.length);
    },

    load(id) {
      if (id === RESOLVED_LIST) {
        const metas = loadAllPosts().map((p) => p.meta);
        return `export default ${JSON.stringify(metas, null, 2)};`;
      }

      // 完整文章 Map：{ [slug]: { meta, content } }
      if (id === RESOLVED_MAP) {
        const all = loadAllPosts();
        const map = {};

        all.forEach((post, index) => {
          const prevPost = all[index + 1]; // 更早的文章（日期更小）
          const nextPost = all[index - 1]; // 更新的文章（日期更大）

          map[post.meta.slug] = {
            ...post,
            prev: prevPost ? { slug: prevPost.meta.slug, title: prevPost.meta.title } : null,
            next: nextPost ? { slug: nextPost.meta.slug, title: nextPost.meta.title } : null,
          };
        });

        return `export default ${JSON.stringify(map)};`;
      }

      if (id.startsWith(RESOLVED_POST_PREFIX)) {
        const slug = id.slice(RESOLVED_POST_PREFIX.length);
        const all = loadAllPosts();
        const post = all.find((p) => p.meta.slug === slug);
        if (!post) throw new Error(`[vite-plugin-posts] 找不到文章：${slug}`);
        return [
          `export const meta = ${JSON.stringify(post.meta)};`,
          `export const content = ${JSON.stringify(post.content)};`,
        ].join('\n');
      }
    },

    /**
     * 构建完成后钩子：基于 Vite 生成的 index.html，为每个路由生成带 SEO meta 的 HTML，
     * 同时生成 sitemap.xml。
     * writeBundle 在 Vite 写完所有文件后触发。
     */
    async writeBundle() {
      const posts = loadAllPosts();
      const today = new Date().toISOString().slice(0, 10);

      // 读取 Vite 构建好的 index.html 作为模板（含正确的 JS/CSS 资源路径）
      const baseHtmlPath = path.join(outDir, 'index.html');
      if (!fs.existsSync(baseHtmlPath)) {
        console.warn('[vite-plugin-posts] 找不到 dist/index.html，跳过 SEO HTML 生成');
        return;
      }
      const baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');

      // 静态页面配置
      const staticPages = [
        {
          route: '/',
          outPath: path.join(outDir, 'index.html'),
          title: 'LURI - 落墨留白',
          description: 'LURI · 落墨留白 — 代码、架构、思考。凌晨两点的清醒记录。',
        },
        {
          route: '/blog',
          outPath: path.join(outDir, 'blog', 'index.html'),
          title: '随笔 · LURI 落墨留白',
          description: '代码、架构、思考。凌晨两点的清醒记录。LURI 的个人博客文章列表。',
        },
        {
          route: '/about',
          outPath: path.join(outDir, 'about', 'index.html'),
          title: '关于 · LURI 落墨留白',
          description: 'LURI，后端开发者，写代码也写博客。Java、微服务、系统架构、AI Agent。',
        },
      ];

      // 收集所有 URL 用于 sitemap
      const allUrls = [];

      // 生成静态页面 HTML
      for (const page of staticPages) {
        const canonical = `${siteUrl}${page.route === '/' ? '' : page.route}`;
        allUrls.push(canonical || siteUrl);

        const dir = path.dirname(page.outPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const html = injectMeta(baseHtml, {
          title: page.title,
          description: page.description,
          canonical: canonical || siteUrl,
        });

        fs.writeFileSync(page.outPath, html, 'utf-8');
        console.log(`[vite-plugin-posts] 生成 HTML → ${page.outPath}`);
      }

      // 生成每篇文章的 HTML
      for (const { meta } of posts) {
        const canonical = `${siteUrl}/blog/${meta.slug}`;
        allUrls.push(canonical);

        const postDir = path.join(outDir, 'blog', meta.slug);
        if (!fs.existsSync(postDir)) {
          fs.mkdirSync(postDir, { recursive: true });
        }

        const description = meta.excerpt
          ? meta.excerpt.slice(0, 160)
          : `${meta.title} - LURI 落墨留白`;

        const html = injectMeta(baseHtml, {
          title: meta.title,
          description,
          canonical,
          date: meta.date,
        });

        fs.writeFileSync(path.join(postDir, 'index.html'), html, 'utf-8');
      }

      console.log(`[vite-plugin-posts] 生成文章 HTML → ${posts.length} 篇`);

      // 生成 sitemap.xml
      const sitemap = buildSitemap(allUrls, today);
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf-8');
      console.log(`[vite-plugin-posts] 生成 sitemap.xml → ${allUrls.length} 条 URL`);
    },

    // dev 模式热更新
    configureServer(server) {
      if (!fs.existsSync(POSTS_DIR)) return;
      server.watcher.add(POSTS_DIR);
      server.watcher.on('all', (event, file) => {
        if (!file.startsWith(POSTS_DIR) || !file.endsWith('.md')) return;
        const listMod = server.moduleGraph.getModuleById(RESOLVED_LIST);
        if (listMod) server.moduleGraph.invalidateModule(listMod);
        const mapMod = server.moduleGraph.getModuleById(RESOLVED_MAP);
        if (mapMod) server.moduleGraph.invalidateModule(mapMod);
        const slug = path.basename(file, '.md');
        const postMod = server.moduleGraph.getModuleById(RESOLVED_POST_PREFIX + slug);
        if (postMod) server.moduleGraph.invalidateModule(postMod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
