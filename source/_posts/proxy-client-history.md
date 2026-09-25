---
title: "代理客户端十四年：从 Shadowsocks 安卓版到 sing-box 桌面版"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 代理软件
tags:
  - 客户端
  - 历史
  - 演进
  - Clash
  - Sing-box
  - 软件推荐
excerpt: "从 2012 年的 Shadowsocks 安卓版到 2026 年的 sing-box 桌面客户端，代理客户端一再经历停更、删库、下架与改名。本文按时间梳理关键节点，用闭源与开源、内核与界面、单点维护者、分发渠道四组张力解释这些变故为何反复出现，并给出从历史出发的选择原则。"
index_img: /images/posts/proxy-client-history.svg
---

> **摘要**：今天常见的「一个图形界面 + 一个可替换内核」的客户端形态，是十几年里一步步演变出来的。从 2012 年 shadowsocks-android 建仓，到 2026 年 sing-box 推出官方桌面客户端，代理客户端一再经历停更、删库、下架与改名。本文按时间梳理这些关键事件（主要日期回到 GitHub 仓库、发布说明与 App Store 数据核对，少数早期事件依据同期报道），再用四组张力解释它们为什么反复出现：闭源付费与开源免费、内核与界面、单点维护者、分发渠道。最后给出几条「从历史看今天怎么选」的原则。

---

## 为什么要回头看客户端的历史

每隔一段时间，社区里就会出现同一类求助：用了好几年的客户端突然不更新了；GitHub 仓库打开是 404；换了手机之后在 App Store 里搜不到；客户端改了名字，自动更新失效了。每个当事人都觉得这是一次突发事件，但放到十几年的时间轴上看，这些情况几乎都发生过不止一次。

代理技术可以粗分成三层：

| 层次 | 例子 | 演进节奏 | 本站相关文章 |
|------|------|---------|-------------|
| 协议 | Shadowsocks、VMess、VLESS、Reality、Hysteria2 | 跟随审查技术的变化，几年一代 | [从 VMess 到 VLESS：协议演进史](/posts/vmess-to-vless-evolution/) |
| 内核 | v2ray-core、Xray-core、mihomo、sing-box | 持续迭代，偶有分裂 | [V2Ray vs Xray vs Sing-box](/posts/core-comparison/) |
| 客户端 | v2rayN、Clash Verge Rev、Shadowrocket、Hiddify | 数量多、生命周期差异极大 | 本文 |

协议和内核的演进，最终都要通过客户端这一层才能到达用户手里。偏偏客户端这一层最「脆」：它往往由个人维护，依赖单一的分发渠道，还要同时应付操作系统的权限模型、商店审核和用户的各种设备环境。理解这一层的历史，能帮你判断手上的工具处在生命周期的哪个位置、下一次变故来临时应该怎么应对。

本文只讨论客户端这一层。协议和内核的细节在上表链接的文章里已经讲过，这里只在需要时一两句带过。

---

## 关键时间线

下表多数行回到了一手来源：GitHub 仓库信息（GitHub API 与网页存档）、项目自己的 Release 说明、Apple 公开的 App Store 查询接口。2015 年的两件事、2017 年下架、Clash for Windows 删库与 HarmonyOS NEXT 发布几行，依据的是同期报道或社区记录。日期按来源记录的 UTC 时间填写，核实不到「日」的只写到月或年。

需要特别说明的是，**仓库创建时间只代表当前这个仓库**。项目删库重建、转移或另起新仓库时，真实起点可能更早，v2rayN 和 v2rayNG 就是例子。部分节点的线索来自文末致谢的客户端目录站，本文逐条回到一手来源重新核对，并补充了 VLESS 与 Xray 的来历、v2rayN 的多内核演变、mihomo 改名、Clash Party 安全修复、Android 开发者验证等节点。最后一列标出每个节点主要对应后文的哪一组张力。

| 日期 | 事件 | 意义 | 对应张力 |
|------|------|------|---------|
| 2012-12 | shadowsocks-android 仓库创建 | 移动端单协议客户端的起点之一，仓库至今仍在更新 | 维护者 |
| 2015-04-14 | Shadowrocket 上架 App Store | iOS 付费闭源路线开始成形 | 闭源与开源 |
| 2015-08-22 | Shadowsocks 原作者称被警方要求停止开发、删除代码 | 维护者个人第一次成为整条链路的断点 | 维护者 |
| 2015-10 / 2015-11 | Surge iOS 首版上架；约一个月后作者宣布撤下代理版本 | 依托 iOS 9 新开放的 VPN 扩展接口；开发者承压直接影响 iOS 客户端 | 维护者 |
| 2016-02 | V2RayX（macOS）仓库创建 | 围绕 V2Ray 核心的第三方图形界面出现 | 内核与界面 |
| 2017-07 | Apple 从中国大陆区 App Store 移除一批 VPN 应用 | iOS 客户端从此与「非中国大陆 Apple ID」绑定 | 分发 |
| 2017-11 至 2018-10 | v2rayNG（提交记录最早见于 2017-11）、v2rayN（最迟 2018 年已发布）、V2rayU（2018-10 建仓） | 「壳 + 核」在 Android、Windows、macOS 上普及 | 内核与界面 |
| 2018-05 / 2019-10 | Loon、Quantumult X 先后上架 App Store | iOS 付费客户端多家并存，各自形成配置生态 | 闭源与开源 |
| 2020-08 / 2020-11 | VLESS 以预览版进入 v2ray-core v4.27.0；Xray-core 仓库创建 | 核心分裂，客户端要选择跟随哪条线 | 内核与界面 |
| 2021-05 | Clash.Meta（今 mihomo）仓库创建 | 日后 Clash 生态的接续者此时已经存在 | 闭源与开源 |
| 2021-10 至 2021-12 | Clash .NET 仓库被清空，随后主仓库消失 | 删库断供的一次预演 | 维护者 |
| 2022-03 / 2023-01 | v2rayN 5.5 可调用 Clash 核心；6.0 的 TUN 模式改用 sing-box 核心，与 Xray 并存 | 桌面客户端开始同时携带多个核心 | 内核与界面 |
| 2022-06 | Clash Meta for Android（06-07）与 sing-box 核心（06-30）仓库创建 | Clash.Meta 有了官方 Android 客户端；sing-box 核心诞生 | 内核与界面 |
| 2023-05 至 2023-11 | Hiddify、FlClash、Karing 仓库先后创建 | 基于 Flutter 的跨平台客户端集中出现 | 内核与界面 |
| 2023-11 | Clash for Windows 删库，Clash Verge 归档，多个 Clash 系仓库下线 | 客户端生态最大的一次断供 | 维护者 |
| 2023-11-21 | Clash Verge Rev 仓库创建 | 开源 GUI 被社区接续 | 闭源与开源 |
| 2023-12-03 | Clash.Meta v1.17.0 把二进制与默认路径改名为 mihomo | 改名的是核心，客户端仍沿用 Clash 之名 | 维护者 |
| 2024-07-31 | Hiddify 2.0.5 打包 Xray 核心 | Flutter 系客户端也开始同时携带 sing-box 与 Xray | 内核与界面 |
| 2024-10-22 | HarmonyOS NEXT 正式发布 | 不再兼容 Android 应用，催生鸿蒙原生客户端 | 分发 |
| 2024-10-24 | v2rayN 7.0.0 预发布版首次提供 Linux 版 | 老牌 Windows 客户端走向跨平台 | 内核与界面 |
| 2025-07-18 | Nekoray 的社区延续项目更名为 Throne | 更名打断应用内更新链路 | 维护者 |
| 2025-08-04 | sing-box 1.12.0 说明官方商店版应用长期无法更新 | 核心作者的官方客户端同样受制于商店审核 | 分发 |
| 2025-08-31 | Mihomo Party 更名为 Clash Party | 又一款客户端以 Clash 命名 | 维护者 |
| 2026-08-31 | sing-box 1.14.0：iOS / tvOS 客户端以新条目回归 App Store，推出 Windows / Linux 官方桌面客户端 | 核心作者的客户端覆盖到全部主流平台 | 分发 |
| 2026-09-20 | Clash Party v2.0.3 修复恶意 rule-providers 可执行命令的问题 | 开源不等于没有漏洞 | 闭源与开源 |
| 2026-09-30（计划） | Android 开发者验证计划于此日起在首批四国生效，先覆盖七家合作应用商店的安装（以官方公布为准） | Android 分发开始收紧；直接侧载按计划到 2027 年全球推行时才受影响 | 分发 |

