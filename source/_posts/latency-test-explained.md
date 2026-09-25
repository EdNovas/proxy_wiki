---
title: "延迟测试的数字到底代表什么：ICMP Ping、TCPing、URL Test 与真实体验"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 排障手册
tags:
  - 延迟
  - 测试
  - 速度
  - 排障
  - 诊断
  - Clash
excerpt: "客户端里的延迟数字可能来自 ICMP Ping、TCPing 或 URL Test，测的根本不是同一段路。本文拆解每种数字的含义、unified-delay 与测试地址的影响、超时的常见原因，以及怎样用它区分节点问题和本地网络问题。"
index_img: /images/posts/latency-test-explained.svg
---

> **摘要**：客户端里每个节点后面的毫秒数，可能来自三种不同的测法：ICMP Ping 只测到服务器 IP，TCPing 测到节点端口的一次 TCP 握手，URL Test（真连接延迟）则经代理协议完整访问一次测试网址。测法、是否计入握手、测试地址远近都不同，同一个节点在不同客户端里自然会显示不同的数字。本文拆解这些数字的含义，解释 mihomo 的 unified-delay、url-test 自动选择和「超时」的常见原因，并给出更接近真实体验的测法与排查清单。

---

## 三种「延迟」各测哪一段路

客户端界面上都叫「延迟」，背后却可能是三种测法：

```text
① ICMP Ping   本机 ──Echo──► 节点 IP ──Reply──► 本机
               不带端口，不经过代理协议

② TCPing      本机 ──SYN──► 节点 IP:端口 ──SYN-ACK──► 本机
               只完成一次 TCP 握手，不验证协议和账号

③ URL Test    本机 ══代理协议══► 节点 ──HTTP(S)──► 测试网址
               响应沿原路返回，完整走一遍「本机 → 节点 → 目标」
```

| 测法 | 测到哪里 | 能发现 | 发现不了 |
|------|---------|--------|---------|
| ICMP Ping | 节点 IP | IP 是否可达 | 端口封锁、协议或认证错误 |
| TCPing | 节点 IP 与端口 | 端口能否完成握手 | 协议或密钥错误、落地出口问题 |
| URL Test | 经节点到测试网址 | 代理能否端到端使用 | 带宽、丢包、晚高峰拥塞 |

一句话记忆：**ICMP 和 TCPing 回答「路通不通」，URL Test 回答「代理能不能用」，三者都回答不了「快不快」**。

---

## ICMP Ping：只到服务器，而且常被禁

ICMP Ping 工作在网络层，发一个回显请求、等一个回显应答。它不带端口，也不经过 VLESS、Trojan、Shadowsocks 这些代理协议，只能说明「这个 IP 还活着」。它的局限：

- **常被禁**：不少云厂商的安全组或防火墙默认不放行入站 ICMP，Ping 不通不代表节点不可用
- **不代表业务流量**：路由器可能对 ICMP 限速或区别处理，它的延迟和丢包不能直接等同于代理流量
- **测不到端口级封锁**：只封端口时 ICMP 照样能通，判断方法见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)
- **中转、CDN 节点只测到入口**：节点地址是国内中转机或 CDN 边缘时，Ping 到的只是最前面一小段

```bash
# macOS / Linux 用 -c，Windows 用 -n 指定次数
# 203.0.113.10 是文档保留地址，替换为你的节点 IP
ping -c 10 203.0.113.10
```

> **注意 TUN 的干扰**：开启 TUN 后，本机发出的探测包会先进入虚拟网卡；Fake-IP 模式下域名还会被解析成保留网段里的假地址（mihomo 文档中 `fake-ip-range` 的示例值为 `198.18.0.1/16`），这时 ping 一个域名得到的数字与真实网络无关。做 Ping、TCPing、traceroute 之前先临时关闭 TUN，原理见 [Fake-IP vs Redir-Host](/posts/fake-ip-vs-redir-host/)。

---

## TCPing：到节点端口的一次 TCP 握手

TCPing 向节点端口发送 SYN，收到 SYN-ACK 就停止计时，结果约等于一次到服务器的往返（RTT）。端口被封、服务端进程没启动，它都会失败。但它有几个盲区：

1. **不验证代理层**：UUID 过期、Reality 的公钥或 shortId 填错，TCPing 照样正常
2. **中转节点只测到国内入口**：跨境段和落地都不在测量范围内
3. **不适用于 UDP 协议节点**：Hysteria2、TUIC 的端口上通常没有 TCP 服务，超时不代表节点坏了，见 [Hysteria 2 协议详解](/posts/hysteria2-explained/)
4. **CDN 节点测到的是最近的边缘**：原因见 [BGP 与 Anycast](/posts/bgp-anycast/)

v2rayN 中对应右键菜单「测试延迟 Tcping (多选)」，按 7.24.9 的源码每个节点只握手一次、超时 5 秒，失败显示 `-1`；v2rayNG 中对应「测试 TCP 延迟（TCPing）」。命令行做法：

```powershell
# Windows：PsPing 需从微软 Sysinternals 单独下载（见文末链接），首次运行会弹出许可协议
# 对 443 端口握手 10 次；TCP ping 模式默认先预热 1 次，预热不计入统计
psping -n 10 203.0.113.10:443
```

