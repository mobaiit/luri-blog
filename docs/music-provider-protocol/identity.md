# 歌曲身份规则

Music Provider Protocol 1.0 使用歌曲原始名称与原始歌手名称生成跨 Provider 一致的 `songId`：

```text
songId = lowercaseHex(MD5(UTF8(JSON.stringify([String(title || ''), String(artist || '')]))))
```

规则要求：

- `title` 和 `artist` 必须是 Track 响应中的原始字符串。
- 计算前不得 trim、折叠或替换空格，不得转换大小写，也不得执行 Unicode 归一化。
- JSON 必须是无额外空格的两元素数组，顺序固定为 `[title, artist]`。
- MD5 输入是该 JSON 字符串的 UTF-8 字节，输出必须是 32 位小写十六进制字符串。
- 搜索、随机推荐和榜单返回的每个 Track 都必须提供符合该规则的 `id`。不符合规则的 Provider 不兼容本协议。

例如：

```text
title  = "Track title"
artist = "Artist"
JSON   = ["Track title","Artist"]
id     = 2725dfd72d4bdd075e2ddaebc49c7224
```

`songId` 只定义歌曲身份，不替代 Provider 的资源定位信息。Track 和所有单曲接口统一使用 `songId`，不得再使用通用字段名 `id`。客户端调用播放解析、歌词和封面接口时，必须同时发送：

- `songId`；
- 原始 `title` 和 `artist`；
- 原始 `album`，未知时发送空字符串；
- 当前 Track 的 `binding`。

Provider 可以优先使用 `binding` 定位资源，也可以使用歌曲名称、歌手和专辑重新检索或消歧。切换 Provider 后，`songId` 保持不变，新 Provider 可以返回新的 `binding`。