下面按阶段展开。

---

## 2012-2015：一个协议，一个 App

### Shadowsocks 安卓版：协议生态里的「原生客户端」

shadowsocks-android 的仓库创建于 2012 年 12 月。今天回头看，它代表了最早的一种客户端形态：**协议、核心和界面出自同一个生态，客户端只服务一种协议**。用户不需要理解「内核」是什么，装上就是 Shadowsocks。

这种形态的好处是简单、一致，坏处是没有「换核」的余地——协议本身一旦被针对，客户端能做的只有跟着协议一起升级。

2015 年 8 月 22 日，Shadowsocks 原作者 clowwindy 在 GitHub 上留言，称警方两天前找过他，要求停止开发，当天又要求他删除 GitHub 上的全部代码（这条留言后来被编辑，原话见维基百科 Shadowsocks 条目的引用，EFF 等机构当月也有报道）。这是中文代理社区第一次集体意识到：**维护者本人可能就是整个链条上最脆弱的一环**。不过 shadowsocks-android 由社区组织继续维护，截至本文写作时仍在更新。

同一时期还有另一条路线值得一提：2013 年底在中国用户中快速扩散的 Lantern，走的是「客户端和服务端网络一体」的思路，用户不需要自带服务器。它说明了早期客户端的两种基本分野：**工具型**（你给它配置，它帮你连）和**服务型**（它自己就是服务）。今天各类「一键连接」的 VPN 应用大多属于后者，本文讨论的客户端基本都属于前者。

### Shadowrocket 与 Surge：iOS 上的窗口期

iOS 的情况与 Android 不同。Android 允许侧载 APK，在 GitHub 上发布安装包就能分发；iOS 应用则基本只能走 App Store，而上架需要开发者账号、审核，以及一个愿意长期维护的主体。

- **Shadowrocket** 于 2015 年 4 月 14 日上架 App Store，开发商是一家公司主体，至今仍以同一个 App Store 条目持续更新（2026 年 9 月查询时美区标价 2.99 美元）。
- **Surge** 的 iOS 首版在 2015 年 10 月下旬上架，当时售价 9.99 美元。据同期报道，它利用了 iOS 9 新开放的 VPN 扩展接口，让 iOS 能跑此前系统不支持的代理协议。上架约一个月后，作者 Yachen Liu 以「众所周知的原因」宣布将撤下代理版本，改为向已购用户提供不含代理功能的调试工具版本。Surge 后来仍以网络调试与代理工具的定位延续至今。现在 App Store 上的 Surge 条目是 2018 年 11 月随 Surge 3 新开的，Surge 4、Surge 5 都在这个条目里升级，现名 Surge 5。

这两个案例奠定了 iOS 客户端的基本面貌：**闭源、付费、以公司主体运营、完全依赖 App Store 分发**。付费不是偶然的商业选择，而是在这个分发体系下长期存活的前提——开发者账号、审核沟通、跟进每年的 iOS 大版本，都需要持续投入。Surge 的功能与定位可以参考 [Surge 使用指南](/posts/surge-guide/)，当前定价以 [2026 各平台客户端推荐](/posts/client-recommendations-2026/) 为准。

反过来，Android 的「开放」也不是一成不变的。按 Google 目前公布的时间表（以官方公布为准），Android 开发者验证要求计划于 2026 年 9 月 30 日起先在巴西、印尼、新加坡、泰国的认证设备上生效，这一阶段只覆盖从 Google Play、Galaxy Store 等七家合作应用商店安装的应用，直接侧载的 APK 暂不受影响；2027 年起再逐步推向全球，覆盖认证设备上的所有应用。届时未完成验证的开发者发布的 APK，用户需要走一套额外的「高级流程」（开启开发者选项、重启、等待一天后再确认等步骤）才能安装。对只在 GitHub 上发布、由个人维护的开源 Android 客户端来说，这会直接增加用户的安装门槛。

### 这一阶段留下的遗产

