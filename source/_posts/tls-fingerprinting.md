---
title: "TLS 指纹识别：JA3/JA4 与反检测策略"
date: 2026-05-10
categories:
  - GFW 与审查
tags:
  - TLS
  - JA3
  - JA4
  - 指纹
  - uTLS
  - Reality
excerpt: "TLS 指纹识别是 GFW 检测代理的核心手段。解释 JA3/JA4 原理和主流协议的应对方案。"
index_img: /images/posts/tls-fingerprinting.jpg
---

> **摘要**：TLS 指纹识别是 GFW 检测代理流量的核心手段之一。即使流量内容完全加密，TLS 握手阶段的明文参数也会暴露客户端的身份。本文解释 JA3/JA4 指纹的计算方式、GFW 如何利用它识别代理、以及主流协议的应对策略。

## TLS 握手中暴露了什么

TLS 连接建立时，客户端需要向服务器发送一个 **Client Hello** 消息，这是整个 TLS 握手的第一步。关键在于：这条消息是以**明文**发送的，其中包含了大量描述客户端能力的元数据。

以下是 Client Hello 中携带的关键字段：

1. **支持的 TLS 版本列表**：客户端声明自己支持哪些 TLS 协议版本（如 TLS 1.2、TLS 1.3）。
2. **加密套件（Cipher Suites）列表及顺序**：客户端罗列自己支持的加密算法组合，并且列出的顺序代表了优先级偏好。不同的 TLS 实现对加密套件的选择和排列方式截然不同。
3. **扩展（Extensions）列表及顺序**：TLS 扩展用于协商额外的功能，比如支持的协议、密钥交换方式等。不同客户端携带的扩展种类、数量和排列顺序都各有特征。
4. **支持的椭圆曲线（Supported Groups）**：声明客户端支持哪些椭圆曲线用于密钥交换，例如 x25519、P-256、P-384 等。
5. **签名算法（Signature Algorithms）**：客户端声明自己支持哪些签名算法用于证书验证，例如 ECDSA、RSA-PSS 等。
6. **ALPN（Application-Layer Protocol Negotiation）**：应用层协议协商，告知服务器客户端希望使用的上层协议，如 h2（HTTP/2）或 http/1.1。
7. **SNI（Server Name Indication）**：服务器名称指示，明文告知服务器客户端想要连接的域名。

这些参数的组合是**高度特征化**的。不同的 TLS 库（如浏览器内置的 BoringSSL、Go 语言的 crypto/tls、Python 的 ssl 模块、Java 的 JSSE）会产生截然不同的 Client Hello。就像每个人走路的姿态不同一样，每种 TLS 实现发出的 Client Hello 也带有自己独特的"步态"。审查者只需要观察这个明文的握手消息，就能推断出对方使用的是什么客户端软件——即使后续的所有通信内容都是加密的。

## JA3 指纹是什么

**JA3** 是由 Salesforce 的安全团队在 2017 年提出的一种 TLS 客户端指纹方法。它的核心思路非常直观：从 Client Hello 中提取最具辨识度的字段，拼接成一个字符串，然后计算哈希值作为指纹。

具体而言，JA3 从 Client Hello 中提取以下**五个字段**：

| 字段 | 说明 |
|------|------|
| TLS 版本 | 客户端声明的 TLS 协议版本号 |
| 加密套件（Cipher Suites） | 所有支持的加密套件的编号列表 |
| 扩展（Extensions） | 所有 TLS 扩展的编号列表 |
| 椭圆曲线（Elliptic Curves） | 支持的椭圆曲线编号列表 |
| 椭圆曲线点格式（EC Point Formats） | 支持的椭圆曲线点格式列表 |

JA3 将这五个字段的值按顺序用**逗号**连接成一个长字符串，格式如下：

```
TLSVersion,Ciphers,Extensions,EllipticCurves,ECPointFormats
```

然后对这个字符串取 **MD5 哈希**，得到一个 32 字符的十六进制字符串，即 JA3 指纹。例如：

```
769,47-53-5-10-49161-49162-49171-49172-50-56-19-4,0-10-11,23-24-25,0
→ MD5
→ e7d705a3286e19ea42f587b344ee6865
```

这个指纹的核心价值在于**区分不同的客户端实现**。以下是一些关键的区分能力：

- **Chrome 的 JA3 指纹 ≠ Firefox 的 JA3 指纹**：因为 Chrome 使用 BoringSSL，Firefox 使用 NSS，两者对加密套件和扩展的选择完全不同。
- **浏览器的 JA3 指纹 ≠ Go crypto/tls 的 JA3 指纹**：Go 语言标准库的 TLS 实现有自己独特的参数组合，与任何主流浏览器都不相同。
- **同一浏览器的不同版本指纹也可能不同**：当浏览器升级并添加对新加密算法或新扩展的支持时，其 Client Hello 会随之变化，JA3 指纹也会改变。

