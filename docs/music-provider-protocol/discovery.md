# 发现与校验

客户端根据连接配置构造发现地址，并请求 `/.well-known/music-provider.json`。连接 URL 自带的查询参数、静态 Header 和 `credentials` 策略必须同时应用到发现请求。

Provider 必须直接返回 HTTP 200 和 `application/json`，不得通过 3xx 重定向提供发现结果。

```json
{
  "protocol": "music-provider",
  "protocolVersion": "1.0",
  "provider": {
    "id": "example",
    "name": "Example Provider",
    "homepage": "https://provider.example"
  },
  "capabilities": ["search", "random", "charts", "lyrics", "artwork", "playback", "qualities"],
  "playback": {
    "mode": "direct",
    "qualities": ["128k", "320k", "flac"]
  },
  "presentation": {
    "title": "服务状态",
    "badge": { "text": "可用", "tone": "positive" },
    "description": "当前连接可以正常使用",
    "items": [{ "label": "有效时间", "value": "2027年10月20日" }],
    "notice": "信息由 Provider 提供"
  },
  "endpoints": {
    "terms": "https://provider.example/terms",
    "privacy": "https://provider.example/privacy",
    "search": "https://provider.example/v1/catalog/search",
    "random": "https://provider.example/v1/catalog/random",
    "charts": "https://provider.example/v1/catalog/charts",
    "resolve": "https://provider.example/v1/tracks/resolve",
    "lyrics": "https://provider.example/v1/tracks/{songId}/lyrics",
    "artwork": "https://provider.example/v1/tracks/{songId}/artwork"
  }
}
```

`protocol` 固定为 `music-provider`，`protocolVersion` 固定为 `1.0`。`provider.id` 必须稳定；`provider.name` 用于展示；`provider.homepage` 可选。

标准能力为 `search`、`random`、`charts`、`lyrics`、`artwork`、`playback` 和 `qualities`。声明能力时必须同时提供对应端点；声明 `playback` 时必须提供 `playback.mode: "direct"` 和 `resolve` 端点。歌词和封面 URL 模板使用 `{songId}` 占位符。

所有协议端点必须使用 HTTPS、与发现地址同源并直接返回最终响应。客户端拒绝跳转、包含 URL 用户名或密码的地址、远程脚本及不受支持的版本。

## 可选展示区块

`presentation` 仅用于固定渲染，所有字段均为纯文本：

- `title`、`description`、`notice`：可选字符串；
- `badge.text`：可选状态文字；
- `badge.tone`：可选值 `neutral`、`positive`、`warning`、`negative`；
- `items`：最多 12 个 `{ label, value }`，顺序由 Provider 决定。

客户端不得解析其内容、计算日期、判断权限或根据它启停功能。字段不存在时隐藏对应元素；`presentation` 不存在时隐藏整个区块。实际能力以 `capabilities` 和各接口响应为准。
