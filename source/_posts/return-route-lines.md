---
title: "回程线路科普：163、CN2 GT/GIA、4837、9929、CMI、CMIN2 是什么，怎么测"
date: 2026-10-19
updated: 2026-10-19
categories:
  - 网络知识
tags:
  - 线路
  - BGP
  - 延迟
  - 速度
  - 网络
  - 回程
excerpt: "买 VPS、看机场宣传时常见的 163、CN2 GIA、9929、CMIN2 到底指什么？本文对照登记资料核实三大运营商各网络的 AS 号与定位，讲清路由为何来回不对称、回程为何更重要，以及怎样用 NextTrace 和 mtr 读出真实线路。"
index_img: /images/posts/return-route-lines.svg
---

> **摘要**：买 VPS 或看机场宣传时，常会遇到「CN2 GIA 回程」「9929」「CMIN2」这类说法。它们指的是三大运营商不同的骨干网与国际网络，各有登记在案的 AS 号，质量、容量和价格差别很大。对代理来说，数据从境外回到国内的回程承载了绝大部分下载流量，而互联网路由本来就常常来回不对称，只测一个方向很容易看走眼。本文对照 PeeringDB、APNIC 登记信息和运营商资料核实各网络的 AS 号与定位，解释精品网为什么贵、宣传语怎么辨，再介绍 NextTrace、mtr 与回程测试脚本的用法，以及如何从跳点 IP 和 AS 判断流量走的是哪张网。

---

## 去程、回程与路由不对称

### 两个方向分别指什么

VPS 和代理圈子里说的方向，都以国内用户为基准：

| 叫法 | 方向 | 路径由谁选择 | 代理场景下主要承载 |
|------|------|-------------|------------------|
| 去程 | 国内 → 境外服务器 | 沿途各网络逐段决定，起点是你所在的国内运营商 | 你发出的请求、上传数据、TCP 确认包 |
| 回程 | 境外服务器 → 国内 | 同样逐段决定，起点是服务器所在机房及其上游 | 网页、视频、下载等返回的数据 |

注意「路径由谁选择」这一栏：两个方向的起点不同，做决定的网络也就不同，这正是不对称的根源。

### 为什么来回不走同一条路

互联网由数万个自治系统（AS）拼接而成，它们之间用 BGP 交换路由，基础概念见 [BGP 与 Anycast](/posts/bgp-anycast/)。BGP 有一个朴素但关键的特点：**每个网络只能决定自己发出去的流量交给哪个邻居**，无法直接指定别人发给自己的流量走哪条路。

- 去程：国内运营商根据自己的路由表和策略，决定从哪个出入境节点、交给哪家境外运营商；
- 回程：服务器所在机房决定交给哪家上游，上游再决定怎么送进国内。

两边的选择互不约束，于是同一对 IP 之间，来回经过的城市和网络完全可能不同。这不是国内特有的现象：Vern Paxson 在 1995 年底做的一轮大规模路由测量中，约一半的成对测量来回途经的城市不同，约三成途经的 AS 不同（一年前那轮测量里，城市级不对称约占三成）。数据年代久远，数值不能套用到今天，但它说明不对称是互联网的常态。

落到商业上，结果就是：机房买精品带宽时，可以只优化**自己能控制的出方向**，也就是让回程走精品网；去程则仍由国内运营商按自己的路由送进来。常见的「去程 163、回程 CN2」组合就是这么来的，FAQ 里还会细说。

### 为什么对代理来说回程往往更重要

1. **流量大头在回程**：浏览网页、看视频、下载文件，绝大部分字节从境外流向你。回程一旦拥塞或丢包，直接表现为下载慢、视频自动降画质。
2. **去程以小包为主**：请求和 TCP 确认包体积小，去程差一些通常先体现为延迟变高、偶发卡顿，而不是带宽崩溃。上传大文件、直播推流、视频通话是例外。
3. **延迟两边都算**：往返延迟（RTT）是去程加回程，任何一边绕路都会把延迟抬上去。

所以「回程更重要」是就带宽体验而言的，并不代表去程可以不管。评估一条线路，最好两个方向都测。

---

## 三大运营商的骨干网与国际网络

所谓「线路」，本质上是流量经过了哪些 AS。每个 AS 有全球唯一的编号，查询方法见 [AS 号与 IP 归属查询](/posts/as-number-lookup/)。下表的 AS 号与登记名称均已对照 PeeringDB、APNIC 登记信息和 bgp.he.net 核实；最后一栏是社区常见评价，会随省份、机房和时段变化，只能作参考。