简而言之，JA3 指纹就像是 TLS 客户端的一个"身份证号"，虽然不是百分之百唯一，但足以在大多数场景下区分客户端类型。

![数字指纹与加密](/images/inline/matrix-code.jpg)
*图片来源：[Unsplash](https://unsplash.com/)*

## JA4 与 JA3 的区别

**JA4** 是 2023 年由 FoxIO 推出的下一代 TLS 指纹方案，旨在解决 JA3 的若干局限性。

JA3 的主要问题在于：MD5 哈希将所有信息压缩成一个不可读的字符串，丢失了结构信息，且 MD5 本身存在碰撞风险。此外，JA3 仅针对 TCP 上的 TLS 设计，无法覆盖基于 UDP 的 QUIC 协议。

JA4 的改进主要体现在以下几个方面：

- **结构化的指纹格式**：JA4 的指纹不再是一个单一的哈希值，而是由多个有意义的片段组成。格式大致为 `协议类型_TLS版本_SNI标志_加密套件数量_扩展数量_ALPN首选项_加密套件哈希_扩展哈希`。这意味着即使不查表，也能从指纹中直接读出部分信息，例如客户端使用的是 TLS 1.3 还是 1.2，是否携带了 SNI 等。
- **更全面的参数覆盖**：JA4 在计算时考虑了更多的 Client Hello 字段，提供了更精细的区分能力。
- **QUIC/HTTP3 支持**：JA4 明确支持 QUIC 协议中的 Client Hello 指纹提取，而 JA3 对此没有定义。随着 HTTP/3 的普及，这一点变得越来越重要。
- **JA4 指纹族**：JA4 实际上是一个指纹家族，包括 JA4（TLS 客户端）、JA4S（TLS 服务端）、JA4H（HTTP 客户端）、JA4X（X.509 证书）等多个变体，构成了一个完整的流量指纹体系。

对于代理用户来说，JA4 意味着审查者拥有了更精确、更难规避的指纹识别工具。

## 这和代理有什么关系

**核心问题：代理客户端的 TLS 指纹与真实浏览器不同。**

大多数主流代理工具——V2Ray、Xray、Sing-box——都是用 **Go 语言**编写的。Go 语言的标准库 `crypto/tls` 有自己的 TLS 实现，它产生的 Client Hello 在加密套件选择、扩展排列、椭圆曲线偏好等方面与任何主流浏览器都存在明显差异。

这意味着什么？假设你使用 VLESS+TLS 协议连接到一台伪装成 `apple.com` 的服务器。从 GFW 的视角来看：

1. **SNI 显示这是到 apple.com 的连接**——看起来正常。
2. **但 JA3 指纹显示客户端是 Go 程序**——这就不对了。正常用户用浏览器访问 apple.com，不会用 Go 程序。
3. **指纹与 SNI 的矛盾暴露了代理行为**——GFW 可以据此判定这是一条代理连接，进而对该连接进行干扰、限速或封锁。

这就是许多用户容易忽视的一个事实：**"套 TLS" 并不等于 "安全"**。TLS 加密的是握手之后的应用层数据，但握手过程本身（特别是 Client Hello）是明文的。如果你的代理工具使用了一个与浏览器截然不同的 TLS 库，那么 TLS 握手本身就在向审查者宣告："我不是浏览器，我是一个代理程序"。

更具体地说，Go 语言 crypto/tls 的 Client Hello 有几个典型的"泄露点"：

- 加密套件的选择和顺序与浏览器不同
- 携带的 TLS 扩展集合与浏览器不同
- 缺少浏览器特有的 GREASE（Generate Random Extensions And Sustain Extensibility）值
- 椭圆曲线和签名算法的偏好列表与浏览器不同

这些差异对于 GFW 来说是非常容易检测的。

## 各协议的应对方案

### uTLS：模拟浏览器指纹

**[uTLS](https://github.com/refraction-networking/utls)** 是目前最广泛使用的应对方案。它是一个 Go 语言库，核心功能是**手动构造 Client Hello 消息**，使其看起来与特定浏览器的 Client Hello 完全一致。

uTLS 的工作原理并不复杂：它预先收集了各种浏览器（Chrome、Firefox、Safari、Edge 等）在不同版本下的 Client Hello 参数模板。当代理客户端需要发起 TLS 连接时，uTLS 不使用 Go 标准库的默认参数，而是按照选定的浏览器模板来构造 Client Hello，包括完全一致的加密套件列表及顺序、扩展列表及顺序、椭圆曲线选择等。

在 **[Xray-core](https://github.com/XTLS/Xray-core)** 和 **Sing-box** 中，用户可以通过 `fingerprint` 参数来启用 uTLS，并指定要模拟的浏览器类型：

```json
{
  "fingerprint": "chrome"
}
```

可选的值通常包括：`chrome`、`firefox`、`safari`、`edge`、`randomized` 等。

然而，uTLS 也存在一些**局限性**：

- **更新滞后**：浏览器会频繁更新，每次更新都可能改变 Client Hello 参数。uTLS 需要持续跟进浏览器的变化，如果更新不及时，模拟的指纹可能与当前最新版浏览器不一致。
- **GREASE 的模拟难度**：GREASE 是一种由浏览器引入的机制，会在 Client Hello 中随机插入未知的扩展值或加密套件值，以确保服务端实现能正确忽略未知参数。浏览器每次连接时 GREASE 值都会变化，而 uTLS 的 GREASE 实现是否足够随机、是否符合真实浏览器的分布规律，是一个持续存在的挑战。
- **只解决了 Client Hello 的问题**：TLS 握手不只有 Client Hello，还有 Client 在后续阶段的行为（如密钥交换方式、Session Resumption 行为等）。uTLS 主要集中在 Client Hello 层面，对握手的其他阶段覆盖有限。

尽管如此，uTLS 仍然是目前最实用且最易部署的方案，能有效对抗基于 JA3/JA4 的被动指纹检测。

### Reality：从根本上解决问题

**Reality** 协议（由 XTLS 团队开发，集成在 Xray-core 中）采用了一种比 uTLS 更彻底的方法。它的思路不是"模拟浏览器去欺骗审查者"，而是"让审查者看到的就是一个真实的 TLS 连接"。

Reality 的工作流程如下：

1. **客户端使用 uTLS 发送 Client Hello**：客户端首先利用 uTLS 构造一个模拟浏览器指纹的 Client Hello，发送给 Reality 服务端。从 GFW 的角度看，这个 Client Hello 的指纹与真实浏览器一致。
2. **服务端将 Client Hello 转发给真实目标**：Reality 服务端收到 Client Hello 后，将其原封不动地转发给一个预先配置的真实目标网站（例如 `apple.com` 或 `www.microsoft.com`）。
3. **真实目标返回 Server Hello 和证书**：目标网站正常处理这个 Client Hello，返回自己的 Server Hello、真实的 TLS 证书以及完成握手所需的参数。
4. **服务端将真实响应转发给客户端**：Reality 服务端把从目标网站收到的 Server Hello 和证书原样转发给客户端。
5. **切换到代理加密通道**：在 TLS 握手表面上完成后，客户端和服务端之间切换到代理自己的加密通道进行实际数据传输。

这种设计的巧妙之处在于：

- **GFW 看到的是一个完全真实的 TLS 连接**：Client Hello 指纹正常（来自 uTLS），Server Hello 和证书也是真实的（来自目标网站），整个握手过程没有任何可疑之处。
- **主动探测也无法识别**：如果审查者主动连接 Reality 服务端，服务端会直接将其代理到真实目标网站。审查者看到的就是一个正常运行的网站，完全无法判断服务端背后是否运行着代理服务。
- **不需要自己的 TLS 证书**：Reality 服务端不需要申请和维护 TLS 证书，因为它使用的是目标网站的真实证书。这也消除了因证书特征（如 Let's Encrypt 的签发模式）被识别的风险。

Reality 的主要注意事项是目标网站（dest）的选择：应选择支持 TLS 1.3、有 HTTP/2 支持、在目标地区正常可访问且不会频繁变化的大型网站。

![安全加密防护](/images/inline/lock-security.jpg)
*图片来源：[Unsplash](https://unsplash.com/)*

### ECH (Encrypted Client Hello)：未来方向

**[ECH（Encrypted Client Hello）](https://datatracker.ietf.org/doc/draft-ietf-tls-esni/)** 是 TLS 协议层面的一项标准化工作，其设计目的就是**加密 Client Hello 中的敏感字段**，从根本上消除 TLS 握手阶段的信息泄露。

ECH 的基本原理是：服务器预先通过 DNS 记录（HTTPS RR）发布一个公钥，客户端用这个公钥加密 Client Hello 中的敏感部分（称为 Inner Client Hello），只留下一个不包含有用信息的 Outer Client Hello 在明文中传输。服务器收到后用对应私钥解密 Inner Client Hello，获取客户端的真实请求参数。

如果 ECH 得到广泛部署，其影响是深远的：

- **JA3/JA4 指纹将失去大部分价值**：因为审查者只能看到 Outer Client Hello，而 Outer Client Hello 是标准化的，不再携带客户端的特征信息。
- **SNI 也将被加密**：审查者无法知道用户访问的是哪个域名。

然而，ECH 在当前阶段**无法作为可靠的反审查手段**，原因如下：

- **GFW 已经在封锁 ECH**：中国的网络审查系统已经开始检测并阻断携带 ECH 扩展的 TLS 连接。对于审查者来说，如果无法读取 Client Hello 的内容，直接阻断这类连接是最简单的策略。
- **部署范围有限**：虽然 Chrome 和 Firefox 已经在新版本中支持了 ECH，但服务端的部署率仍然较低。ECH 需要 DNS 基础设施（特别是 HTTPS 记录类型）的配合，大规模普及还需要时间。
- **DNS 污染的连锁影响**：ECH 的公钥通过 DNS 分发，而 GFW 有成熟的 DNS 污染能力。如果 DNS 查询无法返回正确的 ECH 公钥，客户端就无法启用 ECH。

因此，ECH 代表的是一个正确的长期方向，但短期内用户仍然需要依赖 uTLS 和 Reality 等方案来应对 TLS 指纹检测。

## 实践：如何检查自己的指纹

理论之外，用户应当亲自验证自己的代理连接是否存在指纹泄露问题。以下是几种实用的检测方法：

### 方法一：使用在线检测工具

1. **直接用浏览器访问 [ja3er.com](https://ja3er.com/)**，记录页面显示的 JA3 指纹值。这是你浏览器的真实指纹。
2. **通过代理访问同一网站**，记录此时显示的 JA3 指纹值。这是你的代理客户端呈现给服务器的指纹。
3. **对比两个指纹**：
   - 如果两者一致或非常接近，说明 uTLS 模拟成功，你的代理连接在 JA3 层面与浏览器无法区分。
   - 如果两者明显不同，说明你的代理连接携带了非浏览器指纹，存在被识别的风险。

### 方法二：使用 Wireshark 抓包分析

对于需要更详细分析的用户，可以使用 [Wireshark](https://www.wireshark.org/) 在本地抓包：

1. 启动 Wireshark，开始捕获网络流量。
2. 在过滤器中输入 `tls.handshake.type == 1` 过滤 Client Hello 消息。
3. 展开 Client Hello 的详细信息，逐一检查 Cipher Suites、Extensions、Supported Groups 等字段。
4. 对比代理连接的 Client Hello 与直接浏览器连接的 Client Hello，观察是否存在差异。

### 方法三：使用命令行工具

一些开源工具可以直接计算和展示 TLS 指纹，例如使用 `curl` 配合支持 JA3 输出的代理服务器，或者使用专门的 TLS 指纹分析工具如 `ja3` 和 `ja4` 的开源实现。

如果检测结果显示指纹不匹配，应检查代理客户端的配置，确保 `fingerprint` 参数已正确设置且选择了合适的浏览器指纹模板。

## 常见问题

### Q: uTLS 选哪个浏览器指纹最好？

推荐选择 **Chrome**。原因很简单：Chrome 在全球浏览器市场中占据最高的份额（超过 60%）。选择 Chrome 指纹意味着你的 TLS 连接在统计上看起来最"普通"，不会因为使用了一个罕见的浏览器指纹而引起注意。相比之下，选择 Safari 或 Firefox 虽然也能工作，但这些浏览器的市场份额较低，如果某个 IP 地址同时发起了大量看起来来自 Safari 的连接，在统计分析中可能显得异常。此外，Chrome 指纹在 uTLS 中的维护也最为积极，通常能最快跟进新版本的变化。

### Q: 不配置 fingerprint 参数会怎样？

如果不显式配置 `fingerprint` 参数，代理客户端将使用 **Go 语言原生的 crypto/tls 库**发起 TLS 连接。这意味着你的连接会携带一个典型的 Go 程序指纹，与任何主流浏览器都不相同。对于 GFW 的 TLS 指纹检测系统来说，这几乎等于在明文告诉审查者"我是一个 Go 语言程序"。在当前的网络审查环境下，不配置 fingerprint 参数是一个显著的安全隐患，强烈建议所有使用 TLS 类协议的用户都明确设置此参数。

### Q: JA3 指纹可以完全伪造吗？

技术上可以通过 uTLS **完全伪造** JA3 指纹。uTLS 允许逐字段地构造 Client Hello，理论上可以精确复制任何浏览器的参数组合。但"完美度"取决于几个因素：uTLS 库中浏览器指纹模板的更新是否及时、GREASE 等随机化机制的模拟是否足够真实、以及 TLS 握手后续阶段的行为是否与浏览器一致。在实践中，uTLS 对 JA3 指纹的模拟已经足够欺骗目前已知的大多数检测系统，但不能排除未来出现更精细的检测手段（例如结合 JA3 之外的握手行为特征进行综合分析）。
