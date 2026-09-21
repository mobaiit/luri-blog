# 错误、CORS 与安全

错误响应统一为：

```json
{ "error": { "code": "invalid_request", "message": "Human-readable message" } }
```

常用状态码：400 参数错误，401 令牌无效，403 权限不可用，404 资源不存在，409 状态冲突，429 触发限流，502 上游不可用。

Provider 应仅允许明确列入白名单的客户端 Origin，预检可缓存 86400 秒；认证和账户响应使用 `no-store`。禁止在 URL 查询参数中传递长期凭证。日志不得记录激活码、access token、refresh token 或完整播放 URL。

实现必须限制请求大小、超时、分页、重定向和 URL 协议。发现文档中的端点必须同源，防止凭证被转发到第三方主机。
