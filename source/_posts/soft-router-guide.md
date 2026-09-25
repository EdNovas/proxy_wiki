---
title: "软路由与旁路由：用 OpenWrt 让全家设备科学上网"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 进阶技巧
tags:
  - OpenWrt
  - 软路由
  - OpenClash
  - 路由
  - 配置
  - 教程
excerpt: "电视、游戏机和智能家居装不了代理客户端，就把代理放到路由层。本文对比主路由、旁路由和单设备指定网关三种拓扑，讲清硬件、固件与插件怎么选、透明代理的原理，以及 IPv6、DNS 回环和单点故障这些常见坑。"
index_img: /images/posts/soft-router-guide.svg
---

> **摘要**：智能电视、游戏机、IoT 设备大多装不了代理客户端，把代理放到路由层是让全家设备统一走代理的常见做法。但「一次配置全家用」的另一面是：网关出问题，全家一起断网。本文先对比 OpenWrt 主路由、旁路由、只给个别设备指定网关三种拓扑，再讲硬件、固件和代理插件的选择，拆解 REDIRECT、TPROXY、TUN 三种透明代理机制，最后给出旁路由配置步骤、IPv6 与 DNS 的坑、安全要点和排障清单。

---

## 为什么要在路由层做代理

[TUN 模式](/posts/tun-vs-system-proxy/) 能接管一台设备的全部流量，前提是这台设备能装客户端。下面这些设备通常装不了：

- **智能电视、电视盒子**：系统封闭，或者装上了也很难用遥控器维护订阅
- **游戏机**：只能在网络设置里改 IP、网关、DNS，部分机型能填 HTTP 代理
- **IoT 设备**：音箱、摄像头、扫地机器人，连设置界面都没有
- **家人的设备**：让长辈理解「订阅过期要更新」并不现实

路由层方案的思路是：**设备不需要知道代理存在**。设备照常把数据包发给网关，网关上的代理程序按规则决定直连还是走节点。

| 维度 | 每台设备装客户端 | 路由层统一代理 |
|------|----------------|--------------|
| 覆盖范围 | 只有能装软件的设备 | 所有以它为网关的设备 |
| 订阅与规则维护 | 每台分别更新 | 路由器上维护一份 |
| 离开家以后 | 照常工作 | 出门即失效 |

把一个订阅给全家共用是否符合服务条款，以所用服务的规定为准，参见 [看懂机场参数](/posts/airport-parameters/)。

代价同样明显：

- **单点故障**：网关挂了，所有以它为网关的设备都断网，包括只刷国内视频的家人
- **排障链条变长**：问题可能出在设备、DHCP、DNS 转发、防火墙规则、代理核心、节点任何一环
- **性能天花板**：全家代理流量的加解密都压在一台小设备的 CPU 上
- **安全面扩大**：网关看得到全家流量，后台、订阅链接、第三方插件都要保护

---

## 三种拓扑

### 拓扑 A：OpenWrt 直接做主路由

光猫后面接一台 OpenWrt，由它负责拨号、DHCP、DNS、防火墙和代理：

```text
光猫 ──▶ OpenWrt（拨号 / DHCP / DNS / 防火墙 / 代理）──▶ 交换机、AP ──▶ 所有设备
```

路径最简单，回程对称，IPv6 也由它统一下发。代价是**它就是整个家庭网络**：调插件、升级固件时全家断网，原来的无线路由器要改成 AP 模式。如果要让光猫改桥接、由 OpenWrt 拨号，还需要宽带账号和密码，部分地区得联系运营商修改光猫设置。

### 拓扑 B：旁路由（旁路网关）

主路由不动，局域网里再挂一台 OpenWrt（常见是单网口），给它同网段的静态 IP，设备把网关和 DNS 指向它：

```text
设备 ──网关/DNS──▶ 旁路由 192.168.1.2（代理核心）
                         │
                         ▼  直连流量、到节点的连接
                   主路由 192.168.1.1 ──▶ 光猫 ──▶ 互联网
```

「旁路」指它不在物理链路的主干上，**主路由的拨号、Wi-Fi、Mesh 都不用动**。代价是网络里出现两个「网关」，DHCP、IPv6 RA、DNS 由谁负责都要想清楚，配错就会有流量绕过旁路由。

### 拓扑 C：只给个别设备指定网关

旁路由的最小化用法：主路由 DHCP 照旧，只有电视、游戏机等设备手动填写网关和 DNS 为旁路由，或由主路由的 DHCP 标签只给这几台下发。旁路由挂了也只影响这几台。

| 维度 | A：OpenWrt 主路由 | B：旁路由（全屋） | C：个别设备指定网关 |
|------|-----------------|-----------------|------------------|
| 改造成本 | 高：替换主路由、重新拨号 | 中：加一台设备、改 DHCP | 低：只改几台设备 |
| 故障影响面 | 全家断网，国内也断 | 所有指向旁路由的设备 | 只有指定的设备 |
| 恢复方式 | 修好 OpenWrt 或换回旧路由 | 主路由改回下发，设备续租或重连 | 设备改回自动获取 |
| IPv6 复杂度 | 低 | 高：主路由的 RA 会让设备绕路 | 中 |
| 回程路径 | 对称 | 可能不对称，需要 SNAT | 同 B |
| 适合谁 | 愿意把整个网络交给 OpenWrt | 主路由不想动、全家都要代理 | 少数设备需要代理 |

实用路线是**先 C 后 B**：先让一台电视或游戏机指向旁路由，稳定一段时间再扩大范围。也要知道，OpenClash 文档本身更推荐主路由部署，旁路由的回程和 IPv6 问题要自己处理，详见下文。

