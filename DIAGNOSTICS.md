# v1.4.0 基准兼容模式诊断

普通模块诊断默认关闭。需排查时：

1. 更新原订阅到 1.4.0，关闭旧 YouTube 模块和其他同类模块。
2. 暂停普通模块，临时导入并启用：https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module
3. 编译/使用当前配置，确认现有证书可信及 HTTPS 解密开启，使用「配置」路由模式，重连后完全退出再打开 YouTube。
4. 在脚本日志搜索 `[YTAD]`。只需复制这些白名单行，不需要完整请求日志、Cookie、Token、密钥或正文。结束后恢复普通模块。

## 当前路径

默认只注册 `youtube.response.compat.js`。googlevideo 的特定 `&oad` 请求由基准 URL Rewrite 返回空成功响应（`reject-200`），不进入 UMP 脚本。**看不到 ump_enter 不再表示失败**；旧版本文档中的 UMP 密钥/解密事件只属于未注册的历史实现。

在请求记录中观察基准 oad 规则是否命中并返回空 200；这与旧 v1.0 网络 `REJECT` 不同。正常 `videoplayback?…` 和 `dclk_video_ads` 被该 oad 规则明确排除。不要另外叠加旧的 initplayback 网络拒绝规则，或同时启用原 Maasea 模块/旧 UMP 模块。

- `version=1.4.0,event=start,endpoint=player`：实际执行了新版本播放器脚本，不能单凭命中就断言去广告成功。
- `event=ad_fields,found=true`：发现处理器认识的广告字段/结构。
- `event=ad_cleanup,cleaned=true` 且 `finish success=true,pass=false`：清理并返回了修改后的正文；不等于 App 最终不会播放广告。
- `finish pass=true`：原样放行；`found=false` 不证明不存在广告。
- `cache_recovery`：损坏缓存已在内存使用安全默认值继续处理；JSON/类型/存储错误只输出固定原因，不输出缓存内容。修复写入失败也不会使独立播放器处理整体退出。

没有 start 时，需要检查模块版本、脚本下载、配置编译、MITM 命中或引擎限制；没有真实手机日志时不能断言原因。只有 start 没有 finish 时，可能是引擎中止/超时/内存限制，脚本不能在被强制终止后可靠地解释原因。

`script http response sends data to client` 仅表示发送响应，不能作为广告清理证据。用户提供的参考模块已实测有效，但没有新的本仓库版本 iPhone 测试证据。

## 与旧版本建议的区别

v1.3.1 排除了旧 v1.0 的广泛 initplayback 网络 REJECT；v1.4.0 根据用户新提供的实测基准，恢复的是条件不同、结果为 HTTP 200 的 oad 处理，并同时停止注册 UMP。这不是让两种机制一起运行。路由、URL Rewrite、MITM 和原始模块快照可在 README 对照表与 vendor 中核查。

日志默认关闭，开启后只允许版本、脚本种类、接口白名单、固定事件/原因代码和布尔值，不记录查询参数、头部、账号、正文、密钥或动态错误字符串，不上传日志。Shadowrocket 自身的完整请求日志不属于本脚本控制范围，请勿当成安全诊断行分享。
