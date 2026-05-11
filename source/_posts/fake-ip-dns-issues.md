---
title: Fake-IP 模式下的 DNS 问题排查
date: 2026-05-10
updated: 2026-05-10
categories:
  - 排障手册
tags:
  - Fake-IP
  - DNS
  - 排障
  - Clash
  - 配置
index_img: /images/posts/fake-ip-dns-issues.png
excerpt: Fake-IP 模式虽然是推荐方案，但也可能遇到特定问题——关闭代理后网页打不开、部分应用异常、局域网设备发现失败等。
---

> **摘要**：Fake-IP 是目前主流代理客户端推荐的 DNS 处理模式，它通过返回假 IP 地址来避免 DNS 泄漏和污染问题。然而，正因为"假 IP"的机制，它也会引入一些特有的问题——关闭代理后网页打不开、某些应用无法正常工作、局域网设备发现失败等。本文逐一分析这些问题的根因，并提供明确的解决方案。

---

## 问题一：关闭代理后网页打不开

### 症状

使用 Fake-IP 模式的代理客户端（如 Clash、Mihomo 等）正常工作时一切正常，但关闭代理后，部分或全部网页无法加载，浏览器显示连接超时或 DNS 解析失败。重启浏览器后可能恢复，但有时需要等待较长时间才能正常上网。

### 原因分析

问题出在 DNS 缓存上。Fake-IP 模式下，代理客户端对 DNS 请求返回的是 `198.18.x.x` 段的假 IP 地址。操作系统和浏览器都会缓存 DNS 解析结果。当你关闭代理后：

1. 操作系统的 DNS 缓存中仍然保留着 `google.com → 198.18.0.5` 这样的假映射
2. 浏览器尝试连接 `198.18.0.5`，但这个地址是代理客户端的虚拟地址段，代理关闭后不再有程序监听
3. 连接超时，网页无法加载

浏览器自身也有 DNS 缓存（Chrome 有独立的 DNS cache），这使得问题更加顽固——即使操作系统的 DNS 缓存被清除，浏览器缓存中的假 IP 仍可能导致连接失败。

### 解决方案

**方法一：清除系统 DNS 缓存**

关闭代理后，立即清除操作系统的 DNS 缓存：

```bash
# Windows
ipconfig /flushdns

# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches
```

**方法二：清除浏览器 DNS 缓存**

在 Chrome 中访问 `chrome://net-internals/#dns`，点击"Clear host cache"清除浏览器内部的 DNS 缓存。Firefox 等浏览器也有类似的内部页面。

**方法三：配置代理客户端在退出时自动清除缓存**

部分 Clash 客户端（如 Clash Verge Rev）支持在关闭时自动刷新系统 DNS 缓存。在客户端设置中查找相关选项并启用。

**方法四：使用 TUN 模式的 auto-redir 功能**

部分客户端在 TUN 模式下会在关闭时自动恢复系统网络配置，包括清理 DNS 缓存。确保使用 TUN 模式而非系统代理模式，可以减少此问题的发生。

---

## 问题二：部分应用无法正常工作

### 症状

开启 Fake-IP 模式后，大多数应用正常，但某些特定应用出现异常：无法登录、功能不完整、或者直接报错。常见的问题应用包括：部分游戏客户端、某些企业 VPN、物联网设备配套 APP、部分银行类应用等。

### 原因分析

这些应用需要获取目标域名的**真实 IP 地址**才能正常工作。原因各异：

- **游戏客户端**：某些游戏使用 IP 地址做连接验证或 P2P 匹配，假 IP 导致验证失败或无法匹配到玩家
- **企业 VPN**：VPN 客户端可能验证 DNS 解析结果与预期 IP 范围是否匹配，假 IP 不在预期范围内
- **物联网 APP**：设备发现协议依赖本地网络的真实 IP 通信
- **银行 APP**：安全检测机制可能检查 DNS 解析结果的合理性

### 解决方案