---

## 硬件怎么选

| 类型 | 典型例子 | 优点 | 需要注意 |
|------|---------|------|---------|
| x86 小主机 | Intel N100 一类低功耗多网口小主机 | 性能余量大，普遍有 AES-NI，内存和存储可扩展 | 功耗和体积大于硬路由，整机做工参差 |
| ARM 开发板 | RK3328 / RK3568 / RK3588 等芯片的板子，如 NanoPi R 系列 | 功耗低、体积小 | 固件支持看具体板型，TF 卡寿命 |
| 可刷机硬路由 | MediaTek Filogic（MT7981、MT7986，ARM64）；老款 MT7621（MIPS） | 自带 Wi-Fi | CPU、内存、闪存都紧张 |

Intel 官方规格中 N100 为 4 核 4 线程、最高 3.4 GHz、TDP 6 W，支持 AES-NI。硬路由要特别注意架构：HomeProxy 的包描述写明面向 ARM64 / AMD64，PassWall 的编译选项里 Xray、sing-box 默认只在 aarch64、arm、i386、x86_64 上启用，老的 MIPS 路由器即使能装上也难跑出理想速度。

### 性能瓶颈在哪

普通 NAT 转发主要在内核里完成，甚至能交给硬件加速；而被代理的连接要被转进用户态程序（mihomo、sing-box、Xray），匹配规则后再加密发往节点。**用户态转发和加解密是主要开销**，在没有硬件加密指令的设备上，加解密的负担尤其突出。所以优先看：

- **加密指令**：x86 看 AES-NI，ARMv8 看 Crypto 扩展；没有硬件 AES 时 ChaCha20-Poly1305 通常更快
- **单核性能**：一条连接的单个方向基本是串行处理的，单连接测速往往受单核性能约束
- **内存与存储**：核心常驻内存，GeoIP / GeoSite 和规则集越大占用越高；硬路由闪存可能装得下却放不下更新
- **网口**：宽带超过千兆时，千兆口本身就是上限；单网口旁路由的上传和下载共用一个口（以太网全双工，单向下载仍可接近线速，上下行同时跑满时才会互相挤占）

另外，国内直连流量只要仍被转进代理核心，就有用户态转发开销，只有在防火墙层放行的流量（如 OpenClash 的「绕过中国大陆」）才走内核转发。多数时候速度先被节点和线路卡住，见 [速度慢的常见原因与优化思路](/posts/speed-optimization/)。

```bash
# x86：有输出 aes 即支持 AES-NI
grep -m1 -o -w aes /proc/cpuinfo
# ARM：看 Features 行里是否有 aes、pmull、sha2
grep -m1 Features /proc/cpuinfo
# 粗测加解密吞吐（需安装 openssl-util）
openssl speed -evp aes-128-gcm
openssl speed -evp chacha20-poly1305
```

---

## 固件：OpenWrt、ImmortalWrt、iStoreOS

| 固件 | 定位 | 现状（2026 年 9 月） | 代理插件从哪来 |
|------|------|--------------------|--------------|
| OpenWrt 官方 | 上游项目 | 稳定版为 25.12 系列（25.12.0 于 2026-03-05 发布，改用 apk 包管理器）；官方表示 24.10 在 2026 年 9 月后不再提供安全更新 | 官方源不含 OpenClash、nikki、PassWall、HomeProxy 等 LuCI 插件（sing-box 核心在官方 packages 源里）；OpenClash、PassWall 可从项目 Releases 安装，nikki 可添加其 feed；HomeProxy 没有独立的发布渠道，主要随 ImmortalWrt 软件源提供，在官方 OpenWrt 上需自行编译或使用其 CI 构建产物 |
| ImmortalWrt | OpenWrt 分支，面向中国大陆用户，移植更多软件包、支持更多设备 | 提供 24.10、25.12 系列 | LuCI 源带有 luci-app-openclash、luci-app-homeproxy、luci-app-passwall，版本可能落后于项目上游 |
| iStoreOS | 基于 OpenWrt 的入门级路由兼 NAS 系统，带 iStore 应用商店 | GitHub 默认分支为 istoreos-24.10（基于本月到期停更的 OpenWrt 24.10），仓库另有 istoreos-25.12 分支在更新；实际可下载的固件版本以官方发布说明为准 | 通过 iStore 或手动安装；后续安全更新以其发布说明为准 |

补充几点：

- **防火墙后端**：OpenWrt 22.03 起默认使用基于 nftables 的 firewall4（fw4），仍停留在 iptables（fw3）的多是很老或第三方改版的固件
- **默认密码**：OpenWrt 与 ImmortalWrt 后台默认在 `192.168.1.1`，root 没有密码，首次登录请立即在 LuCI「系统 → 管理权」设置密码（SSH 里用 `passwd`）
- **整合固件**：「集成全部插件」的第三方固件来源不透明、往往也不再更新，网关看得到全家流量，建议用官方或公开源码的分支，插件自己装

25.12 换成 apk 后的常用命令对照（出自 OpenWrt 官方对照表）：

| 操作 | opkg（24.10 及更早） | apk（25.12 起） |
|------|--------------------|----------------|
| 更新软件源 | `opkg update` | `apk update` |
| 安装 / 卸载 | `opkg install 包名` / `opkg remove 包名` | `apk add 包名` / `apk del 包名` |
| 安装本地未签名包 | `opkg install ./xxx.ipk` | `apk add --allow-untrusted ./xxx.apk` |

`--allow-untrusted` 会跳过签名校验，只对确认来源的包使用。

