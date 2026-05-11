---
title: Clash 系列全解：Clash Premium / Clash Meta / mihomo 的关系
date: 2026-05-10
updated: 2026-05-10
categories:
  - 代理软件
tags:
  - Clash
  - mihomo
  - Clash Verge
  - OpenClash
  - 客户端
index_img: /images/posts/clash-family.jpg
excerpt: Clash 生态经历了开源、闭源、删库、fork 等戏剧性事件。梳理 Clash 系列的演变历史和当前应该使用的版本。
---

> **摘要**：Clash 生态经历了开源、闭源、删库、fork 等戏剧性事件。本文梳理 Clash 系列的演变历史，解释各个分支的关系，帮助你理解当前应该使用哪个版本。

## Clash 的诞生与繁荣

2018 至 2019 年间，开发者 Dreamacro 用 Go 语言创建了 Clash——一个基于规则的代理客户端。它的出现彻底改变了中文代理社区的格局。

在 Clash 之前，代理客户端的配置方式大多是图形界面点选或 JSON 手写，灵活性和可读性都有限。Clash 引入了 **YAML 配置文件**这一设计，让配置变得既直观又强大。一份 YAML 文件就能定义所有的代理节点、分流规则、DNS 设置和策略组——而且可读、可版本控制、可复用。

Clash 带来的核心创新包括：

- **YAML 配置格式**：结构清晰、易于维护，对比 JSON 大幅降低了配置门槛。
- **代理组（Proxy Groups）**：支持自动选择、负载均衡、故障转移等策略，节点管理从"选一个用"变成了"设好策略自动选"。
- **规则分流系统**：通过 DOMAIN、GEOIP、IP-CIDR 等规则类型，精确控制每一条连接走代理还是直连。
- **混合代理模式**：同时支持 HTTP 代理、SOCKS5 代理和透明代理，一个客户端满足所有场景。
- **rule-provider**：将规则集独立托管，客户端自动拉取更新，不需要每次手动修改配置文件。
- **RESTful API**：提供外部控制接口，让 Web UI 和第三方工具能远程管理 Clash。

凭借这些设计，Clash 迅速成为中文代理社区最主流的框架。它的成功不仅在于自身，还在于催生了一整个生态——基于 Clash 的图形化客户端、规则集、配置模板、订阅转换服务遍地开花。

### 两个版本：Clash 与 Clash Premium

Clash 在早期就分化为两个版本：

- **Clash（开源版）**：核心功能完整，代码开源在 GitHub，社区可以审计和贡献。
- **Clash Premium（闭源版）**：在开源版基础上增加了高级功能，以二进制形式分发，不开放源码。

Clash Premium 增加的关键特性包括 **TUN 模式**（在系统层面接管所有流量，不仅限于配置了代理的应用）、**rule-provider**（早期只有 Premium 版支持）、**Script 脚本支持**（用 Python/JS 编写自定义分流逻辑）。

这种"核心开源 + 高级功能闭源"的模式在当时并不罕见，Clash Premium 的功能确实强大，但闭源也为后来的变故埋下了隐患：一旦作者停止维护，社区无法接手闭源部分的代码。

## 2023 年 11 月：大删库事件

2023 年 11 月，Dreamacro 突然删除了 GitHub 上的 Clash 仓库。不仅仅是 Clash 核心——几乎在同一时间，基于 Clash 的多个重要项目也纷纷下线：

- **Clash for Windows**（最流行的 Windows 端图形化客户端）宣布停止维护。
- **Clash for Android** 归档。
- 一系列相关工具和文档也被清理。

这在中文代理社区引发了强烈震动。Clash 彼时已经是事实上的"基础设施"级项目，无数用户的日常上网依赖它，无数机场的配置格式围绕它构建。

关于删库的原因，Dreamacro 本人没有做详细公开说明。社区的普遍推测包括：

- **监管压力**：Clash for Windows 的开发者据传受到了约谈或警告，引发连锁反应。
- **个人决定**：长期维护开源项目的压力和风险积累。
- **法律风险规避**：主动下架以避免潜在的法律责任。

无论真实原因是什么，这次事件产生了两个关键结果：