将这些应用所使用的域名添加到 `fake-ip-filter` 列表中。被列入 `fake-ip-filter` 的域名不会返回假 IP，而是进行真实的 DNS 解析。

```yaml
# Clash / Mihomo 配置
dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    # 特定应用域名
    - "*.battlenet.com"
    - "*.blizzard.com"
    - "+.stun.*.*"
    - "+.stun.*.*.*"
    - "lens.l.google.com"
    - "*.n]intendoserver.net"
    - "*.srv.nintendo.net"
    - "*.stun.playstation.net"
    - "+.sonyentertainmentnetwork.com"
```

**如何确定哪些域名需要加入 filter？**

1. 在代理客户端的日志中查找该应用的 DNS 请求记录
2. 将该应用的相关域名逐一添加到 `fake-ip-filter`
3. 测试应用是否恢复正常

---

## 问题三：局域网设备发现失败

### 症状

开启 Fake-IP 模式后，无法在局域网中发现其他设备。例如：AirPlay 找不到 Apple TV、Chromecast 投屏失败、NAS 无法在文件管理器中显示、打印机搜索不到等。

### 原因分析

局域网设备发现依赖的协议（如 mDNS/Bonjour、SSDP/UPnP）使用特定的域名后缀（`.local`、`.lan` 等）。在 Fake-IP 模式下，这些域名的 DNS 请求也被拦截并返回了假 IP，导致设备发现协议无法正常工作。

具体来说：

- **mDNS**（多播 DNS）使用 `.local` 后缀进行局域网设备发现。当 `.local` 域名被返回假 IP 后，设备间的通信被破坏
- **SSDP** 使用组播地址 `239.255.255.250` 进行设备发现，虽然不直接走 DNS，但部分实现可能依赖 DNS 解析
- **NetBIOS** 和 **LLMNR** 是 Windows 环境下的局域网名称解析协议，同样受到 Fake-IP 干扰

### 解决方案

将局域网相关的域名后缀添加到 `fake-ip-filter`：

```yaml
dns:
  fake-ip-filter:
    # 局域网设备发现
    - "*.local"
    - "*.lan"
    - "*.home.arpa"
    - "*.localdomain"
    - "+.local"
```

---

## 问题四：Windows 显示"无 Internet 连接"

### 症状

开启 Fake-IP 代理后，Windows 任务栏的网络图标显示"无 Internet 连接"（出现一个小地球或黄色感叹号），但实际上网页可以正常访问。部分应用因为检测到系统报告"无网络"而拒绝联网。

### 原因分析

Windows 通过 NCSI（Network Connectivity Status Indicator）机制检测网络连接状态。NCSI 会访问特定的微软域名来判断是否有 Internet 连接：

- `www.msftconnecttest.com` — HTTP 连接测试
- `dns.msftncsi.com` — DNS 解析测试
- `ipv6.msftconnecttest.com` — IPv6 连接测试

在 Fake-IP 模式下，这些域名被返回了假 IP。Windows 的 NCSI 模块尝试连接假 IP，连接失败或返回非预期内容，于是判定"没有 Internet 连接"。

### 解决方案

将微软的网络连接检测域名添加到 `fake-ip-filter`：

```yaml
dns:
  fake-ip-filter:
    # Windows 网络连接检测
    - "*.msftconnecttest.com"
    - "*.msftncsi.com"
    - "www.msftconnecttest.com"
    - "www.msftncsi.com"
    - "ipv6.msftconnecttest.com"
    
    # macOS / iOS 网络连接检测
    - "captive.apple.com"
    - "*.apple.com.cn"
    
    # Android 网络连接检测
    - "connectivitycheck.gstatic.com"
    - "connectivitycheck.android.com"
    - "clients3.google.com"
```

同样的问题也会出现在 macOS（访问 `captive.apple.com` 检测）和 Android（访问 `connectivitycheck.gstatic.com` 检测）上，一并加入 filter 即可。

---

## 问题五：NTP 时间同步异常

### 症状

