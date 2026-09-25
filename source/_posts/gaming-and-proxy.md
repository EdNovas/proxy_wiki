---
title: "代理能打游戏吗：UDP、NAT 类型与游戏加速器的本质区别"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 网络知识
tags:
  - UDP
  - NAT
  - 延迟
  - TUN
  - Hysteria2
  - 游戏
excerpt: "游戏流量以 UDP 小包为主，对延迟、抖动和丢包敏感而不吃带宽。本文从代理协议承载 UDP 的方式、NAT 类型和节点位置讲起，解释用代理打游戏的现实边界，以及游戏加速器与通用代理的根本差异。"
index_img: /images/posts/gaming-and-proxy.svg
---

> **摘要**：「开了代理能不能打外服」「节点测速 50ms，进游戏却 150ms」「主机联机总显示 NAT 严格」——这些问题背后是同一件事：游戏流量和网页、视频流量的性质完全不同。游戏以 UDP 小包为主，要的是低延迟、低抖动、低丢包，而通用代理和机场节点主要围绕 TCP 大流量设计。本文梳理各代理协议承载 UDP 的方式、NAT 类型如何被代理链路改变、机场打游戏体验差的结构性原因，以及游戏加速器与通用代理的本质区别，最后给出配置与测试方法。

---

## 先说结论：能，但有条件

用代理打游戏行不行，取决于下面几个条件是否同时满足：

| 条件 | 不满足时的典型表现 |
|---|---|
| 游戏流量真的进了代理（电脑需要 TUN 模式） | 开不开代理延迟一样，或外服根本连不上 |
| 节点支持 UDP，且协议对 UDP 友好 | 能登录、能进大厅，一开局就断线或卡在匹配 |
| 节点位置靠近游戏服务器 | 延迟比直连还高 |
| 线路晚高峰不拥堵、不对 UDP 限速 | 白天正常，晚上频繁「瞬移」、回弹 |
| 整条链路的 NAT 行为足够开放（P2P 联机需要） | 能匹配但无法和部分玩家组队，主机显示 NAT 严格 |

回合制、卡牌、MMO 等对延迟容忍度较高的游戏，一个离游戏服务器近、支持 UDP 的节点通常够用；FPS、格斗、MOBA 等竞技游戏，通用代理很难稳定达到理想状态，专门的游戏加速器更合适。

---

## 游戏流量有什么不一样

### 以 UDP 为主，小包高频

实时对战中，客户端和服务器要持续同步位置、朝向、技能、命中判定等状态。服务器以固定频率（tick rate）推进游戏世界并下发快照，从每秒几十次到一百多次不等。每个包通常只有几十到几百字节，总带宽一般只有几十到几百 Kbps。

这类数据几乎都走 UDP，因为**过期的数据没有重传的价值**。100 毫秒前的位置丢了就丢了，下一个包马上带来更新的状态；如果像 TCP 那样坚持等重传，后面的新数据都得排队，画面反而卡住。游戏引擎一般在 UDP 之上自行实现需要的可靠性（例如只对关键事件确认重发），其余数据允许丢失。

登录、商店、聊天、补丁下载则多走 TCP（HTTPS），而且往往和对局流量连向不同的服务器，这一点在分流时很重要。

### 敏感的是延迟、抖动、丢包，不是带宽

| 维度 | 网页 / 视频 / 下载 | 实时对战游戏 |
|---|---|---|
| 主要传输协议 | TCP（以及 QUIC） | UDP |
| 流量形态 | 大块数据，可以缓冲 | 小包连续，不能缓冲 |
| 最在乎的指标 | 带宽（吞吐量） | 延迟、抖动、丢包 |
| 丢包的后果 | 重传、降速，几乎无感 | 角色瞬移、技能不出、判定异常 |
| 延迟增加 100ms | 首屏慢一点 | 明显「慢半拍」，竞技游戏体验大幅下降 |

所以，**「测速能跑满的节点」不等于「适合打游戏的节点」**。视频和下载要的是管道粗，游戏要的是管道短、平稳、不漏。一条晚高峰抖动 ±50ms、丢包 3% 的大带宽线路，看视频靠缓冲大多还能凑合（服务端使用 BBR 等不以丢包为主要信号的拥塞控制时影响更小），打 FPS 却几乎不可用。延迟与带宽的区别见 [速度慢的常见原因与优化思路](/posts/speed-optimization/)。

---

## 代理协议如何承载 UDP

### 原生 UDP 转发：Shadowsocks

