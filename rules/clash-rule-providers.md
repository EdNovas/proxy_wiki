# Clash 规则集详解：rule-provider 是什么、怎么用

> **摘要**：rule-provider 是 Clash（mihomo）中管理分流规则的核心机制。它允许你从外部加载和自动更新规则列表，而不用在配置文件中手写成百上千条规则。本文详解 rule-provider 的工作原理、配置方法和常用规则集推荐。

## 为什么需要 rule-provider

一个能用的代理配置，分流规则是核心。你需要告诉客户端：哪些流量走代理、哪些直连、哪些应该屏蔽。

如果不使用 rule-provider，你的配置文件里会写满这样的内容：

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-SUFFIX,googleapis.com,Proxy
  - DOMAIN-SUFFIX,youtube.com,Proxy
  - DOMAIN-SUFFIX,twitter.com,Proxy
  - DOMAIN-SUFFIX,facebook.com,Proxy
  # ... 还有几千条
  - IP-CIDR,91.108.0.0/16,Proxy
  - IP-CIDR,149.154.0.0/16,Proxy
  # ... 还有几百条 IP 段
```

这种做法有三个严重问题：

1. **配置文件膨胀**。一套完整的分流规则通常包含数千条记录——GFW 屏蔽的域名、国内直连的域名和 IP 段、广告域名、各种流媒体的域名。全部写在主配置文件中，文件大小动辄几百 KB，打开编辑都很困难。

2. **无法自动更新**。GFW 的屏蔽列表不是固定的，新的域名不断被封锁，旧的 IP 段可能被释放。广告域名的变化更加频繁。如果规则写死在配置文件里，你需要手动追踪这些变化并逐条更新，这在实际操作中几乎不可能做到。

3. **维护成本极高**。当你想调整分流策略时——比如把 Netflix 从通用代理组移到专门的流媒体组——你需要在几千条规则中找到所有相关条目并逐一修改。

rule-provider 的思路和浏览器的广告拦截器完全一样：**你不用自己编写拦截规则，只需要订阅别人维护的规则列表。** 列表的维护者会持续更新内容，你的客户端定期拉取最新版本，始终保持规则的时效性。

## rule-provider 的工作原理

rule-provider 的运行逻辑分为三个阶段：

**加载阶段**：Clash 启动时，读取配置文件中 `rule-providers` 段的定义。对于每个 provider，根据 `type` 字段决定加载方式——`http` 类型会从指定 URL 下载规则文件，`file` 类型会从本地路径读取文件。下载的文件会缓存到 `path` 指定的本地路径。

**更新阶段**：对于 `http` 类型的 provider，Clash 会按照 `interval` 字段设定的时间间隔（单位为秒）重新下载规则文件。如果下载失败（比如网络不可用），Clash 会继续使用上一次成功下载的缓存文件，不会中断服务。

**匹配阶段**：当有流量进入时，Clash 按照 `rules` 段的顺序逐条匹配。遇到 `RULE-SET` 类型的规则时，Clash 会在对应的 rule-provider 加载的规则列表中查找匹配项。如果找到匹配，按照 `RULE-SET` 指定的策略组处理；如果没有匹配，继续检查下一条规则。

**规则文件格式**：rule-provider 支持三种格式：

- **text**：纯文本格式，每行一条规则，最直观也最通用
- **yaml**：YAML 格式，规则包裹在 `payload` 字段中
- **mrs**：mihomo 专有的二进制格式，加载速度最快，但只有 mihomo 内核支持

## 配置方法

### 基本语法

rule-provider 的配置分为两部分：先在 `rule-providers` 段定义规则集，再在 `rules` 段中引用它们。

```yaml
rule-providers:
  google:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt"
    path: ./ruleset/google.txt
    interval: 86400
    format: text

  cn-cidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.txt
    interval: 86400
    format: text

rules:
  - RULE-SET,google,Proxy
  - RULE-SET,cn-cidr,DIRECT
  - MATCH,Proxy
