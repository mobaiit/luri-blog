# 发现与校验

客户端请求 `GET /.well-known/music-provider.json`，响应类型为 `application/json`。

```json
{
  "protocol": "music-provider",
  "protocolVersion": "1.0",
  "provider": { "id": "example", "name": "Example Provider", "homepage": "https://provider.example" },
  "authentication": { "types": ["activation_code", "bearer_token"], "accessTokenSeconds": 900 },
  "capabilities": ["search", "random", "charts", "lyrics", "artwork", "playback", "qualities"],
  "playback": { "mode": "direct", "qualities": ["320k"] },
  "endpoints": {
    "terms": "https://provider.example/terms",
    "privacy": "https://provider.example/privacy",
    "charts": "https://provider.example/v1/catalog/charts"
  }
}
```

端点必须为 HTTPS，并与发现地址同源。Provider 必须声明服务条款与隐私政策端点，公开运营主体、内容授权范围、联系方式和权利投诉渠道。声明 `charts` 能力时应提供榜单端点；兼容旧版清单时客户端可以尝试同源默认路径 `/v1/catalog/charts`。客户端拒绝跳转、包含账号密码的 URL、远程脚本及不受支持的主版本。
