---
title: "Shadowsocks 2022 与 ShadowTLS：老协议的现代化改造"
date: 2026-10-19
updated: 2026-10-19
categories:
  - 协议与原理
tags:
  - Shadowsocks
  - ShadowTLS
  - 协议
  - 加密
  - 抗检测
  - Sing-box
excerpt: "Shadowsocks 2022 用定长密钥、时间戳和盐值过滤补上了旧版的重放与主动探测缺口，但它仍是全加密协议；ShadowTLS 借真实网站完成 TLS 握手给它套上外壳。本文对照规范与实现，讲清两者的设计、组合配置与局限。"
index_img: /images/posts/ss2022-shadowtls.svg
---

> **摘要**：Shadowsocks 是最早流行的代理协议之一，旧版的流加密和 AEAD 方案先后暴露出完整性、重放和主动探测方面的问题。Shadowsocks 2022（下文简称 SS-2022，规范编号 SIP022）把研究者提出的防御建议写进了规范：定长的预共享密钥、BLAKE3 派生会话密钥、基于时间戳和盐值的重放过滤、带会话 ID 的 UDP 设计，以及用于多用户的可扩展身份头（EIH）。但它仍然是一个「全加密协议」，被动识别的风险并没有因此消失，于是有了 ShadowTLS 这类先借真实网站完成 TLS 握手、再切换成代理数据的外层方案。本文逐条对照规范与 sing-box、mihomo 等实现，讲清两者的原理、ShadowTLS 从 v1 到 v3 的演进、它与 REALITY 的异同、最小配置示例，以及什么时候更适合选别的方案。

---

## 旧版 Shadowsocks 留下的问题

Shadowsocks 的设计哲学是「只加密、不伪装」：客户端和服务端共享一个密钥，连接里的每个字节都是密文，没有任何明文协议头。在 2022 版之前，它经历过两代加密方案：

| 代际 | 典型方法 | 密钥来源 | 主要问题 |
|------|---------|---------|---------|
| 流加密（Stream） | `aes-256-cfb`、`chacha20-ietf` | 任意口令，经 OpenSSL 的 `EVP_BytesToKey` 推导 | 只有机密性、没有完整性，密文可被篡改；2020 年公开的一类攻击表明服务端可能被当作「解密预言机」利用 |
| AEAD | `aes-128-gcm`、`chacha20-ietf-poly1305` | 同上，再用 HKDF-SHA1 派生会话子密钥 | 有了完整性校验，但规范没有规定重放防护，各实现对异常输入的反应也不统一 |
| 2022 版（AEAD-2022） | `2022-blake3-aes-128-gcm` 等 | 必须是随机生成的定长密钥 | 见下一节 |

真正让旧版 Shadowsocks 陷入被动的，是 GFW 的主动探测。2020 年 IMC 会议论文《How China Detects and Blocks Shadowsocks》记录了一个两阶段流程：先根据连接首个数据包的长度和熵做被动筛选，再向可疑服务器发送探测——有把截获的首包原样或改动几个字节后重放的，也有随机长度的探测包。研究者在实验期间记录到 5 万多次探测，来自约 1.2 万个中国境内 IP；重放最快在原始连接后不到 1 秒就出现，最慢的隔了 570 小时，说明截获的数据可以被保存很久。服务端对这些探测的反应只要和正常连接有差别（比如在某个固定长度处断开、回 RST 还是 FIN），就会暴露身份。

论文给出的防御建议可以归纳为三条：

1. **只用带认证的 AEAD 加密**，淘汰流加密；
2. **用时间戳加 nonce 记录做重放过滤**，这样服务端不必无限期保存历史；
3. **出错时保持一致的反应**，不要因为输入长度或内容不同而表现不同。

触发节点封锁的其他条件见 [为什么你的节点会被封](/posts/node-blocking-causes/)，GFW 整体的检测层次见 [GFW 工作原理全解](/posts/gfw-detection-overview/)。接下来会看到，Shadowsocks 2022 几乎就是把这三条建议逐条写进了规范。

---

## SS-2022 的设计：把防御建议写进规范

Shadowsocks 2022 版的规范是 SIP022（AEAD-2022 Ciphers），多用户扩展是 SIP023（Extensible Identity Headers），两者都发布在 shadowsocks.org。下面按模块拆开看。

### 加密方法与密钥长度

| 方法名 | 密钥 / 盐长度 | 规范地位 | 支持 EIH 多用户 |
|-------|-------------|---------|---------------|
| `2022-blake3-aes-128-gcm` | 16 字节 | 必须实现 | 是 |
| `2022-blake3-aes-256-gcm` | 32 字节 | 必须实现 | 是 |
| `2022-blake3-chacha20-poly1305` | 32 字节 | 可选，面向没有 AES 硬件指令的 CPU | 否 |
| `2022-blake3-chacha12-poly1305`、`2022-blake3-chacha8-poly1305` | 32 字节 | 可选，减轮版本 | 否 |

实现层面，sing-box、Xray、mihomo 都支持两个 AES 方法和 `2022-blake3-chacha20-poly1305`；减轮的 chacha8 只在 shadowsocks-rust 等少数实现里见到；Surge 的文档只列出两个 AES 方法。EIH 多用户在 shadowsocks-rust 和 sing-box 的源码里都只对两个 AES 方法开放。所以从兼容性看，两个 AES 方法是最稳妥的选择。现代 x86 与大多数 ARMv8 处理器带 AES 硬件加速，性能通常不是问题；如果跑在没有 AES 指令的设备上（如部分软路由、树莓派 4），可以考虑 `2022-blake3-chacha20-poly1305`，但这时不能使用 EIH 多用户。

和旧版最大的区别是：**「密码」不再是密码，而是密钥**。旧版允许填任意字符串，再推导出密钥；SIP022 明确要求密钥是 base64 编码、长度与方法严格对应的随机字节，并规定实现「不得」再从口令派生密钥，包括 `EVP_BytesToKey`。会话子密钥改用 BLAKE3 的密钥派生模式计算：上下文字符串为 `shadowsocks 2022 session subkey`，输入是「密钥 + 盐」，取代了旧版的 HKDF-SHA1。