```bash
# nc -z 只握手不发数据；计时包含进程启动开销，只适合看量级
# Linux（以 netcat-openbsd 为例）：-w 3 同时限制连接超时
time nc -z -w 3 203.0.113.10 443

# macOS 自带 nc：连接超时要用 -G，-w 只管连接建立后的空闲超时
time nc -z -G 3 203.0.113.10 443
```

不要写脚本对节点端口做高频握手循环，在服务端看来这与端口扫描没有区别。

---

## URL Test / 真连接延迟：经代理完整走一遍

Clash 系客户端的延迟测试按钮（Clash Verge Rev 里是策略组标题栏的网络检测图标；单个节点可以悬停后点「检测」，或点节点右侧的延迟数字）、v2rayN / v2rayNG 的「真连接延迟」都属于这一类：内核经由节点向测试网址发出 HTTP(S) 请求，计量从发起到收到响应的时间。认证失败、协议参数不匹配、落地无法出网，都会让它失败。

但一次「冷」测试包含好几次往返。以 VLESS + Reality 节点、HTTPS 测试地址为例：

| 步骤 | 两端 | 大约耗时 |
|------|------|---------|
| 1. TCP 建连 | 本机 ↔ 节点 | 1 × RTT（本机–节点） |
| 2. TLS / Reality 握手 | 本机 ↔ 节点 | 1 × RTT（本机–节点） |
| 3. 节点解析域名并连接目标 | 节点 ↔ 目标 | DNS 查询 + 1 × RTT（节点–目标） |
| 4. 与目标的 TLS 握手 | 经隧道 | 1 × 全程 RTT |
| 5. 发出请求、收到响应 | 经隧道 | 1 × 全程 RTT |

全程 RTT 约等于本机–节点 RTT 加上节点–目标 RTT，再加转发处理时间。表中的往返次数只是示意：Shadowsocks 没有独立的第 2 步，基于 QUIC 的协议有自己的握手，多路复用可以直接复用已有连接，各内核对这些步骤的合并方式也不同。由此区分两个概念：

- **冷测试**：包含建连和各层握手，常是一次往返的数倍，且受协议影响大，反映打开新网站时的首包等待
- **热测试**：在已建好的连接上再请求一次，只剩第 5 步，约等于一个全程 RTT，更适合横向比较线路

---

## unified-delay 与各客户端的算法差异

> **版本说明**：本文涉及的默认值、超时阈值与界面文字，对照的是 mihomo v1.19.31、Clash Verge Rev v2.5.5、v2rayN 7.24.9 和 v2rayNG 2.2.6 的源码（均为 2026 年 9 月时的最新正式版；v2rayNG 的内核测速部分对照 AndroidLibXrayLite 主分支），新版本可能调整。

### mihomo 的 unified-delay

mihomo 文档对统一延迟的描述是：开启时会计算 RTT，以消除连接握手等带来的不同类型节点的延迟差异。对照源码 `adapter/adapter.go` 中的 `URLTest` 方法，计时从拨号连接节点之前开始，然后经节点向测试网址发送一个 **HEAD** 请求：

- `unified-delay: false`：第一个请求完成即停止计时，是**冷测试**
- `unified-delay: true`：在同一条连接上再发一次 HEAD，**只计第二次的耗时**，接近**热测试**

```yaml
unified-delay: true   # 写在 mihomo 配置文件顶层
```

Clash Verge Rev 设置里的「统一延迟」开关对应的就是它，界面说明为「会进行两次延迟测试」。按 v2.5.5 的源码，Clash Verge Rev 生成的配置默认写入 `unified-delay: true`，而且这个字段由设置页接管，直接改 YAML 不生效，详见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。它只改变计时范围，不影响实际连接的速度。

mihomo 的 `adapter/adapter.go` 里还有一处日志提示：第二次请求失败且测试地址是明文 `http://` 时，建议改用 HTTPS，因为部分服务商会劫持测试地址，并且不兼容重复的 HEAD 请求。Clash Verge Rev 默认开启统一延迟，手动测试的内置回落地址又是 `http://` 形式（见「测试地址怎么影响结果」一节），正好落在这种组合里，所以建议在「默认测试链接」里填一个 HTTPS 地址。

### 各客户端对照

| 客户端 | 测试项 | 做法（按上述版本源码） |
|--------|--------|------------------|
| mihomo（Clash Verge Rev 等） | 策略组测速按钮、节点延迟数字、url-test 组 | HEAD；冷热取决于 unified-delay |
| v2rayN | 测试真连接延迟 (多选) | 启动临时内核，同一客户端连发两次 GET 取较小值；7.24.9 整体限时 9 秒（开发分支已改为 5 秒） |
| v2rayNG | 测试真连接延迟 | TCP 类节点先对节点端口做 1 秒的 TCP 预检（Hysteria2 等除外），失败直接记 -1；通过后连发两次 GET 取较小值，只有 200 / 204 算成功 |

v2rayN 的第二次 GET 通常能复用第一次的连接，所以取较小值后接近热测试。测试地址都可以在设置中修改：v2rayN 为「真连接测试地址」，v2rayNG 为「真连接延迟测试 URL」，Clash Verge Rev 为「默认测试链接」。v2rayN 还提供「测试 UDP 延迟」和「测试速度」，后者经节点下载测速文件，能看到带宽。界面操作见 [Clash Verge Rev 使用指南](/posts/clash-verge-guide/) 与 [v2rayN / v2rayNG 使用指南](/posts/v2ray-clients-guide/)。