Shadowsocks 的 UDP Relay 把每个 UDP 包单独加密，仍以 UDP 包的形式发给服务端，服务端解密后代为发往目标，相当于在远端做了一次 NAT。每个包独立传输，丢一个就是丢一个，不影响后续数据，行为与直连 UDP 基本一致。代价是这些包没有任何伪装，更容易受运营商 UDP 策略影响。

mihomo 的 SS 节点另有 `udp-over-tcp` 选项（默认关闭），可在 UDP 不通的网络里把 UDP 塞进 TCP 传输。但它是 SagerNet 自定义的 UoT 协议，sing-box 文档明确说明它不属于 Shadowsocks 标准，兼容表只列出 sing-box、Clash.Meta（mihomo）和 Shadowrocket。**服务端也必须实现它**（例如 sing-box 服务端），Xray、shadowsocks-rust 等常见 SS 服务端并不支持，对这类节点贸然开启反而会让 UDP 完全不通；开启后也同样会遇到下文所说的队头阻塞。

### UDP over TCP：VMess / VLESS / Trojan

这三种协议通常跑在 TCP（加 TLS）之上，UDP 只能被切成带长度前缀的帧塞进 TCP 连接，即 UDP over TCP（UoT）。即使 VMess / VLESS 换用 mKCP、HTTP/3 等传输层，UDP 也仍装在可靠、有序的流里传输，本质上还是 UoT 式的封装。Trojan 的 UDP ASSOCIATE 命令、Xray 的 XUDP 都属于这一类。

XUDP 是 Xray 对 Mux.Cool 的扩展，在帧元数据里附带 UDP 的地址和端口，让 VLESS / VMess 的 UDP 能实现 FullCone（完全锥形）行为。按 Xray 项目的说明，客户端与服务端均为 Xray-core v1.3.0 及以上时默认启用。客户端这一侧：mihomo 与 sing-box 的 VLESS 默认即使用 XUDP；mihomo 的 VMess 需写 `packet-encoding: xudp` 显式开启。v2ray 5+ 与 sing-box 还支持另一种按包携带地址的编码 packetaddr，两端必须一致。但要分清：**XUDP 解决的是 NAT 行为，不是时延**，只要底层是可靠有序的流，就逃不开队头阻塞。

### 基于 QUIC 的 UDP：Hysteria2 / TUIC

Hysteria2 的协议规范要求 UDP 包通过 QUIC 的**不可靠数据报**（unreliable datagram）发送：丢了不重传，也不阻塞后续数据报，语义与原生 UDP 一致，外层仍是加密的 QUIC 连接。TUIC 的 `udp_relay_mode` 默认 `native`，也可切到 `quic`（用 QUIC 流做无损转发，开销更大，对游戏反而不利）。

两者的原理见 [Hysteria2 与 TUIC](/posts/quic-protocols/) 和 [Hysteria 2 协议详解](/posts/hysteria2-explained/)。补充一点：Brutal 拥塞控制解决的是**吞吐量**，而游戏几乎不需要带宽，所以 Hysteria2 对游戏的价值在于「数据报语义、无队头阻塞」，而不是「暴力加速」。

WireGuard 则是三层隧道，直接封装 IP 包并用 UDP 传输，没有 UoT 问题，但特征明显、不做伪装，跨境稳定性难以保证。

### 队头阻塞：UoT 为什么会让游戏「瞬移」

TCP 保证按序交付。假设装着游戏数据的第 10 个 TCP 段丢失：

1. 第 11 个段已到达，但必须等第 10 个段重传成功才能交给上层
2. 重传至少要多等一个 RTT；游戏是稀疏的小包流，丢包后往往没有足够的后续段凑齐快速重传所需的 3 个重复 ACK。现代 Linux 等系统的 TCP 会用 RACK 与尾部丢包探测（TLP，约 2 个 RTT 后发出探测包）补救，探测也失败时才要等超时重传，Linux 默认最小重传超时为 200ms
3. 这段时间游戏收不到任何新数据，重传完成后积压的包一次性涌出

体现在画面上就是对手先「定住」再「瞬移」，自己的操作被回滚。原生 UDP 或 QUIC 数据报下，丢掉的那个包会被游戏的插值和预测掩盖。丢包率越高差距越大；几乎不丢包的线路上，UoT 尚可接受。

### 对比表

