---
title: GeoIP / GeoSite 数据库：原理与更新
date: 2026-05-10
updated: 2026-05-10
categories:
  - 规则与分流
tags:
  - GeoIP
  - GeoSite
  - 规则
  - 数据库
  - Clash
index_img: /images/posts/geoip-geosite.jpg
excerpt: GeoIP 将 IP 映射到国家，GeoSite 将域名分类到类别。理解它们的原理和更新方式。
---

> **摘要**：GeoIP 和 GeoSite 是代理客户端用于分流判断的核心数据库。GeoIP 将 IP 地址映射到国家/地区，GeoSite 将域名分类到不同类别（如 cn、google、netflix）。理解它们的原理和更新方式，有助于你解决分流不准确的问题。

## GeoIP 是什么

### 定义

GeoIP 数据库的作用很直观：给定一个 IP 地址，告诉你这个 IP 属于哪个国家或地区。

代理客户端利用这个能力来做分流。最典型的规则就是：

```
GEOIP,CN,DIRECT
```

含义是：当客户端拦截到一个网络请求，解析出目标 IP 地址后，在 GeoIP 数据库中查询这个 IP 的归属地。如果结果是 CN（中国），则走直连；否则继续匹配后续规则。

举个例子：你访问百度，客户端拿到目标 IP `39.156.66.10`，查 GeoIP 数据库，结果是 CN。命中 `GEOIP,CN,DIRECT`，走直连。你访问 Google，目标 IP `142.250.80.46`，查 GeoIP，结果是 US。不命中 CN 规则，继续匹配后面的规则，最终走代理。

在整套分流逻辑中，`GEOIP,CN,DIRECT` 通常放在规则列表的倒数第二条（最后一条是 `MATCH` 兜底），充当"所有中国 IP 一律直连"的安全网。即使某个国内网站没有被任何域名规则命中，只要它的服务器 IP 在 GeoIP 数据库中标记为中国，就会被这条规则拦下来走直连。

### 数据来源

GeoIP 数据库不是凭空造的，它的数据来源有几个层面。

**MaxMind GeoLite2** 是最知名的 GeoIP 数据提供商。MaxMind 的商业版 GeoIP2 数据库被大量企业和安全服务使用，GeoLite2 是其免费版本，精度略低但对代理分流来说完全够用。MaxMind 通过收集各级互联网注册机构（RIR）公开的 IP 分配数据，结合自身的网络探测和用户反馈，构建出全球 IP 地理位置数据库。注册后即可免费下载，每周更新一次。

**DB-IP** 是另一家 IP 地理位置数据提供商，同样提供免费版本。覆盖范围和 MaxMind 类似，两者数据互为补充。

但对于科学上网用户来说，更重要的是**社区维护的专用版本**。原版 MaxMind 数据虽然通用，但并非针对代理场景优化。社区项目对数据做了以下改进：

- **Loyalsoldier/geoip**：最流行的社区 GeoIP 项目。它在 MaxMind 和 DB-IP 数据的基础上，合并了中国大陆的 CIDR 数据（来自 IPIP.net 等更精准的国内 IP 数据源），移除了不可达的 IP 段，增强了 CN 数据的准确性。对于代理使用场景，这个项目的数据比原版 MaxMind 更可靠。
- **MetaCubeX/meta-rules-dat**：mihomo（原 Clash Meta）官方维护的规则数据项目。它打包了适用于 mihomo 内核的 GeoIP 数据，和 mihomo 的兼容性最好。如果你使用 Clash Verge Rev 等基于 mihomo 的客户端，优先使用这个项目的数据。

### 数据格式

不同的代理内核使用不同的 GeoIP 数据格式，这是很多人踩坑的地方——下载了错误格式的文件，客户端根本无法读取。

**`.mmdb`（MaxMind Database）**：最通用的格式。MaxMind 设计的二进制数据库格式，查询速度快，文件体积适中。Clash、mihomo、Surge、Shadowrocket 等主流客户端都支持这个格式。文件名通常是 `Country.mmdb`。mihomo 还支持一种优化的变体 `geoip.metadb`，加载速度更快。

