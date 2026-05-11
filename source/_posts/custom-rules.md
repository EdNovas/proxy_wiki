---
title: 如何自定义规则：让特定网站走代理/直连/特定节点
date: 2026-05-10
updated: 2026-05-10
categories:
  - 规则与分流
tags:
  - 自定义规则
  - Clash
  - 分流
  - 配置
  - 进阶
index_img: /images/posts/custom-rules.webp
excerpt: 教你在 Clash 中自定义分流规则——让特定网站走代理、公司内网直连、游戏走特定节点。
---

> **摘要**：机场自带的规则集能满足大多数需求，但总有一些特殊情况——某个网站应该走代理但走了直连，公司内网需要直连，特定游戏需要走特定地区节点。本文教你如何在 Clash（mihomo）中自定义分流规则，覆盖三种主流方式、五个实用场景、完整的调试方法和规则语法速查表。

## 什么时候需要自定义规则

机场订阅里自带的规则集和社区公共规则集（如 Loyalsoldier、ACL4SSR）已经覆盖了绝大多数常见网站。但以下场景，你必须自己动手：

**某个网站路由不正确。** 最常见的情况。一个被墙的网站没有出现在任何公共规则集里，导致它匹配到了兜底规则走了直连，打不开。或者反过来——一个国内网站被误判为需要代理，访问变慢了。公共规则集不可能收录互联网上的每一个域名，漏掉的那个恰好就是你需要的。

**公司内网或 VPN 需要绕过代理。** 你在公司网络环境中使用代理，但公司内部的 GitLab、Jira、OA 系统、打印机管理页面等只能在内网访问。这些流量如果走了代理，会直接超时。你需要把公司的域名和 IP 段加入直连规则。

**特定游戏需要走特定地区的节点。** 你玩日服的游戏，需要流量走日本节点以获得最低延迟。或者你玩的游戏服务器在韩国，需要走首尔的节点。通用的"Proxy"策略组不够精确，你需要把游戏的域名和进程指向专门的节点组。

**想屏蔽默认规则没覆盖的广告和追踪器。** 公共的广告拦截规则集更新再勤快，也总有漏网之鱼。某个 App 里弹出的广告域名、某个网站上的追踪脚本，你可以自己加 REJECT 规则来屏蔽。

**特定服务需要走专用节点组。** AI 服务（ChatGPT、Claude）对 IP 地区有要求，流媒体（Netflix、Disney+）需要解锁节点，Telegram 需要稳定的线路。你想让这些服务各走各的最优路径，而不是混在一起。

## 自定义的三种方式

### 方式一：在配置文件中直接添加规则

最直接的方法——打开你的 Clash 配置文件（YAML 格式），在 `rules:` 段中插入自定义规则。

关键原则：**自定义规则必须放在通用规则和兜底规则之前。** Clash 的规则匹配是从上到下、先到先得的。如果你把自定义规则放在 `MATCH,Proxy` 后面，它永远不会被匹配到。