| 协议 | UDP 承载方式 | 队头阻塞 | NAT 行为（取决于实现） | 游戏适配度 |
|---|---|---|---|---|
| Shadowsocks | 原生 UDP，逐包加密 | 无 | Xray v1.2.0 发布说明称其实现为 FullCone，其他实现不一 | 高（UDP 不被限速时） |
| VMess / VLESS | UoT（Xray 用 XUDP；v2ray / sing-box 另有 packetaddr 编码） | 有 | 两端支持 XUDP 或 packetaddr 时可为 FullCone | 中，取决于丢包 |
| Trojan | UoT（UDP ASSOCIATE） | 有 | 可为 FullCone | 中，取决于丢包 |
| Hysteria2 | QUIC 不可靠数据报 | 无 | 规范建议每个会话使用独立出站端口，服务端照做时可为锥形 | 高（UDP 不被限速时） |
| TUIC（native） | QUIC 数据报 | 无 | 取决于服务端 | 高，但维护状态一般 |
| WireGuard | 三层隧道（UDP） | 无 | 取决于服务端 NAT 配置 | 高，但抗封锁弱 |

关键结论：**UDP 友好的协议只有在「UDP 本身畅通」时才有优势**。如果运营商晚高峰对跨境 UDP 限速或大量丢包，Hysteria2 可能反而不如走 TCP 的 VLESS。实际做法是同一地区备好 UDP 系和 TCP 系两种节点，实测对比，协议整体取舍见 [主流代理协议横向对比](/posts/protocol-comparison/)。

---

## NAT 类型：主机联机成败的关键

### 经典四种类型与 RFC 4787

NAT 类型决定了「外面的人能不能主动连进来」。RFC 3489 把 NAT 分为四种，国内玩家常称 NAT1 到 NAT4；后来的 RFC 4787 改用「映射行为 + 过滤行为」两个维度描述：

| 俗称 | RFC 3489 名称 | 映射行为 | 过滤行为 | 对 P2P 联机 |
|---|---|---|---|---|
| NAT1 | 完全锥形（Full Cone） | 与端点无关 | 与端点无关 | 最开放 |
| NAT2 | 受限锥形（Restricted Cone） | 与端点无关 | 与地址相关 | 大多数情况正常 |
| NAT3 | 端口受限锥形（Port Restricted Cone） | 与端点无关 | 与地址和端口相关 | 与对称型玩家常连不上 |
| NAT4 | 对称型（Symmetric） | 与地址和端口相关 | 通常与地址和端口相关 | 打洞困难，常需中继 |

- **映射行为**：同一个内网源端口访问不同目标时，是否复用同一个公网端口。「与端点无关」（Endpoint-Independent）即复用，对方看到的地址稳定，可以打洞
- **过滤行为**：是否接受从没联系过的外部地址发来的包

不少主机游戏的联机对战采用 P2P：玩家之间直接交换数据，服务器只负责匹配。双方 NAT 都严格时打洞失败，就会「匹配到了却连不上」「进不了好友房间」。

### 主机上的 NAT 类型

三家主机厂商各用一套标签，判定逻辑并未公开，下表只是大致对应：

| 大致对应的 NAT 行为 | Xbox | PlayStation | Nintendo Switch |
|---|---|---|---|
| 公网 IP / 完全锥形 / UPnP 生效 | 开放（Open） | Type 1 或 Type 2 | A |
| 受限锥形、端口受限锥形 | 中等（Moderate） | Type 2 | B |
| 对称型 | 严格（Strict） | Type 3 | C 或 D |
| UDP 基本不通 | 不可用 | 测试失败 | F |

- PlayStation 的 Type 1 指主机直接拿到公网地址，Type 2 指在路由器之后但仍可被连入，Type 3 受严格限制；官方远程游玩排障页提到 Type 3 可能导致无法使用 Remote Play
- 任天堂官方说明中 Switch 的 NAT 类型为 A、B、C、D、F（没有 E）：A 最利于联机，D 一般只能与 A 连接，F 基本无法与其他玩家连接
- Windows 上部分 Xbox 网络多人游戏（官方举例 Forza Horizon 3、4）使用 Teredo（把 IPv6 封装进 UDP 的隧道），拿不到 Teredo 地址时，Windows 上的 Xbox 网络设置会把 NAT 类型显示为「Teredo 无法取得资格」。Xbox 支持文档指出，部分 VPN 客户端在连接期间会禁用 Teredo，安装了虚拟网卡的 VPN 客户端甚至可能在网卡移除前一直禁用它

### 代理如何改变 NAT 类型

很多人忽略的一点：**游戏流量走代理后，对方看到的不是你家路由器的 NAT，而是整条代理链路的 NAT 行为**。于是：

- 家里处于运营商大内网（CGNAT）、本地常测出端口受限（NAT3）甚至对称型（NAT4）的用户，走一条完全锥形的代理链路，反而可能得到更开放的 NAT 类型
- 家里有公网 IP、路由器开启了 UPnP 或 Full Cone NAT、本来是 NAT1 的用户，走一条对称型链路，NAT 类型反而变差