**`.dat`**：V2Ray 和 Xray 使用的 Protobuf 格式。文件名为 `geoip.dat`。只有 V2Ray 系客户端（v2rayN、Xray 等）使用这个格式。

**`.db`**：sing-box 使用的专有格式。如果你使用 sing-box 内核的客户端，需要这个格式的文件。

选择格式的原则很简单：**你用什么客户端，就下载对应格式的文件。** 如果搞不清，去客户端的文档或 GitHub 仓库看一下它需要什么文件名和格式。

### 准确性

GeoIP 数据库不是百分之百准确的，这是由 IP 地址分配的性质决定的。

**IP 段会被重新分配。** 一个 IP 段今天属于中国的运营商，过几个月可能被交易到了其他国家的运营商手中。数据库需要追踪这些变化，但总有一定的延迟。

**新分配的 IP 段可能没有及时收录。** 当一个新的 IP 段被分配给某个国家的运营商时，GeoIP 数据库可能还没有来得及更新。在这段空窗期，这些 IP 可能被标记为"未知"或被归到错误的国家。

**Anycast 和 CDN 地址比较特殊。** Anycast IP（如 Cloudflare 的 `1.1.1.1`）在全球多个数据中心同时使用同一个 IP，严格来说它不属于任何单一国家。CDN 的边缘节点也类似——同一个域名在不同地区解析到不同的 IP，这些 IP 分布在全球各地。GeoIP 数据库对这类 IP 的归属判断可能不稳定。

不过，对于代理分流来说，这些不准确的情况影响很小。绝大多数国内网站的服务器 IP 都能被正确识别为 CN，绝大多数境外网站的 IP 也能被正确识别为非 CN。偶尔有一两个 IP 判断失误，不会影响整体体验。如果你发现某个特定网站的路由不正确，可以用域名规则（`DOMAIN-SUFFIX`）单独处理它，不需要依赖 GeoIP。

## GeoSite 是什么

### 定义

GeoSite 数据库做的事情和 GeoIP 互补：GeoIP 按 IP 地址分类，GeoSite 按域名分类。

GeoSite 将互联网上的域名按照用途和属性分组，每个组有一个标签名称。代理客户端通过查询 GeoSite 数据库，判断某个域名属于哪个类别，从而决定路由策略。

常见的类别包括：

- **`cn`**：中国网站的域名。baidu.com、taobao.com、bilibili.com 等。
- **`google`**：所有 Google 相关的域名。google.com、googleapis.com、youtube.com 等。
- **`netflix`**：Netflix 相关域名。
- **`category-ads-all`**：广告和追踪器域名的汇总。
- **`geolocation-cn`**：需要使用中国 DNS 解析的域名集合。
- **`geolocation-!cn`**：不应该使用中国 DNS 解析的域名集合。
- **`tld-cn`**：使用 `.cn` 顶级域名的所有域名。

这些类别不是随意命名的。它们来自社区维护的域名列表项目，经过大量贡献者的持续更新和审核。

### 用法示例

在 Clash（mihomo）的配置中，GeoSite 通过 `GEOSITE` 规则类型使用：

```yaml
rules:
  - GEOSITE,category-ads-all,REJECT        # 屏蔽广告域名
  - GEOSITE,cn,DIRECT                       # 中国网站直连
  - GEOSITE,google,Proxy                    # Google 走代理
  - GEOSITE,netflix,Streaming               # Netflix 走流媒体节点组
  - GEOSITE,telegram,Proxy                  # Telegram 走代理
  - GEOIP,CN,DIRECT                         # 中国 IP 直连（兜底）
  - MATCH,Proxy                             # 其余走代理（最终兜底）
```

这套规则的工作流程是：客户端拦截到一个网络请求后，提取目标域名，先在 GeoSite 数据库中查找这个域名属于哪个类别。从上到下逐条匹配——如果域名在 `category-ads-all` 里，REJECT；如果在 `cn` 里，DIRECT；如果在 `google` 里，走 Proxy。如果所有 GeoSite 规则都没命中，继续检查 GeoIP（基于 IP 地址），最后由 MATCH 兜底。

在 V2Ray/Xray 的配置中，用法类似但语法不同：

