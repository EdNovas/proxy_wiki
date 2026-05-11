---
title: V2Ray、Xray、Clash、Sing-box……我该用哪个？
date: 2026-05-10
updated: 2026-05-10
categories:
  - 入门指南
tags:
  - Clash
  - V2Ray
  - Xray
  - Sing-box
  - 客户端
  - 软件推荐
index_img: /images/posts/software-overview.jpg
excerpt: V2Ray、Xray、Clash、Sing-box——先分清内核和客户端的区别，再按平台选择最适合你的软件。
---

> **摘要**：代理软件种类繁多，新手很容易在各种名词之间迷失。本文从"内核"和"客户端"这两个最基本的概念入手，梳理当前主流的代理内核（v2ray-core、xray-core、sing-box、mihomo）和各平台推荐客户端，用对比表格和决策树帮助你快速找到最适合自己的方案。不需要任何技术基础，读完就能做出选择。

---

## 先分清两个概念：内核和客户端

在开始比较之前，你需要理解代理软件世界里最重要的一组概念：**内核**和**客户端**。混淆这两者是新手最常犯的错误，也是各种讨论里产生误解的根源。

### 内核（Core）

内核是代理软件的**核心引擎**，负责所有底层工作：建立代理连接、加密解密数据、转发网络流量、执行路由规则。它通常是一个没有图形界面的命令行程序，普通用户不会直接和它打交道。

目前主流的内核包括：