| 网络 | AS | 定位 | 常见口碑与注意 |
|------|----|------|--------------|
| 电信 163（ChinaNet） | AS4134 | 电信主干网，绝大多数电信家宽用户所在网络 | 容量大、带宽便宜；晚高峰国际方向拥塞是常见抱怨，地区差异大 |
| 电信 CN2 | AS4809 | 电信「下一代承载网」，面向政企与国际优质业务 | 分 GT、GIA 等产品，质量通常好于 163；价格高，容量相对小 |
| 电信国际 CTGNet | AS23764 | 中国电信国际有限公司（CTG）的网络 | 部分海外机房标「CTG」线路；与传统 CN2 GIA 的关系社区说法不一 |
| 联通 169（4837） | AS4837 | 联通主干网，联通家宽用户所在网络 | 地位类似电信 163，晚高峰表现因地区和方向而异 |
| 联通 CUII（9929） | AS9929 | 联通产业互联网，源自原网通骨干，俗称 A 网 | 面向政企，常被当作联通版精品网；家宽用户最终仍要交接进 4837 |
| 联通国际 CUG | AS10099 | 中国联通国际有限公司的网络，登记为联通集团国际网关 | 海外机房的联通回程常先进 10099，再交给 4837 或 9929 |
| 移动 CMNET | AS9808 | 移动国内主干网，家宽与手机流量所在网络 | 国际方向主要经 CMI 系网络出入 |
| 移动 CMI | AS58453 | 中国移动国际有限公司的国际网络 | 亚太方向（尤其香港）口碑常见较好，远程方向因机房而异 |
| 移动 CMIN2 | AS58807 | 同属中国移动国际，PeeringDB 别名即 CMIN2 | 常被视为移动版精品网；官方公开的产品说明很少 |

教育网（CERNET，AS4538）自成体系，本文不展开。

### 电信：163、CN2 GT 与 CN2 GIA

先看官方资料怎么说：

- APNIC 中 AS4134 的登记名为 CHINANET-BACKBONE，AS4809 的登记名为 CHINATELECOM-CORE-WAN-CN2，备注是 China Telecom Next Generation Carrier Network，「CN2」即由此而来。
- 中国电信欧洲公司 2014 年前后的国际互联网业务手册（2022 年网页存档）把业务分成四类：ChinaNet 付费对等、China Access、Global Transit 和 Global Internet Access。CN2 GT 与 CN2 GIA 的名字就来自后两项：Global Transit 是面向运营商客户、经由 CN2 的转接服务；Global Internet Access 则被描述为在 CN2 上提供专用路径和最低延迟路由的内地与境外之间的优质接入。
- 同一份手册介绍 CN2 转接时，写明传输通道利用率不超过 50% 的轻载设计；手册末页（与 GIA 介绍同页）的 SLA 部分列出了平均网络延迟，例如香港至内地低于 50 ms、跨太平洋低于 130 ms，但没有注明只适用于哪项产品。
- 中国电信美洲公司 2016 年的资料给 ChinaNet 列出的 SLA 是丢包率低于 3%、中美往返延迟低于 180 ms，给 CN2 转接写的却是亚洲至美洲低于 230 ms。资料年代和对象各不相同，这些宣传数字排不出质量高低。两张网的定位差异主要体现在产品描述上：GIA 强调 CN2 上的专用路径与最低延迟路由，ChinaNet 强调覆盖面和用户规模。

官方资料只讲产品定位，不讲具体走哪些路由器。GT 与 GIA 在路由上的区别，来自社区长期的路由追踪经验：

```text
以下为示意，不是真实输出

CN2 GIA 回程：VPS → 59.43.x.x … 59.43.x.x（全程 CN2）→ 省内城域网 → 你
CN2 GT  回程：VPS → 59.43.x.x（国际段）→ 202.97.x.x … 202.97.x.x（163 骨干）→ 省内 → 你
163     回程：VPS → 境外运营商 → 202.97.x.x … 202.97.x.x → 省内 → 你
```

简单说，GT 只有国际段走 CN2，进入国内后和 163 共用骨干；GIA 连国内段也走 CN2 自己的网络，最多在进入省网前出现一跳 202.97。

用回程测试脚本时要注意，工具里的标签和这套口头叫法未必一一对应。以开源工具 oneclickvirt/backtrace（v0.0.21）为例，它先按内置的 IP 前缀表把跳点映射成 AS（59.43 记为 AS4809，202.97 记为 AS4134），并不实时查询 BGP 归属，然后有两套输出：

- **默认的终端输出**：路径里只要同时出现 AS4809 和 AS4134，就标「电信CN2GT」并同时列出「电信163」；只见 AS4809、不见 AS4134 时才标「电信CN2GIA」。它不看顺序，也不看 AS4134 出现几跳。所以上面那种只在省网前多一跳 202.97 的 GIA 回程，在终端里也会显示为 CN2GT。
- **加 `-route-json` 输出的 JSON 分类**：判定更保守，至少两跳 AS4809、其后最多一跳 AS4134 才判为 GIA；AS4809 之后跟着多跳 AS4134，也就是本文所说的 GT 形态，它记为「CN2混合」；它的「CN2GT」反而指 AS4134 出现在 AS4809 之前的路径。

看到工具给出的 GT、GIA 字样，最好回到原始跳点自己判断。

两点提醒：

- 运营商会调整路由，同一台机器这个月是 GIA 形态，下个月可能变成 GT 形态；不同省份测出的结果也可能不同。
- 近年部分海外机房开始标「CTG」或「CTGNet」线路，指的是 AS23764。它与传统 CN2 GIA 是什么关系，社区说法不一，宣传里出现时以实测为准。

### 联通：4837、9929 与 10099