Shadowrocket、Surge 和 sing-box 系客户端也有各自的延迟测试，测试地址同样可以在设置或配置里修改（Shadowrocket 的「连通性测试」地址见 [Shadowrocket 使用指南](/posts/shadowrocket-guide/)，sing-box 见 [Sing-box 使用指南](/posts/singbox-guide/)）。本文没有逐一核对它们的实现细节，但读数方法相同：先弄清测的是哪一段路、是否计入握手、用的是哪个测试地址，再只在同一个客户端里比较。

### 为什么同一个节点，不同客户端的数字对不上

1. **测法不同**：TCPing 与 URL Test 本来就不是同一段路
2. **冷热不同**：关闭 unified-delay 的 mihomo 是冷测试，v2rayN 取两次中的较小值，前者常是后者的数倍
3. **测试地址不同**：服务器位置不同，HTTPS 与否也有影响
4. **请求与内核不同**：HEAD 与 GET、Xray-core 与 mihomo 在握手和连接复用上的实现各有差异
5. **并发与时机不同**：批量测试时多个节点并发进行（mihomo 的健康检查同时最多测 10 个），本地带宽和 CPU 被分摊

所以**只在同一个客户端、同一套设置、同一个测试地址下比较数字才有意义**，跨客户端比较绝对值得不出结论。

---

## 测试地址怎么影响结果

`generate_204` 类地址返回 HTTP 204（无内容），几乎不传数据，适合测往返时间，不适合测带宽。

| 地址 | 提供方 | 作为默认值出现在 |
|------|-------|----------------|
| `https://www.gstatic.com/generate_204` | Google | mihomo 策略组（未写 `url` 时）、sing-box urltest、v2rayNG |
| `https://www.google.com/generate_204` | Google | v2rayN |
| `http://cp.cloudflare.com/generate_204` | Cloudflare | Clash Verge Rev 手动测试的内置回落地址 |

Clash Verge Rev 的手动测试按这个顺序取地址：代理页上临时填写的测试链接、内核通过 API 报告的策略组测试地址（testUrl）、设置里的「默认测试链接」，最后才是内置回落地址。注意 url-test、fallback、load-balance 这些自动组即使没写 `url`，内核也会报告一个测试地址（通常是默认的 `https://www.gstatic.com/generate_204`，含 `use` 的组则先沿用代理集合的 health-check 地址），所以手动测它们用不到「默认测试链接」；只有 select 类型的组没写 `url`（或写的恰好是内核默认值），也没从代理集合沿用到别的地址时，内核才报告空值，这时才轮到「默认测试链接」和内置回落地址。

v2.3.0 的更新说明写的是改用 HTTPS 的 cp.cloudflare.com，而 v2.5.5 源码中的回落地址是 `http://` 形式，所以建议在「默认测试链接」里显式填一个 HTTPS 地址，例如与 mihomo 默认值一致的 `https://www.gstatic.com/generate_204`，本文后面的示例也统一使用它。另外，设置页的说明写明「默认测试链接」只用于界面发起的测试，不会改写配置文件，url-test 组自动选择时仍按配置里的 `url` 测。

**目标离落地有多远**：URL Test 的后半程是「落地 → 测试网址」。Google 和 Cloudflare 的边缘节点遍布全球，通常离落地不远，这一段很短，所以默认地址适合横向比较节点。如果换成一台位于美国西海岸的自建服务器，所有香港节点都会凭空多出一段跨太平洋往返；落地附近如果没有测试服务的边缘节点，这一段同样会变长。因此比较节点时，要用全球分布的地址，并且所有节点用同一个地址。想评估访问某个具体服务的体验，可以临时换成该服务的地址，但要确认它返回的状态码：mihomo 可用 `expected-status` 指定期望值，v2rayNG 只认 200 和 204。

**HTTP 还是 HTTPS**：HTTPS 地址在冷测试里多一次与目标的 TLS 握手，数字更大；明文 HTTP 地址可能在节点侧被劫持并直接应答，这时测到的只是本机到节点的那一段，数字偏小。需要可比、可信的结果时，统一使用 HTTPS 地址。

---

## 中转与 IPLC 节点的延迟由哪几段构成

中转的原理见 [直连 vs 中转 vs CDN](/posts/line-types-explained/) 与 [端口转发与中转](/posts/port-forwarding-relay/)，这里只看延迟的构成：

```text
本机 ─(a)─► 运营商 ─(b)─► 中转入口（国内）─(c)─► 落地（境外）─(d)─► 测试网址

a 本地接入：Wi-Fi、路由器、家宽
b 国内段：你所在城市到中转入口机房
c 跨境段：公网线路，或 IPLC / IEPL 专线
d 落地到目标；另有中转与代理程序的处理、排队时间
```

| 测法 | 覆盖的段 |
|------|---------|
| 对节点地址做 Ping / TCPing | a + b |
| URL Test 冷测试 | a + b + c + d，含多次往返 |
| URL Test 热测试 | a + b + c + d，约一次往返 |

