---
title: "鸿蒙 HarmonyOS NEXT 能科学上网吗：原生代理客户端现状与侧载须知"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 代理软件
tags:
  - 客户端
  - HarmonyOS
  - VPN
  - 安全
  - Android
excerpt: "换了纯血鸿蒙之后，v2rayNG、FlClash 这类安卓 APK 没法再像以前那样直接安装了。本文讲清 HarmonyOS NEXT 为什么不兼容 APK、系统开放了哪些 VPN 能力、目前能找到哪些原生与移植客户端，以及 HAP 侧载签名的原理、限制和风险。"
index_img: /images/posts/harmonyos-proxy-clients.svg
---

> **摘要**：HarmonyOS NEXT（面向消费者发布时叫 HarmonyOS 5，之后有 6.x，2026 年 9 月 7 日正式发布的 HarmonyOS 7 已开放升级）去掉了 AOSP，不能再以原生方式安装安卓 APK，所以 v2rayNG、FlClash、Clash Meta for Android 这些老客户端都没法直接用。好在系统通过 VPN Extension 接口开放了第三方 VPN 能力，社区已经陆续出现了 ClashBox、Paws、Hey、NekoBox4Harmony 等原生客户端，以及 FlClash、Karing 的第三方移植版。问题是它们都没有在国内应用市场上架：除了个别客户端有用户反馈能从外区应用市场获取，基本只能靠「调试签名」侧载，而这种签名跟设备绑定，到期就会失效。本文先讲原理，再逐个核实这些客户端的内核、开源情况和分发方式，最后给出不装客户端也能用的替代方案。文中信息核实于 2026 年 9 月 24 日。

---

## 先确认：你的手机是哪一种「鸿蒙」

「鸿蒙手机装不上代理软件」这句话只说对了一半。「鸿蒙」这个名字下面其实有两套架构完全不同的系统，先搞清楚自己用的是哪一种，后面的讨论才有意义。

### 两代鸿蒙的根本区别

| 对比项 | HarmonyOS 2 / 3 / 4.x | HarmonyOS NEXT（HarmonyOS 5 及以后） |
|--------|------------------------|---------------------------------------|
| 系统底座 | 保留 AOSP，能跑安卓应用 | 去掉 AOSP 和 Linux 内核，改用鸿蒙自研微内核 |
| 应用格式 | APK 与鸿蒙应用并存 | 只装 HAP / .app 格式的鸿蒙原生应用 |
| 主要开发语言 | Java / Kotlin（安卓应用） | ArkTS（ArkUI），原生模块可用 C/C++ 编写 |
| 代理客户端 | 可以直接用安卓客户端 | 必须用鸿蒙原生客户端或移植版 |
| 俗称 | 「兼容安卓的鸿蒙」 | 「纯血鸿蒙」「原生鸿蒙」 |

HarmonyOS NEXT 是华为在 2023 年 8 月的开发者大会上发布的，2024 年 10 月 22 日以 HarmonyOS 5 的名义面向消费者推出。首批能用上它的机型是 2024 年 11 月 26 日发布、12 月上旬开售的 Mate 70 系列和 Mate X6，但这几款手机的标准版出厂预装的是兼容安卓的 HarmonyOS 4.3，用户可以自行选择是否升级到 HarmonyOS 5；后来华为又推出了出厂即为 NEXT 的「鸿蒙 NEXT 先锋版」。所以**同一个型号的手机，完全可能运行着两代不同的系统**，一切以设置里显示的版本号为准。HarmonyOS NEXT 基于 OpenHarmony 构建，应用框架和安卓不再兼容。

对代理用户来说，最直接的影响就是：**在 HarmonyOS 4.x 上能正常使用的 v2rayNG、Clash Meta for Android、NekoBox、FlClash，升级到 HarmonyOS 5 之后都没法再作为原生应用安装，已安装的也没法迁移过来。**

### 怎么确认自己的系统版本

1. 打开「设置」，点列表最上方的设备名称进入「关于本机」，查看「软件版本」。HarmonyOS 4.x 及更早的系统里，这个入口叫「关于手机」，字段叫「HarmonyOS 版本」；找不到时也可以在设置顶部搜索「关于」。
   - 显示 **4.x 或更早**：仍然兼容 APK，按安卓的方式使用即可，参见 [v2rayN / v2rayNG 使用指南](/posts/v2ray-clients-guide/) 和 [各平台特有问题](/posts/platform-specific/)
   - 显示 **5.x、6.x、7.x 或更高**：就是 HarmonyOS NEXT，继续往下看
2. **不要用「能不能打开 APK」来判断**。装了卓易通的 NEXT 手机，点开 APK 时可能会直接把它装进卓易通的兼容容器，这并不代表系统本身支持安卓应用。以版本号为准就够了。
3. 在中国大陆以外购买的华为手机，很多运行的是基于安卓的 EMUI，能安装 APK，不属于本文讨论的范围。
4. 鸿蒙平板、鸿蒙电脑（二合一）同样属于 NEXT 体系，用的是同一套 HAP 格式和签名机制，下文的原理对它们同样适用。

**注意**：客户端的 README 里经常出现「API 12」「API 23」这类说法，指的是系统的 API 等级，不是系统版本号。按华为开发者文档「版本说明」中的对应关系，5.1.1 对应 API 19，6.0.0 至 6.0.2 依次对应 API 20 至 22，6.1.0 对应 API 23，6.1.1 对应 API 24。HarmonyOS 7 对应的开发套件是 26.0.0，从这一版起 API 版本号改用「26.0.0」这样的 X.Y.Z 语义化格式，不再写成「6.1.1(24)」的样子，所以在较新的 README 里看到「API 26」「26.0.0」指的都是它。不少客户端对 API 等级有最低要求，安装前要先确认。

**关于 HarmonyOS 7**：截至核实时，下文客户端里只有 Karing 鸿蒙 HAP 的发布说明提到在 API 26 真机上做过安装启动验证，其他项目都没有声明是否适配 HarmonyOS 7。已经在用侧载客户端的，升级大版本前请先到对应项目的 Issue 区确认。

### 为什么安卓代理客户端不能「改个包名就用」

安卓代理客户端通常由三部分组成：

- **界面**：Kotlin/Java，或者 Flutter（FlClash、Karing 就是用 Flutter 写的）
- **内核**：Go 语言写的 mihomo、sing-box、Xray，编译成安卓可以加载的库，或者作为独立的可执行文件运行
- **系统接口**：安卓的 `VpnService`，用来创建虚拟网卡、接管全局流量