```yaml
rules:
  # ========== 自定义规则 - 放在最前面 ==========
  # 公司内网直连
  - DOMAIN-SUFFIX,company-internal.com,DIRECT
  # 特定游戏走日本节点
  - DOMAIN-SUFFIX,specific-game.com,GameNodes
  # 某个网站强制走代理
  - DOMAIN,blocked-site.example.com,Proxy
  # 屏蔽某个广告域名
  - DOMAIN-SUFFIX,annoying-tracker.com,REJECT
  
  # ========== 以下是默认规则集 ==========
  - RULE-SET,reject,REJECT
  - RULE-SET,direct,DIRECT
  - RULE-SET,proxy,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

**优点**：简单直观，改完保存就生效。

**缺点**：当你的机场订阅更新时，配置文件会被覆盖，你加的自定义规则会丢失。每次更新订阅后都需要手动重新添加。如果你只有两三条规则还能忍，规则多了就很痛苦。

**适合场景**：临时测试、规则数量极少（1-3 条）、不使用订阅更新的情况。

### 方式二：使用 Clash Verge Rev 的覆写功能（推荐）

[Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) 提供了"覆写"（Override / Script）功能，允许你用一段 JavaScript 脚本在订阅配置加载后对其进行修改。这段脚本不会被订阅更新覆盖——它在订阅配置更新之后运行，每次都会把你的自定义规则注入进去。

**操作步骤**：

1. 打开 Clash Verge Rev
2. 进入"订阅"页面
3. 点击你正在使用的订阅配置右侧的编辑图标
4. 切换到"Script"（脚本）标签页
5. 输入覆写脚本

**基础覆写脚本**：

```javascript
// Clash Verge Rev 覆写脚本
function main(config) {
  // 定义自定义规则 - 这些规则会被插入到所有规则的最前面
  const customRules = [
    // 公司内网直连
    "DOMAIN-SUFFIX,company.com,DIRECT",
    "DOMAIN-SUFFIX,internal.corp,DIRECT",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    
    // 特定网站走代理
    "DOMAIN-SUFFIX,special-site.com,Proxy",
    "DOMAIN,blocked-site.example.com,Proxy",
    
    // 游戏走特定节点组
    "PROCESS-NAME,game.exe,GameNodes",
    "DOMAIN-SUFFIX,game-server.com,GameNodes",
    
    // 屏蔽广告
    "DOMAIN-SUFFIX,ad-tracker.com,REJECT",
  ];
  
  // 将自定义规则插入到现有规则的最前面
  config.rules = [...customRules, ...config.rules];
  
  return config;
}
```

**进阶覆写脚本——同时添加策略组和规则**：

如果你的订阅配置里没有你想用的策略组（比如没有"AI-Services"组），你可以在脚本中同时创建策略组和规则：

```javascript
function main(config) {
  // ---- 1. 添加自定义策略组 ----
  // 从现有的节点中筛选出日本节点，创建一个"Gaming-JP"策略组
  const allProxies = config.proxies.map(p => p.name);
  const jpProxies = allProxies.filter(name => 
    name.includes("日本") || name.includes("JP") || name.includes("Japan")
  );
  
  if (jpProxies.length > 0) {
    config["proxy-groups"].push({
      name: "Gaming-JP",
      type: "url-test",
      proxies: jpProxies,
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
    });
  }
  
  // 创建一个"AI-Services"策略组
  const usProxies = allProxies.filter(name =>
    name.includes("美国") || name.includes("US") || name.includes("United States")
  );
  
  if (usProxies.length > 0) {
    config["proxy-groups"].push({
      name: "AI-Services",
      type: "select",
      proxies: [...usProxies, "DIRECT"],
    });
  }
  
  // ---- 2. 添加自定义规则 ----
  const customRules = [
    // AI 服务走专用组
    "DOMAIN-SUFFIX,openai.com,AI-Services",
    "DOMAIN-SUFFIX,chatgpt.com,AI-Services",
    "DOMAIN-SUFFIX,anthropic.com,AI-Services",
    "DOMAIN-SUFFIX,claude.ai,AI-Services",
    
    // 游戏走日本节点
    "DOMAIN-SUFFIX,riotgames.com,Gaming-JP",
    "PROCESS-NAME,LeagueClient.exe,Gaming-JP",
  ];
  
  config.rules = [...customRules, ...config.rules];
  
  return config;
}
```


**优点**：订阅更新不会覆盖你的自定义规则。脚本逻辑灵活，可以根据现有节点动态创建策略组。一次配置，长期有效。

**缺点**：需要基本的 JavaScript 知识。脚本写错可能导致整个配置加载失败（但不会丢失原始配置，修改脚本即可恢复）。

**适合场景**：长期使用的自定义规则、需要自动创建策略组、使用订阅更新的用户。这是大多数用户的最佳选择。

### 方式三：创建自己的 rule-provider 文件

当你的自定义规则数量较多（几十条甚至上百条），把它们全写在脚本或配置文件里不太方便管理。这时候可以创建独立的规则文件，通过 rule-provider 机制加载。

**创建规则文件**：

在 Clash 配置目录下创建一个 `custom` 文件夹，在里面放你的规则文件。

以域名列表为例，创建 `my-direct-domains.txt`：

```text
company.com
internal.corp
oa.mycompany.cn
gitlab.mycompany.com
jira.mycompany.com
vpn.mycompany.com
printer.office.local
```

以混合规则为例，创建 `my-custom-rules.txt`（需要使用 classical behavior）：

```text
DOMAIN-SUFFIX,company.com
DOMAIN-SUFFIX,internal.corp
IP-CIDR,10.0.0.0/8,no-resolve
IP-CIDR,172.16.0.0/12,no-resolve
IP-CIDR,192.168.0.0/16,no-resolve
PROCESS-NAME,enterprise-vpn.exe
```

**在配置中引用**：

```yaml
rule-providers:
  my-direct-domains:
    type: file
    behavior: domain
    path: ./custom/my-direct-domains.txt
    format: text

  my-custom-rules:
    type: file
    behavior: classical
    path: ./custom/my-custom-rules.txt
    format: text