| 遗产 | 表现 | 今天仍然成立吗 |
|------|------|---------------|
| 一个客户端对应一种协议 | Shadowsocks 客户端只连 SS | 已被「一个客户端支持多协议」取代 |
| iOS 付费闭源 | Shadowrocket、Surge | 仍然成立，并扩展到更多产品 |
| 开发者承压即风险点 | Shadowsocks 原作者被要求删代码；Surge 作者宣布撤下代理版本 | 仍然成立，后文的 Clash .NET、Clash for Windows 属于同一类 |
| 分发渠道单一 | iOS 应用基本只能走 App Store | 仍然成立，且形式更多样（见 2017 年下架与 sing-box 商店波折） |

---

## 2016-2019：内核独立，界面外包

### 核心成为独立项目

这一时期，协议层的主角从 Shadowsocks 扩展到 V2Ray 的 VMess，规则分流层出现了 Clash。两者有一个共同点：**它们首先是一个没有图形界面的核心程序**，由核心作者专注于协议实现与路由逻辑，图形界面则留给其他开发者。

这就是「壳 + 核」架构的开端：

```text
用户操作
  └─ 客户端（壳）：界面、订阅管理、系统代理 / TUN 开关、测速、日志、自动更新
       └─ 生成配置文件，或通过本地 API 控制内核
            └─ 内核（核）：协议实现、路由分流、DNS 处理
                 └─ v2ray-core → Xray-core ／ Clash → mihomo ／ sing-box
```

### 界面层百花齐放

v2ray-core 的仓库创建于 2015 年 9 月，围绕它的第三方图形界面几个月后就出现了：macOS 客户端 V2RayX 的仓库建于 2016 年 2 月。2017-2019 年间，几款后来成为各平台主力的界面相继出现：

- **v2rayNG**：Android 客户端，代码提交记录最早可追到 2017 年 11 月。
- **v2rayN**：Windows 客户端，用 C# 编写。2019 年 4 月的网页存档显示它已有 36 个 Release、近 2900 个 star，说明它至少在 2018 年就已发布。
- **V2rayU**：macOS 客户端，仓库创建于 2018 年 10 月，用 Swift 编写。

v2rayN 与 v2rayNG 出自同一位开发者，两者现在的仓库都是 2019 年重建的，GitHub API 显示的创建时间（2019-05-15、2019-07-30）并不是项目起点——这也是只看仓库创建时间写历史容易出错的地方。它们也是本站 [v2rayN / v2rayNG 使用指南](/posts/v2ray-clients-guide/) 的主角。Clash 核心同期也出现了多个由不同个人开发者维护的图形界面，分别覆盖 Windows、macOS 和 Android。

iOS 这边则是付费客户端继续增加：Loon 于 2018 年 5 月上架，Quantumult X 于 2019 年 10 月上架（2026 年 9 月查询时美区标价分别为 7.99 美元和 9.99 美元）。它们各自发展出一套配置语法和脚本、重写规则生态，彼此并不完全兼容。

### 分发渠道的第一次剧变

2017 年 7 月底，Apple 从中国大陆区 App Store 移除了一批 VPN 应用，公开说明的理由是这些应用不符合当地的新规定。维基百科记载 Shadowrocket 也在其中。从那以后，**在 iOS 上使用这类客户端，几乎都要先准备一个非中国大陆地区的 Apple ID**——这一步至今仍是很多新手遇到的第一道门槛，具体做法见 [Shadowrocket 使用指南](/posts/shadowrocket-guide/)。

> **风险提示**：网上流传的「共享 Apple ID」存在账号被锁、设备被远程抹除、购买记录与隐私外泄等风险。能自己注册就不要用共享账号，更不要在共享账号上开启 iCloud 同步。

### 为什么「壳 + 核」成为主流

这一架构能在几年内成为主流，至少有四个原因：

1. **技能分工**。协议实现需要密码学、网络栈和抗检测方面的专门积累，界面开发需要的是平台 API 和交互设计能力，两者很少集中在同一个人身上。分开之后，各自都能做得更深。
2. **一核多壳**。这几个核心都用 Go 编写，可以交叉编译到各个平台。一个核心写好，Windows、macOS、Android 的界面作者都能直接嵌入。
3. **配置格式成为公共资产**。V2Ray 的 JSON、Clash 的 YAML、各协议的分享链接，逐渐变成了订阅服务、规则集、转换工具共同依赖的「标准」。订阅生态围绕的是核心的配置格式，而不是某一个客户端。
4. **可替换性**。界面停更了，换一个用同一核心的界面，配置基本还能用。

但第 4 点有一个反面：**核心停更时，所有依赖它的界面会一起失去未来**。这一点要到 2023 年才被所有人真切感受到。

| 维度 | 一体式原生客户端 | 壳 + 核 |
|------|-----------------|--------|
| 协议升级 | 客户端作者自己实现 | 跟随核心升级即可 |
| 平台覆盖 | 每个平台单独开发 | 核心复用，界面各自开发 |
| 配置迁移 | 往往锁定在单个客户端 | 同核心的客户端之间基本通用 |
| 故障隔离 | 客户端停更即全部停更 | 界面停更可换壳，核心停更则全体受影响 |
| 用户理解成本 | 低 | 需要理解「内核」与「客户端」的区别 |

「内核」和「客户端」的概念区分，[V2Ray、Xray、Clash、Sing-box……我该用哪个？](/posts/software-overview/) 里有更适合新手的讲解。

---

## 2021-2023：生态震荡

### Clash .NET：一次预演

Windows 上的 Clash 客户端 Clash .NET 是一个早期信号。网页存档显示，2021 年 10 月 25 日它的仓库被重置为只剩一个初始提交，说明文字只有一句英文 Removed according to regulations.（大意是「依规定移除」）。此后主仓库从 GitHub 上消失，如今它的 GitHub 组织页面只剩两个 2021 年 12 月更新过的实验性 Go 仓库。具体原因没有一手记录。

当时这件事在社区里更多被当作个别项目的变故，但它其实已经把后来的剧本演了一遍：**个人维护、开发者承受外部压力、GitHub 单一分发、仓库一撤即断供**。

### 2023 年 11 月：连锁反应

2023 年 11 月初，Clash for Windows 的仓库连同其中的安装包被删除，随后几天里，Clash 原版核心、Clash for Android、ClashX 等多个 Clash 系项目相继下线或归档。整个事件的来龙去脉和各分支的关系，[Clash 系列全解](/posts/clash-family/) 已经详细讲过，这里只看它对客户端生态造成的影响。

