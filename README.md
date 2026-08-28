# LURI - 落墨留白 · 个人网站

> 用文字记录思考，以代码构建世界。

简约黑白风格的个人网站，基于 React + Vite 构建，无后端依赖，支持静态部署。

在线演示地址：https://luri.cc.cd
---

## 预览

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | Hero 全屏展示 + 入口导航 |
| 关于 | `/about` | 个人介绍、技能标签 |
| 作品 | `/works` | 项目卡片网格 |
| 随笔 | `/blog` | 文章列表（日期 + 摘要） |

---

## 技术栈

- **React 18** — UI 框架
- **Vite** — 构建工具 / 开发服务器
- **React Router v6** — 客户端路由
- **原生 CSS** — 无 CSS 框架，CSS 变量实现主题管理
- **Google Fonts** — Noto Serif SC 字体

---

## 项目结构

```
src/
├── styles/
│   └── variables.css        # 全局 CSS 变量（颜色、字体、间距）
├── components/
│   ├── Navbar.jsx / .css    # 顶部导航（固定 + 移动端汉堡菜单）
│   └── Footer.jsx / .css    # 页脚（版权 + 社交链接）
├── pages/
│   ├── Home.jsx  / .css     # 首页 Hero 区块
│   ├── About.jsx / .css     # 关于我
│   ├── Works.jsx / .css     # 作品集
│   └── Blog.jsx  / .css     # 随笔列表
├── index.css                # 全局 reset / 排版 / 工具类
├── App.jsx                  # 路由组装
└── main.jsx                 # 应用入口
```

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
| `src/pages/Works.jsx` | 作品列表（标题、描述、标签、链接） |
| `src/pages/Blog.jsx` | 文章列表（日期、标题、摘要、标签） |
| `src/components/Footer.jsx` | 版权信息、社交链接 |
| `src/components/Navbar.jsx` | 导航项名称与路由 |

### 修改主题颜色

所有设计变量集中在 `src/styles/variables.css`，修改后全站自动生效：

```css
:root {
  --color-bg:        #ffffff;  /* 页面背景 */
  --color-bg-alt:    #f5f5f5;  /* 次级背景 */
  --color-text:      #111111;  /* 主文字 */
  --color-text-muted:#666666;  /* 次级文字 */
  --color-border:    #dddddd;  /* 边框 */
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

### GitHub Pages

由于使用了 BrowserRouter，部署到 GitHub Pages 时需要添加 `404.html` 重定向，
或将路由改为 `HashRouter`（`react-router-dom` 中直接替换 `BrowserRouter` 为 `HashRouter` 即可）。

---

## License

MIT © 落墨留白
