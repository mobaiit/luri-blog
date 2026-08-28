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
 * 生成单个页面的 HTML 字符串
 * @param {object} opts
 * @param {string} opts.title       - <title> 内容
 * @param {string} opts.description - meta description
 * @param {string} opts.canonical   - 规范 URL
 * @param {string} opts.siteUrl     - 站点根地址（无尾部斜杠）
 * @param {string} opts.date        - 文章发布日期（可选，用于 og:article）
 */
function buildHtml(opts) {
  const { title, description, canonical, siteUrl, date } = opts;
  const fullTitle = title.includes('LURI') ? title : `${title} · LURI 落墨留白`;
  const ogType = date ? 'article' : 'website';
  const dateTag = date
    ? `\n    <meta property="article:published_time" content="${date}" />`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${fullTitle}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/png" href="/images/luri-logo.png" />

    <!-- Open Graph -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />${dateTag}

    <!-- 百度相关 -->
    <meta name="baidu-site-verification" content="BAIDU_VERIFY_TOKEN" />
    <meta name="referrer" content="no-referrer-when-downgrade" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

/**
 * 生成 sitemap.xml 内容
 * @param {string[]} urls - 完整 URL 列表
 * @param {string} lastmod - 最后修改时间
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
     * 构建完成后钩子：生成多入口 HTML 和 sitemap.xml
     * writeBundle 在文件写入 dist 后触发，可以继续往 dist 里写文件
     */
    async writeBundle() {
      const posts = loadAllPosts();
      const today = new Date().toISOString().slice(0, 10);

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

        // 仅在对应目录不存在同名文件时写入（不覆盖 Vite 已生成的 index.html，只补充 /blog 和 /about）
        const dir = path.dirname(page.outPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const html = buildHtml({
          title: page.title,
          description: page.description,
          canonical: canonical || siteUrl,
          siteUrl,
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

        const html = buildHtml({
          title: meta.title,
          description,
          canonical,
          siteUrl,
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
