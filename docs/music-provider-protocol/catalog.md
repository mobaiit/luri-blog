# 目录和歌曲接口

- `GET /v1/catalog/search?q=&page=&limit=` 返回 `{ tracks, page, hasMore }`。
- `GET /v1/catalog/random` 返回 `{ singer?, tracks }`。
- `GET /v1/catalog/charts?platform=&chart=&refresh=` 返回 `{ platform, chart, title, updatedAt, tracks }`。
- `POST /v1/tracks/resolve` 接收 `{ id, source, meta?, quality? }`，返回 `{ url, expiresIn?, quality? }`。
- `GET /v1/tracks/{id}/lyrics?source=&meta=` 返回 `{ lyrics, translation? }`。
- `GET /v1/tracks/{id}/artwork?source=&meta=` 返回 `{ url }`。

Track 至少包含 `id`、`source`、`title`，可包含 `artist`、`album`、`duration`、`art` 和不透明 `meta`。客户端不得推断或改写 Provider 内部歌曲 ID。

榜单平台标识为 `netease` 或 `qq`；榜单类型为 `rising`、`new`、`original` 或 `hot`。榜单 Track 额外包含从 1 开始的 `rank`。`refresh=1` 仅用于用户主动刷新，Provider 应限制强制刷新频率。

客户端按 Provider 配置、平台和榜单类型分别持久缓存成功响应，不自动过期或后台刷新。刷新失败时必须保留旧缓存；只有点击榜单歌曲时，完整榜单才成为当前播放队列。
