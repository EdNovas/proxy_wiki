---
title: "Android Root 透明代理：Box for Root、Surfing 等模块的原理与取舍"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 进阶技巧
tags:
  - Android
  - Root
  - 透明代理
  - TUN
  - iptables
  - 进阶
excerpt: "已 Root 的安卓设备可以绕开系统的 VPN 接口，用 iptables 和策略路由把流量直接交给本机运行的代理内核。本文对比 VpnService 与 Root 透明代理的机制差异，梳理 Box for Root、Surfing 等模块的维护现状、安装流程、Root 带来的安全代价与常见排障思路。"
index_img: /images/posts/android-root-transparent-proxy.svg
---

> **摘要**：Android 上的普通代理客户端都通过系统的 VpnService 接口工作，因此带着几条结构性限制：同一用户同时只能有一个 VPN、状态栏有钥匙图标、应用能看出当前网络是 VPN、热点共享的流量不进隧道。已经 Root 的设备还有另一条路：用 Magisk / KernelSU / APatch 模块在系统层写入 iptables 与策略路由规则，把流量透明地交给本机运行的 mihomo、sing-box 等内核。本文讲清两种方式的原理差异，逐一核实 Box for Root、Surfing、box4magisk、akashaProxy、Clash MIX 的维护状态，把 Root 和 root 权限常驻进程带来的风险放在安装步骤之前，再以 Surfing 的官方文档与脚本为准走一遍安装流程。先把结论说在前面：大多数人用 VPN 模式的客户端就够了。

---

## 先说结论

Root 透明代理解决的是 **VpnService 这套机制本身的限制**，而不是速度、稳定性或抗封锁能力。节点、协议、分流规则都一样，出口还是同一台服务器，GFW 看到的流量也没有区别。

| 你的情况 | 建议 |
|---|---|
| 没有 Root，或者手机上有银行、支付、工作类应用 | 用 VPN 模式的客户端，不要为了代理去 Root |
| 只是嫌状态栏的钥匙图标碍眼 | 不值得，代价远大于收益 |
| 设备已经因为其他原因 Root，且 VPN 槽位和别的应用冲突（公司 VPN、本地防火墙、广告拦截） | 可以考虑 Root 模块，但与其他 VPN 共存需要自己验证，见 FAQ |
| 需要把代理共享给热点、USB 共享下的设备 | Root 模块是可选方案之一，也有更轻的做法，见后文 |
| 手机开了应用分身或多用户，希望统一接管 | Root 模块默认就能覆盖所有用户 |
| 不熟悉命令行、看不懂日志 | 先别碰，出问题时很难自救 |

代价同样需要先摆出来：**Root 本身的安全与兼容性代价，再加上一个以 root 身份常驻后台、能看到全部流量的代理进程**。这两点在「风险与代价」一节展开，该节放在安装步骤之前，请动手前读完。

---

## 普通客户端的 VPN 模式：原理与局限

### VpnService 在做什么

Android 不允许普通应用修改路由表。Clash Meta for Android、v2rayNG、sing-box 官方客户端这类应用，走的都是系统提供的 VpnService 接口：

1. **用户授权**：应用第一次启用时，系统弹出连接请求对话框，用户确认信任该应用。
2. **申请虚拟接口**：应用通过 VpnService.Builder 设定虚拟网卡的地址、路由、DNS，以及允许名单或排除名单。
3. **系统导流**：系统把符合条件的应用流量路由到这张虚拟网卡，客户端从中读出一个个 IP 包，还原成连接后交给内核按规则处理。
4. **避免回环**：客户端自己发往节点的连接要排除在隧道之外，否则会绕回自己。

这和桌面端的 TUN 模式本质相同，区别只在于：桌面端的虚拟网卡由客户端以管理员权限自己创建和配置路由，Android 上则由系统代管，应用只能在系统划定的框架里活动。TUN 的一般原理见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。

### 局限逐条核实

下表的每一条都对照了 Android 官方文档或相关项目的说明：

| 局限 | 依据与实际表现 | 对用户的影响 |
|---|---|---|
| 同一用户（或工作资料）同时只有一个活动的 VPN | Android 开发者文档写明：每个用户或配置文件只有一个活动服务，启动新的服务会自动停止旧的 | 代理客户端和公司 VPN、基于本地 VPN 的防火墙或广告拦截类应用互相「顶掉」 |
| 状态栏钥匙图标 | 连接活动时系统在状态栏显示钥匙图标；文档还要求 VPN 应用运行时显示一条不可划掉的通知 | 主要是观感问题，也意味着任何人拿起手机都知道你开着 VPN |
| 应用能识别 VPN 网络 | 系统的网络能力信息里有 TRANSPORT_VPN 这一传输类型，任何应用都可以查询 | 部分应用据此弹出提示、限制功能或拒绝服务 |
| 热点与 USB 共享不进隧道 | VPN 只作用于本机应用；要把共享流量导进 VPN，需要 VPNHotspot 这类依赖 Root 的工具，mihomo 文档也这样提示 | 手机开热点给电脑用时，电脑的流量不经过手机上的代理 |

### 哪些说法不要夸大

- **「VPN 模式更容易被运营商识别」**：VPN 接口只是本机内部的流量入口，对外发出的仍然是代理协议流量，和 Root 方案发出的完全一样。
- **「检测不到 VPN 就检测不到代理」**：Root 方案在 TPROXY 模式下系统里没有 VPN 网络，但出口 IP 依旧是节点的 IP，服务方仍可以按 IP 类型和归属判断，参见 [什么是原生 IP、广播 IP、住宅 IP](/posts/ip-types/)。

---

## Root 透明代理的原理

### 思路：绕开 VPN 接口，直接改系统的数据路径

Root 之后，模块可以像一台 Linux 路由器那样，直接用 iptables（netfilter）和 ip rule（策略路由）改写数据包的去向。代理内核作为一个普通的 Linux 进程在后台运行，监听本机的透明代理端口；模块的脚本负责在开机后启动内核、写入规则，在关闭时清掉规则。

这套机制与 OpenWrt 上的透明代理同源，[软路由与旁路由](/posts/soft-router-guide/) 一文从路由器的角度拆解过 REDIRECT、TPROXY、TUN 三种方式的一般原理。手机上的区别在于：它既是「路由器」，又是发出流量的终端，所以要同时处理本机应用的流量和热点设备转发进来的流量。几种方式放到手机模块里的表现如下：

