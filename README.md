# Shadowrocket YouTube Adblock

**v1.5.1：恢复原版广告清理、隔离兼容模式缓存，保留按需编码。** 以用户在 iPhone 实测有效的 `YouTubeAd.sgmodule` 为配置基准，恢复其请求处理行为；必要的 Maasea 脚本与许可证固定在本仓库，不在运行时依赖镜像站、Maasea Raw 或远程 Worker。

## 订阅与升级

订阅地址不变：

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-adblock.module
```

更新到 **1.5.1**，停用其他 YouTube 模块及旧副本，对当前配置执行「使用配置／编译配置」，重连 Shadowrocket，完全退出并重新打开 YouTube。保留现有代理节点。原有可信证书可以沿用，但应确认 HTTPS 解密已开启。

不要把旧版直接网络 `REJECT` 的 initplayback 规则与本版混用。v1.5.1 恢复 Maasea 原版 oad 空 200 条件，包括含 `&oad` 的初始化分支；不是网络 REJECT。ctier 仍排除 initplayback，其他统计与 Protobuf 过滤保留。恢复 oad 可能影响客户端回退等待，实际广告和启动速度均需真机复测。

## Shadowrocket 对照测试模块

以下 A–E、G 模块均以当前正式版 v1.5.1 为基准；注册响应脚本的模块沿用正式模块引用的同一个不可变 Raw 脚本，E 按设计不注册响应脚本。每个代码块只有一个完整订阅地址，可在 GitHub 页面直接复制。A 只改显示名称和描述；B–E、G 各自只改变表格中列出的单一因素。

### A — YT Test A - Baseline

测试目的：作为基准，完整保留当前正式模块的过滤逻辑、响应脚本、MITM、UDP 规则和 URL Rewrite。与正式版的功能差异：无，仅测试标识不同。可能损失：与正式版相同。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-a-baseline.module
```

### B — YT Test B - No Feed Script

测试目的：检查 browse/search Protobuf 响应脚本是否造成首页或搜索卡顿。相对 A 只从 HTTP Response Script 匹配范围中移除 `browse`、`search`；player、next、get_watch 等端点、UDP、URL Rewrite、MITM 和脚本内容均保持不变。预期损失：首页和搜索信息流广告清理可能减弱，出现推广内容属于预期实验差异。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-b-no-feed.module
```

### C — YT Test C - No UDP Block

测试目的：检查本模块的 UDP/QUIC 拒绝规则是否影响连接回退。相对 A 只移除两条模块 UDP REJECT 规则。预期损失：广告过滤行为可能因连接协议变化而不同；其他过滤规则不变。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-c-no-udp.module
```

### D — YT Test D - No Rewrite

测试目的：检查 URL Rewrite 是否引入等待或播放问题。相对 A 只移除整个 URL Rewrite 区段；响应脚本、UDP 规则和 MITM 保持不变。预期损失：oad、ctier 与广告统计请求的 URL Rewrite 过滤将停用。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-d-no-rewrite.module
```

**真实设备反馈（用户手动观察，非自动化测试）：**进入 YouTube 官方 App 的视频播放页面后出现广告。D 组广告过滤测试不通过，不推荐作为正式模块。首页刷新、搜索和视频启动性能均尚无可靠结果；具体广告类型及触发接口尚未确认。A 组对应的真机结果本次未提供，因此暂不能确认 A 与 D 的实际广告效果差异。

#### D 组与 A 组的代码差异及漏拦截分析

静态逐段比较确认：忽略测试显示名称和描述后，D 相对 A 只删除了整个 `[URL Rewrite]` 区段。A 与正式模块的过滤行为、规则、MITM 和脚本引用一致；D 仍保留两条 UDP REJECT、相同的 MITM hostname，以及覆盖 `browse`、`next`、`player`、`search`、`reel_watch_sequence`、`get_watch` 等接口的同一 Protobuf 响应脚本。

A 被 D 删除的重写规则有：

1. **googlevideo `oad` 规则：**对符合域名和路径条件、查询中带 `&oad` 的请求返回 `reject-200`，但排除 `dclk_video_ads` 和 `videoplayback`。这是最直接针对带 `oad` 标记请求的候选规则；参数顺序或路径不符合正则时不会命中。
2. **ctier 重写：**符合条件的 googlevideo 请求以 302 去掉 `ctier=L` 片段；此规则排除 `dclk_video_ads` 和 `initplayback`。它没有显式按广告字段筛选，但可能改变匹配请求的媒体请求路径或客户端行为。
3. **广告统计/追踪规则：**对 `/api/stats/ads`、`pagead`、`ptracking` 及带 `adcontext` 的 qoe 请求返回 `reject-200`。从接口名称看，这些更像统计与追踪请求，是否会影响广告展示流程仍属推测。

Protobuf 响应过滤与 URL Rewrite 是不同处理层，可能共同影响同一播放流程：响应脚本检查 player 中的 `adPlacements`、`adSlots` 和广告追踪字段，也处理 browse/next/search 信息流及 get_watch 中的播放器/推荐内容；`oad` 规则则可能在 googlevideo 请求层提前处理部分带标记请求。D 保留了前者，但移除了后者全部五条规则。

**代码与测试能证实的内容：**当前差异测试证明 D 只删 URL Rewrite；回归测试用合成 URL 验证 `oad` 的若干命中/排除情况、ctier 替换和统计端点匹配，其他 Protobuf 测试验证已知响应字段的处理。**不能证实的内容：**没有本次广告请求的 URL/接口日志或原始响应样本，现有测试也不模拟真实广告投放，因此不能将这次漏拦截唯一归因于 oad、ctier 或统计规则中的任何一条。D 的观察与“缺少一条或多条 URL Rewrite 导致漏拦截”相符，但具体原因待定位。

### E — YT Test E - No Response Script

测试目的：隔离 YouTube Protobuf HTTP Response Script 的整体影响。相对 A 只移除该响应脚本；UDP 规则、URL Rewrite 和 MITM 保持不变。预期损失：响应中的视频、信息流和设置字段处理停用，广告过滤、后台播放及 PiP 能力都可能减弱。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-e-no-script.module
```