所以中转节点「TCPing 15 ms、真连接 70 ms」完全正常，前者只量到国内机房；也不能拿中转节点的 TCPing 和直连节点的 TCPing 比高低。专线的价值主要在 c 段：路径固定、不走公网国际出口，因此延迟稳定、晚高峰不易拥塞，但它缩短不了 a、d 两段，也突破不了下文的物理下限。

---

## 数字怎么看：物理延迟的下限

### 推导依据

- 康宁 SMF-28 Ultra 单模光纤的产品资料给出的有效群折射率为 1.4676（1310 nm）和 1.4682（1550 nm）。光速约 299,792 km/s，除以 1.468 得到光纤中的速度约 **204 km/ms**，约为真空光速的三分之二
- 往返时间的理论下限 ≈ 2 × 距离 ÷ 204 ≈ **距离（km）÷ 102**，单位 ms
- 粗略记法：**大圆距离每 100 km，RTT 至少约 1 ms**

距离取两地的大圆距离，即地球表面的最短距离。真实光缆要绕开地形、经过海缆登陆站和交换中心，路由还可能绕行。一篇研究美国长途光纤网络的论文提到，过往测量总结出的经验法则是把直线距离乘以约 2.1，再按光纤中的光速换算延迟。跨境流量还要经过运营商的国际出口，出口未必在离你最近的城市。

### 参考下限表

下表按城市坐标计算大圆距离再换算，**是理论计算值，不是实测值**，真实延迟一定更高：

| 路径 | 大圆距离 | 理论 RTT 下限 |
|------|---------|--------------|
| 广州 ↔ 香港 | 约 130 km | 约 1.3 ms |
| 北京 ↔ 首尔 | 约 950 km | 约 9 ms |
| 上海 ↔ 香港 | 约 1,230 km | 约 12 ms |
| 上海 ↔ 东京 | 约 1,750 km | 约 17 ms |
| 上海 ↔ 新加坡 | 约 3,810 km | 约 37 ms |
| 北京 ↔ 法兰克福 | 约 7,780 km | 约 76 ms |
| 上海 ↔ 洛杉矶 | 约 10,430 km | 约 102 ms |
| 上海 ↔ 美国东部（阿什本） | 约 11,960 km | 约 117 ms |

### 怎么用这张表

- **测得的数字低于下限**：测的不是你以为的那段路，多半是中转入口、CDN 边缘，或者被本机 TUN、节点侧代答
- **在「下限 × 2，再加十几到二十毫秒」附近**：路径大体顺畅。这是粗略估算而不是实测标准：真实光缆路径约为大圆距离的两倍，本地接入、运营商和机房转发还有一段固定开销；距离越短，固定开销占比越大，几百公里内的短路径不适合用倍数判断
- **远高于这个量级**：可能是路由绕行、链路拥塞，或者你看的是含多次握手的冷测试

看 URL Test 时，还要把「落地 → 测试网址」这一段算进去。各地区的经验范围可参考 [速度慢的常见原因与优化思路](/posts/speed-optimization/) 中的表格。

---

## 为什么低延迟不等于快

延迟与带宽的区别，[速度慢的常见原因与优化思路](/posts/speed-optimization/) 已经讲过，这里补充几个延迟测试天然看不到的因素。

### 丢包

Mathis 等人 1997 年提出的 TCP 吞吐近似模型：

```text
单条 TCP 连接吞吐上限 ≈ (MSS ÷ RTT) × (1.22 ÷ √丢包率)

例：MSS = 1460 字节，RTT = 50 ms，丢包率 1%
(1460 × 8 bit ÷ 0.05 s) × (1.22 ÷ 0.1) ≈ 233.6 kbit/s × 12.2 ≈ 2.85 Mbit/s
```

在这个模型下，**延迟只有 50 ms 的线路，只要有 1% 的持续丢包，单条连接就只剩几 Mbit/s**。模型针对 Reno 类拥塞控制，CUBIC、BBR 以及 Hysteria2 的拥塞控制对丢包的敏感程度不同，数值会有出入，但「丢包比延迟更伤吞吐」的方向是一致的。而一次 URL Test 只有寥寥几个小包：没丢包就一切正常，恰好丢一个就可能多等数百毫秒甚至超时，对丢包率几乎没有统计意义。

### 抖动

抖动是连续多次测量之间的波动。平均 60 ms、却在 40 到 200 ms 之间来回跳的线路，对游戏和语音通话的影响大于稳定在 90 ms 的线路。单次测试看不出抖动，需要连续采样，游戏场景见 [代理能打游戏吗](/posts/gaming-and-proxy/)。

### 超售与晚高峰拥塞

机场节点通常是共享带宽，见 [看懂机场参数](/posts/airport-parameters/)。延迟测试发生在链路相对空闲的一瞬间，而看视频时链路是满载的：路由器和节点上的队列变长，延迟随之上升，这被称为缓冲膨胀（bufferbloat）。Cloudflare 的测速页面会分别报告空载延迟和负载下延迟，两者差距越大，说明链路繁忙时排队越严重。

### 「延迟 50 ms，看视频却卡」的常见原因