---

## 代理插件怎么选

| 插件 | 核心 | 配置方式 | 防火墙 | 适合谁 |
|------|------|---------|-------|-------|
| OpenClash | mihomo | Clash YAML 订阅 + LuCI 选项 + 覆写 | fw3 / fw4 | 习惯 Clash 订阅和规则的用户，中文资料最多 |
| nikki | mihomo | mihomo 配置文件 + Mixin 覆写 | 仅 fw4 | 系统较新、想用接近原生 mihomo 配置的用户 |
| HomeProxy | sing-box | LuCI 表单分页配置 | 仅 fw4 | ImmortalWrt 用户、ARM64 / x86-64 设备 |
| PassWall / PassWall2 | Xray、sing-box 等 | LuCI 表单，节点 + 分流 | fw3 / fw4 各有实现 | 节点以 Xray 生态为主的用户 |
| ShellCrash | mihomo、sing-box | SSH 交互式脚本 + 可选 Web 面板 | 脚本自行处理 | 梅林、Padavan 等非 OpenWrt 固件，或普通 Linux |

**先解决下载问题**：安装时路由器本身还没有代理，访问 GitHub（插件 Releases、feed 脚本、核心文件）可能很慢甚至失败。常用办法是在已经能访问的电脑上下载好插件包和核心文件，再通过 LuCI「系统 → 软件包 → 上传软件包」安装，或用 `scp -O 文件名 root@192.168.1.2:/tmp/` 传到路由器后用命令安装（OpenWrt 默认的 SSH 服务 dropbear 不带 SFTP，而 OpenSSH 9.0 起 scp 默认走 SFTP，所以要加 `-O`）。ImmortalWrt 用户可以直接从它的软件源安装插件。

无论选哪个，**同一时间只运行一个代理插件**。OpenClash 文档明确提到它不能与 PassWall、AdGuard Home 等同样修改 DNS 或防火墙的插件共存。

**OpenClash**：OpenWrt 上资料最多的 Clash 系插件（Clash 家族关系见 [Clash 系列全解](/posts/clash-family/)）。运行模式分兼容模式（Redir-Host）和 Fake-IP 两类，各有 TUN 与混合变体，项目文档把 Fake-IP 模式作为日常首选。它依赖 dnsmasq-full，因为精简版 dnsmasq 缺少 ipset / nftset 支持。默认 DNS 链路是「设备 → dnsmasq（53）→ 核心（7874）」，另有「绕过中国大陆」「旁路网关（旁路由）兼容」「仅允许内网」等实用选项。需要注意，OpenClash 文档认为旁路由组网存在固有的网络层面缺陷，强烈建议用主路由部署；它的 IPv6 方案也写明只适用于主路由拨号环境、旁路由不适用。选择旁路由，就意味着要自己处理下文的回程 SNAT 和 IPv6 绕行问题。

替换 dnsmasq 时，局域网设备会暂时失去 DNS 和 DHCP，新包万一装不上会更麻烦（路由器自身一般不受影响：dnsmasq 停止时，启动脚本会把路由器自己的 DNS 切回上游）。所以 opkg 系统建议先把包下载好再替换：

```bash
# OpenWrt 24.10 及更早：先下载，再删旧装新
cd /tmp
opkg update
opkg install dnsmasq-full --download-only
opkg remove dnsmasq
opkg install dnsmasq-full --cache /tmp
rm -f /tmp/dnsmasq-full*.ipk   # /tmp 是内存盘，装完清理
```

25.12 的 apk 系统可以在 LuCI「系统 → 软件包」操作，或执行官方对照表中的示例：

```bash
# OpenWrt 25.12（apk）
apk --update-cache add dnsmasq-full
# 若提示与 dnsmasq 冲突，再删旧装新
apk del dnsmasq && apk add dnsmasq-full
```

两种系统操作时都请用网线连接。

**nikki**：前身是 OpenWrt-mihomo（旧仓库地址现会跳转到 nikkinikki-org/OpenWrt-nikki），同样用 mihomo 核心。README 列出的前提是 OpenWrt ≥ 24.10、内核 ≥ 5.13、firewall4，支持 Redirect / TPROXY / TUN 与 IPv4 / IPv6。它主要由 mihomo 配置文件决定行为，各段含义见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。官方推荐的安装方式：

```bash
# 添加 feed（只需一次）
wget -O - https://github.com/nikkinikki-org/OpenWrt-nikki/raw/refs/heads/main/feed.sh | ash
# opkg 系统
opkg install nikki luci-app-nikki luci-i18n-nikki-zh-cn
# apk 系统
apk add nikki luci-app-nikki luci-i18n-nikki-zh-cn
```

第一条命令会以 root 执行远程脚本，并把 nikki 仓库的签名公钥加入系统信任（apk 系统写入 `/etc/apk/keys/nikki.pem`，opkg 系统执行 `opkg-key add`），之后这个源里的包都会被当作可信包安装。可以先下载下来确认内容再运行，脚本末尾会自行执行 `opkg update` 或 `apk update`：

```bash
wget -O /tmp/feed.sh https://github.com/nikkinikki-org/OpenWrt-nikki/raw/refs/heads/main/feed.sh
cat /tmp/feed.sh    # 确认内容
ash /tmp/feed.sh
```

**HomeProxy**：ImmortalWrt 项目维护，基于 sing-box（见 [Sing-box 使用指南](/posts/singbox-guide/)），依赖 `firewall4` 与 `kmod-nft-tproxy`。代理方式可选 Redirect TCP、Redirect TCP + TProxy UDP（默认）、Redirect TCP + Tun UDP、Tun TCP/UDP；路由模式默认「绕过中国大陆」。订阅解析分享链接、Base64 列表和 SIP008，不直接导入 Clash YAML。

