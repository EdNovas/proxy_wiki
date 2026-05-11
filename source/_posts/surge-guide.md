---
title: Surge 使用指南（iOS/macOS）
date: 2026-05-10
updated: 2026-05-10
categories:
  - 代理软件
tags:
  - Surge
  - iOS
  - macOS
  - 教程
  - 高级
index_img: /images/posts/surge-guide.webp
excerpt: Surge 是 iOS/macOS 上功能最强大的网络工具，价格也最高（$49.99+）。本文介绍其核心功能和适用人群。
---

> **摘要**：Surge 并不只是一个代理工具——它是 iOS 和 macOS 平台上功能最全面的网络调试与代理平台。本文从定位、定价、核心功能到适用人群，全面介绍 Surge 的真实面貌，帮助你判断它是否值得购买。

## Surge 到底是什么

很多人第一次听说 Surge，是把它当作一个"翻墙工具"。这种理解并没有完全错，但远远不够准确。Surge 的开发者 Yachen Liu 从一开始就把它定位为一个**网络调试工具**（Network Debugging Tool），代理只是它众多功能中的一项。

更准确地说，Surge 是一个**可编程的网络中间件**。它位于设备的网络层和应用层之间，能够拦截、检查、修改和转发所有网络流量。你可以把它想象成一个运行在本地的迷你网关，所有网络请求都必须经过它的审查和处理。

这种设计赋予了 Surge 远超普通代理工具的能力：

- **代理与规则**：根据域名、IP、进程名等条件决定流量走直连还是代理
- **网络调试**：实时查看所有 HTTP/HTTPS 请求的详细信息
- **DNS 控制**：自定义 DNS 解析行为，支持 DoH/DoT
- **MitM 解密**：对 HTTPS 流量进行中间人解密，查看和修改加密内容
- **脚本引擎**：使用 JavaScript 脚本对请求和响应进行编程处理
- **模块系统**：通过模块（Module）扩展功能，社区有大量现成模块

在 Apple 生态中，没有任何其他工具能同时提供这些功能的组合。

## 定价与购买

Surge 的价格是所有主流代理工具中最高的，这也是最让人犹豫的一点：

| 平台 | 价格 | 说明 |
|------|------|------|
| iOS（Surge for iOS） | $49.99 | App Store 一次性购买，含所有功能 |
| macOS（Surge for Mac） | $49.99 起 | 官网购买授权，按设备数量定价 |
| 组合购买 | 各自独立 | iOS 和 macOS 版本需要分别购买 |

也就是说，如果你想在 iPhone 和 Mac 上同时使用 Surge，需要花费至少 **100 美元**。这个价格放在代理工具领域是相当昂贵的——对比来看，Clash Verge 完全免费，Quantumult X 也只要 $7.99。

### 为什么这么贵

Surge 的高价并非没有道理：

1. **开发成本**：Surge 是一个极其复杂的网络工程项目，由个人开发者维护，代码质量和更新频率都很高
2. **功能深度**：它提供的功能远超代理需求，网络调试、脚本引擎、MitM 等功能在其他工具中难以找到同等水平的实现
3. **定位差异**：Surge 的目标用户不是只需要代理的普通用户，而是对网络有深度需求的专业用户
4. **持续更新**：购买后可以持续获得功能更新，Surge 5 的更新频率保持在每月多次

简单说：如果你只需要代理功能，Surge 的价格确实不值；但如果你需要它提供的完整工具集，它的定价是合理的。

## 核心功能详解

### 代理与策略组

Surge 支持几乎所有主流代理协议：

- **Shadowsocks / ShadowsocksR**
- **VMess / VLESS**
- **Trojan**
- **HTTPS/SOCKS5 代理**
- **WireGuard**（内置支持）
- **Snell**（Surge 自研协议）

策略组（Policy Group）是 Surge 规则系统的核心概念。你可以创建多种类型的策略组：

```ini
[Proxy Group]
Auto = url-test, Server-A, Server-B, Server-C, url=http://www.gstatic.com/generate_204, interval=600
Streaming = select, HK-Server, JP-Server, US-Server
Fallback = fallback, Server-A, Server-B, Server-C
```

- **url-test**：自动测速，选择延迟最低的节点
- **select**：手动选择节点
- **fallback**：自动故障转移
- **load-balance**：负载均衡

### 规则系统

Surge 的规则系统是其最核心的能力之一。规则按照从上到下的顺序匹配，支持多种匹配条件：

```ini
[Rule]
DOMAIN-SUFFIX,google.com,Proxy
DOMAIN-KEYWORD,youtube,Proxy
IP-CIDR,91.108.0.0/16,Proxy
GEOIP,CN,DIRECT
PROCESS-NAME,Telegram,Proxy
URL-REGEX,^https?://api\.example\.com,REJECT
FINAL,Proxy
```

