---
title: 给博客接入留言系统
date: 2026-08-28
tags: [技术, 建站]
excerpt: 折腾了一上午，给博客接入了两套留言系统。一套给有 GitHub 账号的技术读者，一套给所有人。中间踩了几个坑，记录一下。
---

这个博客一直是纯静态的，没有任何后端，文章写完推到 GitHub，Cloudflare Pages 自动构建部署。干净，快，没有任何运维成本。

但没有留言区一直是个遗憾。

有时候写完一篇东西，不确定有没有人读到，也不知道读到的人有什么想法。单向输出久了，会有一种奇怪的封闭感——你在对着空气说话，也不知道声音有没有传出去。

所以这次决定把留言系统接进来。

---

## 选型

静态博客接留言，主要有两类方案。

**第一类：基于 GitHub 的方案**

[Giscus](https://giscus.app) 和 Utterances 都属于这类。留言数据存在 GitHub 仓库的 Discussions 或 Issues 里，评论者需要有 GitHub 账号。

对我来说，读者里有相当一部分是开发者，GitHub 账号不是门槛。数据完全自己控制，不依赖任何第三方服务，零后端。

**第二类：独立评论服务**

[Waline](https://waline.js.org) 是这类里我最看好的一个。开源，支持匿名留言，有管理后台，数据存在自己选择的数据库里。服务端部署到 Vercel 免费层，数据库用 Neon PostgreSQL，全程零成本。

最后决定两套都接，用 tab 切换——Giscus 面向有 GitHub 账号的读者，Waline 面向所有人。

---

## Giscus 接入

Giscus 是最简单的部分，基本没有什么坑。

1. 在 GitHub 仓库开启 Discussions 功能
2. 安装 [Giscus App](https://github.com/apps/giscus)，授权访问仓库
3. 在 [giscus.app](https://giscus.app/zh-CN) 填入仓库信息，生成配置参数
4. 安装 `@giscus/react`，三行代码接进去

```bash
npm install @giscus/react
```

```jsx
import Giscus from '@giscus/react';

<Giscus
  repo="username/repo"
  repoId="R_xxx"
  category="Ideas"
  categoryId="DIC_xxx"
  mapping="pathname"
  theme="preferred_color_scheme"
  lang="zh-CN"
/>
```

用 `mapping="pathname"` 让每篇文章对应自己的 Discussion 帖子，`theme="preferred_color_scheme"` 自动跟随系统深浅色。

---

## Waline 接入

Waline 的接入分两步：部署服务端，接入前端。

**服务端**

Waline 官方提供了 Vercel 一键部署。进入 Vercel，基于官方模板新建项目，在 Storage 里创建 Neon 数据库，执行建表 SQL，Redeploy 让数据库生效。整个过程大概十分钟。

部署完后访问 `/ui/register` 注册管理员账号，后台就可以管理所有留言了。

**前端**

```bash
npm install @waline/client
```

```jsx
import { init } from '@waline/client';
import '@waline/client/style';

const instance = init({
  el: containerRef.current,
  serverURL: 'https://your-waline-server.vercel.app',
  lang: 'zh-CN',
  emoji: false,
});
```

---

## 踩的坑

### CORS 问题

接好之后发现留言提交一直报错：

```
Access to fetch has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
Redirect is not allowed for a preflight request.
```

关键线索是 `302 (Found)`——请求还没到 Waline，就被 Vercel 重定向了。Vercel 默认会把不带尾部斜杠的 URL 做 302 跳转，CORS 预检请求（OPTIONS）遇到重定向直接失败。

试过在 Vercel 环境变量里加 `ALLOWED_ORIGINS`，没用，因为请求根本没有到达 Waline 的处理逻辑。

**解决方案**：给 Waline 服务绑一个自定义子域名。

在 Cloudflare DNS 里加一条 CNAME 记录，把 `comments.luri.cc.cd` 指向 `cname.vercel-dns.com`，然后在 Vercel 项目里绑定这个域名。绑好之后 Vercel 不会对自定义域名做这种跳转，CORS 问题彻底消失。

```
前端 serverURL: https://comments.luri.cc.cd
```

### Waline 样式覆盖

Waline 默认样式是绿色主题、圆角边框、虚线分隔，和这个博客的黑白极简风格完全不搭。

覆盖 Waline 样式有几个坑：

- 官方文档里提到的 `customCSS` 选项在 v3 版本里根本不生效，字符串只是被当成 HTML 属性写到 DOM 上，不会注入任何 `<style>`
- 直接写 CSS 类选择器经常被 Waline 自带的样式覆盖，优先级不够
- `.wl-editor` 原始样式有 `width: calc(100% - 1em)` 和 `margin: .75em .5em`，如果只覆盖边框不处理这两个属性，边框拼接会有缝隙

最终方案是给容器加一个固定 ID，用 ID 选择器提升优先级：

```css
#waline-container .wl-editor {
  width: 100% !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  border: 1px solid #111 !important;
  border-bottom: none !important;
  border-radius: 0 !important;
}
```

---

## 结果

现在这篇文章底部就有留言区。

两个 tab，「匿名留言」用 Waline，填昵称就能发，邮箱可选；「GitHub 讨论」用 Giscus，留言数据直接进仓库 Discussions。

运行成本：零。Vercel 免费层每月 100GB 带宽，Neon 免费层 1GB 存储，博客量级连边都碰不到。

折腾这些的时间成本比运行成本高多了，但至少以后有人想留言，可以留了。