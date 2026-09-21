# LURI

个人博客与独立音乐播放器客户端，基于 React、Vite 和 Cloudflare Workers 构建。

在线地址：[https://luri.cc.cd](https://luri.cc.cd)

## 项目组成

| 模块 | 路由 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 个人主页与博客入口 |
| 随笔 | `/blog` | Markdown 文章列表、标签筛选与文章详情 |
| 关于 | `/about` | 个人介绍，可在后台隐藏 |
| LURI MUSIC | `/music` | 支持第三方 Music Provider 的音乐播放器客户端 |
| 开发者文档 | `/docs` | Provider 使用说明、协议与接口文档 |
| 管理后台 | `/admin` | 用户、管理员、网站设置和邮件配置 |

LURI MUSIC 与博客共用同一个前端应用，但访问策略相互独立。后台可以隐藏博客导航中的 MUSIC 入口，同时保留 `/music` 的直接访问能力；也可以彻底停用音乐页面，或切换成仅显示音乐页面的模式。

## 架构边界

本仓库包含：

- 个人博客页面与 Markdown 文章构建流程；
- LURI MUSIC 播放器界面、账号和访问权限；
- 用户 Provider 配置、加密存储和通用 Provider 协议客户端；
- Cloudflare Worker API、D1 数据库迁移和管理后台。

本仓库不包含具体音乐平台适配、音源搜索实现、媒体地址解析或音频代理。搜索、随机发现、播放资源、歌词和封面等能力由用户配置的独立 Provider 按协议提供。浏览器直接请求当前激活的 Provider，博客 Worker 不转发音频数据。

协议说明位于网站 `/docs` 页面和 [`docs/music-provider-protocol`](docs/music-provider-protocol)；部署说明见 [`docs/luri-music.md`](docs/luri-music.md) 与 [`docs/cloudflare-music.md`](docs/cloudflare-music.md)。

## 技术栈

- React 19、React Router 6
- Vite 8
- Cloudflare Workers、Workers Static Assets
- Cloudflare D1
- React Markdown、remark-gfm、gray-matter
- Waline、Giscus
- 原生 CSS

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

`npm run dev` 只启动 Vite 前端开发服务器。需要联调 Worker API 和 D1 时，先构建前端，再使用 Wrangler 启动完整应用：

```bash
npm run build
npx wrangler dev
```

常用检查命令：

```bash
npm run lint
npm run build
npm run preview
```

## 数据库与环境配置

Cloudflare Worker 需要名为 `LURI_MUSIC_DB` 的 D1 binding。创建数据库并更新 `wrangler.toml` 后，执行全部迁移：

```bash
npx wrangler d1 migrations apply LURI_MUSIC_DB --remote
```

运行时使用的敏感配置应通过 Wrangler Secret 或 Cloudflare 控制台配置，不要提交到仓库：

| 变量 | 用途 |
| --- | --- |
| `PROVIDER_CREDENTIAL_KEY` | 加密用户保存的 Provider 凭证 |
| `TURNSTILE_SITE_KEY` | Turnstile 前端站点密钥 |
| `TURNSTILE_SECRET_KEY` | Turnstile 服务端校验密钥 |
| `RESEND_API_KEY` | 注册、重置密码等邮件发送；也可在后台配置 |

例如：

```bash
npx wrangler secret put PROVIDER_CREDENTIAL_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
```

## 网站显示设置

进入 `/admin` 的“网站设置”可以分别控制：

- 是否启用个人博客站点；
- 是否启用随笔页面及导航；
- 是否启用关于我页面及导航；
- 是否在博客导航显示 MUSIC；
- 是否启用 LURI MUSIC 站点；
- 是否在音乐页显示博客一级导航；
- 是否显示 Provider 开发者文档；
- 音乐功能是否需要登录和有效访问权限。

博客与 LURI MUSIC 的站点开关相互独立。博客关闭时，`/music`、`/docs` 和 `/admin` 不受影响；LURI MUSIC 关闭时，博客仍可正常访问。“在博客导航显示 MUSIC”和“在音乐页显示博客导航”只控制两个站点之间的入口展示，不会改变对应站点的路由开关。

## 文章管理

文章位于 `src/posts/`，文件名格式为：

```text
YYYY-MM-DD-slug.md
```

文章 front matter 示例：

```yaml
---
title: 文章标题
date: 2026-09-21
tags: [开发, 随笔]
excerpt: 文章摘要
---
```

Vite 插件 `plugins/vite-plugin-posts.js` 会在构建时解析文章，并生成列表和详情页面所需的虚拟模块。

## 部署

项目通过 Cloudflare Worker 承载静态资源与 API：

```bash
npm run build
npx wrangler deploy
```

部署前请确认：

- `wrangler.toml` 中 D1 database ID 正确；
- 所有数据库迁移已经应用；
- Worker Secrets 已配置；
- `dist/` 已由最新代码构建。

## 目录结构

```text
docs/                         部署说明与 Provider 协议文档
functions/luri-music/         账号、后台与 Provider 配置 API
migrations/                   Cloudflare D1 数据库迁移
plugins/                      Vite Markdown 文章插件
public/                       公共静态资源
src/components/               博客通用组件
src/luri-music/               LURI MUSIC 与管理后台界面
src/pages/                    博客、播放器和文档页面
src/posts/                    Markdown 文章
worker.js                     Cloudflare Worker 入口与路由控制
wrangler.toml                 Cloudflare 部署配置
```

## License

MIT