几项可以直接核对的事实：

- Clash Verge 的原仓库于 2023 年 11 月 3 日归档，如今仍可只读访问。
- Clash for Windows 的发布仓库、Clash 原版核心仓库、Clash for Android、ClashX 的原仓库，如今在 GitHub API 中都返回 404。
- 11 月初，V2EX 等社区论坛就已出现「Clash for Windows 好像删库了」一类的讨论帖。

对客户端生态的影响可以归纳为三点：

**第一，下载渠道瞬间消失。** 对普通用户来说，「仓库没了」的直接后果是装不了、更新不了。很多人转向网盘、群文件和第三方网站上的「备份包」——这些安装包是否被篡改，普通用户几乎无从验证。

> **安全提示**：已停更客户端的「最后版本备份」「汉化版」「绿色版」，即使来源看起来可信，也可能被植入恶意代码。代理客户端开启 TUN 模式、安装系统服务或修改系统 DNS 时，往往需要管理员权限，而且它能看到你的全部流量，一旦被篡改，危害远大于普通软件。自查方法见 [代理客户端安全自查](/posts/client-safety-check/)。

**第二，搜索结果被「以 Clash 为名」的站点占据。** 项目下线后，用户搜索时会碰到大量以 Clash 命名的下载站和教程站，其中许多与原项目或接续项目并无关系。辨别下载来源成为一项必备技能。

**第三，替代方案其实早已就位。** Clash Verge Rev 的仓库在 2023 年 11 月 21 日创建，距原仓库归档不到三周。同月还出现了兼容 Clash 配置、基于 sing-box 的新客户端 Karing（仓库 2023 年 11 月 6 日创建），为 Clash 用户提供了另一条迁移路径。更关键的是，MetaCubeX 维护的 Clash.Meta 核心早在 2021 年就已存在，其 Android 客户端 Clash Meta for Android 也早在 2022 年 6 月就已建立——**删库发生时，Clash 生态的替代核心和替代客户端其实都已经在跑了**。

### 为什么有的项目能「复活」，有的不能

对比这次事件中各个项目的结局，可以看出一个清晰的规律：

| 项目 | 类型 | 源码状态 | 结局 |
|------|------|---------|------|
| Clash Premium | 核心 | 闭源 | 无法接续，彻底停止 |
| Clash 开源版 | 核心 | 开源 | 由已有的 fork（Clash.Meta → mihomo）承接 |
| Clash Verge | 客户端 | 开源 | 社区 fork 为 Clash Verge Rev |
| Clash for Windows | 客户端 | 闭源（GitHub 上的发布仓库只有 README 和安装包） | 无直接继任，用户迁移到其他客户端 |

结论很直接：**开源不能保证项目不停更，但能保证停更之后别人接得住**。闭源项目一旦停止，除了原作者，没有人能合法、完整地把它继续下去。

---

## 2022-2024：Flutter 与一个 App 多个内核

### Clash 系的新主干：mihomo 与 Clash Meta for Android

MetaCubeX 的做法与早期 Clash 时代不同：它不只维护核心，也维护配套的客户端。Clash Meta for Android 的仓库创建于 2022 年 6 月 7 日，ClashX.Meta 的仓库创建于同月 12 日。从 Clash Meta for Android 仓库的语言构成看，除了 Kotlin 编写的界面，还包含 Go 代码——这正是「一核多壳」在移动端的样子：Go 核心被编译成库，嵌进原生界面里。

### sing-box：核心作者亲自做客户端

sing-box 的核心仓库创建于 2022 年 6 月 30 日，官方 Android、Apple 客户端的仓库则分别在 2022 年 12 月和 2023 年 6 月建立。与 V2Ray 时代「核心作者只管核心」不同，sing-box 项目自己维护这些官方图形客户端，官方文档的客户端页面也只列出项目自己维护的这几款。

这种模式的好处是核心新功能能第一时间在官方客户端里用上，配置行为也最一致；代价是官方客户端同样要面对商店审核等分发问题，后文会看到它在这方面吃的苦头。sing-box 的配置思路见 [Sing-box 使用指南](/posts/singbox-guide/)。

### Flutter 一代：小团队也能多端同发

2023 年前后，一批用 Flutter（Dart 语言）编写的客户端集中出现：

| 客户端 | 仓库创建 | 主要语言占比（GitHub 统计） | 核心 | 官方支持的平台 |
|--------|---------|---------------------------|------|--------------|
| Hiddify | 2023-05 | Dart 约 72%，另有 Kotlin、Swift | sing-box，后加入 Xray | Android、iOS、Windows、macOS、Linux |
| FlClash | 2023-08 | Dart 约 82%，另有 Kotlin、Go、Rust | Clash Meta（mihomo） | Android、Windows、macOS、Linux，无 iOS |
| Karing | 2023-11 | Dart 约 98% | 修改版 sing-box，兼容 Clash 配置 | 上述五个平台外加 tvOS |

Flutter 对这些项目的吸引力很现实：界面只写一遍，就能编译到移动端和桌面端，维护者少的项目也能同时照顾好几个平台（实际覆盖因项目而异，例如 FlClash 没有 iOS 版）。在「壳 + 核」架构下，核心本来就是跨平台的，界面也跨平台之后，同一个客户端就能出现在用户的手机和电脑上。

但表格里的语言构成也说明了另一件事：跨平台框架只解决了界面问题。Android 的 VPN 服务、Apple 的网络扩展、桌面系统的 TUN 网卡和系统代理设置，仍然要用各平台的原生代码去对接。这也是跨平台客户端在某些平台上体验参差、问题集中在「开不了 TUN」「系统代理没生效」的原因之一，排查思路见 [TUN 模式不生效的常见原因](/posts/tun-not-working/)。

### 多内核成为标配

另一条线是「一个客户端带多个核心」。这条路其实从桌面端开始得更早：v2rayN 5.5（2022 年 3 月）让自定义配置可以选用 Clash 核心，6.0（2023 年 1 月）新增的 TUN 模式直接用 sing-box 核心实现，与原有的 Xray 核心并存。之后的几个节点：