### 生成密钥

下面三种方式任选其一，长度按上表填写（AES-128 填 16，AES-256 和 ChaCha20 填 32）：

```bash
# OpenSSL：SIP022 规范中给出的方法
openssl rand -base64 16

# sing-box 自带的随机数生成器
sing-box generate rand --base64 16

# shadowsocks-rust：按方法名自动选择长度
ssservice genkey -m "2022-blake3-aes-128-gcm"
```

16 字节密钥会得到 24 个字符、以 `==` 结尾的字符串，32 字节则是 44 个字符。几点注意：

- **长度要严格对应**：密钥短于要求时实现会直接报错；个别实现能接受更长的密钥，但为了跨实现兼容，请按方法生成正确长度；
- **密钥就是全部凭证**：拿到密钥就能使用节点，不要贴进公开群聊、截图或提交到代码仓库；
- **一台服务器一个密钥**：多台服务器共用同一个密钥，一处泄露就全部暴露。

### TCP：定长头、时间戳与盐值过滤

一条 SS-2022 TCP 连接的结构如下（每个加密块后面都跟着 16 字节的认证标签）：

```text
客户端 → 服务端
[盐 16 / 32 B]
[定长头：类型 1 B | 时间戳 8 B | 变长头长度 2 B]
[变长头：地址类型 | 目标地址 | 端口 2 B | 填充长度 2 B | 填充 0–900 B | 首段数据]
[长度块][数据块][长度块][数据块] ……

服务端 → 客户端
[盐 16 / 32 B]
[定长头：类型 1 B | 时间戳 8 B | 请求方的盐 16 / 32 B | 长度 2 B]
[数据块][长度块][数据块] ……
```

逐项看它解决了什么：

1. **定长头**。服务端读一个已知长度的块就能完成认证。规范要求盐和定长头一次写出、一次读入，避免通过分包大小泄露结构；认证失败时，服务端不得暴露自己读取了多少字节，这直接针对按长度逐步试探的探测方式。规范还提醒不要在仍有未读数据时直接关闭套接字（那会发出 RST），并给出了几种统一的关闭策略。
2. **时间戳**。客户端在定长头里写入当前 Unix 时间，服务端发现与本机时间相差**超过 30 秒**，就按重放处理。
3. **盐值过滤**。服务端必须把收到的盐保存 60 秒，按「先解密、再校验时间戳、最后查盐」的顺序处理，并且禁止使用布隆过滤器这类可能误判的结构。为什么是 60 秒？时间戳已经把有效窗口限制在前后各 30 秒之内：窗口之外的重放被时间戳挡住，窗口之内的重放被盐值挡住，服务端不需要无限期保存历史——这正是前面提到的「时间戳加 nonce」组合。
4. **响应绑定请求**。服务端的响应头里带着客户端这次请求的盐，客户端能确认响应确实属于自己这条连接，录下来的响应无法挪到别的连接里重放。
5. **填充**。请求如果没有携带首段数据，客户端必须加入非零长度的随机填充，避免出现长度固定的「空请求」；服务端必须拒绝既没有数据也没有填充的请求。
6. **更大的数据块**。单个数据块上限从旧版 AEAD 的 0x3FFF（16383 字节）提高到 65535 字节，减少分块开销。

### 时钟同步：最常见的「连不上」

30 秒容差意味着**客户端和服务端的系统时间都必须基本准确**。电脑和手机一般会自动对时，问题多出在 VPS、软路由和长时间离线的设备上。典型症状是配置完全正确，连接却直接失败，服务端日志里出现时间戳错误——sing-box 的报错形如 `bad timestamp: received …, diff …s`。

Linux 服务器上检查与开启对时：

```bash
# 查看时间与同步状态，关注 System clock synchronized 一行
timedatectl status

# 启用系统对时（需要 systemd-timesyncd 或 chrony 之类的服务）
sudo timedatectl set-ntp true

# 使用 chrony 时，查看与上游时间源的偏差
chronyc tracking
```

如果设备确实无法通过系统对时，sing-box 内置了 NTP 客户端：在配置顶层加入 `ntp` 段并启用后，它会把校准后的时间提供给 TLS、Shadowsocks 等对时间敏感的协议，默认每 30 分钟同步一次。

```json
"ntp": {
  "enabled": true,
  "server": "time.apple.com",
  "server_port": 123,
  "interval": "30m"
}
```

### UDP：会话 ID 与包 ID

旧版 Shadowsocks 的 UDP 是「每个包独立加密」，服务端只能按来源地址区分会话。SS-2022 给 UDP 设计了一个 16 字节的独立头：

| 字段 | 长度 | 作用 |
|------|------|------|
| 会话 ID（Session ID） | 8 字节 | 客户端随机生成，标识一个 UDP 会话 |
| 包 ID（Packet ID） | 8 字节 | 从 0 开始递增的计数器，用于防重放 |

这 16 字节用预共享密钥做一次 AES 分组加密，包体则用「密钥 + 会话 ID」派生出的子密钥做 AES-GCM 加密。这样设计带来三个好处：

- **按会话路由**：服务端根据客户端会话 ID 而不是来源地址找到会话，并记录最近一次通过校验的客户端地址。手机在 Wi-Fi 和移动网络之间切换时，UDP 会话可以延续；
- **滑动窗口防重放**：每个会话维护一个滑动窗口，重复或过旧的包 ID 会被丢弃，只有通过头部校验后才更新窗口；
- **双向会话 ID**：服务端也有自己的会话 ID，规范禁止把客户端会话 ID 复用为服务端会话 ID；中继会话至少保留 60 秒。

ChaCha20 方法的 UDP 走另一套构造：直接用预共享密钥做 XChaCha20-Poly1305 加密，每个包带一个 24 字节的随机 nonce，会话 ID 和包 ID 移进加密后的主头部。

