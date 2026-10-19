---
title: "GFW 如何识别全加密流量：USENIX Security 2023 论文解读与协议设计的应对"
date: 2026-10-19
updated: 2026-10-19
categories:
  - GFW 与审查
tags:
  - GFW
  - 检测
  - 协议检测
  - Shadowsocks
  - 抗检测
  - 全加密
excerpt: "2021 年 11 月至 2023 年 3 月，GFW 曾被动识别并按概率封锁首包看似随机的全加密流量，Shadowsocks、VMess 等都受到影响。本文逐条解读论文推断的五条豁免规则、概率封锁与残留审查机制，以及各实现的应对和它对今天协议选择的意义。"
index_img: /images/posts/fully-encrypted-detection.svg
---

> **摘要**：Shadowsocks、VMess、obfs4 这类全加密协议从第一个字节起就是密文，首包看起来只是一串随机数，过去普遍认为很难靠特征匹配识别。2021 年 11 月起，GFW 启用了一套新的被动检测系统：它并不直接判断「是不是随机」，而是先用几条粗糙但高效的规则豁免「不像随机」的流量，再对发往部分热门 VPS 网段、且未被豁免的连接按约 26% 的概率封锁。GFW Report 等团队在 USENIX Security 2023 论文 How the Great Firewall of China Detects and Blocks Fully Encrypted Traffic 中推断出了这套规则的主体（作者强调规则未必完整），其跟进测试还显示，这套动态封锁已于 2023 年 3 月 15 日停止，此后没有公开测量证实它重新启用。本文用自己的话梳理论文的数据与推断，介绍 Shadowsocks-rust、V2Ray、Outline 等实现的应对与局限，并讨论它对今天选择 SS-2022、VLESS+Reality 等协议的实际意义。

---

## 什么是全加密协议

全加密协议（Fully Encrypted Protocol，论文中文版译作「完全加密」）指从连接的第一个字节开始就全部是密文的代理协议：没有明文握手，没有固定的魔数、版本号或长度字段，外部观察者能看到的只是一串近似均匀分布的随机字节。社区过去常说这类协议「看起来什么都不像」（looks like nothing），论文作者认为更准确的描述是「看起来像随机数」（looks like random）。这一字之差，正是整件事的关键。

| 协议 | 首包在线路上的样子 | 是否属于全加密 |
|------|-------------------|---------------|
| Shadowsocks（流加密、AEAD、2022 版） | 随机 salt 或 IV，后接密文 | 是 |
| VMess（不套 TLS） | 加密的认证信息与指令，后接密文 | 是 |
| obfs4 | 握手消息被设计成与随机字节不可区分 | 是 |
| Trojan、VLESS + TLS / Reality、NaiveProxy、AnyTLS | 明文的 TLS ClientHello | 否，外层是 TLS |
| Hysteria2、TUIC | QUIC 握手包（UDP） | 否；Hysteria2 开启 Salamander 混淆后，UDP 载荷近似随机 |

Shadowsocks 2022 的规范 SIP022 在开头的概述里，把「代理流量与随机字节流不可区分」直接写成对抗 DPI 的设计目标。在 2021 年以前，这确实是社区普遍认可的思路；但 SIP022 是 2022 年才提出的（shadowsocks-org 的 SIP022 讨论帖 issue #196 创建于 2022 年 5 月），它提出时，下文要讲的这套针对随机流量的封锁已经在运行了。

### 为什么它们曾被认为难以检测

传统 DPI 的工作方式是黑名单：先知道某个协议长什么样（固定字段、握手顺序），再去流量里匹配。全加密协议没有任何固定字段可供匹配，黑名单思路就失效了。

GFW 此前也并非无计可施。GFW Report 在 IMC 2020 的论文 How China Detects and Blocks Shadowsocks 中发现：GFW 会根据首个数据包的长度和熵把连接标为「疑似 Shadowsocks」，但真正下结论要靠后续的**主动探测**，即向服务器发送重放包和构造包，观察服务器的反应来确认。主动探测的一般原理见 [GFW 工作原理全解](/posts/gfw-detection-overview/)；IMC 2020 论文记录的探测方式，以及 Shadowsocks 据此做的防御，见 [Shadowsocks 2022 与 ShadowTLS](/posts/ss2022-shadowtls/)，这里不再展开。

于是社区形成了一个默认假设：只要协议能抵抗重放和主动探测（AEAD 方法和各实现的防重放改进已在这方面做了加固，后来的 SS-2022 更进一步），审查方就缺少确认手段，而单凭「看起来随机」就封锁，误伤代价太大，审查方不会这么做。

2021 年 11 月，这个假设被打破了。审查方选择接受一小部分误伤，直接根据被动特征做决定。背后的逻辑并不复杂：当互联网上绝大多数正常流量都带有某种明文结构（TLS 记录头、HTTP 请求行、各种协议的版本号），**完全没有结构**本身就成了最显眼的特征。

---

## 事件时间线与影响范围

论文的观测和后续跟进可以整理成下面这张时间线（日期均来自论文正文、论文的工件附录和作者后续报告）：