- **AS4837**：APNIC 登记名 CHINA169-Backbone，即联通 169 骨干网，联通家宽用户所在的网络，地位相当于电信 163。
- **AS9929**：APNIC 登记名 CUII，备注 CHINA UNICOM Industrial Internet Backbone；PeeringDB 的名称同样是 China Unicom Industrial Internet Backbone，而 bgp.he.net 上的显示名至今仍是 China Netcom Backbone，APNIC 中它的技术联系人也仍是 CNCGroup Hostmaster，说明它沿用了原中国网通时期的登记。不过 4837 同样来自网通集团（PeeringDB 别名 AS-CNCGROUP），两者的区别在于定位而不在出身。社区习惯把 9929 称为「A 网」。中国联通研究院首席科学家唐雄燕在华为技术专栏的一篇文章中介绍，CUII 是联通 2016 年前后以政企 IP 网络为基础、用 SDN 改造出来的「云联网」（CloudBond）。
- **AS10099**：APNIC 登记名 UNICOM-Global，备注为中国联通集团的国际网关，归属中国联通国际有限公司（China Unicom Global，简称 CUG）。

常见的联通回程形态（社区经验）：

- 普通：境外 → AS10099 → AS4837 骨干 → 省网 → 你；
- 9929：境外 → AS10099 或直接进 AS9929 → 9929 骨干 → 在省内交给 4837 城域网 → 你。「9929 回程」「CUG VIP」等宣传语大致指这一类，各家叫法并不统一。

要点在于：9929 是政企网络，家宽用户最终还是从 4837 的城域网接入。所以「9929 回程」改善的是骨干和国际段，最后一段仍取决于你所在城市的联通网络。

### 移动：CMNET、CMI 与 CMIN2

- **AS9808**：移动国内主干网 CMNET。APNIC 中 221.176.0.0 至 221.183.255.255 这一大段整体登记为 CMNET。
- **AS58453**：中国移动国际有限公司（China Mobile International，CMI）的国际网络，APNIC 登记名 CMI-INT-HK，登记地址在香港；PeeringDB 记录注明其相关 AS 为 AS9808（CMNET）。
- **AS58807**：同属中国移动国际，APNIC 登记名 CMI-INT-AS，PeeringDB 名称为 China Mobile International - NII，别名正是 CMIN2。

中国移动对 CMIN2 的公开产品说明很少，社区一般把它看作移动面向国际的精品网，对标 CN2 GIA。常见回程形态是：境外 → AS58453 或 AS58807 → AS9808 → 省网 → 你。

---

## 精品网为什么贵，宣传语怎么看

### 贵在哪里

| 维度 | 普通网（163、4837、CMI 普通出口） | 精品网（CN2 GIA、9929、CMIN2 等） |
|------|------|------|
| 设计目标 | 承载海量用户，尽量提高利用率 | 轻载保质量，电信 2014 年前后的 CN2 手册称利用率不超过 50% |
| 容量 | 大 | 相对小 |
| 晚高峰 | 拥塞和丢包常见，因地区而异 | 通常更平稳，但不是不会拥塞 |
| 批发计费 | 单价低 | 单价高；两者都常见按月固定或按 95 百分位计费（电信 CN2 手册即列出这两种） |
| 传到用户端 | 大流量、大带宽套餐容易便宜 | 同价位往往流量少、带宽小，或价格明显更高 |

轻载的含义是：为了让晚高峰也不拥塞，链路要留出大量余量。这部分「闲着的容量」也要有人付钱，于是精品带宽按 Mbps 计价时明显贵于普通带宽。机房把成本摊到每个套餐上，就成了你看到的「CN2 GIA 套餐流量少、价格高」。

还要分清两件事：

- **精品网不是专线**。CN2 GIA、9929、CMIN2 走的仍是跨境公网，只是更不容易拥塞。IPLC、IEPL 这类专线是另一回事，区别见 [直连 vs 中转 vs CDN](/posts/line-types-explained/)。
- **精品网解决的是拥塞，不是封锁**。节点会不会被封，主要取决于协议特征和使用方式，而不是走哪张骨干网，见 [为什么你的节点会被封](/posts/node-blocking-causes/) 与 [GFW 工作原理全解](/posts/gfw-detection-overview/)。

### 常见宣传语对照

| 宣传语 | 可能的真实含义 | 怎么验证 |
|--------|--------------|---------|
| CN2 GIA | 可能是双向 GIA，也可能只有回程 GIA、去程 163，甚至只是 GT | 双向追踪，看回程是否夹着多跳 202.97 |
| 三网 CN2 GIA | CN2 只属于电信。联通、移动方向可能另走 9929、CMI，也可能先进 CN2 再在国内跨网交接 | 分别测三网回程，看联通、移动方向经过哪些 AS |
| 三网优化、三网直连 | 三家各有直连的上游，但不一定是精品网 | 看回程 AS 是 4837 还是 9929，是 CMI 还是 CMIN2 |
| 9929 回程 | 通常只指联通方向的回程 | 测联通回程；你不是联通用户时意义有限 |
| CMIN2 | 移动方向回程经 AS58807 | 测移动回程 |
| CN2 GT | 国际段 CN2、国内段 163 | 回程先 59.43 后多跳 202.97 是正常形态；回程测试脚本里的 GT 标签含义不同，见电信一节 |
| CTG、CTGNet | 回程经 AS23764 | 看 AS；与 GIA 的关系不要想当然 |
| 原生 IP | 说的是 IP 归属，和线路无关 | 见 [什么是原生 IP、广播 IP、住宅 IP](/posts/ip-types/) |

### 辨别原则