### G — YT Test G - No OAD Rewrite

测试目的：以最少变量优先检查最直接针对广告请求的 `oad` 规则。相对 A 只删除 googlevideo `&oad` 的 `reject-200` 重写；ctier、三条统计/追踪重写、Protobuf 脚本、UDP 和 MITM 均保留。G 是诊断用版本，不推荐作为正式模块；预期是带 `oad` 且匹配条件的广告请求可能放行。

```text
https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/youtube-test-g-no-oad.module
```

下一步建议在相同网络、账号和节点下交错测试 **A → G → A**，且每轮只启用一个模块并重启 YouTube。若广告只在 G 出现而两次 A 均未出现，才有重复观察支持 `oad` 规则参与了拦截；若 A 也出现广告，则这轮比较不能说明是 G 的改动导致。记录播放页观察到的广告类型；具体触发接口仍需另有安全的本地请求证据确认。

### 人工测试步骤

1. 导入当轮要测的模块；确认旧轮测试模块已停用。
2. 每轮只启用一个 YouTube 去广告模块，并停用其他可能冲突的 YouTube 模块和规则。
3. 固定使用同一个代理节点、设备、网络及 YouTube 账号状态；除正在测试的模块因素外，不改其他配置。
4. 确认 Shadowrocket 已应用/编译当前配置，再完全退出并重新打开官方 YouTube App。
5. 每个版本至少做 10 次首页下拉刷新、10 次相同条件的视频搜索；记录从操作开始到内容稳定的耗时、超时及失败。另做至少 5 次普通视频启动，检查拖动进度条和连续播放。
6. 检查视频片头/中插广告、首页推广卡片、搜索广告和 Shorts 广告；同时观察字幕、历史记录、推荐、后台播放及 PiP 是否退化。
7. 记录每次结果；性能表填中位数、最大值和超时/失败数。样本只有 10 次时，P95 只能作为粗略参考，需注明样本量，不能视为稳定估计。
8. 交错测试 A 与单因素版本，尽量减小网络和缓存变化的影响。建议顺序：A → B → A → C → A → D → A → E；下一轮针对 D 的漏拦截，优先做 A → G → A。

测试顺序中确保上一个模块已停用、当前模块已启用，节点和其他网络设置保持一致，并在每次切换后重新启动 YouTube。C 只移除本模块自带的 UDP 规则；若其他 Shadowrocket 配置仍有相同拦截规则，C 不会覆盖它们，测试记录中应注明。

### 测试记录（真实 iPhone 结果待填写）

**除 D 行所列用户手动观察外，其他真实 iPhone 测试结果均待填写。** D 组反馈不是自动化测试；本仓库自动化测试只检查配置差异和本地合成响应，不代表真机加载速度或广告过滤结果。

| 测试版本 | 首页刷新速度（中位数 / P95 / 最大值） | 搜索速度（中位数 / P95 / 最大值） | 视频启动速度（中位数 / P95 / 最大值） | 视频广告 | 首页广告 | 搜索广告 | Shorts 广告 | 是否卡顿 | 备注（超时/失败数） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — Baseline | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| B — No Feed Script | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| C — No UDP Block | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| D — No Rewrite | 尚无可靠结果 | 尚无可靠结果 | 尚无可靠结果 | 播放页观察到广告 | 未确认 | 未确认 | 未确认 | 未确认 | 用户手动观察；广告类型/接口未确认 |
| E — No Response Script | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |
| G — No OAD Rewrite | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 | 待填写 |