```json
{
  "routing": {
    "rules": [
      {
        "type": "field",
        "domain": ["geosite:category-ads-all"],
        "outboundTag": "block"
      },
      {
        "type": "field",
        "domain": ["geosite:cn"],
        "outboundTag": "direct"
      }
    ]
  }
}
```

### 数据来源

GeoSite 数据的上游主要来自以下项目：

**v2fly/domain-list-community**：这是 GeoSite 数据的"源头"项目。V2Ray 社区维护，任何人都可以通过 Pull Request 添加新域名或新类别。项目的数据以纯文本格式存储，每个类别一个文件，内容就是属于这个类别的域名列表。编译工具将这些文本文件打包成二进制的 `geosite.dat` 文件。

**Loyalsoldier 的增强版本**：在 v2fly/domain-list-community 的基础上，Loyalsoldier 合并了额外的数据源，增加了更多域名覆盖，改善了分类的准确性。很多社区用户使用的实际上是这个增强版。

**MetaCubeX/meta-rules-dat**：mihomo 官方的数据项目，将上游数据编译为 mihomo 内核可用的格式。如果你用的是 Clash Verge Rev 等基于 mihomo 的客户端，GeoSite 数据通常来自这个项目。

## GeoIP vs GeoSite vs Rule-Provider

这三种机制都用于分流，但工作方式和适用场景不同。

| 特性 | GeoIP | GeoSite | Rule-Provider |
|------|-------|---------|---------------|
| 匹配对象 | IP 地址 | 域名 | IP 或域名（取决于 behavior） |
| 数据格式 | 二进制数据库（.mmdb/.dat/.db） | 二进制数据库（.dat/.db） | 文本/YAML/MRS 文件 |
| 更新方式 | 需替换整个文件 | 需替换整个文件 | 客户端自动通过 URL 定期更新 |
| 粒度 | 按国家/地区（CN、US、JP 等） | 按类别（cn、google、netflix 等） | 完全自定义，可以是任意域名/IP 组合 |
| 加载速度 | 快（预编译的二进制数据结构） | 快（预编译的二进制数据结构） | 中等（需运行时解析文本文件） |
| 自定义难度 | 难（需重新编译整个数据库） | 难（需重新编译整个数据库） | 简单（文本编辑器修改即可） |
| 典型文件大小 | 5-15 MB | 3-10 MB | 单个文件通常 10-500 KB |

### 什么时候用哪个

**GeoIP** 适合做国家级别的 IP 路由。最经典的用法就是 `GEOIP,CN,DIRECT`——把所有中国 IP 一律直连。你不需要也不可能把所有中国 IP 段逐条列出来，GeoIP 数据库帮你搞定了这件事。

**GeoSite** 适合做域名类别路由。比如 `GEOSITE,google,Proxy` 会把所有 Google 相关域名（google.com、googleapis.com、gstatic.com、youtube.com 等几百个域名）一次性路由到代理。你不需要知道 Google 具体有多少个域名，GeoSite 数据库帮你维护这个列表。

**Rule-Provider** 适合精细控制特定服务的路由。比如你想单独控制 Netflix 走专用流媒体节点、AI 服务走特定地区节点，或者自定义一组公司内网域名直连。Rule-Provider 的优势是灵活性——你可以随意编辑文本文件添加或删除域名，客户端还能自动从 URL 更新。

**实际配置中三者同时使用。** 一个典型的分流方案是：Rule-Provider 处理需要精细控制的特定服务（Netflix、Telegram、AI 等），GeoSite 处理大类域名（cn 直连、广告屏蔽），GeoIP 作为 IP 层面的兜底（CN 直连），最后 MATCH 兜底一切。

## 如何更新 GeoIP/GeoSite 数据库

数据库文件不会自动更新（这一点和 rule-provider 不同）。你需要主动获取新版本并替换旧文件。

### Clash Verge Rev

Clash Verge Rev 通常在客户端版本更新时一并更新 GeoIP 和 GeoSite 数据库。如果你想手动更新：

1. 打开 Clash Verge Rev，进入"设置"页面。
2. 找到 GeoIP/GeoSite 相关的数据库设置区域（具体位置因版本而异）。
3. 部分版本提供了直接更新数据库的按钮。

