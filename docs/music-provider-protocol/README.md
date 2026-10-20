# Music Provider Protocol 1.0

Music Provider Protocol（MPP）是 LURI MUSIC 与独立音乐 Provider 之间的开放 JSON/HTTP 协议。它只规定客户端如何发现 Provider、发送请求以及解释响应，不规定 Provider 如何验证请求、管理用户或组织自身业务。

客户端不加载远程 JavaScript，也不理解连接配置中 URL 参数、Header 或 Cookie 的业务含义。官方 Provider 与第三方 Provider 使用同一协议；区别仅在于连接配置是由系统预置还是由用户提供。

发现入口为 `/.well-known/music-provider.json`。Provider 必须声明协议版本、能力、播放模式和端点，也可以返回一个可选的纯文本展示区块。1.0 客户端必须忽略未知字段。

协议模块：

- [发现与校验](discovery.md)
- [连接配置](authentication.md)
- [能力与播放](capabilities.md)
- [歌曲身份规则](identity.md)
- [目录接口](catalog.md)
- [错误、CORS 与安全](security.md)
- [隐私与版本](privacy.md)

面向用户和开发者的完整网页文档位于：`https://luri.cc.cd/docs`。

Provider 地址、Header 值和 Cookie 均属于具体连接配置，不属于协议文档，也不得写入客户端源码。