| 方式 | 在手机模块里的表现 |
|---|---|
| REDIRECT | 只接管 TCP，UDP（包括 QUIC）直连；设备内核缺少 TPROXY 支持时的兜底 |
| TPROXY | TCP 与 UDP 都接管，多数模块的默认方式；本机流量要先在 OUTPUT 打标记，再借策略路由绕回 PREROUTING |
| TUN | 由代理内核自己建 tun 设备，不经过 VpnService，也就不占 VPN 槽位；分应用改由内核配置负责 |
| 混合 | TCP 走 REDIRECT、UDP 走 TUN 或 TPROXY，用来应对设备能力不全 |

具体到模块：Box for Root 的 `network_mode` 提供 redirect、tproxy、mixed、enhance、tun 五种，默认 tproxy；box4magisk 的 `PROXY_MODE` 默认为自动，优先 TPROXY；Surfing 的 `proxy_method` 默认 TPROXY，启用时会先探测设备是否支持 TPROXY，不支持就自动降级为 REDIRECT 并写入日志。

### TPROXY 的数据路径

Linux 内核文档描述的 TPROXY 由三部分配合完成：带 IP_TRANSPARENT 选项的监听套接字、按防火墙标记查表的策略路由、mangle 表里的 TPROXY 目标。放到手机上，本机一个应用发出的包大致经历这些步骤：

1. **应用发起连接**，数据包进入 OUTPUT 链。
2. **打标记**：模块在 mangle 表的 OUTPUT 链上逐条判断——发往局域网和保留地址的放行，代理内核自己的流量放行，名单中要绕过的应用放行，其余打上防火墙标记（fwmark）。
3. **策略路由**：一条 ip rule 把带标记的包送进一张只有「本地默认路由指向 lo」的路由表，包被重新投递给本机。
4. **从 lo 进入 PREROUTING**：包以入站身份经过 PREROUTING 链，TPROXY 目标把它交给代理内核的透明端口，原始目的地址保持不变。
5. **内核决策**：内核按规则选择直连或发往节点。它自己发出的连接属于内核进程的用户和组，在第 2 步就被放行，不会绕回来。

TPROXY 目标只在 PREROUTING 一侧有效，所以本机流量要绕这一圈，这也是各模块脚本看起来复杂的原因。另一个容易忽略的细节：回包同样经过 PREROUTING，TPROXY 目标碰到已经属于普通（非透明）套接字的包会直接丢弃，所以规则要先用 socket 匹配放行这类包，并且只对从 lo 绕回的流量和热点网卡使用 TPROXY。

一个只用来说明原理的骨架（真实脚本还要放行局域网、保留地址，处理 UDP、IPv6、DNS 和热点网卡，**不要直接在手机上执行**）：

```bash
# 策略路由：打了标记 1 的包改查 100 号表，表里只有一条指向 lo 的本地路由
ip rule add fwmark 1 lookup 100
ip route add local 0.0.0.0/0 dev lo table 100

# 已经属于某个本地套接字的包（例如各种回包）只打标记、直接放行，不交给 TPROXY
iptables -t mangle -N DIVERT
iptables -t mangle -A DIVERT -j MARK --set-mark 1
iptables -t mangle -A DIVERT -j ACCEPT
iptables -t mangle -A PREROUTING -p tcp -m socket -j DIVERT

# 入站方向：只接管经策略路由从 lo 绕回来的本机流量（热点另按 ap+ 等网卡加规则）
iptables -t mangle -A PREROUTING -i lo -p tcp -j TPROXY --on-port 1536 --tproxy-mark 1

# 出站方向：给本机应用的 TCP 打标记（这里用组 ID 3005 排除代理内核自身）
iptables -t mangle -A OUTPUT -p tcp -m owner ! --gid-owner 3005 -j MARK --set-mark 1
```

TUN 方式则把路由和规则都交给内核（mihomo、sing-box 等）自己的配置，模块脚本只负责启动内核和少量转发设置。

### 按 UID 分应用

Android 给每个应用分配独立的 Linux UID，iptables 的 owner 模块可以按 UID 匹配本机发出的包，所以模块的黑白名单本质上是一组「按 UID 放行或打标记」的规则。几个细节：

- **多用户与分身**：同一个应用在主用户和分身、多开空间里的 UID 不同，所以配置要写成「用户 ID:包名」。模块文档列出的常见用户 ID 是 0（机主）、10 和 999（分身或多开，具体叫法因厂商而异）。
- **只管本机应用**：按 UID 匹配只对本机发出的流量有效。热点下的设备没有 UID，只能按网卡或 MAC 地址区分，例如 box4magisk 的 MAC 过滤只在开启热点代理时生效。
- **进程级控制**：BFR 文档提到，Android 上的 iptables 没有按进程 PID 匹配的能力；要单独控制某个进程，只能先让它以特定 GID 运行，再按 GID 匹配。
- **TUN 方式另算**：用内核 TUN 时，iptables 名单不起作用，要在内核的 tun 配置里设置包名。mihomo 文档中的 `include-package`、`exclude-package`、`include-android-user` 都只在 Android 上有效，且要求开启 `auto-route`。

### DNS 怎么被接管

模块一般会把本机和热点设备发往 53 端口的 DNS 请求重定向到内核的 DNS 监听端口（box4magisk 与 Surfing 默认都是 1053）。以 Box for Root 和 Surfing 的脚本为例，53 端口的劫持独立于应用名单，也就是说**名单里被绕过的应用，DNS 仍然由内核回答**。

这引出一个容易踩的坑。Box for Root 中文文档写着：「若使用 CLASH，黑白名单在 fake-ip 模式下无效」。原因是被绕过的应用拿到的是内核返回的 Fake-IP 地址，随后「直连」这个并不存在的地址，自然连不上。Surfing 默认也是 fake-ip（见安装流程第 4 步）。需要精细分应用时，要么改用 redir-host，要么把相关域名加入 `fake-ip-filter`，区别见 [Fake-IP vs Redir-Host](/posts/fake-ip-vs-redir-host/)。

另一个坑是 **私人 DNS**。Android 9 起系统内置了 DNS over TLS，走 853 端口，不经过 53 端口的劫持规则。mihomo 文档也提示，开启了私人 DNS 的 Android 设备无法使用自动 DNS 劫持。使用透明代理模块时，建议把系统的私人 DNS 设为关闭。

### 与 VpnService 模式的对比

