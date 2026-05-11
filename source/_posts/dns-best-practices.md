---
title: 各客户端 DNS 配置最佳实践
date: 2026-05-10
categories:
  - DNS 专题
tags:
  - DNS
  - 配置
  - Clash
  - Surge
  - Shadowrocket
  - 最佳实践
excerpt: 各主流客户端的推荐 DNS 配置，以及最常见的 DNS 配置错误——Fake-IP 下不要配置 fallback。
index_img: /images/posts/dns-best-practices.png
---

> **摘要**：DNS 配置是科学上网中最容易出错、也最影响体验的环节。配置不当会导致 DNS 泄漏（暴露访问意图）、解析失败（网页打不开）、或国内网站变慢（走了错误的 CDN 节点）。本文给出各主流客户端的推荐 DNS 配置，并解释每个参数背后的原理。

---

## 先理解问题：为什么 DNS 这么麻烦

使用代理时，DNS 解析存在一个根本矛盾：

- **国内域名**需要用国内 DNS 解析，才能获得最近的 CDN 节点
- **国外域名**不能用国内 DNS 解析，否则会被污染（返回错误 IP）
- **代理客户端**需要判断一个域名走直连还是走代理，但判断本身可能依赖 DNS 结果

举一个具体的例子来理解这个矛盾。假设你访问 `google.com`：

1. 系统需要先把 `google.com` 解析为 IP 地址
2. 如果用国内 DNS（比如 114.114.114.114）去解析，GFW 会返回一个被污染的假 IP
3. 代理客户端拿到这个假 IP，可能无法正确判断它应该走代理
4. 即使判断对了，这个假 IP 也无法真正建立连接

反过来，如果所有域名都用海外 DNS 解析：

1. `taobao.com` 这样的国内域名也会去海外 DNS 查询
2. 返回的 CDN 节点可能是美国或香港的服务器
3. 你直连访问这个海外节点，速度自然很慢

这个三角矛盾是所有 DNS 配置复杂性的根源。而 Fake-IP 模式的出现，正是为了从根本上解决这个矛盾。

---

## Fake-IP vs Redir-Host

理解这两种模式是配置 DNS 的前提。

### Fake-IP 模式（推荐）

**工作原理**：

Fake-IP 的核心思路是：**先不做真正的 DNS 解析，而是立即返回一个假的 IP 地址，等确定了路由策略后再做真实解析**。具体流程如下：

1. **拦截 DNS 请求**：当应用程序（比如浏览器）请求解析 `google.com` 时，代理客户端的内置 DNS 服务器会拦截这个请求
2. **立即返回假 IP**：客户端不会去查询任何上游 DNS，而是从一个预设的 IP 段（通常是 `198.18.0.0/16`）中分配一个假 IP 返回给应用。比如返回 `198.18.0.5`
3. **应用发起连接**：浏览器拿到 `198.18.0.5` 后，向这个地址发起 TCP 连接。由于代理客户端在 TUN 层或系统代理层会拦截所有流量，这个连接会被客户端捕获
4. **反查原始域名**：客户端维护了一张 Fake-IP 到域名的映射表，通过 `198.18.0.5` 反查出原始域名 `google.com`
5. **匹配分流规则**：拿到域名后，客户端根据规则列表判断 `google.com` 应该走代理还是直连
6. **走代理的域名**：客户端把域名（而非 IP）发送给远端代理节点，由节点在当地做真实 DNS 解析并建立连接。这样解析出的 IP 是距离节点最近的 CDN 地址，延迟最低
7. **走直连的域名**：客户端在本地用配置的国内 DNS（如腾讯 DoH、阿里 DoH）做真实解析，拿到正确的国内 CDN 节点 IP，然后直连

**优势**：

- **解析速度快**：DNS 请求在本地立即返回，不需要等待任何上游 DNS 的网络往返，应用几乎感受不到 DNS 延迟
- **彻底避免 DNS 泄漏**：走代理的域名，其真实 DNS 解析发生在远端节点，国内 DNS 服务器完全看不到你访问了哪些国外域名
- **规则匹配准确**：分流判断基于域名（`google.com`），而非 IP 地址。域名匹配不会受到 DNS 污染的影响，规则命中率高
- **避免 DNS 污染影响**：由于走代理的域名根本不在本地做 DNS 解析，GFW 的 DNS 污染完全不起作用

**注意事项**：