### 多用户：EIH 可扩展身份头

旧版 Shadowsocks 做多用户，只能「一个端口一个密码」，或者让服务端挨个密钥去试解密。SIP023 引入了**可扩展身份头**（Extensible Identity Headers，EIH）：

1. 服务端有一个身份密钥（iPSK），每个用户有自己的用户密钥（uPSK），长度都与方法要求一致；
2. 客户端用「iPSK 与盐派生的身份子密钥」，对「uPSK 的 BLAKE3 哈希的前 16 字节」做一次 AES 加密，作为身份头放在盐后面；
3. 服务端解开身份头，在哈希表里查到对应用户，再用该用户的密钥处理后续数据。

客户端的密码因此写成用冒号拼接的形式：`服务端身份密钥:用户密钥`。规范还允许多级中继，写成 `iPSK0:iPSK1:uPSK` 这样的链，每一层只认识下一层的身份。sing-box 服务端写法如下：

```json
{
  "type": "shadowsocks",
  "tag": "ss-in",
  "listen": "::",
  "listen_port": 8388,
  "method": "2022-blake3-aes-128-gcm",
  "password": "服务端身份密钥（16 字节 base64）",
  "users": [
    {
      "name": "alice",
      "password": "alice 的用户密钥（16 字节 base64）"
    }
  ]
}
```

alice 的客户端密码则写成 `服务端身份密钥:alice 的用户密钥`。Xray 和 Surge 的文档也采用同样的 `服务端密钥:用户密钥` 格式。再次强调，EIH 只在两个 AES 方法下可用，ChaCha20 方法不支持多用户。

---

## 它仍然是「全加密协议」

读到这里，SS-2022 看起来已经相当完善。但它的设计边界也很清楚：**它解决的是「被人拿着数据来试探」的问题，而不是「被人看一眼就起疑」的问题**。

所谓全加密协议（fully encrypted protocol），是指连接从第一个字节起就是看起来完全随机的数据，没有任何明文协议头。早期这被视为优点——没有特征可抓。但 2023 年 USENIX Security 论文《How the Great Firewall of China Detects and Blocks Fully Encrypted Traffic》表明，2021 年 11 月至 2023 年 3 月间，GFW 反其道而行：只看 TCP 连接中客户端发出的首个数据包，如果它**每字节平均置位比特数接近 4（像随机数据）、可打印 ASCII 字符不够多、开头也不像 TLS 或 HTTP**，就判定为可疑，并按约 26% 的概率逐条连接阻断。具体的豁免规则、封锁范围与时间线见 [GFW 如何识别全加密流量](/posts/fully-encrypted-detection/)，这里只说结论：

- SS-2022 的首包由随机盐加 AEAD 密文组成，统计上就是均匀随机字节，落在这类规则覆盖的范围内；
- SIP022 开篇就把「代理流量与随机字节流不可区分」写成对抗 DPI 的设计目标，而 2021 年后的被动识别恰好把「看起来随机」本身当成了特征。规范的改进集中在重放、主动探测和多用户，没有针对这类被动识别的对策；头部 0–900 字节的填充能改变长度，但改变不了「看起来是随机数据」这一点；
- 论文测到的封锁只针对部分热门 VPS 网段，而且是概率性的。作者在论文工件附录中记录，2023 年 3 月 15 日的跟进测试显示 GFW 已停止对随机流量的动态封锁，此后没有公开测量证实它被重新启用。所以裸 SS-2022 节点今天能用，并不说明协议能抵御这类检测：审查方已经证明自己有能力、也愿意按「看起来随机」做被动封锁，并且可以随时重新启用。

因此，把 SS-2022 与 VLESS+Reality 并列为「抗 DPI 最强」并不准确：前者在抗重放、抗主动探测上相比旧版有实质改进，但在全加密流量的被动识别这一维度上，与旧版 Shadowsocks 没有本质区别。逐项对照见 [GFW 如何识别全加密流量](/posts/fully-encrypted-detection/) 中「SS-2022 仍是全加密协议意味着什么」一节。

这就是为什么 SS-2022 常常与外层方案搭配使用：要么让它躲进一层看起来像正常 TLS 的外壳里（ShadowTLS 就是为此设计的），要么只在流量不经过审查边界的链路上使用它，要么干脆换成本身就基于 TLS 的协议。

---

## ShadowTLS：先握手，再换芯

### 它要解决什么

ShadowTLS 由开发者 ihciah 在 2022 年 8 月发布，项目简介是「把真实的 TLS 握手暴露给防火墙」。它的出发点有两个：

- **全加密协议越来越容易被被动识别**，需要一个看起来像正常 HTTPS 的外壳；
- **TLS 白名单式的限制**：分析 ShadowTLS 的 FOCI 2023 论文提到，审查者可以只放行 SNI 或证书属于白名单域名的 TLS 连接，并引用了 2022 年一份在福建泉州遇到类似限制的用户报告。传统 TLS 代理需要自己的域名和证书，域名一旦不在白名单里就会被挡。

ShadowTLS 的思路是：**握手阶段让客户端真的去和一个大网站（握手服务器）握手，握手完成后再把连接切换成代理数据**。审查者看到的 SNI、证书都来自那个真实网站，ShadowTLS 服务器自己不需要任何证书。

它本身**不加密代理数据**。项目 README 说明 ShadowTLS 不包含数据加密和代理请求封装，一般需要搭配加密代理（通常是 Shadowsocks）使用，推荐在服务器上同时运行 Shadowsocks 服务端和 ShadowTLS 服务端，客户端同理。由于握手后的数据没有加密，实际部署时内层必须是自带加密的协议。

### v3 的工作流程