1. **原版 Clash 和 Clash Premium 彻底停止了更新。** 没有新功能、没有 bug 修复、没有协议适配。
2. **社区 fork 成为唯一的延续路径。** 幸运的是，Clash 的开源版本在删库前就已经被大量 fork，而且最重要的 fork——Clash Meta——在删库之前就已经是一个成熟的、独立发展的项目。

## 当前的 Clash 家族

### Clash Premium：已停止维护

Clash Premium 作为原版闭源增强版，曾是功能最完整的 Clash 内核。它支持 TUN 模式、rule-provider、Script 脚本等高级功能，在很长一段时间内是高级用户和机场配置的首选内核。

但由于闭源且已停更，Clash Premium 存在以下问题：

- **不再有安全更新**：已知的漏洞不会被修复。
- **不支持新协议**：VLESS、Reality、Hysteria2 等 2023 年后成为主流的协议完全不被支持。
- **无法获取新版本**：官方分发渠道已关闭，网上流传的版本来源不明，存在安全隐患。

**如果你还在使用 Clash Premium，强烈建议尽快迁移到 mihomo。** 迁移成本几乎为零——mihomo 完全兼容 Clash Premium 的配置格式。

### Clash Meta 到 mihomo：核心继承者

**mihomo**（原名 Clash.Meta）是当前 Clash 生态最重要的项目，也是事实上的"Clash 正统继承者"。

这个项目由 MetaCubeX 团队维护，创建时间早于删库事件。最初，它作为 Clash 的一个增强 fork 存在，目标是添加原版 Clash 和 Clash Premium 都不支持的新协议和新功能。

在删库事件后，Clash.Meta 更名为 **mihomo**——这个看似随意的名字背后是出于法律和安全考量的慎重决定。与"Clash"品牌脱钩，可以降低项目因名称关联而受到波及的风险。

mihomo 的定位非常明确：**在完全兼容 Clash 配置格式的前提下，持续跟进最新的代理协议和技术。**

目前 mihomo 活跃维护，更新频率高，新协议的支持通常在协议发布后很快跟进。它已经取代了原版 Clash 和 Clash Premium 的位置，成为绝大多数 Clash 系客户端的底层内核。

**GitHub 地址**：MetaCubeX/mihomo

### 其他值得关注的分支

除了 mihomo，Clash 删库后还出现了一些其他 fork 和衍生项目。但从活跃度、功能完整度和社区采用度来看，mihomo 是压倒性的主流选择，其他项目的影响力相对有限。MetaCubeX 团队同时还维护 **metacubexd**（一个现代化的 Clash Web Dashboard）等配套工具，形成了完整的生态。

## 基于 mihomo 的客户端

mihomo 本身是一个命令行内核。大多数用户通过图形化客户端来使用它——这些客户端内置或调用 mihomo 核心，提供界面操作。

### Clash Verge Rev（桌面端首选）

- **平台**：Windows / macOS / Linux
- **技术栈**：Tauri（Rust + Web 前端）
- **定位**：当前桌面端最推荐的 Clash 系客户端

Clash Verge Rev 是原 Clash Verge 项目的社区继承版本。原版 Clash Verge 在大删库事件后也停止了更新，社区随后 fork 并继续维护，命名为 Clash Verge Rev（Rev 即 Revival/Revised 之意）。

它的优势在于：

- **界面现代**：比起老旧的 Clash for Windows，UI 设计更加清爽。
- **内存占用低**：得益于 Tauri 框架（Rust 后端），相比 Electron 方案内存占用显著更小。
- **功能完整**：支持 mihomo 的全部功能，包括 TUN 模式、规则集管理、节点测速等。
- **更新活跃**：社区持续维护，跟进 mihomo 的新版本。

**GitHub 地址**：clash-verge-rev/clash-verge-rev

### OpenClash（路由器端首选）

- **平台**：OpenWrt
- **定位**：路由器级别的代理解决方案，全家设备无需单独安装客户端

OpenClash 是 OpenWrt 路由器上最流行的代理插件。它通过 LuCI Web 界面提供管理能力，支持 mihomo 内核，可以在路由器层面为整个局域网提供透明代理。

