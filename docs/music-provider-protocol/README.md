# Music Provider Protocol 1.0

Music Provider Protocol（MPP）是 LURI MUSIC 与独立音乐 Provider 之间的开放 JSON/HTTP 协议。客户端不加载远程 JavaScript，也不预置 Provider；用户主动输入 HTTPS 地址并完成认证。

实现入口是 `/.well-known/music-provider.json`。Provider 必须声明协议版本、认证方式、能力、播放模式以及各端点。1.x 客户端必须忽略未知字段，Provider 不得在兼容更新中删除既有字段或改变其含义。

协议模块：

- [发现与校验](discovery.md)
- [认证与设备](authentication.md)
- [能力与播放](capabilities.md)
- [目录接口](catalog.md)
- [错误、CORS 与安全](security.md)
- [隐私与版本](privacy.md)

参考 Provider 地址和激活凭证不属于协议文档，也不得写入客户端源码。