移植到鸿蒙时，这三部分都要动：

- 界面要用 ArkTS 重写，或者借助面向 OpenHarmony 的 Flutter 适配分支来运行
- Go 内核要针对 OpenHarmony 重新编译，有些项目还要打补丁。NekoBox4Harmony 的 README 提到，鸿蒙的应用沙箱不允许直接执行二进制文件，所以不能像很多安卓客户端那样把内核当作子进程启动，只能编译成动态库，在应用进程里加载
- `VpnService` 要换成鸿蒙的 `VpnExtensionAbility`，两者的生命周期和配置方式都不一样

所以鸿蒙版客户端本质上是一次重新开发，不是换个格式重新打包。这也解释了为什么主流安卓客户端的作者大多没有跟进。比如 2025 年 8 月有人在 v2rayNG 仓库提出开发鸿蒙版的需求（Issue #4841），最后被标记为「not planned」关闭了。

至于 mihomo、sing-box、Xray 这几个内核本身的区别，参见 [V2Ray vs Xray vs Sing-box：内核的区别与演进](/posts/core-comparison/) 和 [Clash 系列全解](/posts/clash-family/)。

---

## 系统给了什么：VPN Extension 能力

「鸿蒙能不能科学上网」首先是个技术问题：系统允不允许第三方应用接管网络流量？答案是允许的。

### 相关接口

在华为 / OpenHarmony 的开发者文档里，第三方 VPN 能力由两个模块组成：

| 模块 | 作用 | 起始版本 |
|------|------|----------|
| `@ohos.app.ability.VpnExtensionAbility` | 三方 VPN 的扩展能力，提供 `onCreate`、`onDestroy` 等生命周期回调 | 首批接口从 API version 11 开始支持，仅限 Stage 模型 |
| `@ohos.net.vpnExtension`（VPN 增强管理） | 启动 / 停止 VPN 扩展、创建 VPN 连接、`create()` 建立虚拟网卡、`protect()` 保护套接字、`destroy()` 销毁虚拟网络 | 首批接口从 API version 11 开始支持；之后陆续增加了 `generateVpnId`（API 20）、`protectProcessNet`（API 22），以及 26.0.0 新增的 `createVpnObserver` 等接口 |

它和安卓的对应关系大致如下：

| 能力 | Android | HarmonyOS NEXT |
|------|---------|----------------|
| VPN 服务载体 | `VpnService` | `VpnExtensionAbility` |
| 用户授权 | 首次连接时弹出系统授权框 | 调用 `startVpnExtensionAbility` 时弹出授权框，该接口返回的 Promise 不携带授权结果；从 26.0.0（HarmonyOS 7）起，才能通过 `createVpnObserver()` 创建观察者、用 `onAuthorizationResult` 监听用户是否同意 |
| 防止代理自身流量回环 | `protect(socket)` | `protect()` 让指定套接字直接走物理网络；较新版本还有针对整个进程的 `protectProcessNet()` |
| 分应用代理 | `addAllowedApplication` / `addDisallowedApplication` | `VpnConfig` 中的 `trustedApplications` / `blockedApplications`，两者互斥 |

### 和系统设置里的「VPN」不是一回事

鸿蒙的「设置」里本身就有添加 VPN 的入口，但那是系统内置的标准 VPN 客户端。华为官网关于鸿蒙电脑 / 二合一平板使用 VPN 的说明里，列出的类型包括 IKEv2/IPSec、L2TP/IPSec、IPSec Xauth / Hybrid 的若干变体，以及只支持配置部分参数的 OpenVPN，都属于传统 VPN 协议；页面还注明，设置中添加的系统 VPN 同一时间只能连接一个。

机场和自建节点常用的 Shadowsocks、VMess、VLESS、Trojan、Hysteria2 等都是代理协议，不在这个列表里，没法填进系统 VPN 设置。这类协议必须由第三方应用通过 VPN Extension 创建虚拟网卡，再由应用内置的内核去处理。这就是为什么「系统支持 VPN」不等于「系统能直接用机场订阅」。协议之间的区别可以参考 [主流代理协议横向对比](/posts/protocol-comparison/)。

### 几个值得注意的限制

文档中 `VpnConfig` 的字段有明确的数量上限，API 23 前后有所不同：

| 字段 | 含义 | API 23 之前 | API 23 及以后 |
|------|------|-------------|---------------|
| `addresses` | 虚拟网卡地址 | 最多 64 个 | 最多 2000 个 |
| `routes` | 路由条目 | 最多 1024 条 | 最多 10000 条 |
| `trustedApplications` / `blockedApplications` | 分应用白名单 / 黑名单 | 最多 64 个包名 | 最多 256 个包名 |
| `mtu` | 最大传输单元 | 576 – 1500 | 同左 |

这些数字对使用体验有实际影响：

- **路由条目上限**：想靠系统路由表「绕过中国大陆 IP」（几千条 CIDR）的做法，在旧版本上会碰到上限。所以鸿蒙客户端通常把全部流量导进 TUN，再由内核按规则分流，这和桌面端 TUN 模式的思路一致，参见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。
- **分应用名单上限**：64 个包名对大多数人够用，但如果你习惯用黑名单排除大量国内应用，在旧版本上可能不够。
- **后台存活**：接口虽然开放了，系统对后台进程的管理依然严格。ClashBox 早期的发布说明里多次提到「VPN 被系统回收」的问题，项目方认为这是系统层面的原因，并为此加了「核心恢复」和「模拟后台」（借助画中画维持前台状态）之类的规避手段。
- **模拟器支持不一**：各项目的说法并不一致。NekoBox4Harmony 的 README 称模拟器不支持 VPN 扩展、必须用真机；Hey 的 README 称部分模拟器或系统镜像缺少 VPN 授权组件；Karing 鸿蒙 HAP 的更新日志则称在 API 23/24 的 x86_64 模拟器上跑通了 VPN 启动流程。能不能在模拟器里用，取决于具体镜像。对普通用户来说，实际效果仍以真机为准。

### 接口开放不等于可以上架

文档写明了接口可用，但应用能不能进入应用市场是另一回事，要受应用市场审核规则的约束。这正是鸿蒙代理客户端大多只能侧载的原因。ClashBox 在 2025 年 7 月的发布说明里提到，由于 AppGallery 审核，他们不得不放弃「ClashNEXT」这个名称和图标。从这件事也能看出，上架审核对这类应用有实际约束。