1. 客户端构造 TLS ClientHello，SNI 填握手服务器的域名（例如某个大型网站），并把 32 字节的 SessionID 设为「28 字节随机数 + 4 字节 HMAC」，HMAC 由双方共享的 ShadowTLS 密码计算；
2. ShadowTLS 服务端校验这 4 字节。**校验不通过**，就把整条连接以纯 TCP 方式转发给握手服务器——探测者得到的是真实网站的完整响应；
3. **校验通过**，服务端把 ClientHello 转发给握手服务器，并接管返回方向：记录 ServerHello 里的 ServerRandom，给握手服务器发来的每个 ApplicationData 记录内容做掩码，并在前面加上 4 字节 HMAC 标签；
4. 客户端从这些标签确认对面确实是自己的 ShadowTLS 服务端，握手完成后开始发送代理数据；
5. 切换后的每个记录都是「5 字节 TLS 记录头 + 4 字节 HMAC + 数据」，两个方向分别用由 ServerRandom 加上 `C` 或 `S` 初始化的 HMAC，每个记录的标签还会参与下一个记录的计算；
6. 任何一个记录校验失败（篡改、乱序、截断拼接），接收方立即发送 TLS 告警 `bad_record_mac` 并正常关闭连接，与真实 TLS 服务器在收到坏记录时的反应一致。

### v1 / v2 / v3 的差异

| 版本 | 发布时间 | 客户端认证 | TLS 版本 | 主要缺陷 |
|------|---------|-----------|---------|---------|
| v1 | 2022 年 8 月（v0.1.x） | 无 | 仅 TLS 1.2 及以下 | 只假设审查者看握手；可被后续流量观察、主动探测和流量劫持识别 |
| v2 | 2022 年 10 月（v0.2.0） | 挑战-应答：客户端在首个应用数据记录前附 8 字节 HMAC | 开始支持 TLS 1.3 | 不防劫持；中间人可篡改握手后的数据，或把一个记录拆成两个来暴露协议；服务端无法隐蔽地证明自己 |
| v3 | 2023 年 2 月（v0.2.14 引入） | SessionID 内嵌 HMAC | 严格模式要求 TLS 1.3，非严格模式兼容 1.2 | 见下文「已知研究」 |

v1 只支持 TLS 1.2，原因很朴素：服务端需要知道握手何时结束，才能切换去转发代理数据。它依靠 ChangeCipherSpec 和随后的 Finished 消息来判断，而 TLS 1.3 把这些握手消息都加密成了 ApplicationData 记录，服务端看不出来。从 v2 起改为用客户端附带的 HMAC 判断何时切换，因此可以工作在 TLS 1.3 上；v3 则把 HMAC 扩展到握手和之后的每一个记录。

FOCI 2023 论文《Chasing Shadows》分析的是 v0.1.4（v1），提出了几种识别方法。被动方面，ShadowTLS 官方 Rust 客户端（v0.1.4）的 TLS 指纹在 TLSFingerprint.io 收集的校园网数据中从未出现，很可能为它所独有，论文当时建议改用 uTLS 一类的库模仿主流指纹；主动方面只需少量 TCP 连接：给服务器发明文 HTTP 请求时，它的反应与多数 TLS 服务器不同；握手后发送非 TLS 记录或认证失败的 ApplicationData 时，正常 TLS 服务器多会回告警或断开，ShadowTLS 却保持沉默。研究者在全网扫描中找到约 1.5 万个行为类似 ShadowTLS 的主机。他们建议服务端只转发能通过共享密钥认证的记录、其余一律交给握手服务器，并与开发者合作修复；论文写明自 v0.2.3 起这些主动探测已不再有效。v3 的逐记录 HMAC 正是这一思路的延续。

### v3 如何防劫持

「劫持」指审查者不去探测服务器，而是在路径上把客户端的连接偷偷转给真实的握手服务器，看客户端接下来会做什么。v2 的客户端无法确认对面是谁，被劫持后照样发出代理数据，等于自曝身份。

v3 的对策是让服务端**隐蔽地证明自己**：只有真正的 ShadowTLS 服务端知道共享密码，才能给握手服务器的回包加上正确的 HMAC 标签并做掩码。如果连接被劫持，客户端收到的是真实网站的原始数据，没有正确的标签——客户端据此判定被劫持，不发送任何代理数据，而是发一个随机长度的普通 HTTP 请求、读完响应后正常关闭，把自己伪装成一次平常的网页访问。审查者重放 ClientHello 也没用：没有密码，就算不出能被客户端接受的标签。

### 已知研究与维护状态

- **2025 年的 Aparecium 概念验证**：2025 年 5 月底，一个名为 Aparecium 的开源工具公开，目标正是 ShadowTLS v3 和 REALITY。按其 README 的描述，它利用 TLS 1.3 握手后的 NewSessionTicket 消息：基于 OpenSSL 的网站通常在客户端 Finished 之后发送两条长度相同的 NewSessionTicket，而这两种协议当时在切换后都没有如实模仿；对 ShadowTLS 还可以看握手阶段的服务端 Finished 记录是否因 HMAC 标签从 53 或 69 字节变成 57 或 73 字节。README 提到，不发送 NewSessionTicket 的网站（文中举了 Google 为例）可以避开基于 NewSessionTicket 的那部分检测；但对 ShadowTLS 而言，README 另把 4 字节标签本身列为明显特征，认为这是 v3 的固有设计缺陷，并宣称它已经「死亡」。需要注意，这是研究者发布的概念验证，不等于 GFW 已经部署了同样的检测。
- **两边的后续并不对称**：Xray-core 在 2025 年 6 月 8 日发布的 v25.6.8 中点名致谢 Aparecium，让 REALITY 服务端启动时用 Chrome 指纹探测目标网站握手后记录的长度，并在之后的连接中照此模仿，发布说明称这是对该问题的初步修复。ShadowTLS 一侧，4 字节标签是 v3 协议本身的设计，上游没有发布对应修改；sing-box 依赖的 sing-shadowtls 库最后一次提交在 2025 年 2 月，早于 Aparecium 公开。sing-box、mihomo 之后是否跟进，请以各自的发布说明为准。
- **上游维护**：截至 2026 年 10 月，ihciah/shadow-tls 最新的 Release 仍是 2023 年 12 月的 v0.2.25（仓库最后一次推送在 2025 年 4 月）。sing-box 和 mihomo 使用各自的实现，跟随各自的版本更新。

