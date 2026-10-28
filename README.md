# Shadowrocket YouTube Adblock

用于 iOS 官方 YouTube App 的 Shadowrocket 远程模块，版本 **1.3.1**。复用 Maasea 的 Protobuf 和本地加密 UMP 处理逻辑，尝试过滤广告并恢复后台播放/PiP 响应标记。全部脚本在设备上运行，不使用第三方播放处理服务器。来源及修改见 [NOTICE.md](NOTICE.md)、[CHANGELOG.md](CHANGELOG.md)。

## 订阅与升级

https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module

已有旧版本：更新上述远程模块及全部脚本缓存，确认模块版本为 1.3.1，重连 Shadowrocket，再彻底退出并重新打开 YouTube。脚本固定到 `release.json` 中的不可变 Git 提交，避免同一模块混用 main 的旧缓存；更新模块后还需对当前配置执行「使用配置/编译配置」以获取新脚本。MITM 域名未改变，原有证书正常时不必重新安装。密钥需通过新的 `config` / `log_event` 响应获取，已有缓存中的视频不一定立即变化。

首次安装：

1. Shadowrocket → 配置 → 模块 → 新增模块，粘贴订阅地址并启用。
2. 当前配置 → HTTPS 解密，生成并安装证书；在 iOS「设置 → 通用 → VPN 与设备管理」完成安装。
3. iOS「设置 → 通用 → 关于本机 → 证书信任设置」，开启该证书的完全信任。
4. 返回 Shadowrocket，开启 HTTPS 解密及连接，使用「配置」路由模式，重新打开 YouTube。已有可信证书可沿用。

菜单名称随语言/版本略有不同。避免同时启用其他 YouTube 重写模块。

## 处理范围

- `player` / `get_watch`：移除已知 `adPlacements`、`adSlots` 及广告跟踪字段，面向片头、中插广告。
- `reel/reel_watch_sequence`：移除明确标记 `isAd` 的 Shorts 广告，保留普通 Shorts。
- `browse` / `next` / `search`：按广告元数据字段路径和明确广告布局识别赞助视频、推广与商品广告，移除完整列表成员并清理变空的父级 section/shelf；不按 `Sponsored` 字符串、标题或商品布局粗暴删除。wire 层处理可保留未知字段与重复 continuation action。
- `config` / `log_event`：将加密 Onesie 密钥保存在设备本地；缺少密钥时移除日志请求的 hot-hash 以促使配置刷新。
- `initplayback`：在设备本地验证 HMAC、AES-CTR 解密 UMP 的 type-25 Innertube 内容、处理播放器与推荐数据，再重新加密和计算 HMAC。支持未压缩和 gzip；其他 UMP 部分保留。初始化请求保持原目标和正文，不返回空播放响应。
- `account/get_setting`：仅恢复后台播放设置项，不开启下载、不修改其他账号设置。

MITM 仍只包含 `youtubei.googleapis.com`、`youtubei-att.googleapis.com`、`*.googlevideo.com`。只为这些域名拒绝 UDP，促使使用可解密的 TCP；不会拒绝整个 CDN，也不重写 `videoplayback` 媒体分片。URL Rewrite 仅拒绝明确的 `dclk_video_ads` 端点。规则不修改节点、VPS、默认路由或证书私钥。域名规则无法区分进程，YouTube Music 等使用相同域名的服务也可能受影响。

## 后台播放与实际限制

恢复了上游 `playabilityStatus` 内的后台播放和 PiP 标记，覆盖普通与本地解密的播放响应；保留未知权限数据、字幕和播放列表数据。YouTube 中若出现「后台播放」选项，可选择「始终开启」；PiP 还受 iOS 和 App 设置影响。

**没有真实 iPhone 测试，不能承诺锁屏后持续播放、切换 App 后持续播放或控制中心按钮已正常工作。** 响应标记不能代替 App 的 iOS 音频会话、账号权益检查或客户端强制限制；若客户端忽略这些标记，纯 Shadowrocket 模块无法保证绕过。无法保证拦截服务端混流广告、未知接口、未知加密/压缩格式或创作者口播赞助。