F（Fast Feed）暂不发布：现有本地性能测试采用合成 Protobuf 数据和受控计数，能验证无需修改时不重编码等代码路径，但没有可复现的真机卡顿数据来证明某项新优化能解决首页/搜索等待。无证据前不加入一个可能改变过滤行为的候选版本。

## 默认行为与比较

| 项目 | 自有旧实现的差异 | v1.4.0 默认配置 |
| --- | --- | --- |
| googlevideo oad | v1.1 起移除了该拦截并依赖本地 UMP | 恢复原版完整 oad 条件及 `reject-200`（包含匹配的初始化请求） |
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

符合原版条件的 oad 请求在 URL Rewrite 阶段返回空 200；不含 &oad 的普通初始化不受此规则影响，默认不调用 UMP。`script http response sends data to client` 也不能证明清理了广告；播放器脚本是否识别并清理已有字段，以 `[YTAD]` 的 found/cleaned/finish 为准。

本轮唯一新增的真实设备证据是用户报告 D 组在视频播放页出现广告；它不证明 A 组是否通过，也未定位广告类型或请求接口。其他性能与过滤结果仍待测。本地规则/响应对照通过，不代表实际广告全部消失，也不能保证所有 App/地区/账号下的后台播放、锁屏音频、PiP 或系统控制中心行为。正常媒体 CDN 不被整体阻断，videoplayback 不被 oad 规则拒绝，但会按基准条件执行 ctier 重定向。

## 开发与发布

```sh
python3 tools/build.py
python3 tools/render-module.py hmxxgit
python3 tools/render-test-modules.py
npm test
```

默认兼容脚本由固定 vendor 生成；URL Rewrite/Rule/MITM 从经过哈希校验的基准模块读取，避免手工改写语义。原 Maasea Apache-2.0 许可在 `LICENSE`，来源与适配记录见 [NOTICE.md](NOTICE.md)。

旧的 `youtube.response.js`、`youtube.request.js`、`youtube.ump.js` 及对应测试保留供历史回归，**不被当前普通/诊断模块引用**；它们通过测试不代表默认模式执行了 UMP。新增兼容专项对照规则、请求边界、ctier 替换、媒体排除及固定上游播放器/Shorts 输出。

`release.json` 指向已审查脚本提交。发布时先提交脚本，再更新该 SHA 并重新生成模块，最后一并推送；不要只改 main 脚本而不更新模块引用。模块与客户端缓存仍需刷新并确认版本。

## 视频启动延迟：已确认与待验证

已确认：v1.4 的 oad 空响应和 ctier 重定向能命中正常 initplayback；player 总是返回 bodyChanged=true，get_watch 只要非空也总是重新编码，并替换后台/PiP 对象。v1.5 排除这两种初始化改写，使用幂等字段更新，已有广告字段仍清理，所需后台/PiP 标记仍补齐，字幕和未知数据保留；无变化直接返回原响应。player 不再读取与其无关的广告/密钥缓存，get_watch 仅在确有推荐列表时读取广告缓存，推荐列表只处理一次，没有双重 Protobuf 解码或全量正文比较。

默认版本原本就未注册 UMP，所以没有证据将约 10 秒归因于本地解密/压缩/重加密。初始化被改写可能触发客户端回退，auto 引擎也可能带来启动开销，但手机上的主要等待位置仍未知。现在显式使用 JSC；响应 timeout 保持 60 秒，没有靠提前超时假装优化。UDP 拒绝维持原范围，其 QUIC→TCP 时序亦需实机观察。

轻量耗时仅在临时诊断开启，字段说明见 DIAGNOSTICS.md。request_to_response_ms 是请求脚本到响应脚本的间隔，包含网络、服务端、下载和引擎调度，不是纯网络时间；缺少稳定 ID、配对失败或存储失败时为 null，不猜测。script_ms 也不包含脚本下载/编译/引擎启动。没有真实 iPhone 时序日志，不能把本地操作次数减少声称为启动时间已经改善。

## v1.5.1 审计修复

详见 [AD_FILTER_AUDIT.md](AD_FILTER_AUDIT.md)。已复现旧自定义白名单缓存使兼容广告条目漏拦，现隔离兼容广告缓存并保留旧数据；恢复 vendor 原文 Ni/Br，诊断与按需编码位于调用者；decodeParams 恢复合法上游参数的安全读取，损坏参数仍回退默认值。没有证据表明默认参数本身导致 Ni 不执行，也没有证据证明手机唯一根因。v1.5 的初始化 oad 排除已撤回，ctier 初始化排除和无需修改不编码的性能优化保留；未引入 UMP 或新上报。