| 日期 | 事件 |
|------|------|
| 2021-11-06 | 中国用户开始报告 Shadowsocks、VMess 服务器被封 |
| 2021-11-08 | 一位 Outline 开发者报告来自中国的使用量骤降；同期为十九届六中全会（11 月 8 日至 11 日），论文只指出时间上的重合 |
| 2021-11-16 | 研究团队公开这一新型封锁的细节，距封锁开始 10 天 |
| 2021-11-06 至 2022-05-18 | 主要测量期：3 台中国境内 VPS、3 台美国接收端服务器 |
| 2022-01-13 | 团队把第一个规避方案分享给一批工具开发者 |
| 2022-05-12 | 对 10% 的 IPv4 地址空间做 TCP 80 端口扫描，评估影响范围 |
| 2022-07 至 2022-09 | 在美国科罗拉多大学博尔德分校的网络镜像口上模拟这套规则，评估误伤 |
| 2023-02-16 | 重跑实验，确认所有检测规则仍然成立 |
| 2023-03-07 | 工件附录记录的跟进实验：GFW 仍在封锁随机流量 |
| 2023-03-15 | 同一跟进实验：GFW 已停止对随机流量的动态封锁 |
| 2023-08 | 论文在 USENIX Security 2023 发表 |
| 2024-11 | 这项工作获 2024 年 IRTF 应用网络研究奖（ANRP），第一作者在 IETF 121（2024 年 11 月，都柏林）作获奖报告 |

表中 2023 年 3 月 15 日这一行值得特别注意：论文的工件附录（Artifact Appendix，2023 年 4 月版）写明，作者在 2023 年 3 月 15 日的跟进测试中，重新扫描了 2022 年 8 月 22 日时被标记为受影响的 142,827 个 IP，发现 GFW 已不再动态封锁随机流量。作者在 IETF 121 的报告幻灯片里也把 2023 年 3 月 15 日标为「动态封锁停止」。也就是说，**论文描述的是一套 2021 年 11 月至 2023 年 3 月期间实际运行、之后被关停（至少暂停）的系统**。现状如何，后文单独讨论。

### 只针对部分 IP 段

这套系统并不是对全网所有 TCP 连接一视同仁：

- **概率封锁**：对于受影响的服务器，每条命中规则的连接大约有 26.3% 的概率被封。作者统计了 109,489 个受影响 IP 上「连续成功多少次才被封」的分布，结果符合几何分布，由此估出这个概率。
- **只针对特定 IP 段**：2022 年 5 月的扫描中，能够明确标注的约 550 万个 IP 里，98% 完全不受影响。
- **按自治系统看**：这些 IP 分属 538 个 AS（每个 AS 至少有 5 个结果）。超过 90% 的 AS 呈现「要么全受影响、要么全不受影响」的特征；超过 95% 的 AS 受影响 IP 不到 10%；受影响 IP 超过 30% 的 AS 只有 7 个。
- **受影响的是谁**：重度受影响的例子有 Alibaba US、Constant（The Constant Company，即 Vultr 的运营方）；Amazon、DigitalOcean、Linode 则是部分网段受影响、部分不受影响；Akamai、Cloudflare 不受影响。Linode 在 2022 年 3 月被 Akamai 收购，现以 Akamai Connected Cloud 的名义运营，论文仍把两者分开列出，这里的 Akamai 指其自有网络。论文的结论是，所有受影响或部分受影响的 AS 都是适合搭建代理的热门 VPS 提供商。

扫描中判断「受影响」的方法也值得一提：向目标发送随机数据后，如果连续 5 次连接都超时，就标为受影响；如果 25 次连接全部成功，就标为不受影响。上限设为 25 次，正是因为封锁是概率性的。

换句话说，审查方把这套代价不低的检测限定在「代理最可能出现的地方」，而不是整个互联网。机房 IP 与家宽 IP 的区别可参考 [什么是原生 IP、广播 IP、住宅 IP](/posts/ip-types/)。

---

## 检测逻辑：先豁免，剩下的封

论文最重要的发现是：GFW 并没有直接定义「什么是全加密流量」，而是反过来，先定义「什么流量**不大可能**是全加密流量」，把它们放行，剩下的全部列为封锁候选。论文把推断出的规则整理为算法 1，下表是用我们的话复述的版本，规则只作用于**客户端发出的第一个 TCP 数据包**：

| 规则 | 豁免条件 | 背后的直觉 | 顺带放行了哪些正常流量 |
|------|---------|-----------|----------------------|
| Ex1 | 每字节平均置位比特数不高于 3.4，或不低于 4.6 | 随机数据每字节平均约有 4 个比特为 1，明显偏离 4 的数据不像密文 | 含大量零字节的二进制协议，例如 DNS over TCP |
| Ex2 | 前 6 个字节全部是可打印 ASCII（0x20 至 0x7e） | 文本协议开头通常是可读的命令或标识 | SSH、SMTP、FTP 等以可读字符串开头的协议 |
| Ex3 | 超过一半的字节是可打印 ASCII | 文本占比高，不像密文 | 各类以文本为主的协议 |
| Ex4 | 存在超过 20 个连续的可打印 ASCII 字节 | 密文里几乎不会出现长串可读字符 | 夹带一段明文的协议 |
| Ex5 | 匹配 TLS 或 HTTP 的协议指纹 | 互联网上最常见的两类流量，必须放行 | HTTPS、明文 HTTP |

五条规则都不满足时，连接成为封锁候选。

### Ex1：每字节平均置位比特数

popcount 是指一个字节的二进制表示中 1 的个数。均匀随机的数据里，每个比特为 1 的概率是一半，所以每字节平均约有 4 个 1。规则 Ex1 计算 `popcount(pkt) / len(pkt)`，只要结果不高于 3.4 或不低于 4.6 就豁免，可以理解为一种非常廉价的「熵检测」。