---

## ShadowTLS 与 REALITY：同一个想法的两种实现

REALITY 与 ShadowTLS 都「借用」大网站的身份，常被放在一起比较。REALITY 的原理见 [VLESS + Reality 深度解析](/posts/vless-reality-deep-dive/)，这里只对比关键差异：

| 维度 | ShadowTLS v3 | REALITY |
|------|-------------|---------|
| 握手由谁完成 | 客户端与真实握手服务器完成真实握手，ShadowTLS 服务端只转发，并给转发的记录加 4 字节标签 | REALITY 服务端为每条连接拨号目标网站，参照其握手消息长度，自己以 TLS 1.3 服务端身份完成握手，向通过认证的客户端出示由「临时认证密钥」签发的「临时可信证书」 |
| 是否需要自有证书或域名 | 不需要，客户端校验的就是握手服务器的真实证书 | 不需要，客户端用服务端公钥校验临时证书 |
| 客户端认证 | ClientHello 的 32 字节 SessionID 里嵌入 4 字节 HMAC | 客户端把版本号、时间戳和 shortId 写进 ClientHello 的 32 字节 SessionID，再用临时 x25519 密钥与服务端公钥协商、经 HKDF 派生出的密钥做 AES-GCM 加密（同样利用 SessionID 字段） |
| 握手后的数据 | 不再加密，只有 HMAC 完整性保护，必须内层再套 SS-2022 等加密协议 | 仍是标准 TLS 1.3 加密会话，内层 VLESS 不必再加密 |
| 未认证连接 | 以纯 TCP 方式转发给握手服务器 | 转发给目标网站，对外表现为端口转发 |
| 防劫持 | 回包 HMAC 证明服务端身份，客户端发现异常就转入伪装的普通访问 | 客户端能区分临时证书、真证书与无效证书，收到真证书时进入「爬虫模式」 |
| TLS 版本 | 严格模式要求 TLS 1.3，非严格模式兼容 1.2 | 要求目标网站支持 TLS 1.3（及 H2） |
| 承载 UDP | 只承载 TCP | VLESS 可在 TCP 连接内承载 UDP |
| 主要实现 | ihciah/shadow-tls（Rust）、sing-box、mihomo（均含服务端）；Surge 等提供客户端 | Xray-core、sing-box、mihomo（均含服务端）；更多客户端支持 |
| 公开安全研究 | FOCI 2023 分析 v1（已修复）；2025 年 Aparecium 概念验证（上游未见对应修复） | 2025 年 Aparecium 概念验证；Xray-core v25.6.8（2025 年 6 月）起，服务端探测并模仿目标网站的握手后记录（官方称初步修复） |

几个容易忽略的共同点：

