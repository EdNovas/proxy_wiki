---
title: NaiveProxy：用 Chromium 网络栈做代理
date: 2026-05-10
updated: 2026-05-10
categories:
  - 协议与原理
tags:
  - NaiveProxy
  - Chromium
  - 协议
  - 抗检测
index_img: /images/posts/naiveproxy.jpg
excerpt: NaiveProxy 直接使用 Chromium 的网络栈，使代理流量与真实 Chrome 浏览器完全一致。理论上最强的抗指纹方案，但实际部署门槛高。
---

> **摘要**：在所有的代理抗检测方案中，NaiveProxy 采用了最"暴力"也最彻底的思路——直接使用 Chromium 浏览器的网络栈来传输代理流量。这意味着代理产生的 TLS 指纹、HTTP/2 行为和连接特征与真实的 Chrome 浏览器完全一致。本文解析 NaiveProxy 的设计理念、工作原理、优劣势以及当前的实际地位。

## 设计哲学：不模拟，而是"就是"

大多数代理协议在面对 TLS 指纹检测时，采用的策略是**模拟**（simulate）。典型的做法是使用 [uTLS](https://github.com/refraction-networking/utls) 库来伪造 TLS Client Hello，让代理的 TLS 握手看起来像是来自 Chrome、Firefox 等真实浏览器。

uTLS 的做法已经相当有效，但它本质上仍然是"模仿"——它复制了 Chrome 的 Client Hello 参数，但底层的网络栈仍然是 Go 语言的 `crypto/tls`。这意味着在 TLS 握手之外的行为（比如 HTTP/2 的帧处理、TCP 参数、连接管理等方面）仍然可能暴露非浏览器的特征。

NaiveProxy 的创造者 klzgrad 提出了一个更激进的思路：**与其模拟浏览器，不如直接使用浏览器本身的网络代码**。

NaiveProxy 的客户端直接基于 Chromium 的网络栈（`net` 模块）构建。它不是在另一个 TLS 库上伪造 Chrome 的指纹，而是直接调用 Chrome 使用的那套网络代码。这样一来，NaiveProxy 产生的流量在以下所有层面都与真实的 Chrome 浏览器一致：

- **TLS 指纹**（JA3/JA4）：完全一致，因为使用的是同一套 TLS 代码（BoringSSL）
- **HTTP/2 行为**：帧大小、流优先级、HPACK 压缩等行为完全一致
- **TCP 参数**：初始窗口大小、拥塞控制行为等由同一套代码控制
- **ALPN 协商**：协议协商过程与 Chrome 相同

用一个类比来说明：uTLS 是"化妆"——戴上面具让外表看起来像另一个人；NaiveProxy 是"克隆"——直接使用那个人的身体。从理论上来说，后者当然更加完美，因为没有什么比"就是它本身"更能通过身份验证了。

## 工作原理

NaiveProxy 的架构分为客户端和服务端两部分。

### 服务端：Caddy + forwardproxy

NaiveProxy 的服务端基于 [Caddy](https://caddyserver.com/) Web 服务器，配合一个特殊的 `forwardproxy` 插件。Caddy 本身是一个功能完善的 Web 服务器，可以正常托管网站内容。`forwardproxy` 插件在 Caddy 的基础上添加了正向代理的功能——经过身份验证的客户端可以通过 Caddy 转发流量。

服务端的配置通过 Caddyfile 完成：

```
:443, your-domain.com
tls your@email.com
route {
  forward_proxy {
    basic_auth user password
    hide_ip
    hide_via
    probe_resistance
  }
  reverse_proxy https://your-camouflage-site.com {
    header_up Host {upstream_hostport}
  }
}
```

这个配置做了以下事情：

1. **Caddy 监听 443 端口**，使用 Let's Encrypt 自动获取 TLS 证书
2. **forward_proxy 插件**提供正向代理功能，需要用户名密码认证
3. **probe_resistance**：当没有正确认证时，返回看起来像普通网站的内容，抵抗主动探测
4. **reverse_proxy**：对未认证的访问者，将请求反向代理到伪装站点

从审查者的角度来看，这台服务器就是一个普通的 HTTPS 网站。只有持有正确凭证的 NaiveProxy 客户端才能激活代理功能。

### 客户端：Chromium 网络栈

NaiveProxy 的客户端是一个经过修改的 Chromium 网络栈。客户端启动后，会在本地开放一个 SOCKS5 或 HTTP 代理端口，上层应用通过这个端口发送流量。客户端收到流量后，使用 Chromium 的网络代码与服务端建立 HTTPS 连接，通过 HTTP/2 CONNECT 方法转发流量。

客户端配置极为简洁：

```json
{
  "listen": "socks://127.0.0.1:1080",
  "proxy": "https://user:password@your-domain.com"
}
```

### 流量路径

完整的流量路径如下：

```
应用程序 → 本地 SOCKS5 → NaiveProxy 客户端 → HTTPS (Chromium 网络栈) → Caddy 服务器 → forward_proxy → 目标网站
```

从网络审查者的视角来看，客户端与服务器之间的通信就是一个普通的 HTTPS 连接——TLS 指纹是真正的 Chrome，HTTP/2 行为是真正的 Chrome，连接模式也符合正常的浏览器访问。

## 优势分析

### 完美的 TLS 指纹

这是 NaiveProxy 最核心的优势。由于直接使用 Chromium 的 BoringSSL，NaiveProxy 产生的 JA3/JA4 指纹与真实的 Chrome 浏览器**完全相同**——不是"几乎相同"或"非常接近"，而是**完全相同**。

对于使用 JA3/JA4 指纹进行流量分类的审查系统来说，NaiveProxy 的流量与正常的 Chrome HTTPS 流量无法区分。

### 超越指纹的一致性

NaiveProxy 的优势不仅限于 TLS 指纹。由于使用了完整的 Chromium 网络栈，以下方面也与 Chrome 一致：

- **HTTP/2 帧行为**：SETTINGS 帧参数、流量控制、HPACK 动态表大小等
- **TCP 行为**：初始拥塞窗口、重传策略等
- **证书验证**：使用 Chromium 自带的证书验证逻辑
- **OCSP 处理**：在线证书状态协议的处理方式

即使审查者开发了比 JA3 更高级的指纹技术（比如分析 HTTP/2 帧序列或 TCP 行为模式），NaiveProxy 也能自然地通过检测。

### 内置的抗主动探测

服务端的 `probe_resistance` 功能提供了对主动探测的防御。当审查者尝试直接连接服务器时，看到的是一个正常的 HTTPS 网站（通过 reverse_proxy 伪装）。只有携带正确认证信息的请求才会被 forward_proxy 处理。

## 劣势与局限

尽管 NaiveProxy 在理论上有着最强的抗检测能力，但它在实际部署中存在多个显著的短板。

### 编译复杂度

这是 NaiveProxy 最大的实际障碍。由于客户端基于 Chromium 网络栈，构建客户端需要编译 Chromium 的部分代码。这不是一个简单的 `go build` 或 `cargo build` 能解决的问题：

- **Chromium 代码库庞大**：即使只编译网络栈部分，源码下载量也在 10GB 以上
- **构建依赖复杂**：需要特定版本的编译器、Python 脚本和系统库
- **编译时间长**：在普通硬件上编译可能需要数小时
- **平台限制**：交叉编译支持有限

虽然 NaiveProxy 项目提供了预编译的二进制文件和 GitHub Actions 构建脚本，但如果 Chromium 更新导致构建失败，修复问题需要对 Chromium 构建系统有深入了解。

服务端同样需要编译一个特殊版本的 Caddy（包含 forwardproxy 插件），不过这比客户端的编译简单得多，可以使用 `xcaddy` 工具完成：

```bash
xcaddy build --with github.com/caddyserver/forwardproxy=github.com/klzgrad/forwardproxy@naive
```

### Chromium 更新的跟进压力

Chrome 大约每四周发布一个新的主要版本。每次更新都可能改变网络栈的行为，包括 TLS 参数、HTTP/2 设置等。NaiveProxy 需要跟进这些更新，否则其 TLS 指纹会逐渐落后于真实的 Chrome 版本，反而可能成为特征。

这给项目维护者带来了持续的压力。如果 NaiveProxy 的 Chromium 版本落后太多，审查者甚至可以通过"这个 TLS 指纹来自一个过时版本的 Chrome"来识别它。

### 资源占用较高

由于嵌入了 Chromium 的网络栈，NaiveProxy 的二进制文件体积和内存占用都明显高于其他代理：

| 代理 | 二进制大小 | 运行内存 |
|------|-----------|---------|
| NaiveProxy | ~15 MB | ~30-50 MB |
| Xray (VLESS) | ~10 MB | ~15-25 MB |
| sing-box | ~15 MB | ~20-35 MB |

虽然在现代设备上这些数字并不算大，但在路由器或低配 VPS 等资源受限的环境中，这可能是一个考虑因素。

### 客户端支持有限

NaiveProxy 的客户端生态远不如 VLESS 或 Trojan 丰富：

- **独立客户端**：只有官方的 naive 命令行工具
- **GUI 客户端**：几乎没有专门的图形化客户端
- **移动端**：Android 上有一些第三方集成，iOS 上支持非常有限
- **代理平台集成**：sing-box 支持 NaiveProxy 协议，但 Clash/mihomo 不支持

这意味着使用 NaiveProxy 通常需要搭配其他代理工具——比如在 sing-box 中配置 NaiveProxy 出站（outbound），或者在系统中设置 SOCKS5 代理指向 NaiveProxy 的本地端口。

### 协议单一

NaiveProxy 本质上就是 HTTPS 代理（HTTP/2 CONNECT）。它不支持 WebSocket、gRPC、QUIC 等多种传输方式。虽然 HTTPS 本身已经足够隐蔽，但在某些需要特殊传输方式的场景（比如 CDN 中转）下，NaiveProxy 的灵活性不如 VLESS+WebSocket 等方案。

## NaiveProxy vs VLESS+Reality

这是一个很有意义的对比——两者都以抗检测为核心目标，但采取了完全不同的技术路线。

| 维度 | NaiveProxy | VLESS+Reality |
|------|-----------|--------------|
| 抗指纹策略 | 使用真实 Chromium 网络栈 | 使用 uTLS 模拟指纹 + 伪装真实站点证书 |
| 指纹完美度 | 完美（就是 Chrome） | 接近完美（uTLS 模拟，极难区分） |
| 部署难度 | 高（需编译 Chromium 组件） | 低（Xray/sing-box 原生支持） |
| 客户端支持 | 有限 | 极为丰富 |
| 维护成本 | 高（需跟进 Chromium 更新） | 低（uTLS 库独立更新） |
| 传输灵活性 | 低（仅 HTTPS） | 高（支持多种传输） |
| CDN 兼容 | 不支持 | 不支持（但 VLESS+WS 可以） |
| 社区活跃度 | 较低 | 很高 |
| 实际被封概率 | 极低 | 极低 |

**关键结论**：在理论的抗检测能力上，NaiveProxy 确实是最强的——没有什么比"就是 Chrome"更完美的伪装。但在实际使用中，VLESS+Reality 的 uTLS 方案已经足够强大，两者被检测到的概率都极低。考虑到 Reality 在部署、维护和客户端支持方面的巨大优势，**对于绝大多数用户来说，Reality 是更实际的选择**。

NaiveProxy 更像是一个"理论最优解"——它证明了"直接使用浏览器网络栈"这条路线是可行的，并且在安全性上确实达到了最高水平。但工程上的代价使得它难以在实际中广泛推广。

## 当前状态与展望

截至 2026 年，NaiveProxy 仍然在活跃开发中，但更新频率和社区活跃度都不如 Xray 和 sing-box。它更多地被定位为一个**小众但可靠的选择**——适合那些对安全性有极致要求、且有能力处理部署复杂度的用户。

NaiveProxy 最大的贡献可能不是作为一个被广泛使用的代理工具，而是它提出的思路——"用真实的浏览器网络栈做代理"——影响了整个代理社区对抗检测技术的思考方式。uTLS 等模拟方案在不断进步，部分原因就是 NaiveProxy 展示了"完美伪装"应该是什么样子。

## 常见问题（FAQ）

### Q1：NaiveProxy 适合普通用户吗？

不太适合。部署和维护的复杂度远高于 VLESS+Reality 或 Trojan 等方案。除非你有特殊的安全需求且具备技术能力，否则建议使用 Reality。

### Q2：sing-box 支持 NaiveProxy 吗？

支持。sing-box 可以配置 NaiveProxy 类型的出站（outbound），这样你可以在 sing-box 的框架内使用 NaiveProxy 协议，同时享受 sing-box 的规则系统和 GUI 客户端。

### Q3：NaiveProxy 会被检测到吗？

理论上极难检测。但要注意，任何代理都可能通过流量模式分析（而非指纹）被识别——比如长时间的大流量单一连接在统计上并不像正常的浏览行为。NaiveProxy 解决的是指纹问题，不能解决流量模式问题。

### Q4：为什么不直接用 Chrome 浏览器做代理？

因为 Chrome 浏览器本身不提供正向代理功能。NaiveProxy 提取了 Chromium 的网络栈，剥离了渲染引擎、JavaScript 引擎等不需要的部分，只保留了网络通信的核心代码。

### Q5：NaiveProxy 的服务端可以和其他服务共存吗？

可以。由于服务端基于 Caddy，你可以在同一台服务器上同时托管网站和运行 NaiveProxy。Caddy 本身就是一个高性能的 Web 服务器，代理功能只是一个插件。

### Q6：forwardproxy 插件和标准 Caddy 的 forwardproxy 一样吗？

不一样。NaiveProxy 使用的是 klzgrad 维护的一个特殊分支，增加了 `probe_resistance`、`hide_ip`、`hide_via` 等安全特性。标准 Caddy 的 forwardproxy 没有这些功能。

## 外部链接

- [NaiveProxy GitHub 仓库](https://github.com/klzgrad/naiveproxy)
- [Caddy 官方网站](https://caddyserver.com/)
- [uTLS 项目](https://github.com/refraction-networking/utls)
- [sing-box NaiveProxy 出站配置](https://sing-box.sagernet.org/configuration/outbound/naive/)

---

*NaiveProxy 代表了代理抗检测技术的理论上限。对于大多数用户来说，它更多的意义在于验证了一种思路，而不是作为日常使用的工具。*
