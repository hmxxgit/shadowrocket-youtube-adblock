# v1.3.1 临时诊断（默认关闭）

## 手机操作

1. 更新原 `youtube-adblock.module`，确认版本 **1.3.1**。只查看 GitHub 仓库版本不代表手机已更新。
2. 暂时关闭普通模块，导入并启用下面的诊断模块（只启用其中一个）：

   https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module

3. 对当前配置执行「使用配置」或「编译配置」以重新获取脚本（菜单随版本不同），确认既有 HTTPS 解密已开启且证书可信，使用「配置」路由模式，重连 Shadowrocket。完全退出 YouTube，再打开一个普通视频。
4. 在 Shadowrocket 的脚本日志中搜索 **`[YTAD]`**。入口名称随版本不同。仅复制这些行即可用于后续排查，不需要完整请求日志或抓包正文。
5. 完成后关闭/删除诊断模块，恢复普通模块，再编译当前配置和重连。普通模块中四条脚本均为 `argument=diagnostic=false`。

也可以在本地模块副本中将四条脚本的 `argument=diagnostic=false` 改为 `argument=diagnostic=true`；更新远程模块可能覆盖本地修改，推荐使用上面的临时模块。

## 如何判断

每行是固定前缀加 JSON，例如：

```text
[YTAD] {"version":"1.3.1","script":"response","endpoint":"player","event":"start","success":true}
[YTAD] {"version":"1.3.1","script":"response","endpoint":"player","event":"ad_fields","found":true}
[YTAD] {"version":"1.3.1","script":"response","endpoint":"player","event":"ad_cleanup","cleaned":true}
[YTAD] {"version":"1.3.1","script":"response","endpoint":"player","event":"finish","success":true,"pass":false,"reason":"none"}
```

**这是说明格式的合成示例，不是真机日志。**

- `start`：该接口对应的脚本已经开始执行；`version` 是实际执行的脚本版本。接口命中本身不等于命中了广告。
- `ad_fields found=true`：发现已有处理器认识的广告字段/结构。`false` 不证明没有广告。
- `ad_cleanup cleaned=true` 且 `finish success=true,pass=false`：已清理广告结构并返回修改后的正文；这仍不证明 App 最终不播放广告。
- `script=ump,endpoint=initplayback,event=ump_enter,entered=true`：确实进入 type-25 加密 UMP 处理分支。
- `ump_decrypt success=true`：HMAC 校验和 AES-CTR 解密成功；后续仍可能因解压/格式失败而放行。
- `ump_reencrypt success=true`：重写后重新加密和 HMAC 计算成功。最终是否提交结果以 `finish` 为准。
- `finish pass=true`：正文原样放行。`success=false` 表示处理未能成功完成，具体阶段看 `reason`。请求脚本正常保留原请求时也会 `pass=true`，不等于广告漏过。

| reason | 含义 |
| --- | --- |
| `cache_json_invalid` / `cache_shape_invalid` | 缓存 JSON 或类型损坏；cache_recovery 表示使用安全默认值继续处理，不输出内容 |
| `cache_read_failed` / `cache_write_failed` | 缓存存储读写失败，独立播放器处理继续；恢复发生在内存中，不保证修复已写入磁盘 |
| `missing_key` | 当前平台尚无可用缓存密钥，未进入解密；观察后续 config/log_event |
| `key_cached` | config/log_event 中的已有密钥结构已读取/缓存，原响应未改 |
| `config_key_unavailable` | 本次 config/log_event 没有完整已知密钥结构 |
| `key_refresh_requested` | 缺少完整密钥，移除 log_event 的 hot-hash 请求刷新 |
| `request_body_unavailable` / `request_key_absent` | 初始化请求没有可读正文或没有已知关联密钥，保留缓存 |
| `request_key_mismatch` | 请求携带的关联密钥与缓存不匹配，清除该平台缓存 |
| `request_invalid` | 请求正文无法按已有结构解析，保留缓存 |
| `request_unchanged` | 初始化/日志请求正常原样保留 |
| `hmac_failed` | 校验失败；未尝试修改明文，清除该平台缓存等待刷新 |
| `crypto_failed` / `invalid_key` | 加密处理失败或缓存编码/长度不可用 |
| `compression_unsupported` | 当前实现不支持该压缩类型（例如 Brotli），保留缓存并放行 |
| `decompression_failed` / `body_limit` | 解压失败或解压结果超过 16 MiB，保留缓存 |
| `ump_invalid` / `protobuf_invalid` | 帧或 Protobuf 解析失败，保留可能有效的缓存 |
| `no_encrypted_part` | 未遇到支持的 type-25 内容，原样放行 |
| `reencryption_failed` | 改写后重加密失败，整个响应原样放行，不把内存修改称为清理成功 |
| `missing_body` / `invalid_body` | 脚本未得到可用二进制响应 |
| `feed_unsupported` / `script_error` | 信息流或其他处理未完成，原样放行 |