注意，有公网 IP 不等于 NAT1：家用路由器常见的 Linux 地址伪装（MASQUERADE）通常表现为端点无关映射加上与地址和端口相关的过滤，也就是 NAT3，开启 UPnP 端口映射、Full Cone NAT 或 DMZ 后才接近 NAT1。

整条链路要表现为锥形，每一环都不能把行为「对称化」：

| 环节 | 需要满足 | 说明 |
|---|---|---|
| 本地 TUN 的 UDP 会话表 | 端点无关的映射与过滤 | mihomo 的 `endpoint-independent-nat`；sing-box 1.14 起的 `udp_mapping` / `udp_filtering` |
| 代理协议 | 能为每个包携带目标地址 | SS、Trojan、Hysteria2、TUIC 天然支持；VLESS / VMess 需要 XUDP（Xray）或 packetaddr（v2ray 5+ / sing-box），两端须一致 |
| 服务端出站 | 出站 UDP 为锥形 | Xray 自 v1.2.0 起 Freedom 出站支持 FullCone |
| 服务器网络 | 独立公网 IP；防火墙 / 安全组放行陌生地址发往出站临时端口的入站 UDP，只放行回包不够 | NAT 类 VPS 会改写映射；只放行已建立连接回包的状态防火墙（如 ufw 默认的 deny incoming、云安全组）会让过滤变为「与地址和端口相关」，测出来是端口受限锥形（NAT3），达不到完全锥形 |
| 机场链路 | 中转、负载均衡不改写行为 | 用户无法控制，只能实测 |

直接运行 mihomo 内核时，在配置文件的 `tun` 段写：

```yaml
tun:
  enable: true
  stack: mixed                     # 官方：无使用问题时建议 mixed，默认 gvisor
  auto-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53
  udp-timeout: 300                 # UDP 会话过期时间（秒），默认 300
  endpoint-independent-nat: true   # 默认 false，官方提示性能可能略降
```

Clash Verge Rev 等图形客户端里，`tun.enable` 由界面开关决定，`stack`、`auto-route`、`auto-detect-interface`、`dns-hijack`、`strict-route` 等以 TUN 设置对话框里保存的值为准，写进 YAML 不会生效；直接改订阅文件也会在下次更新后丢失。做法是在设置页开启 TUN，再把下面两行写进「全局扩展配置」或订阅的扩展配置：

```yaml
tun:
  endpoint-independent-nat: true
```

处理链与被界面接管的字段见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)，扩展配置的写法见 [如何自定义规则](/posts/custom-rules/)。

sing-box 旧的 `endpoint_independent_nat` 自 1.11.0 起已不再生效，可以删除。1.14.0 起改由 TUN 等入站上的 UDP NAT 字段 `udp_mapping` / `udp_filtering` 控制，两者**默认都是 `endpoint_independent`，一般不需要写**。1.13 及更早的内核不认识这两个字段，会报 `json: unknown field` 并拒绝启动，使用内置 sing-box 的图形客户端时请先确认内核版本。另外，sing-box 1.15（写作时处于 alpha 阶段）已将 TUN 的 `stack` 字段标记为弃用，升级前请以官方文档为准。

---

## 为什么「机场 + 游戏」经常体验差

### 物理距离决定延迟下限