作者用两组实验确定了这条规则。第一组把同一个字节重复 100 次，遍历全部 256 种字节，只有 40 种触发了封锁，恰好都是每字节含 4 个 1、又不是可打印字符的取值（含 4 个 1 的字节共 70 个，其中 30 个是可打印字符，会被后面的 Ex2 至 Ex4 放行），由此猜到规则与置位比特数有关。第二组构造了 401 个 50 字节的比特串，分别含 0 到 400 个 1，由此定出阈值：每字节平均 1 的个数不高于 3.4 或不低于 4.6 的都不封；介于两者之间的，除一个因可打印字符过半而被豁免的样本（4.26 比特每字节）外，全部被封。

### Ex2 至 Ex4：可打印字符

这三条都围绕可打印 ASCII（0x20 至 0x7e，共 95 个取值）展开，作者推测目的是放行人类可读的明文协议。一个有意思的细节是：作者测试了 6 至 36 个 UTF-8 或 GBK 编码的中文字符，**全部被封**，说明规则对中文没有任何豁免。论文猜测原因是这类编码在首包里罕见，或者解析成本较高。

### Ex5：TLS 与 HTTP 指纹

- **TLS**：首包前 3 个字节匹配正则 `[\x16-\x17]\x03[\x00-\x09]` 即豁免。0x16 是 TLS 握手记录，0x17 是应用数据记录，第二、三字节是版本号。0x17 这一条来得比较曲折：作者用大学网络中记录到的约 44 万种不同前缀构造载荷逐一测试，其中只有一个前缀被 GFW 豁免，顺着它才发现了 TLS 应用数据记录这条豁免。
- **HTTP**：首包以 `GET `、`PUT `、`POST `、`HEAD ` 开头即豁免。方法名后面的空格（0x20）不可省略，方法名不区分大小写，`get ` 和 `GeT ` 也算。

注意 Ex5 只看开头几个字节，并不验证后面是否真的是合法的 TLS 或 HTTP。这一点直接决定了后文「加前缀伪装」为什么能奏效，也决定了它为什么不可靠。

### 用代码复述规则

论文的公开工件仓库里有作者自己的实现（`artifacts/utils/detect.py`）。它与论文正文有两处细节不同：HTTP 方法按区分大小写比较，TLS 记录头第三个字节放宽到 0x0f。下面严格按论文正文的算法 1 和第 4 节写一个简化版。五条规则是「任一满足即放行」的关系，论文无法推断 GFW 实际按什么顺序检查，代码里的顺序只是为了便于阅读：

```python
def is_printable(b: int) -> bool:
    return 0x20 <= b <= 0x7E

def exempt(pkt: bytes) -> bool:
    """按论文算法 1 判断首包是否被豁免；返回 False 表示成为封锁候选"""
    n = len(pkt)
    if n == 0:
        return True
    # Ex1：每字节平均置位比特数
    ones = sum(bin(b).count("1") for b in pkt) / n
    if ones <= 3.4 or ones >= 4.6:
        return True
    # Ex2：前 6 个字节全是可打印 ASCII
    if n >= 6 and all(is_printable(b) for b in pkt[:6]):
        return True
    # Ex3：超过一半的字节是可打印 ASCII
    if sum(is_printable(b) for b in pkt) > n / 2:
        return True
    # Ex4：存在超过 20 个连续的可打印 ASCII
    run = 0
    for b in pkt:
        run = run + 1 if is_printable(b) else 0
        if run > 20:
            return True
    # Ex5：TLS 记录头或 HTTP 方法
    if n >= 3 and pkt[0] in (0x16, 0x17) and pkt[1] == 0x03 and pkt[2] <= 0x09:
        return True
    for m in (b"GET ", b"PUT ", b"POST ", b"HEAD "):
        if pkt[:len(m)].upper() == m:
            return True
    return False
```

拿几种首包试一试：

```python
import os

print(exempt(os.urandom(300)))                          # 几乎总是 False：像全加密流量
print(exempt(b"POST " + os.urandom(300)))               # True：命中 Ex5 的 HTTP 规则
print(exempt(bytes([0x16, 0x03, 0x01]) + os.urandom(300)))  # True：命中 Ex5 的 TLS 规则
print(exempt("你好世界".encode("utf-8") + os.urandom(40)))  # 通常为 False：中文不被豁免
```

### 一个随机首包有多大概率逃过

如果首包真的是均匀随机的字节，它碰巧被豁免的概率有多大？下面是本文按二项分布做的估算（不是论文数据）：

| 首包长度 | 碰巧满足 Ex1 的概率 | 说明 |
|---------|-------------------|------|
| 10 字节 | 约 22% | 样本太少，平均值波动大 |
| 20 字节 | 约 7% | |
| 50 字节 | 约 0.3% | |
| 100 字节 | 约 0.0025% | |
| 200 字节以上 | 可以忽略 | |

Ex2 要求前 6 个字节都落在 95 个可打印取值里，随机命中的概率约为 (95/256) 的 6 次方，约 0.26%；Ex3 在 100 字节时约 0.3%；Ex4 则小到可以忽略。代理协议的首包通常带着目标地址和一部分应用数据，长度往往在几百字节，所以**一个真正的全加密首包几乎不可能靠运气逃过这套规则**。反过来，只要在开头动一点手脚，就能稳定地命中某条豁免。

### 误伤有多大