没有 `start` 时，不能由脚本日志确定是 MITM、QUIC、匹配未覆盖、下载/缓存、正文大小限制或其他问题。只有 `start` 没有 `finish` 时，可能是脚本被中止/超时/内存限制；需结合 Shadowrocket 自己的脚本错误状态，不能直接断言原因。引擎在脚本运行前跳过正文或强制终止后，JavaScript 无法再可靠输出原因。当前正文上限保持 16 MiB，API 超时 30 秒，UMP 超时 60 秒，未为猜测原因而调整。

若视频仍有广告，后续仅凭这些 `[YTAD]` 行判断是否继续处理；不索取 Cookie、密钥、完整 URL 或正文。

## 审查范围和已确认问题

- 对照公开 Shadowrocket 配置范式并增加静态规则/参数/匹配测试：MITM 使用 `%APPEND%`，三条 UDP AND 规则保留，HTTP Response/Request 脚本均显式开启 requires-body/binary-body-mode。未运行 iPhone 原生模块解析器，因此不能把静态检查称为真机语法验证。
- `player` / `get_watch` 在两个现有 googleapis 主机上匹配无查询和带查询的标准路径；`initplayback?…` 覆盖现有 googlevideo 子域、ack 和 oad 参数，不重写 videoplayback。没有实际手机请求样本，无法保证未观察到的新主机/路径被覆盖，也没有为此扩大规则。
- 独立 Node AES/HMAC/gzip 测试未发现现有加密往返计算错误；修复的是已证实的错误缓存失效路径：缺少请求正文不再清除缓存，压缩/解压/帧/Protobuf 错误不再无条件清除缓存。显式关联密钥不符和 HMAC 错误仍可使该平台缓存失效。只有半组密钥时允许日志请求刷新。
- 新诊断参数使用简单字符串，适配层不再把它交给上游 JSON 参数解析器；已回归测试开关不会使 player/UMP 被异常放行。
- `main?v=版本` 无法保证服务端 Raw 缓存已更新。1.3.0 的模块改为引用不可变脚本提交（见 `release.json`），同一模块版本不会混用不同 main 脚本；模块本身仍需手动更新并确认版本。更新模块不会自动保证手机已编译新配置。诊断日志的 version 才是实际执行版本的证据。

## 隐私

诊断默认关闭。启用后只允许版本、脚本种类、白名单接口名、固定事件/原因代码和布尔值。没有动态错误字符串、时间、完整主机/URL、查询、头部、账号、请求/响应正文或密钥。原上游 console 输出在适配作用域内被屏蔽，避免异常文本或调试输出泄漏数据。没有写入诊断历史、上传日志或调用远程诊断服务。Shadowrocket 自身的请求日志不属于本脚本控制范围，请勿把其完整导出当作这些安全诊断行。

## 真实日志对应的两项修复

- `URL-REGEX,...initplayback?...oad...,REJECT` 可追溯到本仓库 v1.0.0（提交 f66c322），v1.1.0 已移除。请在 Shadowrocket 中关闭旧 v1.0 副本，并检查当前配置的「规则」与「URL 重写」里是否复制了同一条规则。若来源是其他订阅，仅停用对应冲突规则/模块；本仓库不修改其他配置。重新编译当前配置并重连后，确认同一初始化请求不再被那条规则 REJECT。外部规则仍阻断时，任何响应脚本都无法保证执行。
- `JSON Parse error: Unexpected EOF`：现有直接 getJSON 读取路径未捕获解析异常。1.3.1 统一保护三个运行脚本及 UMP 内嵌处理器的缓存读取，校验对象/数组/键记录类型。损坏项恢复为安全默认值，不清除另一份正常缓存；config/log_event 可重新填充密钥。没有堆栈或缓存样本时，不能断言日志具体来自哪一个缓存键。Protobuf 正文继续使用二进制 fromBinary，不把播放器响应当 JSON 解析。

`cache_recovery success=true` 表示已在内存使用安全默认/修复值，不表示广告清理成功，也不保证持久化修复写入成功。写入异常有独立 `cache_write_failed`；这些恢复事件不会把本来可继续处理的播放器标为失败。`script http response sends data to client` 也不作为清理成功证据。
