# Shadowrocket YouTube Adblock

用于 iOS 官方 YouTube App 的 Shadowrocket 远程模块。复用 Maasea 的 Protobuf 去广告实现，并将模块与全部运行脚本托管在本仓库。Apache-2.0，来源与修改见 [NOTICE.md](NOTICE.md)。

## 订阅

https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module

## 安装

1. Shadowrocket → 配置 → 模块 → 新增模块，粘贴上述地址，下载并启用。
2. 在当前配置的「HTTPS 解密」中生成证书、安装证书；按提示前往 iOS「设置 → 通用 → VPN 与设备管理」安装描述文件。
3. iOS「设置 → 通用 → 关于本机 → 证书信任设置」，开启对该 Shadowrocket 根证书的完全信任。
4. 返回 Shadowrocket，开启 HTTPS 解密及代理连接，使用「配置」路由模式；彻底退出并重新打开 YouTube。无需替换现有节点。

菜单名称可能因 Shadowrocket 语言与版本略有不同。已有可信证书时可沿用。

## 覆盖范围与限制

- `player` 和 `get_watch`：移除已知的 `adPlacements`、`adSlots` 与广告跟踪字段，面向片头和中插广告。
- `reel/reel_watch_sequence`：移除明确标记 `isAd` 的 Shorts 条目，保留正常 Shorts。
- `browse`、`next`、`search`：复用上游广告布局识别与缓存，清理可识别的首页推广和推荐广告。
- URL Rewrite 仅拒绝明确的广告初始化及 `dclk_video_ads` 端点；不屏蔽整个媒体域名，也不拦截正常 `videoplayback`。
- 对带 `ack` 的加密播放初始化请求返回空初始化响应，尝试让 App 回退到可重写的 player API。该回退依赖客户端行为，不能保证支持所有 App 版本；不使用第三方 Worker。
- 无法保证拦截服务端插入视频流的广告、未知布局、未经过这些接口的广告或创作者口播赞助。
- 本项目已执行本地合成 Protobuf 测试和配置匹配测试；**未在真实 iPhone / Shadowrocket / YouTube App 上验证去广告效果或播放稳定性**。本地测试通过不代表实际广告全部可去除。

MITM 限于 `youtubei.googleapis.com`、`youtubei-att.googleapis.com`、`*.googlevideo.com`。仅为这些域名拒绝 UDP，使连接使用可解密的 TCP。域名规则无法区分进程：YouTube Music 或其他使用相同媒体域名的服务也可能受影响。其他 App 域名、代理节点、默认路由和证书私钥均不在模块中设置。

若出现播放失败，先停用本模块并重新打开 YouTube。不要同时启用其他 YouTube 重写模块。未识别或损坏的 Protobuf 响应原样放行；文本/JSON 响应也放行。

## 远程更新

模块和两个脚本始终引用本仓库 `main` 分支的 GitHub Raw 地址。更新 GitHub 文件后，在 Shadowrocket 中更新远程模块，并更新/重新下载脚本缓存（若版本提供「外部资源 → 全部更新」可使用该入口），随后重连并重启 YouTube。只更新模块配置不一定刷新已缓存的脚本；Raw CDN 也可能有短暂缓存。

## 开发与验证

无需安装 npm 依赖：

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
npm test
```

`vendor/` 保存固定版本上游快照；`tools/build.py` 通过精确匹配生成适配脚本。升级上游时应核对许可、字段变化与测试，不能只替换压缩脚本。测试覆盖播放器广告字段、未知数据保留、Shorts、首页广告识别、嵌套播放器、异常响应、二进制类型和规则范围。GitHub Actions 在 `main` 推送时重复这些检查。