作者在科罗拉多大学博尔德分校一个 40 Gbps 的网络镜像口上，用 2022 年 7 月至 9 月的流量做了模拟：共分析约 17 亿条 TCP 连接，若不考虑「只封 26%」和「只针对部分 IP 段」这两层限制，约 0.6% 的连接会被这套规则命中，约 970 万条。被命中的连接里，最常见的几种首包前缀出现在 5222、8000 等端口上，其中很多协议作者无法识别，但从出现频率和低熵特征看，论文认为它们不太可能是全加密代理，也就是误伤。作者在 IETF 121 报告的幻灯片中还提到，大学网络的全部流量中约 89% 因匹配 TLS 指纹而被豁免（这个数字只见于幻灯片）。论文同时指出，TLS ClientHello 含大量零字段，比特熵本来就低，多半也能被 Ex1 豁免；单独列出 TLS 和 HTTP，可能只是为了用最省事的方式快速放行大部分流量。

0.6% 听起来不多，但放到全国出口流量上是一个巨大的绝对数。论文推测，审查方叠加概率封锁和 IP 段限制，可能正是为了把误伤压到可接受的范围；概率封锁也可能是为了节省计算资源，只需检查约四分之一的连接。

---

## 封锁怎么执行：被动检测、概率封锁与残留审查

规则只回答了「封谁」，论文还细致测量了「怎么封」：

| 特征 | 论文的观察 |
|------|-----------|
| 协议范围 | 只针对 TCP；向同一服务器发送随机内容的 UDP 数据报不会触发 |
| 方向 | 只有客户端发往服务器的数据能触发；服务器发出的随机数据不会触发 |
| 检查对象 | 只分析连接中的第一个数据包，不做 TCP 重组。先发 1 字节可打印字符、再发 200 字节随机数据的连接从未被封 |
| 时机 | 不等服务器回 ACK 就会封锁；连接状态至少保留 5 分钟 |
| 端口 | 1 至 65535 全部端口都可能被封，未观察到端口差异 |
| 封锁动作 | 丢弃客户端发往服务器的数据包；服务器发出的数据包照常到达客户端 |
| 概率 | 每条命中规则的连接约 26.3% 被封 |

### 残留审查

一旦某条连接被封，GFW 会在随后 120 或 180 秒内（论文的测量方法按 180 秒处理）丢弃同一个**三元组**（客户端 IP、服务器 IP、服务器端口）上的所有后续连接，这就是残留审查（residual censorship）。期间继续发包不会重置计时器。作者还发现，同时对 500 个端口触发封锁时，约 40% 的残留封锁只持续了 10 秒，推测审查方对同时进行的残留封锁数量设有上限。

残留审查放大了概率封锁的效果。单看一条连接，被封概率只有约四分之一；但代理客户端会频繁新建连接，按 26.3% 计算，连续 10 条连接里至少有一条被封的概率约为 95%。一旦被封，同一端口就要等两三分钟。用户的直观感受是：节点时好时坏，刷新几次就彻底断开，过几分钟又能用。

论文还强调，在实验中 GFW 从未把他们的机器 IP 封锁超过 180 秒。这套系统本身造成的是**连接级、短时的封锁**，不是长期封 IP。

### 与主动探测的关系

这是一个独立于主动探测的新系统，两者并行工作：

- **封锁不依赖探测**：超过 99% 的测试中，GFW 在封锁前没有发送任何主动探测。作者总共建立了 33,119 条连接，只收到 179 个探测。
- **探测系统用的是同一套规则**：触发主动探测的条件同样是这五条豁免规则，外加一条长度规则。实验中只有 200 字节的载荷触发过探测，2 字节和 50 字节的都没有。
- **探测系统也在演化**：一些在 2019 年能触发探测的载荷，如今已被豁免。

如果用一张流程图概括：

```text
客户端发出首个 TCP 数据包
  ├─ 目标 IP 不在受监控网段 ─────────────→ 放行
  ├─ 满足 Ex1 至 Ex5 任一条 ────────────→ 放行
  └─ 五条都不满足（像随机数）
        ├─ 约 73.7% ──→ 本次放行
        └─ 约 26.3% ──→ 丢弃客户端发往服务器的包
                         并在 120 或 180 秒内封锁同一三元组
```

---

## 社区的应对

研究团队在 2022 年 1 月 13 日把第一个规避方案分享给一批工具开发者，随后各家陆续跟进。下表按时间整理，均以项目的提交记录、PR 或官方文档为准：

| 项目 | 时间 | 做法 | 后续 |
|------|------|------|------|
| Shadowsocks-rust | 2022-01-14 加入，当天改为非默认的编译特性 security-iv-printable-prefix | 把随机 salt 的前 6 个字节替换为可打印字符，用户需自行编译才能启用 | 2022-09-12 移除，起因见下文 |
| V2Ray（v2fly） | PR #1552，2022-01-15 合并，随 v5.0.3 发布 | v5 的 Shadowsocks 出站账户新增实验性字段 `experimentReducedIvHeadEntropy`，把 IV 前 6 字节映射为可打印字符，只需改客户端。只能用 v5 配置格式，v4 版本和 v4 JSON 格式都不支持，官方文档也未收录 | 作者在 PR 中提醒：开启后，处于网络路径上的观察者可能识别出该协议 |
| SagerNet | 2022-01 | 在其 v2ray-core 分支中移植同一选项，并同时暴露在 v4 JSON 配置里 | 与 v2fly 的做法相同 |
| shadowsocks-go | 2022-10-04 | 新增 `unsafeRequestStreamPrefix` 和 `unsafeResponseStreamPrefix`（仅用于 SS-2022），值以 base64 编码填写（例如 `POST ` 写作 `UE9TVCA=`），作为明文前缀加在请求流和响应流前面，客户端与服务端需配置同一对前缀 | 名称中的 unsafe 本身就是警示 |
| GFW Report 修改版 Shadowsocks | 2022-10 中旬 | 基于 Shadowsocks-rust，调整比特分布（见下文） | 与标准 Shadowsocks 不兼容 |
| Outline | 论文记为 2022-10-25 采用；客户端 PR #1454 于 2022-11-10 合并 | 访问密钥支持 prefix 选项，用前缀替换 Shadowsocks salt 的开头字节；只支持经典 AEAD 方法，不支持 SS-2022 | prefix 选项要求客户端 1.9.0 及以上，YAML 配置格式要求 1.15.0 及以上；官方文档现另提供 Shadowsocks-over-WebSocket，用于应对此类协议被封锁的情况 |

