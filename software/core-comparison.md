# V2Ray vs Xray vs Sing-box：核心（内核）的区别与演进

> **摘要**: V2Ray、Xray、Sing-box 是当前最主流的三个代理内核。它们之间存在继承和分化关系——Xray 从 V2Ray 分裂而来，Sing-box 则是受其启发后从零构建的新生代。本文梳理它们的历史渊源、技术架构差异和各自的适用场景，帮助你理解"内核"这一层在整个代理体系中扮演的角色。

*最后更新：2026-05-10*

---

## 什么是"代理内核"

在讨论 V2Ray、Xray、Sing-box 之前，有必要澄清一个基础概念：**内核（core）是代理软件的底层引擎**，负责协议解析、流量路由、加解密等核心功能。你在手机或电脑上使用的 v2rayN、NekoBox、Clash Verge 等工具，它们本身只是图形界面（GUI），真正干活的是背后集成的内核。

换句话说，选择客户端时你其实在间接选择内核。理解内核之间的差异，有助于判断一个客户端的协议支持范围、性能上限和未来的可持续性。

---

## 一段简短的历史

### V2Ray 的诞生

V2Ray 项目诞生于 2015-2016 年前后，创建者使用化名"Victoria Raymond"（V2Ray 之名即源于此）。项目的初始目标并非发明某个单一协议，而是构建一个**通用的代理平台**——一个可以承载多种协议的框架。

V2Ray 引入了 VMess 协议，这是它的原生协议，采用 UUID 认证和自定义加密方案。在当时的环境下，VMess 相比传统的 SOCKS/HTTP 代理和早期 Shadowsocks 提供了更强的安全性保障。V2Ray 还设计了灵活的路由系统、多种传输方式（WebSocket、gRPC、HTTP/2 等），这些架构理念深刻影响了后来的所有代理项目。

2019 年左右，Victoria Raymond 逐步淡出项目。此后，V2Ray 由社区组织 **V2Fly** 接手维护，仓库名为 `v2fly/v2ray-core`。V2Fly 团队在维护期间保持了项目的基本稳定，但开发节奏明显放缓，新功能的推进速度远不及审查技术的演进速度。

### Xray 的分裂

2020 年末，开发者 **RPRX** 围绕 XTLS 技术与 V2Fly 团队产生了许可证分歧。XTLS 是一项重要的性能优化技术，能够在 TLS 代理场景下避免对 TLS 内层数据的重复加密，显著降低延迟和 CPU 开销。这一分歧最终导致 RPRX fork 了 v2ray-core，创建了 **Xray-core**（隶属 Project X 组织）。

Xray 并非简单的换皮分支。它在 V2Ray 的基础上带来了一系列关键技术突破：

- **VLESS 协议**：比 VMess 更轻量的协议设计，去掉了 VMess 冗余的加密层（依赖外层 TLS 提供安全性），降低了协议头部开销
- **XTLS（Vision）**：避免 TLS-in-TLS 的双重加密问题，在保持安全性的前提下大幅提升转发性能
- **Reality**：2023 年推出的反检测技术，无需域名和证书即可实现 TLS 伪装，将代理流量伪装成访问真实网站的 TLS 1.3 连接，是目前抗主动探测能力最强的方案之一
- **XHTTP 和 XMUX**：基于 HTTP 的新传输方式及其多路复用扩展，为 CDN 中转等场景提供更灵活的选择

截至 2026 年，Xray-core 的开发活跃度远超 v2ray-core，是协议创新的主要推动力量。在服务端部署领域，Xray 占据绝对主导地位。

### Sing-box 的崛起

Sing-box 走了一条完全不同的路。它的作者 **nekohasekai**（SagerNet 系列客户端的开发者）没有选择 fork V2Ray 或 Xray，而是从零开始用 Go 语言重新编写了一个全新的代理内核。