**PassWall / PassWall2**：由 Openwrt-Passwall 组织维护，编译选项里同时有 iptables 与 nftables 两套透明代理实现，检测到 firewall4 时默认用 nftables。用 Xray 核心要注意：PassWall 仓库公告提到，自 2026 年 6 月 1 日起 Xray-core 不再接受 `allowInsecure`，自签证书节点需提供 `pinnedPeerCertSha256`，或改用 sing-box 核心。

**ShellCrash**：在 Shell 环境部署和管理 mihomo / sing-box 的脚本，不依赖 LuCI，适合刷不了 OpenWrt 的设备。它的安装方式是「下载远程脚本以 root 执行」，官方命令里还带了跳过证书校验的参数，建议先把脚本下载下来看一遍，命令以项目 README 为准。

---

## 透明代理原理：流量是怎么被截下来的

「透明代理」指设备不做任何代理设置，数据包到达网关时被防火墙规则或路由表转交给代理程序。主要有三种机制：

- **REDIRECT**：在 NAT 阶段把目标地址改成本机端口（mihomo 的 `redir-port`），程序再通过连接跟踪查回原始目标。简单，但 Linux 内核文档指出它会改写数据包，UDP 场景下拿不到原始目标地址，所以**只适合 TCP**
- **TPROXY**：在 mangle 阶段打标记，配合策略路由把包当作发往本机处理，交给 `tproxy-port`，**目标地址不变**，TCP 和 UDP 都能处理
- **TUN**：由路由表把流量导入虚拟网卡，代理程序从网卡读出 IP 包，再借助系统协议栈（system）或用户态协议栈（gVisor 等）还原成 TCP / UDP 连接。sing-box 从 1.10.0 起提供仅限 Linux 的 `auto_redirect`，文档说明它会自动向 OpenWrt 的 fw4 表插入兼容规则；mihomo 的 TUN 也有 Linux 专用的 `auto-redirect`

TPROXY 依赖的策略路由在内核文档中的示例如下，插件会自动完成，列出来只为理解原理：

```bash
# 带 mark 1 的包查 100 号表，该表把所有地址都当作本机地址
ip rule add fwmark 1 lookup 100
ip route add local 0.0.0.0/0 dev lo table 100
```

| 机制 | TCP | UDP | 原始目标地址 | 额外要求 |
|------|-----|-----|------------|---------|
| REDIRECT | 支持 | 不适用 | 连接跟踪查询 | 最简单 |
| TPROXY | 支持 | 支持 | 原样保留 | 策略路由 + `kmod-nft-tproxy`（fw4）或 `iptables-mod-tproxy`（fw3） |
| TUN | 支持 | 支持 | 从 IP 包头直接读取 | `kmod-tun` |

mihomo 文档写明 `redir-port` 只处理 TCP（Linux、macOS），`tproxy-port` 处理 TCP 与 UDP（仅 Linux）。OpenClash 的非 TUN 模式和 HomeProxy 的默认方式都是「REDIRECT 管 TCP、TPROXY 管 UDP」；OpenClash 在 Redir-Host 模式下还有一个「UDP 流量转发」开关（默认开启），关掉后 UDP 就不再交给核心。**游戏语音、QUIC、NAT 类型等依赖 UDP 的场景，务必确认 UDP 走的是 TPROXY 或 TUN**，详见 [代理能打游戏吗](/posts/gaming-and-proxy/)。

**iptables 与 nftables**：fw3 时代插件往 iptables 插规则，fw4 时代往 nftables 里加规则（OpenClash 把链加在 `inet fw4` 表中，nikki 则使用独立的 `inet nikki` 表）。对用户的影响主要是依赖包不同（装错是「插件启动了但不生效」的常见原因），以及排查要用 `nft list ruleset` 查看全部表，而不是照旧教程敲 `iptables -t nat -L`。

**DNS 劫持**：DNS 也要交给代理核心，Fake-IP 才能生效。以 OpenClash 为例，「本地 DNS 劫持」有两种方式：默认的「Dnsmasq 转发」先用防火墙把局域网所有 53 端口请求重定向到 dnsmasq，再由 dnsmasq 转给核心（7874），同时把 dnsmasq 的缓存设为 0；「防火墙转发」则把 53 端口请求直接重定向到核心，绕过 dnsmasq。两种都能接住设备里写死的 IPv4 DNS（如 `8.8.8.8`）。走 DoH / DoT 的设备劫持不到，处理方式见 [各客户端 DNS 配置最佳实践](/posts/dns-best-practices/)。

**Fake-IP 还是 Redir-Host**：原理见 [Fake-IP vs Redir-Host：一次讲清楚](/posts/fake-ip-vs-redir-host/)。放到路由器上，Fake-IP 意味着全家设备都拿到 `198.18.x.x` 假地址，要维护好 `fake-ip-filter`（NTP、STUN、游戏平台、局域网域名），插件停掉后设备缓存的假地址会让部分网页短时间打不开；Redir-Host 让设备拿到真实 IP，对 BT / PT 和 P2P 更友好，但要处理 DNS 污染。多数家庭用 Fake-IP 即可，跑 PT 的 NAS 可以用访问控制排除，或加一条 `SRC-IP-CIDR,192.168.1.x/32,DIRECT`。

---

## 旁路由配置步骤

