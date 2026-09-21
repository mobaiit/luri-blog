# 能力与播放

标准能力：`search`、`random`、`lyrics`、`artwork`、`playback`、`qualities`。客户端只显示 Provider 声明的能力。

播放模式：

- `direct`：Provider 返回有时效的 HTTPS 音频地址，音频字节不经过客户端后端。
- `external`：返回由外部应用或网页打开的地址。
- `sdk`：由双方明确支持的本地 SDK 处理；协议禁止从 Provider 下载并执行 JavaScript。

歌曲本地键必须包含 Provider 配置 ID，以隔离不同 Provider 的收藏、历史和队列。