光在光纤中的速度约为真空光速的三分之二，约每毫秒走 204 公里，所以**两地大圆距离每 100 公里，往返延迟至少约 1ms**：上海到香港约 12ms、到东京约 17ms、到洛杉矶约 102ms。完整的下限表与推导见 [延迟测试数字的含义](/posts/latency-test-explained/#数字怎么看：物理延迟的下限)。

实际光缆不走直线，还有路由转发和排队，真实延迟通常明显高于下限。**任何代理、加速器都不可能突破这个下限**，只能让实际路径尽量接近它。「国内玩美服 30ms」在物理上就不成立。

### 节点离游戏服务器远：三角路由

走代理时，总延迟约等于「你到节点」加上「节点到游戏服务器」。客户端显示的延迟只覆盖前半段，而且测的是 HTTP 请求耗时而非 UDP 往返，详见 [延迟测试数字的含义](/posts/latency-test-explained/)。

例如游戏服务器在东京，你选了显示 40ms 的香港节点，香港到东京还要几十毫秒，总延迟可能高于显示 60ms 的日本节点。**选节点要看游戏服务器在哪，而不是哪个数字最小**。

### 运营商 QoS 与晚高峰

- **UDP QoS**：运营商不公开 QoS 策略，但跨境 UDP 在部分地区、部分时段被限速或丢包上升（不少用户反馈移动网络下更明显），是 UDP 系协议用户常遇到的情况，本站 [QUIC 协议](/posts/quic-protocols/) 一文也有讨论。这直接打击了游戏依赖的 UDP 优势
- **超售与晚高峰**：节点多人共享，晚高峰带宽被视频和下载占满时，缓冲队列变长，表现为抖动和丢包，对下载只是慢一点，对游戏则是频繁卡顿。线路等级差异见 [直连 vs 中转 vs CDN](/posts/line-types-explained/)

### 节点根本不通 UDP

以下情况都会造成「能登录、不能开局」：

- 服务端关闭了 UDP 转发，例如 Hysteria2 服务端配置了 `disableUDP`
- 中转机只转发了 TCP 端口（参见 [端口转发与中转](/posts/port-forwarding-relay/)）
- 客户端节点没开 `udp`：mihomo 中大多数协议的 `udp` 字段**默认为 false**，只有 TUIC 等基于 UDP 的协议默认开启
- CDN 类节点（如 WebSocket 经 Cloudflare）只能 UoT，本身延迟也偏高

### 自动切换与共享 IP

- `url-test` 策略组会在延迟波动时自动换节点：已建立的 UDP 会话一般仍留在旧节点，但对局中新建的会话（重连、切换房间、语音）会从另一个出口 IP 发出，游戏服务器可能判定为掉线或要求验证；部分图形客户端还提供「切换节点时断开旧连接」一类的选项，会直接打断对局
- 机场出口 IP 由大量用户共享，同一 IP 上有人作弊或滥用时，游戏方可能对该 IP 限流、要求验证甚至封禁

---

## 游戏加速器到底加速了什么

国内常见的游戏加速器（如网易 UU、雷神、迅游等）和通用代理都是「把流量绕到别处再发出去」，但设计目标差别很大：

1. **只接管游戏流量**：按游戏进程和游戏服务器 IP 段列表截获流量（常见做法是驱动层虚拟网卡或过滤驱动），网页、视频不会被带着绕路
2. **专用游戏线路**：在游戏服务器附近部署出口，入口到出口多为选路优化过的中转或专线，追求贴近物理下限的延迟和低抖动，而非大带宽
3. **就近接入**：入口节点分布在国内各地、各运营商，跨境段交给优化线路
4. **围绕 UDP 设计**：部分产品还提供多链路冗余发包之类的抗丢包功能
5. **主机方案**：通过路由器插件、手机热点、电脑共享或专用硬件接管主机流量，部分产品把「突破 NAT 限制」作为卖点

| 维度 | 游戏加速器 | 通用代理（机场 / 自建） |
|---|---|---|
| 设计目标 | 低延迟、低抖动、低丢包 | 访问受限内容、带宽 |
| 接管范围 | 仅游戏进程 / 游戏服务器 IP | 按规则分流全部流量 |
| 出口位置 | 贴近游戏服务器，按区服选择 | 按国家地区划分，与具体游戏无关 |
| UDP 处理 | 核心功能，专门优化 | 取决于协议与节点，常被忽视 |
| 主机支持 | 有成套方案 | 需自己搭软路由 / 旁路由 |
| NAT 行为 | 作为产品功能处理 | 取决于整条链路，需自己验证 |
| 访问一般网站 | 通常不提供（部分产品会加速 Steam 商店、社区等游戏平台页面） | 核心用途 |

**适合加速器的场景**：竞技类外服游戏（FPS、MOBA、格斗）；主机 P2P 联机且 NAT 问题自己解决不了；用代理实测延迟明显高于直连或抖动很大。

**通用代理通常够用的场景**：对延迟容忍度较高的游戏；游戏服务器恰好在你的优质节点所在地区；只需访问外服商店、社区或下载更新（TCP 流量，正是代理擅长的）。

---

## 实操：让游戏流量正确地走代理

### 电脑：TUN + UDP + 按进程分流

1. **必须开 TUN**：游戏客户端基本不读系统代理。系统代理只是供应用自行读取的设置，遵守它的基本只有浏览器等 HTTP(S) 流量；SOCKS5 虽然定义了 UDP ASSOCIATE，但游戏不会主动用它发 UDP。原理见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)，开不起来参考 [TUN 模式不生效的常见原因](/posts/tun-not-working/)
2. **确认节点开启 UDP**：在客户端「连接」页面看游戏进程有没有 UDP 连接、走的哪个节点
3. **建专用游戏策略组，用手动选择**，按进程分流。下面的 `proxies` 只示意节点需要带哪些字段（`udp: true`、`packet-encoding`），**机场用户不要照抄节点**：保留订阅里的节点，把 `Game` 组的 `proxies` 换成订阅中的节点名，再通过扩展配置或覆写脚本注入策略组和规则：

