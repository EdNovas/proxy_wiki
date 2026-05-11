---
title: Sing-box 的路由规则与 Clash 规则的区别
date: 2026-05-10
updated: 2026-05-10
categories:
  - 规则与分流
tags:
  - Sing-box
  - Clash
  - 规则
  - 路由
  - 对比
index_img: /images/posts/singbox-vs-clash-rules.jpg
excerpt: Sing-box 和 Clash 的规则系统设计理念不同。Clash 用 YAML 和 rule-provider，Sing-box 用 JSON 和 rule-set。
---

> **摘要**：Sing-box 和 Clash（mihomo）是当前最主流的两套代理内核，但它们的路由规则系统从设计理念到实现细节都有显著差异。Clash 使用 YAML 格式配置，通过 rule-provider 加载外部规则集；Sing-box 使用 JSON 格式，通过 rule_set 加载 SRS 二进制规则。本文从配置格式、匹配逻辑、规则文件格式到迁移方法，全面对比两者的区别。

---

## 为什么需要了解这个差异

如果你一直只用 Clash 系列客户端，可能从未关注过规则格式的问题——配置文件复制粘贴就能用。但随着 Sing-box 生态的快速发展（NekoBox、Hiddify 等客户端都基于 Sing-box 内核），越来越多的用户面临一个现实问题：**原来在 Clash 上运行良好的规则配置，换到 Sing-box 上完全不通用**。

这不是简单的"格式不同"，而是两个内核在路由规则的设计哲学上就有根本差异。理解这些差异，你才能在两个生态之间灵活切换，或者在选择客户端时做出更清晰的判断。关于 Clash 和 Sing-box 内核本身的差异，可以参考 [V2Ray vs Xray vs Sing-box：核心的区别与演进](/posts/core-comparison/)。

---

## Clash 的规则体系

### 配置格式：YAML

Clash 系列（包括 mihomo / Clash.Meta）使用 YAML 作为配置文件格式。YAML 以缩进表示层级关系，人类可读性很强，但对缩进和格式敏感。

一个典型的 Clash 规则配置片段：

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-SUFFIX,github.com,Proxy
  - DOMAIN-KEYWORD,facebook,Proxy
  - IP-CIDR,91.108.0.0/16,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

每条规则是一个字符串，格式为 `类型,值,策略`，用逗号分隔三个字段。规则从上到下逐条匹配，命中即停。

### 规则类型

Clash 支持的核心规则类型包括：

- `DOMAIN`：精确域名匹配
- `DOMAIN-SUFFIX`：域名后缀匹配
- `DOMAIN-KEYWORD`：域名关键词匹配
- `IP-CIDR` / `IP-CIDR6`：IPv4/IPv6 地址段匹配
- `GEOIP`：IP 地理位置匹配
- `GEOSITE`：域名分类匹配（mihomo 特有）
- `PROCESS-NAME`：进程名匹配
- `RULE-SET`：外部规则集
- `MATCH`：兜底匹配

### Rule Provider（外部规则集）

Clash 通过 `rule-providers` 机制加载外部规则文件。你在配置中定义一个 provider，指定 URL 和文件类型，客户端会自动下载并缓存规则文件：

```yaml
rule-providers:
  google:
    type: http
    behavior: domain
    url: "https://example.com/google-domains.yaml"
    path: ./ruleset/google.yaml
    interval: 86400

rules:
  - RULE-SET,google,Proxy
```

`behavior` 字段告诉客户端这个规则文件的内容类型：`domain`（纯域名列表）、`ipcidr`（IP 段列表）或 `classical`（混合类型）。

Rule Provider 文件本身是 YAML 格式的列表：

```yaml
payload:
  - DOMAIN-SUFFIX,google.com
  - DOMAIN-SUFFIX,googleapis.com
  - DOMAIN-SUFFIX,googleusercontent.com
  - DOMAIN,translate.google.com
```

mihomo 还支持 MRS 二进制格式，加载速度更快。更多关于 Rule Provider 的说明，参见 [Clash 的 Rule Provider 详解](/posts/clash-rule-providers/)。

### GeoIP / GeoSite