rules:
  # 自定义规则集 - 放在其他 RULE-SET 前面
  - RULE-SET,my-direct-domains,DIRECT
  - RULE-SET,my-custom-rules,DIRECT
  
  # 然后是默认规则
  - RULE-SET,reject,REJECT
  - RULE-SET,google,Proxy
  # ... 其他规则
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

**如果配合覆写脚本使用**，可以在脚本中动态注入 rule-provider 定义：

```javascript
function main(config) {
  // 添加自定义 rule-provider
  if (!config["rule-providers"]) {
    config["rule-providers"] = {};
  }
  
  config["rule-providers"]["my-direct"] = {
    type: "file",
    behavior: "domain",
    path: "./custom/my-direct-domains.txt",
    format: "text",
  };
  
  // 在规则最前面引用
  config.rules.unshift("RULE-SET,my-direct,DIRECT");
  
  return config;
}
```

**优点**：规则和配置分离，便于管理大量规则。规则文件可以独立编辑，不影响主配置。如果托管到 GitHub 等平台，还可以设置自动更新。

**缺点**：多一层文件管理。本地文件在多设备间不能自动同步（除非托管到远程）。

**适合场景**：自定义规则数量较多、需要在多台设备间共享自定义规则、需要独立维护和版本管理的情况。

## 实用场景示例

### 场景一：公司内网直连

上班时开着代理，但公司内部系统必须直连，否则打不开。

```yaml
# 公司域名直连
- DOMAIN-SUFFIX,company.com,DIRECT
- DOMAIN-SUFFIX,corp.internal,DIRECT
- DOMAIN-SUFFIX,oa.mycompany.cn,DIRECT
- DOMAIN-SUFFIX,mail.mycompany.com,DIRECT

# 公司 IP 段直连（RFC 1918 私有地址）
- IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve

# 如果公司有专用的公网 IP 段
- IP-CIDR,203.0.113.0/24,DIRECT
```

注意 IP-CIDR 规则后面的 `no-resolve`。这个参数的作用是：当请求的目标是域名时，不要先解析 DNS 再拿 IP 去匹配这条规则。这可以避免不必要的 DNS 查询，提升匹配效率。对于只用来匹配内网 IP 段的规则，加上 `no-resolve` 是好习惯。

### 场景二：特定游戏走特定地区节点

你玩的游戏服务器在日本，需要走日本节点来降低延迟。