这个决策背后的逻辑是：V2Ray 的代码架构经过多年迭代已经变得臃肿，历史包袱沉重，模块间耦合度高，很难在其基础上做大规模的结构优化。与其在旧地基上修补，不如重新打地基。

Sing-box 的设计哲学是"**通用代理平台**"——不绑定某个特定协议阵营，而是尽可能广泛地支持各种协议。它同时支持 Xray 生态的 VLESS+Reality 和独立协议如 Hysteria2、TUIC，还提供了类似 Clash 的强大规则路由系统。

Sing-box 的增长势头很快。截至 2026 年，多个主流客户端（NekoBox、Hiddify、Clash Verge Rev 等）已将 sing-box 作为默认或可选内核。它在移动端（Android/iOS）的表现尤为突出，因为其现代化的架构在资源受限的移动设备上有更好的内存管理和电池效率。

---

## 技术对比

| 特性 | v2ray-core | xray-core | sing-box |
|------|-----------|-----------|----------|
| 开发语言 | Go | Go | Go |
| 协议支持 | VMess, VLESS, Trojan, Shadowsocks | VMess, VLESS, Trojan, Shadowsocks, Reality, XTLS, XHTTP | VMess, VLESS, Trojan, Shadowsocks, Reality, Hysteria2, TUIC |
| 独有能力 | — | XTLS Vision, Reality, XHTTP, XMUX | Hysteria2/TUIC 原生支持, 规则集路由 |
| 性能 | 中等 | 较高（XTLS 优化） | 较高 |
| 配置格式 | JSON | JSON（兼容 v2ray） | JSON（独立格式） |
| 路由功能 | 基础规则匹配 | 基础规则匹配 | 强大（类 Clash 规则集、逻辑运算、规则提供器） |
| 分流能力 | 域名/IP 匹配 | 域名/IP 匹配 | 域名/IP/进程/规则集/逻辑组合 |
| 维护活跃度 | 低（基本停滞） | 高 | 高 |
| 文档质量 | 一般 | 较好 | 好 |
| 移动端适配 | 一般 | 一般 | 优秀（原生库支持） |

几个值得注意的要点：

1. **v2ray-core 已基本停止实质性开发**。最近的更新以依赖升级和小修复为主，没有新协议和新功能的推进。选择它等同于选择一个不再演进的平台。

2. **Xray 和 Sing-box 在协议覆盖上高度重叠**，但侧重点不同。Xray 更专注于自有协议栈的创新（Reality、XHTTP），Sing-box 更专注于跨协议兼容和路由功能。

3. **性能差异在实际使用中通常不是瓶颈**。三个内核在同一协议下的吞吐量差异通常在 5-15% 以内，真正的性能瓶颈几乎总是在网络链路本身——你的线路质量、运营商的国际出口带宽、目标服务器的距离和负载，这些因素的影响远大于内核差异。

---

## 配置格式差异

三个内核都使用 JSON 作为配置文件格式，但结构完全不同。以下用"连接一个 VLESS+Reality 节点"为例，展示各自的出站（outbound）配置方式。

### v2ray-core / xray-core 格式

v2ray-core 和 xray-core 共享相同的配置结构（Xray 在此基础上扩展了 Reality 等字段）：

```json
{
  "outbounds": [
    {
      "protocol": "vless",
      "settings": {
        "vnext": [
          {
            "address": "example.com",
            "port": 443,
            "users": [
              {
                "id": "uuid-here",
                "encryption": "none",
                "flow": "xtls-rprx-vision"
              }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "serverName": "www.microsoft.com",
          "fingerprint": "chrome",
          "shortId": "abcd1234",
          "publicKey": "public-key-here"
        }
      }
    }
  ]
}
```

配置的核心逻辑是：`protocol` 指定协议类型，`settings` 定义服务器和用户信息，`streamSettings` 定义传输层和安全层参数。这种嵌套结构沿用了 V2Ray 早期的设计。

### sing-box 格式