以主路由 `192.168.1.1`、旁路由 `192.168.1.2` 为例，旁路由系统为 OpenWrt / ImmortalWrt。刚刷好的 OpenWrt 默认也是 `192.168.1.1`，会和主路由冲突，先单独用网线连电脑改好 IP 再接入局域网。

动手前先在电脑上看一下默认网关：Windows 用 `ipconfig`，Linux 用 `ip route`，macOS 用 `netstat -rn`。主路由不在 192.168.1.x 网段的（不少品牌路由器默认用别的网段），下文所有 `192.168.1.x` 都要换成自己的网段。旁路由的地址要选在主路由 DHCP 地址池之外，或在主路由上把它设为保留地址，否则可能与其他设备的 IP 冲突，出现时好时坏的断网。

### 第 1 步：旁路由的静态 IP、网关与 DNS

命令改自 OpenWrt 官方「Bridged AP」文档，在旁路由 SSH 中执行：

```bash
uci set network.lan.proto='static'
uci set network.lan.ipaddr='192.168.1.2'
uci set network.lan.netmask='255.255.255.0'
uci set network.lan.gateway='192.168.1.1'
uci set network.lan.dns='192.168.1.1'
uci commit network
```

多网口设备：在 LuCI「网络 → 接口 → 设备」编辑 `br-lan`，把连主路由的网口加进网桥端口，或者直接把网线插在已属于 `br-lan` 的口上（x86 设备哪个口是 LAN 以实际配置为准，插错就进不了后台）；用不到的 WAN 接口可以删除。

### 第 2 步：决定由谁发 DHCP

同一网段只能有一个 DHCP 服务器。先确认主路由能否自定义 DHCP 下发的「默认网关」：OpenWrt、梅林等固件可以；不少光猫和品牌家用路由器只能改 DNS、不能改网关，而只改 DNS 并不会让流量经过旁路由。

- **主路由能改网关（推荐，恢复简单）**：旁路由不发 DHCP，由主路由把网关和 DNS 下发为旁路由，执行下面的命令
- **主路由改不了**：退回拓扑 C，在设备上手动填写；或者在主路由后台关闭 DHCP，旁路由保持默认的 DHCP 开启，并跳过下面的命令。OpenWrt 检测到网段里已有其他 DHCP 服务器时默认不会提供服务，所以必须先关掉主路由的 DHCP。旁路由上的 dnsmasq 默认把自己作为网关和 DNS 下发，代价是旁路由一挂，新设备连地址都拿不到

旁路由不发 DHCP 时，在旁路由上关闭 DHCP 与 IPv6 通告：

```bash
uci set dhcp.lan.ignore='1'
uci set dhcp.lan.dhcpv4='disabled'
uci set dhcp.lan.dhcpv6='disabled'
uci set dhcp.lan.ra='disabled'
uci commit dhcp
/etc/init.d/network restart   # SSH 会断开，用新 IP 重连
```

主路由也是 OpenWrt 时，可以只给指定设备下发（DHCP 选项 3 是网关，6 是 DNS）：