| 现象 | 可能原因 | 怎么验证 |
|------|---------|---------|
| 经代理测速，带宽本身就低 | 节点限速、超售、晚高峰拥塞 | 同一节点在白天和晚高峰各测一次 |
| 带宽够但时快时慢 | 丢包、抖动 | 用 mtr 看丢包，看负载下延迟与抖动 |
| 一播放延迟就飙升 | 缓冲膨胀 | 对比空载延迟与负载下延迟 |
| 只有某个网站卡 | 被调度到较远的 CDN，或落地 IP 被限速 | 看 YouTube 详细统计信息，换同地区另一个落地对比 |
| 只在 QUIC / UDP 场景卡 | 运营商对 UDP 做了 QoS | 浏览器临时关闭 QUIC，或换 TCP 类协议对比 |
| 手机卡、有线电脑不卡 | 本地 Wi-Fi 干扰 | 靠近路由器或改用有线复测 |

延迟数字更像一道门槛：超时说明不能用，几百毫秒说明远或者绕，但几十毫秒并不能保证快。

---

## 超时、-1、Timeout 分别意味着什么

| 客户端 | 失败时的表现 | 超时阈值（按上述版本源码） |
|--------|-------------|----------------------|
| mihomo url-test / 健康检查 | 节点标记为不可用，不参与自动选择 | 策略组未设置 `timeout` 时为 5000 ms |
| Clash Verge Rev 手动测试 | 显示 `Timeout` 或 `Error` | 设置中的「测试超时时间」，默认 10000 ms |
| v2rayN | 显示 `-1` | Tcping 5 秒；真连接延迟整体 9 秒（其中连接本地代理端口限 3 秒；开发分支已改为整体 5 秒） |
| v2rayNG | 测试失败（内核返回 -1） | TCP 类节点先做 1 秒的 TCP 预检；通过后两次 GET 各最长约 12 秒 |

阈值不同，也是同一个节点在一个客户端里超时、在另一个客户端里「慢但能通」的原因之一。例如 v2rayNG 的 1 秒预检意味着：到节点端口的握手超过 1 秒的 TCP 类节点，会直接显示失败，而同一节点在 Clash Verge Rev 里可能只是数字偏大。把 TCPing 和 URL Test 放在一起看，更容易定位：

| TCPing | URL Test | 最可能的情况 |
|--------|----------|------------|
| 超时 | 超时 | IP 或端口不可达：被封、服务器宕机、本地断网 |
| 正常 | 超时或 `-1` | 端口通、代理层失败：订阅过期或 UUID / 密码变更、Reality 参数不匹配、系统时间偏差过大、落地访问不了测试地址、状态码不符合期望 |
| 正常 | 数值很高 | 入口正常、后半程慢：跨境段拥塞、落地离测试地址远，或看的是冷测试 |
| 超时 | 正常 | 多见于 Hysteria2、TUIC 等 UDP 协议节点，或 TCPing 工具与内核解析到了不同地址（如 IPv4 与 IPv6） |

关于系统时间：V2Fly 文档说明 VMess 依赖系统时间，要求 UTC 时间误差在 90 秒以内；TLS 类协议在时间偏差过大时也可能因证书校验失败而握手失败。如果**所有节点同时超时**，先检查本地网络、客户端状态和订阅是否过期，完整流程见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)。

---

## 更接近真实体验的测法

### 用 curl 拆开一次请求

curl 的 `-w` 参数可以输出各阶段的累计耗时。经本地代理端口在同一条命令里请求两次测试地址，第二次会复用第一次的连接：

```bash
# macOS / Linux
# 7897 换成客户端实际的混合端口（Clash Verge Rev 默认 7897，v2rayN 默认 10808，以设置页为准）
curl -sS -x socks5h://127.0.0.1:7897 -o /dev/null -o /dev/null \
  -w "code:%{http_code} tls:%{time_appconnect}s total:%{time_total}s new_conn:%{num_connects}\n" \
  https://www.gstatic.com/generate_204 https://www.gstatic.com/generate_204
```

```powershell
# Windows PowerShell：写 curl.exe，避免调用到 Invoke-WebRequest 的别名 curl
curl.exe -sS -x socks5h://127.0.0.1:7897 -o NUL -o NUL -w "code:%{http_code} tls:%{time_appconnect}s total:%{time_total}s new_conn:%{num_connects}\n" https://www.gstatic.com/generate_204 https://www.gstatic.com/generate_204
```

读法：

- 先看 `code` 是否为 204。`code:000` 表示请求失败（`-sS` 会在下方打印 curl 的错误原因），这时的 `new_conn:0`、`tls:0.000000s` 只说明没有建立任何连接，不代表复用
- 第一行是冷请求，`tls` 是经隧道与目标完成 TLS 握手的累计时间，`total` 相当于一次冷测试
- 第二行在 `code:204` 的前提下出现 `new_conn:0`、`tls:0.000000s`，表示复用了连接，`total` 约等于一个全程 RTT，相当于热测试
- curl 手册写明 `time_connect` 是到远端主机「或代理」的 TCP 连接时间，经本地代理时它只量到 127.0.0.1，没有参考价值，所以上面的命令没有把它列出来
- `socks5h` 表示由代理端解析域名，避免本地 DNS 的干扰

这条请求按客户端的分流规则走，测之前要在连接页面确认测试域名匹配到了你想测的节点。命令行走代理的更多写法见 [命令行与开发工具走代理](/posts/terminal-proxy/)。

### 用外部控制接口单测一个节点