- **Hiddify 2.0.5**（2024 年 7 月 31 日）把 Xray 打包进了应用。按发布说明，在某个节点的分享链接末尾加上 `&core=xray`，这个节点就改由 Xray 处理，其余节点仍走 sing-box，一个客户端里两个核心并行工作。
- **v2rayN 7.0.0**（2024 年 10 月 24 日发布的预发布版）重构了代码结构，把界面与业务逻辑解耦，并首次发布用 Avalonia UI 编写的 Linux x64 版本；Windows 版仍保留原来的 WPF 界面，官方发布文件说明里至今同时提供 WPF 与 Avalonia 两种 Windows 包。如今仓库简介写的平台已是 Windows、Linux 和 macOS，支持 Xray、sing-box 等多种核心。

为什么会走向多内核？根源在于核心之间的分化：Xray 生态率先推出 XHTTP 等传输方式，sing-box 原生支持 Hysteria2、TUIC 等基于 QUIC 的协议（详见 [V2Ray vs Xray vs Sing-box](/posts/core-comparison/)）。用户的订阅里往往混着多种协议，一个想「什么都能连」的客户端，只能多带几个核心。

多内核的代价同样存在：安装包更大；同一个节点在不同核心下的参数写法不同，客户端需要做翻译，翻译出错就是「这个节点在 A 客户端能连、在 B 客户端不能连」；排障时还要先搞清楚当前到底是哪个核心在工作。

---

## 2025-2026：分叉、更名与新平台

### 更名与继任

**Nekoray → Throne。** Nekoray 是一款基于 Qt 的跨平台桌面客户端，仓库创建于 2022 年 5 月，早期同时提供基于 v2ray 与 sing-box 的核心，后期只用 sing-box（归档时 README 的标题已是 NekoBox For PC）。它的原仓库如今已归档，简介开头写着「不再维护，自寻替代品」，并没有指定继任项目。Throne 是社区开发者另起的延续项目，并非 GitHub 上的 fork，它的说明文档提到原开发者从 2023 年 12 月起就已部分放弃这个项目。Throne 最初以 nekoray 4.x 的版本号继续发布，2025 年 7 月 18 日的 1.0.0-beta.1 正式更名为 Throne，发布说明特别提示：**应用内更新无法跨越这次更名**，需要手动下载新版本并把原来的配置文件夹复制过去。

这个细节很有代表性：更名、换仓库、换签名，都会打断客户端的自动更新链路。用户如果没有关注发布页，就会一直停留在旧版本上，而旧版本捆绑的核心也随之老化。

**Mihomo Party → Clash Party。** 这款基于 Electron 与 mihomo 的桌面客户端仓库创建于 2024 年 8 月，2025 年 8 月 31 日发布的 v1.8.6 在原仓库内把软件名称改为 Clash Party，并换了新 Logo，发布说明提醒改名可能带来预料之外的问题。

这里要澄清一个常见误解：2023 年删库之后，改名的只是核心——Clash.Meta 在 v1.17.0（2023 年 12 月）把二进制文件和默认路径改为 mihomo。客户端层面，Clash Verge Rev、FlClash、Clash Meta for Android 一直沿用 Clash 之名。Clash Party 的改名进一步说明，「Clash」在用户心中早已不指某个具体项目，而是一种配置格式和使用方式的代称。

值得一提的是，Clash Party 在 2026 年 9 月 20 日发布的 v2.0.3 中修复了一个「恶意 rule-providers 配置可能执行任意命令」的安全问题。这提醒我们：**订阅和配置文件本身就是一种不可信输入**，客户端解析它们的代码同样可能有漏洞。及时更新客户端，不只是为了新功能。

### sing-box 官方客户端的商店波折

sing-box 1.12.0（2025 年 8 月 4 日）的发布说明写道：官方应用在 App Store 和 Play Store 上的更新问题持续存在，在重写并重新提交之前，这些商店版本被视为无法恢复。

一年后，1.14.0（2026 年 8 月 31 日）给出了新的局面：