1. **方向、运营商、地区要说全**：「回程三网 CN2 GIA」和「双向 CN2 GIA」差别很大，只写「CN2」几乎不提供信息。
2. **以自己的省份和运营商为准**：商家截图多来自北京、上海、广州的测试点，你所在省份的路由可能完全不同。
3. **看晚高峰**：白天谁都跑得不错，晚高峰才见分晓。
4. **买前先测**：多数 VPS 商提供测试 IP 或 Looking Glass 页面，可以先追踪、先测速。
5. **留意时效**：线路会调整，评测帖只代表发帖时的状态。

---

## 怎么测：工具与方法

> **提示**：下文的测试只针对你自己的服务器、商家公开的测试 IP 或公共测试目标。高频探测他人主机可能违反服务条款；在 VPS 上以 root 运行第三方脚本有安全风险，请先阅读脚本内容，并在不存放重要数据的测试机上运行。使用代理请遵守当地法律法规与服务商条款。

### 先分清在哪一端测

| 想测什么 | 在哪运行 | 目标 | 可用工具 |
|---------|---------|------|---------|
| 去程 | 国内自己的电脑，或在线工具的国内测试点 | VPS 的 IP | NextTrace、mtr、tracert、IPIP 在线路由追踪 |
| 回程 | VPS 上 | 你家宽带的公网 IP，或各省三网测试 IP | NextTrace 快速测试、回程测试脚本、mtr |
| 实际带宽 | 两端配合 | 对端 | iperf3 正向与反向、真实下载 |

有一个容易忽略的细节：在国内电脑上对 VPS 做 mtr，列出的跳点全是去程；但**终点那一行的延迟和丢包包含了回程**，因为 VPS 的回复走的是它自己的回程。所以「每一跳都正常，唯独终点丢包」时，问题可能藏在你看不见的回程里，要到 VPS 上反向再测一次。

测试前请关闭代理客户端的 TUN 模式，否则探测包可能被客户端接管，结果失真，原因见 [延迟测试的数字到底代表什么](/posts/latency-test-explained/)。

### NextTrace