```bash
# 在主路由上：定义标签 viaproxy
uci set dhcp.viaproxy='tag'
uci add_list dhcp.viaproxy.dhcp_option='3,192.168.1.2'
uci add_list dhcp.viaproxy.dhcp_option='6,192.168.1.2'
# 给电视做静态分配并打标签（MAC 换成你的设备）
uci add dhcp host
uci set dhcp.@host[-1].name='living-tv'
uci set dhcp.@host[-1].mac='AA:BB:CC:DD:EE:FF'
uci set dhcp.@host[-1].ip='192.168.1.50'
uci set dhcp.@host[-1].tag='viaproxy'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

想让全屋都走旁路由，就把两条 `dhcp_option` 加到 `dhcp.lan` 上（`uci add_list dhcp.lan.dhcp_option='3,192.168.1.2'`，6 号选项同理），再提交并重启 dnsmasq。

### 第 3 步：装插件，确认 DNS 链路

以 OpenClash 为例，最小流程如下（选项名称随版本略有变化，以插件界面为准）：

1. 按上文先把 dnsmasq 换成 dnsmasq-full。
2. 从 OpenClash Releases 下载与系统匹配的安装包（24.10 及更早用 `.ipk`，25.12 用 `.apk`），在 LuCI「系统 → 软件包 → 上传软件包」安装；命令行安装和完整依赖列表以项目 README 为准，fw4 系统需要 `kmod-nft-tproxy`。ImmortalWrt 可以直接在软件包列表里搜索 `luci-app-openclash`。
3. 进入「服务 → OpenClash」，在「插件设置 → 版本更新」里先选好与 CPU 匹配的编译版本，再下载 mihomo（Meta）核心；该页面可以切换下载用的 CDN 地址，直连 GitHub 不通时可以试试。
4. 在「配置订阅」里填入订阅地址并更新；在「插件设置 → 模式设置」里运行模式选 Fake-IP，旁路由场景打开「旁路网关（旁路由）兼容」。
5. 启动插件，再做下面的检查。

插件启动后，在一台走旁路由的设备上执行 `nslookup www.google.com`：Fake-IP 模式下，Server 应是 `192.168.1.2`，返回地址在 `198.18.0.0/15` 内。如果 Server 是主路由或运营商的 IPv6 DNS，说明 DNS 绕过了旁路由，看下文 IPv6 一节。之后再打开插件自带的控制面板看连接日志，确认电视等设备的连接命中了预期的规则和节点。

### 第 4 步：处理回程路径

旁路由直接转发给主路由的流量，主路由回包时发现目标设备就在同网段，会直接发给设备、不再经过旁路由，形成不对称路径，可能导致部分连接异常。常见做法是让旁路由对转发流量做 SNAT：OpenClash 的「旁路网关（旁路由）兼容」会对它处理的流量做 MASQUERADE；通用做法是开启旁路由 lan 区域的 IP 动态伪装：

```bash
# 默认配置中第一个 zone 是 lan，改过防火墙的先用 uci show firewall 确认
uci set firewall.@zone[0].masq='1'
uci commit firewall
/etc/init.d/firewall restart
```

代价是主路由上所有流量都显示来自 `192.168.1.2`，按设备统计、家长控制等功能会失效。

### IPv6 的坑：设备悄悄绕过旁路由

主路由或光猫通过 RA 给设备下发 IPv6 地址和默认路由，往往还通过 RDNSS 或 DHCPv6 下发 IPv6 DNS。结果是访问有 AAAA 记录的网站时设备直接从主路由走 IPv6，完全不经过旁路由；设备还会用主路由或运营商的 IPv6 DNS，分流失效并造成 [DNS 泄漏](/posts/dns-leak/)。IPv6 基础见 [IPv4 与 IPv6 基础](/posts/ipv4-vs-ipv6-basics/)。

| 方案 | 做法 | 代价 |
|------|------|------|
| 关掉局域网 IPv6 | 主路由 LAN 不发 RA、不开 DHCPv6 | 失去 IPv6，最省事 |
| 地址照发，DNS 只走 IPv4 | 主路由不通告 IPv6 DNS；代理核心不给代理域名返回真实 AAAA | 需要主路由支持该设置 |
| 旁路由完整接管 IPv6 | 开启插件 IPv6 代理，并让旁路由发出更高优先级的 RA | 配置复杂，不建议新手 |

第二种借鉴了 OpenClash 文档的思路：DNS 只走 IPv4 查询并经过分流，流量仍可走 IPv6。但该文档的完整方案面向主路由拨号环境，还要求开启 AAAA 解析；旁路由上只能用到「主路由不下发 IPv6 DNS」这一半，而且代理域名不能返回真实 AAAA，否则设备拿到 IPv6 地址后会直接从主路由出去。主路由为 OpenWrt 时：

```bash
# 继续下发 IPv6 地址，但不把自己通告为 IPv6 DNS
# （LuCI 中对应「本地 IPv6 DNS 服务器」）
uci set dhcp.lan.dns_service='0'
uci commit dhcp
/etc/init.d/odhcpd restart
# 若决定关闭局域网 IPv6，把上面 dns_service 那一行换成下面两行，
# 再同样 commit 并重启 odhcpd：
# uci set dhcp.lan.ra='disabled'
# uci set dhcp.lan.dhcpv6='disabled'
```

光猫直接下发 IPv6 的，要在光猫上找对应设置，找不到就只能关闭 IPv6。

### DNS 回环与转发链

旁路由场景的 DNS 链路是：设备 → 旁路由 dnsmasq → 代理核心 DNS → 直连域名交给上游，代理域名返回 Fake-IP 并由节点远端解析。常见的回环是**主路由的上游被设成旁路由，而旁路由或代理核心的上游又是主路由**，查询在两者之间打转直到超时。

原则：主路由的上游永远指向运营商或公共 DNS，不指回旁路由；代理核心的上游写明确的公共 DNS 或 DoH 地址；旁路由的系统 DNS 指向主路由。mihomo 的 `default-nameserver` 必须写 IP，`proxy-server-nameserver` 专门解析节点域名，写清楚这两项能避开核心启动时的自举问题。排查时在旁路由上分别向主路由、dnsmasq 和代理核心查询同一个域名，哪一段超时，断点就在哪一段：

```bash
nslookup www.google.com 192.168.1.1     # 主路由
nslookup www.google.com 127.0.0.1       # 旁路由上的 dnsmasq
# 查询非 53 端口要用 dig：opkg install bind-dig 或 apk add bind-dig
dig @127.0.0.1 -p 7874 www.google.com   # OpenClash 核心默认 DNS 端口
```

---

## 旁路由挂了全家断网：风险与缓解

代理核心崩溃但防火墙规则还在时，被劫持的流量无处可去，国内网站也会一起打不开。缓解措施按投入从低到高：

1. **分级接入**：只让真正需要的设备走旁路由，手机和电脑用自己的客户端
2. **保留主路由 DHCP**：恢复时只需删掉主路由上下发旁路由的选项
3. **缩短租期**：DHCP 变更要等设备续租才生效，OpenWrt 默认租期 12 小时；紧急时让设备断开重连 Wi-Fi 也会重新获取
4. **应急说明**：给家人留一份「先重启旁路由，不行再在主路由后台删除网关下发」的步骤
5. **守护与自启**：用插件自带的看门狗，x86 小主机在 BIOS 里打开来电自启
6. **网关冗余（进阶）**：主路由也是 OpenWrt 时，可以在两台上都装 keepalived（VRRP），让主路由在旁路由失联时接管同一个虚拟网关 IP；光猫和多数品牌路由器跑不了 keepalived。VRRP 默认只感知对端是否在线，要应对「核心崩溃但规则还在」，还需要用 `track_script` 检测代理进程或 DNS 端口

---

## 安全：别让网关变成后门

- **后台不对外**：OpenWrt 默认防火墙拒绝 WAN 入站，不要把 LuCI 或 SSH 端口转发到公网；远程管理先用 WireGuard 等方式回到家里网络
- **旁路由后台对整个局域网可见**：访客和 IoT 设备也能访问它，设置强密码，SSH 改用密钥登录
- **控制面板加密钥**：mihomo 的 `external-controller`（OpenClash 默认 9090 端口）要设置 `secret`，OpenClash 的「仅允许内网」默认开启，不要随手关掉
- **及时更新**：24.10 已到安全更新截止期，新装建议直接用 25.12，插件和核心也要跟进，更新前备份配置
- **订阅链接就是凭据**：插件配置和系统备份文件里都有它，求助时不要发备份文件或未打码的截图，泄漏后到服务商后台重置。公共订阅转换的风险见 [订阅转换与管理](/posts/subscription-management/)

---

## 不想折腾路由器的替代方案

**电脑开「局域网连接」当代理服务器**：mihomo 的 `allow-lan` 允许局域网设备连接本机代理端口，Clash Verge Rev 设置页里对应「局域网连接」开关，默认混合端口为 7897。其他设备在 Wi-Fi 设置里手动填 HTTP 代理（电脑 IP 加端口）。它**不是网关**：只有遵循系统代理设置的应用会走它，游戏的 UDP 不会。开启后记得放行电脑防火墙，并用 `lan-allowed-ips` 限制来源。这个白名单会覆盖默认的 `0.0.0.0/0`，而且本机发起的连接同样要过这道检查，所以必须把本机回环地址一起写上，否则电脑自己的系统代理也会被拒绝：

```yaml
allow-lan: true
lan-allowed-ips:
  - 127.0.0.1/8      # 本机，必须保留
  - ::1/128
  - 192.168.1.0/24   # 换成自己的局域网网段