Surge 的规则类型包括但不限于：

| 规则类型 | 匹配对象 | 示例 |
|----------|----------|------|
| DOMAIN | 精确域名 | `DOMAIN,www.google.com,Proxy` |
| DOMAIN-SUFFIX | 域名后缀 | `DOMAIN-SUFFIX,google.com,Proxy` |
| DOMAIN-KEYWORD | 域名关键词 | `DOMAIN-KEYWORD,google,Proxy` |
| IP-CIDR | IP 地址段 | `IP-CIDR,10.0.0.0/8,DIRECT` |
| GEOIP | IP 归属国家 | `GEOIP,US,Proxy` |
| PROCESS-NAME | 进程名 | `PROCESS-NAME,Telegram,Proxy` |
| RULE-SET | 外部规则集 | `RULE-SET,https://example.com/rules,Proxy` |
| URL-REGEX | URL 正则 | 对 HTTP 请求的 URL 进行正则匹配 |

### DNS 控制

Surge 对 DNS 的控制能力非常细致：

```ini
[DNS]
dns-server = 119.29.29.29, 223.5.5.5
doh-server = https://dns.alidns.com/dns-query
encrypted-dns-follow-outbound-mode = true

[Host]
*.google.com = server:8.8.8.8
```

你可以为不同域名指定不同的 DNS 服务器，支持 DNS over HTTPS (DoH) 和 DNS over TLS (DoT)，甚至可以对 DNS 查询结果进行修改。

### MitM 中间人解密

这是 Surge 最强大也最"危险"的功能之一。启用 MitM 后，Surge 会生成一个自签名的根证书，安装到设备的信任存储中，然后对指定域名的 HTTPS 流量进行解密：

```ini
[MITM]
hostname = api.example.com, *.google.com
ca-passphrase = your-passphrase
```

启用后，你可以在 Surge 的 Dashboard 中看到这些 HTTPS 请求的完整内容——包括请求头、请求体和响应内容。这对于以下场景非常有用：

- **API 调试**：开发过程中检查 App 与后端的通信内容
- **广告屏蔽**：精确识别和拦截广告请求
- **脚本处理**：对特定 API 的响应进行修改（比如解锁某些功能）

需要注意的是，MitM 会对安全性产生影响。只应该对你信任的域名启用，且不应在不信任的网络环境中使用。

### JavaScript 脚本引擎

Surge 内置了一个 JavaScript 脚本引擎，可以在请求的不同阶段执行自定义脚本：

```ini
[Script]
cron-job = type=cron,cronexp=0 8 * * *,script-path=morning-check.js
http-response = type=http-response,pattern=^https://api\.example\.com/user,script-path=modify-response.js,requires-body=true
```

脚本可以实现的功能非常广泛：

- 修改 HTTP 请求和响应
- 定时执行任务（cron）
- 自动签到
- 解锁某些服务的会员功能
- 生成通知和报告

社区已经积累了大量现成的脚本，涵盖了从去广告到功能增强的各种场景。

### Dashboard 仪表盘

Surge 的 Dashboard 提供了一个直观的图形界面，用于实时监控和管理网络流量。macOS 版本的 Dashboard 功能尤其强大，可以显示：

- 实时连接列表和流量统计
- 请求详情（URL、状态码、响应时间、大小）
- DNS 查询记录
- 规则匹配日志
- 网络接口状态

对于开发者来说，Surge Dashboard 在某些场景下甚至可以替代 Charles 或 Proxyman 等专业抓包工具。

## 适用人群

Surge 并不适合所有人。以下是不同人群的建议：

### 推荐使用 Surge 的人群

- **iOS/macOS 开发者**：需要调试网络请求、分析 API 通信
- **网络工程师**：需要深度控制 DNS、路由和网络行为
- **高级代理用户**：需要复杂的规则系统、多策略组、脚本自动化
- **安全研究人员**：需要 MitM 功能分析加密通信

### 不推荐使用 Surge 的人群

- **只需要基本代理功能**：Clash Verge 免费且完全够用
- **预算有限**：100 美元的花费对于只用代理来说性价比极低
- **Android/Windows/Linux 用户**：Surge 只支持 Apple 平台
- **新手用户**：Surge 的学习曲线较陡，配置复杂度高于 Clash

## 基本配置流程

如果你决定使用 Surge，以下是最基本的配置步骤：

### 第一步：添加代理节点

在配置文件的 `[Proxy]` 段中添加节点信息：

```ini
[Proxy]
HK-Server = trojan, hk.example.com, 443, password=your-password
JP-Server = vmess, jp.example.com, 443, username=your-uuid, tls=true
US-Server = ss, us.example.com, 8388, encrypt-method=aes-256-gcm, password=your-password
```