缺少密钥、HMAC 不匹配、截断 UMP、未知格式或损坏 Protobuf 均原样放行，可能仍有广告。单个正文最大 16 MiB，过大正文不处理；仅在关联密钥明确不符、HMAC 校验失败或缓存编码无效时清理相关缓存；其他格式错误保留缓存。若出现播放异常，停用本模块并重启 YouTube 可恢复排查基线。

## 开发与测试

无需安装 npm 依赖：

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
npm test
```

固定上游快照在 `vendor/`，构建校验 SHA-256，生成文件在 `scripts/`。GitHub Actions 检查构建可复现性、JavaScript 语法及测试。

69 项本地合成测试覆盖首页 Sponsored 元数据、整卡及空父容器移除、正常推荐/Shorts/观看记录/稍后观看保留、未知包装、分页保留、脚本版本和本机日志，以及广告字段、Shorts、结构混合广告、后台/PiP、设置项、字幕和未知字段保留、二进制类型、密钥缓存、规则范围和失败放行。加密 UMP 测试通过独立的 Node 原生 AES/HMAC/gzip 实现生成输入和校验输出。网络接口在这些执行路径的测试中被禁止。它们只证明合成数据的处理行为，不等同于实机去广告或后台播放验证。

## 临时诊断与视频广告排查

普通模块默认不输出诊断日志。需要排查时，临时关闭普通模块并启用 [诊断模块](https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module)，编译当前配置、重连后播放视频，在脚本日志中搜索 `[YTAD]`。不要同时启用两个模块。操作、结果解释和审查范围见 [DIAGNOSTICS.md](DIAGNOSTICS.md)。

本次没有新增广告字段或扩大 MITM 范围。已修复缺少初始化请求正文、不支持压缩及格式错误导致的无依据密钥清除，并增加默认关闭的白名单日志。只有手机日志才能确认实际经过哪个接口、是否缺密钥、是否清理了已知广告字段；没有真实 iPhone 验证，不声称实际片头广告已解决。

## 发布脚本版本

构建时只读取固定的本地 vendor 文件。`release.json` 记录已审查脚本所在的 Git 提交，生成器同时输出普通/临时诊断模块。发布时先完成运行脚本的提交，再将该提交 SHA 写入 `release.json`、重新生成模块并提交，最后把两个提交一起推到 main。脚本内容随后变化时，必须更新此 SHA 和模块版本，不能只编辑 main 的脚本就声称旧订阅会自动使用新实现。不可变地址解决脚本版本一致性；模块/客户端缓存仍需按上文刷新和确认。

## 1.3.1：旧拒绝规则与缓存损坏

用户日志中的 `initplayback?…oad` REJECT 与本仓库 v1.0.0 的 URL Rewrite 完全相同，v1.1.0 起已删除。当前模块不包含该拒绝规则。若更新后仍命中它，需在手机中停用旧模块副本，或在当前配置的规则/URL 重写中搜索 `initplayback` / `oad`，定位来源并只禁用这一条冲突规则；若来自其他订阅模块，停用对应冲突条目/模块并交由其来源维护。更新本仓库不会替用户删除其他配置中的规则。操作后重新编译当前配置、重连，再检查 `initplayback` 的 `[YTAD] start` / `ump_enter`。

`JSON Parse error: Unexpected EOF` 可由截断/空白的持久化缓存触发；旧版本空脚本参数也可能触发上游参数 JSON 解析。1.3.1 对两类本仓库缓存统一使用异常保护和类型校验，逐项恢复，避免独立的 player/get_watch/UMP 处理因此整体退出。坏密钥缓存需要等待 config/log_event 重新获取密钥；已有另一项正常缓存或其他平台的正常记录保留。回归测试覆盖损坏 JSON、null、数组、错误属性类型及存储读写错误，不打印缓存内容。

Shadowrocket 的 `script http response sends data to client` 只表示发送响应，**不代表发现或清理广告**。应查看 `[YTAD]` 的 `ad_fields found=true`、`ad_cleanup cleaned=true` 及最终 `finish success=true,pass=false`。无新的真实 iPhone 测试，不承诺实际广告已经消失。