- **v2ray-core** —— V2Ray 项目的核心
- **xray-core** —— 从 v2ray-core 分叉而来，功能更多
- **[sing-box](https://github.com/SagerNet/sing-box)** —— 全新架构，从零开发
- **[mihomo](https://github.com/MetaCubeX/mihomo)**（Clash Meta 内核）—— Clash 生态的核心

### 客户端（Client）

客户端是你实际打开、操作的那个应用程序。它把内核"包装"起来，提供图形界面、配置管理、节点选择、日志查看等用户友好的功能。你在手机或电脑上看到的那个带图标的 App，就是客户端。

### 它们的关系

用汽车来类比：

- **内核 = 发动机**。决定了动力性能、油耗、能跑多快。
- **客户端 = 整辆车**。包括方向盘、仪表盘、座椅、空调——你作为驾驶员接触的一切。

关键要点：

- **一个内核可以驱动多个不同的客户端**。比如 xray-core 被 v2rayN、v2rayNG、NekoBox 等多个客户端使用。
- **一个客户端在同一时间只使用一个内核**。但有些客户端（如 v2rayN）支持在设置中切换不同的内核。
- **客户端决定了你的使用体验**，但**内核决定了你能使用哪些协议和功能**。

理解了这一点，你就不会再问出"V2Ray 和 Clash Verge 哪个好"这样的问题——前者是内核（的名字），后者是客户端，它们不在同一个层面上。

---

## 主流内核一览

### v2ray-core

| 属性 | 说明 |
|------|------|
| 开发者 | V2Fly 社区 |
| 定位 | 第一代多协议代理内核 |
| 支持协议 | VMess、VLESS、Trojan、Shadowsocks |
| 当前状态 | 仍在维护，但开发活跃度较低 |

v2ray-core 是整个"V2Ray 生态"的起源。它首创了 VMess 协议，并通过灵活的配置系统支持多种传输方式（WebSocket、gRPC、HTTP/2 等）。在相当长一段时间里，v2ray-core 是代理领域的事实标准。

但随着 xray-core 的出现和快速发展，v2ray-core 的更新节奏明显放缓。新功能和新协议（如 XTLS、Reality、XHTTP）都是在 Xray 生态中首先实现的。对于新用户来说，v2ray-core 的意义更多是历史性的——你需要知道它的存在，但大多数情况下不需要直接使用它。

### xray-core

| 属性 | 说明 |
|------|------|
| 开发者 | XTLS 团队 |
| 定位 | v2ray-core 的增强分叉，目前最主流的代理内核之一 |
| 支持协议 | VMess、VLESS、Trojan、Shadowsocks、Wireguard 等 |
| 独有特性 | VLESS 协议、Reality、XTLS 流控、XHTTP |
| 当前状态 | 活跃开发，迭代频繁 |

xray-core 从 v2ray-core 分叉而来，保持了完全的向下兼容，同时引入了大量创新：

- **VLESS 协议**：比 VMess 更轻量，去掉了冗余的加密层（当外层已有 TLS 时），降低性能开销。
- **Reality**：不需要域名和证书就能实现 TLS 伪装，大幅降低部署门槛的同时提供极强的抗检测能力。
- **XTLS**：通过减少不必要的重复加密来提升传输效率。
- **XHTTP**：最新的传输方式，通过模拟标准 HTTP 请求行为来进一步增强隐蔽性。

如果你选择的客户端基于 xray-core（如 v2rayN、v2rayNG），你就自动获得了这些最新特性的支持。

### sing-box

| 属性 | 说明 |
|------|------|
| 开发者 | SagerNet 开发者（nekohasekai） |
| 定位 | 新一代通用代理内核 |
| 支持协议 | 几乎所有主流协议（VLESS、VMess、Trojan、Shadowsocks、Hysteria2、TUIC 等） |
| 独有特性 | 现代化架构、规则集系统、多平台原生支持 |
| 当前状态 | 高速发展中，社区增长迅速 |

sing-box 没有基于任何现有代码，而是完全从零开始用 Go 语言重新构建。这带来了几个重要优势：

- **代码架构更现代、更干净**，没有历史包袱，方便后续扩展和维护。
- **协议覆盖范围极广**，几乎支持市面上所有主流代理协议。
- **跨平台能力强**，同一套内核可以在 Windows、macOS、Linux、Android、iOS 上运行。
- **配置格式统一**，使用 JSON 格式，结构清晰。

sing-box 正在成为越来越多客户端的底层引擎选择，有逐步取代旧内核的趋势。部分观点认为它将成为下一个"事实标准"内核。

### mihomo（Clash Meta 内核）

| 属性 | 说明 |
|------|------|
| 开发者 | MetaCubeX 社区 |
| 定位 | 规则驱动的代理内核，Clash 生态的延续 |
| 支持协议 | VMess、VLESS、Trojan、Shadowsocks、Hysteria2、TUIC、WireGuard 等 |
| 独有特性 | 强大的规则分流系统、proxy-provider、rule-provider |
| 当前状态 | 活跃维护，Clash 生态的核心引擎 |

先说背景：最初的 Clash Premium 内核由原作者开发，于 2023 年 11 月突然删库停更。但 Clash 的社区分叉——Clash Meta——早在停更之前就已经独立发展，功能上远超原版。后来 Clash Meta 更名为 **mihomo**，这就是当前所有 Clash 系客户端实际使用的内核。

mihomo 最核心的优势在于它的**规则分流体系**：

- **rule-provider**：可以引用外部规则集文件，实现按域名、IP、进程等维度的精细流量分流。
- **proxy-group**：支持自动选择、负载均衡、URL 测速等节点组策略。
- **高级路由能力**：支持 SCRIPT 规则、逻辑规则组合，能实现非常复杂的分流逻辑。

如果你的核心需求是"让不同的网站走不同的节点，国内流量直连，国外流量走代理"，mihomo 的规则系统是目前最成熟、最灵活的方案。

---

## 四大内核横向对比

| 维度 | v2ray-core | xray-core | sing-box | mihomo |
|------|-----------|-----------|----------|--------|
| 协议支持 | 较全 | 最全（含独有协议） | 几乎全部 | 全面 |
| 独有特性 | 无 | Reality / XTLS / XHTTP | 现代架构 | 规则分流体系 |
| 配置复杂度 | 中等 | 中等 | 中等 | 较低（YAML 格式） |
| 更新频率 | 低 | 高 | 高 | 高 |
| 社区规模 | 中等 | 大 | 快速增长 | 大 |
| 最大优势 | 历史生态 | 协议创新 | 架构先进 | 分流规则 |
| 推荐度 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

> 推荐度说明：这里的推荐度是面向普通用户的综合评价。mihomo 获得最高分是因为大多数用户的核心需求是"用得舒服、分流好用"，而非"协议支持最新"。

---

## 各平台推荐客户端

选择客户端时需要考虑三个因素：你的操作系统、你需要的内核、以及你对界面和功能的偏好。

### Windows

![在桌面端配置代理客户端](/images/inline/laptop-coding.jpg)
*图片来源：[Unsplash](https://unsplash.com/)*

| 客户端 | 内核 | 特点 | 推荐度 |
|--------|------|------|--------|
| [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) | mihomo | 规则分流强大，GUI 美观，跨平台一致体验 | ⭐⭐⭐⭐⭐ |
| [v2rayN](https://github.com/2dust/v2rayN) | xray-core / sing-box | 功能全面，支持切换内核，协议支持最广 | ⭐⭐⭐⭐ |
| NekoBox | sing-box | 轻量简洁，sing-box 原生生态 | ⭐⭐⭐ |

**大多数 Windows 用户的最佳选择是 Clash Verge Rev。** 它安装简单，界面清晰，导入机场订阅后开箱即用，规则分流功能开箱即有。如果你需要使用 Reality、XHTTP 等最新协议特性，或者你更喜欢手动配置节点，v2rayN 是更好的选择。

### macOS

| 客户端 | 内核 | 特点 | 推荐度 |
|--------|------|------|--------|
| Clash Verge Rev | mihomo | 跨平台体验一致，与 Windows 版功能相同 | ⭐⭐⭐⭐⭐ |
| Surge | 自研内核 | macOS 原生体验最佳，功能极其强大，但需付费 | ⭐⭐⭐⭐ |

Clash Verge Rev 在 macOS 上的表现与 Windows 版完全一致，是多数用户的首选。Surge 则是 macOS/iOS 平台上公认体验最好的代理客户端，拥有最优秀的原生 UI 设计和最完善的调试工具，但其 macOS 版本价格不低。如果你追求极致的使用体验且不介意付费，Surge 值得考虑。

### iOS

| 客户端 | 内核 | 特点 | 推荐度 |
|--------|------|------|--------|
| Shadowrocket | 自研内核 | 价格便宜（$2.99），功能完善，性价比极高 | ⭐⭐⭐⭐⭐ |
| Surge | 自研内核 | 功能最强大，调试能力最好，价格最贵（$49.99） | ⭐⭐⭐⭐ |
| Stash | mihomo | Clash 规则生态，支持 rule-provider | ⭐⭐⭐⭐ |
| Loon | 自研内核 | 功能介于 Shadowrocket 和 Surge 之间 | ⭐⭐⭐ |

iOS 平台的客户端几乎全部是付费应用（因 App Store 政策限制）。**Shadowrocket 是性价比之王**——仅需 2.99 美元，支持主流协议，配置简单，满足绝大多数用户的日常需求。Surge 适合对代理有极高要求的高级用户，它的网络调试、MitM 抓包、脚本引擎等功能远超其他客户端，但 49.99 美元的价格也远超其他选择。Stash 适合习惯了 Clash 规则体系、希望在 iOS 上使用相同规则配置的用户。

> 提示：iOS 客户端需要非中国大陆地区的 Apple ID 才能购买和下载。

### Android

![在手机上配置代理](/images/inline/smartphone-setup.jpg)
*图片来源：[Unsplash](https://unsplash.com/)*

| 客户端 | 内核 | 特点 | 推荐度 |
|--------|------|------|--------|
| Clash Meta for Android | mihomo | Clash 生态，规则分流强大 | ⭐⭐⭐⭐⭐ |
| [v2rayNG](https://github.com/2dust/v2rayNG) | xray-core | 轻量稳定，支持最新协议 | ⭐⭐⭐⭐ |
| NekoBox | sing-box | sing-box 生态，功能丰富 | ⭐⭐⭐ |
| Surfboard | 自研内核 | 兼容 Surge 规则格式 | ⭐⭐⭐ |

Android 平台首推 **Clash Meta for Android**（也叫 CMFA），它与 Clash Verge Rev 使用相同的 mihomo 内核，规则配置可以通用。v2rayNG 更加轻量，适合不需要复杂分流规则、只想简单连接代理的用户。

### Linux

Linux 用户通常有一定的技术背景，可根据需求选择：

- **Clash Verge Rev**：有 GUI 需求时的最佳选择，与 Windows/macOS 版体验一致。
- **sing-box**：命令行运行，适合服务器环境或喜欢终端操作的用户。
- **mihomo**：命令行运行，适合需要 Clash 规则分流的场景，常用于路由器和服务器。

### 路由器（OpenWrt）

| 方案 | 内核 | 特点 | 推荐度 |
|------|------|------|--------|
| [OpenClash](https://github.com/vernesong/OpenClash) | mihomo | 最成熟的路由器方案，Web UI 完善 | ⭐⭐⭐⭐⭐ |
| PassWall / PassWall2 | xray-core | 功能强大，协议支持全面 | ⭐⭐⭐⭐ |
| sing-box | sing-box | 轻量，适合性能有限的路由器 | ⭐⭐⭐ |

在路由器上部署代理的好处是全家设备无需单独配置，连上 WiFi 就自动走代理。**OpenClash** 是目前使用最广泛的路由器代理方案，提供完善的 Web 管理界面，基于 mihomo 内核，支持完整的 Clash 规则分流。

---

## 怎么选？一个决策树

如果上面的信息太多，用这个简化的决策树快速做出选择：

```
你用的什么平台？
│
├── iOS
│   ├── 预算充足，追求极致 → Surge
│   └── 性价比优先（大多数人）→ Shadowrocket
│
├── Android
│   ├── 需要规则分流 → Clash Meta for Android
│   └── 简单好用就行 → v2rayNG
│
├── Windows / macOS / Linux
│   ├── 大多数用户 → Clash Verge Rev
│   └── 需要最新协议特性 → v2rayN（Windows）
│
└── 路由器（OpenWrt）→ OpenClash
```

**一句话总结：如果你不想深入研究，桌面平台选 Clash Verge Rev，iOS 选 Shadowrocket，Android 选 Clash Meta for Android。** 这三个选择覆盖了 90% 用户的需求。

---

## 常见问题

### Clash 不是停更了吗？还能用吗？

这是一个非常常见的误解。2023 年 11 月，原版 Clash Premium 的作者确实删除了代码库并停止开发。但这影响的只是原版内核。社区分叉 Clash Meta（现已更名为 mihomo）在此之前就已经独立发展，功能上远远超过了原版，并且一直保持活跃更新。

目前所有主流的 Clash 系客户端——Clash Verge Rev、Clash Meta for Android、OpenClash、Stash——使用的都是 mihomo 内核，而非已停更的原版。**Clash 生态不仅没有死，反而比原版时期更加活跃。**

### 选 Clash 系还是 V2Ray 系？

这取决于你的核心需求：

- **Clash 系（mihomo 内核）** 的优势在于规则分流。如果你需要精细地控制"哪些网站走代理、哪些直连、哪些走特定节点"，Clash 系的 rule-provider 和 proxy-group 体系是最成熟的解决方案。适合使用机场订阅的用户。

- **V2Ray 系（xray-core 内核）** 的优势在于协议支持全面和配置灵活。如果你自建节点，需要使用 Reality、XHTTP 等最新协议特性，或者需要对连接参数做精细调整，V2Ray 系客户端提供了更多的自由度。

**对于大多数使用机场订阅的普通用户，推荐 Clash 系。** 它的规则分流功能让你不用操心哪些流量该走代理，配置好后基本不需要手动干预。

### 免费客户端和付费客户端有什么区别？

桌面端（Windows、macOS、Linux）的客户端**大多数是免费且开源的**。Clash Verge Rev、v2rayN、v2rayNG、NekoBox、sing-box 都是免费的开源项目。

付费客户端主要集中在 iOS 平台（由于 App Store 的分发机制）。付费不一定意味着更好——Shadowrocket 只需 2.99 美元但功能非常完善，Surge 要 49.99 美元但提供了许多普通用户用不到的高级功能。对于绝大多数用户来说，Shadowrocket 的性价比远高于 Surge。

macOS 上的 Surge 也是付费软件，如果你不追求极致的原生体验，免费的 Clash Verge Rev 完全可以满足需求。

### 我需要同时安装多个客户端吗？

通常不需要。选择一个适合你平台和需求的客户端，坚持使用即可。同一台设备上运行多个代理客户端反而容易产生冲突（端口占用、TUN 模式冲突等）。

不过，备一个替代客户端是有好处的。如果你的主力客户端出现问题（崩溃、订阅无法更新、某个节点连不上），可以用备用客户端快速排除是客户端问题还是节点/网络问题。比如平时用 Clash Verge Rev，同时装一个 v2rayN 作为备用，二者不同时运行即可。

### 我应该选哪个内核？

作为普通用户，你其实不需要直接选择内核——**你选择客户端，客户端自带内核**。当你安装 Clash Verge Rev 时，mihomo 内核就已经包含在内了；当你安装 v2rayNG 时，xray-core 也已经内置了。

只有在以下情况下你需要关心内核的选择：

- 你在服务器或路由器上以命令行方式运行代理
- 你需要特定内核的独有功能（如 xray-core 的 Reality）
- 你的客户端支持切换内核（如 v2rayN 可以切换到 sing-box 内核）

---

## 写在最后

代理软件的选择不需要过度纠结。对于大多数用户来说，核心需求无非是：能连上、速度快、分流准。满足这三点的客户端都是好客户端。

如果你是完全的新手，按照本文的推荐选一个客户端安装好，然后去看 [第一次使用代理：从零开始的配置指南](./first-time-setup.md) 完成初始配置即可。更深入的技术细节（协议选择、规则配置、DNS 优化）可以等你用熟了之后再慢慢了解。

**先跑起来，再慢慢优化。**