大多数机场会提供订阅链接，你也可以通过订阅方式导入节点。

### 第二步：配置策略组

```ini
[Proxy Group]
Auto = url-test, HK-Server, JP-Server, US-Server, url=http://www.gstatic.com/generate_204
Streaming = select, HK-Server, JP-Server, US-Server
```

### 第三步：编写规则

```ini
[Rule]
DOMAIN-SUFFIX,google.com,Auto
DOMAIN-SUFFIX,youtube.com,Streaming
DOMAIN-SUFFIX,netflix.com,Streaming
GEOIP,CN,DIRECT
FINAL,Auto
```

### 第四步：启用增强模式（可选）

在 Surge 的设置中启用增强模式（Enhanced Mode），它会接管系统的 DNS 解析，提供更完整的流量控制。

## Surge vs Clash Verge

这是最常见的对比问题。两者的定位有本质差异：

| 维度 | Surge | Clash Verge（mihomo） |
|------|-------|----------------------|
| 定价 | iOS $49.99 + macOS $49.99 | 完全免费 |
| 平台 | iOS / macOS | Windows / macOS / Linux |
| 规则格式 | INI 风格 | YAML |
| 网络调试 | 内置 Dashboard，功能强大 | 基础连接查看 |
| MitM | 支持 | 不支持 |
| 脚本引擎 | JavaScript | 不支持（mihomo 有有限的脚本能力） |
| TUN 模式 | 支持 | 支持 |
| WireGuard | 内置支持 | 通过 mihomo 支持 |
| 上手难度 | 较高 | 中等 |
| 社区规则 | 丰富 | 极其丰富 |

**结论**：对于 90% 以上的用户，Clash Verge 完全够用。Surge 的优势主要体现在 iOS 平台的深度集成、MitM、脚本引擎和网络调试方面。如果你不需要这些功能，没有必要花钱购买 Surge。

## Surge 的规则格式 vs Clash YAML

两者的规则格式差异较大。Surge 使用 INI 风格的配置文件，Clash 使用 YAML。以同一条规则为例：

**Surge 格式**：
```ini
DOMAIN-SUFFIX,google.com,Proxy
```

**Clash 格式**：
```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
```

虽然单条规则的语法相似，但整体配置文件的结构差异很大。Surge 的配置以 Section（段落）划分，Clash 的配置是一个完整的 YAML 文档。规则本身大部分可以互相转换，社区也有不少转换工具。

需要注意的是，Surge 支持的一些高级规则类型（如 URL-REGEX、USER-AGENT）在 Clash 中可能没有直接对应。

## 常见问题（FAQ）

### Q1：Surge 支持订阅链接吗？

支持。Surge 可以通过托管配置（Managed Configuration）或订阅模块来导入节点。大部分主流机场都提供 Surge 格式的订阅链接。如果没有，你也可以使用 [Sub-Store](https://github.com/sub-store-org/Sub-Store) 等工具进行格式转换。

### Q2：Surge 能在 Apple TV 上使用吗？

Surge 5 开始支持 tvOS，可以在 Apple TV 上使用。但需要 iOS 版本的授权。

### Q3：购买后可以多设备使用吗？

iOS 版跟随 Apple ID，同一个 Apple ID 下的所有设备都可以使用。macOS 版的授权按设备数量计费。

### Q4：Surge 和 Quantumult X、Loon 怎么选？

这三者都是 iOS 平台的高级代理工具。Quantumult X（$7.99）和 Loon（$5.99）价格更低，功能也不弱。对于大多数 iOS 用户来说，Quantumult X 的性价比最高。Surge 适合对网络调试和脚本有深度需求的用户。

### Q5：Surge 的安全性如何？

Surge 本身是一个商业软件，代码不开源。但它在 Apple 生态中已经运营多年，拥有良好的口碑。MitM 功能确实存在安全风险，但这是你主动启用的功能，且只对你指定的域名生效。

### Q6：Surge 适合新手吗？

不太适合。Surge 的配置较为复杂，且价格高昂。新手建议先从免费的 Clash Verge 开始，等熟悉了代理的基本概念后，再根据需求决定是否升级到 Surge。

## 外部链接

- [Surge 官方网站](https://nssurge.com/)
- [Surge 官方文档](https://manual.nssurge.com/)
- [Surge 社区模块仓库](https://github.com/Surge-Modules)
- [Sub-Store 订阅转换](https://github.com/sub-store-org/Sub-Store)

---

*Surge 是一款优秀的网络工具，但不是每个人都需要它。在购买之前，先明确你的实际需求。如果你只需要代理，免费的开源方案完全够用。*