```yaml
# 需要先在 proxy-groups 中定义 Gaming-JP 策略组
# proxy-groups:
#   - name: Gaming-JP
#     type: url-test
#     proxies: [JP-01, JP-02, JP-03]
#     url: http://www.gstatic.com/generate_204
#     interval: 300

# Steam 平台
- DOMAIN-SUFFIX,steampowered.com,Gaming
- DOMAIN-SUFFIX,steamcommunity.com,Gaming
- DOMAIN-SUFFIX,steamstatic.com,Gaming
- DOMAIN-SUFFIX,steam-chat.com,Gaming
- PROCESS-NAME,steam.exe,Gaming

# 英雄联盟日服
- DOMAIN-SUFFIX,riotgames.com,Gaming-JP
- DOMAIN-SUFFIX,leagueoflegends.com,Gaming-JP
- PROCESS-NAME,LeagueClient.exe,Gaming-JP
- PROCESS-NAME,League of Legends.exe,Gaming-JP

# 最终幻想14
- DOMAIN-SUFFIX,finalfantasyxiv.com,Gaming-JP
- DOMAIN-SUFFIX,square-enix.com,Gaming-JP
- PROCESS-NAME,ffxiv_dx11.exe,Gaming-JP

# 原神（国际服）
- DOMAIN-SUFFIX,hoyoverse.com,Gaming
- DOMAIN-SUFFIX,mihoyo.com,Gaming
- PROCESS-NAME,GenshinImpact.exe,Gaming
```

**注意**：`PROCESS-NAME` 规则需要在 TUN 模式下才能生效。系统代理模式无法捕获进程信息。如果你还没开启 TUN 模式，参考客户端设置中的 TUN 选项。

### 场景三：AI 服务走专用节点组

ChatGPT、Claude 等 AI 服务对 IP 地区有要求。有些节点的 IP 被这些服务封禁了，有些节点地区根本无法使用这些服务。把 AI 服务单独分组，方便切换到可用的节点。

```yaml
# AI 服务 - 走专用策略组
# OpenAI / ChatGPT
- DOMAIN-SUFFIX,openai.com,AI-Services
- DOMAIN-SUFFIX,chatgpt.com,AI-Services
- DOMAIN-SUFFIX,oaistatic.com,AI-Services
- DOMAIN-SUFFIX,oaiusercontent.com,AI-Services
- DOMAIN-SUFFIX,ai.com,AI-Services

# Anthropic / Claude
- DOMAIN-SUFFIX,anthropic.com,AI-Services
- DOMAIN-SUFFIX,claude.ai,AI-Services

# Google AI
- DOMAIN-SUFFIX,gemini.google.com,AI-Services
- DOMAIN-SUFFIX,deepmind.google,AI-Services
- DOMAIN-SUFFIX,bard.google.com,AI-Services

# Microsoft Copilot
- DOMAIN-SUFFIX,copilot.microsoft.com,AI-Services

# Perplexity
- DOMAIN-SUFFIX,perplexity.ai,AI-Services

# Midjourney
- DOMAIN-SUFFIX,midjourney.com,AI-Services

# Suno (AI 音乐)
- DOMAIN-SUFFIX,suno.com,AI-Services
```

建议 AI-Services 策略组使用 `select`（手动选择）类型而不是 `url-test`（自动选最快）。原因是延迟最低的节点不一定能正常访问这些 AI 服务，手动选择可以确保切换到实际可用的节点。

### 场景四：强制某些网站走代理

有些网站在中国能访问，但走代理更快、功能更全，或者你需要以境外 IP 访问获得不同的内容。