想单独测某一个节点，可以调用 mihomo 的外部控制接口，地址与密钥在配置的 `external-controller`、`secret` 中。Clash Verge Rev 默认不开启这个 HTTP 接口，界面通过命名管道（Windows）或 Unix socket（macOS / Linux）与内核通信。要用下面的命令，先在「设置 → Clash 设置 → 外部控制」里打开「启用外部控制器」，监听地址保持默认的 `127.0.0.1:9097`，并把「API 访问密钥」从公开的占位值 `set-your-secret` 改成自己的随机字符串。不要把监听地址改成 `0.0.0.0` 这类对局域网开放的地址，原因见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)；测完可以再关掉。

```bash
# 需先启用外部控制器；YOUR_SECRET 换成「API 访问密钥」
# 节点名含中文或空格时先做 URL 编码，例如：
# python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' '香港 01'
curl -sS -G -H "Authorization: Bearer YOUR_SECRET" \
  --data-urlencode "url=https://www.gstatic.com/generate_204" \
  --data-urlencode "timeout=5000" \
  "http://127.0.0.1:9097/proxies/NODE_NAME/delay"
```

```powershell
# Windows PowerShell：先编码节点名，再写成一行（反斜杠续行在这里无效）
$n = [uri]::EscapeDataString('香港 01')
curl.exe -sS -G -H "Authorization: Bearer YOUR_SECRET" --data-urlencode "url=https://www.gstatic.com/generate_204" --data-urlencode "timeout=5000" "http://127.0.0.1:9097/proxies/$n/delay"
```

返回 JSON 中的 `delay` 字段即延迟（毫秒），计时方式同样受 unified-delay 影响；超过 `timeout` 时返回 HTTP 504，其他失败返回 503。

`/proxies/节点名/delay` 只能找到写在配置 `proxies:` 里的节点和策略组。手写配置常用代理集合（proxy-providers）引入订阅，这类节点用上面的地址会得到 404，要改用代理集合的接口，`PROVIDER_NAME` 是代理集合的名字，同样需要编码：

```bash
curl -sS -G -H "Authorization: Bearer YOUR_SECRET" \
  --data-urlencode "url=https://www.gstatic.com/generate_204" \
  --data-urlencode "timeout=5000" \
  "http://127.0.0.1:9097/providers/proxies/PROVIDER_NAME/NODE_NAME/healthcheck"
```

两个接口返回的 JSON 格式相同。

### 测速、视频与网页

- **Speedtest**：选择与落地同地区的测速服务器、多测几次，技巧见 [速度慢的常见原因与优化思路](/posts/speed-optimization/)
- **Cloudflare 测速**（speed.cloudflare.com）：除带宽外，还报告空载延迟、负载下延迟和抖动，适合观察缓冲膨胀
- **YouTube 详细统计信息**（Stats for nerds）：网页端在播放器上点右键打开；Android 应用要先在「设置 → 常规」里开启，再从播放页的「更多」菜单打开。看连接速度（Connection Speed）、缓冲区状况（Buffer Health，持续降到接近 0 就会卡）和当前分辨率，字段名称随界面语言和版本可能略有差异
- **网页加载**：浏览器开发者工具 Network 面板的 Timing 分解，能看到连接、TLS、等待首字节和下载各花了多久

测之前都要在客户端的连接页面确认，这些请求走的是目标节点，而不是被规则分到了别的策略组或直连。

### mtr / NextTrace：看路径上的丢包

它们测的是**本机到节点 IP 的直连路径**，不经过代理，适合定位本地、运营商或跨境段的问题，测之前同样要关闭 TUN：

```bash
# mtr 与 NextTrace 需先安装：Debian / Ubuntu 用 apt install mtr-tiny，macOS 用 Homebrew 安装 mtr
# NextTrace 的安装方法见项目主页（文末链接）

# Linux / macOS（通常需要 sudo）：TCP SYN 探测 443 端口，跑 100 轮（约 100 秒）后输出报告并显示 AS 号
sudo mtr -rwzc 100 -T -P 443 203.0.113.10

# NextTrace：TCP 模式、指定端口；加 -t 进入类似 mtr 的持续探测
sudo nexttrace --tcp --port 443 203.0.113.10
sudo nexttrace -t --tcp --port 443 203.0.113.10
```

```powershell
# Windows 自带：pathping 逐跳统计丢包（需要几分钟），tracert -d 只看路径
pathping -n 203.0.113.10
tracert -d 203.0.113.10
```

读报告时**只看「从某一跳开始、一直延续到终点」的丢包**。中间某一跳显示丢包、后续各跳却不丢，通常是那台路由器对发给它自己的探测包限速，并不是真的丢包。

最后，同一个节点至少要在白天和 20:00 到 23:00 之间各测一轮。晚高峰才是大多数线路的真实水平，[如何评估一个机场的质量](/posts/how-to-evaluate/) 中也强调了这一点。

---

## url-test 自动选择组如何利用这些数字

mihomo 的 url-test 组每隔 `interval` 秒对组内节点各做一次 URL Test（同时最多 10 个），在存活节点中找延迟最低的；如果当前节点仍然存活，只有它比最低者慢出 `tolerance` 以上才会切换。

和延迟读数直接相关的几个字段：