```

在 Clash Verge Rev 里，`allow-lan` 以设置页的「局域网连接」开关为准。`authentication` 可以给代理端口加用户名和密码，但 Android 的 Wi-Fi 代理设置和不少电视、游戏机都没有填账号的地方，加了反而连不上；而且加了之后本机程序也要认证，除非另用 `skip-auth-prefixes` 豁免本机。家庭局域网用 `lan-allowed-ips` 限制来源通常就够了，完整写法见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

**电脑开热点或网络共享，再开 TUN**：Windows 的「移动热点」、macOS 的「互联网共享」可以让电视、游戏机连到电脑上，电脑上的客户端开启 TUN 后，这些设备的流量（包括 UDP）有机会经过它。能否被 TUN 接管取决于系统、客户端和 TUN 实现，先拿一台设备测试，而且电脑需要一直开着。

**Surge for Mac 网关模式**：Surge 官方知识库介绍了两种用法，设备手动把网关设为 Mac 的 IP、DNS 设为 `198.18.0.2`，或开启 Surge 内置 DHCP 服务器（需关闭原有 DHCP）。官方建议有线连接加静态 IP，并提醒不要随意移动或关闭这台 Mac；Surge Mac 6.0 起可发送更高优先级的 RA 接管 IPv6。Surge 为付费软件。

**一台常开的 Linux 主机**：NAS 或旧电脑可以跑 ShellCrash（支持普通 Linux 和 Docker），或直接运行 mihomo / sing-box 的 TUN（开启 `auto-route`；Linux 上建议同时开启 mihomo 的 `auto-redirect` 或 sing-box 的 `auto_redirect`），并持久开启 IP 转发，再按拓扑 C 让个别设备指向它。`sysctl -w` 重启后就失效，失效后指向这台主机的设备会整体断网，所以写进配置文件：

```bash
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-forward.conf
sudo sysctl --system
```

装了 Docker 的主机要多留意：Docker 自行开启 IP 转发时，会把防火墙的转发策略设为丢弃，其他设备转发过来的流量会被静默丢掉。可以按 Docker 文档在 `/etc/docker/daemon.json` 中加入 `"ip-forward-no-drop": true` 后重启 Docker，或者自行放行转发流量。

**每台设备装客户端**：手机和电脑往往更适合这样做，出门也能用，见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/)。

---

## 排障清单

| 症状 | 常见原因 | 先查什么 |
|------|---------|---------|
| 能上国内，上不了国外 | 设备网关或 DNS 没指向代理网关；插件未运行；节点不可用 | 设备上 `nslookup` 看 DNS 服务器和返回地址；插件日志 |
| 国内外都上不了 | 核心崩溃但规则仍在；旁路由网关或 DNS 配错；DNS 回环 | 停掉插件看是否恢复；在旁路由上 `ping 223.5.5.5` |
| ping 通（延迟异常低），网页打不开 | OpenClash 下 ping 从不经过节点；TUN / 混合模式下 ping Fake-IP 会得到核心伪造的约 0 ms 回复，不代表节点可用 | 用 `curl -I` 测 HTTP，看连接日志 |
| ping 不通，网页正常 | Fake-IP 非 TUN 模式下，OpenClash 的防火墙会直接拒绝发往 Fake-IP 段的 ping，属正常现象 | 以 `curl -I` 或浏览器结果为准 |
| 部分设备不走代理 | 设备拿到主路由的 IPv6 或 DNS；设备设了静态 IP；访问控制名单 | 查设备 IPv6 地址与 DNS，查插件黑白名单 |
| 游戏 NAT 严格、语音不通 | UDP 只被 REDIRECT 或未被代理；节点不支持 UDP；STUN 域名拿到假地址 | 改用 TPROXY / TUN，检查 `fake-ip-filter` |
| 时间不同步、证书报错 | NTP 域名拿到 Fake-IP | `fake-ip-filter` 加 NTP 域名，路由器上 `date` 查时间 |
| 投屏、打印机、Windows 提示无 Internet | `.local`、`.lan`、连接检测域名拿到假地址 | 把这些域名加入 `fake-ip-filter` |
| Xray 核心的自签证书节点失效 | 2026-06-01 起不再接受 `allowInsecure` | 索取 `pinnedPeerCertSha256` 或换 sing-box 核心 |

`fake-ip-filter` 的完整写法见 [Fake-IP 模式下的 DNS 问题排查](/posts/fake-ip-dns-issues/)，节点本身的问题见 [节点连不上？系统排查流程](/posts/connectivity-checklist/)。路由器 SSH 里常用的只读检查：

```bash
tail -n 50 /tmp/openclash.log        # OpenClash 运行日志
nft list ruleset | grep -c tproxy    # fw4 下 TPROXY 规则条数
ip rule show                         # TPROXY / TUN 所需的策略路由
logread | tail -n 50                 # 系统日志，看 dnsmasq、odhcpd 报错
```

---

## 常见问题（FAQ）

### 软路由和旁路由是一回事吗？

不是一个维度。「软路由」指硬件形态：x86 小主机或开发板装上 OpenWrt 这类系统；「旁路由」指网络位置：不做主路由，作为同网段的另一个网关。软路由可以做主路由也可以做旁路由，刷了 OpenWrt 的硬路由同样能当旁路由。

### 旁路由一定要关 DHCP 吗？

同一网段有两个 DHCP 服务器时，设备会随机拿到其中一个的地址和网关，现象时好时坏。要么关旁路由的 DHCP、由主路由下发旁路由为网关（推荐，恢复简单），要么关主路由的 DHCP、由旁路由发。IPv6 的 RA 和 DHCPv6 也要一并考虑。

### 主路由是光猫，改不了下发的网关怎么办？

三个选择：在需要代理的设备上手动填写（拓扑 C）；关闭光猫 DHCP，由旁路由发；或把光猫改为桥接，由 OpenWrt 做主路由（拓扑 A）。改光猫前确认自己能恢复原配置，部分高级设置需要运营商的管理员账号。

### 几个代理插件能同时装着吗？

装着可以，不要同时运行。它们都会接管 dnsmasq 和防火墙规则，同时启用会互相覆盖。切换时先停止并禁用旧插件的开机自启，再启动新插件。

### 旁路由会拖慢国内网速吗？

多一跳局域网转发的延迟可以忽略。真正可能变慢的原因是：国内流量也被送进代理核心、DNS 没用国内上游导致解析到远端 CDN，或单网口旁路由在上下行同时大流量时的带宽争用：以太网是全双工的，单向下载仍可接近线速，但上传和下载同时跑满时，同一方向上会有两股流量挤在这一个口上。前两者可以用「绕过中国大陆」类选项和正确的 DNS 配置解决。

### 怎么判断路由器是不是速度瓶颈？

同一时刻对比两组数据：电脑用客户端直连同一节点的速度，和经过路由器的速度；同时在路由器上用 `top` 看 CPU 是否跑满。测速和延迟数字本身的含义见 [延迟测试数字的含义](/posts/latency-test-explained/)。

---

## 外部参考

- [OpenWrt 25.12.0 发布说明](https://openwrt.org/releases/25.12/notes-25.12.0) — apk 迁移与 24.10 安全更新截止时间
- [OpenWrt opkg 与 apk 命令对照](https://openwrt.org/docs/guide-user/additional-software/opkg-to-apk-cheatsheet)
- [OpenWrt 防火墙配置](https://openwrt.org/docs/guide-user/firewall/firewall_configuration) — 22.03 起默认 firewall4
- [OpenWrt Bridged AP 文档](https://openwrt.org/docs/guide-user/network/wifi/wifiextenders/bridgedap) — 静态 IP 与关闭 DHCP / RA
- [OpenWrt DHCP 配置](https://openwrt.org/docs/guide-user/base-system/dhcp_configuration) — 静态分配与 DHCP 标签 ／ [DHCP 选项参考](https://openwrt.org/docs/guide-user/base-system/dhcp) — `force` 选项与默认租期
- [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) ／ [iStoreOS](https://github.com/istoreos/istoreos)
- [OpenClash](https://github.com/vernesong/OpenClash) ／ [OpenClash 使用手册](https://github.com/vernesong/OpenClash/blob/dev/.github/skills/openclash-user-guide/SKILL.md) — DNS 劫持、ICMP 处理、IPv6 与旁路由说明
- [nikki](https://github.com/nikkinikki-org/OpenWrt-nikki) ／ [HomeProxy](https://github.com/immortalwrt/homeproxy)
- [PassWall](https://github.com/Openwrt-Passwall/openwrt-passwall) ／ [PassWall2](https://github.com/Openwrt-Passwall/openwrt-passwall2) ／ [ShellCrash](https://github.com/juewuy/ShellCrash)
- [mihomo 文档](https://wiki.metacubex.one/) ／ [sing-box TUN 文档](https://sing-box.sagernet.org/configuration/inbound/tun/)
- [Linux 内核 TPROXY 文档](https://docs.kernel.org/networking/tproxy.html)
- [Surge 网关模式指南](https://kb.nssurge.com/surge-knowledge-base/guidelines/gateway)
- [Docker 包过滤与防火墙](https://docs.docker.com/engine/network/packet-filtering-firewalls/) — `ip-forward-no-drop`
- 站内相关：[Fake-IP vs Redir-Host](/posts/fake-ip-vs-redir-host/)、[各客户端 DNS 配置最佳实践](/posts/dns-best-practices/)、[TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)、[代理能打游戏吗](/posts/gaming-and-proxy/)