```yaml
# GitHub - 国内虽然能访问，但速度极不稳定，走代理更流畅
- DOMAIN-SUFFIX,github.com,Proxy
- DOMAIN-SUFFIX,githubusercontent.com,Proxy
- DOMAIN-SUFFIX,github.io,Proxy
- DOMAIN-SUFFIX,githubassets.com,Proxy

# Stack Overflow - 国内能访问但经常很慢
- DOMAIN-SUFFIX,stackoverflow.com,Proxy
- DOMAIN-SUFFIX,stackexchange.com,Proxy
- DOMAIN-SUFFIX,sstatic.net,Proxy

# Docker Hub - 镜像拉取经常超时
- DOMAIN-SUFFIX,docker.com,Proxy
- DOMAIN-SUFFIX,docker.io,Proxy

# npm 源 - 默认源在国内很慢（也可以改用国内镜像，但走代理更简单）
- DOMAIN-SUFFIX,npmjs.org,Proxy
- DOMAIN-SUFFIX,npmjs.com,Proxy

# Wikipedia - 部分地区已被墙
- DOMAIN-SUFFIX,wikipedia.org,Proxy
- DOMAIN-SUFFIX,wikimedia.org,Proxy
```

### 场景五：屏蔽特定域名

除了公共广告拦截规则之外，自己补充屏蔽名单。

```yaml
# 屏蔽特定广告和追踪域名
- DOMAIN-SUFFIX,annoying-ads.com,REJECT
- DOMAIN-SUFFIX,user-tracker.net,REJECT

# 用关键词匹配批量屏蔽 - 注意：关键词匹配范围广，可能误伤
- DOMAIN-KEYWORD,adservice,REJECT
- DOMAIN-KEYWORD,analytics,REJECT
- DOMAIN-KEYWORD,tracking,REJECT

# 屏蔽特定 App 的联网请求（需要 TUN 模式）
- PROCESS-NAME,bloatware.exe,REJECT
```

**警告**：`DOMAIN-KEYWORD` 规则的匹配范围很广。`DOMAIN-KEYWORD,analytics,REJECT` 会屏蔽所有域名中包含"analytics"的请求，可能影响到正常网站的功能（比如某些网站用 analytics 子域名做非追踪用途）。建议优先使用 `DOMAIN-SUFFIX`（精确）而不是 `DOMAIN-KEYWORD`（模糊），只在你确定关键词不会误伤时才使用关键词规则。

## 调试自定义规则

规则写好了，怎么确认它生效了？怎么排查没生效的原因？

### 查看规则匹配结果

**Clash Verge Rev**：打开"连接"（Connections）标签页。这里列出了所有当前活跃的网络连接，每条连接显示以下信息：

- **Host**：目标域名或 IP
- **Rule**：匹配到的规则（比如 `DOMAIN-SUFFIX,github.com`）
- **Chains**：使用的策略组和最终节点
- **Type**：连接类型（TCP/UDP）

找到你想检查的连接，看"Rule"列。如果显示的规则不是你写的自定义规则，说明你的规则没有被匹配到——通常是因为位置不对（放在了其他规则后面）或者写法有误。

**实际操作**：在浏览器中访问目标网站，然后立即切到 Clash Verge Rev 的连接页面查看。注意一个域名可能产生多个连接（主页面、CSS、JS、图片等可能来自不同域名），需要找到对应的那条。

### 常见错误和排查方法

**错误 1：自定义规则放在了兜底规则后面**

这是最常见的错误。`MATCH,Proxy` 会匹配一切流量，所有放在它后面的规则都永远不会被检查。

```yaml
# 错误写法
rules:
  - RULE-SET,proxy,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy               # 这条匹配一切，后面的规则永远无效
  - DOMAIN-SUFFIX,my-site.com,DIRECT  # 永远不会被匹配到
```