```yaml
proxies:
  - name: JP-Hy2
    type: hysteria2
    server: jp1.example.com
    port: 443
    password: your-password
    udp: true
  - name: JP-VLESS
    type: vless
    server: jp2.example.com
    port: 443
    uuid: your-uuid
    udp: true
    packet-encoding: xudp   # mihomo 的 VLESS 默认已是 xudp，可省略；VMess 需显式写出。服务端需支持 XUDP

proxy-groups:
  - name: Game
    type: select            # 手动选择，避免对局中自动切换
    proxies: [JP-Hy2, JP-VLESS, DIRECT]

rules:
  - PROCESS-NAME,YourGame.exe,Game   # 以任务管理器「详细信息」中的名称为准
  # ……以下为订阅原有规则
```

- 游戏流量只有在 TUN 下才会进入 mihomo，所以这条 `PROCESS-NAME` 规则要配合 TUN 才对游戏生效（进程识别本身并不限于 TUN，经系统代理进来的本机连接同样能匹配）；mihomo 的 `find-process-mode` 默认 `strict`，由内核自行判断是否查找进程，不要设为 `off`。在软路由 / 旁路由上代理其他设备时拿不到进程信息，只能按 IP 分流
- 使用订阅的用户可通过客户端覆写功能注入规则，避免更新后丢失，见 [如何自定义规则](/posts/custom-rules/)
- sing-box 用路由规则的 `process_name` 字段实现同样效果（仅 Linux、Windows、macOS），Android 上改用 `package_name`
- 国服游戏及其反作弊组件一律 `DIRECT`，走代理只会徒增延迟

4. **游戏需要 P2P 联机（好友房、部分游戏的组队）时**：按上文「代理如何改变 NAT 类型」开启端点无关 NAT，再用下文「测 NAT 类型」的方法确认映射与过滤均为 Endpoint Independent

### 主机：借助网关设备

PlayStation、Switch 网络设置里的「代理服务器」（HTTP 代理）一般只对商店、下载等 HTTP 类流量生效，联机对战的 UDP 不会走它，NAT 类型也不会改善；Xbox 则没有这一项。要让对战流量走代理，需要把主机的网关指向能透明代理 UDP 的设备：

1. **准备网关**：软路由或旁路由，部署见 [软路由与旁路由](/posts/soft-router-guide/)。只有一台 Windows 电脑时，也可以开启系统的「移动热点」让主机连接，再在电脑上开 TUN；热点转发的流量能否被 TUN 接管取决于客户端和系统版本，务必用第 4 步验证。注意客户端的「局域网连接」只是让别的设备把本机当 HTTP / SOCKS 代理，不是网关，游戏的 UDP 不会走它
2. **透明代理必须包含 UDP**：OpenClash 等插件中的 UDP 转发类选项要打开
3. **给主机固定 IP**，便于单独写规则，例如 `SRC-IP-CIDR,192.168.1.50/32,Game`
4. **验证**：在主机的网络设置里运行连接测试，确认能连上、NAT 类型没有比直连时变差

### 手游

- 手机客户端通过系统 VPN 接口工作，本身相当于 TUN，UDP 能否用同样取决于节点
- Android 上 mihomo 的 `PROCESS-NAME` 可以匹配应用包名，也可以用客户端的「分应用代理」；iOS 客户端通常拿不到发起连接的应用信息，只能按域名 / IP 分流
- 不少用户反馈移动网络下跨境 UDP 更不稳定（运营商不公开相关策略），同一节点在 Wi-Fi 与 5G 下可能差很多，建议分别实测；部分游戏会检测设备是否处于 VPN 状态

各平台客户端的选择见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/)。

---

## 测试方法：用数据判断问题在哪

### 找到对局服务器

开 TUN 进入一局对战，在客户端「连接」页面按进程筛选，找到游戏进程 UDP 连接的目标 IP，再查归属地与 AS（方法见 [AS 号与 IP 归属查询](/posts/as-number-lookup/)）。注意登录、商店的 TCP 连接往往指向另一批服务器，**对局用的 UDP 服务器才是选节点的依据**。

### 分段测延迟

先关掉 TUN 测直连基线；自建 VPS 的用户再登录节点，测节点到游戏服务器的延迟（203.0.113.10 换成实际 IP）：

```powershell
# Windows：直连基线（先关闭 TUN）
ping -n 50 203.0.113.10
pathping -n 203.0.113.10      # 逐跳统计丢包，需等待几分钟
```