| 字段 | 作用 | 未设置时 |
|------|------|---------|
| `url` | 测试地址 | `https://www.gstatic.com/generate_204`；含 `use` 的组先沿用代理集合的 health-check 地址（取第一个设置了地址的集合） |
| `interval` | 测试间隔（秒） | 组内有 `proxies` 时，url-test、fallback 等自动组为 300；代理集合里的节点见下文 |
| `tolerance` | 切换容差（ms） | 文档未写明，按源码为 0 |
| `timeout` | 单次测试超时（ms） | 5000 |

其余字段（`lazy`、`max-failed-times`、`expected-status` 等）见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

策略组与代理集合（proxy-providers）的关系要单独说明。mihomo 文档写的是策略组的 `url` 只检查 `proxies` 字段里的节点，但按 v1.19.31 的源码，组里写了 `url` 时，内核会把它连同组的 `expected-status`、`filter` 注册为所引用代理集合的附加测试地址，集合里的节点也会用这个地址测，url-test 组排序时看的正是这个地址的延迟记录。测试节奏沿用代理集合自己的 `interval`；代理集合没开健康检查时，才采用组上显式写的 `interval`，组上也没写就不会定时测试。文档与源码不一致，升级内核后建议在面板里手动测一次确认。sing-box 的 urltest 出站思路相同，文档写明默认 `interval` 为 3 分钟、`tolerance` 为 50 ms。

### 为什么会「来回跳」

- **每轮只有一个样本**：两个节点只差十几毫秒时，一次抖动就足以让下一轮的排序颠倒
- **容差为 0 或太小**：按源码，不写 `tolerance` 时任何微小差距都会触发切换
- **冷测试放大了协议差异**：unified-delay 关闭时，不同协议的握手次数不同，排序受协议影响而不只是线路
- **晚高峰偶发超时**：某个节点一次超时被排除，下一轮恢复后又被选回
- **组内混了多个地区**：每次切换都可能换到另一个国家的出口 IP

频繁切换的代价是**出口 IP 变化**：登录态可能失效，网站更容易弹出验证，流媒体地区和 AI 服务的风控也可能被触发，见 [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/)。更稳的写法：

```yaml
unified-delay: true            # 用热测试比较线路；Clash Verge Rev 用户在设置页开启

proxy-groups:
  - name: 香港自动
    type: url-test
    include-all: true
    filter: "(?i)港|hk|hong kong"   # 只放同一地区的节点
    url: https://www.gstatic.com/generate_204
    expected-status: 204
    interval: 300                  # 显式写出，代理集合里的节点不会套用 300 的默认值
    tolerance: 50                  # 差距超过 50 ms 才切换
    lazy: true
```

这段写法面向手写配置。Clash Verge Rev 用户不要直接改订阅文件，更新订阅时会被覆盖：`unified-delay` 在设置页开启，策略组通过订阅右键菜单的「编辑代理组」或「扩展脚本」添加，做法见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

对出口 IP 敏感的服务，更适合用 `select` 手动固定或 `fallback` 按顺序兜底，取舍见 [故障检测与自动切换策略](/posts/failover-strategies/)。另外，在 Clash Verge Rev 里手动点选 url-test 组中的节点会把它「固定」下来：只要该节点在健康检查中存活，自动选择就不再生效；固定节点被判定不可用时，组会临时改用延迟最低的存活节点，它恢复后再切回去。界面提示「进行延迟测试，以取消固定」，mihomo 的 API 文档也说明对策略组做延迟测试会清除自动策略组的固定选择。

---

## 实用清单：节点问题还是本地问题

1. **看范围**：全部节点同时超时或同时变高，问题多半在本地或共同环节；只有个别节点异常，多半是节点本身
2. **测本地基线**：关闭代理（包括 TUN），ping 一个国内地址看延迟和丢包。基线本身就在跳、在丢，先解决本地网络
3. **TCPing 入口**：对异常节点和正常节点分别 TCPing，共用同一中转入口的节点一起变差，问题在入口或国内段
4. **对照 URL Test**：打开 unified-delay 后，用 URL Test 减去 TCPing。直连节点的差值大致是落地到测试地址这一段；中转节点的差值还包括跨境段和落地，差值明显偏大说明问题在入口之后
5. **换网络、换时段**：用手机热点重复第 3、4 步；再在白天和晚高峰各测一次
6. **看带宽与日志**：延迟正常仍然慢，就测带宽和丢包；URL Test 失败，就看日志里的认证、TLS 错误

| 观察到的现象 | 更可能的位置 |
|-------------|------------|
| 所有节点超时，直连国内也慢或丢包 | 本地网络或家宽 |
| 所有节点超时，直连国内正常 | 客户端、系统时间、订阅，或服务商整体故障 |
| 同一入口或同一地区的节点一起变差 | 该中转入口或该方向的线路 |
| 单个节点超时，其余正常 | 该节点：被封、宕机或配置变更 |
| 只在晚高峰变差 | 国际出口或节点拥塞 |
| 换成手机热点就正常 | 家宽运营商的线路或本地设备 |

---

## 常见问题（FAQ）

### 为什么 Clash 里显示 300 ms，v2rayN 里同一个节点只有 120 ms？