| 维度 | VPN 模式客户端 | Root 透明代理模块 |
|---|---|---|
| 前提 | 无需 Root | 解锁 Bootloader 并 Root |
| 接管位置 | 系统提供的 VPN 接口 | netfilter 与策略路由，或内核自建 tun |
| VPN 槽位 | 占用当前用户唯一的 VPN | 不占用 |
| 应用查询到 VPN 网络 | 会 | TPROXY、REDIRECT 下系统里没有 VPN 网络；用内核 TUN 时仍有 tun 网卡，按接口名检测的应用可能识别出来；Root 本身也可能被检测 |
| 覆盖范围 | 当前用户或资料内的应用 | 默认覆盖所有用户，另可覆盖热点和 USB 共享 |
| UDP | 取决于客户端实现 | TPROXY、TUN 支持；REDIRECT 模式下 UDP 直连 |
| 分应用 | 系统 API 的允许或排除名单 | iptables 按 UID，或内核 TUN 的包名选项 |
| 出错后果 | 关掉应用即恢复 | 规则残留可能断网，配置回环可能反复重启 |
| 维护方式 | 图形界面，一键更新 | 配置文件、命令行和日志，系统更新后可能要重新 Root |
| 安全边界 | 客户端运行在应用沙箱里 | 内核与脚本以 root 身份运行，没有沙箱 |

---

## 主流模块现状

以下信息核实于 2026 年 9 月下旬，来源是各项目的 GitHub 仓库、README、脚本与发布记录。模块更新很快，动手前请以仓库当前内容为准。

| 模块 | 仓库 | 来历 | 支持的内核 | 导流方式 | Root 方案（按项目自述） | 工作目录 | 维护近况 |
|---|---|---|---|---|---|---|---|
| Box for Root（BFR） | taamarin/box_for_magisk | 2022 年 11 月创建，致谢 box4magisk 为原始模块 | clash（默认 mihomo）、sing-box、Xray、v2ray、hysteria | redirect、tproxy、mixed、enhance、tun | Magisk、KernelSU、APatch | `/data/adb/box` | 最新正式版 v1.10.2（2025 年 9 月），主分支最近一次提交在 2025 年 10 月，未归档 |
| Surfing | GitMetaio/Surfing | 2023 年 8 月从 box4magisk 分叉 | 以 mihomo 为中心，也支持 sing-box、Xray、v2ray、hysteria | REDIRECT、TPROXY、TUN、混合 | Magisk、KernelSU、APatch | `/data/adb/box_bll` | v7.8.4 发布于 2026 年 9 月 7 日，此后主分支仍有提交，同步到 Prerelease-Alpha 预发布 |
| box4magisk | CHIZI-0618/box4magisk | 2022 年 11 月创建，是 BFR 与 Surfing 的上游 | 主分支默认 sing-box，也支持 mihomo、clash、Xray、v2ray、hysteria | REDIRECT、TPROXY、内核 TUN、混合 | Magisk、KernelSU、APatch | `/data/adb/box` | 最新正式版 v5.1（2024 年 9 月，默认内核 mihomo）；预发布 Prerelease 创建于 2026 年 1 月，现指向 2026 年 4 月的构建；主分支 2026 年 9 月仍有提交 |
| akashaProxy | akashaProxy/akashaProxy | 2023 年 11 月创建 | 仅 mihomo | tproxy、tun、redirect | Magisk、KernelSU（README 未提 APatch） | `/data/adb/akashaProxy` | 按「日期-提交号」命名发布，最近一次在 2026 年 8 月 |
| Clash MIX | AXEVO/Clash-MIX | 2023 年 3 月创建 | 内置 mihomo 二进制（从二进制内的模块路径判断，2026 年 4 月构建；仓库文字未说明） | 模块描述写的是 TUN | 无 README；安装脚本对 KernelSU、APatch 做了 WebUI 适配，未见其他说明 | 配置放在共享存储 `/sdcard/Android/Clash` | 最近一次提交在 2026 年 4 月；仓库未声明开源许可证 |

此外还有 BFR 的一个分叉 boxproxy/box（仓库描述为「安卓代理模块」），2025 年 7 月创建，2026 年 6 月发布了 1.2.8。它沿用了 BFR 的模块 ID `box_for_root` 和 `/data/adb/box` 目录，装上会直接替换 BFR，两者不能并存。

几点观察：

- **同一个家族**：BFR 和 Surfing 都源自 box4magisk，脚本结构相近（一个服务脚本管内核，一个脚本管 iptables），配置概念基本可以互通，差别主要在默认内核、默认配置和文档详略。
- **「开箱即用」的程度不同**：box4magisk 明确不附带任何内核二进制，要自己下载放进 bin 目录。BFR 安装时逐个询问是否下载 yq、curl、sing-box、v2fly、xray、hysteria 和 mihomo，每项等待 10 秒：前几项超时默认不下载，mihomo 一项超时默认下载（同时更新 Geo 数据、订阅和面板）。Surfing 和 akashaProxy 的发布包由 CI 打包了 mihomo 内核，但只有 arm64 版本：Surfing 还附带面板和配置模板，填入订阅即可使用；akashaProxy 要先把 `config.example.yaml` 改名为 `config.yaml` 再填订阅。
- **文档与发布节奏**：BFR 的中英文文档最完整，但主分支已近一年没有新提交；box4magisk 的 README 描述的是主分支布局，与 2024 年的 v5.1 正式版不一致，个别默认值也和配置文件对不上（见 IPv6 一节）；Surfing 更新最频繁，但文档偏简略，很多行为要看脚本。

### Magisk、KernelSU、APatch 与模块兼容性

三种 Root 方案都支持「模块」，透明代理模块也都按 Magisk 模块格式打包，但细节不同：

| 项目 | Magisk | KernelSU | APatch |
|---|---|---|---|
| 工作层面 | 用户态，修补启动镜像 | 内核层，手机上优先用 LKM 模式加载内核模块，也可用 GKI 模式替换内核 | 内核层，基于 KernelPatch 修补 boot 镜像，需要设置 SuperKey |
| 设备要求 | 适用面广 | 官方支持 GKI 设备，不支持的需自行编译内核 | 仅 ARM64，内核 3.18 至 6.12，且需 CONFIG_KALLSYMS=y |
| 模块格式 | 标准格式，模块装在 `/data/adb/modules` | 与 Magisk 基本一致，post-fs-data.sh、service.sh 行为相同 | APModule 与 Magisk 模块相似，另有内核级的 KPModule |
| 从 Recovery 刷模块 | 支持 | 不支持 | 不支持（模块开发指南明确写明） |
| 挂载 /system 文件 | 内置 | 交给「元模块」，未安装元模块时模块文件不会被挂载 | 新版同样交给元模块（apd 源码 2026 年 1 月引入，模块开发指南仍写着用 OverlayFS 叠加，以实际版本为准） |

对透明代理模块来说，要注意两件事：

