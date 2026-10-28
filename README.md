# Shadowrocket YouTube Adblock

**v1.5.0：保留初始化请求，按需重写播放器响应。** 以用户在 iPhone 实测有效的 `YouTubeAd.sgmodule` 为配置基准，恢复其请求处理行为；必要的 Maasea 脚本与许可证固定在本仓库，不在运行时依赖镜像站、Maasea Raw 或远程 Worker。

## 订阅与升级

订阅地址不变：

https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module

更新到 **1.5.0**，停用其他 YouTube 模块及旧副本，对当前配置执行「使用配置／编译配置」，重连 Shadowrocket，完全退出并重新打开 YouTube。保留现有代理节点。原有可信证书可以沿用，但应确认 HTTPS 解密已开启。

不要把旧版直接网络 `REJECT` 的 initplayback 规则与本版混用。v1.5.0 明确让 `initplayback` 避开 oad 空 200 与 ctier 302，避免主动改写正常视频初始化。其他 oad、广告统计与播放器 Protobuf 过滤保留；依赖初始化空响应的广告分支效果需要重新实测，不能保证无广告。

## 默认行为与比较

| 项目 | 自有旧实现的差异 | v1.4.0 默认配置 |
| --- | --- | --- |
| googlevideo oad | v1.1 起移除了该拦截并依赖本地 UMP | 保留其他请求的基准条件及 `reject-200`，排除 initplayback |
| ctier | 缺少基准重写 | 保留原替换串和 302，排除 initplayback |
| 广告统计 | 缺少基准重写 | 恢复 ads、pagead/ptracking、qoe/adcontext 三条规则 |
| MITM | 缺少统计域与 redirector 排除 | 同基准：`-redirector*.googlevideo.com,*.googlevideo.com,www.youtube.com,s.youtube.com,youtubei.googleapis.com` |
| UDP | 另加 youtubei-att | 同基准：仅 googlevideo 后缀与 youtubei.googleapis.com 的 UDP |
| Protobuf | 自定义信息流访问器与 UMP 链路 | 固定上游 schema，播放器按实际变更决定是否编码 |
| 后台/PiP | 自定义适配后的能力标记 | 恢复 Maasea 播放权限与设置处理；是否生效仍取决于 App |
| UMP | initplayback 请求/响应脚本与日志密钥缓存 | **默认不注册**，避免和 oad 空响应机制相互干扰 |

默认只加载 `scripts/youtube.response.compat.js`，覆盖基准的 browse、next、player、search、reel/reel_watch_sequence、guide、account/get_setting、get_watch。`max-size=-1`、二进制正文模式与基准一致；原镜像的未定义引擎/语言占位参数替换为显式 `engine=jsc` 和安全的固定默认值（字幕翻译关闭，保留原字幕，Shorts 导航开启）。

`vendor/yfamilys.YouTubeAd.sgmodule` 保存抓取时的原模块，`vendor/compatibility-baseline.json` 保存来源、日期与 SHA-256。响应脚本是基准 URL 当时实际返回的 Maasea 提交 `65075cdb388fc5e3094afd7e7314c67b243f3525`，其内容与原有 vendor 快照相同。该网站引用的是可变 master URL，无法由此证明用户手机之前缓存的脚本与今天下载的字节完全相同。

兼容适配不新增广告字段：保留 v1.3.1 的损坏 JSON 缓存保护、缺失播放状态的异常防护、只输出白名单的默认关闭诊断，以及避免查询参数干扰接口选择。另取消上游按 Shorts 布局整体隐藏普通 Shorts 卡片的判断，保留正常 Shorts；其他首页识别采用上游算法，不叠加旧的自定义深层字段过滤器。未启用字幕翻译或额外网络请求。

## 诊断和限制

需要日志时，暂时关闭普通模块并启用 [诊断模块](https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock-diagnostic.module)，重新编译配置并重连。不要同时启用两个模块。详见 [DIAGNOSTICS.md](DIAGNOSTICS.md)。

除正常初始化以外，符合规则的 oad 请求在 URL Rewrite 阶段返回空 200。initplayback 正常透传，默认不调用 UMP。`script http response sends data to client` 也不能证明清理了广告；播放器脚本是否识别并清理已有字段，以 `[YTAD]` 的 found/cleaned/finish 为准。

用户验证的是参考模块；**本仓库 v1.5.0 尚未获得新的 iPhone 实测证据**。本地规则/响应对照通过，不代表实际广告全部消失，也不能保证所有 App/地区/账号下的后台播放、锁屏音频、PiP 或系统控制中心行为。正常媒体 CDN 不被整体阻断，videoplayback 不被 oad 规则拒绝，但会按基准条件执行 ctier 重定向。

## 开发与发布

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
npm test
```

默认兼容脚本由固定 vendor 生成；URL Rewrite/Rule/MITM 从经过哈希校验的基准模块读取，避免手工改写语义。原 Maasea Apache-2.0 许可在 `LICENSE`，来源与适配记录见 [NOTICE.md](NOTICE.md)。

旧的 `youtube.response.js`、`youtube.request.js`、`youtube.ump.js` 及对应测试保留供历史回归，**不被当前普通/诊断模块引用**；它们通过测试不代表默认模式执行了 UMP。新增兼容专项对照规则、请求边界、ctier 替换、媒体排除及固定上游播放器/Shorts 输出。

`release.json` 指向已审查脚本提交。发布时先提交脚本，再更新该 SHA 并重新生成模块，最后一并推送；不要只改 main 脚本而不更新模块引用。模块与客户端缓存仍需刷新并确认版本。

## 视频启动延迟：已确认与待验证

已确认：v1.4 的 oad 空响应和 ctier 重定向能命中正常 initplayback；player 总是返回 bodyChanged=true，get_watch 只要非空也总是重新编码，并替换后台/PiP 对象。v1.5 排除这两种初始化改写，使用幂等字段更新，已有广告字段仍清理，所需后台/PiP 标记仍补齐，字幕和未知数据保留；无变化直接返回原响应。player 不再读取与其无关的广告/密钥缓存，get_watch 仅在确有推荐列表时读取广告缓存，推荐列表只处理一次，没有双重 Protobuf 解码或全量正文比较。

默认版本原本就未注册 UMP，所以没有证据将约 10 秒归因于本地解密/压缩/重加密。初始化被改写可能触发客户端回退，auto 引擎也可能带来启动开销，但手机上的主要等待位置仍未知。现在显式使用 JSC；响应 timeout 保持 60 秒，没有靠提前超时假装优化。UDP 拒绝维持原范围，其 QUIC→TCP 时序亦需实机观察。

轻量耗时仅在临时诊断开启，字段说明见 DIAGNOSTICS.md。request_to_response_ms 是请求脚本到响应脚本的间隔，包含网络、服务端、下载和引擎调度，不是纯网络时间；缺少稳定 ID、配对失败或存储失败时为 null，不猜测。script_ms 也不包含脚本下载/编译/引擎启动。没有真实 iPhone 时序日志，不能把本地操作次数减少声称为启动时间已经改善。