```bash
# Linux / 节点 VPS 上执行；macOS（Homebrew 安装的 mtr）需在前面加 sudo
mtr -rwzc 100 203.0.113.10       # 报告模式，100 轮，显示 AS 号
mtr -u -rwzc 100 203.0.113.10    # 改用 UDP 探测，可对照中间路由对 UDP 的处理；终点通常不回应，最后一跳显示丢包不代表不通
nexttrace 203.0.113.10           # 显示每一跳的地理位置与运营商
```

- 除了平均值，更要看**最大值、波动和丢包率**：平均 60ms、最大 65ms 的线路，比平均 45ms、最大 200ms 的更适合打游戏
- mtr 中间某跳丢包而后续正常，通常只是该路由器限制了 ICMP 回应，延续到终点的丢包才有意义
- 机场用户无法登录节点，只能开着 TUN 在游戏内切换不同节点，对比游戏显示的延迟与丢包，以此代替「节点到服务器」这一段的测量
- **开着 TUN 时不要用 ping 判断代理延迟**：SS、VMess、VLESS、Trojan、Hysteria2、TUIC 等代理协议不承载 ICMP，mihomo 等客户端的 TUN 下 ping 通常要么被本地应答，要么由本机直连发出，数字不代表经代理的真实路径。WireGuard 这类三层隧道是例外，sing-box 1.13 起也能把 TUN 进来的 ping 转发到 WireGuard / Tailscale 出站
- 游戏内置的网络统计才是最终标准

### 测 NAT 类型

电脑上可用开源工具 NatTypeTester，它基于 STUN，按 RFC 5780 给出映射行为和过滤行为：

1. 开启 TUN，让该工具的流量走游戏节点，例如临时加一条 `PROCESS-NAME,NatTypeTester.exe,Game`（进程名以实际为准）
2. 映射和过滤都显示 Endpoint Independent，即相当于完全锥形；映射为 Endpoint Independent、过滤为 Address and Port Dependent，则是端口受限锥形
3. 关掉 TUN 再测一次得到本地宽带的 NAT 类型，两次对比即可看出代理链路的影响

这类测试需要支持 RFC 5780 的 STUN 服务器（有两个 IP、各监听两个端口）。结果显示 UnsupportedServer 或过滤测试失败时，先在工具里换一个 STUN 服务器再测，不要直接归咎于代理链路。

主机直接用系统设置里的网络连接测试查看 NAT 类型。

### 排查清单

| 现象 | 优先怀疑 | 验证方法 |
|---|---|---|
| 开不开代理延迟一样 | 游戏没走代理 | 连接列表找不到游戏进程 → 开 TUN、查规则 |
| 能进大厅，开局断开 | 节点不通 UDP | 看 UDP 连接是否失败，换支持 UDP 的节点 |
| 延迟比直连还高 | 节点离服务器远 | 查服务器位置，换同地区节点 |
| 白天正常，晚上卡 | 拥堵、UDP QoS | 晚高峰分别测 UDP 系与 TCP 系节点 |
| 周期性卡顿后「瞬移」 | UoT 队头阻塞 + 丢包 | 与 Hysteria2 / SS 类节点对比 |
| 对局中掉线、重连后被要求验证 | 策略组自动切换，出口 IP 变了 | 游戏组改为 `select` |
| 主机 NAT 严格 / D | 链路中有对称型环节 | 分段测试 NAT |

---

## 风险提示

- **服务条款**：不少游戏平台禁止用代理伪装所在地区。例如 Steam 订户协议要求用户不得通过 IP 代理等方式掩饰居住地，无论是为了绕过地区限制、以其他地区价格购买还是其他目的，违反者可能被终止账户。跨区购买、跨区激活的风险远高于单纯降低延迟
- **反作弊误判**：频繁在不同国家 IP 间切换、使用被大量账号共享的出口 IP、驱动层网络工具与反作弊组件冲突，都可能触发风控，轻则验证，重则封禁；各游戏策略不同且通常不公开
- **账号地区**：部分账号与注册地区绑定，登录 IP 长期与账号地区不一致可能带来额外验证或限制
- **安全**：来路不明的「游戏专用节点」「免费加速器」同样能看到你的流量元数据

本文只讨论网络原理。是否用代理玩某款游戏、愿意承担什么风险，请自行阅读该游戏的用户协议后评估。

---

## 常见问题（FAQ）

### 开了 TUN 之后游戏延迟反而更高，正常吗？

如果游戏服务器在国内或离你很近，走代理必然绕路，这类游戏应设为 `DIRECT`。如果是外服，先检查节点和服务器是否同地区；再试试切换 TUN 协议栈（gvisor、system、mixed），个别游戏在不同栈下表现不同，参考 [Sing-box TUN vs Clash Verge TUN](/posts/singbox-vs-clash-tun/)。