1. **只能在管理器里安装**：BFR 和 Surfing 的安装脚本都会检查是否处于管理器环境，从 Recovery 刷入会直接中止；两者还要求 KernelSU 版本号不低于 10670。
2. **元模块**：KernelSU 文档写明，没有元模块时模块不会被挂载，新装的 KernelSU 需要先装一个元模块（如 meta-overlayfs）。好在 BFR 和 Surfing 的开机入口都是安装时放进 `/data/adb/service.d/` 的通用脚本（KernelSU 版本号低于 10683 时为 `/data/adb/ksu/service.d/`），核心脚本和配置都在 `/data/adb` 下，不依赖挂载。受影响的主要是 BFR 放进 `system/bin` 的 `sbfr` 快捷命令，没有元模块时改用完整路径 `/data/adb/modules/box_for_root/system/bin/sbfr` 即可。Surfing 的 hosts 由开机脚本直接 bind mount 到 `/system/etc/hosts`，同样不经过模块挂载。

---

## 风险与代价（务必先读）

> **警告**：本节每一条都可能让你丢失数据、账号或钱。如果读完觉得无法承受，就不要继续。

### Root 本身的代价

- **解锁 Bootloader 会清空数据**。AOSP 的规范是：用户确认警告后，设备应执行恢复出厂设置。有的厂商不提供解锁，或需要申请、等待；解锁和 Root 对保修的影响，以厂商政策为准。
- **Play Integrity 与应用检测**。在 Android 13 及以上设备上，Play Integrity 的「设备完整性」要求硬件级证明 Bootloader 已锁定、系统是经过认证的厂商镜像，解锁后通常拿不到；被判定为 Root 或受到篡改的设备，可能连最基本的一级都拿不到。依赖这些结果的银行、支付、部分游戏和流媒体应用，可能拒绝运行、限制功能，甚至风控账号。本文不讨论「隐藏 Root」，那可能违反应用的服务条款。
- **刷机风险**。刷错镜像、压缩格式不对、安全补丁级别回退触发防回滚，都可能导致无法开机，KernelSU 的安装文档对此有专门警告。
- **系统更新**。OTA 会替换启动镜像，非 A/B 设备更新后 Root 会丢失。A/B 设备按 Magisk 的 OTA 指南可以保留 Root：先在 Magisk 里「卸载 → 还原原厂镜像」（不要重启），再照常安装 OTA，装完先不重启，回到 Magisk 选择「安装到未使用的槽位」。前提是从没改动过 /system、/vendor 等只读分区。Root 丢失期间，代理模块不会运行。

### 模块以 root 身份运行意味着什么

- **内核进程就是 root**。BFR 和 Surfing 的默认设置都是 `root:net_admin`，也就是代理内核以 root 用户运行。内核的任何漏洞、任何被替换过的二进制，都等同于整台手机失守：它可以读取所有应用的数据，看到全部流量的去向。
- **开机即执行，没有沙箱**。模块脚本在开机阶段以 root 身份执行，不受应用沙箱约束。
- **脚本会改动系统状态**。以 Surfing 当前版本为例：开机脚本在 OPPO、一加、realme 设备上，会在开机约 120 秒后删除系统防火墙 fw_INPUT、fw_OUTPUT 链里的全部 REJECT 规则（函数名指向 ColorOS 16，README 和更新日志都没提）。这些链可能承载系统或厂商的应用联网限制，删掉后这类限制可能失效（此为推断）。内核启动前，服务脚本还会用 kill -9 结束占用 7890、7891、1536、1053 端口的其他进程。装之前最好把服务脚本读一遍。
- **下载链路要自己把关**。BFR v1.10.2 安装时先问是否启用第三方 GitHub 加速镜像 ghfast.top，**10 秒不按键就默认启用**，并写进 `box.tool`，以后的更新也走镜像；随后 mihomo 的下载询问超时同样默认「是」。下载函数还跳过 TLS 证书校验，也不核对哈希。也就是说，全程不按键时，以 root 运行的内核经第三方镜像、在不校验证书的情况下下载，镜像运营方和链路上的中间人都有机会替换它。更稳妥的做法：这两项询问都按音量下键，自己从 MetaCubeX/mihomo 的 Releases 下载 `mihomo-android-arm64-v8-版本号.gz`，与发布页显示的 sha256 核对，解压后放到 `/data/adb/box/bin/xclash/mihomo` 并赋予可执行权限（BFR 启动时会把 `bin/clash` 链接到它，直接放成 `bin/clash` 会启动失败）。akashaProxy 的 `clash.config` 也默认 `ghproxy="https://ghfast.top/"`，不需要时可以清空。
- **面板和代理端口暴露**。Surfing 默认配置里 `external-controller` 为 `0.0.0.0:9090`、secret 为空、`allow-lan` 为 true，README 的「局域网共享」一节也写明其他设备可以经网关的 9090 端口访问控制台。开热点或连公共 Wi-Fi 时，同一网络里的设备很可能访问到你的控制接口和代理端口，查看连接、切换节点、改动运行配置。Clash MIX 默认同样是 `0.0.0.0:9090`、没有 secret；akashaProxy 与 box4magisk 默认只监听 `127.0.0.1:9090`。建议给 secret 设强密码，或把控制器改为 `127.0.0.1:9090`，不需要局域网共享时关掉 `allow-lan`（改了端口要同步修改 SurfingTile 的 API 设置）。**注意**：Surfing 每次更新都会用新版默认 `config.yaml` 覆盖旧文件（旧文件存为 `config.yaml.bak`），只自动还原订阅块，这些改动会被重置，更新后要重新检查。字段含义见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。
- **配置放在哪里**。Clash MIX 把配置目录放在共享存储 `/sdcard/Android/Clash`，安装脚本再把其中的 `Clash配置.yaml` 和两份自定义规则文件软链接为内核实际加载的文件。拥有「所有文件访问权限」或旧版存储权限的应用，不仅能读到订阅链接，还能改写这份由 root 进程加载的配置，改动全部流量的去向。放在 `/data/adb` 下则只有 root 可读写。

### 来源可信度

- 只认原仓库的 Releases，不装二手打包的版本；更新时同样从原仓库获取。
- akashaProxy 的情况稍特殊：它的中文 README 把「本仓库 Releases」指向 fork 仓库 TG-Twilight/akashaProxy，并把 akashaProxy/akashaProxy 称为上游，两边都在发布。下载前先确认你信任的是哪一个。
- 看仓库是否声明许可证、源码是否完整可读。上表中 Clash MIX 的仓库没有 README，也没有声明许可证。
- 模块和内核分别核验：模块可信不代表它下载的内核可信，反之亦然。
- 一般性的检查方法见 [代理客户端安全自查](/posts/client-safety-check/)。

### 耗电与稳定性

