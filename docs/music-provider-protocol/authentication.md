# 连接配置

连接配置描述客户端如何向 Provider 的 `authenticate` 端点提交不透明凭据。它不是 Provider 发现文件的一部分，客户端不解释其中的业务含义。

```json
{
  "url": "https://provider.example?key=opaque-value",
  "headers": {
    "Authorization": "Bearer opaque-value",
    "X-Provider-Key": "opaque-value"
  },
  "credentials": "include"
}
```

仅 `url` 必填。`headers` 默认为空对象；`credentials` 可为 `omit`、`same-origin` 或 `include`，默认 `omit`。

客户端必须：

- 从 `url` 的 origin 公开读取 `/.well-known/music-provider.json`，不携带连接凭据；
- 仅在请求发现文件声明的 `endpoints.authenticate` 时保留 `url` 查询参数并附加静态 Header；
- 仅在 `authenticate` 请求中将 `credentials` 原样传给 Fetch API；
- 在 `authenticate` 请求体中传递 `clientAccount.id`、`clientAccount.name` 和作为唯一账号凭证的 `clientAccount.email`；
- 认证成功后，仅使用 Provider 返回的短期 Bearer Token 请求其他协议端点；
- 不解析、不转换、不刷新任何配置值；
- 不允许配置浏览器禁止脚本设置的 Header，例如 `Cookie`、`Host`、`Origin`、`Referer` 和 `User-Agent`。

Cookie 只能由浏览器管理。`credentials: "include"` 表示允许浏览器按自身策略携带 Provider 已设置的 Cookie，并不允许客户端手工构造 `Cookie` Header。

认证请求格式：

```json
{
  "clientAccount": {
    "id": "local-account-id",
    "name": "Display name",
    "email": "user@example.com"
  }
}
```

认证成功响应：

```json
{
  "accessToken": "short-lived-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "presentation": {}
}
```

`accessToken`、`tokenType` 和 `expiresIn` 必填；`tokenType` 在协议 1.0 中固定为 `Bearer`。`presentation` 可选并遵循发现协议中的通用展示模型。Provider 可以使用 URL、Header、Cookie 或其任意组合作为认证依据，具体验证规则由 Provider 服务端决定。

高级 JSON 配置必须符合上述结构，不允许脚本、动态表达式、请求钩子或自定义签名代码。需要动态签名的服务应在 Provider 服务端完成签名，并向客户端暴露普通的 MPP 入口。