### 客户端显示节点 50ms，为什么游戏里是 150ms？

客户端测的是经节点访问测试网址的 HTTP 请求耗时，与游戏的 UDP 往返是两回事，也不包含节点到游戏服务器那一段。以游戏内显示和分段测试为准。

### Hysteria2 是不是打游戏最合适的协议？

不能一概而论。它的数据报语义适合游戏，但前提是网络不对跨境 UDP 限速；晚高峰 UDP 丢包严重时，基于 TCP 的 VLESS 反而更稳。Brutal 针对吞吐量，对小包游戏帮助有限，带宽参数按实际线路填写即可。

### 主机能不能直接在网络设置里填代理服务器？

PlayStation 和 Switch 可以填（Xbox 没有这一项），但一般只影响商店、下载等 HTTP 类流量，联机对战的 UDP 不走它，NAT 类型也不会改善。需要软路由、旁路由或开启热点并运行 TUN 的电脑充当主机网关。

### NAT 类型测出来是对称型，怎么改善？

先分清是哪一段造成的。本地宽带是对称型（部分运营商大内网如此），先向运营商申请公网 IP（常见做法是光猫改桥接、由路由器拨号），再在路由器开启 UPnP 或 Full Cone NAT；仍在大内网时只开 UPnP 无效。也可以让游戏走一条锥形代理链路。代理链路是对称型，就逐项检查：客户端是否开启端点无关 NAT、VLESS / VMess 是否用 XUDP、机场是否经过改写映射的中转或负载均衡；如果测出来是端口受限，再检查服务端防火墙 / 安全组是否放行陌生地址发来的入站 UDP（不只是回包）。机场节点无法调整服务端，只能换节点或换方案。

### 游戏加速器和代理客户端能同时开吗？

不建议让两者同时接管同一个游戏。它们都可能用虚拟网卡或驱动截获流量，路由冲突会导致不通或延迟异常。确需同时运行，在代理规则中把游戏进程设为 `DIRECT` 交给加速器；仍有冲突就在玩游戏时关闭代理的 TUN。

---

## 外部参考

- [mihomo TUN 配置](https://wiki.metacubex.one/en/config/inbound/tun/)、[代理通用字段](https://wiki.metacubex.one/en/config/proxies/)、[路由规则](https://wiki.metacubex.one/en/config/rules/)
- [sing-box UDP NAT 字段](https://sing-box.sagernet.org/configuration/shared/udp-nat/)、[TUN 入站](https://sing-box.sagernet.org/configuration/inbound/tun/)、[UDP over TCP](https://sing-box.sagernet.org/configuration/shared/udp-over-tcp/)、[VLESS 出站](https://sing-box.sagernet.org/configuration/outbound/vless/)、[更新日志](https://sing-box.sagernet.org/changelog/)
- [Clash Verge Rev 扩展配置与脚本](https://www.clashverge.dev/guide/extend.html)
- [XUDP 说明](https://github.com/XTLS/Xray-core/discussions/252)、[Xray-core v1.2.0 发布说明](https://github.com/XTLS/Xray-core/releases/tag/v1.2.0)
- [Hysteria 2 协议规范](https://v2.hysteria.network/docs/developers/Protocol/)、[Trojan 协议](https://trojan-gfw.github.io/trojan/protocol)
- [RFC 4787](https://www.rfc-editor.org/rfc/rfc4787)、[RFC 3489](https://www.rfc-editor.org/rfc/rfc3489) — NAT 行为的定义；[RFC 8985](https://www.rfc-editor.org/rfc/rfc8985) — RACK-TLP 丢包检测
- [NatTypeTester](https://github.com/HMBSbige/NatTypeTester)、[NextTrace](https://github.com/nxtrace/NTrace-core)
- [Nintendo Support：NAT 类型](https://en-americas-support.nintendo.com/app/answers/detail/p/989/c/874/a_id/22541)、[Xbox Support：Teredo](https://support.xbox.com/en-US/help/hardware-network/connect-network/troubleshoot-party-chat)、[PlayStation Support：Remote Play 连接排障](https://www.playstation.com/en-us/support/games/ps4-remote-play-connection-troubleshooting/)
- [Steam 订户协议](https://store.steampowered.com/subscriber_agreement/)

站内相关文章：

- [TUN 模式 vs 系统代理：原理与选择](/posts/tun-vs-system-proxy/)
- [Hysteria2 与 TUIC：基于 QUIC 的协议](/posts/quic-protocols/)
- [软路由与旁路由](/posts/soft-router-guide/)
- [延迟测试数字的含义](/posts/latency-test-explained/)
