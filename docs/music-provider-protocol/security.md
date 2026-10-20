# 错误、CORS 与安全

错误响应统一为：

```json
{ "error": { "code": "invalid_request", "message": "Human-readable message" } }
```

通用错误码为 `invalid_request`、`access_denied`、`not_supported`、`not_found`、`method_not_allowed`、`rate_limited`、`upstream_unavailable` 和 `provider_timeout`。播放解析还可以使用 `no_candidate`、`all_resolvers_failed`、`quality_unavailable` 和 `upstream_timeout`。

常用状态码：400 参数错误，401 或 403 Provider 拒绝请求，404 资源不存在，405 方法不允许，429 限流，502 上游不可用，504 超时。客户端只展示 Provider 返回的信息，不推断 Provider 的验证规则。

发现、health、terms、privacy、目录、歌词和封面使用 `GET`；播放解析使用 `POST`；CORS 预检使用 `OPTIONS`。已知端点收到错误方法时必须返回 HTTP 405、`Allow` 响应头和标准错误结构。

Provider 必须为允许的客户端 Origin 配置 CORS。使用自定义 Header 时，应在 `Access-Control-Allow-Headers` 中明确列出；使用 Cookie 时，还必须返回 `Access-Control-Allow-Credentials: true`，且 `Access-Control-Allow-Origin` 不能为 `*`。

连接配置可能包含敏感值。客户端和 Provider 不得在日志、分析数据、错误消息或界面摘要中输出完整 URL、Header 值、Cookie 或完整播放 URL。保存连接配置时应加密敏感字段，列表展示时应隐藏 URL 查询参数。

协议端点必须同源，避免连接配置被发送到其他主机。客户端必须限制请求大小、超时和重试次数，并拒绝非 HTTPS 地址、重定向、受限 Header、HTML 与远程脚本。