```

### 参数详解

每个 rule-provider 包含以下参数：

**type** -- 加载方式

- `http`：从远程 URL 下载规则文件。适合使用公共维护的规则集。
- `file`：从本地文件路径读取。适合自定义规则或网络受限环境。

**behavior** -- 规则行为类型

这是最容易混淆的参数，决定了规则文件内容的解析方式。三种取值对应三种不同的文件格式要求：

- `domain`：文件中每一行是一个域名，Clash 自动按 DOMAIN-SUFFIX 逻辑匹配。
- `ipcidr`：文件中每一行是一个 IP CIDR 段。
- `classical`：文件中每一行是完整的规则语法（包含规则类型前缀）。

**url** -- 远程下载地址

规则文件的 URL。仅在 `type: http` 时需要。建议使用 CDN 加速地址（如 jsdelivr）以提高下载成功率。

**path** -- 本地缓存路径

下载的规则文件在本地的存储路径。即使是 `http` 类型也需要指定，用于缓存下载的文件。路径相对于 Clash 的配置目录。

**interval** -- 更新间隔

自动更新的时间间隔，单位为秒。`86400` 表示每 24 小时更新一次。设为 `0` 则不自动更新。

**format** -- 文件格式

- `text`：纯文本，每行一条规则，最常用。
- `yaml`：YAML 格式，规则在 `payload` 列表中。
- `mrs`：mihomo 的二进制格式，解析速度最快。

### behavior 类型详细说明

三种 behavior 的区别是新手最容易踩坑的地方。文件内容格式必须和 behavior 声明严格对应，否则 Clash 无法正确解析。

**domain behavior**：

文件内容只包含域名，不需要规则类型前缀：

```text
google.com
googleapis.com
youtube.com
gstatic.com
```

Clash 会自动将这些域名按 DOMAIN-SUFFIX 逻辑匹配。也就是说，`google.com` 会匹配 `google.com` 本身以及 `mail.google.com`、`docs.google.com` 等所有子域名。

在 `rules` 中引用时直接写 `RULE-SET,google,Proxy`，不需要再指定匹配类型。

**ipcidr behavior**：

文件内容只包含 IP CIDR 段：

```text
91.108.0.0/16
149.154.0.0/16
```

引用方式与 domain 相同。当流量的目标 IP 落在这些 CIDR 范围内时，规则命中。

**classical behavior**：

文件内容包含完整的规则语法，支持混合多种规则类型：

```text
DOMAIN-SUFFIX,google.com
DOMAIN-KEYWORD,youtube
IP-CIDR,91.108.0.0/16,no-resolve
DOMAIN,api.openai.com
```

classical 是最灵活的 behavior，因为一个文件中可以同时包含域名规则、IP 规则、关键词规则等。代价是解析速度略慢于 domain 和 ipcidr，因为 Clash 需要逐行解析规则类型前缀。

**选择建议**：如果规则文件只包含域名，用 `domain`；只包含 IP 段，用 `ipcidr`；包含混合类型，用 `classical`。公共规则集的文档通常会标明应该使用哪种 behavior。

### 在规则中引用 rule-provider

定义好 rule-provider 后，在 `rules` 段中通过 `RULE-SET` 关键字引用：

```yaml
rules:
  # 广告拦截
  - RULE-SET,reject,REJECT
  # 私有地址直连
  - RULE-SET,private,DIRECT
  # 具体服务 → 专用策略组
  - RULE-SET,openai,AI
  - RULE-SET,google,Proxy
  - RULE-SET,apple,Apple
  - RULE-SET,netflix,Streaming
  - RULE-SET,telegram,Telegram
  # 国内流量直连
  - RULE-SET,cn-domain,DIRECT
  - RULE-SET,cn-cidr,DIRECT
  - GEOIP,CN,DIRECT
  # 兜底
  - MATCH,Proxy