- **都受「SNI 与 IP 不匹配」的理论风险影响**：连接声称访问某大型网站，目的 IP 却是一台普通 VPS。FOCI 2023 论文评估过「按 SNI 重新解析并重定向连接」这种做法：在研究者的校园网数据中，约 1.1% 的连接会被它打断，作者认为对全部流量部署代价过高；但这不代表该维度永远安全；
- **TLS-in-TLS 特征都需要额外处理**：通过代理访问 HTTPS 网站时，内层还有一次 TLS 握手，它的长度和时序可能透过外层显现出来。REALITY 自己的 README 就提醒，搭配 XTLS 之外的协议会带来明显且已被针对的 TLS-in-TLS 特征。ShadowTLS 和 SS-2022 都没有专门整形内层握手长度的机制，理论上同样面临这一问题；AnyTLS 则是专门针对它设计的：它用可配置的分包与填充策略打乱内层握手的长度特征，并复用连接以降低延迟（见 [AnyTLS 项目说明](https://github.com/anytls/anytls-go)）；
- **握手服务器 / 目标网站的选择标准相近**：支持 TLS 1.3、在当地可正常访问、离服务器近、流量大，见 [如何选择 SNI 伪装目标](/posts/sni-target-selection/)。

---

## 配置示例：SS-2022 + ShadowTLS v3

下面给出 sing-box 服务端、sing-box 客户端和 mihomo 客户端的最小示例。字段名对照 sing-box 与 mihomo 官方文档；示例中的 `203.0.113.10` 是文档专用的保留地址，`www.example.com` 需替换为你选定的握手服务器，所有密码都是占位文字。

### 准备工作

```bash
# 1. 生成 SS-2022 密钥（2022-blake3-aes-128-gcm 需要 16 字节）
sing-box generate rand --base64 16

# 2. 生成 ShadowTLS 密码（任意字符串即可，用随机值更稳妥）
sing-box generate rand --base64 16

# 3. 确认握手服务器支持 TLS 1.3（严格模式需要），输出中出现 TLSv1.3 即可
openssl s_client -connect www.example.com:443 -servername www.example.com -tls1_3 < /dev/null 2>/dev/null | grep -i "TLSv1.3"
```

两端的时间也要提前确认已同步，原因见前文。

### 服务端（sing-box）

公网只开放 ShadowTLS 的 443 端口；Shadowsocks 入站只监听本机回环地址，由 ShadowTLS 入站通过 `detour` 把解开外壳后的连接直接交给它。

```json
{
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "shadowtls",
      "tag": "st-in",
      "listen": "::",
      "listen_port": 443,
      "version": 3,
      "users": [
        {
          "name": "user1",
          "password": "替换为 ShadowTLS 密码"
        }
      ],
      "handshake": {
        "server": "www.example.com",
        "server_port": 443
      },
      "strict_mode": true,
      "detour": "ss-in"
    },
    {
      "type": "shadowsocks",
      "tag": "ss-in",
      "listen": "127.0.0.1",
      "listen_port": 8388,
      "network": "tcp",
      "method": "2022-blake3-aes-128-gcm",
      "password": "替换为 16 字节 base64 密钥"
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    }
  ]
}
```

字段说明：

| 字段 | 含义 |
|------|------|
| `version` | ShadowTLS 协议版本，**默认值是 1**，必须显式写 3 |
| `users` | v3 的用户列表；`password` 顶层字段只用于 v2 |
| `handshake` | 握手服务器的地址和端口，服务器会为每条连接向它发起真实连接 |
| `strict_mode` | 仅 v3 有效。开启后握手服务器若未协商 TLS 1.3，sing-box 会记录 `TLS 1.3 is not supported, will copy bidirectional` 并退化为单纯转发，代理不可用 |
| `detour` | 监听字段之一，把连接转交给指定入站；Shadowsocks 和 ShadowTLS 入站都支持被这样注入 TCP 连接 |

sing-box 的 Shadowsocks 入站会自动识别 UDP over TCP 请求，服务端无需额外配置。启动前可以先执行 `sing-box check -c config.json` 检查格式。

### 客户端（sing-box）

客户端反过来：Shadowsocks 出站负责加密，通过拨号字段 `detour` 交给 ShadowTLS 出站去建立连接。

```json
{
  "inbounds": [
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 2080
    }
  ],
  "outbounds": [
    {
      "type": "shadowsocks",
      "tag": "ss-out",
      "server": "203.0.113.10",
      "server_port": 443,
      "method": "2022-blake3-aes-128-gcm",
      "password": "与服务端相同的 SS-2022 密钥",
      "udp_over_tcp": true,
      "detour": "st-out"
    },
    {
      "type": "shadowtls",
      "tag": "st-out",
      "server": "203.0.113.10",
      "server_port": 443,
      "version": 3,
      "password": "与服务端相同的 ShadowTLS 密码",
      "tls": {
        "enabled": true,
        "server_name": "www.example.com",
        "utls": {
          "enabled": true,
          "fingerprint": "chrome"
        }
      }
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "final": "ss-out"
  }
}
```

要点：

- **ShadowTLS 出站只承载 TCP**，源码里它的 UDP 接口直接返回错误。需要 UDP 时，在 Shadowsocks 出站开启 `udp_over_tcp`，把 UDP 封装进 TCP；该选项与 `multiplex` 冲突，二者只能选一个。UDP over TCP 是 SagerNet 自定义的协议，不属于 Shadowsocks 标准，服务端必须同样支持，本文的 sing-box 服务端会自动识别；
- **`tls` 是必填项**，`server_name` 必须与服务端 `handshake` 的域名一致，否则握手服务器返回的证书对不上，校验会失败；
- **uTLS 是一个取舍**：不开启时，sing-box 用 Go 标准库完成握手，ClientHello 是 Go 程序常见的指纹，与主流浏览器不同（FOCI 2023 指出「指纹独特」的是早期 ihciah 官方 Rust 客户端 v0.1.4，论文当时建议改用 uTLS）；开启后模拟浏览器指纹，但截至 2026 年 10 月，sing-box 文档把 uTLS 标为不推荐，理由是研究者多次发现其指纹缺陷、浏览器各自的 TLS 栈难以靠复制 ClientHello 结构完全模仿、库也缺乏维护，并建议真正需要抗指纹时改用 NaiveProxy。指纹问题的来龙去脉见 [TLS 指纹识别](/posts/tls-fingerprinting/) 与 [NaiveProxy：用 Chromium 网络栈做代理](/posts/naiveproxy/)。

### 客户端（mihomo）

mihomo 在 Shadowsocks 代理上把 ShadowTLS 实现为插件（新版本还为 VMess、VLESS、Trojan、AnyTLS 提供 `shadow-tls-opts`，并在 Shadowsocks 等入站监听器上支持 ShadowTLS 服务端）：

```yaml
proxies:
  - name: "ss2022-shadowtls"
    type: ss
    server: 203.0.113.10
    port: 443
    cipher: 2022-blake3-aes-128-gcm
    password: "与服务端相同的 SS-2022 密钥"
    udp: true
    udp-over-tcp: true
    udp-over-tcp-version: 2
    client-fingerprint: chrome
    plugin: shadow-tls
    plugin-opts:
      host: "www.example.com"
      password: "与服务端相同的 ShadowTLS 密码"
      version: 3
```

要点：

- mihomo 源码中 `plugin-opts` 的 `version` **默认是 2**，必须显式写 3；
- `client-fingerprint` 写在代理顶层，是 TLS 客户端指纹；`plugin-opts` 里另有一个 `fingerprint` 字段，那是证书指纹校验，两者不要混淆；
- `udp-over-tcp-version` 不写时默认是 1，sing-box 服务端两个版本都能识别，这里显式写 2 与 sing-box 客户端保持一致。

Surge 也支持在 TCP 类代理上追加 `shadow-tls-password`、`shadow-tls-sni`、`shadow-tls-version` 参数，v3 从 iOS 5.5.0 和 Mac 5.0.3 起支持，且 v3 必须填写 `shadow-tls-sni`。`shadow-tls-version` 不写时默认是 2，用 v3 必须显式写 `shadow-tls-version=3`。

Surge 不支持 sing-box 的 UDP over TCP。需要 UDP 时，可以用 Shadowsocks 策略的 `udp-port` 参数（iOS 5.14.0 / Mac 5.9.0 起），让 UDP 直接发往服务端另一个对公网开放的 Shadowsocks UDP 端口；这时服务端的 Shadowsocks 入站需要另外监听公网 UDP，不能再像上面的示例那样只在回环地址上监听 TCP。细节以其官方手册为准。

### 验证与排障

客户端启动后，先确认能通过本地端口访问外网：

```bash
curl -x http://127.0.0.1:2080 -I https://www.google.com
```

Windows 上请在 PowerShell 中改用 `curl.exe -x http://127.0.0.1:2080 -I https://www.google.com`：Windows PowerShell 5.1 里的 `curl` 是 `Invoke-WebRequest` 的别名，不认这些参数，而 Windows 10（1803 版）起系统自带真正的 `curl.exe`。

| 现象 | 常见原因 | 处理 |
|------|---------|------|
| 服务端日志出现 `bad timestamp` | 两端时间差超过 30 秒 | 开启系统对时，或使用 sing-box 的 `ntp` |
| 启动时报密钥错误 | 密钥长度与方法不符，或把普通口令当成了密钥 | 按方法重新生成 |
| 客户端连不上，像是在和真实网站通信 | 两端 ShadowTLS 版本不一致（sing-box 默认 1，mihomo 插件和 Surge 默认 2），或密码不同，服务端判定认证失败后把连接转给了握手服务器 | 两端都显式写 `3`，核对密码 |
| 服务端日志提示 `TLS 1.3 is not supported` | 开了严格模式，但握手服务器只协商到 TLS 1.2 | 换一个支持 TLS 1.3 的握手服务器 |
| 证书校验失败 | 客户端 `server_name` / `host` 与服务端 `handshake` 域名不一致 | 保持一致 |
| TCP 正常、UDP 不通 | ShadowTLS 只承载 TCP | 客户端开启 UDP over TCP（前提是服务端实现了 SagerNet UoT，例如本文的 sing-box 服务端；shadowsocks-rust 等服务端不支持，开启后 UDP 反而完全不通）；Surge 改用 `udp-port` |
| 能用但明显变慢 | 每条连接都多一次 TLS 握手，且服务端还要连接握手服务器 | 选离 VPS 近的握手服务器 |

更通用的排查步骤见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)。

