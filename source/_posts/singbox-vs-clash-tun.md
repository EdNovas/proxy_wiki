---
title: Sing-box TUN vs Clash Verge TUN：实际体验对比
date: 2026-05-10
updated: 2026-05-10
categories:
  - 代理软件
tags:
  - Sing-box
  - Clash
  - TUN
  - 性能
  - 对比
index_img: /images/posts/singbox-vs-clash-tun.png
excerpt: 两大主流代理平台的 TUN 实现各有特点。Sing-box TUN 性能略优，Clash Verge TUN 配置更友好。
---

> **摘要**：TUN 模式是现代代理客户端的核心功能，能够接管系统的全部网络流量。Sing-box 和 Clash Verge（基于 mihomo）是目前最主流的两大代理平台，它们各自实现了 TUN 功能。本文从性能、兼容性、配置复杂度和生态四个维度进行实际对比，帮助你做出选择。

## TUN 模式回顾

在深入对比之前，有必要快速回顾 TUN 模式的基本原理。如果你已经熟悉相关概念，可以跳过本节。

TUN（network TUNnel）是操作系统提供的一种虚拟网络设备。代理客户端创建一个 TUN 网卡后，通过修改系统路由表，将所有网络流量引导到这张虚拟网卡。代理客户端从 TUN 设备读取原始 IP 数据包，解析出目标地址后，根据规则决定是直连还是走代理。

与传统的系统代理（HTTP/SOCKS5）相比，TUN 模式的关键优势在于：

- **全局覆盖**：不依赖应用程序主动遵守代理设置，任何产生网络流量的程序都会被接管
- **协议无关**：可以处理 TCP、UDP 以及 ICMP 等所有类型的流量
- **透明代理**：对应用程序完全透明，不需要程序做任何修改

关于 TUN 模式的更多细节，可以参考 [TUN 模式与系统代理的区别](/posts/tun-vs-system-proxy/)。

## 两大平台的 TUN 实现

### mihomo（Clash 内核）的 TUN