---

## 目前能找到的客户端

下面逐一核实各个客户端。先说明两个概念：

- **原创项目**：作者专门为鸿蒙开发、自己发布的应用。
- **第三方移植**：别人把某个已有的安卓或跨平台客户端移植到鸿蒙，**与原项目作者无关**，原作者不对其负责。

所有信息来自各项目的 GitHub 仓库、README 和 Releases 页面，核实时间为 2026 年 9 月 24 日。

### ClashBox（原名 ClashNEXT）

- **仓库**：xiaobaigroup/ClashBox，2025 年 2 月创建，首个公测版 1.2.3 于 2025 年 2 月 23 日发布
- **内核**：修改版 mihomo（Clash Meta）。首个版本的说明写的是移植了 FlClash 使用的内核，1.3.3 版本又加入了「FlClash 前台模式」
- **开源情况**：仓库许可证为 GPL-3.0。master 分支的 README 至今仍写着仓库只含前端、改版后端暂不开源；但核实时 master 分支里已经有 `proxy_core` 模块，并以 Git 子模块的形式引用了两个公开仓库：xfz347/Clash.Meta（fork 自 FlClash 使用的 chen08209/Clash.Meta）和 likuai2010/gvisor-ohos。这些公开代码能否构建出与发布版 HAP 一致的内核，本文无法确认，因此按**源码不完整**看待
- **分发方式**：
  - 2025 年 5 月的 1.4.7 版说明称应用已上架鸿蒙海外市场，GitHub 今后基本不再提供 HAP
  - 实际上此后 GitHub 的发布频率明显下降，只出过两个版本，且都附带 HAP：2025 年 7 月的 ClashNEXT LTS 1.5.1（说明中提到因 AppGallery 审核要放弃原名），和 2026 年 4 月的 1.7.4「ClashBox LTS (V1)」（文件名带 unsigned，即**未签名 HAP**，需要自行签名侧载）
  - 应用市场渠道见下文
- **最低系统**：1.2.4 版起最低兼容 API 12
- **特点**：用 ArkTS 原生开发，README 称适配手机、平板、折叠屏和鸿蒙电脑；有「兼容模式」，用于处理出境易、卓易通等安卓容器里的应用无法走代理的问题

ClashBox 是鸿蒙上出现最早的代理客户端之一，GitHub 星标已有数千。它的内核虽然有了公开的子模块，但官方说法仍是后端没有完全开源，这意味着**无法确认发布版里的内核就是公开的那份代码**。

关于应用市场渠道：Issue #97（2025 年 11 月）的用户提到，从海外应用市场下载的 ClashBox 能给出境易里的应用代理，自签侧载的版本却不行，两者权限表现不同；Issue #150（2026 年 6 月起）有多名用户反馈，使用非中国大陆地区的华为账号，或者让应用市场通过境外 IP 访问，就能直接搜到并安装 ClashBox。走应用市场安装不涉及调试签名，也就没有到期重签的问题。需要注意三点：上架地区本文没能通过官方渠道核实，请以实际搜索结果为准；这条路本身需要先有一个可用的代理，存在「先有鸡还是先有蛋」的问题；修改华为账号的国家或地区可能影响账号下的其他服务，操作前请先阅读华为的相关说明。

### Paws

