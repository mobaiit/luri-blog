# Music Provider Protocol 1.0

Music Provider Protocol（MPP）是 LURI MUSIC 与独立音乐 Provider 之间的开放 JSON/HTTP 协议。客户端不加载远程 JavaScript，也不预置 Provider；用户可以连接官方源、HTTPS 私有源，按需配置 API Key、Authorization 或一次性激活码。

Provider 可以用于连接私有音乐库、机构授权曲库、开放许可内容、播客或广播目录，以及开发测试服务。协议兼容只表示技术格式兼容，不代表 LURI MUSIC 对服务或内容进行审核、推荐或授权。

发现入口为 `/.well-known/music-provider.json`。Provider 必须声明协议版本、认证方式、能力、播放模式以及各端点。1.x 客户端必须忽略未知字段，Provider 不得在兼容更新中删除已有字段或改变其含义。

协议模块：

- [发现与校验](discovery.md)
- [Provider 认证](authentication.md)
- [能力与播放](capabilities.md)
- [歌曲身份规则](identity.md)
- [目录接口](catalog.md)
- [错误、CORS 与安全](security.md)
- [隐私与版本](privacy.md)

面向用户和开发者的完整网页文档位于：`https://luri.cc.cd/docs`。

参考 Provider 地址和访问凭证不属于协议文档，也不得写入客户端源码。
