# Shadowrocket YouTube Adblock

用于 iOS 官方 YouTube App 的 Shadowrocket 远程模块，版本 **1.1.0**。复用 Maasea 的 Protobuf 和本地加密 UMP 处理逻辑，尝试过滤广告并恢复后台播放/PiP 响应标记。全部脚本在设备上运行，不使用第三方播放处理服务器。来源及修改见 [NOTICE.md](NOTICE.md)、[CHANGELOG.md](CHANGELOG.md)。

## 订阅与升级

https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module

已有 1.0.0：更新上述远程模块及全部脚本缓存，确认模块版本为 1.1.0，重连 Shadowrocket，再彻底退出并重新打开 YouTube。脚本 URL 带版本参数以促进重新下载。MITM 域名未改变，原有证书正常时不必重新安装。密钥需通过新的 `config` / `log_event` 响应获取，已有缓存中的视频不一定立即变化。

首次安装：

1. Shadowrocket → 配置 → 模块 → 新增模块，粘贴订阅地址并启用。
2. 当前配置 → HTTPS 解密，生成并安装证书；在 iOS「设置 → 通用 → VPN 与设备管理」完成安装。
3. iOS「设置 → 通用 → 关于本机 → 证书信任设置」，开启该证书的完全信任。
4. 返回 Shadowrocket，开启 HTTPS 解密及连接，使用「配置」路由模式，重新打开 YouTube。已有可信证书可沿用。

菜单名称随语言/版本略有不同。避免同时启用其他 YouTube 重写模块。

## 处理范围

- `player` / `get_watch`：移除已知 `adPlacements`、`adSlots` 及广告跟踪字段，面向片头、中插广告。
- `reel/reel_watch_sequence`：移除明确标记 `isAd` 的 Shorts 广告，保留普通 Shorts。
- `browse` / `next` / `search`：逐条检查已知广告布局与 Protobuf 广告特征，清理首页和推荐推广条目，不再因为之前同字段出现普通内容而全部放行。
- `config` / `log_event`：将加密 Onesie 密钥保存在设备本地；缺少密钥时移除日志请求的 hot-hash 以促使配置刷新。
- `initplayback`：在设备本地验证 HMAC、AES-CTR 解密 UMP 的 type-25 Innertube 内容、处理播放器与推荐数据，再重新加密和计算 HMAC。支持未压缩和 gzip；其他 UMP 部分保留。初始化请求保持原目标和正文，不返回空播放响应。
- `account/get_setting`：仅恢复后台播放设置项，不开启下载、不修改其他账号设置。

MITM 仍只包含 `youtubei.googleapis.com`、`youtubei-att.googleapis.com`、`*.googlevideo.com`。只为这些域名拒绝 UDP，促使使用可解密的 TCP；不会拒绝整个 CDN，也不重写 `videoplayback` 媒体分片。URL Rewrite 仅拒绝明确的 `dclk_video_ads` 端点。规则不修改节点、VPS、默认路由或证书私钥。域名规则无法区分进程，YouTube Music 等使用相同域名的服务也可能受影响。

## 后台播放与实际限制

恢复了上游 `playabilityStatus` 内的后台播放和 PiP 标记，覆盖普通与本地解密的播放响应；保留未知权限数据、字幕和播放列表数据。YouTube 中若出现「后台播放」选项，可选择「始终开启」；PiP 还受 iOS 和 App 设置影响。

**没有真实 iPhone 测试，不能承诺锁屏后持续播放、切换 App 后持续播放或控制中心按钮已正常工作。** 响应标记不能代替 App 的 iOS 音频会话、账号权益检查或客户端强制限制；若客户端忽略这些标记，纯 Shadowrocket 模块无法保证绕过。无法保证拦截服务端混流广告、未知接口、未知加密/压缩格式或创作者口播赞助。

缺少密钥、HMAC 不匹配、截断 UMP、未知格式或损坏 Protobuf 均原样放行，可能仍有广告。单个正文最大 16 MiB，过大正文不处理；密钥失效后等待配置刷新。若出现播放异常，停用本模块并重启 YouTube 可恢复排查基线。

## 开发与测试

无需安装 npm 依赖：

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
npm test
```

固定上游快照在 `vendor/`，构建校验 SHA-256，生成文件在 `scripts/`。GitHub Actions 检查构建可复现性、JavaScript 语法及测试。

17 项测试覆盖广告字段、Shorts、同字段混合广告、后台/PiP、设置项、字幕和未知字段保留、二进制类型、密钥缓存、规则范围和失败放行。加密 UMP 测试通过独立的 Node 原生 AES/HMAC/gzip 实现生成输入和校验输出。网络接口在这些执行路径的测试中被禁止。它们只证明合成数据的处理行为，不等同于实机去广告或后台播放验证。