```yaml
# 正确写法
rules:
  - DOMAIN-SUFFIX,my-site.com,DIRECT  # 自定义规则放最前面
  - RULE-SET,proxy,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

**错误 2：域名拼写有误**

规则不会做模糊匹配。`DOMAIN-SUFFIX,gooogle.com,Proxy`（多了一个 o）不会匹配 `google.com`。仔细检查域名拼写。

排查方法：在连接日志中搜索目标域名，看它实际命中了哪条规则。如果命中的是 `MATCH`（兜底）或其他通用规则而不是你的自定义规则，说明你的规则没有正确匹配。

**错误 3：rule-provider 的 behavior 类型不对**

如果你创建的规则文件内容是纯域名列表（每行一个域名），但 behavior 设成了 `classical`，Clash 会尝试解析每行的规则类型前缀，发现找不到，规则加载失败。

```yaml
# 错误：文件内容是纯域名，但 behavior 写了 classical
my-rules:
  type: file
  behavior: classical     # 错！应该是 domain
  path: ./custom/domains.txt
  format: text
```

```yaml
# 正确
my-rules:
  type: file
  behavior: domain        # 纯域名列表用 domain
  path: ./custom/domains.txt
  format: text
```

反过来，如果文件中包含 `DOMAIN-SUFFIX,xxx.com` 这样带前缀的规则，behavior 就必须用 `classical`。

**错误 4：策略组名称不存在**

规则指向的策略组必须在 `proxy-groups` 中定义过。如果你写了 `DOMAIN-SUFFIX,example.com,GameNodes`，但配置中没有名为"GameNodes"的策略组，Clash 会报错。

排查方法：检查 Clash Verge Rev 的日志页面，加载配置失败时通常会输出具体的错误信息。

**错误 5：订阅更新覆盖了自定义规则**

如果你直接在配置文件中添加规则，订阅更新会用新的配置文件替换旧的，你的修改全部丢失。

解决方案：使用方式二（覆写脚本）或方式三（独立 rule-provider 文件配合覆写脚本）。覆写脚本在订阅配置加载后运行，不受更新影响。


## 规则语法速查表

以下是 Clash / mihomo 支持的所有常用规则类型（完整规则文档请参阅 [Clash Wiki](https://wiki.metacubex.one/)）：

| 类型 | 语法 | 示例 | 说明 |
|------|------|------|------|
| 精确域名 | `DOMAIN` | `DOMAIN,example.com,Proxy` | 只匹配 `example.com` 本身，不匹配子域名 |
| 域名后缀 | `DOMAIN-SUFFIX` | `DOMAIN-SUFFIX,google.com,Proxy` | 匹配 `google.com` 及其所有子域名 `*.google.com` |
| 域名关键词 | `DOMAIN-KEYWORD` | `DOMAIN-KEYWORD,google,Proxy` | 域名中包含 `google` 就匹配 |
| IP 段 | `IP-CIDR` | `IP-CIDR,1.2.3.0/24,DIRECT` | 匹配目标 IP 在指定范围内 |
| IPv6 段 | `IP-CIDR6` | `IP-CIDR6,2001:db8::/32,DIRECT` | 匹配目标 IPv6 地址在指定范围内 |
| 国家 IP | `GEOIP` | `GEOIP,CN,DIRECT` | 根据 GeoIP 数据库判断目标 IP 所属国家 |
| 进程名 | `PROCESS-NAME` | `PROCESS-NAME,chrome.exe,Proxy` | 匹配发出请求的进程名（需要 TUN 模式） |
| 目标端口 | `DST-PORT` | `DST-PORT,22,DIRECT` | 匹配目标端口号 |
| 源端口 | `SRC-PORT` | `SRC-PORT,7777,DIRECT` | 匹配来源端口号 |
| 规则集 | `RULE-SET` | `RULE-SET,my-rules,Proxy` | 引用 rule-provider 中定义的规则集 |
| GeoSite | `GEOSITE` | `GEOSITE,google,Proxy` | 使用内置 GeoSite 数据库匹配（mihomo） |
| 兜底 | `MATCH` | `MATCH,Proxy` | 匹配所有未被前面规则命中的流量，必须放最后 |

### 规则编写的优先级原则

组织规则的顺序直接决定分流的正确性。遵循以下优先级从上到下排列：

```
1. REJECT 规则（广告拦截）—— 最先处理，避免广告请求浪费带宽
2. 自定义直连规则（公司内网等）—— 确保内网流量不走代理
3. 自定义代理/特定节点规则 —— 特殊网站走指定路径
4. 公共规则集（RULE-SET）—— 覆盖常见网站
5. GEOIP,CN,DIRECT —— 兜底：中国 IP 直连
6. MATCH,Proxy —— 最终兜底：剩余流量走代理
```

## 完整实战：从零开始添加自定义规则

下面用一个完整的例子串起所有知识点。假设你的需求是：

1. 公司内网域名 `*.mycompany.com` 和 `*.internal.corp` 直连
2. GitHub 系列域名走代理（默认规则没覆盖到）
3. ChatGPT 和 Claude 走一个专门的美国节点组
4. 英雄联盟走日本节点
5. 屏蔽一个烦人的广告域名 `spam-tracker.net`

**用覆写脚本实现**（推荐方式）：

```javascript
function main(config) {
  // ---------- 创建策略组 ----------
  const allProxies = config.proxies.map(p => p.name);
  
  // AI 服务策略组 - 筛选美国节点
  const usProxies = allProxies.filter(name =>
    /美国|US|United States|America/i.test(name)
  );
  if (usProxies.length > 0) {
    config["proxy-groups"].push({
      name: "AI-Services",
      type: "select",
      proxies: usProxies,
    });
  }
  
  // 游戏策略组 - 筛选日本节点
  const jpProxies = allProxies.filter(name =>
    /日本|JP|Japan|Tokyo|Osaka/i.test(name)
  );
  if (jpProxies.length > 0) {
    config["proxy-groups"].push({
      name: "Gaming-JP",
      type: "url-test",
      proxies: jpProxies,
      url: "http://www.gstatic.com/generate_204",
      interval: 300,
    });
  }
  
  // ---------- 自定义规则 ----------
  const customRules = [
    // 1. 屏蔽广告
    "DOMAIN-SUFFIX,spam-tracker.net,REJECT",
    
    // 2. 公司内网直连
    "DOMAIN-SUFFIX,mycompany.com,DIRECT",
    "DOMAIN-SUFFIX,internal.corp,DIRECT",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    
    // 3. GitHub 走代理
    "DOMAIN-SUFFIX,github.com,Proxy",
    "DOMAIN-SUFFIX,githubusercontent.com,Proxy",
    "DOMAIN-SUFFIX,github.io,Proxy",
    "DOMAIN-SUFFIX,githubassets.com,Proxy",
    
    // 4. AI 服务走专用组
    "DOMAIN-SUFFIX,openai.com,AI-Services",
    "DOMAIN-SUFFIX,chatgpt.com,AI-Services",
    "DOMAIN-SUFFIX,anthropic.com,AI-Services",
    "DOMAIN-SUFFIX,claude.ai,AI-Services",
    
    // 5. 英雄联盟走日本节点
    "DOMAIN-SUFFIX,riotgames.com,Gaming-JP",
    "DOMAIN-SUFFIX,leagueoflegends.com,Gaming-JP",
    "PROCESS-NAME,LeagueClient.exe,Gaming-JP",
  ];
  
  config.rules = [...customRules, ...config.rules];
  
  return config;
}
```

保存脚本后，Clash Verge Rev 会自动重新加载配置。打开"连接"页面，访问 `github.com`，确认连接日志中显示的规则是 `DOMAIN-SUFFIX,github.com` 且走的是 Proxy 策略组。访问公司内网域名，确认走的是 DIRECT。

## 常见问题

### 自定义规则会影响性能吗？

几乎不会。Clash 的规则匹配本身就很快——几条到几十条自定义规则对性能的影响完全可以忽略。即使加上公共规则集的几千条规则，在现代设备上也不会造成可感知的延迟。

如果你的自定义规则确实达到了上百条的量级，建议整理成 rule-provider 文件，用 `domain` 或 `ipcidr` behavior 加载。这两种 behavior 会将规则加载到高效的数据结构中（哈希表或前缀树），查询速度接近 O(1)，远快于逐条线性匹配。

### 怎么找到某个网站对应的域名？

**方法一：浏览器开发者工具。** 按 F12 打开开发者工具，切换到 Network（网络）面板，然后访问目标网站。你会看到浏览器发出的所有请求及其目标域名。主域名通常就是你在地址栏看到的，但很多网站还会加载来自其他域名的资源（CDN、API 等）。

**方法二：Clash 连接日志。** 访问目标网站后，在 Clash Verge Rev 的"连接"页面中搜索。这里显示的是实际经过代理客户端的所有连接，比浏览器开发者工具更全面（包括非浏览器应用的流量）。

**方法三：命令行工具。** 在 PowerShell 或终端中使用 `nslookup` 或 `ping` 命令查看域名解析结果，确认域名是否正确。

### 订阅更新后自定义规则丢了怎么办？

这是最经典的"踩坑"场景。如果你是直接修改配置文件来添加规则的，每次订阅更新都会覆盖你的修改。

解决方案很明确：**使用 Clash Verge Rev 的覆写（Override / Script）功能。** 覆写脚本是独立于订阅配置的，订阅更新只替换配置文件本身，不会影响脚本。脚本会在每次加载配置时自动运行，把你的自定义规则注入进去。

如果你使用的客户端不支持覆写功能，替代方案是把自定义规则写成独立的 rule-provider 文件（本地文件），然后在配置中引用。订阅更新如果不覆盖 rule-providers 段和本地文件，规则就能保留。但这取决于具体客户端和订阅转换服务的行为，不如覆写脚本可靠。

### 可以给特定应用设置不同的代理节点吗？

可以，使用 `PROCESS-NAME` 规则。

```yaml
# 微信走直连
- PROCESS-NAME,WeChat.exe,DIRECT
# Chrome 浏览器走代理
- PROCESS-NAME,chrome.exe,Proxy
# Telegram 走专用节点组
- PROCESS-NAME,Telegram.exe,Telegram
# Steam 走游戏节点
- PROCESS-NAME,steam.exe,Gaming
```

**前提条件**：必须开启 TUN 模式。系统代理模式下，代理客户端只能看到来自设置了代理的应用的流量，无法获取进程信息。TUN 模式通过虚拟网卡捕获所有流量，可以识别每个连接的来源进程。

查看进程名的方法：打开任务管理器（Ctrl+Shift+Esc），在"详细信息"标签页中找到目标程序的进程名（"名称"列显示的就是 `PROCESS-NAME` 规则需要的值）。

### DOMAIN 和 DOMAIN-SUFFIX 该用哪个？

绝大多数情况用 `DOMAIN-SUFFIX`。

`DOMAIN-SUFFIX,google.com` 会匹配 `google.com` 本身以及 `www.google.com`、`mail.google.com` 等所有子域名。一个网站通常有很多子域名用于不同的服务（主站、API、CDN、静态资源等），用 `DOMAIN-SUFFIX` 可以一条规则覆盖全部。

`DOMAIN,www.google.com` 只匹配 `www.google.com` 这一个域名。只在你确实需要精确控制某个特定子域名的路由（而让其他子域名走不同的规则）时才使用。

### 规则能用正则表达式吗？

Clash 的标准规则不支持正则表达式。如果你需要基于复杂模式匹配域名，有两个替代方案：

1. **用 `DOMAIN-KEYWORD` 做模糊匹配。** 虽然不是正则，但关键词匹配能覆盖一些简单的模式需求。
2. **用覆写脚本动态生成规则。** 在 JavaScript 脚本中你可以用任何逻辑来生成规则列表，包括正则匹配、字符串操作等，然后将生成的规则注入到配置中。