- **Fake-IP 缓存问题**：部分应用（尤其是一些游戏和即时通讯软件）可能会缓存之前获得的 Fake-IP（如 `198.18.x.x`）。当你关闭代理后，应用仍然尝试连接这个不存在的假 IP，导致连接失败。解决方法是关闭代理后重启相关应用，或者清除系统 DNS 缓存（Windows 下执行 `ipconfig /flushdns`）
- **fake-ip-filter 配置**：某些服务不能使用 Fake-IP，必须返回真实 IP 才能正常工作。常见的包括：
  - **局域网设备发现**：如 mDNS、SSDP 等协议依赖真实 IP 进行设备发现（`*.local`、`*.lan`）
  - **NTP 时间同步**：时间同步服务需要真实的服务器 IP（`time.*.com`、`ntp.*.com`）
  - **Windows 网络连接检测**：Windows 会通过特定域名检测网络是否可用（`*.msftconnecttest.com`）
  - **STUN 协议**：WebRTC 等需要 STUN 服务器的场景需要真实 IP（`+.stun.*.*`）

### Redir-Host 模式

**工作原理**：

与 Fake-IP 不同，Redir-Host 模式下客户端会真正执行 DNS 解析：

1. 客户端拦截到 DNS 请求后，会向上游 DNS 服务器发起真实查询
2. 拿到真实 IP 后，代理客户端用这个 IP 来匹配分流规则（比如通过 GeoIP 判断 IP 归属地）
3. 根据匹配结果决定走代理还是直连

**问题**：

- **DNS 污染导致误判**：如果用国内 DNS 解析 `google.com`，得到的是被 GFW 污染的假 IP（通常指向不存在的地址或国内的某个 IP）。代理客户端拿到这个假 IP，可能错误地判断为"国内 IP → 直连"，导致无法访问
- **需要复杂的 fallback 配置**：为了解决污染问题，Redir-Host 模式需要配置 fallback DNS（通常是海外 DNS），当主 DNS 返回的结果被判定为可疑时，使用 fallback 的结果。这套机制（fallback + fallback-filter + geoip 判断）配置复杂且容易出错
- **解析延迟更高**：每次 DNS 请求都需要等待真实解析完成，如果配置了 fallback，还可能触发并行查询，进一步增加延迟
- **存在 DNS 泄漏风险**：即使走代理的域名，其 DNS 查询也发生在本地，国内 DNS 服务器能看到你在查询 `google.com`

**结论**：除非有特殊需求（比如某些必须依赖真实 IP 进行分流的场景），2026 年应该统一使用 Fake-IP 模式。Fake-IP 在速度、安全性和配置简便性上全面优于 Redir-Host。

---

## Clash Meta / Clash Verge 配置