- **常驻进程**：内核 24 小时运行，规则集和 Geo 数据定时更新、节点健康检查（Surfing 默认每 300 秒一次）都会唤醒网络。耗电取决于这些设置，而不是「Root 还是 VPN」，两种模式的耗电差异也没有可靠的公开测量。
- **资源限制**：BFR 提供 cgroup 内存限制选项（默认关闭，示例值 100M），担心内核占用过高时可以启用。
- **断网与回环**：内核崩溃而 iptables 规则还在时，被标记的流量无处可去，表现为全部断网；BFR 和 box4magisk 都警告过，配置不当造成流量回环可能导致设备无限重启。
- **系统更新后要复查**：大版本升级可能改变 netfilter 能力或网卡命名，升级后先看规则和日志。

### 救砖

- **Magisk**：在开机动画出现前几秒按下音量下键，动画一出现就松开，即进入 Magisk 安全模式，所有模块被禁用。Magisk 检测按键比系统早，按晚了只会进入系统安全模式，模块并未禁用。如果事先开启了 USB 调试并授权过电脑，也可以执行 `adb wait-for-device shell magisk --remove-modules`，移除全部模块并自动重启。
- **KernelSU**：看到第一屏开机画面后，连续短按音量下键三次以上（按下再松开，不是长按），进入 KernelSU 安全模式，再到管理器的模块页卸载问题模块；ROM 自带的安全模式也会触发它。能通过 adb 拿到 root shell 时，依次执行 `adb shell`、`su`，再用 `ksud module disable Surfing` 或 `ksud module uninstall Surfing` 处理（Box for Root 的模块 ID 是 `box_for_root`）。
- **APatch**：开机时按住电源键到屏幕亮起，随后连续短按音量下键，直到第一屏出现，即进入 APatch 内置安全模式，所有模块被禁用，再到管理器的模块页卸载问题模块；ROM 自带的安全模式（例如 MIUI、HyperOS 从 Recovery 进入）也会触发它。
- **清理残留**：禁用模块后重启，iptables 规则会随重启清空。需要彻底删除时，BFR 文档给出的清理命令是删除 `/data/adb/box`、`/data/adb/service.d/box_service.sh` 和 `/data/adb/modules/box_for_root`；Surfing 对应的是 `/data/adb/box_bll`、`/data/adb/service.d/Surfing_service.sh`（旧版 KernelSU 为 `/data/adb/ksu/service.d/Surfing_service.sh`）和 `/data/adb/modules/Surfing`，另外要卸载它自动装上的 SurfingTile（包名 `com.github.surfing`）。只删模块目录而留下 service.d 里的脚本，开机后代理内核仍会以 root 启动并写入规则。

---

## 典型安装与配置流程（以 Surfing 为例）

选 Surfing 做例子，是因为它在上表中维护最活跃（2026 年 9 月仍有正式版）。下面的路径和命令来自它的 README、`scripts/box.config` 与服务脚本，以 v7.8.4 正式版为准，主分支新增的内容会单独注明。其他模块的流程相同，路径和文件名不同，本节末尾附对照表。

### 第 0 步：动手之前

- **读完上一节「风险与代价」**，尤其是救砖方法。同时提前打开 USB 调试、在电脑上授权一次，卡开机时才用得上 adb。
- **备份数据**。Root 和刷模块都可能导致数据丢失，这一步不能省。
- **停掉其他代理**。关闭 VPN 模式的客户端，避免两套方案同时接管流量。
- **关闭私人 DNS**。可以在设置里改，也可以用命令查看当前状态（或在电脑上执行 `adb shell settings get global private_dns_mode`）：

```bash
su -c 'settings get global private_dns_mode'
```

返回 off 表示已关闭；opportunistic 对应「自动」；hostname 表示指定了服务器；返回 null 表示从未改过，系统按默认的「自动」处理，同样要到设置里手动关掉。

- **（可选）检查内核能力**：

```bash
su -c 'cat /proc/net/ip_tables_targets'
su -c 'zcat /proc/config.gz | grep -E "XT_TARGET_TPROXY|XT_MATCH_OWNER"'
```

第一条列出系统已注册的 iptables 目标，出现 TPROXY 说明可用；第二条依赖内核提供 `/proc/config.gz`，不少设备没有。检查不了也没关系，Surfing 启用时会自己探测，不支持就降级为 REDIRECT（此时 UDP 不经过代理）。

### 第 1 步：获取模块

只从项目仓库的 Releases 页面下载 zip，确认发布者就是仓库本身。不要安装聊天群、网盘或论坛流传的「整合包」「优化版」，理由见 [代理客户端安全自查](/posts/client-safety-check/)。Surfing 的发布包自带 arm64 版 mihomo 内核，32 位设备不适用。

### 第 2 步：在管理器中安装

打开 Magisk、KernelSU 或 APatch 管理器，进入模块页，从本地选择 zip 安装。脚本会用音量键询问：安装日志的语言（10 秒不按默认英文）；是否把模块的 hosts 挂载到系统（10 秒不按默认不挂载）；系统里已有 SurfingTile 时（全新安装会先自动装上它），还会问是否通过它恢复配置。留意屏幕提示，不要随手按。

### 第 3 步：填写订阅

README 给了两种方式：

- 编辑 `/data/adb/box_bll/clash/config.yaml`，在 `proxy-providers` 下的订阅项里把 url 换成你的订阅地址；
- 或者用配套的 SurfingTile 应用（包名 `com.github.surfing`），在「配置覆写」里填写订阅。安装模块时脚本会用 `pm install` 自动装上 zip 里附带的 APK，相当于替你侧载了一个应用，不要另从其他渠道获取。它要求 Android 10 以上，授予 Root 后同样拥有最高权限。

```yaml
proxy-providers:
  "1.主要地址":
    url: "替换为你的订阅地址"
```

上面只是示意。实际编辑时只把 `url` 引号里的内容换成订阅地址，其他字段不要动；`# 订阅地址相关` 这一行注释和下方的 `profile:` 行是模块更新时备份、还原订阅的起止标记，不能删。

订阅链接等同于账号凭据。它放在 `/data/adb` 下时只有 root 可读，这一点比放在共享存储里稳妥。

### 第 4 步：按需调整模块参数

模块自身的参数在 `/data/adb/box_bll/scripts/box.config`，常用项如下（v7.8.4 的默认值；标注「仅主分支」的项正式版尚未包含）：