Clash Verge 使用的底层内核是 [mihomo](https://github.com/MetaCubeXorg/mihomo)（原 Clash.Meta）。mihomo 的 TUN 实现经历了多次迭代，目前提供三种网络栈（stack）选项：

| 网络栈 | 实现方式 | 特点 |
|--------|----------|------|
| gVisor | 用户态 TCP/IP 栈 | 兼容性最好，性能适中，内存占用稍高 |
| system | 系统内核栈 | 性能最好，但某些场景下兼容性不如 gVisor |
| mixed | 混合模式 | TCP 使用 system 栈，UDP 使用 gVisor 栈，兼顾性能和兼容性 |

mihomo 的 TUN 实现与其规则系统深度集成。流量从 TUN 设备进入后，会经过完整的规则匹配流程，包括域名嗅探（sniffer）、DNS 解析、规则匹配和策略选择。这个过程对用户来说是透明的，只需要在配置文件中启用 TUN 即可：

```yaml
tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
  auto-route: true
  auto-detect-interface: true
```

mihomo TUN 的一个重要特性是**域名嗅探（sniffer）**。由于 TUN 模式工作在网络层，收到的是 IP 数据包而不是域名请求，mihomo 会通过分析 TLS Client Hello 中的 SNI 或 HTTP 请求中的 Host 字段来"嗅探"出真实的目标域名，从而实现基于域名的规则匹配。

### sing-box 的 TUN

[sing-box](https://github.com/SagerNet/sing-box) 是由 SagerNet 项目开发的代理平台，以模块化和高性能为设计目标。sing-box 有自己独立的 TUN 实现，同样提供三种网络栈选项：

| 网络栈 | 说明 |
|--------|------|
| gVisor | 与 mihomo 类似，使用用户态 TCP/IP 栈 |
| system | 使用系统内核的网络栈 |
| mixed | TCP 使用 system，UDP 使用 gVisor |

sing-box 的 TUN 配置使用 JSON 格式：

```json
{
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "tun0",
      "inet4_address": "172.19.0.1/30",
      "auto_route": true,
      "stack": "mixed",
      "sniff": true,
      "sniff_override_destination": false
    }
  ]
}
```

sing-box 的 TUN 实现有一些自己的特点：

- **独立的网络栈代码**：sing-box 维护了自己的 gVisor 网络栈适配层，而不是直接复用 mihomo 的代码
- **更细粒度的嗅探控制**：可以分别配置是否嗅探以及是否覆盖目标地址
- **平台特定优化**：在 Android 和 iOS 平台上有针对性的优化

## 性能对比

这是很多用户最关心的问题：两者的 TUN 性能到底有多大差距？

### 吞吐量测试

根据社区多位用户的实测数据（使用 iperf3 进行局域网吞吐量测试），在相同硬件和相同网络栈配置下：

| 测试条件 | mihomo TUN | sing-box TUN | 差异 |
|----------|-----------|-------------|------|
| TCP 下载（gVisor 栈） | ~850 Mbps | ~920 Mbps | sing-box 快约 8% |
| TCP 下载（system 栈） | ~1.1 Gbps | ~1.2 Gbps | sing-box 快约 9% |
| TCP 下载（mixed 栈） | ~1.0 Gbps | ~1.1 Gbps | sing-box 快约 10% |
| UDP 吞吐 | ~600 Mbps | ~650 Mbps | sing-box 快约 8% |

从数据上看，sing-box 的 TUN 在吞吐量方面确实略优于 mihomo，大约有 **8-10% 的性能优势**。

### 延迟测试

在延迟方面，两者的差异更小：

| 测试条件 | mihomo TUN | sing-box TUN |
|----------|-----------|-------------|
| TUN 处理延迟（本地） | ~0.3ms | ~0.2ms |
| 规则匹配延迟 | ~0.1ms | ~0.1ms |
| 总体感知延迟 | 基本无差异 | 基本无差异 |

### 内存占用

| 场景 | mihomo | sing-box |
|------|--------|---------|
| 空载 | ~30 MB | ~25 MB |
| 500 条活跃连接 | ~80 MB | ~65 MB |
| 2000 条活跃连接 | ~180 MB | ~140 MB |

sing-box 在内存占用方面也有一定优势，特别是在高连接数的情况下。

### 性能差异的实际意义

这里需要强调一个重要的结论：**在实际使用中，这些性能差异几乎不可感知**。

原因很简单——TUN 本身的处理速度远高于实际的网络带宽瓶颈。即便是性能较低的 mihomo TUN，其 gVisor 栈也能提供 850 Mbps 的吞吐量，而大多数用户的代理节点带宽远低于这个数字。通常，你的实际代理速度受限于：

1. **代理服务器的带宽**（通常 100-500 Mbps）
2. **国际网络链路质量**（丢包和延迟）
3. **代理协议的加解密开销**

TUN 本身的性能差异被这些更大的瓶颈完全掩盖了。除非你在本地局域网中使用 TUN 做纯粹的流量转发，否则几乎不会感受到两者的区别。

## 兼容性差异

虽然两者都支持三种网络栈，但在具体的应用场景中，兼容性表现并不完全一致。

### 游戏兼容性

一些在线游戏（特别是使用 UDP 的游戏）对 TUN 模式有较高的敏感度。根据社区反馈：

- **原神/星铁**：两者都能正常工作，无明显差异
- **Valorant**：Valorant 的反作弊系统（Vanguard）对 TUN 模式非常敏感，两者都可能遇到问题，需要特殊配置
- **Steam 在线游戏**：大部分情况下两者表现一致
- **Switch/PS 联机**（通过 TUN 网关）：sing-box 在 UDP 转发方面略有优势

### 特殊协议兼容性

- **QUIC/HTTP3**：两者都支持，但 sing-box 对 QUIC 的处理更精细
- **IPv6**：sing-box 的 IPv6 TUN 支持更完善
- **WireGuard over TUN**：两者都支持，表现一致

### 平台兼容性

| 平台 | mihomo TUN | sing-box TUN |
|------|-----------|-------------|
| Windows | 需要 Wintun 驱动 | 需要 Wintun 驱动 |
| macOS | 原生支持 | 原生支持 |
| Linux | 原生支持 | 原生支持 |
| Android | 通过客户端支持 | 原生支持 |
| iOS | 有限支持 | 通过 SFI 支持 |

在桌面平台上，两者的 TUN 兼容性基本一致。差异主要体现在移动平台上——sing-box 在 Android（SFA）和 iOS（SFI）上有原生的 TUN 实现，而 mihomo 在移动平台主要依赖第三方客户端。

## 配置复杂度

这是两者差异最明显的地方。

### mihomo（YAML）的配置

mihomo 使用 YAML 格式，配置相对简洁直观：

```yaml
tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
  auto-route: true
  auto-detect-interface: true

dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - https://dns.alidns.com/dns-query

proxies:
  - name: "HK-Server"
    type: trojan
    server: hk.example.com
    port: 443
    password: your-password

rules:
  - DOMAIN-SUFFIX,google.com,HK-Server
  - GEOIP,CN,DIRECT
  - MATCH,HK-Server
```

整个配置在一个 YAML 文件中完成，结构清晰，易于阅读和修改。Clash Verge 的 GUI 还提供了图形化的配置界面，进一步降低了上手门槛。

### sing-box（JSON）的配置

sing-box 使用 JSON 格式，配置更加详细和冗长：

```json
{
  "log": { "level": "info" },
  "dns": {
    "servers": [
      {
        "tag": "google",
        "address": "tls://8.8.8.8"
      },
      {
        "tag": "local",
        "address": "https://dns.alidns.com/dns-query",
        "detour": "direct"
      }
    ],
    "rules": [
      {
        "geosite": "cn",
        "server": "local"
      }
    ]
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "inet4_address": "172.19.0.1/30",
      "auto_route": true,
      "stack": "mixed",
      "sniff": true
    }
  ],
  "outbounds": [
    {
      "type": "trojan",
      "tag": "hk-server",
      "server": "hk.example.com",
      "server_port": 443,
      "password": "your-password"
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "rules": [
      {
        "geosite": "cn",
        "geoip": "cn",
        "outbound": "direct"
      }
    ],
    "final": "hk-server"
  }
}
```

可以看到，实现相同的功能，sing-box 的配置文件长度大约是 mihomo 的 **2-3 倍**。JSON 格式的冗长是一个客观缺点——没有注释支持（虽然 sing-box 扩展了 JSON 允许注释），不能像 YAML 那样通过缩进来表达层次关系，阅读体验较差。

### 配置复杂度对比

| 维度 | mihomo (YAML) | sing-box (JSON) |
|------|--------------|----------------|
| 文件格式 | YAML（简洁） | JSON（冗长） |
| 注释支持 | 原生支持 | 需要特殊处理 |
| 配置模板 | 社区海量模板 | 模板相对较少 |
| GUI 支持 | Clash Verge 提供完整 GUI | GUI 客户端较少 |
| 学习成本 | 较低 | 较高 |
| 文档完整度 | 中等 | 良好 |

## 生态差异

### 规则资源

Clash/mihomo 的规则生态是目前最丰富的。社区维护了大量的规则集和配置模板：

- **[Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)**：高质量的规则集合
- **[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)**：覆盖面极广的规则项目
- 各类 Clash 配置生成工具

sing-box 的规则资源相对较少，但正在快速增长。sing-box 1.8+ 引入了 rule-set 功能，使得规则的分享和复用变得更加方便。

### 客户端生态

| 平台 | mihomo 客户端 | sing-box 客户端 |
|------|-------------|----------------|
| Windows | Clash Verge, Clash Nyanpasu | sing-box GUI (有限) |
| macOS | Clash Verge, Clash Nyanpasu | SFM |
| Linux | Clash Verge | sing-box CLI |
| Android | Clash Meta for Android | SFA (sing-box for Android) |
| iOS | Stash (付费) | SFI (sing-box for iOS) |

Clash 系列的客户端在桌面平台上有明显的优势——Clash Verge 提供了成熟的图形界面、配置管理和快捷操作。sing-box 在移动平台（特别是 Android）上的客户端体验不错，但桌面端的 GUI 支持仍然较弱。

### 订阅格式

大多数机场默认提供 Clash（YAML）格式的订阅链接，而 sing-box（JSON）格式的订阅支持在逐步增加。如果你的机场不提供 sing-box 格式的订阅，可以使用订阅转换工具（如 [subconverter](https://github.com/tindy2013/subconverter)）进行格式转换。

## 实际使用建议

综合以上对比，给出以下建议：

### 选择 Clash Verge（mihomo TUN）如果你：

- 刚接触代理，需要友好的图形界面
- 使用 Windows 或 macOS 桌面平台
- 需要大量现成的规则和配置模板
- 机场提供 Clash 格式订阅
- 不想花时间在配置上

### 选择 sing-box TUN 如果你：

- 追求极致的性能和资源占用
- 主要在 Android 平台使用
- 熟悉 JSON 配置且不介意手写配置
- 需要 sing-box 特有的功能（如更细粒度的嗅探控制）
- 已经有 sing-box 格式的配置

### 核心结论

**选择应该基于客户端偏好，而不是 TUN 实现本身。** TUN 的性能差异在实际使用中几乎不可感知，真正影响你日常体验的是客户端的 GUI 界面、配置方便程度和规则生态。对大多数用户来说，Clash Verge 仍然是综合体验最好的选择。

## 常见问题（FAQ）

### Q1：sing-box TUN 真的比 Clash TUN 快吗？

在纯粹的 TUN 吞吐量测试中，sing-box 确实快 8-10%。但这个差异在实际的代理使用场景中几乎不可感知，因为瓶颈在于代理服务器和国际链路，不在本地 TUN 层。

### Q2：两者的 TUN 可以同时开启吗？

不可以。同一台设备上只能有一个程序创建 TUN 设备并接管路由。如果两个代理同时尝试创建 TUN，会产生冲突。

### Q3：TUN 模式下的 DNS 处理有什么区别？

两者都支持 Fake-IP 和 Real-IP（redir-host）两种 DNS 模式。mihomo 的 Fake-IP 实现更成熟（使用时间更长），sing-box 的 DNS 模块更加灵活。对于大多数用户来说，两者的 DNS 处理效果没有明显区别。

### Q4：哪个对游戏更友好？

两者差异不大。如果你遇到特定游戏在某一平台的 TUN 模式下有问题，可以尝试切换网络栈（从 gVisor 换成 system 或 mixed），通常能解决兼容性问题。

### Q5：从 Clash Verge 迁移到 sing-box 困难吗？

需要将整个配置从 YAML 转换为 JSON 格式，规则语法也有差异。有一些社区工具可以辅助转换，但通常需要手动调整。如果你对现有的 Clash Verge 配置满意，没有特别的理由去迁移。

### Q6：未来的趋势是什么？

sing-box 的开发更加活跃，架构设计也更现代化。从长远来看，sing-box 可能会逐步成为更主流的选择。但 mihomo 社区庞大，短期内不会消亡。选择任一平台都不会"过时"。

## 外部链接

- [mihomo GitHub 仓库](https://github.com/MetaCubeXorg/mihomo)
- [sing-box GitHub 仓库](https://github.com/SagerNet/sing-box)
- [sing-box 官方文档](https://sing-box.sagernet.org/)
- [Clash Verge 下载](https://github.com/clash-verge-rev/clash-verge-rev)
- [TUN 模式与系统代理的区别](/posts/tun-vs-system-proxy/)

---

*TUN 实现的差异不应该成为你选择代理平台的决定性因素。客户端的易用性、规则生态和社区支持才是日常体验的关键。*