- **仓库**：richerfu/Paws，2026 年 5 月创建，2026 年 7 月发布 1.0.0，9 月发布 1.1.0
- **内核**：[meow-rs](https://github.com/meow-rs/meow-rs)，一个用 Rust 重新实现的 mihomo 兼容内核（**不是** MetaCubeX 官方的 mihomo）
- **开源情况**：MIT 许可，完全开源
- **分发方式**：Releases 提供 arm64-v8a、armeabi-v7a、x86_64 三种架构的**未签名 HAP**，并附 SHA256SUMS 校验文件
- **系统要求**：README 称目标为 HarmonyOS 6.1，兼容 6.0.2
- **特点**：ArkUI 原生界面；用 Rust 实现的用户态 TUN 协议栈（可选 smoltcp 或 lwIP）；支持 Clash YAML、base64 订阅和常见分享链接

Paws 的技术路线比较特别：内核不是 Go 写的 mihomo，而是 Rust 重写版。好处是体积和性能可能更好，风险是配置兼容性和行为细节未必与 mihomo 完全一致。如果你的订阅用了比较新或冷门的 mihomo 特性，需要自己测试。

### Hey

- **仓库**：popsiclelmlm/Hey，2026 年 6 月创建
- **内核**：Xray 为正式运行时，sing-box 是预览运行时，目前只支持有限的配置
- **开源情况**：GPL-3.0，开源
- **分发方式**：**只提供源码，不提供任何预编译包**，也没有应用内更新，需要自己用 DevEco Studio 配置签名并编译
- **系统要求**：目标 SDK 6.0.1(21)，兼容 5.1.1(19)
- **定位**：README 自称是「网络隧道与协议调试客户端」，不内置任何服务器地址、配置来源、规则集或地区预设，一切都要用户自己提供

Hey 的门槛最高，但也最透明：没有预编译包，也就不存在「二进制和源码对不上」的问题。它适合有开发环境、愿意自己编译的用户。

### NekoBox4Harmony

- **仓库**：xiaoli8571/NekoBox4Harmony，2026 年 8 月底创建，9 月迭代频繁
- **内核**：sing-box，带 OHOS 补丁，编译成 C 共享库，由应用在 VPN 进程内通过 dlopen 加载，而不是作为独立子进程运行。1.9.0 版（2026 年 9 月 8 日）起内核从 1.11.9 升级到 1.14.0，README 里写的 1.11.9 是旧版描述
- **开源情况**：源码公开，README 称沿用 sing-box 的 GPL-3.0（GitHub 仓库页面没有识别出许可证文件）。需要注意，编好的内核文件 `libsingbox.so` 是以预编译形式直接提交在仓库里的，照 README 克隆后构建，用的就是这个现成的 .so；想完全审计，得按其文档自己重新编译内核
- **分发方式**：Releases 提供**未签名 HAP**，需要自行签名（README 的说法是在 DevEco Studio 中签名）。1.9.1 版起更换了包名，从更早的版本升级要先卸载旧版，卸载会清空应用数据
- **测试环境**：README 写明需要真机，作者的测试设备运行 HarmonyOS 6.1.1（API 24）
- **与 NekoBox 的关系**：README 说明它参考了 NekoBoxForAndroid 的架构思路并沿用了其图标，**不是 NekoBox 官方项目**
- **维护状态**：作者在 2026 年 9 月 24 日更新 README，称后续主要精力转向新项目 Nexus-VPN-HarmonyOS，本仓库改为不定期更新。新项目改用 mihomo 内核（同样以共享库形式在进程内加载），仓库里的 HAP 同样是未签名的；作者还称 Nexus 正在推动在港区应用市场上架，本文未能核实

名字里有「NekoBox」，但它是一个独立的新项目。创建不到一个月，它已经换过内核版本、换过包名，现在又把重心转到了另一个仓库，今后的更新渠道可能还会变化。

### FlClash-ohos

- **仓库**：tljk/FlClash-ohos，从 chen08209/FlClash fork 而来，2026 年 7 月创建
- **内核**：mihomo（Clash Meta）。鸿蒙发布分支的子模块指向移植者自己维护的 tljk/Clash.Meta，而不是 FlClash 上游使用的内核仓库，也就是说它带有移植者自己的修改，这部分源码同样公开
- **开源情况**：GPL-3.0，继承自上游
- **分发方式**：自 2026 年 8 月起在 Releases 提供带 `-ohos` 后缀的 HAP 文件（ARMv8），并附 SHA256SUMS 校验文件；9 月仍在频繁发布修复版本
- **官方状态**：FlClash 官方 README 列出的支持平台是 Android、Windows、macOS 和 Linux，**没有鸿蒙**。这是**第三方移植**

仓库的主要语言仍是 Dart，说明它保留了 FlClash 的 Flutter 代码，再做鸿蒙适配。README 基本沿用上游内容，没有专门的鸿蒙安装说明；Releases 里的 HAP 是否已签名、要求什么 API 等级，页面上也没有写清楚。

### Karing 的第三方 HAP 移植

- **仓库**：ks-lm-kf/harmony-kslmkf-karing-hap，2026 年 6 月创建
- **内核**：基于 KaringX 维护的 sing-box 分支
- **开源情况**：**不开源**。仓库只发布二进制文件，README 自己承认，在没有附带对应源码、构建脚本和许可证文件的情况下，不应视为已完成 GPL 合规
- **分发方式**：Releases 提供 HAP，并附 SHA256；要求 API 23（HarmonyOS 6.1.0）及以上。2026 年 9 月 24 日发布的 1.10.0 版说明称已在 API 26 真机上完成安装启动验证
- **官方状态**：README 明确要求不要把它描述为官方 Karing 或 sing-box 发行版。Karing 官方仓库列出的平台是 Windows、Android、Linux、iOS、macOS、tvOS，**没有鸿蒙**

这个移植版需要特别谨慎：上游是 GPL 项目，移植者却只给二进制，而且自己承认合规上有缺口。对普通用户来说，更实际的问题是**无法审计**。代理客户端能看到你的全部流量，一个来源不透明的二进制文件，本身就是风险。

### 未列入的客户端

除了上面这些，还有一些闭源、宣称支持鸿蒙的跨平台客户端，比如部分客户端目录里列出的 MConnect。本文检索时没有找到能说明其鸿蒙版本发布渠道、内核和开发者身份的一手资料，所以没有列入对比表。遇到这类客户端，建议先按 [代理客户端安全自查](/posts/client-safety-check/) 里的思路自己评估。

### 对比表

| 客户端 | 内核 | 开源 | 官方 / 第三方 | 安装方式 | 最低系统 | 备注 |
|--------|------|------|---------------|----------|----------|------|
| ClashBox（原 ClashNEXT） | 修改版 mihomo | 源码不完整（有内核子模块，但官方仍称后端未完全开源） | 原创项目 | 外区应用市场（用户反馈可装）；或未签名 HAP 自签侧载 | API 12 | 出现最早，有核心恢复、兼容模式 |
| Paws | meow-rs（Rust 版 mihomo 兼容内核） | 开源（MIT） | 原创项目 | 未签名 HAP，三种架构，附 SHA256SUMS | 6.0.2（API 22），目标 6.1 | 用户态 TUN |
| Hey | Xray（正式）、sing-box（预览） | 开源（GPL-3.0） | 原创项目 | 仅源码，需自行编译签名 | 5.1.1（API 19） | 定位为协议调试工具，不内置任何配置 |
| NekoBox4Harmony | sing-box 1.14.0（进程内动态库；1.9.0 之前为 1.11.9） | 源码公开，内核 .so 为预编译 | 独立项目，非 NekoBox 官方 | 未签名 HAP，需自签 | 未写明（作者测试环境 6.1.1 / API 24） | 2026 年 8 月新项目；作者已把主要开发转到 Nexus |
| FlClash-ohos | mihomo（移植者自维护的 Clash.Meta 分支） | 开源（GPL-3.0） | 第三方移植，非 FlClash 官方 | Releases 提供 ohos HAP，附 SHA256SUMS | 未写明 | 缺少鸿蒙专属安装文档 |
| Karing 鸿蒙 HAP | KaringX 版 sing-box | 不开源 | 第三方移植，非 KaringX 官方 | Releases 提供 HAP，附 SHA256 | API 23（6.1.0） | 自认未提供 GPL 对应源码 |

「最低系统」一列取自各项目 README 或发布说明；HarmonyOS 7 的适配情况见前文的说明。

从仓库创建时间可以看出：除 ClashBox 外，其余项目都是 2026 年 5 月以后才出现的。鸿蒙代理客户端生态仍处在早期，变化很快，几个月后这张表很可能就过时了。

---

## HAP 侧载：原理、限制与风险

鸿蒙客户端大多没有上架应用市场，所以绕不开「侧载」。这部分只讲原理和风险，不写逐步教程。

### 为什么鸿蒙不能「下载即装」

在安卓上，开发者用自己生成的密钥给 APK 签名就能分发，用户打开「允许安装未知来源」即可安装，系统不关心签名者是谁。（这一点在安卓上也正在变化：Google 宣布，自 2026 年 9 月 30 日起，巴西、印尼、新加坡、泰国的 Google 认证安卓设备只允许安装由已验证开发者登记的应用，2027 年起扩展到全球；通过 ADB 或高级安装流程安装不受此限制。）

鸿蒙的签名体系完全不同。根据华为开发者文档，HarmonyOS 软件包签名必须用到证书和 Profile，签名完成后本地会有四样东西：

| 文件 | 格式 | 作用 |
|------|------|------|
| 密钥库 | .p12 | 存放签名用的公私钥对，开发者本地生成 |
| 证书请求 | .csr | 用公钥向 AppGallery Connect（AGC）申请证书 |
| 数字证书 | .cer | **由 AGC 颁发**，分调试、发布等类型 |
| Profile | .p7b | 包含包名、证书信息、权限等；调试 Profile 还包含**允许安装的设备列表** |

证书类型决定了安装方式：

- **调试证书 + 调试 Profile**：文档写明用于「本地通过 HDC 命令安装」的场景，Profile 里要指定调试设备
- **发布证书 + 发布 Profile**：用于上架应用市场，要走审核
- 另有「指定设备发布」「In-house 发布」等形式，同样要登记设备，或者需要企业资质、受限开放

所以对普通用户来说，侧载实际上就是「把自己的手机登记为某个开发者账号的调试设备，然后以调试身份安装应用」。

设备通过 UDID 识别。官方文档给出的获取方式是在电脑上用 hdc 工具执行命令。hdc 默认不在系统 PATH 里，要先进入它所在的目录；同时连着多台设备或开着模拟器时，还需要指定设备：

```bash
# 手机：设置 → 系统 → 开发者选项 → 打开「USB 调试」，连接电脑后在手机上确认授权
# 电脑：先进入 hdc 所在目录，一般是 DevEco Studio 安装目录下的 sdk/default/openharmony/toolchains
hdc list targets            # 确认只连着一台设备，必要时先关掉模拟器
hdc shell bm get --udid     # 输出的一长串字符就是 UDID

# 连着多台设备时，把 CONNECT_KEY 换成 list targets 列出的设备标识
hdc -t CONNECT_KEY shell bm get --udid
```

UDID 是一串由 64 个字符组成的字母数字串，登记到 AGC 的设备列表后，才能被选进 Profile。换一台手机，就得重新生成 Profile、重新签名。

### 官方文档里写明的限制

| 限制 | 官方说法（要点） |
|------|------------------|
| 需要华为账号 | DevEco Studio 自动签名需要先登录（Sign In），证书和 Profile 实际上是向 AGC 申请的 |
| 设备绑定 | 自动签名时，所有已连接设备的信息都会写进证书文件；手动申请调试 Profile 时要从已注册设备中选择 |
| 数量上限 | 每个账号最多申请 3 个调试证书；一个账号最多管理 100 台设备；一个应用最多 100 个 Profile |
| 时间校验 | 使用自动签名前，本地系统时间要与北京时间（UTC+8）一致，否则签名失败 |
| 地区限制 | DevEco Studio 6.1.1 Beta1 以下版本，「关联注册应用」的自动签名仅支持中国境内（不含港澳台）；6.1.1 Beta1 及以上支持各国家和地区 |
| 过期后果 | **调试包在安装和运行时都会校验证书，过期后既不能安装，也不能运行**；上架应用市场的正式包过审后不再校验有效期 |

最后一条对日常使用影响最大：侧载的客户端到期就打不开，必须重新签名、重新安装。

具体有效期是多长，华为文档没有在这些页面给出统一数字，签名后可以在 DevEco Studio 里把鼠标悬停在 Profile 上查看。ClashBox 的 README 称，自签侧载的应用默认只有 14 天有效期，完成开发者实名认证后可以延长到 180 天；它还说华为签名服务器会屏蔽中国大陆以外的 IP。这些是项目方的说法，官方文档只写了上表中与 DevEco Studio 版本相关的地区限制，实际情况请以签名时显示的有效期和提示为准。

### 常见的侧载工具

目前常见的有三类：

- **华为官方开发工具**：DevEco Studio（IDE，支持自动签名和手动签名）、DevEco Testing 等
- **命令行工具**：hdc，随 DevEco Studio 的 SDK 提供，可以安装已签名的 HAP
- **第三方封装工具**：比如 GitHub 上的 Auto-installer（likuai2010/auto-installer），2025 年春改名为「小白调试助手」。它的 README 称基于 OpenHarmony 的 hdc 工具，支持安装 .hap / .hsp / .app 文件和更换证书。**但要注意，这个仓库里只有 README 和两张打赏二维码，没有任何源码，程序以二进制形式从 Releases 分发，外人无法审计。** 它恰恰要用到你的华为账号和手机调试通道，使用前请按下文的风险清单自行评估，不要在里面登录主力账号。也有一些工具把「登录账号、申请证书、签名、安装」整个流程自动化，面临同样的问题

无论用哪种工具，原理都一样：**用某个华为账号申请调试证书和 Profile，把你的设备登记进去，签名后通过调试通道安装。**

还有一个容易误解的地方：DevEco Studio 图形界面里的签名配置（Signing Configs）是给自己打开的工程构建时用的，并不能直接「打开一个别人发布的 HAP 然后签名」。对 Releases 里现成的未签名 HAP，华为文档给出的做法是用 SDK 自带的签名工具 hap-sign-tool.jar，执行 sign-app 命令，配合密钥库、证书和 Profile 完成签名；而且 Profile 里登记的包名必须和这个 HAP 的包名（bundleName）一致，否则签完也装不上。

### 风险清单

| 风险 | 说明 | 建议 |
|------|------|------|
| 来源可信度 | 未签名 HAP 谁都能重新打包；闭源二进制无法审计；fork 和移植版与原作者无关 | 只从项目官方仓库的 Releases 下载，核对 SHA256；优先选择源码公开的项目 |
| 账号授权 | 自动签名需要登录华为账号，第三方工具如果代你登录，就会接触你的账号凭据或授权 | 不要在来路不明的工具里登录主力华为账号；能用官方 DevEco Studio 就尽量用它 |
| 证书过期 | 调试签名到期后应用无法运行，要重签重装 | 记下到期时间；提前导出客户端的配置和订阅 |
| 重装丢数据 | 不少版本要求「卸载旧版再装新版」，卸载会清空应用数据 | 更新前备份配置文件、订阅链接和自定义规则 |
| 系统更新 | 系统升级可能改变 API 行为，旧 HAP 可能闪退或 VPN 失效 | 大版本升级前确认客户端已适配；不急着当第一批升级的人 |
| 开发者模式 | 长期开着开发者选项和 USB 调试，手机丢失或连接陌生电脑时风险更高 | 装完就关掉 USB 调试；不要连接不信任的电脑或公共充电桩 |
| 服务条款 | 调试签名是为开发调试设计的，拿来长期日常使用是否符合华为开发者相关协议，需要自己判断 | 阅读 AGC 与开发者协议；接受账号可能因此受限的风险 |

**特别提醒**：代理客户端能看到并转发你的全部网络流量，对它的信任要求比一般应用高得多。「能装上」和「值得信任」是两回事。完整的评估方法见 [代理客户端安全自查](/posts/client-safety-check/)。

---

## 不装客户端的替代方案

如果你不想折腾签名，或者不想在手机上装无法审计的二进制文件，还有几条路可以走。

### 方案一：在路由器层面做透明代理

在家里的主路由或旁路由上运行 OpenClash 之类的方案，所有连这个 Wi-Fi 的设备都会自动走代理，手机上什么都不用装。鸿蒙手机、智慧屏、平板都能一并覆盖。

- **优点**：完全不用侧载；一次配置，全家设备都能用
- **缺点**：只在这个 Wi-Fi 下有效，出门用移动数据就没有代理了；需要一台能刷 OpenWrt 的路由器或一台常开的小主机

具体做法见 [软路由与旁路由](/posts/soft-router-guide/)。OpenClash 在 mihomo 生态中的位置，可以参考 [Clash 系列全解](/posts/clash-family/)。

### 方案二：借用局域网内另一台设备的代理

如果家里有一台常开的电脑，本来就在运行 mihomo 系客户端（比如 Clash Verge Rev），可以让它对局域网开放代理端口，再在鸿蒙手机的 Wi-Fi 设置里手动填这台电脑的地址。

华为开发者文档中讲 Charles 抓包的 FAQ 已经给出了鸿蒙真机的操作方式：点击要连接的 Wi-Fi 进入密码输入页，在输入密码之前点击「代理」，选择「手动」，填写代理服务器的主机名和端口。这个入口是在「首次连接」时出现的，如果家里的 Wi-Fi 已经保存过，可以先在 WLAN 列表里把它删除（不保存），重新连接时再在密码页设置代理。

电脑这边分两种情况：

**如果用的是 Clash Verge Rev**，不要去改 YAML 里的端口和 allow-lan。这两个字段由应用接管，每次合并配置后都会被界面里的设置覆盖，写进订阅或扩展配置都不生效。正确做法是到「设置 → Clash 设置」打开「局域网连接」，再到「端口设置」里查看「混合代理端口」。Clash Verge Rev 的默认混合端口是 **7897**，不是很多老教程里写的 7890，手机上要填你实际看到的端口。下面的 `lan-allowed-ips` 白名单不属于应用接管的字段，可以写进全局扩展配置（Merge）。界面操作参见 [Clash Verge Rev 使用指南](/posts/clash-verge-guide/)，端口一律以应用里实际显示的为准。

**如果直接运行 mihomo 内核**，或者所用客户端允许手改这些字段，可以参考下面的配置：

```yaml
mixed-port: 7890
allow-lan: true
bind-address: "*"
# lan-allowed-ips 是白名单，写了就会整个替换默认的「全部放行」
# 本机回环地址也要受它检查，必须保留，否则电脑自己的系统代理会被拒绝
lan-allowed-ips:
  - 127.0.0.1/8
  - ::1/128
  - 192.168.1.0/24   # 改成你家实际的局域网网段
```

特别提醒：mihomo 对回环地址没有豁免。如果白名单只写局域网网段、漏掉 127.0.0.1 和 ::1，结果会是手机能用了，电脑本机走系统代理的程序反而断网。

然后在手机上把代理主机名填成电脑的局域网 IP（比如 `192.168.1.10`），端口填客户端实际的混合端口。字段含义见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

这个方案有几点需要清楚：

- **只是 HTTP 代理**：Wi-Fi 手动代理只对遵循系统代理设置的应用有效，不是 TUN 那种全局接管。华为那篇 FAQ 也写明，`@ohos.request` 模块的上传下载接口不支持通过 Charles 抓包，可见并非所有流量都会走这个代理
- **只对这一个 Wi-Fi 生效**：换网络或用移动数据就失效了
- **电脑要一直开着**，并且和手机在同一个局域网
- **电脑防火墙**：allow-lan 只是让内核监听局域网地址，操作系统防火墙放不放行入站连接是另一回事。Windows 上需要允许代理程序在「专用网络」上接受入站连接，并确认当前 Wi-Fi 的网络类型是「专用」；不要为「公用网络」放行。首次开启局域网连接时如果弹出防火墙提示，按这个原则选择
- **安全**：`allow-lan` 会让代理端口对局域网开放。在公共网络或多人共用的网络里，务必用 `lan-allowed-ips` 限制来源（记得保留本机回环地址），或者干脆不开。手机的 Wi-Fi 代理设置一般没有地方填用户名和密码，所以靠 `authentication` 认证的方式在这里可能行不通

### 方案三：浏览器层面的代理

在桌面系统上，很多人用浏览器扩展单独给浏览器设代理。但在 HarmonyOS NEXT 手机上，本文没有找到系统浏览器提供独立代理设置的官方说明。实际能用的办法基本就是上面的 Wi-Fi 手动代理，由浏览器遵循系统的 HTTP 代理设置。

也就是说，「只让浏览器走代理」在鸿蒙手机上目前不是一个独立可行的方案。如果只是临时查点资料，方案二已经够用了。

### 方案四：安卓兼容容器（不推荐依赖）

卓易通、出境易这类第三方应用提供了一个隔离的安卓容器，能运行部分安卓应用，但通知、分辨率、文件互通等方面都有已知限制。在容器里运行安卓代理客户端，能否正常创建 VPN、能否接管容器外鸿蒙原生应用的流量，都没有官方保证。ClashBox 专门做了「兼容模式」来处理容器内应用的代理问题，这本身就说明容器流量是一个需要单独处理的特例。这条路可以当作临时手段，但不建议依赖。

### 替代方案对比

| 方案 | 需要侧载 | 覆盖范围 | 移动数据可用 | 主要代价 |
|------|----------|----------|--------------|----------|
| 原生客户端（侧载） | 是 | 全局（VPN） | 是 | 签名过期、来源审计 |
| 原生客户端（外区应用市场） | 否 | 全局（VPN） | 是 | 目前只见 ClashBox 的用户反馈；获取时需要已有代理或外区账号 |
| 路由器透明代理 | 否 | 连接该 Wi-Fi 的所有设备 | 否 | 需要合适的硬件 |
| 局域网共享 + Wi-Fi 手动代理 | 否 | 遵循系统代理的应用 | 否 | 电脑常开；只是 HTTP 代理 |
| 浏览器单独代理 | — | — | — | 目前没有独立可行的路径 |
| 安卓兼容容器 | 否 | 不确定 | 不确定 | 无官方保证，行为不稳定 |

---

## 怎么选：一个决策思路

1. **先确认系统版本**。如果还是 HarmonyOS 4.x，直接用安卓客户端，本文的大部分内容都用不上。
2. **只在家里用？** 优先考虑路由器透明代理或局域网共享，手机上什么都不用装，风险最小。
3. **出门也要用？** 先看能不能通过外区应用市场安装（目前有用户反馈 ClashBox 可以，具体见上文的注意事项），这样可以避开调试签名到期的问题；不行再考虑侧载原生客户端。无论走哪条路，都在候选里按下面的顺序筛选：
   - 源码是否公开？看不到源码的，默认信任度降一档
   - 是原创项目，还是和原作者无关的移植？
   - 最近几个月有没有更新？可以在仓库页面看最后提交时间
   - 你的系统版本（API 等级）是否满足要求？
   - 你能不能接受定期重签、可能丢配置的维护成本？
4. **侧载之前**，先把订阅链接和自定义规则保存在别处，并确认自己知道怎么查看签名的到期时间。
5. **装好之后**，关掉 USB 调试，只从项目官方仓库获取更新。

如果你同时在用其他平台，可以对照 [2026 各平台客户端推荐](/posts/client-recommendations-2026/) 统一内核和配置格式，比如都用 mihomo 系，订阅和规则就能通用。想了解这些客户端的来龙去脉，可以看 [代理客户端演进史](/posts/proxy-client-history/)。

---

## 时效声明与自行核实方法

**本文所有客户端信息核实于 2026 年 9 月 24 日。** 鸿蒙生态和这些项目都变化极快：新项目会出现，旧项目会改名、归档或删库，上架状态也会变。请以各项目官方仓库的最新说明为准。

你可以用下面的方法自己快速确认一个项目的状态：

| 想确认什么 | 去哪里看 |
|-----------|----------|
| 是否还在维护 | 仓库首页的最近提交时间；是否标记为 Archived |
| 最新版本和安装包 | Releases 页面：看发布日期、文件名里是否有 unsigned、有没有 SHA256 |
| 是否开源、用什么许可证 | 仓库的 LICENSE 文件和 README 中的说明 |
| 是否官方 | 原项目（FlClash、Karing、NekoBox 等）官方仓库的支持平台列表 |
| 系统接口与 API 等级 | 华为开发者文档的「版本说明」，以及 VPN 扩展相关 API 的起始版本标注 |

---

## 常见问题（FAQ）

### 纯血鸿蒙能不能直接装 v2rayNG 的 APK？

不能作为原生应用安装。HarmonyOS 5 及以后的系统没有 AOSP 运行环境，APK 最多只能装进卓易通这类兼容容器，能不能装以卓易通的实际支持为准。即使装进去了，代理客户端在容器里能否创建 VPN、能否接管容器外鸿蒙原生应用的流量，都没有保证。想正常使用 v2rayNG 这类客户端，要么设备还停留在 HarmonyOS 4.x，要么改用鸿蒙原生客户端或替代方案。

### 为什么 v2rayNG、FlClash、Karing 的作者不出官方鸿蒙版？

鸿蒙版几乎等于重新开发：界面、内核编译方式、VPN 接口都要重做。开发完了还面临上架审核的问题，大多数用户只能侧载，维护成本高、覆盖用户少。截至核实时，FlClash 和 Karing 官方仓库的支持平台列表里都没有鸿蒙，v2rayNG 的相关 Issue 被标记为「not planned」。市面上带这些名字的鸿蒙版本，都是第三方移植或名称相近的独立项目。

### 系统设置里自带的 VPN，能直接填机场节点吗？

不能。系统内置 VPN 面向的是 IKEv2/IPSec、L2TP/IPSec、IPSec Xauth / Hybrid 和 OpenVPN（仅支持部分参数）这类传统 VPN 协议，而机场节点用的是 Shadowsocks、VLESS、Trojan、Hysteria2 等代理协议，两者不是一回事。代理协议必须由第三方客户端通过 VPN Extension 接口建立虚拟网卡、再由内置内核处理。如果你的服务商恰好提供 IKEv2、OpenVPN 这类标准 VPN 账号，那是另一种服务，和本文讨论的代理客户端无关。

### 侧载的客户端用了一段时间突然打不开了，怎么回事？

最常见的原因是调试签名过期。华为文档写明，调试包在安装和运行时都会校验证书，过期后既不能安装，也不能运行。解决办法是重新签名、重新安装。重装前先备份配置，因为卸载会清空应用数据。另一种可能是系统更新后接口行为变了，尤其是升级到 HarmonyOS 7 这样的大版本之后，这时要等客户端适配新版本。

### 用第三方签名工具安全吗？

要分两层看。一是工具本身：它会接触你的华为账号授权和手机的调试通道，来源要可信；像只发二进制、不公开源码的工具，你没法知道它拿到授权后做了什么。二是被安装的 HAP：工具只负责签名和安装，不会替你检查 HAP 有没有问题。比较稳妥的做法是：尽量用华为官方的 DevEco Studio；不在来路不明的工具里登录主力账号；只安装从项目官方仓库下载、并核对过 SHA256 的包。

### 升级到 HarmonyOS 5 之后还能退回 4.x 吗？

华为官网有「HarmonyOS 5 及以上设备回退到 4.x 后，通过华为手机助手恢复数据」的教程，说明部分机型存在官方回退路径。但页面同时写明，系统设置项、应用及应用数据（例如微信、QQ）不在可恢复范围内，对机型和首发系统版本也有要求。能否回退、支持哪些机型，请以华为官网和官方服务渠道为准。**回退前务必完整备份，并做好数据丢失的准备**。为了用代理软件而回退系统，得失需要自己权衡。

### 开着代理客户端，为什么有些鸿蒙原生应用还是不走代理？

可能的原因有几个：客户端配置了分应用名单，这个应用不在里面；规则把它的域名判成了直连；或者客户端在接管某些原生应用流量时存在兼容问题。ClashBox 的 Issue 区就有用户反馈过，在 HarmonyOS 6.0 平板上，只有容器内的应用走了代理，原生浏览器没有走。排查时先切到全局模式测试，确认是规则问题还是接管问题，再去对应项目的 Issue 区搜索相同的系统版本。通用的排查思路见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)。