- Apple 平台客户端迁移到新的开发者账号，iOS 与 tvOS 客户端以「sing-box MT」为名重新上架 App Store，旧版（sing-box VT）用户需要另行安装新应用；
- 由于 entitlement（权限）限制，macOS 版（SFM）不再通过 Mac App Store 提供，改为独立安装包（GitHub Releases 或 Homebrew Cask 的 `sfm`）。它的配置和设置不会从旧应用继承，官方在 [迁移文档](https://sing-box.sagernet.org/migration/#migrate-the-macos-standalone-client-data) 里给出了手动迁移步骤，操作前先备份；
- 新推出 **sing-box for Desktop**，支持 Windows 10 及以上（x64、x86、arm64）和 Linux（x64、arm64、armv7l），通过 GitHub Releases 分发；
- 新增面向越狱 iOS 设备的安装包；
- 按约定移除了此前标记为弃用的配置项。

换账号、开新条目的只是 Apple 平台。Android 版没有换条目，2026 年 9 月查询时，Google Play 上的 sing-box 已恢复更新到 1.14 系列，官方 Android 文档也把 Play Store 与 GitHub Releases、F-Droid 一起列为下载渠道。

最后一条对普通用户的影响可能比前几条都大：**核心移除旧配置语法之后，依赖旧写法的订阅和客户端会直接报错**。sing-box 在 1.12.0 就已预告旧的 DNS 服务器格式将在 1.14.0 移除兼容。核心和客户端之间的版本错位，是「壳 + 核」架构的常见故障来源。

> **风险提示**：越狱版客户端需要设备处于越狱状态。越狱会削弱系统安全机制，可能影响保修与部分应用的正常使用，并带来数据丢失风险。除非你清楚自己在做什么，否则不要为了一个客户端去越狱设备。

### 鸿蒙原生客户端

2024 年 10 月 22 日，华为正式发布 HarmonyOS NEXT。它不再兼容 Android 应用，这意味着此前在华为手机上侧载 APK 的做法在新系统上行不通了，代理客户端需要用 ArkTS / ArkUI 重新开发。之后已有开发者把现有核心移植进鸿蒙原生应用，例如 2025 年 2 月出现的 ClashBox 用 ArkTS 编写界面，内置修改版的 mihomo 核心（项目只开源了大部分代码，修改过的内核部分没有公开）——又一次「壳 + 核」。这一领域变化很快，项目的现状、分发方式和注意事项，单独整理在 [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/) 中。

从历史的角度看，鸿蒙的情况几乎是 2012-2015 年的翻版：新平台、新 API、少量先行者、分发渠道尚不清晰。同样的风险——单点维护、来源难以核实——也会再出现一次。

---

## 贯穿十四年的四组张力

### 闭源付费与开源免费

| 维度 | 闭源付费路线 | 开源免费路线 |
|------|-------------|-------------|
| 代表 | Shadowrocket、Surge、Loon、Quantumult X、Stash | v2rayN / v2rayNG、Clash Verge Rev、Clash Meta for Android、sing-box 官方客户端、Hiddify |
| 主要平台 | iOS / macOS | Android、Windows、Linux、macOS，部分覆盖 iOS |
| 运营主体 | 公司 | 个人或社区组织 |
| 收入来源 | 一次性购买或内购 | 捐赠、赞助，或没有 |
| 代码可审计 | 否 | 是 |
| 停更之后 | 无法接续 | 可以被 fork 接续 |
| 典型风险 | 下架、商店区域限制、无法审计 | 维护者离场、删库、分发渠道单一 |

两条路线的分布与平台高度相关。iOS 上付费闭源占主导，根本原因在分发：App Store 的开发者账号、审核沟通、每年的系统大版本适配，都要求一个能长期投入的主体。从 Apple 公开的数据看，Shadowrocket 自 2015 年上架至今一直在同一条目下更新，Loon、Quantumult X 在 2026 年 9 月也都有新版本——付费模式在这个渠道里确实撑起了长期维护。反观开源的 sing-box，Apple 平台的官方商店版更新受阻至少持续了一年，最后是换开发者账号、以新条目重新上架。

开源路线的优势在 2023 年体现得最清楚：开源的 Clash 核心和 Clash Verge 都有了继任者，闭源的 Clash Premium 则就此终止。但「开源」并不自动等于「安全」：你安装的是别人编译好的二进制文件，它与公开源码是否一致，普通用户同样无法验证。在这一点上，sing-box 的 Android 客户端通过 F-Droid 提供可复现构建的统一签名，是少数能让用户验证「安装包确实来自这份源码」的做法。

### 核心与客户端：谁决定你能用什么

十四年下来，核心逐渐收敛为三条主线：

- **V2Ray → Xray-core**：2020 年分裂。VLESS 由 RPRX 在分裂前先加入 V2Ray（v4.27.0），之后以 Xray 为主要载体；Reality、XHTTP 则发源于 Xray；
- **Clash → Clash.Meta → mihomo**：2023 年原版停更后，mihomo 成为 Clash 配置格式的事实承载者；
- **sing-box**：2022 年从零开始，覆盖协议广，核心作者自己维护官方客户端。

客户端的能力上限由核心决定，用起来舒不舒服则由界面决定。选客户端时，先确认它用的是哪条核心路线、打包的核心版本新不新，比比较界面好不好看更重要。核心作者维护的客户端（如 sing-box 官方客户端、MetaCubeX 的 Clash Meta for Android）与核心同步最及时；第三方客户端则往往在界面、订阅管理、多核心整合上更有特色，但可能滞后于核心版本。

### 单点维护者风险

把本文出现过的停更和接续事件放在一起看：

| 项目 | 维护形态 | 发生了什么 | 后续 |
|------|---------|-----------|------|
| Shadowsocks 原版 | 个人 | 2015 年 8 月原作者被要求停止开发、删除代码 | 社区组织继续维护各语言实现 |
| Clash .NET | 个人 | 2021 年仓库被清空后消失 | 无继任 |
| Clash for Windows | 个人 | 2023 年 11 月删库 | 用户迁移到其他客户端 |
| Clash Verge | 个人 | 2023 年 11 月归档 | Clash Verge Rev 接续 |
| Nekoray | 个人 | 2023 年 12 月起部分停止维护，后归档 | 社区另起的 Throne 延续 |

规律并不复杂：**个人维护的客户端，迟早会遇到维护者离开的那一天**，差别只在于离开的方式是公开交接、悄悄停更，还是一夜删库。这不是在批评个人开发者——大量优秀的客户端恰恰出自个人之手，其中一些已经稳定维护了七八年。但作为用户，需要把「这个项目只有一个人在维护」当成一个事实纳入考虑，并提前准备好替代方案。

### 分发渠道：App Store 区域、商店审核与侧载

| 渠道 | 历史上出过的问题 | 对用户的影响 |
|------|----------------|-------------|
| App Store | 2017 年中国大陆区下架；审核导致无法更新；应用换条目重新上架 | 需要海外 Apple ID；旧应用停在旧版本；需手动迁移到新条目 |
| Mac App Store | 因 entitlement 限制不再提供（sing-box 1.14） | 改用独立安装包（GitHub Releases 或 Homebrew Cask），配置按官方迁移文档手动迁移 |
| Google Play | 更新曾长期受阻（sing-box 1.12.0 说明，2025-08） | 受阻期间只能改用 GitHub Releases 或 F-Droid；2026 年 9 月查询时 Play 版已恢复更新 |
| Android 侧载 | 开发者验证（计划 2026-09-30 起先在四国的合作商店执行，2027 年起推向全球并覆盖侧载，以官方公布为准） | 按计划全球推行后，未验证开发者的 APK 安装步骤变多 |
| GitHub Releases | 删库即断供；安装包未签名；更名后应用内更新失效 | 找不到安装包；被迫接受系统安全警告；停留在旧版本 |
| 第三方镜像与网盘 | 来源无法验证 | 安装包可能被篡改 |

以 Throne 为例，它的说明文档提到 macOS 版没有签名证书，需要用户手动解除系统的隔离标记；部分杀毒软件也会因为其自动更新和修改系统 DNS 的行为而报警。这类提示本身未必意味着软件有问题，但它确实让「分辨正常警告与真正的恶意软件」变得更难，也更考验用户下载来源的可靠性。

> **风险提示**：解除隔离标记，等于让 macOS 跳过对这个应用的来源校验。只对从项目官方 GitHub Releases 下载的那一个 .app 执行（Throne 文档给出的是 `xattr -d com.apple.quarantine /path/to/throne.app`），不要为了省事全局关闭 Gatekeeper，也不要对来路不明的安装包这样做。

---

## 从历史看今天怎么选客户端

把十四年的经验压缩成几条可执行的原则：

1. **先定核心路线，再挑界面。** 你的节点用什么协议、需要什么传输方式，决定了你需要 Xray、mihomo 还是 sing-box，或者需要一个多核心客户端。界面是第二步的事。

2. **优先选择配置可迁移的客户端。** 使用通用的配置格式（Clash YAML、sing-box JSON、标准分享链接）和标准订阅，能导出配置。这样客户端停更时，换一个同核心的客户端就能继续用。订阅格式的转换与管理见 [订阅转换与管理](/posts/subscription-management/)。

3. **看维护结构，而不只看热度。** 是组织账号还是个人账号？最近一次 Release 是什么时候？Issue 有没有人回应？核心版本跟得上吗？这些信号比 star 数更能反映项目的健康程度。

4. **只从一手渠道下载。** 官方仓库的 Releases 页面、官方文档给出的商店链接、F-Droid 等可验证渠道。对「备份包」「汉化版」「破解版」「去广告版」保持警惕，尤其是需要管理员权限的桌面客户端。

5. **准备一个不同核心路线的备用客户端。** 平时用 mihomo 系，就备一个 Xray 或 sing-box 系的客户端（不同时运行）。既能在主力客户端出问题时救急，也能帮你判断故障出在客户端还是节点。

6. **关注发布页上的更名与迁移公告。** 更名、换开发者账号、移除旧配置语法，这些变化往往不会通过应用内更新告诉你。订阅项目的 Release 通知，是成本最低的防护手段。

7. **付费客户端看更新记录，而不是历史口碑。** 在 App Store 上查看版本历史，确认它还在跟进新的 iOS 版本和新协议；同时保护好购买它所用的 Apple ID。

按平台的具体选择，见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/)；装好之后如何检查来源、权限与配置是否安全，见 [代理客户端安全自查](/posts/client-safety-check/)。