Clash Meta（[mihomo](https://github.com/MetaCubeX/mihomo) 内核）是目前桌面端使用最广泛的代理客户端之一，[Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) 则是其最流行的图形界面。下面是推荐的 DNS 配置。

### 推荐配置

```yaml
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false  # 除非你的网络完整支持 IPv6，否则建议关闭
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  
  # ⚠️ 关键：Fake-IP 模式下只需要 nameserver，不需要 fallback
  nameserver:
    - https://doh.pub/dns-query        # 腾讯 DoH
    - https://dns.alidns.com/dns-query  # 阿里 DoH
  
  # Fake-IP 过滤：这些域名返回真实 IP
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - '*.localhost'
    - 'dns.msftncsi.com'
    - 'www.msftncsi.com'
    - '*.msftconnecttest.com'
    - 'time.*.com'
    - 'ntp.*.com'
    - '+.stun.*.*'
    - '+.stun.*.*.*'
    - 'localhost.ptlogin2.qq.com'
    - 'lens.l.google.com'
```

**配置说明**：

- `listen: 0.0.0.0:1053`：DNS 服务监听端口。如果仅本机使用，可以改为 `127.0.0.1:1053`；如果作为局域网网关（比如软路由），则需要监听 `0.0.0.0`
- `ipv6: false`：关闭 IPv6 DNS 解析。大多数用户的网络环境不支持完整的 IPv6 链路，开启可能导致部分连接异常或 DNS 泄漏（详见下文 IPv6 章节）
- `enhanced-mode: fake-ip`：使用 Fake-IP 模式，这是关键配置项
- `fake-ip-range: 198.18.0.1/16`：Fake-IP 分配的地址段，使用默认值即可。这是一个保留地址段，不会与实际网络冲突
- `nameserver`：上游 DNS 服务器。这里只需要配置国内 DNS，因为在 Fake-IP 模式下，只有直连域名才会真正触发 DNS 解析。推荐使用 DoH（DNS over HTTPS）来防止 DNS 请求被运营商劫持


### 最常见的配置错误

**不要在 Fake-IP 模式下配置 fallback 和 fallback-filter。**

这是大陆用户遇到的**最高频 DNS 配置错误**，没有之一。让我详细解释为什么：

**错误的根源**：网上大量流传的 Clash DNS 配置教程是从 Redir-Host 时代直接复制过来的。在 Redir-Host 模式下，确实需要 fallback 来解决 DNS 污染问题——当 nameserver（国内 DNS）返回被污染的结果时，用 fallback（海外 DNS）的结果来纠正。但在 Fake-IP 模式下，这套机制完全多余。

**为什么多余**：在 Fake-IP 模式下，`nameserver` 只负责解析**直连域名**——也就是那些匹配了直连规则（如 `GEOSITE,cn,DIRECT`）的域名。这些域名本来就是国内域名（如 `baidu.com`、`taobao.com`），用国内 DNS 解析是正确的，根本不存在被污染的问题。走代理的域名（如 `google.com`）则根本不会触发本地 DNS 解析，它们的域名直接发送给远端代理节点处理。

**加了 fallback 的后果**：

1. **增加不必要的延迟**：每次直连域名的 DNS 解析，都会同时向 nameserver 和 fallback 发起查询，然后等待 fallback-filter 的判断逻辑执行完毕。这对于本来就应该秒回的国内域名解析来说，是纯粹的性能浪费
2. **可能引发 DNS 泄漏**：fallback 通常配置的是海外 DNS（如 `8.8.8.8`、`1.1.1.1`），部分国内域名的查询会被发送到这些海外 DNS，造成不必要的信息泄漏
3. **配置更复杂，更容易出错**：fallback-filter 的 `geoip`、`geosite`、`ipcidr` 等过滤条件，增加了配置的复杂度和出错概率

**正确的做法**：在 Fake-IP 模式下，删掉所有 `fallback` 和 `fallback-filter` 相关配置，只保留 `nameserver`，填入可靠的国内 DNS（推荐[腾讯 DNSPod DoH](https://www.dnspod.cn/) 或[阿里 DNS DoH](https://alidns.com/)）。

---

## Shadowrocket 配置

Shadowrocket 是 iOS 平台上最主流的代理客户端之一，操作界面简洁，DNS 配置也相对简单。

### 推荐配置

1. 打开 Shadowrocket → 设置 → DNS
2. **DNS 服务器**：填入 `system`（使用系统 DNS）或手动指定国内 DNS，如 `https://doh.pub/dns-query`
3. **备用 DNS**：可留空。在 Fake-IP 模式下不需要配置海外 DNS 作为备用
4. **代理 DNS 解析**（Proxy DNS）：开启。这是关键选项，确保走代理的域名由远端节点进行 DNS 解析，避免本地 DNS 污染影响
5. **Fake-IP**：如果使用的是较新版本的 Shadowrocket 且支持 Fake-IP 模式，建议开启

### 注意事项

- Shadowrocket 默认使用 `system` DNS，即跟随系统的 DNS 设置。在大多数场景下，这是最简单且有效的配置——系统 DNS 通常是运营商分配的国内 DNS，解析国内域名速度快且准确
- 开启"代理 DNS 解析"后，所有命中代理规则的域名都会通过代理服务器进行远端 DNS 解析。这等效于 Fake-IP 中"走代理的域名由远端节点处理"的逻辑
- 如果遇到国内域名变慢的情况，检查分流规则是否把国内域名错误地归入了代理组。Shadowrocket 的规则匹配优先级是从上到下的，确保国内直连规则在前

---

## Surge 配置

Surge 是 iOS 和 macOS 平台上功能最完善的代理客户端，DNS 配置方式与 Clash 有一定差异。

### 推荐配置

在 Surge 的配置文件 `[General]` 段中添加以下内容：

```ini
[General]
dns-server = 223.5.5.5, 119.29.29.29
doh-server = https://dns.alidns.com/dns-query, https://doh.pub/dns-query
always-real-ip = %APPEND% *.lan, *.local, time.*.com, ntp.*.com, *.msftconnecttest.com
hijack-dns = *:53
```

### 配置说明

- **dns-server**：传统 DNS 服务器，作为 DoH 不可用时的回退。填入阿里 DNS（223.5.5.5）和腾讯 DNS（119.29.29.29）
- **doh-server**：DoH 服务器地址。Surge 会优先使用 DoH 进行解析，保证 DNS 请求本身不被运营商劫持或篡改
- **always-real-ip**：功能等同于 Clash 的 `fake-ip-filter`，这些域名始终返回真实 IP 而非 Fake-IP。Surge 使用 `%APPEND%` 语法表示在默认列表基础上追加
- **hijack-dns**：劫持所有发往 53 端口的 DNS 请求，确保即使应用硬编码了 DNS 服务器（如 `8.8.8.8:53`），也会被 Surge 接管

### 与 Clash 的主要区别

1. **DNS 策略更加自动化**：Surge 的 DNS 处理逻辑更多是内置的，不需要用户手动选择 Fake-IP 还是 Redir-Host。Surge 4+ 默认的行为已经类似 Fake-IP 的逻辑
2. **hijack-dns 功能**：Surge 原生支持 DNS 劫持功能，可以强制接管所有 DNS 流量，这在 Clash 中需要配合 TUN 模式或 iptables 才能实现
3. **配置语法不同**：Surge 使用 INI 风格的配置文件，而 Clash 使用 YAML 格式。虽然语法不同，但核心理念一致——国内域名用国内 DNS，代理域名由远端解析

---


## 特殊场景

### 透明代理（OpenWrt / 软路由）下的 DNS

在软路由上运行透明代理（如 OpenClash、Passwall、ShellCrash）时，DNS 配置比客户端本机使用更为复杂，因为你需要确保局域网内所有设备的 DNS 请求都被正确处理。

**DNS 劫持方式**：

透明代理有两种主要的 DNS 劫持方式：

- **redirect（DNAT）**：通过 iptables 的 NAT 规则，将所有发往 53 端口的 UDP/TCP 流量重定向到 Clash 的 DNS 监听端口。这是最常用的方式，配置简单，兼容性好。示例规则：`iptables -t nat -A PREROUTING -p udp --dport 53 -j REDIRECT --to-port 1053`
- **tproxy（透明代理）**：使用 TPROXY 目标将流量透明转发，不修改数据包的目标地址。相比 redirect，tproxy 保留了原始目标信息，某些情况下可以实现更精确的处理。但配置更复杂，需要内核支持和额外的路由规则

**dnsmasq 与 Clash DNS 的配合**：

OpenWrt 默认使用 dnsmasq 作为 DNS 服务。在部署透明代理后，推荐的配合方式是：

1. 将 dnsmasq 的上游 DNS 指向 Clash 的 DNS 监听地址（如 `127.0.0.1#1053`）
2. 局域网设备的 DHCP 分配的 DNS 指向路由器本身（dnsmasq）
3. DNS 请求链路为：设备 → dnsmasq → Clash DNS → 实际处理（Fake-IP 返回 / 上游查询）

这样既保留了 dnsmasq 的缓存和本地域名解析功能，又确保所有外部域名经过 Clash 的 Fake-IP 处理。

**硬编码 DNS 问题**：

这是透明代理下最容易被忽略的问题。部分设备和应用会绕过系统分配的 DNS，直接向硬编码的 DNS 地址发起查询：

- Google 设备（Chromecast、Google Home）默认使用 `8.8.8.8`
- 部分 Android 手机的 Private DNS 功能会直接连接 DoT 服务器
- 某些 IoT 设备和智能电视内置了固定的 DNS 地址

解决方法是在 iptables 中添加强制劫持规则，将所有发往外部 53 端口的流量都重定向到 Clash DNS：

```bash
# 劫持所有外发的 DNS 请求（排除路由器本身发出的）
iptables -t nat -A PREROUTING -p udp --dport 53 -j REDIRECT --to-port 1053
iptables -t nat -A PREROUTING -p tcp --dport 53 -j REDIRECT --to-port 1053
```

对于使用 DoH/DoT 的设备（如 Android Private DNS），由于流量走的是 443/853 端口而非 53 端口，上述规则无法劫持。需要在防火墙层面屏蔽这些设备对外部 DoH/DoT 服务器的访问，迫使它们回退到普通 DNS。

### IPv6 环境

**是否建议开启 IPv6 DNS**：

一般建议关闭，理由如下：

1. **双栈泄漏风险**：即使代理正确处理了 IPv4 流量，如果设备同时拥有 IPv6 地址，某些应用可能优先通过 IPv6 直连访问目标网站，完全绕过代理。这会导致严重的隐私泄漏
2. **路由规则不完善**：很多规则集对 IPv6 地址的覆盖不如 IPv4 完善。GeoIP 数据库对 IPv6 地址段的归属判断准确度也低于 IPv4
3. **运营商支持参差不齐**：国内各地运营商的 IPv6 部署进度不同，很多用户的 IPv6 链路实际上并不稳定，开启后可能出现间歇性连接问题

**推荐做法**：

- 在代理客户端中将 `ipv6` 设为 `false`
- 如果使用软路由，可以在防火墙层面禁止 IPv6 DNS 请求外发
- 只有在确认自己的网络完整支持 IPv6，且代理规则覆盖了 IPv6 地址的情况下，才考虑开启

---

## 诊断方法

当怀疑 DNS 有问题时，按以下步骤系统排查：

### 第一步：查看客户端日志

打开 Clash 的日志页面（Clash Verge 中点击日志按钮），将日志级别调整为 `debug`。观察以下信息：

- DNS 请求发向了哪个上游服务器
- 解析结果是什么（真实 IP 还是 Fake-IP）
- 分流规则是否正确匹配

### 第二步：确认分流规则命中

在日志中查找目标域名，确认它命中了哪条规则。常见问题：

- 国内域名错误匹配到了代理规则 → 走了代理节点访问，速度慢
- 国外域名错误匹配到了直连规则 → 本地 DNS 解析被污染，无法访问

### 第三步：手动 DNS 查询对比

使用系统自带的 DNS 查询工具进行独立验证：

```powershell
# Windows 下使用 nslookup
nslookup google.com 223.5.5.5
nslookup google.com 8.8.8.8

# 或使用 dig（需安装）
dig google.com @223.5.5.5
dig google.com @8.8.8.8
```

对比两个 DNS 返回的结果：如果国内 DNS 返回的 IP 明显不合理（如 `127.0.0.1` 或某些不相关的国内 IP），说明该域名被 DNS 污染了。在 Fake-IP 模式下这不会影响代理域名，但如果你在使用 Redir-Host 模式，这就是问题的根源。

### 第四步：检测 DNS 泄漏

访问 [dnsleaktest.com](https://dnsleaktest.com) 或 [browserleaks.com/dns](https://browserleaks.com/dns)，点击 Extended Test。如果结果中出现了国内 DNS 服务器的地址，说明存在 DNS 泄漏——你访问国外网站的 DNS 请求被国内 DNS 看到了。

### 第五步：验证 CDN 节点

如果国内网站变慢，使用以下方法检查 CDN 节点是否正确：

```powershell
# 查看域名解析到的 IP
nslookup cdn.example.com

# 查询该 IP 的归属地
# 可以访问 ipinfo.io/IP地址 或 ip.sb 查看
```

如果一个国内域名的 CDN 解析到了海外 IP，说明 DNS 配置有误——可能是走了海外 DNS 解析，或者规则错误地将该域名归入了代理组。

---

## 常见问题

### Q: 用了代理后国内网站反而变慢了？

最常见的原因是 DNS 解析到了错误的 CDN 节点。具体来说：

- 国内域名的 DNS 查询走了海外 DNS 服务器，返回了距离海外节点最近的 CDN IP
- 或者国内域名错误地匹配到了代理规则，DNS 解析发生在代理节点所在地区

**解决方法**：确保直连域名只使用国内 DNS 解析。在 Fake-IP 模式下，检查 `nameserver` 是否只配置了国内 DNS（腾讯 DoH、阿里 DoH 等）。同时检查分流规则，确保 `GEOSITE,cn` 或对应的国内域名规则匹配到 `DIRECT`。

### Q: 为什么有些网站打不开但浏览器没报错？

这种"无声失败"通常有两种原因：

1. **Fake-IP 缓存残留**：之前代理开启时访问过某个域名，浏览器或系统缓存了它的 Fake-IP（`198.18.x.x`）。关闭代理后，浏览器仍然尝试连接这个假 IP，导致连接超时但不会显示明确的错误信息。解决方法：清除浏览器缓存和系统 DNS 缓存（`ipconfig /flushdns`）
2. **DNS 解析超时**：上游 DNS 服务器响应缓慢或不可达，导致解析超时。客户端可能会静默失败而不返回错误页面。检查日志中的 DNS 超时记录，尝试更换上游 DNS 服务器

### Q: DoH 和 DoT 选哪个？

**推荐使用 DoH（DNS over HTTPS）**。

两者都是加密 DNS 协议，作用相同——防止 DNS 请求被中间人窃听或篡改。区别在于：

| 对比项 | DoH | DoT |
|--------|-----|-----|
| 端口 | 443（与 HTTPS 网页流量共用） | 853（专用端口） |
| 伪装性 | 高，与普通 HTTPS 流量混在一起，难以区分 | 低，使用专用端口，容易被识别和封锁 |
| 封锁难度 | 高，封锁 443 端口等于封锁整个互联网 | 低，直接封锁 853 端口即可 |
| 性能 | 略高开销（HTTP/2 头部） | 略低开销 |

在国内网络环境下，DoT 的 853 端口已经被部分运营商封锁或限速。而 DoH 使用 443 端口，与正常的 HTTPS 网页访问流量完全一致，运营商几乎不可能单独封锁，因此实际可用性更高。
