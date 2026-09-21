# 目录和歌曲接口

- `GET /v1/catalog/search?q=&page=&limit=` 返回 `{ tracks, page, hasMore }`。
- `GET /v1/catalog/random` 返回 `{ singer?, tracks }`。
- `POST /v1/tracks/resolve` 接收 `{ id, source, meta?, quality? }`，返回 `{ url, expiresIn?, quality? }`。
- `GET /v1/tracks/{id}/lyrics?source=&meta=` 返回 `{ lyrics, translation? }`。
- `GET /v1/tracks/{id}/artwork?source=&meta=` 返回 `{ url }`。

Track 至少包含 `id`、`source`、`title`，可包含 `artist`、`album`、`duration`、`art` 和不透明 `meta`。客户端不得推断或改写 Provider 内部歌曲 ID。
