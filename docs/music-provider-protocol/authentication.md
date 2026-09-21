# 认证与设备

通用认证类型为 `none`、`api_key`、`activation_code`、`oauth2_pkce` 和 `bearer_token`。当前客户端实现 `activation_code + bearer_token`。

`POST /v1/auth/activate` 接收 `activationCode`、`deviceId`、`deviceName`，成功后返回短期 `accessToken`、长期 `refreshToken`、过期时间及账户摘要。激活码仅用于 Provider 权限核销，不是播放器激活码。

`POST /v1/auth/refresh` 使用 refresh token 获取短期 access token。`POST /v1/auth/revoke` 撤销当前会话。`GET /v1/account` 返回权限状态、有效期、额度与设备列表。

Access token 建议 15 分钟有效；refresh token 必须使用高熵随机值，服务端只保存摘要。客户端服务端应加密保存长期凭证，浏览器只持有短期令牌。