```json
{
  "outbounds": [
    {
      "type": "vless",
      "tag": "proxy",
      "server": "example.com",
      "server_port": 443,
      "uuid": "uuid-here",
      "flow": "xtls-rprx-vision",
      "tls": {
        "enabled": true,
        "server_name": "www.microsoft.com",
        "utls": {
          "enabled": true,
          "fingerprint": "chrome"
        },
        "reality": {
          "enabled": true,
          "public_key": "public-key-here",
          "short_id": "abcd1234"
        }
      }
    }
  ]
}
```

Sing-box 的配置结构更加扁平化：服务器地址、端口、UUID 直接作为出站对象的顶层字段，没有 v2ray 那种 `vnext > users` 的多层嵌套。TLS 和 Reality 参数统一归入 `tls` 对象。整体可读性更好，编写出错的概率更低。

### 关键区别总结

- **v2ray/xray**：配置层级深（protocol > settings > vnext > users），传输层参数独立在 `streamSettings` 中，历史兼容性好但结构冗余
- **sing-box**：配置扁平化，字段命名使用 snake_case 而非 camelCase，TLS/传输参数整合在出站对象内部，语义更清晰

对于普通用户来说，这些差异很少需要手动处理——现代客户端通过分享链接（URI）或订阅自动生成配置。但如果你需要手写或调试配置，sing-box 的格式显然对人类更友好。

---

## 我应该选哪个

### v2ray-core：已不推荐

2026 年，基本没有选择 v2ray-core 的理由。它不支持 Reality、XTLS Vision、XHTTP 等现代协议特性，维护处于半停滞状态，安全更新也不及时。唯一合理的使用场景是你正在维护一个遗留系统，且迁移成本过高。

如果你还在使用基于 v2ray-core 的部署，强烈建议迁移到 Xray 或 Sing-box。Xray 的迁移路径最简单，因为它兼容 v2ray 的配置格式。

### xray-core：协议创新的前沿

选择 Xray 的理由：

- 你需要 **Reality** 的完整实现和最新特性（Xray 是 Reality 的原生发源地）
- 你需要 **XHTTP/XMUX** 传输方式来实现 CDN 中转等高级部署
- 你使用 **v2rayN**（Windows）、**V2RayNG**（Android）等以 Xray 为默认内核的客户端
- 你在**服务端部署**中需要最完整的协议选项
- 你已有 v2ray 格式的配置，希望无缝升级

Xray 是目前服务端部署最成熟的选择，社区经验积累最丰富，配置教程和问题排查资源最多。

### sing-box：现代化的全能选手

选择 Sing-box 的理由：

- 你想要**强大的路由和分流功能**（按域名、IP、进程、规则集灵活分流）
- 你使用 **NekoBox**、**Hiddify**、**Clash Verge Rev** 等以 sing-box 为内核的客户端
- 你需要在**移动端**获得更好的性能和电池表现
- 你需要 **Hysteria2** 或 **TUIC** 等基于 QUIC 的协议（sing-box 原生支持，Xray 不支持）
- 你希望配置文件更易读、更现代化

### 一个重要提醒

**大多数用户不需要直接选择内核。** 你选择的是客户端，内核是客户端内置的。v2rayN 内置 Xray，NekoBox 内置 Sing-box，Clash Verge Rev 使用 Mihomo（另一个内核）——你只需要选一个好用的客户端，内核的事交给客户端开发者去处理。

只有当你需要在服务端部署代理服务、手动编写配置、或在客户端之间做深度技术对比时，理解内核差异才真正重要。

---

## 它们之间的关系图

```
v2ray-core (2015)
    │
    ├──fork──→ xray-core (2020)
    │            ├── VLESS 协议优化
    │            ├── XTLS Vision 性能加速
    │            ├── Reality 反检测 (2023)
    │            └── XHTTP / XMUX 传输方式
    │
    └──inspired──→ sing-box (2022)
                    ├── 全新代码库，零历史包袱
                    ├── 多协议兼容（含 Hysteria2、TUIC）
                    └── 类 Clash 规则路由系统
```

