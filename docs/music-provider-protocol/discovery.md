# 发现与校验

客户端使用 `GET /.well-known/music-provider.json` 读取公开发现文件。Provider 必须直接返回 HTTP 200 和 `application/json`，不得通过 3xx 重定向提供发现结果。

```json
{
  "protocol": "music-provider",
  "protocolVersion": "1.0",
  "provider": {
    "id": "example",
    "name": "Example Provider",
    "homepage": "https://provider.example"
  },
  "authentication": {
    "types": ["activation_code", "bearer_token"],
    "accessTokenSeconds": 900
  },
  "capabilities": ["search", "random", "charts", "lyrics", "artwork", "playback", "qualities"],
  "playback": {
    "mode": "direct",
    "qualities": ["128k", "320k", "flac"]
  },
  "endpoints": {
    "terms": "https://provider.example/terms",
    "privacy": "https://provider.example/privacy",
    "activate": "https://provider.example/v1/auth/activate",
    "refresh": "https://provider.example/v1/auth/refresh",
    "revoke": "https://provider.example/v1/auth/revoke",
    "account": "https://provider.example/v1/account",
    "search": "https://provider.example/v1/catalog/search",
    "random": "https://provider.example/v1/catalog/random",
    "charts": "https://provider.example/v1/catalog/charts",
    "resolve": "https://provider.example/v1/tracks/resolve",
    "lyrics": "https://provider.example/v1/tracks/{songId}/lyrics",
    "artwork": "https://provider.example/v1/tracks/{songId}/artwork"
  }
}
```

`protocol` 固定为 `music-provider`，`protocolVersion` 当前为 `1.0`。`provider.id` 必须全局稳定；`provider.name` 用于展示；`provider.homepage` 可指向 Provider 官网或运营主体页面。

标准能力为 `search`、`random`、`charts`、`lyrics`、`artwork`、`playback` 和 `qualities`。声明可选能力时必须同时提供对应端点；声明 `playback` 时必须提供 `playback.mode: "direct"` 和 resolve 端点。歌词和封面 URL 模板必须使用 `{songId}` 占位符。

所有端点必须使用 HTTPS、与发现地址同源并直接返回最终响应。Provider 必须声明服务条款与隐私政策端点，公开运营主体、内容授权范围、联系方式和权利投诉渠道。客户端拒绝跳转、包含账号密码的 URL、远程脚本及不受支持的主版本。

客户端服务端在签发短期 Provider 访问凭证时应重新读取发现文件，并校验 `provider.id` 与已绑定 Provider 一致。发现成功后使用并保存最新端点和能力；临时发现失败时可以回退已验证的本地快照，避免短暂网络故障中断已有能力。
