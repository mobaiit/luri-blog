# 目录和单曲接口

## 统一 Track 模型

搜索、随机推荐、榜单、收藏、播放队列以及所有单曲接口必须使用同一组歌曲字段：

```json
{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "title": "Track title",
  "artist": "Artist",
  "album": "Album",
  "duration": 240,
  "art": "https://provider.example/artwork/track-001",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": "https://provider.example/artwork/track-001"
  }
}
```

- `songId`、`title`、`artist`、`album` 和 `binding` 必填。`album` 未知时必须传空字符串，不得省略。
- `songId` 必须按[歌曲身份规则](identity.md)生成。协议不再使用 `id` 表示歌曲身份。
- `duration` 为可选的音频秒数；`art` 为可选的当前展示封面 URL。
- Track 顶层不得重复返回 `source` 或 `sourceId`，资源定位信息只存在于 `binding`。
- 榜单 Track 可以额外包含从 1 开始的 `rank`。

## Binding 模型

`binding` 在 Track 和所有单曲请求中强制必填，固定结构为：

```json
{
  "source": "netease",
  "sourceId": "1901371647",
  "meta": {},
  "art": ""
}
```

- `source`：必填、非空字符串，标识歌曲所在的音乐平台或 API 服务。
- `sourceId`：必填、非空字符串，是该 `source` 内部的歌曲标识；客户端将其视为不透明字符串，不执行数值转换或格式改写。
- `meta`：必填 JSON object，可以为空对象；不得为数组、字符串、数字或 `null`。Provider 自行定义内部字段，客户端不解释内容并在后续请求中原样回传。
- `art`：必填字符串，可以为空。它是该绑定携带的封面资源提示；Provider 的封面解析层无法产生新地址时可以回退使用它。它不参与歌曲身份或 binding 唯一性判断。

`songId` 用于缓存、收藏和跨 Provider 去重；`binding` 只描述当前已知的上游资源位置。切换 Provider 后，客户端继续传递现有 binding；Provider 可以直接使用能够识别的 binding，也可以根据原始 `title`、`artist` 和 `album` 重新检索，并在响应中返回替换后的 binding。

## 接口

- `GET /v1/catalog/search?q=&page=&limit=` 返回 `{ tracks, page, hasMore }`。
- `GET /v1/catalog/random` 返回 `{ singer?, tracks }`。
- `GET /v1/catalog/charts?platform=&chart=&refresh=` 返回 `{ platform, chart, title, updatedAt, tracks }`。
- `POST /v1/tracks/resolve` 接收 `{ songId, title, artist, album, binding, quality?, refresh? }`。
- `GET /v1/tracks/{songId}/lyrics?title=&artist=&album=&binding=` 接收统一单曲上下文，返回 `{ songId, lyrics, translation?, binding? }`。
- `GET /v1/tracks/{songId}/artwork?title=&artist=&album=&binding=` 接收统一单曲上下文，返回 `{ songId, url, binding? }`。

`resolve` 请求体中的 `songId`、`title`、`artist`、`album` 和 `binding` 必须与 Track 原样一致。歌词和封面接口将 `songId` 放在路径中，并将 binding 序列化为 JSON 查询参数；其他字段的要求相同。

`resolve` 成功响应中的 `url` 字段必填但允许为空字符串：

```json
{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "url": "",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": ""
  },
  "expiresIn": 0
}
```

HTTP 200 且 `url: ""` 表示本次没有取得可播放地址，不属于协议错误。客户端不会区分上游的具体不可用原因：没有 URL 时不得尝试媒体播放，并可以使用 `refresh: true` 强制重新解析一次；URL 播放失败时，客户端丢弃旧 URL，使用 `refresh: true` 重新解析并重试一次。每次用户播放操作最多执行一次强制刷新，禁止无限重试。

榜单的平台和榜单标识由 Provider 定义。`refresh=1` 表示用户主动请求刷新，Provider 可以限制强制刷新频率。客户端按 Provider 配置、平台和榜单类型分别持久缓存成功响应；刷新失败时必须保留旧缓存。

客户端对 Provider 请求设置 30 秒超时；Provider 应在超时前返回结果或明确的错误响应。
