---
title: 常用规则集推荐与对比（Loyalsoldier / MetaCubeX / ACL4SSR）
date: 2026-05-10
updated: 2026-05-10
categories:
  - 规则与分流
tags:
  - 规则集
  - Loyalsoldier
  - ACL4SSR
  - MetaCubeX
  - Clash
index_img: /images/posts/popular-rulesets.png
excerpt: 三大主流规则集各有特点。Loyalsoldier 最流行，MetaCubeX 官方配套，ACL4SSR 分类最细。本文对比它们的差异和选择建议。
---

> **摘要**：规则集是代理分流的核心资源，决定了哪些流量走代理、哪些直连、哪些被拦截。当前社区中最主流的三套规则集分别是 Loyalsoldier/clash-rules、MetaCubeX/meta-rules-dat 和 ACL4SSR。它们各有侧重——Loyalsoldier 最流行且兼容性好，MetaCubeX 是 mihomo 官方配套且加载速度最快，ACL4SSR 分类最细粒度且提供完整的预制配置。本文逐一介绍它们的特点并给出选择建议。

---

## 什么是规则集（快速回顾）

如果你已经读过 [什么是分流规则](/posts/what-are-rules/) 和 [Clash 的 Rule Provider 详解](/posts/clash-rule-providers/)，可以跳过这一节。

代理客户端的分流逻辑很简单：每一个网络请求进来后，客户端拿着请求的目标信息（域名或 IP）从第一条规则开始逐条匹配，命中哪条就按那条规则指定的策略处理。但实际使用中，你不可能自己手写几千条规则来覆盖所有常见网站。

**规则集（Rule Set / Rule Provider）** 就是社区维护的、预先整理好的大量规则的集合。你只需要在配置文件中引用规则集的 URL，客户端会自动下载并定期更新这些规则。社区开发者帮你做了"哪些域名该直连、哪些该代理、哪些该拦截"这件繁琐的事情。

目前最主流的三套规则集分别来自三个项目。它们的定位、格式和覆盖范围各不相同，下面逐一展开。

---

## Loyalsoldier/clash-rules