系统时间出现偏差，或者手动触发时间同步时失败。在严重情况下，时间偏差可能导致 TLS 证书验证失败（证书的有效期基于时间判断），进而引发代理连接异常。

### 原因分析

NTP（Network Time Protocol）客户端通过域名解析来找到时间服务器的 IP 地址。常见的 NTP 域名如 `time.windows.com`、`ntp.aliyun.com` 等。Fake-IP 模式返回假 IP 后，NTP 客户端尝试与假 IP 同步时间，自然会失败。

更关键的是，NTP 使用 UDP 协议，而 Fake-IP 的假 IP 映射在 TUN 模式下主要处理 TCP 流量。UDP 到假 IP 的数据包通常会被直接丢弃。

### 解决方案

```yaml
dns:
  fake-ip-filter:
    # NTP 时间同步
    - "time.*.com"
    - "time.*.gov"
    - "time.*.edu.cn"
    - "time.*.apple.com"
    - "time-ios.apple.com"
    - "time-macos.apple.com"
    - "ntp.*.com"
    - "ntp.aliyun.com"
    - "pool.ntp.org"
    - "*.pool.ntp.org"
    - "time.windows.com"
```

---

## 问题六：游戏 P2P 联机问题

### 症状

某些依赖 P2P（点对点）连接的在线游戏无法正常联机。玩家可能看到"NAT 类型严格"的提示，或者直接无法与其他玩家匹配。

### 原因分析

P2P 联机需要通过 STUN（Session Traversal Utilities for NAT）服务器来检测自身的 NAT 类型和公网地址。STUN 请求需要获取服务器的真实 IP 地址，并且使用 UDP 协议通信。Fake-IP 返回的假 IP 无法用于 STUN 协议。

此外，某些游戏平台（如任天堂在线服务）会验证 STUN 返回的 IP 地址与实际连接 IP 的一致性，假 IP 会导致验证失败。

### 解决方案

```yaml
dns:
  fake-ip-filter:
    # STUN 服务器
    - "+.stun.*.*"
    - "+.stun.*.*.*"
    - "+.stun.*.*.*.*"
    - "stun.*.*"
    - "stun.*.*.*"
    
    # 游戏平台
    - "*.n]intendoserver.net"
    - "*.srv.nintendo.net"
    - "*.stun.playstation.net"
    - "+.sonyentertainmentnetwork.com"
    - "+.battlenet.com.cn"
    - "+.wargaming.net"
```

---

## 调试方法

当遇到 Fake-IP 相关的未知问题时，以下调试方法可以帮助定位原因。

### 启用 Clash 调试日志

在 Clash 配置文件中将日志级别设置为 `debug`：

```yaml
log-level: debug
```

然后在日志中搜索问题应用发起的 DNS 请求。如果看到某个域名被分配了 `198.18.x.x` 的地址，而该域名本应返回真实 IP，就找到了问题所在。

### 检查 DNS 解析路径

使用 `nslookup` 或 `dig` 在代理开启和关闭时分别查询同一域名：

```bash
# 代理开启时查询
nslookup example.com 127.0.0.1

# 如果返回 198.18.x.x，说明这个域名走了 Fake-IP
# 如果需要真实 IP，就应该加入 fake-ip-filter
```

### 使用 Clash Dashboard 查看

大多数 Clash 客户端都提供了 Dashboard（控制面板），其中可以查看实时的 DNS 查询记录和连接日志。通过 Dashboard 可以直观地看到哪些域名被分配了假 IP、哪些走了真实解析。

---

## 完整 fake-ip-filter 模板

以下是一个经过实践验证的完整 `fake-ip-filter` 配置模板，涵盖了上述所有场景：

