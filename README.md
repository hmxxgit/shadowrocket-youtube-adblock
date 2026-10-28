# Shadowrocket YouTube Adblock

**v1.4.0：Maasea 基准兼容模式。** 以用户在 iPhone 实测有效的 `YouTubeAd.sgmodule` 为配置基准，恢复其请求处理行为；必要的 Maasea 脚本与许可证固定在本仓库，不在运行时依赖镜像站、Maasea Raw 或远程 Worker。

## 订阅与升级

订阅地址不变：

https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module

更新到 **1.4.0**，停用其他 YouTube 模块及旧副本，对当前配置执行「使用配置／编译配置」，重连 Shadowrocket，完全退出并重新打开 YouTube。保留现有代理节点。原有可信证书可以沿用，但应确认 HTTPS 解密已开启。

不要把旧版直接网络 `REJECT` 的 initplayback 规则与本版混用。本版恢复的是基准的 **`reject-200` 空成功响应**，不是旧 v1.0.0 的广泛初始化拒绝。基准条件为路径排除 `dclk_video_ads` / `videoplayback?` 并包含 `&oad`；未擅自扩大为任何带 oad 参数的请求都拦截。

## 默认行为与比较

| 项目 | 自有旧实现的差异 | v1.4.0 默认配置 |
| --- | --- | --- |
| googlevideo oad | v1.1 起移除了该拦截并依赖本地 UMP | 恢复基准原样条件及 `reject-200` |
| ctier | 缺少基准重写 | 恢复原始正则、替换串和 302 |
| 广告统计 | 缺少基准重写 | 恢复 ads、pagead/ptracking、qoe/adcontext 三条规则 |
| MITM | 缺少统计域与 redirector 排除 | 同基准：`-redirector*.googlevideo.com,*.googlevideo.com,www.youtube.com,s.youtube.com,youtubei.googleapis.com` |
| UDP | 另加 youtubei-att | 同基准：仅 googlevideo 后缀与 youtubei.googleapis.com 的 UDP |
| Protobuf | 自定义信息流访问器与 UMP 链路 | 使用基准所引用的 Maasea 响应 bundle 的固定快照 |
| 后台/PiP | 自定义适配后的能力标记 | 恢复 Maasea 播放权限与设置处理；是否生效仍取决于 App |
| UMP | initplayback 请求/响应脚本与日志密钥缓存 | **默认不注册**，避免和 oad 空响应机制相互干扰 |

默认只加载 `scripts/youtube.response.compat.js`，覆盖基准的 browse、next、player、search、reel/reel_watch_sequence、guide、account/get_setting、get_watch。`max-size=-1`、二进制正文模式与基准一致；原镜像的未定义引擎/语言占位参数替换为 `engine=auto` 和安全的固定默认值（字幕翻译关闭，保留原字幕，Shorts 导航开启）。

`vendor/yfamilys.YouTubeAd.sgmodule` 保存抓取时的原模块，`vendor/compatibility-baseline.json` 保存来源、日期与 SHA-256。响应脚本是基准 URL 当时实际返回的 Maasea 提交 `65075cdb388fc5e3094afd7e7314c67b243f3525`，其内容与原有 vendor 快照相同。该网站引用的是可变 master URL，无法由此证明用户手机之前缓存的脚本与今天下载的字节完全相同。

兼容适配不新增广告字段：保留 v1.3.1 的损坏 JSON 缓存保护、缺失播放状态的异常防护、只输出白名单的默认关闭诊断，以及避免查询参数干扰接口选择。另取消上游按 Shorts 布局整体隐藏普通 Shorts 卡片的判断，保留正常 Shorts；其他首页识别采用上游算法，不叠加旧的自定义深层字段过滤器。未启用字幕翻译或额外网络请求。

## 诊断和限制

需要日志时，暂时关闭普通模块并启用 [诊断模块](https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module)，重新编译配置并重连。不要同时启用两个模块。详见 [DIAGNOSTICS.md](DIAGNOSTICS.md)。

oad 请求在 URL Rewrite 阶段返回空 200，因此没有该请求对应的 UMP 日志是预期行为。`script http response sends data to client` 也不能证明清理了广告；播放器脚本是否识别并清理已有字段，以 `[YTAD]` 的 found/cleaned/finish 为准。

用户验证的是参考模块；**本仓库 v1.4.0 尚未获得新的 iPhone 实测证据**。本地规则/响应对照通过，不代表实际广告全部消失，也不能保证所有 App/地区/账号下的后台播放、锁屏音频、PiP 或系统控制中心行为。正常媒体 CDN 不被整体阻断，videoplayback 不被 oad 规则拒绝，但会按基准条件执行 ctier 重定向。

## 开发与发布

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
npm test
```

默认兼容脚本由固定 vendor 生成；URL Rewrite/Rule/MITM 从经过哈希校验的基准模块读取，避免手工改写语义。原 Maasea Apache-2.0 许可在 `LICENSE`，来源与适配记录见 [NOTICE.md](NOTICE.md)。

旧的 `youtube.response.js`、`youtube.request.js`、`youtube.ump.js` 及对应测试保留供历史回归，**不被当前普通/诊断模块引用**；它们通过测试不代表默认模式执行了 UMP。新增兼容专项对照规则、请求边界、ctier 替换、媒体排除及固定上游播放器/Shorts 输出。

`release.json` 指向已审查脚本提交。发布时先提交脚本，再更新该 SHA 并重新生成模块，最后一并推送；不要只改 main 脚本而不更新模块引用。模块与客户端缓存仍需刷新并确认版本。