| 变量 | 默认值 | 含义 |
|---|---|---|
| `bin_name` | clash | 使用的内核，默认按 mihomo 的 Clash 配置运行 |
| `proxy_method` | TPROXY | 可选 REDIRECT、TPROXY、MIXED |
| `proxy_mode` | blacklist | blacklist 为代理除名单外的应用，whitelist 为只代理名单内应用，core 为只启动内核 |
| `user_packages_list` | 空 | shell 数组写法，每项为「用户 ID:包名」，例如 `user_packages_list=("0:com.android.captiveportallogin" "10:com.tencent.mm")`；与 fake-ip 的冲突见表下提示 |
| `ipv6` | enable | enable 时 IPv6 也纳入透明代理，改成其他值会禁用系统 IPv6 |
| `ap_list` | wlan+、ap+、rndis+、ncm+、eth+、p2p+ | 会被透明代理的热点、共享类网卡前缀 |
| `tproxy_port`、`redir_port`、`clash_dns_port` | 1536、7891、1053 | 必须与 `config.yaml` 中的对应端口一致 |
| `bypass_ike_natt`（仅主分支） | false | 2026 年 9 月 8 日加入，只在主分支和 Prerelease-Alpha 预发布里；仅 TPROXY 模式有效，为 true 时放行 `bypass_ike_natt_ports`（默认 500、4500）的本机 UDP 流量，与 Wi-Fi 通话有关 |

**名单与 Fake-IP 的冲突**：Surfing 默认 DNS 为 fake-ip，而 nat 表里的 53 端口劫持对除内核以外的所有应用生效，名单只影响 mangle 表的打标记。被黑名单绕过的应用，查询不在 `fake-ip-filter` 里的域名时拿到的是 198.18 开头的假地址，直连必然失败。默认模板的 `fake-ip-filter` 引用了国内域名、私有域名、Google FCM 和自定义规则几个规则集，所以绕过国内应用一般没问题；要让访问境外域名的应用绕过代理，需要把这些域名加入 `fake-ip-filter`，或把 `enhanced-mode` 改为 redir-host，原理见前文「DNS 怎么被接管」。

改完参数后，最简单的做法是在管理器里把模块关掉再打开；手动操作时依次执行 `box.iptables disable`、`box.service restart`、`box.iptables enable`。只执行 `box.service restart` 只会重启内核，不会重新写入规则。

### 第 5 步：重启与启停

按 README，首次填好订阅后需要**手动重启设备一次**。之后在管理器里打开或关闭模块开关，就能实时启停服务，无需再重启——Surfing 通过监听模块目录下的 disable 文件实现这一点。

需要手动控制时，服务脚本和规则脚本分别是：

```bash
# 查看状态（会输出内核的内存与 CPU 占用）
su -c /data/adb/box_bll/scripts/box.service status

# 手动启动：先启动内核，再加载透明代理规则
su -c /data/adb/box_bll/scripts/box.service start
su -c /data/adb/box_bll/scripts/box.iptables enable

# 手动停止：先撤规则，再停内核，避免出现规则还在、内核已停的断网窗口
su -c /data/adb/box_bll/scripts/box.iptables disable
su -c /data/adb/box_bll/scripts/box.service stop
```

如果创建了 `/data/adb/box_bll/manual` 文件，管理器里的模块开关将不再控制服务。日志分几处：`/data/adb/box_bll/run/` 下的 `run.log`、`run_error.log` 记录开机和开关模块时的过程，配置校验失败看同目录的 `check.log`，内核的报错输出在 `error_clash.log`；mihomo 自身的日志在 `/data/adb/box_bll/clash/log/`，默认配置把日志级别设为 silent，排障时需要临时调高。手动执行上面的命令时，输出直接显示在终端里，不会写进 run.log。

### 第 6 步：面板

Surfing 的默认配置启用了 mihomo 的外部控制器（9090 端口）和 zashboard 面板。在手机浏览器打开 `http://127.0.0.1:9090/ui`，可以查看连接列表、规则命中情况和切换节点；SurfingTile 也是通过同一个接口工作的。

**注意**：这份默认配置里控制器监听 0.0.0.0、访问密钥为空，同时开启了 `allow-lan`。这对局域网意味着什么、以及为什么改完后每次更新都要复查，见上一节「面板和代理端口暴露」。

### 换成其他模块时去哪里找

| 项目 | Surfing | Box for Root | box4magisk（主分支） | akashaProxy |
|---|---|---|---|---|
| 工作目录 | `/data/adb/box_bll` | `/data/adb/box` | `/data/adb/box` | `/data/adb/akashaProxy` |
| 模块参数 | `scripts/box.config` | `settings.ini` | `scripts/box.config` 与 `scripts/tproxy.conf` | `clash.config` |
| 分应用名单 | `box.config` 的 `user_packages_list` | `package.list.cfg` | `tproxy.conf` 的 `BYPASS_APPS_LIST` 或 `PROXY_APPS_LIST` | `packages.list` |
| 热点 | `ap_list`，默认包含 wlan+、ap+ 等 | `ap.list.cfg`，默认 allow wlan+、ap+ 等 | `PROXY_HOTSPOT`，默认 0（不代理） | 见其模块文档 |
| IPv6 默认 | 纳入代理 | ipv6 为 false 时直接禁用系统 IPv6 | `tproxy.conf` 中 `PROXY_IPV6=-1`，直接禁用系统 IPv6（README 表格仍写 0，以配置文件为准） | 见其模块文档 |
| 启停命令 | `box.service` 与 `box.iptables` | `box.service` 与 `box.iptables` | `box.service` 与 `box.tproxy` | `clash.service` 与 `clash.iptables` |
| 日志 | run 目录 | run 目录 | run 目录 | run 目录下的 `run.logs` 与 `kernel.log` |

---

## 什么时候没必要用 Root 方案

对大多数人来说，Root 方案属于「为一个小问题引入一个大系统」。下面这些情况，更轻的做法就够了：

| 需求 | 更轻的做法 |
|---|---|
| 日常翻墙，只有浏览器和少数应用需要代理 | VPN 模式客户端加分应用名单，见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/) 与 [v2rayN / v2rayNG 使用指南](/posts/v2ray-clients-guide/) |
| 只是想让某些应用不走代理 | 客户端的排除名单或分流规则，见 [如何自定义规则](/posts/custom-rules/) |
| 只想把代理给热点下的电脑用 | 在电脑上装客户端；已 Root 的话，VPNHotspot 可以把现有 VPN 分享给热点；sing-box 文档也说明其 `auto_redirect` 能通过图形客户端的 root 服务或 root shell 覆盖热点等转发流量 |
| 全家设备都要走代理 | 放到路由层做，见 [软路由与旁路由](/posts/soft-router-guide/) |
| 打游戏想降延迟 | 模式不是瓶颈，见 [代理能打游戏吗](/posts/gaming-and-proxy/) |

