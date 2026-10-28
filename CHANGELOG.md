# CHANGELOG

## 1.2.0 — 2026-10-29

- 首页过滤改为结构识别：补齐 `VideoWithContext → Element → VideoInfo → VideoContext → VideoContent` 下的 11 种公开广告标记路径，及推广视频、多图商品广告路径、明确广告布局；不按 `Sponsored` 文本或任意 `pagead` 字符串判定广告。
- 在 Protobuf wire 层移除完整 repeated 列表成员，包括视频、广告主及按钮；删除广告后清理变空的 item section / Shorts shelf / 外层 shelf，混合列表只删广告成员。原本为空的 section 不删除。
- `browse`、`next`、`search` 无需通过固定完整 schema 再编码；保留未知字段、未变内容的原始字节、重复 continuation action 和分页字段。未知外层包装仍可遍历，处理设置深度与字段数上限。
- `get_watch` 与本地 UMP 继续共用首页/推荐过滤，保留 1.1.0 的视频广告移除和后台/PiP 标记。
- 商品布局、Sponsored 标题或广告 URL 本身不作为删除依据；没有广告结构证据的推荐、商品内容、Shorts、观看记录及稍后观看条目保留。
- 本机输出版本、feed 接口名及移除计数，并区分非二进制输入；不输出 URL 查询、Cookie、Token、正文或账号信息。没有上传或远程诊断。
- MITM 域名、代理节点和订阅 URL 不变；所有脚本参数更新为 `?v=1.2.0`。
- 43 项本地测试通过，包含结构路径、完整父容器移除、正常卡片保护、未知包装、缓存版本、本机日志及独立 AES/HMAC/gzip UMP 回归。未取得用户 iPhone 的真实响应或进行实机验证，不能保证所有当前/未来广告结构均命中。

## 1.1.0 — 2026-10-29

### 广告过滤

- 补齐新版 Onesie/UMP 路径：监听 `config` / `log_event` 保存设备本地密钥，处理 `initplayback` 响应中的 type-25 加密 Innertube 部分。
- 复用 Maasea 在 2026-07-11 的本地 AES-CTR/HMAC/UMP 实现，并结合 2026-07-19 的 Protobuf 处理器；支持无压缩与 gzip，处理后重新加密、计算 HMAC，保留其他 UMP 部分。
- 不使用最新版上游的第三方 Worker；不转发 Cookie、Token、密钥或播放 URL。
- 移除无条件空初始化响应与 `initplayback?oad` 拒绝规则。未知加密格式、缺失密钥、HMAC 错误、截断响应原样放行，避免主动破坏播放。
- 首页/推荐逐条检查全部未知字段，取消按字段编号/布局一票放行的缓存，修复同字段混合广告及短广告载荷漏检；保留普通 Shorts。
- 兼容 ArrayBuffer、Uint8Array、其他字节视图、字节数组和 bodyBytes；改写后清除过期压缩/长度响应头；正文上限明确为 16 MiB。

### 后台播放

- 恢复 `playabilityStatus` 下的 `backgroundPlayerRender.backgroundAbility.active` 与 `pictureInPictureRender.pictureInPictureAbility`，覆盖普通 player、get_watch 和本地解密 UMP。
- 处理 `account/get_setting` 中的后台播放选项，保留原有账号设置，不启用下载、不修改字幕或登录。
- 缺失播放权限对象时不伪造正常播放状态；保留未知 Protobuf 字段。
- 仅恢复上游响应能力标记，不控制 iOS 音频会话。锁屏持续播放、切换 App 及控制中心按钮均未获得实机验证，仍可能受 App/账号/地区限制。

### 更新与验证

- 保持模块订阅地址及 MITM 域名不变；脚本引用增加 `?v=1.1.0`，促进缓存更新。
- 17 项本地合成数据测试，包括使用 Node 原生加密库独立构造/校验的 UMP 加密往返、后台字段及错误放行测试；不能视为 iPhone 验证。

## 1.0.0 — 2026-10-29

- 初始模块与 Protobuf 过滤。此版本移除了上游后台播放字段，且缺少本地加密 UMP 处理，只尝试空初始化回退；实机反馈存在视频广告且无法后台播放。