Clash 内置 `geoip.dat` 和 `geosite.dat` 数据库文件（或使用 MaxMind mmdb 格式的 GeoIP 数据库），通过 `GEOIP` 和 `GEOSITE` 规则类型直接调用。关于 GeoIP 和 GeoSite 的详细原理，参见 [GeoIP / GeoSite 数据库](/posts/geoip-geosite/)。

```yaml
rules:
  - GEOSITE,google,Proxy
  - GEOSITE,cn,DIRECT
  - GEOIP,CN,DIRECT
```

这种写法的好处是简洁——不需要单独定义 rule-providers，规则直接内嵌在配置文件中。

---

## Sing-box 的规则体系

### 配置格式：JSON

Sing-box 使用 JSON 作为配置文件格式。JSON 是一种严格的结构化数据格式，每个字段都有明确的类型定义，不存在 YAML 中容易出错的缩进问题，但可读性和编辑友好度不如 YAML。

一个典型的 Sing-box 路由配置片段：

```json
{
  "route": {
    "rules": [
      {
        "domain_suffix": [".google.com", ".googleapis.com"],
        "outbound": "proxy"
      },
      {
        "domain_keyword": ["facebook"],
        "outbound": "proxy"
      },
      {
        "ip_cidr": ["91.108.0.0/16"],
        "outbound": "proxy"
      },
      {
        "geoip": ["cn"],
        "outbound": "direct"
      }
    ],
    "final": "proxy"
  }
}
```

对比 Clash 的逐行字符串写法，Sing-box 的规则是**结构化的 JSON 对象**。每条规则是一个独立的对象，包含匹配条件和出站策略。这种结构的一个重要特点是：**一条规则内可以同时包含多个匹配条件**。

### 规则类型

Sing-box 支持的核心规则字段包括：

- `domain` / `domain_suffix` / `domain_keyword` / `domain_regex`：域名匹配
- `ip_cidr`：IP 段匹配
- `geoip`：IP 地理位置匹配
- `geosite`：域名分类匹配
- `process_name` / `process_path`：进程匹配
- `port` / `port_range`：端口匹配
- `protocol`：协议类型匹配（如 QUIC、STUN 等）
- `network`：网络类型匹配（TCP/UDP）
- `rule_set`：外部规则集

### 条件组合：AND 逻辑

Sing-box 规则的一个强大能力是**同一条规则内多个条件之间默认是 AND 关系**（都需要满足才匹配）。这意味着你可以写出这样的规则：

```json
{
  "domain_suffix": [".example.com"],
  "port": [443],
  "network": "tcp",
  "outbound": "proxy"
}
```

这条规则的含义是：只有当目标域名以 `.example.com` 结尾 **并且** 端口是 443 **并且** 是 TCP 连接时，才走代理。在 Clash 中实现同样的效果需要多条规则配合或使用 SUB-RULE 等高级功能。

如果你需要 OR 逻辑（满足任一条件即匹配），Sing-box 提供了 `logical` 规则类型：

```json
{
  "type": "logical",
  "mode": "or",
  "rules": [
    { "domain_suffix": [".google.com"] },
    { "domain_suffix": [".youtube.com"] }
  ],
  "outbound": "proxy"
}
```

### Rule Set（外部规则集）

Sing-box 通过 `rule_set` 机制加载外部规则。和 Clash 的 rule-providers 类似，你需要先在 `route.rule_set` 中定义来源，然后在规则中引用：

```json
{
  "route": {
    "rule_set": [
      {
        "tag": "geosite-google",
        "type": "remote",
        "format": "binary",
        "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-google.srs"
      }
    ],
    "rules": [
      {
        "rule_set": ["geosite-google"],
        "outbound": "proxy"
      }
    ]
  }
}
```

### SRS 格式

Sing-box 的二进制规则集格式叫 **SRS（Sing-box Rule Set）**。它和 mihomo 的 MRS 格式是完全不同的二进制编码，彼此不兼容。SRS 文件在构建时将规则编译为优化后的数据结构，加载速度快于纯文本。

Sing-box 也支持 JSON 格式的纯文本规则集（`"format": "source"`），但生产环境中推荐使用 SRS 格式以获得最佳性能。

---

## 关键差异对比