论文还记录了几项效果：Outline 开发者在 2023 年 1 月反馈，参与匿名统计的服务器数量翻了一倍；同月，一家大型中国翻墙服务商也采用了论文提出的方案；Lantern 开发者表示，采用后的协议承载了他们在伊朗的大部分流量。据论文所述，截至 2023 年 2 月中旬，这些方案在中国仍然有效。

至于 Xray-core，在我们查到的资料里没有看到它为 Shadowsocks 加入类似的前缀选项。它的方向是 TLS 路线：2023 年 3 月发布的 v1.8.0 把 REALITY 作为发布说明的第一项。2025 年 8 月合并的 VLESS Encryption（PR #5067）更直接：维护者在说明中称 GFW 已把「全随机数外观」列入黑名单，因此它的 native（原生）外观有意不做成全随机：握手部分保留了公钥的结构特征，握手之后的数据记录使用与 TLS 1.3 应用数据相同的 `17 03 03` 记录头（PR 称这样做是为了在开启 XTLS 时，让观察者难以分辨何时开始直接转发）；另有 xorpub、random 两种可选外观。维护者同时强调，这项加密不是用来直接过墙的，过墙应使用 REALITY、XHTTP、Vision 等。

需要注意，不能据此认为 VLESS Encryption 能命中 Ex5 豁免。按论文的规则，GFW 只检查客户端首包的开头；而 VLESS Encryption 无论 1-RTT 还是 0-RTT，每条连接的首包都以 16 字节随机 IV 开头，后面接 X25519 公钥或 ML-KEM-768 密文（见 Xray-core 源码 proxy/vless/encryption/client.go），`17 03 03` 记录头只出现在其后的数据记录上。所以按 2021 至 2023 年的规则，它的首包仍会落进「像随机数」的候选集合，这和维护者「不是用来直接过墙」的说法是一致的。

### 加前缀伪装的原理

几乎所有快速应对都属于同一类：**在随机数据前面加一小段「看起来像别的东西」的字节**，让首包命中某条豁免规则。

```text
原始 Shadowsocks 首包（全随机）：
  8f 3a c1 07 e2 5d 91 ...           → 五条规则都不满足，成为封锁候选

前 6 字节改为可打印字符（V2Ray、Shadowsocks-rust 的做法）：
  6b 51 7a 2d 48 70 | 91 ...          → 命中 Ex2

加 HTTP 方法前缀（Outline、shadowsocks-go 可配置）：
  50 4f 53 54 20 | 8f 3a c1 ...       → "POST " 命中 Ex5

加 TLS 记录头前缀：
  16 03 01 ... | 8f 3a c1 ...         → 命中 Ex5 的 TLS 规则
```

以 Outline 为例，按官方文档的动态访问密钥 YAML 格式，给 TCP 加前缀大致是这样写（`SECRET` 等为占位符）：

```yaml
transport:
  $type: tcpudp
  tcp:
    $type: shadowsocks
    endpoint: ss.example.com:80
    cipher: chacha20-ietf-poly1305
    secret: SECRET
    prefix: "POST "    # 模仿 HTTP 请求，端口也相应选 80
  udp:                 # tcpudp 类型需同时写 udp 段，否则 UDP 不走 Shadowsocks
    $type: shadowsocks
    endpoint: ss.example.com:80
    cipher: chacha20-ietf-poly1305
    secret: SECRET     # UDP 前缀另有一张表，这里不加
```

注意，这种 YAML 格式需要 Outline 客户端 1.15.0 及以上，而 prefix 选项本身从 1.9.0 起才支持。1.9.0 至 1.14 的客户端用不了这段 YAML，可改为把 URL 编码后的前缀以 `&prefix=` 的形式加在 ss:// 链接末尾（这种写法只对 TCP 生效）；更早的客户端则完全不支持前缀。另外，Outline 只支持经典 AEAD 方法（如 chacha20-ietf-poly1305、aes-256-gcm），不支持 SS-2022 的 2022-blake3 系列方法。

文档同时给出了几条约束：

- **前缀不超过 16 字节**：前缀占用的是 salt 的开头，越长随机部分越短，可能导致 salt 碰撞，既削弱加密安全，也会让连接更容易被识别；
- **能短则短**：用能绕过当前封锁的最短前缀；
- **端口与所模仿的协议一致**：模仿 HTTP 就用 80，模仿 TLS 就用 443 等；
- **ss:// 链接里的 prefix 只对 TCP 生效**。

还有一处要留意：Outline 文档前缀表中 TLS Application Data 一项写的首字节是 0x13，而 TLS 应用数据记录的类型值是 0x17。按论文的 Ex5 规则，只有 0x16 和 0x17 开头才会被豁免，0x13 开头不在其列。模仿 TLS 时，用表中以 0x16 0x03 开头的 ClientHello 前缀更符合论文测到的规则。

### 前缀方案的局限