---

## 常见问题（FAQ）

### 为什么 iOS 上的代理客户端大多要付费，而 Android 和桌面端大多免费？

主要是分发方式决定的。Android 和桌面系统目前仍允许直接安装来自 GitHub 的安装包，开源项目不需要商业主体也能分发（Android 这一点正随 Google 的开发者验证而收紧）；iOS 应用基本只能走 App Store，需要开发者账号、持续的审核沟通和每年的系统适配，付费是支撑这些投入的常见方式。sing-box 官方 iOS 应用在商店中长期无法更新、最终换账号重新上架的经历，也从反面说明了这个渠道的维护成本。

### 客户端停更了，还能继续用吗？

短期内通常可以，但风险会逐渐累积：捆绑的核心不再更新，新协议和新传输方式用不了；已知漏洞得不到修复；操作系统升级后可能出现兼容问题。建议尽早迁移到仍在维护的同核心客户端，配置格式相同的话迁移成本很低。

### 删库之后网上流传的旧版安装包能用吗？

不建议使用。你无法确认这些安装包没有被篡改，而代理客户端往往会申请管理员权限（TUN、系统服务），还会接管你的全部网络流量，一旦被植入恶意代码，后果远比普通软件严重。与其冒险，不如换一个仍在维护、来源可验证的客户端。

### 多内核客户端是不是一定更好？

不一定。多内核的好处是协议覆盖更广，一个客户端就能连接混合了多种协议的订阅；代价是安装包更大、配置翻译可能出错、排障时要先确认当前使用的是哪个核心。如果你的节点协议单一，一个与之匹配的单核心客户端往往更简单可靠。

### 客户端改名了，要担心吗？

改名本身不代表有问题，但要分清两种情况。Clash Party 是原作者在原仓库内的更名，可以直接跟随；Throne 则是 Nekoray 停更后由社区开发者另起仓库维护的延续项目，原仓库并未指定继任者。对后一种，要看它的维护历史、发布记录和社区口碑，自己判断是否信任。无论哪种，更名后应用内更新都可能失效，需要手动下载新版本并迁移配置；同时警惕借更名之机冒充的仿冒项目。

### 开源客户端就一定安全吗？

开源意味着代码可以被审计、项目可以被接续，但不等于安全。你下载的通常是开发者编译好的安装包，它与公开源码是否一致，一般用户无法验证；开源项目也可能存在漏洞，例如 Clash Party 在 2026 年 9 月修复的配置解析问题。保持更新、只从官方渠道下载、只导入可信来源的订阅，比「是否开源」更能直接降低风险。

### 华为鸿蒙手机现在能用哪些客户端？

搭载 HarmonyOS NEXT 的设备不再兼容 Android 应用，原来的 APK 客户端无法直接使用，需要鸿蒙原生开发的客户端。这一领域的项目变化很快，具体情况见 [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/)。

---

## 外部参考

**GitHub 仓库（创建时间、归档状态、语言构成通过 GitHub API 与仓库页面核对）**

