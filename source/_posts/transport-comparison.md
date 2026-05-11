---
title: WebSocket / gRPC / HTTP/2 / XHTTP 传输层对比
date: 2026-05-10
updated: 2026-05-10
categories:
  - 协议与原理
tags:
  - WebSocket
  - gRPC
  - HTTP/2
  - XHTTP
  - 传输层
  - CDN
index_img: /images/posts/transport-comparison.png
excerpt: 代理协议需要传输层承载数据。WebSocket、gRPC、HTTP/2、XHTTP 各有特点——哪个适合过 CDN？哪个伪装最强？
---

> **摘要**: 代理协议（VLESS、VMess 等）负责认证和数据封装，但最终数据需要通过某种传输方式送达服务器。WebSocket、gRPC、HTTP/2、XHTTP 是当前最常用的四种传输层方案。本文从 CDN 兼容性、性能表现、流量伪装能力和部署复杂度四个维度进行对比分析，帮助你在不同场景下做出合理选择。

## 协议层与传输层：先分清两件事

很多新手在配置节点时会混淆"协议"和"传输层"这两个概念，觉得选了 VLESS 就够了，或者把 WebSocket 当成一种独立的代理方案。实际上，代理技术栈是分层设计的，搞清楚每一层做什么事情，才能理解为什么存在这么多排列组合。

**协议层**——也就是 VLESS、VMess、Trojan 这些——负责的是身份认证和数据封装。简单说，协议层决定了"客户端怎么证明自己的身份"以及"数据包按什么格式打包"。VLESS 用 UUID 做认证，VMess 用 UUID + 时间戳校验，Trojan 用密码哈希。协议层本身不关心数据最终是怎么送到服务器的。

**传输层**——WebSocket、gRPC、HTTP/2、XHTTP、TCP 直连——负责的是数据包的实际传输方式。传输层决定了代理流量在网络上"看起来像什么"：是一个 WebSocket 长连接，还是一系列普通 HTTP 请求，还是一个 gRPC 调用。传输层直接影响三件事：能不能过 CDN、流量特征是否容易被识别、连接效率高不高。

一个完整的节点配置通常是 **协议 + 传输层 + 安全层** 的组合。例如 `VLESS + WebSocket + TLS` 表示用 VLESS 协议封装数据，通过 WebSocket 传输，外层套 TLS 加密；`VLESS + TCP + Reality` 表示用 VLESS 协议通过 TCP 直连传输，安全层用 Reality。不同的组合适用于不同的网络环境和安全需求，下面逐一分析每种传输方式的特点。

## TCP 直连

TCP 直连是最基础的传输方式——客户端与服务器之间建立一条原始的 TCP 连接，代理数据直接在这条连接上传输，中间没有任何额外的协议封装。

**优势**非常直观：没有中间层意味着最低的性能开销。数据不需要经过 WebSocket 帧封装、HTTP/2 多路复用处理或 gRPC 编码，直接走 TCP 流，延迟最低、吞吐量最大。对于追求极致性能的场景（游戏加速、实时通信），TCP 直连是最优解。

**局限**同样明显：TCP 直连不经过任何 HTTP 层，因此**无法使用 CDN 中转**。这意味着客户端必须直连服务器 IP，一旦 IP 被封，节点就失效了。此外，裸 TCP 流量如果不搭配 TLS 或 Reality，特征非常明显。

TCP 直连目前最常见的搭配是 **VLESS + TCP + Reality**。Reality 在 TLS 层提供了极强的伪装能力，加上 vision flow 控制解决 TLS-in-TLS 特征问题，这个组合在直连场景下几乎是最优解——高性能、高隐蔽性，唯一的代价是不支持 CDN 中转。如果你的服务器 IP 稳定、线路质量好，这就是首选。

## WebSocket (WS)

WebSocket 是代理领域最成熟、生态最完善的传输方式。它的工作原理是：客户端先发一个标准的 HTTP Upgrade 请求，将连接从 HTTP 协议"升级"为 WebSocket 协议，之后双方就可以在这条连接上进行全双工通信。