Xray 和 V2Ray 之间是代码级的继承关系（fork），配置格式保持兼容。Sing-box 和 V2Ray 之间是理念上的继承关系（inspired），代码和配置完全独立。

三者之间并非零和竞争。Xray 的协议创新（如 Reality）被 sing-box 跟进支持，sing-box 的路由设计也在影响其他项目的发展方向。这种良性的技术竞争推动了整个代理生态的进步。

---

## 常见问题

### 三者可以互相替换吗？

大部分场景下可以。如果你的服务端使用标准协议（比如 VLESS+Reality+Vision），无论客户端使用 Xray 还是 Sing-box 都能正常连接——协议是通用的，内核只是协议的不同实现。

差异出现在高级功能上：Xray 的 XHTTP/XMUX 传输方式目前只有 Xray 客户端完整支持；sing-box 的 Hysteria2/TUIC 协议 Xray 不支持。选择内核时需要确认你使用的协议和传输方式是否在目标内核的支持范围内。

### 哪个性能最好？

实际差异很小。Xray 的 XTLS Vision 在代理 TLS 流量时有理论优势，因为它避免了内层 TLS 数据的重复加密/解密，CPU 开销更低。但在真实使用中，网络延迟、丢包率、带宽限制通常远大于内核层面的性能差异。对绝大多数用户来说，三个内核的性能表现在体感上没有区别。

如果你的场景对 CPU 开销极度敏感（比如在低性能 ARM 设备上跑高带宽代理），XTLS Vision 的优势会更明显。

### Sing-box 会取代 Xray 吗？

短期内不会，中长期两者更可能持续共存。原因是它们的定位有本质差异：

- **Xray** 的核心竞争力在于**协议创新**——Reality、XHTTP 等技术都诞生于 Xray 社区。它更像是代理协议的"研发实验室"。
- **Sing-box** 的核心竞争力在于**平台统一性**——用一个内核覆盖尽可能多的协议和平台，提供一致的配置体验和路由功能。它更像是代理协议的"集成平台"。

两者在生态位上互补而非对立。

### 我在用 Clash，和这三个内核是什么关系？

Clash（包括 Clash Meta / Mihomo）是一个独立的内核体系，有自己的配置格式和协议实现。它和 V2Ray/Xray/Sing-box 是平行关系，不存在继承或依赖关系。不过，Clash 也支持 VMess、VLESS、Trojan 等协议——这些协议是通用标准，任何内核都可以独立实现。

值得注意的是，原版 Clash 已经停止维护。目前活跃的 **Mihomo**（原 Clash Meta）和 **Clash Verge Rev** 等项目在继续推进 Clash 生态的发展。部分 Clash 衍生客户端（如 Clash Verge Rev 的某些版本）也开始支持使用 sing-box 作为可选内核。

---

## 写在最后

V2Ray 开创了"通用代理平台"的理念，Xray 在此基础上推动了协议层面的重大突破，Sing-box 则以全新的工程实践重新诠释了这一理念。三者的关系是技术演进的自然脉络，而非简单的优劣之分。

对于普通用户，选一个好用的客户端，确保它支持你需要的协议，就足够了。内核的选择通常已经被客户端开发者做好了。

对于进阶用户和服务端运维者，理解这三个内核的差异有助于做出更合理的技术决策——比如服务端用 Xray 获得最完整的协议支持，客户端侧选择 sing-box 系客户端获得更好的路由和分流能力。

代理技术仍在快速迭代。本文反映的是 2026 年中的状态，半年后具体的功能对比可能已经发生变化。但核心逻辑不会变：**理解工具的设计思路，比记住工具的功能列表更重要。**

---

*本文由 [ednovas.xyz](https://ednovas.xyz) 原创发布*