- [shadowsocks/shadowsocks-android](https://github.com/shadowsocks/shadowsocks-android) — Shadowsocks Android 客户端
- [getlantern/lantern](https://github.com/getlantern/lantern) — Lantern
- [v2ray/v2ray-core](https://github.com/v2ray/v2ray-core) / [Cenmrev/V2RayX](https://github.com/Cenmrev/V2RayX) — V2Ray 核心原仓库 / V2RayX（macOS，已归档）
- [yanue/V2rayU](https://github.com/yanue/V2rayU) — V2rayU（macOS）
- [2dust/v2rayNG](https://github.com/2dust/v2rayNG) / [2dust/v2rayN](https://github.com/2dust/v2rayN) — v2rayNG / v2rayN
- [XTLS/Xray-core](https://github.com/XTLS/Xray-core) — Xray-core
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — mihomo（原 Clash.Meta）
- [MetaCubeX/ClashMetaForAndroid](https://github.com/MetaCubeX/ClashMetaForAndroid) — Clash Meta for Android
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) / [sing-box-for-android](https://github.com/SagerNet/sing-box-for-android) / [sing-box-for-apple](https://github.com/SagerNet/sing-box-for-apple) — sing-box 核心与官方客户端
- [hiddify/hiddify-app](https://github.com/hiddify/hiddify-app) — Hiddify
- [chen08209/FlClash](https://github.com/chen08209/FlClash) — FlClash
- [KaringX/karing](https://github.com/KaringX/karing) — Karing
- [zzzgydi/clash-verge](https://github.com/zzzgydi/clash-verge) — Clash Verge 原仓库（已归档）
- [clash-verge-rev/clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev) — Clash Verge Rev
- [MatsuriDayo/nekoray](https://github.com/MatsuriDayo/nekoray) — Nekoray（已归档）
- [throneproj/Throne](https://github.com/throneproj/Throne) — Throne
- [mihomo-party-org/clash-party](https://github.com/mihomo-party-org/clash-party) — Clash Party（原 Mihomo Party）
- [ClashDotNetFramework](https://github.com/ClashDotNetFramework) — Clash .NET 的 GitHub 组织页面
- [xiaobaigroup/ClashBox](https://github.com/xiaobaigroup/ClashBox) — HarmonyOS NEXT 原生客户端示例

**网页存档（Internet Archive）**

- [v2rayN 仓库页面（2019-04-12 存档）](http://web.archive.org/web/20190412091326/https://github.com/2dust/v2rayN) / [v2rayNG 仓库页面（2019-04-12 存档）](http://web.archive.org/web/20190412091328/https://github.com/2dust/v2rayNG) — 现仓库重建前的状态
- [Clash .NET 仓库页面（2021-11-04 存档）](http://web.archive.org/web/20211104092828/https://github.com/ClashDotNetFramework/ClashDotNetFramework) — 仓库被清空后的说明
- [Clash for Windows 发布仓库（2023-10-03 存档）](http://web.archive.org/web/20231003034142/https://github.com/Fndroid/clash_for_windows_pkg) — 仓库中只有 README 与 .github 目录

**发布说明与官方文档**

- [v2ray-core v4.27.0](https://github.com/v2fly/v2ray-core/releases/tag/v4.27.0) — VLESS 预览版
- [v2rayN 5.5](https://github.com/2dust/v2rayN/releases/tag/5.5) / [6.0](https://github.com/2dust/v2rayN/releases/tag/6.0) / [7.0.0](https://github.com/2dust/v2rayN/releases/tag/7.0.0) — Clash 核心支持、sing-box TUN、Linux 版
- [v2rayN 发布文件说明](https://github.com/2dust/v2rayN/wiki/Release-files-introduction) — WPF 与 Avalonia 两种 Windows 包
- [mihomo v1.17.0](https://github.com/MetaCubeX/mihomo/releases/tag/v1.17.0) — 二进制改名为 mihomo
- [Hiddify v2.0.5](https://github.com/hiddify/hiddify-app/releases/tag/v2.0.5) — 加入 Xray 核心
- [Throne 1.0.0-beta.1](https://github.com/throneproj/Throne/releases/tag/1.0.0-beta.1) — 更名为 Throne
- [Clash Party v1.8.6](https://github.com/mihomo-party-org/clash-party/releases/tag/v1.8.6) / [v2.0.3](https://github.com/mihomo-party-org/clash-party/releases/tag/v2.0.3) — 更名与安全修复
- [sing-box 1.12.0](https://github.com/SagerNet/sing-box/releases/tag/v1.12.0) / [sing-box 1.14.0](https://github.com/SagerNet/sing-box/releases/tag/v1.14.0) — 商店状态、sing-box MT 与桌面客户端
- [sing-box 官方图形客户端文档](https://sing-box.sagernet.org/clients/) / [Android 客户端下载渠道](https://sing-box.sagernet.org/clients/android/) / [迁移文档](https://sing-box.sagernet.org/migration/)
- [Android 开发者验证（Android Developers）](https://developer.android.com/developer-verification) / [官方博客对高级安装流程的说明](https://android-developers.googleblog.com/2026/03/android-developer-verification.html) / [开发者验证常见问题（首批阶段范围）](https://developer.android.com/developer-verification/guides/faq)
- [Surge iOS 版本记录](https://kb.nssurge.com/surge-knowledge-base/release-notes/surge-ios)

**App Store 数据（首次上架时间与标价来自 Apple 公开查询接口，2026 年 9 月查询）**

- [Shadowrocket](https://apps.apple.com/us/app/shadowrocket/id932747118) / [Loon](https://apps.apple.com/us/app/loon/id1373567447) / [Quantumult X](https://apps.apple.com/us/app/quantumult-x/id1443988620) / [Stash](https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349) / [Surge 5](https://apps.apple.com/us/app/surge-5/id1442620678) / [sing-box MT](https://apps.apple.com/us/app/sing-box-mt/id6785326793)
- [iTunes Search API 查询示例](https://itunes.apple.com/lookup?id=1442620678)

**同期报道与百科**

- [Global Voices：Lantern Helps China's Web Users Dodge Censors（2013-12-02）](https://globalvoices.org/2013/12/02/lantern-combating-chinas-censorship-through-friends-network-connections/)
- [EFF：Speech that Enables Speech: China Takes Aim at Its Coders（2015-08）](https://www.eff.org/deeplinks/2015/08/speech-enables-speech-china-takes-aim-its-coders)
- [Wikipedia：Shadowsocks](https://en.wikipedia.org/wiki/Shadowsocks) — 引用了原作者 2015-08-22 的留言
- [TechNode：Surge To Be Pulled From App Store（2015-11-24）](https://technode.com/2015/11/24/surge-advanced-proxy-tool-ios-pulled-app-store/)
- [TechCrunch：Apple removes VPN apps from the App Store in China（2017-07-29）](https://techcrunch.com/2017/07/29/apple-removes-vpn-apps-from-the-app-store-in-china/)
- [V2EX：clash_for_windows 好像删库了（2023-11，需登录查看）](https://www.v2ex.com/t/987884)
- [每日经济新闻：华为原生鸿蒙 HarmonyOS NEXT 正式发布（2024-10-22）](https://www.nbd.com.cn/articles/2024-10-22/3600917.html)

**本站相关文章**

- [Clash 系列全解](/posts/clash-family/) · [V2Ray vs Xray vs Sing-box](/posts/core-comparison/) · [从 VMess 到 VLESS：协议演进史](/posts/vmess-to-vless-evolution/) · [2026 各平台客户端推荐](/posts/client-recommendations-2026/) · [代理客户端安全自查](/posts/client-safety-check/) · [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/)

客户端目录与时间线线索参考：华润赢（[huarun.win](https://huarun.win/)），时间线部分节点的选取参考了其「翻墙纪」页面：[纪事](https://huarun.win/history)、[人物](https://huarun.win/history/people)。