对于家庭用户来说，在路由器上运行 OpenClash 意味着所有连接到这个路由器的设备——手机、平板、电视、游戏机——都自动通过代理上网，无需逐一安装和配置客户端。

### Clash Meta for Android（Android 端）

- **平台**：Android
- **定位**：Android 上的 mihomo 图形化客户端

采用 Material Design 界面风格，功能覆盖 mihomo 的主要特性。支持导入订阅链接、管理规则集、切换节点和代理模式。对于 Android 用户来说，是比较直接的 Clash 系选择。

不过需要注意，Android 端目前也有 sing-box 等替代方案正在快速发展。

### Stash（iOS 端）

- **平台**：iOS / macOS
- **定位**：兼容 Clash 配置格式的商业客户端

Stash 是一款付费应用（App Store 上架），**不直接使用 mihomo 内核**，而是使用自己的实现。但它兼容 Clash YAML 配置格式，这意味着你为 Clash/mihomo 编写的配置文件可以直接导入 Stash 使用。

对于 iOS 用户来说，Stash 和 Shadowrocket 是两个主要选择。Stash 更偏向"Clash 生态"，Shadowrocket 则更通用。

## mihomo 相比原版 Clash 的改进

mihomo 不仅仅是"接手维护"，它在功能上已经远远超越了原版 Clash Premium。以下是关键差异：

| 特性 | 原版 Clash Premium | mihomo |
|------|-------------------|--------|
| VLESS 协议 | ❌ 不支持 | ✅ 完整支持 |
| Reality 协议 | ❌ 不支持 | ✅ 完整支持 |
| Hysteria2 | ❌ 不支持 | ✅ 完整支持 |
| TUIC 协议 | ❌ 不支持 | ✅ 完整支持 |
| TCP Brutal | ❌ 不支持 | ✅ 支持 |
| Sub-Rule | ❌ 不支持 | ✅ 支持嵌套规则 |
| GeoSite 数据库 | 有限支持 | ✅ 完整支持 |
| XHTTP 传输 | ❌ 不支持 | ✅ 支持 |
| SSH 协议代理 | ❌ 不支持 | ✅ 支持 |
| 维护状态 | 已停止（2023 年 11 月） | 活跃开发中 |

几个特别值得说明的改进：

- **VLESS + Reality**：这是目前抗检测能力最强的协议组合之一。mihomo 对其的支持意味着你可以在 Clash 配置体系下直接使用最先进的协议，不需要切换到其他内核。详见 [VLESS + Reality 深度解析](../protocols/vless-reality-deep-dive.md)。
- **Hysteria2 和 TUIC**：这两个基于 QUIC（UDP）的协议在高延迟、高丢包网络下有显著优势。原版 Clash 完全没有 UDP 代理协议的支持，mihomo 填补了这个空白。
- **Sub-Rule（子规则）**：允许在规则匹配后进一步细分处理逻辑，配置灵活度大幅提升。

## 配置兼容性

从 Clash Premium 迁移到 mihomo，配置兼容性是大多数用户最关心的问题。好消息是：**mihomo 对 Clash Premium 配置格式保持了高度向后兼容**。

具体来说：

- **标准 Clash YAML 配置文件**可以直接被 mihomo 解析和使用，几乎不需要任何修改。
- **rule-provider、proxy-provider** 等 Clash Premium 引入的功能在 mihomo 中完全支持。
- **代理组策略**（url-test、fallback、load-balance 等）的语法和行为与原版一致。
- **DNS 配置**的格式和逻辑兼容。

新功能方面，mihomo 使用了扩展的 YAML 语法来支持原版 Clash 不存在的协议和特性。例如，添加一个 VLESS + Reality 节点的写法：

```yaml
proxies:
  - name: "vless-reality"
    type: vless
    server: your.server.com
    port: 443
    uuid: your-uuid
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    servername: www.microsoft.com
    reality-opts:
      public-key: your-public-key
      short-id: your-short-id
```

这些扩展语法不会影响已有的 Clash 配置——你的旧配置依然正常工作，只是在需要使用新协议时才会用到新语法。

**订阅转换**方面，主流的订阅转换服务（如 subconverter）都已支持输出 mihomo 兼容格式。大多数机场的订阅链接也已经默认适配 mihomo。如果你的机场订阅链接直接能用，不需要做任何转换。