如果客户端没有内置更新功能，可以手动下载文件并放置到配置目录：

- Windows 配置目录：`%USERPROFILE%\.config\clash-verge-rev\`（mihomo 子目录下）
- macOS 配置目录：`~/.config/clash-verge-rev/`
- Linux 配置目录：`~/.config/clash-verge-rev/`

### 手动更新

**mihomo / Clash 系列客户端：**

需要下载的文件：
- GeoIP：`Country.mmdb` 或 `geoip.metadb`
- GeoSite：`geosite.dat` 或 `GeoSite.dat`

下载来源：`github.com/MetaCubeX/meta-rules-dat/releases`

将下载的文件放到 mihomo 的配置目录，覆盖同名旧文件，重启客户端生效。

**V2Ray / Xray 系列客户端：**

需要下载的文件：
- GeoIP：`geoip.dat`
- GeoSite：`geosite.dat`

下载来源：`github.com/Loyalsoldier/v2ray-rules-dat/releases`

将文件放到 V2Ray/Xray 的资源目录（通常和可执行文件同目录），覆盖旧文件，重启生效。

**sing-box 客户端：**

需要下载的文件：
- GeoIP：`geoip.db`
- GeoSite：`geosite.db`

下载来源：`github.com/SagerNet/sing-geoip/releases` 和 `github.com/SagerNet/sing-geosite/releases`

sing-box 较新版本推荐使用 rule-set 替代 GeoIP/GeoSite，具体参考 sing-box 官方文档。

### 更新频率

GeoIP 和 GeoSite 数据库的上游项目通常每周或每月发布新版本。对于普通用户，没有必要每天更新。

**建议的更新节奏**：

- **正常使用**：每 1-3 个月更新一次。IP 分配和域名归属的变化并不频繁。
- **遇到问题时**：如果你发现某个网站的分流不正确（比如一个新开的中国网站走了代理，或者某个境外服务没有正确路由），先尝试更新数据库文件，很可能新版本已经修复了这个问题。
- **客户端更新时**：更新代理客户端版本时，顺带检查一下数据库文件是否也需要更新。

不需要追求"实时最新"。数据库的变化是渐进式的，隔几周更新一次不会错过什么关键变化。

## GeoSite 类别速查

以下是 GeoSite 数据库中常用的类别名称及其含义，方便你写分流规则时参考：

| 类别名称 | 包含内容 | 典型用法 |
|----------|---------|---------|
| `cn` | 中国网站域名 | `GEOSITE,cn,DIRECT` |
| `geolocation-cn` | 需要用中国 DNS 解析的域名 | DNS 分流规则 |
| `geolocation-!cn` | 不应用中国 DNS 解析的域名 | DNS 分流规则 |
| `google` | Google 全系服务 | `GEOSITE,google,Proxy` |
| `youtube` | YouTube 相关域名 | `GEOSITE,youtube,Proxy` |
| `facebook` | Facebook/Meta 服务 | `GEOSITE,facebook,Proxy` |
| `twitter` | Twitter/X 服务 | `GEOSITE,twitter,Proxy` |
| `telegram` | Telegram 相关域名 | `GEOSITE,telegram,Proxy` |
| `netflix` | Netflix 域名 | `GEOSITE,netflix,Streaming` |
| `openai` | OpenAI/ChatGPT 域名 | `GEOSITE,openai,AI` |
| `apple` | Apple 服务 | `GEOSITE,apple,Apple` |
| `microsoft` | Microsoft 服务 | `GEOSITE,microsoft,Proxy` |
| `category-ads-all` | 广告和追踪器域名汇总 | `GEOSITE,category-ads-all,REJECT` |
| `tld-cn` | `.cn` 顶级域名 | `GEOSITE,tld-cn,DIRECT` |
| `private` | 私有域名（localhost 等） | `GEOSITE,private,DIRECT` |

注意：不同数据源支持的类别可能略有差异。以你实际使用的 GeoSite 数据文件所含的类别为准。如果你不确定某个类别是否存在，可以查看对应项目的 GitHub 仓库中的目录结构。

## 常见问题

### 为什么某个中国网站走了代理？

这种情况通常有两个原因：

1. **域名不在 GeoSite 的 cn 列表中。** GeoSite 数据库虽然覆盖面广，但不可能收录每一个中国网站的域名。一些新建的网站、小众的网站、或者使用非常规域名的网站可能没有被收录。
2. **IP 不在 GeoIP 的 CN 范围内。** 部分中国服务使用了境外的 CDN 或服务器（比如用 Cloudflare 加速的中国网站），其 IP 被 GeoIP 标记为非 CN。

**解决方法**：手动添加一条 `DOMAIN-SUFFIX` 或 `DOMAIN` 规则，将这个网站设为 DIRECT。把这条规则放在 GEOSITE 和 GEOIP 规则之前。或者等待数据库更新——如果这个网站有一定知名度，社区贡献者迟早会把它加入列表。

### GeoIP 和 GeoSite 需要同时用吗？

**推荐同时使用。** 两者的匹配维度不同，互为补充：

- GeoSite 匹配域名，在 DNS 解析之前就能判断路由。速度更快，精度更高（域名是确定性的，一个域名只属于一个网站）。
- GeoIP 匹配 IP 地址，在域名规则未命中时作为兜底。它能覆盖那些没有被 GeoSite 收录的域名——只要服务器 IP 在中国，就走直连。

只用 GeoSite 不用 GeoIP：可能漏掉一些没被收录到 cn 类别的国内域名，它们的流量会走代理。

只用 GeoIP 不用 GeoSite：所有域名都需要先进行 DNS 解析拿到 IP 才能判断路由，效率较低。而且某些使用境外 CDN 的国内网站可能被错误地代理。

两者配合是最稳妥的方案。

### 数据库文件存放在哪里？

不同客户端的存放位置不同：

- **Clash Verge Rev (Windows)**：`%USERPROFILE%\.config\clash-verge-rev\`（查看其 mihomo 工作目录）
- **Clash Verge Rev (macOS/Linux)**：`~/.config/clash-verge-rev/`
- **v2rayN (Windows)**：与 v2rayN.exe 同目录，或在 `bin/xray/` 子目录中
- **sing-box**：配置文件中 `experimental.cache_file` 指定的目录

具体路径可以在客户端的设置界面中找到。大多数客户端都提供了"打开配置目录"或类似功能的入口。

### 用了 rule-provider 还需要 GEOIP/GEOSITE 吗？

**可以共存，推荐共存。**

Rule-provider 提供对特定服务的精细控制——你可以用它单独管理 Netflix、Telegram、AI 服务等流量的路由策略。

GEOSITE 和 GEOIP 提供宏观的"大网"路由——确保所有中国域名和中国 IP 直连，所有广告域名被屏蔽。

典型的配置结构是：

```yaml
rules:
  # rule-provider 处理特定服务（精细控制）
  - RULE-SET,reject,REJECT
  - RULE-SET,netflix,Streaming
  - RULE-SET,openai,AI
  - RULE-SET,telegram,Proxy

  # GEOSITE 处理大类（宏观路由）
  - GEOSITE,cn,DIRECT

  # GEOIP 兜底（IP 层面）
  - GEOIP,CN,DIRECT

  # 最终兜底
  - MATCH,Proxy
```

这种分层结构让你既有精细控制的灵活性，又有宏观路由的安全网。

### GeoSite 和 rule-provider 的 domain behavior 有什么区别？

功能上几乎等价——都是根据域名来匹配流量。区别在于：

- **GeoSite** 是预编译的二进制数据库，所有类别打包在一个文件中（`geosite.dat`），加载速度极快，但修改困难（需要重新编译）。
- **Rule-Provider（domain behavior）** 是纯文本文件，每个类别一个独立文件，客户端可以自动从 URL 更新，修改简单（文本编辑器即可）。

如果你不需要自定义域名列表，两者都能用。如果你需要经常修改或添加域名，rule-provider 更方便。如果你追求极致的加载速度，GeoSite 略有优势。

实际上，很多配置模板混合使用两者：GeoSite 处理基础的 CN 直连和广告屏蔽，rule-provider 处理需要精细控制的特定服务。