```

规则的匹配顺序至关重要：**Clash 从上到下逐条匹配，第一条命中的规则生效。** 因此：

- 把 REJECT（广告拦截）放在最前面，确保广告域名不会被后面的规则放行
- 具体服务的规则放在通用规则前面，避免被更宽泛的规则覆盖
- GEOIP 和 MATCH 放在最后作为兜底

## 常用规则集推荐

### Loyalsoldier/clash-rules

目前最流行的 Clash 规则集项目，社区维护活跃，覆盖全面。

**规则分类**：

| 文件名 | 内容 | behavior |
|--------|------|----------|
| `reject.txt` | 广告、追踪器域名 | domain |
| `direct.txt` | 国内直连域名 | domain |
| `proxy.txt` | 需要代理的域名 | domain |
| `google.txt` | Google 服务域名 | domain |
| `apple.txt` | Apple 服务域名 | domain |
| `icloud.txt` | iCloud 域名 | domain |
| `private.txt` | 私有网络域名 | domain |
| `gfw.txt` | GFW 屏蔽域名 | domain |
| `cncidr.txt` | 中国大陆 IP 段 | ipcidr |
| `telegramcidr.txt` | Telegram IP 段 | ipcidr |
| `lancidr.txt` | 局域网 IP 段 | ipcidr |

**URL 基础路径**：`https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/`

**格式**：text

**适合人群**：大多数用户。规则分类清晰，文件格式统一，文档完善。

### MetaCubeX/meta-rules-dat

mihomo（Clash Meta）官方维护的规则数据集，提供 MRS 二进制格式。

**特点**：

- 提供 MRS 格式的规则文件，加载速度显著快于文本格式。在规则数量较大时（数万条），MRS 格式的解析时间可以比 text 格式快数倍。
- 规则数据来源于 v2fly/domain-list-community 和 Loyalsoldier/geoip 等上游项目，覆盖全面。
- 同时提供 GeoSite 和 GeoIP 数据，可以搭配 `GEOSITE` 和 `GEOIP` 规则使用。

**适合人群**：使用 mihomo 内核的用户。如果你的客户端是 Clash Verge Rev、Clash Nyanpasu 等基于 mihomo 的软件，优先考虑这个项目以获得最佳加载性能。

### ACL4SSR

历史悠久的规则项目，最大的特点是提供了**预制的完整配置文件**，包括 rule-provider 定义和 rules 段，开箱即用。

**特点**：

- 规则分类非常细致，对流媒体服务有详细拆分：Netflix、Disney+、HBO、Amazon Prime Video、Spotify 等各有独立规则文件。
- 提供适用于不同机场订阅转换服务的配置模板。
- 社区讨论活跃，遇到问题容易找到解决方案。

**适合人群**：需要对每个流媒体服务单独配置路由策略的用户。比如你想让 Netflix 走美国节点、Disney+ 走新加坡节点，ACL4SSR 的细粒度分类会很方便。

## 完整配置示例

以下是一套可以直接使用或在此基础上修改的完整配置。包含广告拦截、国内直连、常用海外服务分组、流媒体、AI 服务和 Telegram 的独立路由。

```yaml
# ==================== 规则集定义 ====================
rule-providers:
  # 广告拦截
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.txt
    interval: 43200
    format: text

  # 私有网络
  private:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./ruleset/private.txt
    interval: 86400
    format: text

  # 国内直连域名
  cn-domain:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.txt
    interval: 86400
    format: text

  # 国内 IP 段
  cn-cidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.txt
    interval: 86400
    format: text

  # Google 服务
  google:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt"
    path: ./ruleset/google.txt
    interval: 86400
    format: text

  # Apple 服务
  apple:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt"
    path: ./ruleset/apple.txt
    interval: 86400
    format: text

  # iCloud
  icloud:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt"
    path: ./ruleset/icloud.txt
    interval: 86400
    format: text

  # Telegram IP 段
  telegram-cidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt"
    path: ./ruleset/telegramcidr.txt
    interval: 86400
    format: text

  # 流媒体 - Netflix
  netflix:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/Providers/Ruleset/Netflix.yaml"
    path: ./ruleset/netflix.yaml
    interval: 86400

  # 流媒体 - Disney+
  disney:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/Clash/Providers/Ruleset/DisneyPlus.yaml"
    path: ./ruleset/disney.yaml
    interval: 86400

  # AI 服务 (OpenAI, Claude 等)
  ai-services:
    type: file
    behavior: classical
    path: ./ruleset/ai-services.txt
    format: text

  # GFW 列表
  gfw:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./ruleset/gfw.txt
    interval: 86400
    format: text

  # 需要代理的域名
  proxy-domain:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.txt
    interval: 86400
    format: text