先看 Clash 一侧是否开了 unified-delay：关闭时 mihomo 计入了建连和多次握手，是冷测试，而 v2rayN 的真连接延迟取两次请求中的较小值，接近热测试。Clash Verge Rev 新版默认开启统一延迟，此时差异主要来自测试地址（Clash Verge Rev 按策略组测试地址、「默认测试链接」、内置 cp.cloudflare.com 的顺序取址，url-test 等自动组通常是 gstatic.com；v2rayN 默认是 google.com）、HEAD 与 GET 的不同以及内核实现。两边数字没必要追求一致，只在同一客户端内部比较。

### 开启 unified-delay 会让网速变快吗？

不会。它只改变测试的计时范围，让不同协议的节点在 url-test 中比较得更公平。实际连接照样需要握手，打开新网站时的首包等待不会因此变短。

### 延迟测试会消耗很多流量吗？

很少。`generate_204` 没有响应内容，一次测试的数据量主要来自 TLS 握手，通常在 KB 量级。不过节点多、间隔短时会产生大量短连接，这也是 `lazy: true` 配合 300 秒左右间隔比较合理的原因。

### 开着 TUN 时 ping 网站的结果异常地低，是网络变好了吗？

不是。TUN 模式下本机发出的探测包会先进入虚拟网卡，Fake-IP 模式还会把域名解析成保留地址，结果反映的是本机代理客户端的处理，而不是到目标的真实路径。做 Ping、TCPing、traceroute 前先关闭 TUN。

### 中转节点 TCPing 只有 15 ms，比直连香港的节点还快？

TCPing 只测到国内的中转入口，跨境段和落地都不在其中。比较中转节点和直连节点要看 URL Test，并且使用同一个测试地址。

### 延迟越低的节点，看视频就越流畅吗？

不一定。视频是否流畅取决于带宽、丢包和晚高峰的拥塞程度，这些都不在一次小请求的测量范围内。挑节点时先用延迟排除超时和明显绕路的，再用测速和 YouTube 详细统计信息做判断。

---

## 外部参考

- [mihomo 文档：全局配置](https://wiki.metacubex.one/config/general/)（unified-delay）、[DNS 配置](https://wiki.metacubex.one/config/dns/)（fake-ip-range）
- [mihomo 文档：策略组](https://wiki.metacubex.one/config/proxy-groups/) 与 [url-test](https://wiki.metacubex.one/config/proxy-groups/url-test/)
- [mihomo 文档：API](https://wiki.metacubex.one/api/)
- [mihomo 源码：adapter.go](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/adapter.go)、[healthcheck.go](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/provider/healthcheck.go)、[outboundgroup/urltest.go](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/outboundgroup/urltest.go)、[outboundgroup/parser.go](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/outboundgroup/parser.go)、[hub/route/proxies.go](https://github.com/MetaCubeX/mihomo/blob/Meta/hub/route/proxies.go)、[hub/route/provider.go](https://github.com/MetaCubeX/mihomo/blob/Meta/hub/route/provider.go)
- [sing-box 文档：URLTest](https://sing-box.sagernet.org/configuration/outbound/urltest/)
- [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)、[v2.5.5 发布页](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/v2.5.5)、[v2.3.0 发布说明](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/v2.3.0) 与 [文档：扩展配置与脚本](https://www.clashverge.dev/guide/extend.html)（由应用接管的字段）
- [v2rayN](https://github.com/2dust/v2rayN)（[7.24.9 的 ConnectionHandler.cs](https://github.com/2dust/v2rayN/blob/7.24.9/v2rayN/ServiceLib/Handler/ConnectionHandler.cs)）、[v2rayNG](https://github.com/2dust/v2rayNG)（[2.2.6 的 RealPingWorkerService.kt](https://github.com/2dust/v2rayNG/blob/2.2.6/V2rayNG/app/src/main/java/com/v2ray/ang/service/RealPingWorkerService.kt)）、[AndroidLibXrayLite：libv2ray_utils.go](https://github.com/2dust/AndroidLibXrayLite/blob/main/libv2ray_utils.go)
- [V2Fly 文档：VMess](https://www.v2fly.org/config/protocols/vmess.html)
- [curl 手册](https://curl.se/docs/manpage.html)、[PsPing](https://learn.microsoft.com/en-us/sysinternals/downloads/psping)、[macOS nc 手册](https://ss64.com/mac/nc.html)、[mtr](https://github.com/traviscross/mtr)、[NextTrace](https://github.com/nxtrace/NTrace-core)
- [How does Cloudflare's Speed Test really work?](https://blog.cloudflare.com/how-does-cloudflares-speed-test-really-work/)
- [YouTube 帮助：发送调试信息](https://support.google.com/youtube/answer/7519898)
- [Corning SMF-28 Ultra 光纤产品资料](https://www.corning.com/media/worldwide/coc/documents/Fiber/product-information-sheets/PI-1424-AEN.pdf)
- [Mathis et al., 1997, The macroscopic behavior of the TCP congestion avoidance algorithm](https://doi.org/10.1145/263932.264023)
- [Dissecting Latency in the Internet's Fiber Infrastructure](https://arxiv.org/abs/1811.10737)
- 站内相关：[速度慢的常见原因与优化思路](/posts/speed-optimization/)、[节点连不上？系统排查流程](/posts/connectivity-checklist/)、[故障检测与自动切换策略](/posts/failover-strategies/)、[直连 vs 中转 vs CDN](/posts/line-types-explained/)
