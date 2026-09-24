# 目录和歌曲接口

- `GET /v1/catalog/search?q=&page=&limit=` 返回 `{ tracks, page, hasMore }`。
- `GET /v1/catalog/random` 返回 `{ singer?, tracks }`。
- `GET /v1/catalog/charts?platform=&chart=&refresh=` 返回 `{ platform, chart, title, updatedAt, tracks }`。
- `POST /v1/tracks/resolve` 接收 `{ songId, title, artist, quality?, binding, refresh? }`，返回 `{ url, expiresIn?, quality?, binding? }`。
- `GET /v1/tracks/{id}/lyrics` 接收曲目信息和序列化的 `binding`，返回 `{ lyrics, translation? }`。
- `GET /v1/tracks/{id}/artwork` 接收与歌词接口相同的定位信息，返回 `{ url }`。

Track 至少包含 `id`、`title`、`artist` 和 `binding`，可包含 `album`、`duration`、`art` 与 `year`。`id` 是 Provider 返回的稳定曲目标识；`binding` 包含必填的 `source`、`sourceId` 以及可选的 `meta`、`art`。其中 `meta` 是 Provider 自定义的可序列化上下文，客户端不解释其内容，只负责保存并在后续请求中原样回传。

榜单的平台和榜单标识由 Provider 定义。榜单 Track 可额外包含从 1 开始的 `rank`；`refresh=1` 表示用户主动请求刷新，Provider 可以限制强制刷新频率。

客户端按 Provider 配置、平台和榜单类型分别持久缓存成功响应，不自动过期或后台刷新。刷新失败时必须保留旧缓存；只有点击榜单歌曲时，完整榜单才成为当前播放队列。