论文作者自己就把前缀方案定位为权宜之计，认为审查方可以相当容易地封掉它：

1. **跳过开头再检测**：审查方只需跳过前几个字节，再对剩余数据套用同样的规则；
2. **更严格的规则或主动探测**：例如真正解析 HTTP 请求行或 TLS 记录，而不是只看前 3 至 5 个字节。`POST ` 后面紧跟一串随机字节，任何认真解析的中间设备都会发现这不是合法的 HTTP；
3. **固定前缀本身就是指纹**：所有连接都以同样几个字节开头、后面又是高熵数据，这个组合本身就很特别。V2Ray 的 PR 也提醒，开启这类实验选项后，网络路径上的观察者可能识别出该协议；
4. **安全与兼容代价**：可打印化会降低 salt 或 IV 的随机性。论文认为，32 字节的 salt 固定前 6 字节后仍有 26 个随机字节，对加密安全影响不大，但前缀越长风险越高（Outline 文档也因此限制前缀不超过 16 字节）。争议更大的是可识别性和可控性：shadowsocks-go 维护者 database64128 在 shadowsocks-org 的 issue #204 中批评这类功能未经公开讨论就加入实现，会让 Shadowsocks 更易被识别，而且任何客户端都能自行开启，服务端无从控制。Shadowsocks-rust 作者回复说，这只是供用户测试的功能，看不到明显收益，可以立即移除；第二天（2022-09-12），由 database64128 编写的提交 26b2a1d 把该特性从仓库中删除。

更根本的问题在于模仿本身。论文引用了 Houmansadr 等人 2013 年的论文 The Parrot is Dead，其结论是：**模仿某个协议从根本上是有缺陷的**，因为要在所有细节上都像，几乎不可能；更稳健的做法是真正通过被允许的协议建立隧道。这正是 TLS 类协议走的路。

### 改变比特分布：更长期的思路

论文提出的另一种方案针对 Ex1：在密文中补入额外的 1 或 0，把每字节平均置位比特数推到 3.4 以下或 4.6 以上，再用双方共享的密钥对比特顺序做置换，接收方据此还原。最坏情况（从 4 推到 4.6）带来约 17.6% 的流量开销。作者也指出，如果所有连接的平均置位比特数都固定在同一个值，这本身又会成为指纹，所以目标值需要随机化。

论文正文的附录 A 还列了几种临时办法：改用 UDP 或 QUIC（当时不受影响，但作者警告审查方可以把检测扩展到 UDP）、对首包做 Base64 编码让可打印字符过半、在密文中插入 21 个以上连续可打印字符等。作者明确表示，这些都不是长期方案。

---

## 对今天协议选择的意义

### 这套规则现在还在用吗

如实地说：**公开的一手测量只覆盖到 2023 年 3 月**。论文的工件附录和作者 2024 年的报告都记录了 2023 年 3 月 15 日动态封锁停止；在我们查到的范围内，没有找到之后同一套规则被重新启用的公开测量。另一方面，Xray 维护者在 2025 年 8 月的 PR 中称 GFW 已把全随机外观列入黑名单，这是实践者的判断，并未附带测量数据。

比较稳妥的理解是：这套系统证明了审查方**有能力、也愿意**按「看起来随机」做大规模被动封锁，并且可以随时开关。它的启用与 2021 年 11 月的六中全会时间重合；作者的报告幻灯片里，停止时间则在 2023 年 3 月 13 日全国人大会议闭幕两天之后。这些只是时间上的对应，论文并未断言因果关系。论文也提到，伊朗据报道同样在封锁和限速全加密代理。协议设计不能假设它不会回来。

### TLS 类协议为什么不受这套规则影响

VLESS + Reality、Trojan、NaiveProxy、AnyTLS 等协议的首包是标准的 TLS ClientHello，开头就是 `16 03 01`，直接命中 Ex5，根本不会进入「像随机数」的候选集合。TLS 握手中还有大量固定字段和零填充，论文也提到 ClientHello 的比特熵相对较低。

但这只说明它们躲开了**这一套**规则，不说明它们没有其他问题。2022 年 10 月 3 日起，超过 100 名用户报告自己至少有一台基于 TLS 的翻墙服务器被封，涉及 Trojan、Xray、V2Ray TLS + WebSocket、VLESS、gRPC 等，GFW Report 当时推测与这些客户端的 TLS 指纹有关，但尚未经测量证实（net4people/bbs#129）。TLS 类协议面对的是另一套检测：TLS 指纹、SNI 与证书是否匹配、主动探测时的回落行为。这部分见 [TLS 指纹识别：JA3/JA4 与反检测策略](/posts/tls-fingerprinting/) 与 [VLESS + Reality 深度解析](/posts/vless-reality-deep-dive/)。

Hysteria2、TUIC 等基于 QUIC 的协议走 UDP，不在这套只针对 TCP 的系统范围内。但 GFW 从 2024 年 4 月 7 日起开始按 SNI 封锁 QUIC 连接（见后文），而开启 Salamander 混淆的 Hysteria2 把 UDP 载荷变成了近似随机的字节，等于在 UDP 上重新站到了「看起来随机」这一边。

### SS-2022 仍是全加密协议意味着什么

一种常见的说法是把 SS-2022 与 VLESS+Reality 并列为「抗 DPI 检测能力最强」的方案。结合这篇论文，这个说法需要拆开来看：