反过来，设备本来就已 Root、确实有多用户覆盖或热点代理等需求，并且愿意自己看日志、维护配置，Root 模块才值得一试。

---

## 排障

### 开了模块但不走代理

按顺序检查：

1. **内核在不在运行**：执行模块的 status 命令，或查看 run 目录下的日志。内核启动失败最常见的原因是配置文件语法错误（Surfing 看 `check.log`）或订阅没下载下来。
2. **规则有没有加载**：

   ```bash
   su -c 'ip rule'
   su -c 'iptables -t mangle -S OUTPUT'
   su -c 'iptables -t mangle -S PREROUTING'
   su -c 'iptables -t nat -S OUTPUT'
   ```

   TPROXY 模式下能看到一条按 fwmark 查表的 ip rule，以及 mangle 表 OUTPUT、PREROUTING 跳转到模块自定义链的规则。如果模块降级成了 REDIRECT，mangle 表和 ip rule 里都不会有模块的规则，要看 nat 表 OUTPUT 是否跳转到模块自定义链。两处都没有，才说明规则脚本没执行成功，去看日志。

3. **端口是否一致**：模块参数里的透明代理端口、DNS 端口必须和内核配置一致，BFR 与 akashaProxy 的文档都专门强调过。
4. **内核是否支持 TPROXY**：不支持时改用 REDIRECT，或让模块自动降级。
5. **名单写错**：用户 ID 和包名对不上、白名单模式忘了加应用、分身里的应用用了主用户的 ID。
6. **有 VPN 应用在运行**：sing-box 文档指出，在 Android 上 VPN 默认优先于 tun。两套方案同时开，结果往往难以预料。
7. **私人 DNS 开着**：DNS 不经过内核，Fake-IP 失效，DNS 层面的分流也不再生效；域名规则只能靠内核的流量嗅探（Surfing 默认开启）从 TLS SNI 或 HTTP Host 还原域名，嗅探不到的连接只能按 IP 规则处理。

### DNS 泄漏

- **私人 DNS 与浏览器的安全 DNS**：前者走 853 端口的 DoT，后者是浏览器内置的 DoH，都会绕开 53 端口劫持。前者在系统设置里关闭，后者在浏览器设置里关闭或指定与内核一致的上游。
- **IPv6 DNS**：模块只处理了 IPv4 时，IPv6 的 DNS 请求可能直接发给运营商。
- **检测与原理**：见 [DNS 泄漏是什么、怎么检测、怎么防](/posts/dns-leak/)。

### 国内应用变慢

- **先看面板**：在连接列表里确认国内域名命中的是直连还是代理。命中代理多半是规则顺序或 GeoIP、GeoSite 数据的问题，见 [GeoIP / GeoSite 数据库](/posts/geoip-geosite/)。
- **DNS 调度**：国内域名被境外 DNS 解析，CDN 可能把你调度到境外节点，见 [各客户端 DNS 配置最佳实践](/posts/dns-best-practices/)。
- **想让重流量的国内应用绕过**：先想清楚 Fake-IP 的冲突（前文 DNS 一节）；用分流规则放直连，通常比按应用绕过更省心。

### 热点共享

- **VPN 模式客户端**：热点下的设备默认不走手机上的代理，这是 Android 的设计。
- **Root 模块**：BFR 和 Surfing 默认对 wlan+、ap+、rndis+ 等共享网卡生效；box4magisk 默认不代理热点（`PROXY_HOTSPOT` 为 0），而且热点网卡名默认写的是 wlan2，要用 ip link 或 ifconfig 查到实际名称后修改。BFR 文档提到联发科设备的热点网卡可能是 ap+。
- **服务条款**：把订阅通过热点给别人用，是否违反服务商的设备数限制，以服务条款为准。

### IPv6

三个模块的默认行为并不一致：BFR 和 box4magisk 默认直接关掉系统 IPv6，Surfing 则把 IPv6 纳入透明代理。这也是最容易「莫名其妙」的地方：

| 模块 | 默认设置 | 实际效果 | 可能的问题 |
|---|---|---|---|
| Box for Root | ipv6 为 false | 直接禁用系统 IPv6，并加一条拒绝 IPv6 的路由规则 | 在只有 IPv6 或 IPv6 优先的网络里，部分服务可能不可用 |
| box4magisk（主分支、预发布） | `PROXY_IPV6` 为 -1 | 所有网卡写入 disable_ipv6=1，IPv6 整体关闭 | 与 BFR 类似；改成 0 是「保留 IPv6 但不代理」，这时 AAAA 记录会让部分连接绕开代理，改成 1 才代理 IPv6 |
| Surfing | ipv6 为 enable | IPv6 同样写入透明代理规则 | 依赖设备的 ip6tables 与内核能力 |

此外，REDIRECT 模式代理 IPv6 需要内核支持 IPv6 的 NAT 与 REDIRECT 目标，box4magisk 会自动检测，不支持就关闭 IPv6 代理。原则很简单：要么完整接管 IPv6，要么彻底关掉，不要让它处于「开着但不走代理」的状态。IPv6 基础见 [IPv4 与 IPv6 基础](/posts/ipv4-vs-ipv6-basics/)。

---

## 常见问题（FAQ）

### 用了 Root 模块，银行 App 就检测不到代理了吗？

不一定，而且方向可能相反。TPROXY 模式下系统里确实没有 VPN 网络，但 Root 本身更容易被检测，Bootloader 解锁还会影响 Play Integrity 的结果。更稳妥的做法是在名单里让银行、支付、政务类应用绕过代理，同时接受「这台手机已 Root」可能带来的限制。注意 Fake-IP 下被绕过的应用仍由内核回答 DNS：Surfing 默认的 `fake-ip-filter` 已含国内域名规则集，国内银行类应用绕过后一般能拿到真实 IP；访问境外域名的则要把域名加入 `fake-ip-filter` 或改用 redir-host。

### 能和 VPN 模式的客户端同时开吗？

技术上可以同时运行，但两者会争抢流量。模块的策略路由规则优先级数值很小（BFR 为 100，Surfing 为 2024），排在 Android 为 VPN 和各网络设置的规则（数值大多在 10000 以上，可用 `su -c 'ip rule'` 查看）之前，被模块打上标记的包会先被截走，哪怕它本该进公司 VPN。只把 VPN 应用本身加入绕过名单，只能让它的隧道连接直连；需要走公司 VPN 的应用和内网网段也要一并绕过。基于本地 VPN 的防火墙或广告拦截通常用自己的套接字转发其他应用的流量，这些流量在 iptables 看来属于防火墙应用的 UID，模块的分应用名单可能随之失效。本文没有实测这类组合，请当作需要自行验证的方案。