---

## 什么时候选它，什么时候选别的

SS-2022 + ShadowTLS 是一个可用的组合，但不是唯一答案。不同方案的完整横向对比见 [主流代理协议横向对比](/posts/protocol-comparison/)，这里只给决策要点：

| 场景 | 更合适的方向 | 理由 |
|------|------------|------|
| 新建自用节点，希望客户端兼容面广、资料多 | VLESS + REALITY | 只有一层协议，握手后是真 TLS 加密，Xray、sing-box、mihomo 等支持广泛 |
| 已有 Shadowsocks 体系（面板、订阅、客户端习惯），想给它加一层 TLS 外观 | SS-2022 + ShadowTLS | 改动最小，内层仍是熟悉的 Shadowsocks；但 UDP 要么依赖服务端支持 UDP over TCP，要么另开公网 UDP 端口 |
| 主力客户端是 Surge，且想用 TLS 外观 | SS-2022 或 Snell + ShadowTLS | Surge 手册直接支持在 TCP 类代理上叠加 ShadowTLS v3 |
| 在意 TLS-in-TLS 特征 | VLESS + REALITY + Vision，或 AnyTLS | 两者都有针对内层握手的处理机制 |
| 网络对 UDP 友好，追求带宽 | Hysteria2 等 QUIC 协议，见 [Hysteria2 与 TUIC](/posts/quic-protocols/) | ShadowTLS 只承载 TCP，UDP 要绕一层 |
| 流量不经过审查边界的链路 | 裸 SS-2022 | 简单、开销小，全加密特征在这类链路上不构成问题 |

最后一行需要说明：中转线路中哪一段会经过审查边界，取决于线路类型，见 [直连 vs 中转 vs CDN](/posts/line-types-explained/)；不要想当然地认为「走了中转就安全」。

还有两条通用建议：

- **不要把协议当成唯一防线**：IP 信誉、端口、流量行为同样会触发封锁，准备备用节点比反复更换协议更重要；
- **跟踪所用实现的更新**：ShadowTLS 上游自 2023 年底以来没有发布新版本，相关研究仍在出现，使用时请关注 sing-box、mihomo 等实现的发布说明。

---

## 常见问题（FAQ）

### SS-2022 的密钥能像以前一样写成好记的密码吗？

不能。SIP022 要求密钥是长度固定的随机字节，以 base64 形式填写，实现不得再从口令派生密钥。随手写的字符串要么长度不对直接报错，要么在个别实现里被处理成另一个值，导致与别的客户端不兼容。请按方法生成对应长度的密钥，例如 `openssl rand -base64 16`、`sing-box generate rand --base64 16`（AES-256 与 ChaCha20 方法改为 32），或 `ssservice genkey -m "2022-blake3-aes-128-gcm"`（按方法名自动选长度）。

### 服务器时间差多少会连不上？

规范规定时间戳与本机时间相差超过 30 秒即按重放处理，sing-box 等实现也按 30 秒判断。注意是客户端和服务端两边的时间都要准：VPS 时钟漂移、手机手动改过时间、软路由开机后没有对时，都会导致连接失败。用 `timedatectl status` 检查服务器，用 NTP 保持同步即可。

### ShadowTLS 能单独使用，不套 Shadowsocks 吗？

不应该。ShadowTLS 握手后的数据只有 HMAC 完整性保护，没有加密，项目 README 也说明它一般需要搭配加密代理。内层不一定非得是 Shadowsocks（Surge 用户常搭配 Snell），但必须是自带加密的协议。另外，内层用 SS-2022 而不是旧版 AEAD，可以继续获得它的重放防护。

### 握手服务器怎么选？能直接用 REALITY 的 dest 吗？

多数情况下可以：适合做 REALITY dest 的网站（支持 TLS 1.3、在当地可正常访问）通常也满足 ShadowTLS 严格模式的要求。选择标准基本相同：支持 TLS 1.3、在当地可正常访问、离 VPS 近、本身流量大，可以参考 [如何选择 SNI 伪装目标](/posts/sni-target-selection/)。需要注意两点：

