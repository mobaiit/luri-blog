# LURI - 落墨留白

> 用文字记录思考，以代码构建世界。

简约黑白风格的个人网站，基于 React + Vite 构建，无后端依赖，支持静态部署。

在线演示地址：https://luri.cc.cd

---

## 预览

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | Hero 全屏展示 + 入口导航 |
| 关于 | `/about` | 个人介绍、技能标签 |
| 随笔 | `/blog` | 文章列表，按年份分组，支持标签筛选 |
| 文章详情 | `/blog/:slug` | Markdown 渲染 + 阅读进度条 + 评论区 |

---

## 技术栈

- **React 19** — UI 框架
- **Vite 8** — 构建工具 / 开发服务器
- **React Router v6** — 客户端路由
- **react-markdown + remark-gfm** — Markdown 渲染（支持 GFM 表格、任务列表等）
- **gray-matter** — 解析文章 front-matter（构建时在 Node 侧运行）
- **@giscus/react** — 基于 GitHub Discussions 的评论系统
- **@waline/client** — 支持匿名留言的独立评论服务
- **原生 CSS** — 无 CSS 框架，CSS 变量实现主题管理
- **Google Fonts** — Noto Serif SC 字体

---

## 项目结构

```
plugins/
└── vite-plugin-posts.js     # 自定义 Vite 插件，将 Markdown 文章转为虚拟模块

src/
├── styles/
│   └── variables.css        # 全局 CSS 变量（颜色、字体、间距）
├── components/
│   ├── Navbar.jsx / .css    # 顶部导航（固定 + 移动端汉堡菜单）
│   ├── Footer.jsx / .css    # 页脚（版权 + 社交链接）
│   ├── Comments.jsx / .css  # 评论区（Waline 匿名 + Giscus GitHub 讨论，tab 切换）
│   ├── Cursor.jsx / .css    # 自定义鼠标指针
│   └── ScrollToTop.jsx      # 路由切换时自动滚动到顶部
├── hooks/
│   └── useReveal.js         # IntersectionObserver 滚动显现动画 Hook
├── pages/
│   ├── Home.jsx  / .css     # 首页 Hero 区块
│   ├── About.jsx / .css     # 关于我
│   ├── Blog.jsx  / .css     # 随笔列表（按年分组 + 标签筛选侧边栏）
│   └── PostDetail.jsx / .css # 文章详情（阅读进度条 + 字数 / 阅读时长 + 上下篇导航）
├── posts/                   # Markdown 文章，命名规则见下文
├── index.css                # 全局 reset / 排版 / 工具类
├── App.jsx                  # 路由组装
└── main.jsx                 # 应用入口
```

---

## 文章系统

博客文章以 Markdown 文件形式存放于 `src/posts/`，由自定义 Vite 插件 `vite-plugin-posts` 在构建时解析，通过虚拟模块注入到页面，浏览器侧无运行时开销。

### 文件命名

```
YYYY-MM-DD-slug.md
```

例如：`2026-08-28-adding-comments-to-blog.md`

### Front-matter 字段

```yaml
---
title: 文章标题          # 必填
date: 2026-08-28        # 必填，YYYY-MM-DD 格式
tags: [技术, 建站]       # 可选，用于标签筛选
excerpt: 这里是文章摘要   # 可选，显示在列表和文章头部
---

正文内容（Markdown）...
```

### 虚拟模块

插件提供两个虚拟模块供页面组件使用：

| 模块 | 内容 |
|------|------|
| `virtual:posts` | 按日期倒序的文章 meta 列表（title / date / tags / excerpt / slug） |
| `virtual:posts-map` | 以 slug 为 key 的完整文章 Map，包含 content、上一篇、下一篇信息 |

---

## 评论系统

文章详情页底部集成了两套评论系统，通过 tab 切换：

- **匿名留言**（Waline）：填昵称即可发言，服务端部署于 Vercel，数据存储在 Neon PostgreSQL，运行成本为零
- **GitHub 讨论**（Giscus）：基于仓库 Discussions，评论者需要 GitHub 账号，留言数据完全自托管

如需使用自己的评论服务，修改以下位置：

| 文件 | 修改内容 |
|------|---------|
| `src/components/Comments.jsx` | Waline `serverURL` 替换为自己的服务地址 |
| `src/components/Comments.jsx` | Giscus `repo` / `repoId` / `categoryId` 替换为自己的仓库参数 |

---

## 本地开发

**前提：** Node.js ≥ 18

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产版本
npm run build

# 本地预览构建结果
npm run preview
```

---

## 内容定制

### 修改个人信息

| 文件 | 可修改内容 |
|------|-----------|
| `src/pages/Home.jsx` | 首页标题、简介文字、按钮链接 |
| `src/pages/About.jsx` | 个人介绍段落、技能标签列表、邮箱 |
| `src/components/Footer.jsx` | 版权信息、社交链接 |
| `src/components/Navbar.jsx` | 导航项名称与路由 |

### 新增 / 修改文章

在 `src/posts/` 目录下新建符合命名规范的 `.md` 文件，保存后开发服务器会自动热更新，构建时自动打包。

### 修改主题颜色

所有设计变量集中在 `src/styles/variables.css`，修改后全站自动生效：

```css
:root {
  --color-bg:         #ffffff;  /* 页面背景 */
  --color-bg-alt:     #f5f5f5;  /* 次级背景 */
  --color-text:       #111111;  /* 主文字 */
  --color-text-muted: #666666;  /* 次级文字 */
  --color-border:     #dddddd;  /* 边框 */
}
```

---

## 部署

本项目为纯静态输出，`npm run build` 后将 `dist/` 目录部署到任意静态托管平台即可。

### Vercel

```bash
# 安装 Vercel CLI（若未安装）
npm i -g vercel

vercel --prod
```

### Netlify

将 `dist/` 目录拖拽上传至 [Netlify Drop](https://app.netlify.com/drop)，或通过 CLI：

```bash
npm i -g netlify-cli
netlify deploy --prod --dir dist
```

### GitHub Pages / Cloudflare Pages

由于使用了 BrowserRouter，部署到 GitHub Pages 时需要添加 `404.html` 重定向，或将路由改为 `HashRouter`（直接替换 `App.jsx` 中的 `BrowserRouter` 为 `HashRouter` 即可）。

Cloudflare Pages 支持 SPA 路由，无需额外处理，推荐直接使用。

---

## License

MIT © 落墨留白
