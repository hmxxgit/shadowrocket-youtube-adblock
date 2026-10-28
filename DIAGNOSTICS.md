# v1.5.1 广告与启动耗时诊断

普通模块默认关闭诊断，没有请求探针或计时存储。

1. 更新原订阅至 1.5.1，停用旧 YouTube/UMP 模块；需要计时时关闭普通模块，临时启用 https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module 。不要同时启用两者。
2. 编译/使用当前配置，确认现有证书可信、HTTPS 解密开启，重连并完全退出后重开 YouTube，打开一个普通视频。
3. 在脚本日志搜索 `[YTAD]`，仅保留这些行。结束后关闭诊断模块，恢复普通模块并重连。

## 字段与边界

`event=timing` 仅输出以下非敏感耗时（毫秒）：

| 字段 | 含义 |
| --- | --- |
| `request_to_response_ms` | 请求探针开始到响应脚本开始的间隔，包含网络、服务端、正文下载与引擎调度/启动；不是纯网络时间。可靠配对不可用时为 null |
| `script_ms` | 本次脚本计时代码开始到提交结果前诊断点的耗时；不含此前下载、编译、引擎启动，也不含收尾日志和原生 $done 开销 |
| `parse_ms` | Protobuf 解码 |
| `rewrite_ms` | 广告字段及能力标记处理 |
| `encode_ms` | 修改后编码；无需修改时为 0 |
| `decrypt_ms` | 默认模块没有 UMP 解密，故为 0；不代表 YouTube 网络流本身未加密 |

测试中的 4/2/3 毫秒等数值来自合成时钟，用于检验统计分段，**不是设备测试结果**。

诊断模块为 player/get_watch 增加只读请求探针；对应响应仍由兼容脚本处理。对 initplayback，使用无正文的请求/响应观察脚本，始终 `$done({})`，不生成空播放响应、不改写 URL 或头部、不解析视频数据。正常模块无这些额外探针。探针本身有少量开销，诊断值不等于无探针时的速度。

配对仅在 Shadowrocket 提供可用且一致的 `$request.id` 时进行。原始 ID 不记录或输出，只使用本机不透明哈希键；同一 ID 重复、无 ID、配对缺失或存储不可用时，request_to_response_ms 为 null，原因分别可能为 timing_duplicate、request_id_unavailable、timing_missing、timing_storage_unavailable。不会按相同接口的先后顺序猜测配对。单机计时记录最多 64 项，匹配后删除，后续访问时清理 120 秒前记录；没有定时后台任务或上传。

如果 request_to_response_ms 很长但 script_ms 很短，只能说明等待主要在响应脚本执行前，仍需 Shadowrocket 原生连接耗时区分网络、服务端、QUIC/TCP 回退或引擎调度。没有稳定 ID 时，可结合原生连接记录查看耗时，但不应分享含 Token/完整查询的请求导出。脚本计时无法测量点击视频到第一个网络请求、或响应提交后 App 自己等待的时间。

## 广告与异常判断

- `start` 和 version 表示实际执行的脚本版本；只有命中不等于去广告成功。
- `ad_fields found=true`、`ad_cleanup cleaned=true` 且最终 `finish success=true,pass=false` 表示已清理认识的广告字段并返回修改响应；不保证 App 最终没有广告。
- 已有后台/PiP 标记正确且无广告时，直接放行，pass=true / cleaned=false 是预期的快速路径。
- 缺少二进制正文或解析异常时原样放行，不重试、不重定向、不伪造空初始化响应。缓存恢复不会输出缓存值。
- 只有 start 没有 finish 时，可能是引擎终止/超时/内存限制；JavaScript 不能在强制终止后可靠解释原因。响应 timeout 保持 60 秒。

v1.5.1 恢复原版 oad 空 200，匹配的 &oad 初始化可能在脚本之前结束；ctier 仍排除初始化。仍未注册 UMP，所以不能把本次等待直接归因于本地解密。若仍看到旧 initplayback REJECT/空响应或 UMP 日志，核对其他模块、旧配置与实际 version。

## 隐私与结论限制

诊断只允许版本、脚本种类、接口白名单、固定状态/原因、布尔值与有界耗时。无正文、头部、Cookie、Token、账号、完整查询、原始 ID 或密钥，不输出动态异常文本、不调用额外服务器、不上传日志。计时命名空间只保存本机哈希键、接口名、时间和重复标记。Shadowrocket 自身的完整日志不属于本脚本控制范围。

已证实代码存在无条件重编码、能力对象替换和可改写正常 initplayback 的规则。它们是否是 iPhone 约 10 秒的主要来源、优化后实际速度及广告效果，仍待新版本的真实设备数据确认。`script http response sends data to client` 不能证明广告清理或性能改善。

本版 cache_recovery 可能来自新隔离的兼容广告缓存，旧的自定义广告缓存不会被清除或继续套用。Ni/Br 恢复原文，但是否识别具体广告仍以 found/cleaned 为准。已复现旧白名单漏拦不等于确认手机缓存内容，详见 AD_FILTER_AUDIT.md。