- ShadowTLS 服务端会为每条连接向握手服务器发起真实连接（REALITY 服务端同样会为每条连接拨号 dest），所以握手服务器离 VPS 越远，握手延迟越高；
- Aparecium README 提到，不发送 NewSessionTicket 的网站（如 Google）可以避开它基于 NewSessionTicket 的那部分检测；但对 ShadowTLS v3 来说，握手阶段转发的记录会因 HMAC 标签多出 4 字节，这一点与握手服务器是否发送 NewSessionTicket 无关，README 正是据此宣称 v3「死亡」，所以换握手服务器并不能消除这个特征。

网上教程（包括本站 SNI 选择一文中的例子）给出的域名只能当作起点，最好从中挑选与 VPS 同地区、同网络、自己验证过的站点。大量节点共用同一个 SNI 是否会形成可检测的统计特征，目前没有公开测量，属于推测。

### 用了 ShadowTLS，节点就不会被封了吗？

不会。ShadowTLS 让流量在握手层面看起来像访问大网站，但 IP 信誉、SNI 与 IP 不匹配、流量规模与行为、TLS-in-TLS 特征等维度依然存在，学术界和社区也已公开过针对它的检测思路。它降低的是被识别的概率，不是消除。封锁的常见触发条件见 [为什么你的节点会被封](/posts/node-blocking-causes/)。

### 已经在用旧版 AEAD 的 Shadowsocks，需要马上迁移吗？

如果节点直接暴露在审查边界上，建议尽早迁移：旧版 AEAD 缺少规范级的重放防护，而 IMC 2020 论文记录的重放类探测正是利用这一缺口来确认服务器身份的。迁移时要同时升级服务端和所有客户端，并重新生成定长密钥；确认客户端支持 `2022-blake3-*` 方法（较老的客户端可能不支持）。如果只是把 SS-2022 换上去、仍然裸奔在热门 VPS 网段上，也要预期全加密流量被动识别的风险依旧存在。

### 自建这套方案有哪些法律与安全风险？

在中国大陆，未经许可经营 VPN 或代理服务属于违法行为，已有经营者被追究刑事责任、判处有期徒刑的公开报道；个人使用同样存在法律风险，被查处时常被援引《计算机信息网络国际联网管理暂行规定》第六条、第十四条，给予警告或罚款。请自行了解并评估所在地的法律法规。VPS 服务商的服务条款也可能限制代理用途，违规可能导致停机或封号。安全方面，SS-2022 密钥和 ShadowTLS 密码等同于节点的全部凭证，分享配置时务必隐去真实 IP 和密钥；服务器只开放必要端口，Shadowsocks 入站只监听回环地址，并及时更新软件。

---

## 外部参考

- Shadowsocks 规范：[SIP022 AEAD-2022 Ciphers](https://shadowsocks.org/doc/sip022.html)、[SIP023 Extensible Identity Headers](https://shadowsocks.org/doc/sip023.html)、[旧版 AEAD 规范](https://shadowsocks.org/doc/aead.html)
- Shadowsocks 实现：[shadowsocks-rust](https://github.com/shadowsocks/shadowsocks-rust)、[Xray Shadowsocks 入站文档](https://xtls.github.io/en/config/inbounds/shadowsocks.html)
- ShadowTLS：[ihciah/shadow-tls 仓库](https://github.com/ihciah/shadow-tls)、[ShadowTLS v3 协议设计](https://github.com/ihciah/shadow-tls/blob/master/docs/protocol-v3-en.md)、[ShadowTLS Releases](https://github.com/ihciah/shadow-tls/releases)
- sing-box 文档：[Shadowsocks 入站](https://sing-box.sagernet.org/configuration/inbound/shadowsocks/)、[Shadowsocks 出站](https://sing-box.sagernet.org/configuration/outbound/shadowsocks/)、[ShadowTLS 入站](https://sing-box.sagernet.org/configuration/inbound/shadowtls/)、[ShadowTLS 出站](https://sing-box.sagernet.org/configuration/outbound/shadowtls/)、[监听字段](https://sing-box.sagernet.org/configuration/shared/listen/)、[TLS](https://sing-box.sagernet.org/configuration/shared/tls/)、[UDP over TCP](https://sing-box.sagernet.org/configuration/shared/udp-over-tcp/)、[NTP](https://sing-box.sagernet.org/configuration/ntp/)
- mihomo 与 Surge：[mihomo Shadowsocks 配置](https://wiki.metacubex.one/config/proxies/ss/)、[mihomo Shadowsocks 入站监听器（含 shadow-tls）](https://wiki.metacubex.one/config/inbound/listeners/ss/)、[Surge TLS 参数（含 Shadow TLS）](https://manual.nssurge.com/policies/tls.html)、[Surge Shadowsocks 策略（含 udp-port）](https://manual.nssurge.com/policies/shadowsocks.html)
- REALITY：[XTLS/REALITY](https://github.com/XTLS/REALITY)、[Xray-core v25.6.8 发布说明](https://github.com/XTLS/Xray-core/releases/tag/v25.6.8)
- AnyTLS：[anytls-go 项目说明](https://github.com/anytls/anytls-go)
- 研究论文与工具：[How China Detects and Blocks Shadowsocks（IMC 2020）](https://gfw.report/publications/imc20/en/)、[How the Great Firewall of China Detects and Blocks Fully Encrypted Traffic（USENIX Security 2023）](https://gfw.report/publications/usenixsecurity23/en/)、[该论文的工件附录（含 2023 年 3 月跟进测试）](https://www.usenix.org/system/files/usenixsecurity23-appendix-wu-mingshi.pdf)、[Chasing Shadows: A security analysis of the ShadowTLS proxy（FOCI 2023）](https://petsymposium.org/foci/2023/foci-2023-0002.php)、[Aparecium](https://github.com/ban6cat6/aparecium)

**站内相关文章**：

- [GFW 如何识别全加密流量](/posts/fully-encrypted-detection/)
- [VLESS + Reality 深度解析](/posts/vless-reality-deep-dive/)
- [如何选择 SNI 伪装目标](/posts/sni-target-selection/)
- [主流代理协议横向对比（2026）](/posts/protocol-comparison/)