```yaml
dns:
  enable: true
  listen: 0.0.0.0:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    # === 局域网 / 设备发现 ===
    - "*.local"
    - "*.lan"
    - "*.home.arpa"
    - "*.localdomain"
    
    # === 系统网络连接检测 ===
    # Windows
    - "*.msftconnecttest.com"
    - "*.msftncsi.com"
    # macOS / iOS
    - "captive.apple.com"
    # Android
    - "connectivitycheck.gstatic.com"
    - "connectivitycheck.android.com"
    
    # === NTP 时间同步 ===
    - "time.*.com"
    - "time.*.gov"
    - "time.*.edu.cn"
    - "time.*.apple.com"
    - "time-ios.apple.com"
    - "time-macos.apple.com"
    - "ntp.*.com"
    - "ntp.aliyun.com"
    - "pool.ntp.org"
    - "*.pool.ntp.org"
    - "time.windows.com"
    
    # === STUN / P2P ===
    - "+.stun.*.*"
    - "+.stun.*.*.*"
    - "+.stun.*.*.*.*"
    - "stun.*.*"
    - "stun.*.*.*"
    
    # === 游戏平台 ===
    - "*.srv.nintendo.net"
    - "*.stun.playstation.net"
    - "+.sonyentertainmentnetwork.com"
    - "+.battlenet.com.cn"
    
    # === 其他需要真实 IP 的服务 ===
    - "lens.l.google.com"
    - "+.nflxvideo.net"
    - "*.mcdn.bilivideo.cn"
```

---

## 常见问题（FAQ）

### Fake-IP 模式和 Redir-Host 模式该选哪个？

绝大多数场景推荐 Fake-IP。它速度更快（DNS 请求本地即返回，无需等待上游解析）、更安全（走代理的域名不会在本地做 DNS 解析，避免 DNS 泄漏）、规则匹配更准确。Redir-Host 只在极少数对真实 IP 有强依赖且 fake-ip-filter 无法覆盖的场景中才需要考虑。详见 [Fake-IP vs Redir-Host 详解](/posts/fake-ip-vs-redir-host/)。

### fake-ip-filter 加太多条目会影响性能吗？

不会有明显影响。filter 列表的匹配是高效的字符串匹配操作，即使有几百条规则，对性能的影响也可以忽略不计。但 filter 中的域名会走真实 DNS 解析，增加这些域名的首次访问延迟。

### 198.18.0.0/16 这个地址段会和我的网络冲突吗？

通常不会。`198.18.0.0/15` 是 RFC 2544 定义的基准测试保留地址段，正常网络不会使用。但如果你的环境中确实使用了这个地址段（极少见），可以在配置中修改 `fake-ip-range` 为其他未使用的私有地址段，如 `28.0.0.1/8`。

### 为什么加入 filter 后某些域名还是返回假 IP？

可能的原因：配置文件中 filter 的通配符写法不正确（注意 `*` 和 `+` 的区别：`*` 匹配任意字符，`+` 在 Clash 中匹配一级或多级子域名）；配置修改后没有重启客户端或重新加载配置；浏览器或系统的 DNS 缓存中仍然保留了旧的假 IP 记录。

### 可以对所有域名都不使用 Fake-IP 吗？

技术上可以——把 enhanced-mode 设为 redir-host 就是这个效果。但这样做会失去 Fake-IP 的所有优势。更合理的做法是保持 Fake-IP 模式，只把确实需要真实 IP 的域名加入 filter。

### TUN 模式和 Fake-IP 必须一起使用吗？

不是必须的，但推荐一起使用。TUN 模式接管系统全部流量，配合 Fake-IP 可以实现最完善的 DNS 防泄漏。如果使用系统代理模式，部分应用可能绕过代理直接发起 DNS 查询，Fake-IP 对这些查询不生效。详见 [DNS 最佳实践](/posts/dns-best-practices/)。

---

## 外部参考

- [Fake-IP vs Redir-Host 详解](/posts/fake-ip-vs-redir-host/) — 两种 DNS 模式的深入对比
- [DNS 配置最佳实践](/posts/dns-best-practices/) — 各客户端的 DNS 推荐配置
- [Clash Meta Wiki](https://wiki.metacubex.one/) — Clash Meta 官方文档
- [RFC 2544](https://datatracker.ietf.org/doc/html/rfc2544) — 198.18.0.0/15 地址段的定义