**项目地址**：[https://github.com/Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)

### 项目概况

Loyalsoldier/clash-rules 是目前中文社区中使用最广泛的 Clash 规则集项目。它从 v2ray-rules-dat（同一作者维护的 V2Ray 规则数据）衍生而来，专门为 Clash 系列客户端（包括 mihomo）打包成 YAML 格式的 Rule Provider 文件。

这个项目的数据源经过多层整合：域名列表来自 v2fly/domain-list-community（V2Fly 社区维护的域名分类数据库），IP 数据则综合了 GeoLite2、APNIC 统计数据等多个来源。最终产出的规则文件按功能分为多个类别，每天自动更新。

### 分类与文件

Loyalsoldier 提供的主要规则文件包括：

| 文件名 | 用途 | 典型策略 |
|--------|------|---------|
| `reject` | 广告域名、追踪器、恶意网站 | REJECT |
| `proxy` | 需要代理的域名（被墙或国外常用服务） | Proxy |
| `direct` | 国内域名，应该直连 | DIRECT |
| `gfw` | GFW 封锁的域名列表 | Proxy |
| `google` | Google 全系列服务的域名 | Proxy |
| `apple` | Apple 服务域名 | DIRECT 或 Proxy |
| `icloud` | iCloud 相关域名 | DIRECT 或 Proxy |
| `private` | 局域网、保留地址等私有域名 | DIRECT |
| `cncidr` | 中国大陆的 IP 段 | DIRECT |
| `telegramcidr` | Telegram 使用的 IP 段 | Proxy |
| `lancidr` | 局域网 IP 段 | DIRECT |

### 使用方式

在 Clash / mihomo 配置文件中，通过 `rule-providers` 引用这些文件：

```yaml
rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400

  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400

  direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.yaml
    interval: 86400
```

然后在 `rules` 中引用：

```yaml
rules:
  - RULE-SET,reject,REJECT
  - RULE-SET,proxy,Proxy
  - RULE-SET,direct,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

### 优势与不足

**优势：**
- 社区认知度最高，中文教程和讨论最多，新手遇到问题容易找到解答
- 分类清晰直观，按用途划分易于理解
- 文本格式（YAML），人类可读可编辑，方便排查问题
- 数据源质量稳定，每日自动更新

**不足：**
- 文本格式加载速度不如二进制格式，规则数量多时初次加载稍慢
- 分类粒度相对较粗，Netflix、Disney+、Steam 等服务没有单独拆分
- 主要面向 Clash 系列，Sing-box 等其他内核需要转换

---

## MetaCubeX/meta-rules-dat

**项目地址**：[https://github.com/MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)

### 项目概况

MetaCubeX/meta-rules-dat 是 mihomo（原 Clash.Meta）团队的官方规则数据项目。作为 mihomo 的"亲儿子"，它和 mihomo 内核的兼容性是最好的，同时也是目前唯一提供 MRS（Meta Rule Set）二进制格式的规则集项目。

这个项目的数据同样来自 v2fly/domain-list-community 和 GeoLite2 等上游源，但在打包格式上做了很多 mihomo 特有的优化。

### MRS 格式：二进制的速度优势

meta-rules-dat 项目最大的技术亮点是 **MRS（Meta Rule Set）格式**。传统的规则集文件是纯文本（YAML 或文本列表），客户端每次启动都需要逐行解析这些文本并构建内部数据结构。当规则数量达到数万条时，解析开销不可忽视。

MRS 是 mihomo 定义的二进制格式，规则在生成阶段就已经被编译为优化过的数据结构。客户端加载 MRS 文件时只需要直接读入内存，跳过了文本解析这一步。根据社区测试，MRS 格式的加载速度比纯文本快数倍，在低性能设备（如路由器、旧手机）上差异更加明显。

### GeoSite / GeoIP 集成

除了 Rule Provider 格式的文件外，meta-rules-dat 还提供完整的 `geosite.dat` 和 `geoip.dat` 数据库文件。这些文件被 mihomo 内置的 `GEOSITE` 和 `GEOIP` 规则类型直接使用。关于 GeoIP 和 GeoSite 的详细说明，可以参考 [GeoIP / GeoSite 数据库：原理与更新](/posts/geoip-geosite/)。

使用 GeoSite 规则的配置示例：

```yaml
rules:
  - GEOSITE,category-ads-all,REJECT
  - GEOSITE,cn,DIRECT
  - GEOSITE,google,Proxy
  - GEOSITE,netflix,Streaming
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

这种方式不需要单独配置 rule-providers，规则直接内嵌在配置文件中，写法更简洁。

### 使用方式（Rule Provider 格式）

如果你更习惯 Rule Provider 的写法，meta-rules-dat 也提供了对应的文件：

```yaml
rule-providers:
  google:
    type: http
    behavior: domain
    format: mrs
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs"
    path: ./ruleset/google.mrs
    interval: 86400
```

注意 `format: mrs` 这一行——这告诉 mihomo 按 MRS 二进制格式解析这个文件。

### 优势与不足

**优势：**
- mihomo 官方出品，兼容性最佳，新功能第一时间支持
- MRS 二进制格式加载速度最快，对低性能设备友好
- 同时提供 GeoSite/GeoIP 数据库和 Rule Provider 文件，两种用法都支持
- 分类覆盖全面，包含上百个服务类别

**不足：**
- MRS 格式是 mihomo 专用，其他 Clash 内核（如原版 Clash Premium）不支持
- 二进制文件无法直接查看和编辑，排查规则问题时不如文本格式方便
- 文档和使用教程相对较少，主要依赖 mihomo Wiki

---

## ACL4SSR

**项目地址**：[https://github.com/ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)

### 项目概况

ACL4SSR（Access Control List for SSR/SS/Clash）是老牌规则集项目，历史比前面两个项目都要悠久。它最初为 ShadowsocksR 设计，后来扩展支持了 Clash。ACL4SSR 的最大特点是**分类极其细致**，以及**提供完整的预制配置文件**。

### 极细粒度的分类

ACL4SSR 对流媒体和常用服务做了非常细的拆分，几乎每个主流服务都有独立的规则文件。例如：

| 服务 | 规则文件 |
|------|---------|
| Netflix | `Ruleset/Netflix.list` |
| Disney+ | `Ruleset/DisneyPlus.list` |
| YouTube | `Ruleset/YouTube.list` |
| Spotify | `Ruleset/Spotify.list` |
| Telegram | `Ruleset/Telegram.list` |
| Steam | `Ruleset/Steam.list` |
| Epic Games | `Ruleset/Epic.list` |
| PayPal | `Ruleset/PayPal.list` |
| Microsoft | `Ruleset/Microsoft.list` |
| Apple | `Ruleset/Apple.list` |
| Bahamut (巴哈姆特) | `Ruleset/Bahamut.list` |

这种细粒度分类的好处很明显：你可以为每个服务指定不同的策略组。比如 Netflix 走美国节点，Spotify 走日本节点，Telegram 走新加坡节点，Steam 走香港节点——每个服务都有最优的路由路径。

### 预制配置

ACL4SSR 不仅提供规则文件，还提供了多套**即用型的完整 Clash 配置文件**。这对新手来说非常友好——你不需要自己从零组装配置，直接选一套预制方案就能用。

主要的预制方案包括：

- **ACL4SSR_Online.ini**：默认方案，国内直连 + 国外代理，适合大多数用户
- **ACL4SSR_Online_Full.ini**：完整方案，包含所有细分规则（Netflix/Disney+/Telegram 等单独分组）
- **ACL4SSR_Online_Mini.ini**：精简方案，只保留最基本的直连和代理分流
- **ACL4SSR_Online_NoAuto.ini**：无自动测速方案，所有策略组均为手动选择

这些预制配置通常配合**订阅转换服务**使用。你把机场的订阅链接通过转换工具（如 subconverter）转换时，可以选择 ACL4SSR 的模板作为规则方案，输出的就是一份包含完整规则分组的 Clash 配置文件。

### 优势与不足

**优势：**
- 服务分类最细，支持逐服务精细路由
- 提供开箱即用的预制配置，新手友好
- 与订阅转换工具深度集成，使用流程简单
- 历史悠久，社区基础扎实

**不足：**
- 项目更新频率不如 Loyalsoldier 和 MetaCubeX 活跃
- 规则文件格式较老，不支持 MRS 等新格式
- 分类太细可能导致配置文件复杂，策略组数量多时管理成本上升
- 部分规则覆盖可能存在滞后

---

## 三大规则集对比

| 对比维度 | Loyalsoldier/clash-rules | MetaCubeX/meta-rules-dat | ACL4SSR |
|---------|------------------------|------------------------|---------|
| **定位** | 通用 Clash 规则集 | mihomo 官方规则集 | 老牌全功能规则集 |
| **文件格式** | YAML 文本 | MRS 二进制 / YAML / dat | 文本列表 |
| **加载速度** | 中等 | 最快（MRS 格式） | 中等 |
| **分类粒度** | 中等（按大类） | 全面（上百类别） | 最细（逐服务） |
| **预制配置** | 无 | 无 | 有多套方案 |
| **更新频率** | 每日 | 每日 | 不定期 |
| **mihomo 兼容性** | 好 | 最佳 | 好 |
| **Sing-box 支持** | 需转换 | 部分支持 | 需转换 |
| **社区教程** | 最多 | 较少 | 较多 |
| **适合谁** | 大多数用户 | mihomo 用户 / 路由器用户 | 需要精细分流的用户 |

---

## 如何在它们之间切换

如果你当前使用某一套规则集，想切换到另一套，操作并不复杂。核心步骤是：

**第一步：替换 rule-providers 的 URL。** 把配置文件中 `rule-providers` 下的 URL 从旧项目的地址换成新项目的地址。注意不同项目的文件命名和路径格式不同，需要对照新项目的文档查找对应的文件地址。

**第二步：调整 behavior 和 format。** 不同规则集的文件行为类型可能不同。比如 Loyalsoldier 的域名规则用 `behavior: domain`，而切换到 meta-rules-dat 的 MRS 格式时需要加上 `format: mrs`。

**第三步：检查分类映射。** 不同规则集的分类名称不完全一致。Loyalsoldier 的 `proxy` 在 ACL4SSR 中可能对应多个细分文件。你需要确保 `rules` 中引用的规则集名称和 `rule-providers` 中定义的名称一一对应。

**第四步：清理缓存。** 切换后建议删除客户端缓存的旧规则文件（通常在配置目录的 `ruleset` 子目录下），让客户端重新下载新规则。

一个从 Loyalsoldier 切换到 MetaCubeX MRS 格式的示例对比：

```yaml
# 切换前（Loyalsoldier，YAML 文本格式）
rule-providers:
  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400

# 切换后（MetaCubeX，MRS 二进制格式）
rule-providers:
  proxy:
    type: http
    behavior: domain
    format: mrs
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs"
    path: ./ruleset/proxy.mrs
    interval: 86400
```

---

## 实际选择建议

**如果你是新手**，选 Loyalsoldier。它的文档最全，社区教程最多，出了问题容易搜到解决方案。分类按大类划分，不会让你面对几十个策略组手足无措。

**如果你使用 mihomo 内核，且追求性能**，选 MetaCubeX/meta-rules-dat。MRS 格式在路由器等低性能设备上优势明显，而且作为官方项目与 mihomo 的兼容性永远是最好的。

**如果你需要对每个流媒体/服务做独立路由**，选 ACL4SSR。Netflix 走美国、Disney+ 走新加坡、Spotify 走日本——这种逐服务精细控制的需求，ACL4SSR 的细分类别最为匹配。

**如果你在多个内核间切换**，优先考虑 Loyalsoldier 的文本格式，因为它的兼容性最广。MRS 是 mihomo 专用格式，切换到其他内核时无法直接使用。

当然，这三个项目并不互斥。你完全可以混合使用——大部分规则用 Loyalsoldier，流媒体细分部分用 ACL4SSR 的文件。只要在 `rule-providers` 中正确配置每个文件的来源，客户端不在乎它们来自不同的项目。

---

## 常见问题

### 规则集需要手动更新吗？

不需要。配置中的 `interval` 参数指定了自动更新间隔（单位为秒）。设为 `86400` 表示每天更新一次。客户端会在后台自动下载最新版本的规则文件。你也可以在客户端界面中手动触发更新。

### 规则集文件下载失败怎么办？

最常见的原因是网络问题——规则文件通常托管在 GitHub 上，而 GitHub 在国内可能访问不畅。解决方案有两个：一是使用 CDN 加速地址（如 `cdn.jsdelivr.net`），二是确保代理已经启动后再更新规则（先手动连一个节点，再触发规则更新）。

### 三个项目会互相冲突吗？

不会。它们只是规则的来源不同，最终在客户端中都是作为 Rule Provider 加载的。只要你在配置文件中给它们取不同的名字，客户端会分别下载和管理。但要注意避免同一个域名在不同规则集中被指向不同策略——先匹配到的规则会生效。

### 用了规则集还需要 GeoIP/GeoSite 吗？

规则集和 GeoIP/GeoSite 可以互补使用。典型做法是规则集处理已知的域名，`GEOIP,CN,DIRECT` 作为兜底规则处理剩余的中国 IP 流量。如果你使用 MetaCubeX 的 GeoSite 规则，那它本身就替代了域名规则集的角色——两者选其一即可，不需要重复配置。

### Sing-box 能用这些规则集吗？

不能直接使用。Clash 的规则集格式（YAML 文本或 MRS 二进制）和 Sing-box 的规则集格式（JSON / SRS 二进制）是不同的。如果你使用 Sing-box，需要使用专门为 Sing-box 准备的规则集，或通过转换工具转换。关于两者的规则差异，可以参考 [Sing-box 的路由规则与 Clash 规则的区别](/posts/singbox-vs-clash-rules/)。