| 对比维度 | Clash (mihomo) | Sing-box |
|---------|---------------|----------|
| **配置格式** | YAML | JSON |
| **规则写法** | 逐行字符串 `TYPE,VALUE,POLICY` | 结构化 JSON 对象 |
| **条件组合** | 每条规则只有单一条件 | 单条规则支持多条件 AND/OR |
| **外部规则集** | rule-providers | route.rule_set |
| **规则集格式** | YAML 文本 / MRS 二进制 | JSON 文本 / SRS 二进制 |
| **GeoIP 格式** | mmdb / dat | mmdb / db（自有格式）|
| **GeoSite 格式** | dat（v2fly 格式） | db（自有格式） / SRS |
| **兜底规则** | `MATCH,策略` | `"final": "策略"` |
| **进程匹配** | `PROCESS-NAME` | `process_name` / `process_path` |
| **正则匹配** | `DOMAIN-REGEX`（mihomo） | `domain_regex` |
| **协议匹配** | 不支持 | 支持 `protocol` 字段 |
| **DNS 规则** | dns 部分独立配置 | dns.rules 结构与路由规则统一 |

### 匹配逻辑的差异

两者都是"从上到下逐条匹配，命中即停"，但 Sing-box 的"一条规则"可以包含更复杂的条件组合。