## 常见问题

### Q：现在搜"Clash"搜到的是什么版本？

如果你在搜索引擎中搜索"Clash 代理"或"Clash 下载"，搜到的几乎都是基于 mihomo 的产品——Clash Verge Rev、OpenClash、Clash Meta for Android 等。原版 Clash 和 Clash Premium 的下载链接已经不存在了。在 2024 年之后的语境下，"Clash"这个词实际上已经等同于"mihomo 生态"。

### Q：我的 Clash 配置文件还能用吗？

如果你的配置是标准的 Clash YAML 格式，几乎 100% 可以直接在 mihomo 下使用。直接导入即可。唯一可能需要调整的情况是：你的配置中使用了 Clash Premium 的 Script 功能（用 Python 脚本自定义分流逻辑），这个功能在 mihomo 中的实现方式有所不同。

### Q：Clash Verge 和 Clash Verge Rev 什么关系？

Clash Verge 是原版客户端，由 zzzgydi 开发。在删库事件后，原版 Clash Verge 也停止了更新。Clash Verge Rev 是社区基于原版的 fork，由新的维护团队继续开发。两者的界面和交互非常相似，但 Rev 版本修复了旧版的 bug、跟进了 mihomo 的新功能、改善了性能和稳定性。**推荐使用 Rev 版本**。

### Q：还有必要用 Clash 系吗？Sing-box 不是更新？

这是一个好问题。sing-box 确实是更新的代理框架，架构设计更现代，性能也有一定优势。但 Clash 系（mihomo）的核心优势在两个方面：

1. **规则系统的成熟度**：Clash 的 rule-provider 生态已经非常完善，社区维护着大量成熟的规则集（Loyalsoldier、MetaCubeX、ACL4SSR 等），覆盖了绝大多数分流场景。这些规则集经过多年迭代，准确性高、维护频繁。
2. **社区生态的庞大**：配置模板、教程文档、问题解答——围绕 Clash/mihomo 的社区资源极其丰富。遇到问题时，搜索到解决方案的概率远高于 sing-box。

对于大多数用户来说，Clash Verge Rev（mihomo 内核）仍然是**上手最快、维护成本最低**的选择。如果你对 sing-box 有兴趣，可以参考 [Sing-box 使用指南](./singbox-guide.md) 和 [Sing-box TUN vs Clash Verge TUN：实际体验对比](./singbox-vs-clash-tun.md)。

### Q：mihomo 的名字为什么这么奇怪？

mihomo 这个名字并没有特别深的含义。项目更名的主要目的是与"Clash"品牌脱钩，降低因品牌名称关联而带来的法律和安全风险。名字本身不重要——重要的是它是目前最活跃、功能最完整的 Clash 兼容内核。

### Q：我是新用户，应该从哪个客户端开始？

根据你的平台选择：

- **Windows / macOS / Linux**：Clash Verge Rev。下载安装后导入订阅链接即可使用。
- **Android**：Clash Meta for Android 或 v2rayNG。
- **iOS**：Stash（付费，兼容 Clash 配置）或 Shadowrocket（付费，更通用）。
- **路由器（OpenWrt）**：OpenClash。

如果你是第一次使用代理，建议先阅读 [第一次使用代理：从零开始的配置指南](../beginner/first-time-setup.md)。

## 总结

Clash 的故事是开源社区韧性的一个缩影。原始项目虽然消失了，但它的设计理念和配置生态通过 mihomo 延续了下来，并且在功能上走得更远。

当前的 Clash 生态简单明了：

- **内核**：mihomo（MetaCubeX/mihomo）——唯一活跃维护的 Clash 兼容内核。
- **桌面客户端**：Clash Verge Rev——最推荐的跨平台图形化客户端。
- **路由器**：OpenClash——OpenWrt 上的首选方案。
- **配置格式**：Clash YAML——经过 mihomo 扩展，支持所有现代协议。

如果你曾经用过 Clash，你的知识和配置仍然有效。如果你是新用户，直接从 mihomo 生态开始即可。无论哪种情况，Clash 的规则系统和配置哲学在代理工具领域仍然是最成熟、最易用的方案之一。
