# 认证与设备

协议预留 `none`、`api_key`、`activation_code`、`oauth2_pkce` 和 `bearer_token`。LURI MUSIC 1.x 当前支持以下三种 Provider 连接方式：

- `activation_code`：适合订阅服务、设备授权和具有有效期的账号。
- `api_key`：适合自建服务、机构接口和开发者平台。
- `none`：适合开放版权曲库、公共广播、播客目录或无需认证的服务。

## 授权码模式

`POST /v1/auth/activate` 接收 `activationCode`、`deviceId`、`deviceName`，成功后返回短期 `accessToken`、长期 `refreshToken`、过期时间和账号摘要。授权码只用于 Provider 权限核销，不是播放器激活码。

`POST /v1/auth/refresh` 使用 refresh token 获取短期 access token。`POST /v1/auth/revoke` 撤销当前会话。`GET /v1/account` 返回权限状态、有效期、额度与设备列表。

## API Key 模式

发现文件必须在 `authentication.types` 中声明 `api_key`，可使用 `authentication.apiKey.header` 和 `authentication.apiKey.prefix` 指定请求格式：

```json
{
  "authentication": {
    "types": ["api_key"],
    "apiKey": { "header": "X-API-Key", "prefix": "" }
  }
}
```

推荐使用 `Authorization: Bearer <key>` 或 `X-API-Key: <key>`。不得使用 Cookie、Host、Origin 等受限请求头，不得把密钥放在 URL 查询参数中。

## 公开模式

公开 Provider 在 `authentication.types` 中声明 `none`，客户端不会发送认证凭证。公开访问不改变内容的版权或许可状态，Provider 仍需提供服务条款、隐私政策和内容许可说明。

Access token 建议 15 分钟内有效；refresh token 必须使用高熵随机值，服务端只保存摘要。LURI MUSIC 服务端使用 AES-GCM 加密保存长期凭证，浏览器只取得完成当前 Provider 请求所需的短期凭证。