# ==================== 分流规则 ====================
rules:
  # 1. 广告拦截 - 最高优先级
  - RULE-SET,reject,REJECT

  # 2. 私有地址和局域网 - 必须直连
  - RULE-SET,private,DIRECT

  # 3. AI 服务 - 单独分组，方便切换节点地区
  - RULE-SET,ai-services,AI

  # 4. 流媒体 - 单独分组，走专用解锁节点
  - RULE-SET,netflix,Streaming
  - RULE-SET,disney,Streaming

  # 5. Telegram - 基于 IP 段匹配
  - RULE-SET,telegram-cidr,Telegram

  # 6. Google 服务
  - RULE-SET,google,Proxy

  # 7. Apple 服务 - 国内 CDN 可直连，部分服务需要代理
  - RULE-SET,apple,Apple
  - RULE-SET,icloud,Apple

  # 8. 国内域名和 IP - 直连
  - RULE-SET,cn-domain,DIRECT
  - RULE-SET,cn-cidr,DIRECT

  # 9. GFW 列表和通用代理域名
  - RULE-SET,gfw,Proxy
  - RULE-SET,proxy-domain,Proxy

  # 10. GeoIP 兜底 - 中国 IP 直连
  - GEOIP,CN,DIRECT

  # 11. 最终兜底 - 未匹配的流量走代理
  - MATCH,Proxy
```

上面的配置中，`ai-services` 使用了 `type: file`，你需要手动创建这个文件。示例内容如下（保存为 `./ruleset/ai-services.txt`）：

```text
DOMAIN-SUFFIX,openai.com
DOMAIN-SUFFIX,ai.com
DOMAIN-SUFFIX,chatgpt.com
DOMAIN-SUFFIX,oaistatic.com
DOMAIN-SUFFIX,oaiusercontent.com
DOMAIN-SUFFIX,anthropic.com
DOMAIN-SUFFIX,claude.ai
DOMAIN-SUFFIX,googleapis.com
DOMAIN-SUFFIX,gemini.google.com
DOMAIN-SUFFIX,bard.google.com
DOMAIN-SUFFIX,deepmind.google
DOMAIN-SUFFIX,copilot.microsoft.com
DOMAIN-SUFFIX,perplexity.ai
```

配置中引用了 `AI`、`Streaming`、`Telegram`、`Apple` 等策略组名称，你需要在 `proxy-groups` 段中定义这些组。这些组的具体节点配置取决于你的代理服务提供商。

## 自定义规则集

公共规则集覆盖了绝大多数场景，但总有一些个性化需求需要自定义规则。

### 创建自定义规则文件

以公司内网域名直连为例，创建一个文本文件 `company.txt`：

```text
internal.mycompany.com
gitlab.mycompany.com
jira.mycompany.com
wiki.mycompany.com
vpn.mycompany.com
```

### 在配置中引用

如果是本地文件：

```yaml
rule-providers:
  company:
    type: file
    behavior: domain
    path: ./ruleset/company.txt
    format: text

rules:
  - RULE-SET,company,DIRECT
  # ... 其他规则
```

如果你把文件托管到 GitHub 或自己的服务器：

```yaml
rule-providers:
  company:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/yourname/rules/main/company.txt"
    path: ./ruleset/company.txt
    interval: 86400
    format: text