[NextTrace](https://github.com/nxtrace/NTrace-core) 是用 Go 编写的开源路由追踪工具（GPL-3.0），每一跳都会标出 AS 号、归属和地理位置，读线路比传统 traceroute 方便得多。截至 2026 年 10 月，NTrace-core 最新发布的版本是 v1.7.4，下文命令按这个版本编写，运行前可用 `nexttrace -V` 确认版本。

关于版本，有两点要留意：

- 项目公告称最早于 2027 年把默认模式切换为 MTR 持续探测，具体版本另行公告，v1.7.4 尚未切换。切换后，不带模式参数的 `nexttrace IP` 会进入持续刷新的 MTR 界面；依赖传统 traceroute 输出的脚本可以现在就显式加 `--traceroute`（`-k`）；`--route-path` 会自动使用传统模式，`--fast-trace` 也保持原有流程。
- `--traceroute` 从 v1.7.4 起才有，旧版本加上会报错；`-r` 在 v1.6 之前的版本里也不是 MTR 报告模式。包管理器里的版本可能落后于 GitHub Releases，项目也提醒 homebrew-core 版本的更新可能滞后。

安装优先用包管理器：macOS 用 `brew install nexttrace`，Windows 用 `winget install nexttrace` 或 Scoop，Debian / Ubuntu 可以添加项目官方的 APT 源。官方也提供 `curl -sL https://nxtrace.org/nt | bash` 这样的一键安装脚本，同样建议先下载阅读再执行。在中国大陆运行时，项目建议把 PoW 服务换成位于大陆的节点，以免查询归属信息时连接缓慢或失败：加 `--pow-provider sakura`，或设置环境变量 `NEXTTRACE_POWPROVIDER=sakura`。

```bash
# 去程：在国内电脑上追踪到你的 VPS（默认 ICMP）
sudo nexttrace 203.0.113.10

# 在中国大陆运行时，可改用项目推荐的大陆 PoW 服务器
sudo nexttrace --pow-provider sakura 203.0.113.10

# 用 TCP SYN 探测 443 端口，更接近代理流量，也能穿过禁 ping 的主机
sudo nexttrace --tcp --port 443 203.0.113.10

# 按 AS 汇总输出路径，一眼看出经过了哪些网络
sudo nexttrace --route-path 203.0.113.10

# MTR 报告模式：每跳探测 100 次后输出丢包与延迟统计
sudo nexttrace -r -q 100 203.0.113.10

# 回程：在 VPS 上运行快速测试。程序会先后询问 IP 类型（1 为 IPv4）和测试范围：
# 直接回车只测北京三网，选 8「全国五网」才覆盖北京、上海、广州、杭州等地的
# 电信、联通、移动与教育网
sudo nexttrace --fast-trace
sudo nexttrace --fast-trace --tcp

# 回程：追踪到你自家宽带的公网 IP，结果最贴近你的真实回程
# -M：不把这次的路径上传生成路由地图
sudo nexttrace -M 198.51.100.20
```

平台差异：Linux 上发送探测包通常需要 root 权限，上面的命令统一加了 sudo；macOS 只有 ICMP 模式不需要提权；Windows 普通用户只能用 ICMP 模式且要在防火墙放行 ICMP，TCP / UDP 模式需要管理员权限和 WinDivert。想要图形界面，可以用同一生态的 [OpenTrace](https://github.com/Archeb/opentrace)。

几个隐私细节：

- NextTrace 默认通过项目自己的 API 查询每一跳的归属信息，跳点 IP 会被发送出去。
- 普通追踪结束后，它还会把整条路径（包括终点，也就是你家宽带的 IP）上传到 api.nxtrace.org，生成一个路由地图并打印「MapTrace URL」。只想关掉地图上传，加 `-M`（`--map`）。
- 连归属查询也不想发，可以用 `--data-provider disable-geoip`，代价是看不到 AS 与位置，这时也不会生成地图。
- 在论坛分享追踪结果前，记得把前几跳和你自家的公网 IP 打码，它们能暴露你所在的城市和宽带。

### mtr 与系统自带工具

```bash
# 安装：Debian / Ubuntu 用 apt install mtr-tiny，RHEL / Rocky / Alma 用 dnf install mtr，
# macOS 用 brew install mtr
# 报告模式：100 轮（约 100 秒），显示 AS 号、不解析主机名、宽格式输出
sudo mtr -rwzn -c 100 203.0.113.10

# TCP SYN 探测 443 端口
sudo mtr -rwzn -c 100 -T -P 443 203.0.113.10
```

```powershell
# Windows 自带：tracert 只看路径，pathping 逐跳统计丢包（需要几分钟）
tracert -d 203.0.113.10
pathping -n 203.0.113.10
```

mtr 的 `-z` 会为每一跳查询 AS 号，但骨干路由器接口的地址常常不在公网路由表里，查不到 AS 很正常，这时就要结合下一节的 IP 段特征判断。

### 在线工具与 Looking Glass

- **IPIP.NET 路由追踪**：可以从国内各省的电信、联通、移动测试点，以及云厂商和海外测试点，向你的 VPS 发起 ICMP 或 TCP 路由追踪，每跳显示 AS 与位置。手头没有各地机器时，用它看「全国各地到你 VPS 的去程」最方便。站点自己也说明归属数据仅供参考。
- **商家的 Looking Glass**：很多机房提供网页版 ping 与 traceroute，从机房向外追踪到你的 IP，等于在购买前就能看到回程。
- **GlobalTrace**：NextTrace 团队基于 Globalping 全球探针做的网页版 MTR，适合从海外多地观察同一目标。

### 回程测试脚本

社区里流行的「三网回程测试」脚本，原理都是在 VPS 上向一组国内三网目标做路由追踪，再根据跳点判断经过哪张网：

| 工具 | 做法 | 备注 |
|------|------|------|
| zhanghanyun/backtrace | 追踪北京、上海、广州、成都的三网目标，只看第一个能识别的跳点前缀（如 59.43 判为 CN2、202.97 判为 163） | 只要先出现 59.43 就显示 CN2，分不出 GT 与 GIA；所有 202.97 开头的跳点都判为 163；能区分 CN2、163、4837、9929、CMI、CMIN2 |
| oneclickvirt/backtrace | 在前者基础上重构，同样按内置 IP 前缀表把跳点映射为 AS，并汇总每个目标多次追踪的结果 | 终端输出只看 AS4809 与 AS4134 是否同时出现来标 CN2GT 或 CN2GIA；按顺序的保守分类（含「CN2混合」）要加 `-route-json` 才能看到，标签含义见电信一节；项目说明结果仅供参考，最终要靠人工判断 |
| NextTrace 快速测试 | `nexttrace --fast-trace`，交互式选择范围，内置北上广杭等地的三网（含 CN2、9929、CMIN2 目标）与教育网目标 | 只给路径，不替你下结论 |

这些脚本多以 `curl ... | bash` 的方式安装，运行时通常也需要 root 权限。以 oneclickvirt/backtrace 为例，截至 2026 年 10 月查看时，它的安装脚本会依次探测几个镜像加速地址（四个里有三个是 http 明文地址，探测时还用 `curl -k` 关闭了证书校验）。选中哪个镜像，二进制就经由它下载，下载后不做任何校验，直接 `chmod 777` 并复制到 `/usr/bin`。这类细节只有读了脚本才知道，所以建议：

```bash
# 方式一：先下载安装脚本，读懂它会做什么，再决定是否执行
curl -fsSL -o backtrace_install.sh https://raw.githubusercontent.com/oneclickvirt/backtrace/main/backtrace_install.sh
less backtrace_install.sh

# 方式二：直接从 GitHub Releases 下载对应架构的二进制（以 Linux x86_64 为例）
curl -fL -o backtrace https://github.com/oneclickvirt/backtrace/releases/latest/download/backtrace-linux-amd64
chmod +x backtrace
sudo ./backtrace
```

在不存放重要数据的测试机上运行，测完删除。脚本的结论只是起点：它们的目标 IP 是固定的几个城市，和你家的路由未必一致，最终仍要追踪到你自己的 IP 来确认。

---

## 从跳点 IP 与 AS 读出线路

### 先看 AS，再看 IP 段

NextTrace 会直接标出每一跳的 AS，这是最直接的依据。查不到 AS 时，可以借助下面这些经验特征。下表中的登记信息已用 APNIC 的 RDAP 查询核对，BGP 宣告情况参考 RIPEstat（均为 2026 年 10 月查询），但「某段地址用于哪张网」本质上是经验规律，不是运营商公布的划分：

| 跳点地址特征 | 常见归属 | 登记情况与说明 |
|------------|---------|--------------|
| 202.97.0.x 至 202.97.127.x | 电信 163 骨干（AS4134） | 202.97.0.0 至 202.97.95.255 登记为 CHINANET-BB，202.97.96.0/19 登记为 CHINANET-HK，均由 AS4134 宣告 |
| 202.97.128.x 至 202.97.255.x | 联通（AS4837） | 登记给联通山西、辽宁、黑龙江等省网，由 AS4837 宣告；出现在回程里不代表走了 163，但部分脚本会把所有 202.97 都判为 163 |
| 59.43.x.x | 电信 CN2（AS4809） | 59.43.0.0/16 整段登记为 CN2-BB |
| 219.158.x.x | 联通 169 骨干（AS4837） | 219.158.0.0/19 登记为 ChinaUnicom-BACKBONE，其余段登记为原网通或省网 |
| 218.105.x.x、210.51.x.x | 常见于联通 9929 | APNIC 子分配分散在联通和原网通的多个段里；BGP 中 218.105.0.0/16、210.51.0.0/16 的汇总前缀由 AS9929 宣告，210.51 内另有部分细分段由其他联通 AS 宣告 |
| 221.176.x.x 至 221.183.x.x | 移动 CMNET（AS9808） | 整段登记为 CMNET |
| 223.118.x.x 至 223.120.x.x | 移动国际 CMI、CMIN2 | 223.118.0.0/15、223.120.0.0/17 在 APNIC 分别登记为 CMI-INT-AS-AP、CMI-INT-HK，由 AS58453（CMI）宣告；223.120.128.0/17 登记为 CMNET，却由 AS58807（CMIN2）宣告，223.119.8.0/22 等细分段也由 AS58807 宣告。登记名看不出 CMI 与 CMIN2，要以按 BGP 宣告查到的 AS 为准 |

### 认出几种典型形态

对照前文电信一节的示意图，读回程时重点看三件事：

1. **国际段进入的是哪张网**：第一个出现的国内运营商跳点，是 59.43 还是 202.97，是 9929 还是 4837，是 CMI 还是 CMIN2；
2. **进入国内后有没有被交接**：CN2 之后接着一串电信的 202.97，就是 GT 形态；9929 之后在省内转 4837 是正常现象；
3. **有没有明显绕路**：去香港的流量先绕到美国再回来，延迟会突然多出一百多毫秒，可以对照 [延迟测试的数字到底代表什么](/posts/latency-test-explained/) 里的物理延迟下限表判断。

### 排除干扰

- **星号与空行**：很多路由器不回应探测，或者对发给自己的探测包限速，显示为 `*`，不代表线路有问题；
- **MPLS 隐藏跳点**：骨干网内部常用 MPLS 转发，中间若干跳可能完全不显示，看起来像「一跳跨省」；
- **中间丢包不算数**：只有从某一跳开始、一直延续到终点的丢包才是真丢包；
- **数据库会出错**：IP 归属和地理位置数据库都可能过时，同一跳在不同工具里显示不同是常有的事；
- **多路径**：运营商可能对流量做负载分担，同一目标连续追踪几次，路径可能不完全一样。

---

## 晚高峰与丢包：同一条线的不同时段

同一条线路，上午和晚上可能判若两线。国内的上网晚高峰一般在北京时间 20:00 至 23:00 前后，这时普通骨干的国际出入口最容易拥塞，精品网也可能出现抖动。

回程拥塞的典型信号：

- 延迟抬高、抖动变大，从某一跳开始的丢包一直延续到终点；
- **下载速度骤降，上传却基本正常**，这是回程出问题、去程没事的典型组合；
- 白天测速正常，晚上视频频繁降画质。

测法上，同一条命令在上午、晚高峰和凌晨各跑一次，连续几天对比，比任何一次截图都可靠。在 VPS 上可以用一个小脚本定时记录到自家宽带的回程：

```bash
#!/bin/sh
# 保存为 /usr/local/bin/route-log.sh 并 chmod +x，用 sudo crontab -e 加入一行：
# 0 * * * * /usr/local/bin/route-log.sh
# cron 默认的 PATH 很短，RHEL 系的 mtr 装在 /usr/sbin，这里显式补全
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TARGET=198.51.100.20          # 换成你家宽带的公网 IP
LOGDIR=/var/log/route-log
mkdir -p "$LOGDIR"
LOG="$LOGDIR/$(date +%F).txt"
echo "=== $(date '+%F %T')" >> "$LOG"
mtr -rwzn -c 60 "$TARGET" >> "$LOG" 2>&1
# 只保留最近 30 天的日志
find "$LOGDIR" -name '*.txt' -mtime +30 -delete
```

家宽的公网 IP 可能会变，有些光猫或路由器也不回应 ping；遇到这种情况，可以改用你所在城市最后一个有响应的运营商跳点作为目标。日志里有你的家庭 IP，分享前注意打码。

路由追踪只能看路径和丢包，带宽要用吞吐测试。iperf3 的 `-R` 参数会让服务器向客户端发数据，测的正是回程方向：

```bash
# VPS 上：只接受一次连接后退出；测试期间临时在防火墙放行 5201 端口，测完关闭
iperf3 -s -1 -p 5201

# 国内电脑上：-R 让服务器向你发数据，对应回程（下载）方向
iperf3 -c 203.0.113.10 -p 5201 -R -t 30

# 不加 -R 则是你向服务器发数据，对应去程（上传）方向
iperf3 -c 203.0.113.10 -p 5201 -t 30
```

单条 TCP 连接对丢包非常敏感，可以再加 `-P 4` 开四条并行流对比：单流很慢、多流正常，通常说明链路有丢包而不是带宽不足。iperf3 测的是裸链路，不含代理协议开销；VPS 流量多按量计费，不要频繁长时间跑。测速网站的用法与注意事项见 [速度慢的常见原因与优化思路](/posts/speed-optimization/)。

---

## 与机场线路的关系

前面讲的都是「你 ↔ 一台境外服务器」的情况。机场节点的结构更多样，这些网络名称适用的范围也不同（各线路类型的原理见 [直连 vs 中转 vs CDN](/posts/line-types-explained/)）：

| 节点类型 | 你的流量经过 | 你能测到什么 | 本文的网络名称是否适用 |
|---------|------------|-------------|------------------|
| 直连 | 你 ↔ 境外服务器 | 去程可以追踪到节点 IP；回程只能通过下载速度间接判断 | 适用，回程线路基本决定晚高峰体验 |
| 公网中转 | 你 ↔ 国内入口 ↔ 境外落地 | 只能追踪到国内入口，跨境段看不到 | 适用于入口到落地的跨境段，由机场选择 |
| IPLC、IEPL 专线 | 你 ↔ 国内入口，专线 ↔ 境外出口 | 只能追踪到国内入口 | 跨境段不走公网骨干，CN2、9929 这类名称基本不适用 |

几个推论：

- 对中转节点做路由追踪或 TCPing，测到的只是国内一小段，数字好看不代表跨境段好，延迟由哪几段构成见 [延迟测试的数字到底代表什么](/posts/latency-test-explained/)；中转本身的原理见 [端口转发与中转](/posts/port-forwarding-relay/)。
- 机场节点上不能运行你的脚本，回程只能看结果：晚高峰下载速度、视频是否降画质、经代理的真实延迟。评估方法见 [如何评估一个机场的质量](/posts/how-to-evaluate/)。
- 节点名里的「CN2」「9929」「CMI」通常是机场自己的标注，含义可能是落地机的回程线路，也可能是中转入口所在的网络，同样需要以晚高峰实测为准。

如果你打算自建，买 VPS 前先确认自己家里是哪家运营商、在哪个省，再看商家的回程是否覆盖你的运营商，搭建步骤见 [自建代理完整指南](/posts/self-hosting-guide/)。

---

## 常见问题（FAQ）

### 为什么我测出来去程是 163，回程是 CN2？

这是最常见的不对称组合，原因就在 BGP 的「各管各的出方向」：回程由 VPS 所在机房决定，它向电信购买了 CN2 方向的带宽，发往电信用户的流量就交给 CN2；去程由电信决定，你的数据从 163 骨干出发，电信按自己的策略和机房购买的产品决定是否把它送上 CN2，没有相应安排时就留在 163 上出境。很多商家标的「回程 CN2 GIA」本来就只承诺回程。考虑到下载流量集中在回程，这种组合对日常浏览和看视频往往够用，但上传、推流和对延迟敏感的场景会受去程拖累。

### 香港、日本、美国各自常见哪些线路？

以下是常见情况，不是规律，具体以实测为准：

- **香港**：距离内地最近，电信 CN2 GIA、联通 10099 或 9929、移动 CMI 都很常见；中国移动国际本身登记在香港，移动方向的香港线路选择较多。香港带宽单价高，套餐流量往往较少。
- **日本**：东京机房常见 NTT、IIJ、SoftBank、KDDI 等当地运营商作为上游，也有商家提供 CN2 GIA、CMI 或 CMIN2 回程。普通线路晚高峰拥塞并不少见，偶尔还会出现绕道香港或美国的路由。
- **美国**：中国电信资料列出的 CN2 北美节点包括洛杉矶、圣何塞、西雅图等城市；社区经验上，美西是 CN2 GIA、9929、CMIN2 回程产品较集中的地区，这是行业观察，不是运营商公布的数据。普通商家多经各大国际运营商把流量交给 163 或 4837，晚高峰差异明显。另外，物理距离决定了往返延迟有下限：上海到洛杉矶约 102 ms，到美东约 117 ms（见 [延迟测试的数字到底代表什么](/posts/latency-test-explained/)），再好的线路也绕不过去。

### 商家写着 CN2 GIA，我的回程里却出现了 202.97，是假的吗？

不一定。GIA 回程在进入省网前出现一跳 202.97 属于正常形态；如果 59.43 之后跟着一长串 202.97，那更像 GT。还要排除三种情况：你不是电信用户，测的是别的运营商方向；你所在省份恰好不在优化范围内；运营商临时调整了路由。另外留意 202.97.128.0 至 202.97.255.255 这半段属于联通，不是 163。如果你用的是 oneclickvirt/backtrace，它的终端输出只要 59.43 与 202.97 同时出现就会标成 CN2GT，这时要看原始跳点，或用 `-route-json` 查看分类依据。多测几天、多换几个目标，再结合商家的说明判断。

### 我是联通或移动宽带，买电信 CN2 GIA 的机器有意义吗？

要看这台机器给联通和移动安排了什么回程。CN2 只属于电信，如果联通、移动方向是先进 CN2 再在国内跨网交接，或者走的是普通出口，体验未必比便宜的线路好。对联通用户来说，9929 或 10099 回程更对口；对移动用户来说，CMI 或 CMIN2 更对口。买之前用商家的测试 IP，从你自己的网络追踪一次最可靠。

### 回程脚本显示「优质线路」，为什么晚上还是慢？

脚本只判断路径经过了哪张网，不测带宽和拥塞。常见原因包括：商家超售，服务器自己的端口带宽被挤满；精品网某一段在晚高峰也出现了拥塞；你所在城市的城域网或家里的 Wi-Fi 是瓶颈；运营商对特定流量做了限速。按 [速度慢的常见原因与优化思路](/posts/speed-optimization/) 逐项排查，并用前文的定时记录对比不同时段。

### IPv6 的回程和 IPv4 一样吗？

不一定，而且经常不一样。同一台 VPS 的 IPv4 走 CN2，IPv6 却可能走完全不同的上游，因为两套地址的路由是分开宣告、分开选择的。如果你的客户端会优先用 IPv6 连接节点，就要单独测一遍 IPv6 回程，oneclickvirt/backtrace 支持 `-ipv6` 参数，NextTrace 也可以直接追踪 IPv6 地址。IPv6 的基础知识见 [IPv4 与 IPv6 基础](/posts/ipv4-vs-ipv6-basics/)。

---

## 外部参考

- 登记信息：PeeringDB 的 [AS4134](https://www.peeringdb.com/asn/4134)、[AS4809](https://www.peeringdb.com/asn/4809)、[AS4837](https://www.peeringdb.com/asn/4837)、[AS9929](https://www.peeringdb.com/asn/9929)、[AS10099](https://www.peeringdb.com/asn/10099)、[AS9808](https://www.peeringdb.com/asn/9808)、[AS58453](https://www.peeringdb.com/asn/58453)、[AS58807](https://www.peeringdb.com/asn/58807)、[AS23764](https://www.peeringdb.com/asn/23764)
- 路由数据：bgp.he.net 的 [AS4134](https://bgp.he.net/AS4134)、[AS4809](https://bgp.he.net/AS4809)、[AS4837](https://bgp.he.net/AS4837)、[AS9929](https://bgp.he.net/AS9929)、[AS10099](https://bgp.he.net/AS10099)、[AS9808](https://bgp.he.net/AS9808)、[AS58453](https://bgp.he.net/AS58453)、[AS58807](https://bgp.he.net/AS58807)；[APNIC Whois 查询](https://wq.apnic.net/static/search.html)、[APNIC RDAP 示例：223.120.128.0/17](https://rdap.apnic.net/ip/223.120.200.1)、[RIPEstat 示例：202.97.0.0/16 的路由宣告](https://stat.ripe.net/data/routing-status/data.json?resource=202.97.0.0/16)
- 中国电信资料：[China Telecom Americas：IP Access（2016）](https://www.ctamericas.com/wp-content/uploads/2016/06/IP-Access.pdf)、[China Telecom Europe：Global Internet Service（约 2014 年，网页存档）](https://web.archive.org/web/20221003051628/https://www.chinatelecomeurope.com/wp-content/uploads/ChinaTelecom_Global-Internet-Service.pdf)
- 中国联通 CUII：[唐雄燕（中国联通研究院）：夯实云网融合，迈向算网一体（华为技术专栏）](https://www.huawei.com/cn/huaweitech/publication/88/cloud-network-computing-cubenet2)
- 路由不对称：[Paxson, End-to-End Routing Behavior in the Internet, ACM SIGCOMM 1996](https://doi.org/10.1145/248156.248160)，扩展版见 [IEEE/ACM ToN 1997](https://doi.org/10.1109/90.649563)
- 工具：[NextTrace（NTrace-core）](https://github.com/nxtrace/NTrace-core)、[NextTrace 中文说明](https://github.com/nxtrace/NTrace-core/blob/main/README_zh_CN.md)、[OpenTrace](https://github.com/Archeb/opentrace)、[mtr](https://github.com/traviscross/mtr)、[mtr 手册](https://manpages.debian.org/testing/mtr-tiny/mtr.8.en.html)、[iperf3 手册](https://manpages.debian.org/testing/iperf3/iperf3.1.en.html)、[tracert](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tracert)、[pathping](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/pathping)
- 回程脚本：[zhanghanyun/backtrace](https://github.com/zhanghanyun/backtrace)、[oneclickvirt/backtrace](https://github.com/oneclickvirt/backtrace)（v0.0.21 的 [JSON 分类逻辑](https://github.com/oneclickvirt/backtrace/blob/v0.0.21/bk/route_classification.go) 与 [终端标签逻辑](https://github.com/oneclickvirt/backtrace/blob/v0.0.21/bk/route_render.go)）
- 在线工具：[IPIP.NET 路由追踪](https://tools.ipip.net/traceroute.php)、[GlobalTrace](https://lg.nxtrace.org)

**站内相关文章**：

- [直连 vs 中转 vs CDN：线路类型与成本分析](/posts/line-types-explained/)
- [AS 号与 IP 归属查询：怎么看一个节点的 IP 质量](/posts/as-number-lookup/)
- [BGP 与 Anycast：为什么有些节点全球都快](/posts/bgp-anycast/)
- [延迟测试的数字到底代表什么](/posts/latency-test-explained/)