### Root 模块比 VPN 模式更快、更省电吗？

原理上，TPROXY 与 REDIRECT 模式下 TCP 连接由 Linux 内核协议栈终结，代理进程直接拿到套接字，少了从 IP 包还原连接的一步。但日常体验的瓶颈几乎总在节点和线路上，两者的速度与耗电差异没有可靠的公开测量，不要为了「更快」去 Root。

### 模块能直接用机场给的 Clash 订阅吗？

多数可以。Surfing 的默认模板只要求在 `proxy-providers` 里填订阅；akashaProxy 要先把 `config.example.yaml` 改名为 `config.yaml`，再在 `proxy-providers` 里填；BFR 支持在 `settings.ini` 里配置 Clash 订阅地址，并提供更新订阅的命令。若要换成自己的完整配置，务必保留模块会读取的字段：透明代理端口、DNS 监听地址、外部控制器地址，以及 tun 相关设置，akashaProxy 的 README 列出过这些字段。

### 卸载模块后网络还是不对怎么办？

先重启一次：iptables 规则和 sysctl 设置都不会持久保存，重启后即恢复系统默认。如果模块卸载时没有清理干净、开机后仍有异常，按模块文档删除残留目录和开机脚本（BFR 与 Surfing 的清理路径见前文「救砖」）。box4magisk 卸载时会保留 `/data/adb/box` 数据目录，需要的话手动删除。

### 开着模块，Wi-Fi 通话或某些应用的 UDP 连接异常？

Wi-Fi 通话等功能依赖 IPsec，常用 UDP 500 与 4500 端口，这类流量被透明代理接管后可能建立不起来。Surfing 在 v7.8.4 之后的主分支加入了 `bypass_ike_natt` 选项（默认关闭，仅 TPROXY 模式有效），正式版用户要等下一个版本。其他情况下，需要在 iptables 层面放行这两个端口（在打标记之前直接 RETURN），或把承载 Wi-Fi 通话的系统组件加入绕过名单；只在内核分流规则里设为直连通常不够，因为流量已先交给代理进程，由它重新发起的连接源端口已经变了。

---

## 外部参考

- [Android 开发者文档：VPN](https://developer.android.com/develop/connectivity/vpn) — 单一活动 VPN、钥匙图标、分应用名单、始终开启的 VPN
- [Android API 参考：NetworkCapabilities](https://developer.android.com/reference/android/net/NetworkCapabilities) — TRANSPORT_VPN 传输类型
- [VPNHotspot](https://github.com/Mygod/VPNHotspot) — 需要 Root 的热点分享 VPN 工具，说明了共享流量默认不走 VPN
- [Linux 内核文档：Transparent proxy support](https://docs.kernel.org/networking/tproxy.html) — TPROXY 的套接字、策略路由、socket 匹配与 iptables 目标
- [Box for Root 仓库](https://github.com/taamarin/box_for_magisk) 与 [中文文档](https://github.com/taamarin/box_for_magisk/blob/master/docs/index_zh.md) — 目录结构、network_mode、名单与热点配置、启停与清理命令；v1.10.2 的 customize.sh 与 box.tool
- [Surfing 仓库](https://github.com/GitMetaio/Surfing) 与 [v7.8.4 发布](https://github.com/GitMetaio/Surfing/releases/tag/v7.8.4) — README、box.config、默认 mihomo 配置、customize.sh、Surfing_service.sh、uninstall.sh
- [Surfing 提交 c1a01b9](https://github.com/GitMetaio/Surfing/commit/c1a01b9d4b5800d1d73aed927fc2c07e673f69d9) — v7.8.4 之后加入的 IKE/NAT-T 放行选项
- [box4magisk 仓库](https://github.com/CHIZI-0618/box4magisk)、[tproxy.conf](https://github.com/CHIZI-0618/box4magisk/blob/main/box/scripts/tproxy.conf) 与 [AndroidTProxyShell](https://github.com/CHIZI-0618/AndroidTProxyShell) — 各项默认值、IPv6 与 DNS 劫持说明
- [akashaProxy 仓库](https://github.com/akashaProxy/akashaProxy) 与 [TG-Twilight/akashaProxy](https://github.com/TG-Twilight/akashaProxy) — mihomo 模块的目录、启停命令、配置字段要求与发布渠道
- [Clash MIX 仓库](https://github.com/AXEVO/Clash-MIX) — module.prop、安装脚本与内置二进制
- [boxproxy/box](https://github.com/boxproxy/box) — BFR 的分叉
- [Magisk 开发者指南](https://topjohnwu.github.io/Magisk/guides.html)、[Magisk FAQ](https://topjohnwu.github.io/Magisk/faq.html)、[Magisk OTA 指南](https://topjohnwu.github.io/Magisk/ota.html)
- [KernelSU：与 Magisk 的差异](https://kernelsu.org/guide/difference-with-magisk.html)、[元模块](https://kernelsu.org/guide/metamodule.html)、[安装](https://kernelsu.org/guide/installation.html)、[救砖](https://kernelsu.org/guide/rescue-from-bootloop.html)
- [APatch 官网](https://apatch.dev/)、[安装说明](https://apatch.dev/install.html)、[模块开发指南](https://apatch.dev/apm-guide.html)、[元模块](https://apatch.dev/meta-module.html)、[救砖](https://apatch.dev/rescue-bootloop.html) 与 [APatch 源码](https://github.com/bmax121/APatch) — 安全模式与模块挂载方式
- [AOSP：Bootloader 锁定与解锁](https://source.android.com/docs/core/architecture/bootloader/locking_unlocking) — 解锁时执行恢复出厂设置
- [Play Integrity 完整性判定](https://developer.android.com/google/play/integrity/verdicts) — 各级设备完整性标签的含义
- [Android 开发者博客：Android P 的 DNS over TLS](https://android-developers.googleblog.com/2018/04/dns-over-tls-support-in-android-p.html) — 私人 DNS 的来历
- [mihomo 文档：TUN](https://wiki.metacubex.one/config/inbound/tun/) 与 [通用配置](https://wiki.metacubex.one/config/general/) — Android 分应用选项、私人 DNS 与 DNS 劫持、allow-lan 与外部控制器
- [sing-box 文档：TUN 入站](https://sing-box.sagernet.org/configuration/inbound/tun/) — VPN 优先于 tun、auto_redirect 在 Android 上的支持
- 客户端目录与时间线线索参考：[华润赢](https://huarun.win/)，参考页面：[Android 平台目录](https://huarun.win/platform/android)、[Box for Root 条目](https://huarun.win/apps/box-for-root)
