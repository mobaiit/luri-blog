# 发现与校验

客户端请求 `GET /.well-known/music-provider.json`，响应类型为 `application/json`。

```json
{
  "protocol": "music-provider",
  "protocolVersion": "1.0",
  "provider": { "id": "example", "name": "Example Provider", "homepage": "https://provider.example" },
  "authentication": { "types": ["activation_code", "bearer_token"], "accessTokenSeconds": 900 },
  "capabilities": ["search", "random", "lyrics", "artwork", "playback", "qualities"],
  "playback": { "mode": "direct", "qualities": ["320k"] },
  "endpoints": {}
}
```

端点必须为 HTTPS，并与发现地址同源。客户端拒绝跳转、包含账号密码的 URL、远程脚本及不受支持的主版本。
