# 连接配置

连接配置描述客户端如何发送 Provider 请求。它不是 Provider 发现文件的一部分，也不表达任何业务身份或验证流程。

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

- 将 `url` 视为不透明的 HTTPS 地址，保留其路径和查询参数；
- 将配置的静态 Header 附加到发现请求和所有协议请求；
- 将 `credentials` 原样传给 Fetch API；
- 在所有请求中保留连接 URL 自带的查询参数；
- 不解析、不转换、不刷新任何配置值；
- 不允许配置浏览器禁止脚本设置的 Header，例如 `Cookie`、`Host`、`Origin`、`Referer` 和 `User-Agent`。

Cookie 只能由浏览器管理。`credentials: "include"` 表示允许浏览器按自身策略携带 Provider 已设置的 Cookie，并不允许客户端手工构造 `Cookie` Header。

Provider 可以使用 URL、Header、Cookie 或其任意组合作为服务端验证依据。验证规则完全由 Provider 决定，不属于本协议。

高级 JSON 配置必须符合上述结构，不允许脚本、动态表达式、请求钩子或自定义签名代码。需要动态签名的服务应在 Provider 服务端完成签名，并向客户端暴露普通的 MPP 入口。