| 维度 | SS-2022 的表现 | 依据 |
|------|---------------|------|
| 内容能否被解析 | 不能，AEAD 加密 | SIP022 规范 |
| 重放与主动探测 | 明显强于旧版：时间戳校验、salt 去重，处理失败时行为统一 | SIP022 规范 |
| 被动流量分类 | 属于全加密类，首包是随机 salt 加密文，正是本文规则的目标 | SIP022 的设计目标即「与随机字节流不可区分」 |
| 应对随机外观封锁 | 协议本身无对策，需另加前缀或套 TLS 外壳 | shadowsocks-go 的 unsafeRequestStreamPrefix / unsafeResponseStreamPrefix（仅 SS-2022，两端都要配置，值为 base64 编码）；或套 ShadowTLS 等 TLS 外壳。Outline 的 prefix 只适用于经典 AEAD，不支持 SS-2022 |

所以更准确的结论是：**SS-2022 在「DPI 看不懂内容」和「抗主动探测」上很强，但在「不被认出是全加密流量」上没有任何优势**。审查方只要愿意承担少量误伤，就能按「不像任何已知协议」把它挑出来，2021 至 2023 年的事实已经证明这条路可行。把两者并列为抗 DPI 最强，忽略了两者面对的是完全不同的检测思路：SS-2022 赌的是审查方不敢封随机流量，VLESS+Reality 赌的是审查方不能封主流 TLS。本站 [如何评估一个机场的质量](/posts/how-to-evaluate/) 给出的排序 VLESS + Reality > Trojan > SS-2022 >> VMess，与这一判断是一致的。

如果仍想使用 SS-2022，常见做法是给它加一层真正的 TLS 握手外壳，例如 ShadowTLS，原理与取舍见 [Shadowsocks 2022 与 ShadowTLS](/posts/ss2022-shadowtls/)。

### 实用建议

1. **区分症状**：按论文测到的行为，这套系统（2023 年 3 月已停止；若重新启用）造成的是「连接级、两三分钟、同一端口」的封锁。如果节点是长期整 IP 不通，原因通常在别处，排查思路见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)；
2. **不要只押一类协议**：在敏感时期或高审查网络中，至少准备一个 TLS 类协议（如 VLESS + Reality）作为备选，详见 [敏感时期封锁加强的规律与应对](/posts/sensitive-periods/)；
3. **前缀只是权宜之计**：确实需要时，按实现文档的约束使用，并清楚它可能被更新的规则绕过；
4. **关注一手研究**：GFW Report、net4people 论坛的测量报告，比转述来得可靠。

> 风险提示：本文只讨论技术原理，不构成使用建议。在中国大陆，使用未经批准的跨境通道可能违反当地法律法规；很多 VPS 服务商的服务条款也限制代理用途，违规可能导致账号被封或实例被停。是否使用、如何使用，请自行评估法律与账号安全风险。

---

## 论文之后的研究

GFW Report 等团队此后的研究方向值得一提：USENIX Security 2025 论文 Exposing and Circumventing SNI-based QUIC Censorship of the Great Firewall of China 发现，GFW 自 2024 年 4 月 7 日起会大规模解密 QUIC Initial 包并按 SNI 封锁，但解密开销使其在中等负载下效果下降；NDSS 2025 论文 Wallbleed 则揭示了 GFW DNS 注入设备的内存泄露漏洞。2025 年的大规模内部资料泄露事件见 [2025 年 GFW 泄露事件](/posts/gfw-leak-2025/)。在协议设计一侧，Fenske 与 Johnson 2024 年的论文尝试为全加密协议给出形式化安全定义，并指出现有实现在出错处理和最小消息长度上仍可被区分。

---

## 常见问题（FAQ）

### 我的 SS 节点被封，是不是因为这个？

不一定，甚至大概率不是。第一，按论文作者的跟进测试，这套动态封锁在 2023 年 3 月 15 日已经停止，之后没有公开测量证实它被重新启用。第二，它的封锁是连接级的：同一三元组 120 或 180 秒，其他端口、UDP 都不受影响，实验中从未把 IP 封锁超过 180 秒。如果你的节点是数天整 IP 不通、ping 不通，更可能是 IP 被列入黑名单，属于 [为什么你的节点会被封](/posts/node-blocking-causes/) 中讨论的其他原因。当然，审查方完全可能用这类规则先发现可疑服务器，再交给其他系统处理，这一点论文没有测量，无法确认。

### 熵检测会误伤正常流量吗？

会。论文估算，若对所有 TCP 连接套用这套规则，大学网络中约 0.6% 的连接会被命中，其中大量是作者无法识别、但论文认为不太可能是全加密代理的协议。中文文本开头的连接也不被豁免。审查方用「只封约 26%」和「只针对热门 VPS 网段」两层限制来控制误伤。理论上，任何直接在 TCP 上发送压缩或加密数据、又没有明文头部的自定义协议，都有可能被误判。

### 既然只检查第一个包，把首包拆成两段不就行了？

论文确实观察到，先发 1 字节可打印字符、再发 200 字节随机数据的连接从未被封。但关键在于第一段本身就满足了豁免条件（只有 1 个可打印字节，可打印比例 100%），并不是「拆开」这个动作起了作用：如果第一段仍是几十上百字节的随机数据，拆分并不能逃过检测。附录 A 还提到用审查方会检查、但服务器会忽略的诱饵包等办法。这些都依赖当时规则的实现细节，审查方改为重组前几个包或延后判断就会失效，作者也明确称其为权宜之计。

### 给 SS 加一个 HTTP 或 TLS 前缀，是不是一劳永逸？