---

## 外部参考

- [HarmonyOS NEXT - Wikipedia](https://en.wikipedia.org/wiki/HarmonyOS_NEXT) — 发布时间线、与 AOSP 的关系、安卓兼容容器
- [华为公布 Mate 70 系列、Mate X6 手机鸿蒙 4.3 / NEXT 功能差异（IT之家，经网易转载）](https://m.163.com/dy/article_cambrian/JIG11AAA0511B8LM.html) — 首批机型出厂系统与可选升级
- [HarmonyOS 版本说明（全部版本）](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-allversion) — 系统版本与 API 等级对应关系、26.0.0 版本号格式调整
- [华为鸿蒙 HarmonyOS 7 操作系统正式发布（IT之家，2026-09-07）](https://www.ithome.com/0/999/277.htm) 与 [HarmonyOS 开发套件 26.0.0 发布（IT之家，2026-08-29）](https://www.ithome.com/0/996/013.htm) — HarmonyOS 7 发布与 API 版本号改为语义化格式
- [华为手机如何查看软件版本](https://consumer.huawei.com/cn/support/content/zh-cn16092083/) — 「关于本机 → 软件版本」的入口，适用 HarmonyOS 5.0 至 7.0
- [HarmonyOS 5 及以上应用下载安装介绍](https://consumer.huawei.com/cn/support/content/zh-cn16061787/) — APK 安装包能否安装以卓易通实际支持为准
- [ohos.net.vpnExtension（VPN 增强管理）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-net-vpnextension) — 华为开发者文档，VPN 扩展接口，含 26.0.0 新增的 createVpnObserver
- [OpenHarmony 文档：js-apis-net-vpnExtension.md](https://gitee.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-network-kit/js-apis-net-vpnExtension.md) — VpnConfig 字段、数量上限与各接口起始版本
- [OpenHarmony 文档：js-apis-VpnExtensionAbility.md](https://gitee.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-network-kit/js-apis-VpnExtensionAbility.md) — VpnExtensionAbility 生命周期与起始版本
- [华为鸿蒙电脑 / 二合一平板电脑如何使用 VPN](https://consumer.huawei.com/cn/support/content/zh-cn16051333/) — 系统内置 VPN 支持的协议类型
- [自动签名 - DevEco Studio](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing-auto) — 自动签名的前提、时间与地区限制
- [手动签名 - DevEco Studio](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing-manual) — 证书、Profile 与设备列表的概念
- [证书和 Profile 类型及使用场景](https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-appgallery-81) — 证书类型与调试证书数量上限
- [应用证书到期后的影响及处理方式](https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-appgallery-82) — 调试包过期后无法安装和运行
- [注册设备 - AppGallery Connect](https://developer.huawei.com/consumer/cn/doc/app/agc-help-add-device-0000002283189937) — UDID 获取、hdc 所在目录与设备数量上限
- [通过 DevEco Studio 对 HAP/APP 包进行签名](https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-signature-service-17) — 用 hap-sign-tool.jar 的 sign-app 命令签名成品包
- [如何使用 Charles 工具抓包](https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-network-55) — 鸿蒙真机 Wi-Fi 手动代理的设置方式
- [HarmonyOS 5 及以上版本设备数据恢复至 HarmonyOS 4.x 教程](https://consumer.huawei.com/cn/support/content/zh-cn16077426/) — 华为官网关于回退与数据恢复范围的说明
- [Understanding Android developer verification](https://support.google.com/android-developer-console/answer/16561738) — Google 关于开发者验证与侧载限制的说明
- [mihomo 通用配置文档](https://wiki.metacubex.one/config/general/) — allow-lan、lan-allowed-ips 等字段
- [mihomo 源码 adapter/inbound/ipfilter.go](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/inbound/ipfilter.go) 与 [listener/mixed/mixed.go](https://github.com/MetaCubeX/mihomo/blob/Meta/listener/mixed/mixed.go) — 白名单检查对回环地址没有豁免
- [clash-verge-rev/clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev) — 源码中的默认混合端口（7897）与由应用接管的配置字段
- [xiaobaigroup/ClashBox](https://github.com/xiaobaigroup/ClashBox) 及其 [Releases](https://github.com/xiaobaigroup/ClashBox/releases)、[.gitmodules](https://github.com/xiaobaigroup/ClashBox/blob/master/.gitmodules)
- [ClashBox Issue #97](https://github.com/xiaobaigroup/ClashBox/issues/97) 与 [Issue #150](https://github.com/xiaobaigroup/ClashBox/issues/150) — 应用市场版与侧载版的差异、外区应用市场安装的用户反馈
- [richerfu/Paws](https://github.com/richerfu/Paws) 与 [meow-rs](https://github.com/meow-rs/meow-rs)
- [popsiclelmlm/Hey](https://github.com/popsiclelmlm/Hey)
- [xiaoli8571/NekoBox4Harmony](https://github.com/xiaoli8571/NekoBox4Harmony) 及其 [Releases](https://github.com/xiaoli8571/NekoBox4Harmony/releases)；新项目 [xiaoli8571/Nexus-VPN-HarmonyOS](https://github.com/xiaoli8571/Nexus-VPN-HarmonyOS)
- [tljk/FlClash-ohos](https://github.com/tljk/FlClash-ohos) 与上游 [chen08209/FlClash](https://github.com/chen08209/FlClash)
- [ks-lm-kf/harmony-kslmkf-karing-hap](https://github.com/ks-lm-kf/harmony-kslmkf-karing-hap) 与官方 [KaringX/karing](https://github.com/KaringX/karing)
- [likuai2010/auto-installer](https://github.com/likuai2010/auto-installer) — 第三方 HAP 安装工具（仓库无源码，仅发布二进制）
- [v2rayNG Issue #4841](https://github.com/2dust/v2rayNG/issues/4841) — 鸿蒙版需求，已标记为 not planned
- [ClashBox Issue #113](https://github.com/xiaobaigroup/ClashBox/issues/113) — 原生应用未走代理的用户反馈
- 客户端目录与时间线线索参考：华润赢（[huarun.win](https://huarun.win/)），参考页面：[HarmonyOS 平台页](https://huarun.win/platform/harmonyos)
