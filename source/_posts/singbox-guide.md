---
title: Sing-box 使用指南
date: 2026-05-10
updated: 2026-05-10
categories:
  - 代理软件
tags:
  - Sing-box
  - 教程
  - 配置
  - JSON
index_img: /images/posts/singbox-guide.jpg
excerpt: Sing-box 是新一代代理平台，支持几乎所有协议。本文介绍其配置格式、使用方法和与 Clash 的主要区别。
---

> **摘要**：sing-box 是由 SagerNet 开发者从零构建的新一代代理平台，采用 JSON 配置格式，支持几乎所有主流代理协议。它既是一个内核，也在逐步发展自己的客户端生态。本文介绍 sing-box 的核心概念、配置结构、使用方法，以及它与 Clash 生态的对比。

---

## sing-box 是什么

[sing-box](https://github.com/SagerNet/sing-box) 是一个通用的代理平台。注意这个用词——它不叫"代理工具"或"代理内核"，而是**平台**。这反映了它的设计野心：做一个统一的、可以支撑各种使用场景的代理基础设施。

sing-box 的核心特点：

- **从零开发**：不是任何现有项目的分叉，完全从头用 Go 语言编写
- **协议全面**：支持 Shadowsocks、VMess、VLESS、Trojan、Hysteria、Hysteria 2、TUIC、WireGuard、Tor 等几乎所有主流协议
- **JSON 配置**：使用 JSON 格式编写配置文件（而非 Clash 生态的 YAML）
- **跨平台**：覆盖 Windows、macOS、Linux、iOS（SFI）、Android（SFA）
- **模块化架构**：入站（inbound）、出站（outbound）、路由（route）三层结构清晰分离

项目地址：[https://github.com/SagerNet/sing-box](https://github.com/SagerNet/sing-box)
官方文档：[https://sing-box.sagernet.org/](https://sing-box.sagernet.org/)

---

## 配置格式：JSON vs YAML

sing-box 和 Clash 生态最直观的区别就是配置格式。Clash 系使用 YAML，sing-box 使用 JSON。

### 格式差异示例

Clash（YAML）的写法：

```yaml
proxies:
  - name: "我的节点"
    type: vless
    server: example.com
    port: 443
    uuid: xxx-xxx
```

sing-box（JSON）的写法：

```json
{
  "outbounds": [
    {
      "tag": "我的节点",
      "type": "vless",
      "server": "example.com",
      "server_port": 443,
      "uuid": "xxx-xxx"
    }
  ]
}
```

JSON 格式的优势是结构严谨、解析无歧义，适合程序生成和处理。缺点是对人类来说可读性不如 YAML，而且不支持注释（虽然 sing-box 的解析器实际上允许注释，但这不是 JSON 标准的一部分）。

---

## 配置结构详解

一个完整的 sing-box 配置文件由几个核心模块组成。理解这个结构是使用 sing-box 的基础。

### Inbound（入站）

入站定义了 sing-box 如何接收需要代理的流量。常见的入站类型包括：

- **tun**：创建虚拟网卡，接管系统所有流量（等同于 Clash 的 TUN 模式）
- **mixed**：同时监听 HTTP 和 SOCKS5 代理（等同于 Clash 的混合端口）
- **http**：纯 HTTP 代理入站
- **socks**：纯 SOCKS5 代理入站

```json
{
  "inbounds": [
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 7890
    },
    {
      "type": "tun",
      "tag": "tun-in",
      "auto_route": true,
      "strict_route": true,
      "stack": "mixed"
    }
  ]
}
```

### Outbound（出站）

出站定义了流量要往哪里发。每个出站对应一个代理节点或特殊处理方式：

- **direct**：直连，不走代理
- **block**：丢弃流量
- **dns**：DNS 查询专用
- 各种代理协议（vless、vmess、trojan、shadowsocks、hysteria2 等）
- **selector**：手动选择组（类似 Clash 的 select 策略组）
- **urltest**：自动选择延迟最低的节点（类似 Clash 的 url-test）

```json
{
  "outbounds": [
    {
      "type": "selector",
      "tag": "proxy",
      "outbounds": ["auto", "node-hk", "node-jp"],
      "default": "auto"
    },
    {
      "type": "urltest",
      "tag": "auto",
      "outbounds": ["node-hk", "node-jp"],
      "interval": "5m"
    },
    {
      "type": "vless",
      "tag": "node-hk",
      "server": "hk.example.com",
      "server_port": 443,
      "uuid": "xxx"
    },
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    }
  ]
}
```

### Route（路由）

路由模块决定了哪些流量走哪个出站——这就是分流规则。sing-box 的路由规则采用"从上到下匹配，命中即停止"的逻辑：

```json
{
  "route": {
    "rules": [
      {
        "geosite": ["cn"],
        "outbound": "direct"
      },
      {
        "geoip": ["cn", "private"],
        "outbound": "direct"
      },
      {
        "geosite": ["category-ads-all"],
        "outbound": "block"
      }
    ],
    "final": "proxy"
  }
}
```

`final` 字段指定了没有匹配到任何规则时的默认出站——通常设为你的代理策略组。

### Rule Set（规则集）

sing-box 1.8 版本引入了 rule set 来替代传统的 GeoIP/GeoSite 数据库。rule set 可以从远程 URL 加载，支持更灵活的规则管理：

```json
{
  "route": {
    "rule_set": [
      {
        "type": "remote",
        "tag": "geosite-cn",
        "format": "binary",
        "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs"
      }
    ],
    "rules": [
      {
        "rule_set": ["geosite-cn"],
        "outbound": "direct"
      }
    ]
  }
}
```

---

## DNS 配置

sing-box 的 DNS 配置是一个独立的模块，功能很强大。它支持多种 DNS 协议和分流策略：

```json
{
  "dns": {
    "servers": [
      {
        "tag": "remote-dns",
        "address": "https://dns.google/dns-query",
        "detour": "proxy"
      },
      {
        "tag": "local-dns",
        "address": "https://dns.alidns.com/dns-query",
        "detour": "direct"
      }
    ],
    "rules": [
      {
        "geosite": ["cn"],
        "server": "local-dns"
      }
    ],
    "final": "remote-dns"
  }
}
```

这个配置实现了一个常见的 DNS 分流策略：国内域名用阿里 DNS 解析（走直连），其他域名用 Google DNS 解析（走代理）。这样既保证了国内网站的解析速度，又避免了海外域名被 DNS 污染。

---

## 如何配合订阅使用

sing-box 的配置是纯 JSON，不像 Clash 那样有统一的订阅格式标准。实际使用中有几种方式：

### 方式一：sing-box 格式订阅

部分机场已经开始提供 sing-box 原生格式的订阅链接。这种订阅下载下来就是一个完整的 sing-box JSON 配置文件，直接使用即可。这是最省事的方式。

### 方式二：通过订阅转换

如果你的机场只提供 Clash 格式订阅，可以使用订阅转换工具（如 subconverter）将 Clash 格式转换为 sing-box 格式。不过转换可能不够完美，复杂的规则可能需要手动调整。

### 方式三：手动编写配置

对于有技术能力的用户，可以手动编写 sing-box 配置文件。这种方式灵活性最高，但门槛也最高。适合自建节点的用户或需要高度自定义的场景。

---

## 使用 sing-box 的 GUI 客户端

对于普通用户，直接使用命令行版本的 sing-box 门槛较高。幸运的是，有多个图形化客户端基于 sing-box 内核开发，大幅降低了使用难度。

### 桌面端

- **sing-box 官方客户端**：sing-box 自身也在开发桌面版的图形界面，支持 macOS 和 Windows，可以直接从 [GitHub Releases](https://github.com/SagerNet/sing-box/releases) 下载
- **Clash Nyanpasu**：支持切换 mihomo 和 sing-box 内核，提供 Clash 风格的界面

### Android

- **SFA（sing-box for Android）**：sing-box 的官方 Android 客户端，可以从 [Google Play](https://play.google.com/store/apps/details?id=io.nekohasekai.sfa) 或 GitHub 下载
- **NekoBox for Android**：由 [MatsuriDayo](https://github.com/MatsuriDayo/NekoBoxForAndroid) 开发，支持 sing-box 内核，界面友好

### iOS

- **SFI（sing-box for iOS）**：sing-box 的官方 iOS 客户端，在 App Store 上架（需要非中国区 Apple ID）

---

## 命令行使用

对于服务器部署或高级用户，sing-box 的命令行使用很直接：

```bash
# 运行
sing-box run -c config.json

# 检查配置文件是否合法
sing-box check -c config.json

# 格式化配置文件
sing-box format -c config.json

# 查看版本
sing-box version
```

配置文件默认位置因平台而异：
- Linux：`/etc/sing-box/config.json`
- macOS：`~/Library/Application Support/sing-box/config.json`
- Windows：程序所在目录下的 `config.json`

---

## sing-box 与 mihomo 的比较

这是很多用户关心的问题。两者都是优秀的代理内核，但设计哲学不同。

| 对比维度 | sing-box | mihomo（Clash Meta） |
|---------|---------|---------------------|
| 配置格式 | JSON | YAML |
| 设计思路 | 从零开发，不依赖任何现有项目 | Clash 生态的延续和增强 |
| 协议支持 | 基本相同，都覆盖了主流协议 | 基本相同 |
| 规则系统 | 基于 rule set 的模块化设计 | 兼容 Clash 规则格式，支持 rule-provider |
| 客户端生态 | 自有客户端（SFA/SFI）+ 少量第三方 | 大量 Clash 生态客户端（Verge Rev、Nyanpasu 等） |
| 订阅兼容 | 自有格式，Clash 格式需要转换 | 完全兼容 Clash 订阅格式 |
| 社区规模 | 增长中，但相对较小 | 成熟且庞大的 Clash 社区 |
| 学习曲线 | 较陡——JSON 配置需要理解完整结构 | 较缓——大量教程和现成配置可参考 |

### 该选哪个？

- **如果你是新手**，先用 mihomo（通过 Clash Verge Rev 等客户端），因为生态成熟、教程多、机场支持好。
- **如果你是高级用户**，sing-box 的架构更现代，配置结构更清晰，适合需要深度自定义的场景。
- **如果你用 iOS**，sing-box 的官方客户端 SFI 是一个值得关注的选择。
- **如果你自建节点**，两者都可以作为服务端使用，sing-box 在这方面的文档更完善。

实际上，两个项目的开发者之间也有交流和相互借鉴。它们更像是同一领域的不同设计方案，而非对立的竞争关系。

---

## 从 Clash 迁移到 sing-box

如果你现在使用 Clash 生态并考虑尝试 sing-box，需要注意以下变化：

### 配置概念映射

| Clash 概念 | sing-box 对应 |
|-----------|-------------|
| proxies | outbounds |
| proxy-groups | outbounds（selector / urltest 类型） |
| rules | route.rules |
| rule-providers | route.rule_set |
| dns.nameserver | dns.servers |
| tun.enable | inbounds 中添加 tun 类型 |
| mixed-port | inbounds 中添加 mixed 类型 |

### 主要差异

1. **没有 proxy-providers 的概念**：sing-box 的订阅管理由客户端（如 SFA/SFI）处理，内核本身不负责订阅更新
2. **规则匹配逻辑略有不同**：sing-box 的路由规则在单条 rule 中支持多个条件，这些条件之间是 AND 关系（Clash 中每条规则只有一个条件）
3. **DNS 配置更灵活**：sing-box 的 DNS 分流可以基于更多维度，包括出站标签

---

## 常见问题

### Q: sing-box 适合新手吗？

取决于使用方式。如果通过 SFA / SFI 等图形化客户端配合机场提供的 sing-box 格式订阅使用，上手难度和 Clash 客户端差不多。但如果需要手动编写 JSON 配置，门槛会高不少。

### Q: 我的机场不提供 sing-box 格式订阅怎么办？

几个选择：（1）使用订阅转换服务将 Clash 格式转为 sing-box 格式；（2）使用同时支持 Clash 和 sing-box 的客户端（如 Clash Nyanpasu）；（3）继续使用 Clash 生态的客户端——没必要强行迁移。

### Q: sing-box 比 mihomo 快吗？

在绝大多数使用场景下，两者的性能差异可以忽略不计。代理速度的瓶颈几乎总是在节点本身（服务器带宽、线路质量、延迟），而不是在内核的处理速度上。不要因为"性能更好"这样的说法就盲目切换。

### Q: sing-box 是免费的吗？

sing-box 内核完全免费且开源。官方客户端 SFA 和 SFI 也是免费的（SFI 在 App Store 免费下载）。

### Q: 配置文件有语法错误怎么排查？

运行 `sing-box check -c config.json`，它会指出配置文件中的语法错误和位置。JSON 格式最常见的错误是多余的逗号（JSON 不允许末尾逗号）和引号遗漏。

---

## 相关资源

- [sing-box GitHub 仓库](https://github.com/SagerNet/sing-box) —— 项目源码和发布
- [sing-box 官方文档](https://sing-box.sagernet.org/) —— 完整的配置参考
- [NekoBox for Android](https://github.com/MatsuriDayo/NekoBoxForAndroid) —— 支持 sing-box 的 Android 客户端
- [sing-box 配置示例集合](https://sing-box.sagernet.org/configuration/) —— 官方配置示例
