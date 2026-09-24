# 能力与播放

标准能力：`search`、`random`、`charts`、`lyrics`、`artwork`、`playback`、`qualities`。Provider 只能声明已经实现并提供对应端点的能力，客户端只显示当前 Provider 声明的功能。

Music Provider Protocol 1.0 支持 `direct` 播放模式：Provider 的 resolve 接口返回短期 HTTPS 音频地址，音频字节由浏览器直接访问，不经过 LURI MUSIC 后端。地址可以为空字符串，表示本次未取得可播放资源；非空地址建议支持 Range 请求。

客户端可以按 Provider 配置隔离播放队列、榜单和短期资源缓存。Provider 的数据源、解析脚本、缓存策略及内部存储不属于协议范围。所有 Provider 请求的客户端超时为 30 秒。