**CDN 支持是 WebSocket 最大的卖点**。[Cloudflare](https://www.cloudflare.com/) 完美支持 WebSocket 代理，这意味着你可以将服务器藏在 CDN 后面——客户端连接的是 Cloudflare 的边缘节点，再由 Cloudflare 转发到你的源站。这带来两个好处：一是服务器真实 IP 完全隐藏，即使域名被识别，更换 CDN 配置即可恢复，不需要换服务器；二是可以利用 CDN 的全球节点网络优化访问路径。

**但 WebSocket 有一个不可忽视的隐蔽性弱点**：HTTP Upgrade 头。每个 WebSocket 连接建立时都会发送 `Connection: Upgrade` 和 `Upgrade: websocket` 这两个 HTTP 头。虽然正常的 Web 应用也使用 WebSocket（在线聊天、实时推送、协作编辑等），但审查系统可以通过统计特定 IP 上 WebSocket 连接的比例、连接持续时间、数据传输模式等特征来做二次判断。一个看起来是普通网站但 WebSocket 连接占比极高的域名，显然不太正常。

**性能方面**，WebSocket 引入了帧封装的开销。每个数据片段都需要被包装成 WebSocket 帧（包含操作码、掩码、长度等元数据），这在高吞吐量场景下会带来一定的 CPU 和带宽开销。不过对于大多数日常使用来说，这个开销可以忽略。

WebSocket 的客户端支持极为广泛——几乎所有主流代理客户端（Clash、Clash.Meta、sing-box、v2rayN、Shadowrocket、Quantumult X 等）都支持 WS 传输。这使得 WS 成为面向最终用户最友好的传输方式。

## gRPC

gRPC 是 Google 开发的远程过程调用框架，底层基于 HTTP/2 协议。在代理场景中使用 gRPC 传输，数据会被封装为 gRPC 请求在 HTTP/2 连接上传输。

gRPC 继承了 HTTP/2 的多路复用能力——多个代理连接可以共享同一条底层 TCP 连接，减少了握手次数和连接管理开销。同时，gRPC 原生支持流式传输（streaming），天然适合代理这种需要持续双向数据传输的场景。

**CDN 支持方面**，部分 CDN 服务商支持 gRPC 代理。Cloudflare 支持 gRPC，但需要在控制面板中手动开启 gRPC 支持选项，且在稳定性上不如 WebSocket——某些边缘情况下可能出现连接中断或超时的问题。其他 CDN 服务商对 gRPC 的支持参差不齐。

**隐蔽性方面**，gRPC 有一个明显的特征：它的 HTTP 请求固定使用 `content-type: application/grpc` 这个头部。虽然 gRPC 在微服务架构中非常流行，但一个普通的个人网站域名大量传输 gRPC 流量仍然不太自然。审查系统可以通过这个 content-type 快速标记可疑流量进行进一步分析。

**部署复杂度**中等。gRPC 需要 TLS 支持，配置上比 WebSocket 略复杂，但远不如 XHTTP。客户端支持良好，主流客户端基本都已支持 gRPC 传输。

## HTTP/2 (H2)

HTTP/2 传输是指直接使用 HTTP/2 协议来承载代理数据，而不通过 WebSocket Upgrade 或 gRPC 封装。代理数据作为 HTTP/2 的请求/响应体直接传输。

HTTP/2 最大的技术优势是**原生多路复用**。与 HTTP/1.1 的"一问一答"模式不同，HTTP/2 允许在同一条 TCP 连接上同时传输多个独立的数据流（stream），且不同流之间互不阻塞。这对代理场景意味着：多个并发请求可以共享一条连接，减少 TCP 握手次数，降低延迟。HTTP/2 还支持头部压缩（HPACK），减少了重复 HTTP 头带来的带宽浪费。

**但 HTTP/2 传输有一个硬性要求：必须使用 TLS**。虽然 HTTP/2 协议规范允许明文传输（h2c），但实际应用中几乎所有浏览器和 CDN 都只支持基于 TLS 的 HTTP/2（h2）。这意味着你必须有域名和 TLS 证书，或者搭配 Reality。

**CDN 兼容性方面**，HTTP/2 传输目前的 CDN 支持有限。大多数 CDN 的反向代理行为是在边缘节点终止 HTTP/2 连接，然后以 HTTP/1.1 回源——这会破坏代理的传输机制。因此 HTTP/2 传输通常用于直连场景，不走 CDN。

**隐蔽性**尚可。HTTP/2 流量本身非常常见（大量网站已经使用 HTTP/2），没有像 WebSocket 的 Upgrade 头或 gRPC 的特殊 content-type 那样的显眼标记。但持续的长连接和特定的流量模式仍然可能被统计分析识别。

## XHTTP

XHTTP 是 [Xray-core](https://github.com/XTLS/Xray-core) 引入的新型传输方式，设计目标是实现最强的流量伪装能力。它的核心思路是：**将代理数据伪装为完全标准的 HTTP 请求和响应，不使用任何特殊的协议标记**。

与 WebSocket 需要 Upgrade 头、gRPC 需要特殊 content-type 不同，XHTTP 产生的流量就是普通的 HTTP 请求——GET、POST、PUT 等标准方法，标准的 HTTP 头部，标准的响应格式。对于网络中间设备（防火墙、DPI、CDN）而言，XHTTP 产生的流量与正常网站的 API 调用或文件上传下载没有区别。

XHTTP 支持多种工作模式来适应不同场景。上行数据通过一系列独立的 HTTP 请求发送，下行数据可以通过长轮询、分块传输（chunked encoding）或 Server-Sent Events（SSE）等标准 HTTP 机制接收。每一种模式都是完全合法的 HTTP 行为，不引入任何非标准特征。

**搭配 Reality 使用时**，XHTTP 的伪装效果达到最强——外层 TLS 借用真实网站证书，内层 HTTP 请求完全标准，整个流量链路在审查者看来就是对某个真实网站的正常 API 访问。同时 XMUX 提供连接多路复用支持，优化了连接管理效率。

**代价**也很明显：XHTTP 的部署复杂度在所有传输方式中最高。需要理解多种工作模式的差异、合理配置上下行参数、处理可能的超时问题。客户端支持方面，目前主要由 Xray 生态（v2rayN、v2rayNG 等）和 [sing-box](https://github.com/SagerNet/sing-box) 提供支持，iOS 端支持尚不完善。

## 对比总览

| 维度 | TCP 直连 | WebSocket | gRPC | HTTP/2 | XHTTP |
|------|---------|-----------|------|--------|-------|
| CDN 支持 | 不支持 | 完美支持 | 部分支持 | 有限 | 取决于模式 |
| 性能 | 最优 | 良好 | 良好 | 良好 | 中等 |
| 流量伪装 | 依赖 Reality | 有 Upgrade 特征 | 有 gRPC 特征 | 较好 | 最强 |
| 部署复杂度 | 简单 | 简单 | 中等 | 中等 | 复杂 |
| 客户端支持 | 全面 | 全面 | 广泛 | 广泛 | 有限 |
| 典型搭配 | VLESS+Reality | VLESS/VMess+TLS | VLESS+TLS | VLESS+TLS | VLESS+Reality |

> 说明："CDN 支持"指能否将流量通过 CDN（如 Cloudflare）中转以隐藏源站 IP。"流量伪装"指审查系统区分代理流量与正常流量的难度。

## 怎么选：三种典型场景

决策其实不复杂，抓住核心需求即可：

### 场景一：需要 CDN 中转

如果你的服务器 IP 容易被封、需要频繁更换，或者希望利用 CDN 隐藏源站，**WebSocket 是当前最稳妥的选择**。Cloudflare 的免费方案就能用，配置简单，客户端全面支持。gRPC 虽然也能过 Cloudflare CDN，但稳定性和兼容性不如 WS，不建议作为首选。

推荐组合：`VLESS + WebSocket + TLS + Cloudflare CDN`

### 场景二：直连，追求性能与隐蔽性平衡

如果你的服务器 IP 稳定、线路质量好、不需要 CDN 中转，**TCP + Reality 是最优解**。零额外封装开销，Reality 提供顶级伪装，vision flow 解决 TLS-in-TLS 特征。这是当前最主流的直连方案。

推荐组合：`VLESS + TCP + Reality (vision)`

### 场景三：极端隐蔽需求

在高强度审查环境下，或者你需要最强的流量伪装能力，**XHTTP + Reality** 是目前的天花板。代价是部署复杂度高、客户端选择有限，但伪装效果无出其右。

推荐组合：`VLESS + XHTTP + Reality + XMUX`

### 决策速查

```
需要 CDN 中转？
├── 是 → WebSocket + TLS + CDN
├── 否 →
│   ├── 追求性能？ → TCP + Reality
│   ├── 追求最强伪装？ → XHTTP + Reality
│   └── 需要 HTTP/2 多路复用？ → H2 + TLS / gRPC + TLS
```

## 常见问题

### Q: WebSocket 的 Upgrade 特征会不会导致被封？

目前来看，单纯的 WebSocket 流量不会被直接封锁——互联网上有大量合法的 WebSocket 应用。但审查系统可能将 WebSocket 作为二次检测的触发条件之一。如果担心这个特征，可以考虑 XHTTP 作为替代。

### Q: gRPC 和 HTTP/2 传输有什么区别？

gRPC 是建立在 HTTP/2 之上的应用层框架，会添加 `application/grpc` content-type 和 gRPC 特有的帧格式。HTTP/2 传输则是直接使用 HTTP/2 协议，没有 gRPC 的额外封装。从隐蔽性角度看，纯 HTTP/2 更好；从功能成熟度角度看，gRPC 的流式传输机制更完善。

### Q: XHTTP 能过 CDN 吗？

取决于具体的工作模式。XHTTP 在某些模式下产生的是标准 HTTP 请求，理论上可以通过支持对应方法的 CDN。但这方面的实践还在探索阶段，稳定性和兼容性不如 WebSocket。如果 CDN 中转是刚需，目前仍建议使用 WebSocket。

### Q: 可以在同一台服务器上同时部署多种传输方式吗？

可以，而且推荐这样做。一台服务器可以同时监听 TCP 直连（Reality）、WebSocket（CDN 中转）等多种传输方式，客户端根据网络环境选择合适的连接方式。这样在某种传输方式被干扰时可以快速切换。

### Q: 哪种传输方式延迟最低？

TCP 直连延迟最低，因为没有任何额外协议封装。WebSocket 和 HTTP/2 次之，引入了帧封装但开销有限。经过 CDN 中转的方案延迟取决于 CDN 节点位置，可能更高也可能更低（如果 CDN 节点比直连路径更优）。

## 延伸阅读

- [Xray 官方文档 - 传输层配置](https://xtls.github.io/) — 各传输方式的详细配置参数和示例
- [Cloudflare](https://www.cloudflare.com/) — 最常用的免费 CDN 服务，支持 WebSocket 和 gRPC 代理
- [sing-box](https://github.com/SagerNet/sing-box) — 新一代通用代理平台，支持多种传输方式