```

### 实际应用场景

**游戏加速**：某些游戏的服务器 IP 需要走特定节点以获得最低延迟。创建一个 `gaming.txt`，使用 ipcidr behavior，将游戏服务器 IP 段路由到延迟最低的节点组。

**开发工具**：GitHub、npm、Docker Hub 等开发相关服务的域名，集中到一个规则文件中，路由到稳定性最好的节点。

**内容过滤**：除了使用公共的广告拦截规则，你可以创建自己的屏蔽列表，把不想看到的域名加入其中，使用 REJECT 策略。

## 常见问题

### Q: rule-provider 下载失败怎么办？

这是最常见的"先有鸡还是先有蛋"问题：你需要代理才能下载规则文件，但规则文件还没下载完成时代理无法正常工作。

**解决方法**：

1. **使用 CDN 地址**：jsdelivr（`cdn.jsdelivr.net`）、ghproxy（`ghproxy.com`）等 CDN 在国内通常可以直接访问，避免直接访问 GitHub raw 域名。
2. **手动下载**：先通过其他方式（比如已经能翻墙的手机）下载规则文件，放到 `path` 指定的本地路径，并将 `type` 改为 `file`。
3. **初始启动配置**：第一次使用时，先用一个精简的配置（不包含 rule-provider，只有几条基本规则）连上代理，然后再切换到包含 rule-provider 的完整配置。
4. **机场提供的配置**：很多机场的订阅链接已经内置了 rule-provider 配置，且使用可达的 CDN 地址，直接导入即可。

### Q: 规则集多久更新一次合适？

取决于规则集的类型：

- **广告拦截规则**（reject）：建议 12 小时（`43200` 秒）。广告域名变化较快，更频繁的更新可以保持更好的拦截效果。
- **常规分流规则**（direct、proxy、gfw 等）：24 小时（`86400` 秒）足够。这类规则的变化频率较低。
- **IP 段规则**（cncidr、telegramcidr 等）：24-72 小时都可以。IP 段的分配变化很慢。
- **自定义规则**（本地文件）：设为 `0` 即可，由你手动维护。

不建议将 interval 设得过小（比如每小时更新一次）。频繁下载不仅浪费带宽，还可能触发 CDN 的速率限制，导致下载失败。

### Q: domain 和 classical behavior 选哪个？

**优先用 domain 或 ipcidr**，原因是：

1. **解析速度更快**：domain 和 ipcidr behavior 的规则文件格式简单，Clash 可以将它们高效地加载到内存中的哈希表或前缀树结构中，查询复杂度接近 O(1)。而 classical behavior 包含多种规则类型，需要逐条线性匹配，效率较低。
2. **文件更小**：domain 文件每行只有一个域名，不需要 `DOMAIN-SUFFIX,` 前缀，文件体积更小，下载更快。
3. **不容易出错**：格式简单意味着手动编辑时不容易写错。

**必须用 classical 的场景**：规则文件中混合了不同类型的规则（域名 + IP + 关键字），或者规则来源只提供 classical 格式。ACL4SSR 项目的部分规则文件就是 classical 格式。

### Q: 规则集之间冲突了怎么办？

规则冲突的本质是：同一个域名或 IP 出现在多个 rule-provider 的规则列表中，而这些 rule-provider 对应不同的策略组。

Clash 的处理方式是 **先匹配先生效**（first match wins）。`rules` 段中排在前面的 `RULE-SET` 优先级更高。

**典型冲突场景和解决方法**：

- `youtube.com` 同时出现在 `google.txt` 和 `proxy.txt` 中。如果你在 `rules` 里先写了 `RULE-SET,google,Proxy`，再写 `RULE-SET,proxy-domain,Proxy`，YouTube 会命中 Google 的规则。两者策略相同时没有实际影响；如果策略不同，调整 `rules` 中的顺序即可。
- Netflix 域名同时出现在 `netflix` 规则集和通用 `proxy-domain` 规则集中。把 `RULE-SET,netflix,Streaming` 放在 `RULE-SET,proxy-domain,Proxy` 前面，Netflix 就会走 Streaming 组而非通用 Proxy 组。

**排查方法**：在 Clash 的日志或连接面板中查看特定域名命中了哪条规则。Clash Verge Rev 的"连接"页面会显示每个连接匹配的规则名称和策略组，方便排查冲突。

### Q: 使用 MRS 格式有什么注意事项？

MRS（Meta Rule Set）是 mihomo 引入的二进制规则格式，加载速度最快，但有以下限制：

- 只有 mihomo 内核支持，原版 Clash Premium 和其他内核无法使用。
- 无法直接用文本编辑器查看或编辑文件内容。
- 需要使用 mihomo 提供的工具将文本规则编译为 MRS 格式。

如果你使用的客户端基于 mihomo 内核（Clash Verge Rev、Clash Nyanpasu 等），且规则集数量较多、总条目数达到数万条级别，切换到 MRS 格式可以显著减少启动时的规则加载时间。对于规则条目较少的情况，text 格式已经足够快，差异可以忽略。

### Q: 能同时使用 GEOSITE/GEOIP 和 rule-provider 吗？

可以，两者并不冲突。`GEOSITE` 和 `GEOIP` 是 Clash 内置的规则类型，使用预编译的数据库进行匹配；`RULE-SET` 则引用外部的 rule-provider 文件。

实际配置中，常见的搭配方式是：用 rule-provider 处理需要精细控制的服务（Netflix、Telegram、AI 等），用 `GEOIP,CN,DIRECT` 作为中国 IP 的兜底规则。两者各司其职，互相补充。

---

*最后更新：2026-05-10*

*[ednovas.xyz](https://ednovas.xyz)*