在 Clash 中，如果你想让 Google 和 YouTube 的流量走同一个策略组，通常需要两条规则或一个包含两者的 RULE-SET：

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-SUFFIX,youtube.com,Proxy
```

在 Sing-box 中，你可以在一条规则中列出多个域名后缀（数组内多个值之间是 OR 关系）：

```json
{
  "domain_suffix": [".google.com", ".youtube.com"],
  "outbound": "proxy"
}
```

但如果你在同一条规则中混合不同类型的条件（比如同时指定 `domain_suffix` 和 `port`），它们之间是 AND 关系。这个设计比 Clash 的逐条纯字符串规则更灵活，但也需要更仔细地理解逻辑关系。

### DNS 规则的差异

在 Clash 中，DNS 配置和路由规则是分开的两个部分。DNS 解析策略通过 `dns` 部分的 `nameserver-policy` 等字段配置，和 `rules` 部分是平行关系。

Sing-box 则将 DNS 规则和路由规则统一在了相似的结构下。`dns.rules` 的语法和 `route.rules` 基本一致，你可以用同样的条件字段（域名、IP、进程等）来决定 DNS 查询使用哪个 DNS 服务器：

```json
{
  "dns": {
    "rules": [
      {
        "domain_suffix": [".cn"],
        "server": "local-dns"
      },
      {
        "domain_suffix": [".google.com"],
        "server": "remote-dns"
      }
    ]
  }
}
```

这种统一设计让 DNS 策略和路由策略的配置体验更加一致。

---

## 从 Clash 迁移到 Sing-box

如果你打算从 Clash 迁移到 Sing-box，需要做以下几方面的转换。

### 配置文件格式转换

最基础的工作是把 YAML 改写为 JSON。这不只是格式上的转换（缩进变花括号），更重要的是适配 Sing-box 的配置字段名。两边的字段命名完全不同——Clash 的 `proxy-groups` 对应 Sing-box 的 `outbounds`，Clash 的 `rules` 对应 Sing-box 的 `route.rules`，等等。

目前有一些社区工具可以辅助转换，但由于两个内核的功能覆盖不完全对等，自动转换的结果通常需要手动调整。

### 规则集替换

Clash 的 Rule Provider 文件（YAML 或 MRS 格式）无法直接在 Sing-box 中使用。你需要找到对应的 Sing-box 格式规则集。

目前 Sing-box 生态中常用的规则集来源包括：

- **[SagerNet/sing-geosite](https://github.com/SagerNet/sing-geosite)**：从 v2fly/domain-list-community 转换而来的 SRS 格式规则集
- **[SagerNet/sing-geoip](https://github.com/SagerNet/sing-geoip)**：从 GeoLite2 转换而来的 SRS 格式 GeoIP 规则集
- **[MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)**：同时提供 Clash 和 Sing-box 格式的规则集

### GeoIP/GeoSite 数据库替换

Clash 使用 v2fly 格式的 `geoip.dat` 和 `geosite.dat`，Sing-box 使用自己的 `geoip.db` 和 `geosite.db` 格式。文件不通用，需要下载 Sing-box 专用版本。

### 逻辑适配

一些 Clash 的高级功能在 Sing-box 中有不同的实现方式或暂不支持。例如：

- Clash 的 `SUB-RULE` 在 Sing-box 中可以通过规则内的多条件组合部分实现
- Clash 的 `proxy-groups`（策略组）在 Sing-box 中通过 `outbounds` 的 `selector` / `urltest` 等类型实现
- Clash 的 `script` 规则类型在 Sing-box 中没有对应功能

---

## 从 Sing-box 迁移到 Clash

反向迁移同样需要格式和逻辑的转换。

Sing-box 中一条多条件 AND 规则在 Clash 中可能需要拆成多条规则或使用 `SUB-RULE`。Sing-box 的 `protocol` 匹配在 Clash 中不直接支持。SRS 格式文件需要替换为 YAML 或 MRS 格式的对应规则集。

总的来说，Sing-box → Clash 的迁移通常比 Clash → Sing-box 更容易，因为 Clash 的规则语法更简单直接，大部分 Sing-box 规则都能找到 Clash 的对应写法。

---

## 哪个更强大

这个问题没有绝对的答案，取决于你的衡量标准。

**从规则表达能力来看，Sing-box 更强。** 单条规则内的多条件组合（AND/OR）、正则域名匹配、协议类型匹配、DNS 规则的统一语法——这些能力让你可以用更少的规则实现更精确的控制。

**从易用性和生态来看，Clash 更成熟。** YAML 格式比 JSON 更易读写，rule-providers 的教程和现成规则集更丰富，社区积累了大量可直接复用的配置模板。

**从性能来看，两者各有优化。** mihomo 的 MRS 格式和 Sing-box 的 SRS 格式都是针对各自内核优化的二进制格式，在各自的内核上加载速度都很快。跨内核使用时没有性能优势。

对于大多数用户来说，规则系统的差异不应该成为选择内核的决定性因素。选择客户端时，更重要的考虑是协议支持、平台覆盖、GUI 体验等因素。规则系统只要能满足你的分流需求就足够了——而目前两个内核都能覆盖绝大多数使用场景。

---

## 常见问题

### Clash 的规则文件能直接在 Sing-box 中使用吗？

不能。两者的规则文件格式完全不同——Clash 用 YAML 文本或 MRS 二进制，Sing-box 用 JSON 文本或 SRS 二进制。你需要使用格式转换工具或找到对应的 Sing-box 版本规则集。MetaCubeX/meta-rules-dat 项目同时提供两种格式的文件，是跨内核使用的方便选择。

### Sing-box 的 JSON 配置写起来很麻烦，有没有更方便的方式？

有几个选择。第一，使用带模板功能的客户端（如 Hiddify），它会帮你生成基础配置。第二，使用订阅转换服务，输入机场订阅链接，选择 Sing-box 输出格式，自动生成完整配置。第三，使用社区分享的配置模板作为起点，在此基础上修改。

### 两个内核的规则匹配速度有差别吗？

在使用各自的二进制规则格式（MRS / SRS）时，匹配速度都很快，日常使用中感知不到差异。瓶颈通常在网络延迟而非规则匹配。如果你使用纯文本格式的超大规则集（数万条），初次加载时可能有几秒的延迟，但规则加载完成后匹配速度同样很快。

### 我的客户端同时支持 Clash 和 Sing-box 内核，规则需要分别配吗？

是的。切换内核时，配置文件需要一并切换。一些客户端（如 Clash Verge Rev）只支持 Clash/mihomo 配置格式；另一些（如 NekoBox）只支持 Sing-box 格式。少数客户端支持双内核切换，但配置文件仍然需要准备两套。

### GeoIP/GeoSite 数据在两个内核中通用吗？

不通用。Clash/mihomo 使用 v2fly 的 dat 格式或 MaxMind 的 mmdb 格式；Sing-box 使用自己定义的 db 格式。文件名可能看起来一样（都叫 `geoip.dat`），但内部编码不同，互相不能读取。下载时要注意选择对应内核的版本。

更多关于规则集项目的选择和对比，可以参考 [常用规则集推荐与对比](/posts/popular-rulesets/)。更多关于 Clash 和 Sing-box 内核本身的差异，参见 [Clash Wiki](https://wiki.metacubex.one/) 和 [sing-box 官方文档](https://sing-box.sagernet.org/)。
