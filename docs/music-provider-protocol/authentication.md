# Provider 认证

LURI MUSIC 1.x 支持 `none`、`api_key` 和 `activation_code`。官方源与 HTTPS 私有源可以不使用认证，也可以配置 API Key 或 Authorization；激活码用于一次性领取独立授权。

## 无认证

Provider 在 `authentication.types` 中声明 `none`。客户端不会发送认证请求头。

## API Key 与 Authorization

Provider 在 `authentication.types` 中声明 `api_key`。用户可以选择 API Key 或 Authorization，并配置请求头与前缀。推荐由 Provider 通过 `authentication.apiKey.header` 和 `authentication.apiKey.prefix` 声明默认值；客户端不得使用 Cookie、Host、Origin、Referer 等受限请求头，也不得在 URL 中传输凭证。

## 激活码

`POST /v1/auth/activate` 接收 `activationCode`、`idempotencyKey` 和 `clientAccount`。其中 `clientAccount.id`、`clientAccount.email` 必填，供 Provider 后台记录兑换用户。首次成功请求创建独立授权，将激活码标记为已使用，并返回短期 `accessToken`、长期 `refreshToken`、过期时间和账号摘要。

- 相同激活码和相同 `idempotencyKey` 的重试属于同一次激活，Provider 重新签发凭证。
- 已使用激活码配合新的 `idempotencyKey` 返回 `409 activation_code_used`。
- `clientAccount` 仅供 Provider 后台展示和审计，不是可验证的用户身份凭证。

`POST /v1/auth/refresh` 使用 refresh token 获取短期 access token。`POST /v1/auth/revoke` 撤销当前账号级凭证。`GET /v1/account` 返回权限状态、有效期与额度。

Access token 建议 15 分钟内有效；refresh token 必须使用高熵随机值，Provider 只保存摘要。LURI MUSIC 服务端使用 AES-GCM 加密保存长期凭证并关联当前登录用户，浏览器只取得完成当前 Provider 请求所需的短期凭证。激活码明文不得持久化。