不是。前缀只骗过了「看开头几个字节」的规则，后面的数据仍然是随机的，任何真正解析协议的检测都能识破；固定前缀加高熵数据的组合本身还可能成为新指纹。Outline 文档也要求前缀尽量短、端口与所模仿的协议一致。想要长期稳定，更合理的方向是真正的 TLS 隧道或 TLS 外壳。

### Hysteria2、TUIC 这类 UDP 协议受影响吗？

不受这一套影响，论文明确测到该系统只针对 TCP，随机内容的 UDP 数据报不会触发。但作者提醒审查方可以把检测扩展到 UDP，而 2024 年起的 QUIC SNI 封锁已经说明 UDP 也在审查范围内。协议细节见 [Hysteria2 与 TUIC：基于 QUIC 的协议](/posts/quic-protocols/)。

### 为什么 GFW 只封约四分之一的连接，而不是全部？

论文给出的推测有两个：只检查约四分之一的连接可以节省计算资源，同时也能减少对非翻墙连接的误伤。对代理用户来说，这个比例并不宽松。客户端会频繁新建连接，再叠加两三分钟的残留封锁，实际体验就是节点频繁断流、几乎不可用。

### 这些规则会不会已经变了？

很可能。论文自己就记录了主动探测系统从 2019 年到 2022 年的变化：一些曾经触发探测的载荷后来被豁免了。本文的阈值和规则只代表 2021 年 11 月至 2023 年 3 月间测到的状态，应当把它理解为「审查方的一种思路」，而不是可以长期依赖的精确参数。

---

## 外部参考

- 论文与附录：[论文英文版（GFW Report）](https://gfw.report/publications/usenixsecurity23/en/)、[论文中文版](https://gfw.report/publications/usenixsecurity23/zh/)、[USENIX Security 2023 论文页](https://www.usenix.org/conference/usenixsecurity23/presentation/wu-mingshi)、[论文工件附录 PDF](https://www.usenix.org/system/files/usenixsecurity23-appendix-wu-mingshi.pdf)、[工件仓库](https://github.com/gfw-report/usenixsecurity23-artifact)
- 作者后续报告：[IRTF ANRP 获奖名单](https://www.irtf.org/anrp/)、[IETF 121 ANRP 报告幻灯片](https://www.irtf.org/anrp/IETF121-ANRP-Wu.pdf)
- 早期研究：[How China Detects and Blocks Shadowsocks（IMC 2020）](https://gfw.report/publications/imc20/en/)
- 各实现的应对：[v2fly/v2ray-core PR #1552](https://github.com/v2fly/v2ray-core/pull/1552)、Shadowsocks-rust 提交 [53aab48（首次加入）](https://github.com/shadowsocks/shadowsocks-rust/commit/53aab484f8daba6f5cee6896b034af943cc3d406)、[312faea（改为 security-iv-printable-prefix 特性）](https://github.com/shadowsocks/shadowsocks-rust/commit/312faea756eee2c170903689a8ab3c162f10480c)、[26b2a1d（2022-09-12 移除）](https://github.com/shadowsocks/shadowsocks-rust/commit/26b2a1d65769c6311737d62f4818c5f409f7340e)、[shadowsocks-org issue #204](https://github.com/shadowsocks/shadowsocks-org/issues/204)、[shadowsocks-go（README 中的 Unsafe Stream Prefix）](https://github.com/database64128/shadowsocks-go)、[Outline 客户端 PR #1454](https://github.com/OutlineFoundation/outline-apps/pull/1454)、[Outline：Connection Prefix Disguises](https://developer.getoutline.org/vpn/advanced/prefixing/)、[Outline：Dynamic Access Keys](https://developer.getoutline.org/vpn/management/dynamic-access-keys/)、[Outline：Access Key Configuration](https://developer.getoutline.org/vpn/management/config/)、[outline-sdk 支持的加密方法（cipher.go）](https://github.com/OutlineFoundation/outline-sdk/blob/main/transport/shadowsocks/cipher.go)、[GFW Report：Sharing a modified Shadowsocks](https://gfw.report/blog/modified_shadowsocks/en/)、[Xray-core PR #5067（VLESS Encryption）](https://github.com/XTLS/Xray-core/pull/5067)、[Xray-core VLESS Encryption 客户端源码](https://github.com/XTLS/Xray-core/blob/main/proxy/vless/encryption/client.go)
- 协议规范：[SIP022：Shadowsocks 2022 Edition](https://shadowsocks.org/doc/sip022.html)、[shadowsocks-org issue #196（SIP022 讨论帖）](https://github.com/shadowsocks/shadowsocks-org/issues/196)、[Hysteria 2 完整服务端配置](https://v2.hysteria.network/docs/advanced/Full-Server-Config/)
- 相关事件与后续研究：[net4people/bbs#129：TLS 类工具大规模被封](https://github.com/net4people/bbs/issues/129)、[SNI-based QUIC Censorship（USENIX Security 2025）](https://gfw.report/publications/usenixsecurity25/en/)、[Wallbleed（NDSS 2025）](https://gfw.report/publications/ndss25/en/)、[Bytes to Schlep? Use a FEP（arXiv）](https://arxiv.org/abs/2405.13310)

**站内相关文章**：

- [GFW 工作原理全解：从 DNS 污染到主动探测的六层检测机制](/posts/gfw-detection-overview/)
- [TLS 指纹识别：JA3/JA4 与反检测策略](/posts/tls-fingerprinting/)
- [Shadowsocks 2022 与 ShadowTLS](/posts/ss2022-shadowtls/)
- [为什么你的节点会被封：常见触发条件分析](/posts/node-blocking-causes/)
