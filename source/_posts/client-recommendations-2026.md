---
title: "2026 各平台代理客户端推荐清单：Windows、macOS、Linux、Android、iOS"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 代理软件
tags:
  - 客户端
  - 软件推荐
  - Clash
  - Sing-box
  - Windows
  - Android
excerpt: "刚拿到订阅不知道装哪个客户端？本文逐一核实 Windows、macOS、Linux、Android、iOS 上仍在维护的主流客户端，对比内核、协议、订阅格式、开源与收费情况，并给出按需求选择的决策表和下载安全提示。"
index_img: /images/posts/client-recommendations-2026.svg
---

> **摘要**：客户端是你每天真正打交道的那个 App，它决定了能导入什么格式的订阅、能连哪些协议的节点、出了问题好不好排查。本文面向刚拿到订阅、不知道该下载哪个软件的读者，按 Windows、macOS、Linux、Android、iOS 五个平台，把仍在维护的主流客户端逐一核实了一遍：用什么内核、是否开源、是否收费、最近一次发布在什么时候、适合什么样的人。文末给出一张「按需求选客户端」的决策表，以及比「选哪个」更重要的下载安全要点。

---

## 先给结论：各平台起步清单

> **时效声明**：本文中「是否仍在维护、最近发布时间、版本号、价格、支持的系统」等信息，均于 2026-09-24 前后从各项目的 GitHub 仓库与 Releases 页、官方文档、App Store 页面核实。代理客户端迭代极快，版本号和价格随时会变，**一切以官方仓库和商店页面为准**。本文不推荐任何机场或服务商。

如果你只想要一个能马上动手的答案，下面这张表针对的是最常见的情况：**机场给了 Clash 格式的订阅，你想少折腾、先用起来**。

| 平台 | 起步可以先装 | 同类备选 | 一句话说明 |
|------|------------|---------|-----------|
| Windows | Clash Verge Rev | Clash Party、FlClash、v2rayN | 前三个都是 mihomo 内核，能直接导入 Clash 订阅 |
| macOS | Clash Verge Rev | Clash Party、FlClash、v2rayN；付费的 Surge、Stash | 免费开源方案已能满足日常分流 |
| Linux | Clash Verge Rev | FlClash、Clash Party、v2rayN、sing-box 官方桌面版 | 无图形界面的服务器直接跑内核即可 |
| Android | Clash Meta for Android | FlClash、v2rayNG、sing-box 官方客户端（SFA） | 看订阅格式选，Clash 订阅配 Clash 系 |
| iOS / iPadOS | Shadowrocket 或 Stash | Loon、Quantumult X、Surge；免费的 Karing、Hiddify | 需要非中国大陆区 App Store，多数为付费应用 |
| 路由器 | 见 [软路由与旁路由](/posts/soft-router-guide/) | — | 一台设备服务全家，适合设备多的家庭 |

「起步可以先装」只是针对上面那种最常见情况给出的起点，不代表其他客户端不好。如果你的订阅不是 Clash 格式、节点用的是比较新的协议，或者你想在手机和电脑上用同一个 App，请继续往下看。

装好之后，导入订阅、选节点、开系统代理的完整步骤见 [第一次使用代理](/posts/first-time-setup/)；选了 Clash Verge Rev 的可以直接看 [Clash Verge Rev 使用指南](/posts/clash-verge-guide/)。

---

## 选客户端要看的 7 个维度

先复习一个概念：你下载的是「客户端」（界面和配置管理），真正处理流量的是它内置的「内核」（mihomo、sing-box、Xray 等）。两者的关系、各内核的来龙去脉，本站在 [V2Ray、Xray、Clash、Sing-box……我该用哪个？](/posts/software-overview/) 和 [V2Ray vs Xray vs Sing-box](/posts/core-comparison/) 中已经讲过，Clash 家族的恩怨见 [Clash 系列全解](/posts/clash-family/)，客户端为什么一再停更、删库、改名，见 [代理客户端演进史](/posts/proxy-client-history/)，这里只讲怎么用这些知识来挑客户端。

| 维度 | 为什么重要 | 怎么判断 |
|------|-----------|---------|
| 内核 | 决定协议支持和分流规则能力的上限 | 看 README 写的是 mihomo（Clash Meta）、sing-box 还是 Xray |
| 协议支持 | 节点的协议客户端不认识，就一定连不上 | 先对照下面的「内核协议表」，再确认客户端界面和订阅解析是否跟进 |
| 订阅格式兼容 | 格式不匹配时，导入后要么是空的，要么只有节点没有规则 | 用下文的方法看一眼订阅内容的开头 |
| TUN 支持 | 不读取系统代理的程序（多数游戏、部分命令行工具）和大部分 UDP 流量，通常要靠 TUN 才能被接管；命令行工具也可以用环境变量单独指定代理，见 [命令行与开发工具走代理](/posts/terminal-proxy/) | 桌面端找「TUN / 虚拟网卡」开关；手机端基于系统 VPN 接口，默认就是全局接管，详见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/) |
| 是否开源 | 开源项目可被审计、可对照 Releases 校验；闭源只能信任开发者 | 看仓库的 LICENSE 文件；注意有些项目在 GPL-3.0 之上附加了命名、商用等条款 |
| 更新频率 | 协议、系统、规则都在变，停更的客户端会慢慢连不上、出兼容问题 | 看 Releases 页最近一次正式版的日期，仓库是否被标记为 Archived |
| 上手难度 | 新手期最大的成本是时间 | 能否一键导入订阅、有无中文界面、默认规则是否可用 |

### 三大内核对新协议的支持

最近两三年出现的协议和传输方式，各内核的跟进程度并不一致。下表按各内核**官方文档**中的出站 / 传输列表核对：

| 协议 / 传输 | mihomo | sing-box | Xray-core |
|------------|--------|----------|-----------|
| VLESS + Reality | 支持 | 支持 | 支持（Reality 的发源地） |
| XHTTP 传输 | 支持（`xhttp-opts`） | 官方传输列表中没有 | 支持 |
| Hysteria2 | 支持 | 支持 | 支持（`hysteria` 出站，`version` 须为 2） |
| TUIC | 支持 | 支持 | 出站列表中没有 |
| AnyTLS | 支持 | 支持 | 出站列表中没有 |

这张表只说明**内核层面**的能力。客户端能不能用，还取决于它内置的内核版本、订阅解析器和设置界面有没有跟上。举两个核实过的例子：

- **v2rayNG**（Android）的源码里，节点类型枚举中 TUIC 一项是被注释掉的，也没有 AnyTLS；它支持 VLESS、VMess、Trojan、Shadowsocks、Hysteria2、WireGuard 等。
- **v2rayN**（桌面）的节点类型里则同时有 Hysteria2、TUIC、AnyTLS、Naive 等，并且可以在 Xray、sing-box、mihomo 等多个内核之间切换。

各协议本身的原理可以看 [AnyTLS 技术原理](/posts/anytls-explained/)、[Hysteria 2 协议详解](/posts/hysteria2-explained/)、[Hysteria2 与 TUIC](/posts/quic-protocols/) 和 [VLESS + XHTTP + Reality](/posts/xhttp-reality/)。

### 先弄清楚你手里的订阅是什么格式

很多「导入后什么都没有」的问题，根源是订阅格式和客户端不匹配。机场后台通常会给出多个链接（「Clash 订阅」「通用订阅」「Shadowrocket 订阅」等），而且部分机场面板会根据请求的 User-Agent 返回不同格式，同一个链接在不同客户端里拿到的内容可能不一样。

用命令行查看时要注意这一点：curl 默认的 User-Agent 是 `curl/版本号`，面板认不出它是哪个客户端。以常见的 V2Board / Xboard 面板为例，它先读链接里的 `flag` 参数，没有就读 User-Agent，两者都匹配不上时返回默认的通用（Base64）格式。所以同一个链接，放进 Clash 系客户端能拿到 YAML，用 curl 直接看却可能是 Base64。要看某个客户端实际会拿到什么，需要用 `-A` 模拟它的 User-Agent。

在 macOS、Linux 或 Windows 的 Git Bash / WSL 里，可以这样看一眼订阅内容的开头（把链接换成你自己的，**订阅链接等同于账号凭证，不要发给别人**）：

```bash
# 1) 以「未知客户端」身份请求：不少面板此时返回默认的通用（Base64）格式
curl -sSL "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN" | head -c 300; echo

# 2) 模拟 Clash 系客户端请求（这里以 CMFA 的 UA 为例，可换成你打算用的客户端）
#    如果这次返回 proxies: 等 YAML 键，说明面板按 User-Agent 区分格式
curl -sSL -A "ClashMetaForAndroid/2.11.34" "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN" | head -c 300; echo

# 3) 如果看到的是一长串字母数字，尝试按 Base64 解码后再看前 3 行
curl -sSL "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN" | base64 --decode 2>/dev/null | head -n 3
```

Windows 用户如果没有装 Git Bash 或 WSL，可以在 PowerShell 里用系统自带的 `curl.exe`（Windows 10 1803 起自带）。注意必须写 `curl.exe`，因为 Windows PowerShell 5.1 里的 `curl` 是 `Invoke-WebRequest` 的别名，不认 `-sSL` 这类参数：

```powershell
# 模拟 Clash 系客户端下载订阅内容到临时文件，查看前 5 行
curl.exe -sSL -A "ClashMetaForAndroid/2.11.34" "https://example.com/api/v1/client/subscribe?token=YOUR_TOKEN" -o sub.txt
Get-Content .\sub.txt -TotalCount 5

# 如果是一长串 Base64，解码后看前 3 行（报错说明不是标准 Base64，直接看上面的开头判断即可）
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String((Get-Content .\sub.txt -Raw).Trim())) -split "`n" | Select-Object -First 3

# 看完删除，避免订阅内容留在磁盘上
Remove-Item .\sub.txt
```

带与不带 User-Agent 得到的格式不同是正常的，判断某个客户端能不能导入，以模拟该客户端时拿到的内容为准，也可以直接在客户端里打开导入后的配置文件查看。命令没有任何输出时，先确认当前网络能否访问订阅域名。

对照下表判断：

| 内容开头的样子 | 大概率是 | 适合的客户端 |
|--------------|---------|------------|
| `proxies:`、`mixed-port:`、`proxy-groups:` 等 YAML 键 | Clash / mihomo 配置 | Clash 系（Verge Rev、Party、FlClash、CMFA）、Stash、Karing、Hiddify |
| 一长串字母数字，末尾可能带 `=` | Base64 编码的分享链接列表（俗称通用订阅） | v2rayN / v2rayNG、Shadowrocket、NekoBox、Karing、Hiddify |
| 解码后是多行 `vless://`、`trojan://`、`hysteria2://` | 分享链接列表 | 同上 |
| 以左花括号开头，含 `"outbounds"` | sing-box JSON 配置 | sing-box 官方客户端、Hiddify、Karing |

格式对不上时，可以换一个对应格式的链接，或者用订阅转换工具处理。转换工具的原理、自建方法和隐私风险见 [订阅转换与管理](/posts/subscription-management/)——不要把订阅链接随手贴进来路不明的在线转换网站。

---

## Windows

Windows 是可选客户端最多的平台。下表中的「最近正式版」取自各项目 Releases 页，仅代表核实时的状态。

| 客户端 | 内核 | 许可 / 收费 | 订阅格式 | TUN | 最近正式版（核实时） |
|--------|------|------------|---------|-----|-------------------|
| [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) | mihomo | GPL-3.0 / 免费 | Clash（mihomo）YAML | 支持 | v2.5.5，2026-09-22 |
| [FlClash](https://github.com/chen08209/FlClash) | mihomo | GPL-3.0 / 免费 | Clash（mihomo）YAML | 支持（「虚拟网卡」选项，需管理员模式） | v0.8.98，2026-09-14 |
| [Clash Party](https://github.com/mihomo-party-org/clash-party)（原 Mihomo Party） | mihomo，另带 Smart 衍生内核 | GPL-3.0 / 免费 | Clash YAML；内置 Sub-Store 可做订阅管理 | 支持 | v2.0.3，2026-09-20 |
| [v2rayN](https://github.com/2dust/v2rayN) | Xray、sing-box、mihomo 等，可切换 | GPL-3.0 / 免费 | 分享链接、Base64 订阅为主 | 支持 | 7.24.9，2026-08-29（9 月另有 7.25.x 预发布） |
| [Hiddify](https://github.com/hiddify/hiddify-app) | sing-box 系，另内置 Xray 内核 | GPL-3.0 + 附加条款 / 免费 | sing-box、V2Ray、Clash、Clash Meta | 支持 | v4.1.1，2026-03-05 |
| [Karing](https://github.com/KaringX/karing) | 修改版 sing-box | GPL-3.0 + 附加条款 / 免费 | Clash（Clash.Meta 部分支持）、V2Ray、sing-box 等 | 支持（需以管理员身份运行） | v1.2.25.2802，2026-09-10 |
| [sing-box for Desktop](https://sing-box.sagernet.org/clients/desktop/)（SFW） | sing-box（官方） | GPL-3.0 + 附加条款 / 免费 | 仅 sing-box JSON 配置 | 支持 | 随 sing-box v1.14.2 发布，2026-09-24 |

### 适合谁

- **Clash Verge Rev**：机场给 Clash 订阅、希望中文资料多一些的用户。基于 Tauri 2，支持 Merge / Script 覆写，订阅更新不会冲掉自定义规则。完整用法见 [Clash Verge Rev 使用指南](/posts/clash-verge-guide/)。
- **FlClash**：希望 Windows 和 Android 用同一套界面的用户。项目自述定位是「简单易用、开源无广告」，支持 WebDAV 同步。
- **Clash Party**：想在客户端里直接管理多个订阅（内置 Sub-Store）、或需要旧系统安装包的用户。它自 v1.8.6（2025-08-31）起由 Mihomo Party 更名而来，旧仓库地址会自动跳转。基于 Electron，安装包通常比 Tauri 类应用大。
- **v2rayN**：自建节点、要用 XHTTP 等 Xray 特性，或需要在多个内核之间切换的用户。它以「节点」而非「配置文件」为中心，策略组不如 Clash 系直观，详见 [v2rayN / v2rayNG 使用指南](/posts/v2ray-clients-guide/)。
- **Hiddify / Karing**：想在手机和电脑上用同一个 App、订阅格式较杂的用户。Hiddify 最近一次正式版在 2026 年 3 月，间隔较长；Karing 几乎每天都有预发布版，日常使用选正式版即可。
- **sing-box for Desktop**：已经在用 sing-box JSON 配置的用户。sing-box 1.14.0 的更新日志称，新版桌面客户端的体验已与其他官方图形客户端一致（代码仓库的 README 仍保留旧的「Experimental」字样）。它不能直接导入 Clash 订阅。

### 安装包怎么选

Windows 上最容易出错的是架构。先确认自己的系统：

```powershell
# 查看 CPU 架构：AMD64 表示 x64，ARM64 表示骁龙等 ARM 设备
$env:PROCESSOR_ARCHITECTURE

# 查看系统版本：Windows 11 也显示为 10.0，第三段 Build 号 22000 及以上即为 Windows 11
[System.Environment]::OSVersion.Version
```

几个核实过的要点：

1. **x64 电脑**：选文件名带 `x64`、`amd64` 或 `64` 的安装包，所有客户端都有。
2. **ARM64 电脑**：Clash Verge Rev、Clash Party、FlClash、v2rayN、sing-box for Desktop 的发布页都提供 arm64 包；Karing、Hiddify 的 Windows 包目前只有 x64，没有 ARM64 原生包，在 ARM64 设备上只能依赖系统的 x64 模拟运行。
3. **老系统**：v2rayN、Karing、sing-box for Desktop 写明需要 Windows 10 及以上；Clash Party 的发布页另有文件名带 `win7` 的安装包。Windows 7 早已停止安全更新，长期看应尽快升级系统。

Windows Defender 误报、UWP 应用不走代理、WSL2 共享代理等平台问题，统一见 [Windows / macOS / iOS / Android 平台特有问题](/posts/platform-specific/)。

---

## macOS

| 客户端 | 内核 | 许可 / 收费 | 官方写明的系统要求 | 获取方式 |
|--------|------|------------|------------------|---------|
| Clash Verge Rev | mihomo | 开源 / 免费 | macOS 11+，Intel 与 Apple Silicon | GitHub Releases |
| FlClash | mihomo | 开源 / 免费 | 提供 Intel 与 Apple Silicon 安装包 | GitHub Releases、Homebrew |
| Clash Party | mihomo | 开源 / 免费 | arm64 与 x64 安装包，另有带 `catalina` 标记的包 | GitHub Releases |
| v2rayN | 多内核 | 开源 / 免费 | macOS 13.6+ | GitHub Releases |
| sing-box（SFM） | sing-box（官方） | 开源 / 免费 | macOS 13.0+ | GitHub 独立版、Homebrew（1.14 起不再上架 Mac App Store） |
| Karing | 修改版 sing-box | 开源 / 免费 | macOS 12+，Intel 与 Apple Silicon | GitHub Releases、官网、Homebrew |
| [Stash](https://stash.wiki/) | 独立引擎，兼容 Clash 配置 | 闭源 / 付费 | 以官网为准 | 以官网说明为准 |
| [Surge Mac](https://nssurge.com/) | 自研 | 闭源 / 付费 | 以官网为准 | 官网购买，7 天全功能试用 |

几个 macOS 平台的补充说明：

- **Surge Mac** 按设备数授权。官方知识库列出的首次购买价为 1 台设备 49.99 美元、3 台 69.99 美元、5 台 99.99 美元，均含 12 个月维护更新；到期后可以继续使用到期前的最后一个版本，续期需另付费。当前大版本为 Surge Mac 6。它的定位是网络调试工具，适合谁、不适合谁见 [Surge 使用指南](/posts/surge-guide/)。
- **Stash** 官方文档称其为「兼容 Clash 配置标准并加以扩展」的独立引擎，覆盖 iOS、tvOS、macOS。已经在 iPhone 上用 Stash 的用户，Mac 上沿用同一套配置比较顺手。
- **sing-box 官方客户端**在 Apple 平台分为 iOS 版（SFI）、macOS 版（SFM）和 tvOS 版（SFT）。按 sing-box 1.14.0（2026-08-31）的更新日志，iOS 与 tvOS 版已以「sing-box MT」为名重新上架 App Store；macOS 版则因权限（entitlement）限制不再通过 Mac App Store 提供，需要从 GitHub 下载独立版或用 Homebrew 安装。旧商店版的配置和设置不会自动继承，需按官方的 [迁移说明](https://sing-box.sagernet.org/migration/#migrate-the-macos-standalone-client-data) 手动迁移。

以下是各项目 README / 文档中给出的 Homebrew 安装方式：

```bash
# 先确认芯片：Apple Silicon 会显示 Apple M 系列，Intel 会显示 Intel
sysctl -n machdep.cpu.brand_string

# FlClash（README 给出的方式，需要先添加作者的 tap）
brew tap chen08209/tap
brew install --cask flclash

# sing-box 官方 macOS 客户端独立版（官方文档给出的方式）
brew install sfm

# Karing（README 给出的方式）
brew install karing
```

从 GitHub 下载的开源客户端大多没有 Apple 公证，首次打开会被 Gatekeeper 拦截，处理方法见 [平台特有问题](/posts/platform-specific/) 的 macOS 部分。

---

## Linux

Linux 桌面用户的选择和 Windows 大体相同，区别在于包格式和依赖：

| 客户端 | 内核 | 包格式（以发布页为准） | 官方写明的要求 |
|--------|------|---------------------|--------------|
| Clash Verge Rev | mihomo | deb、rpm | x64 / arm64 / armhf |
| FlClash | mihomo | AppImage、deb、rpm（amd64 / arm64） | 需先安装托盘依赖（见下方命令） |
| Clash Party | mihomo | deb、rpm、pkg.tar.zst | amd64 / arm64 |
| v2rayN | 多内核 | zip、deb、rpm | Debian 12+、Ubuntu 22.04+、Fedora 36+、RHEL 9+；x64 / arm64 / riscv64 / loong64 |
| sing-box for Desktop（SFL） | sing-box（官方） | deb、rpm、pkg.tar.zst | x64 / arm64 / armv7l |
| Karing | 修改版 sing-box | AppImage、deb、rpm（amd64） | 仅 64 位；当前 deb 包要求 glibc 2.38 及以上 |
| [Throne](https://github.com/throneproj/Throne) | sing-box，另可调用 Xray 内核 | zip、deb、rpm（均有 amd64 / arm64），另有安装脚本和 RPM 仓库 | Qt 图形界面；定位是 nekoray 的延续项目 |

安装前先确认架构和 glibc 版本，避免装上了却启动不了：

```bash
# 架构：x86_64 即 x64，aarch64 即 arm64
uname -m

# glibc 版本（Karing 的 deb 包要求 2.38 及以上：Ubuntu 24.04、Debian 13 满足；Ubuntu 22.04、Debian 12 不满足）
ldd --version | head -n 1

# FlClash README 要求的依赖（Debian / Ubuntu）
sudo apt-get install libayatana-appindicator3-dev
```

两个 Linux 特有的注意点：

1. **系统代理因桌面环境而异**。GNOME、KDE 对「系统代理」设置的支持较好，其他窗口管理器可能需要手动设置环境变量，命令行工具也往往不读取图形界面的代理设置。终端和开发工具怎么走代理，见 [命令行与开发工具走代理](/posts/terminal-proxy/)。
2. **没有图形界面的服务器**不需要这些 GUI 客户端，直接运行 mihomo 或 sing-box 内核即可。mihomo 配置文件的每一段是做什么的，见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)；sing-box 的配置结构见 [Sing-box 使用指南](/posts/singbox-guide/)。

---

## Android

| 客户端 | 内核 | 订阅格式 | 官方获取渠道 | 官方写明的最低系统 | 最近正式版（核实时） |
|--------|------|---------|------------|-----------------|-------------------|
| [Clash Meta for Android](https://github.com/MetaCubeX/ClashMetaForAndroid)（CMFA） | mihomo | Clash YAML | GitHub、F-Droid | Android 5.0（建议 7.0 以上） | v2.11.34，2026-09-14 |
| FlClash | mihomo | Clash YAML | GitHub、作者维护的 F-Droid 仓库 | 未单独写明 | v0.8.98，2026-09-14 |
| [v2rayNG](https://github.com/2dust/v2rayNG) | Xray | 分享链接、Base64 订阅 | GitHub | Android 7.0（API 24） | 2.2.6，2026-07-05（9 月另有 2.3.x 预发布） |
| [sing-box（SFA）](https://sing-box.sagernet.org/clients/android/) | sing-box（官方） | 仅 sing-box JSON 配置 | Google Play、F-Droid、GitHub | 普通包不支持 5.x；Android 5.x 需 legacy-android-5 构建 | 1.14.2，2026-09-24 |
| Hiddify | sing-box 系 | 多格式 | Google Play、GitHub | 未单独写明 | v4.1.1，2026-03-05 |
| Karing | 修改版 sing-box | 多格式 | GitHub、官网 | Android 8 | v1.2.25.2802，2026-09-10 |
| [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid) | sing-box | 只解析节点，分流规则会被忽略 | **仅 GitHub** | Android 5.0（API 21） | 1.4.2，2026-02-09 |

### 适合谁

- **Clash Meta for Android**：机场给 Clash 订阅、电脑上用 Clash 系的用户，规则和策略组可以通用。由 mihomo 的维护团队 MetaCubeX 发布。
- **FlClash**：希望手机和电脑界面一致的用户，同时提供 Android 与三大桌面系统的安装包。
- **v2rayNG**：订阅是通用格式、或自建 Xray 节点（VLESS + Reality、XHTTP）的用户。轻量、更新频繁，但不支持 TUIC 和 AnyTLS。
- **SFA（sing-box 官方）**：手里有 sing-box 格式配置的用户。它的「远程配置」必须是完整的 sing-box 配置文件，Clash 订阅或分享链接列表导入后不会生效。官方文档提到它支持分应用代理，并能扫描带中国特征的应用以辅助设置绕过。
- **Hiddify / Karing**：订阅格式杂、想在 iOS 和 Android 之间用同一个 App 的用户。
- **NekoBox**：仍可使用，但最近一次正式版在 2026 年 2 月，更新明显放缓；项目 README 还明确写着 **Google Play 上的版本自 2024 年 5 月起已被第三方控制、为非开源版本，请不要下载**。如要使用，只从 GitHub Releases 获取。

### APK 怎么选

GitHub 上的 APK 通常按 CPU 架构分包，绝大多数现代手机是 `arm64-v8a`。CMFA、sing-box（SFA）、Hiddify 的发布页另有 `universal` 包，不确定时可以选它（体积大一些，但兼容所有架构）；v2rayNG、FlClash、NekoBox 只按架构分包，没有 universal，不确定就先用下面的 adb 命令查询：

```bash
# 连接手机并开启 USB 调试后执行，常见输出为 arm64-v8a
adb shell getprop ro.product.cpu.abi
```

sing-box 的更新日志说明，普通包已不再支持 Android 5.0，Android 5.x 设备只能使用文件名带 `legacy-android-5` 后缀的单独构建（官方曾预告 1.13.0 是最后一个支持 Android 5.0 的版本，但核实时 1.14.2 的发布页仍提供这类构建）。新手机选普通包即可。

另外，华为 HarmonyOS NEXT（纯血鸿蒙，即 HarmonyOS 5 及以后）设备不能以原生方式安装这些 Android APK，需要改用鸿蒙原生客户端或移植版。目前有哪些可用、侧载签名有什么限制和风险，见 [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/)。

Android 的后台被杀、电池优化、分应用代理等问题，见 [平台特有问题](/posts/platform-specific/) 的 Android 部分。

---

## iOS 与 iPadOS

先说明一个事实：本文提到的 iOS 代理客户端在中国大陆区 App Store 中无法搜索和下载，需要使用其他国家或地区的 Apple 账户（sing-box 官方文档也写明需要「中国大陆以外的 Apple 账户」）。本文不提供账户注册教程。

下表价格为**美区 App Store 标价**，其他地区以当地商店为准，价格可能随时调整：

| App | 价格（美区） | 开源 | 配置体系 | 协议要点（按官方资料） | 最近更新 | 最低系统 |
|-----|------------|-----|---------|---------------------|---------|---------|
| [Shadowrocket](https://apps.apple.com/us/app/shadowrocket/id932747118) | 2.99 美元 | 否 | 自有格式，支持订阅、规则、重写 | 官方简介未给出完整协议表 | 2026-09-07 | iOS 13.0 |
| [Stash](https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349) | 5.99 美元 | 否 | 兼容 Clash 配置并扩展 | 文档列出 VLESS + Reality、Hysteria2、TUIC、AnyTLS、WireGuard、SSH 等 | 2026-07-16 | iOS 16.0 |
| [Quantumult X](https://apps.apple.com/us/app/quantumult-x/id1443988620) | 9.99 美元 | 否 | 自有格式 | 官方示例配置中有 VLESS（可启用 Reality）、AnyTLS；示例中未见 Hysteria2、TUIC | 2026-09-15 | iOS 15.0 |
| [Loon](https://apps.apple.com/us/app/loon/id1373567447) | 7.99 美元 | 否 | 自有格式，支持重写与 JavaScript 脚本 | 官方简介列出 VLESS、Hysteria2、ShadowTLS、WireGuard 等 | 2026-09-22 | iOS 15.0 |
| [Surge](https://apps.apple.com/us/app/surge-5/id1442620678) | 免费下载，应用内购买 | 否 | 自有格式，模块、脚本 | 官方商店简介与手册列出 Hysteria 2、AnyTLS、TUIC、Snell、Trojan、WireGuard 等，均未列出 VLESS | 2026-09-13 | iOS 17.0 |
| [Karing](https://apps.apple.com/us/app/karing/id6472431552) | 免费 | 是（GPL-3.0 + 附加条款） | 多格式订阅 | 修改版 sing-box 内核 | 2026-09-11 | iOS 15.0 |
| [Hiddify](https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532) | 免费 | 是（GPL-3.0 + 附加条款） | 多格式订阅 | sing-box 系 | 2026-02-19 | iOS 15.0 |
| [sing-box MT](https://apps.apple.com/us/app/sing-box-mt/id6785326793)（SFI） | 免费 | 是（GPL-3.0 + 附加条款） | 仅 sing-box JSON | sing-box 官方 | 2026-09-24 | iOS 15.0 |

### 适合谁

- **Shadowrocket**：预算有限、想一次买断的用户。美区 2.99 美元，订阅导入和规则模式都很直接，完整用法见 [Shadowrocket 使用指南](/posts/shadowrocket-guide/)。
- **Stash**：电脑上用 Clash 系、想在 iPhone 上沿用同一份 Clash 配置和规则的用户；它的文档对新协议列得比较完整。不想付费的话，Karing 团队出品的 Clash Mi（mihomo 内核，美区免费）也以 Clash YAML 配置为基础，开源程度以其 [GitHub 仓库](https://github.com/KaringX/clashmi) 为准。
- **Loon / Quantumult X**：需要重写、脚本等进阶功能，又不想花 Surge 那么多钱的用户。购买前请对照自己的节点协议——例如节点以 Hysteria2 或 TUIC 为主时，先确认 Quantumult X 当前版本是否支持。
- **Surge**：开发者、需要 MitM 与网络调试的高级用户。App Store 显示为免费下载，官方知识库说明需一次性付费 49.99 美元解锁（含一年功能更新订阅，之后续期为每年 14.99 美元，不续期也可永久使用已解锁的功能），并提供 7 天全功能试用。需要特别注意：**官方商店简介和手册的协议列表中都没有 VLESS**，如果你的节点以 VLESS + Reality 为主，Surge 不是合适的选择。
- **Karing / Hiddify**：不想付费、或想要开源 App 的用户。二者在 App Store 均为免费下载。
- **sing-box MT**：手里已经有 sing-box JSON 配置的用户。它是 sing-box 官方的 iOS 客户端，免费开源，但只接受 sing-box 格式的配置。

### sing-box 官方 iOS 客户端的现状

sing-box 的 Apple 平台客户端曾因审核问题长期无法在 App Store 更新，原先的「sing-box VT」条目后来也从商店消失。2026-08-31 发布的 sing-box 1.14.0 在更新日志中说明：客户端已迁移到新的 Apple 开发者账号，iOS 与 tvOS 版以「sing-box MT」为名重新上架 App Store（美区免费，要求 iOS 15.0 以上）。

需要注意三点：

1. **新旧是两个不同的 App**。旧版 sing-box VT 的用户需要另装 sing-box MT，配置要重新导入。
2. **只接受 sing-box JSON 配置**。和其他官方客户端一样，Clash 订阅或分享链接列表导入后不会生效。
3. **官方文档的 Apple 页面尚未同步**。核实时 sing-box 文档的 Apple 客户端页面仍保留「暂时无法更新」的旧提示和旧条目链接，以更新日志为准。

另有面向越狱设备的 deb 包和仅对赞助者开放的 TestFlight，普通用户用商店版即可。

App Store 中还存在名称带 sing-box、Clash 等字样、但并非这些项目官方发布的应用；sing-box 官方文档也明确说明，许多声称使用 sing-box 的第三方项目并未列入其官方客户端列表。下载前请从项目 README 或官方更新日志里的链接跳转到商店页面，并核对开发者名称（sing-box MT 的开发者名称为 Metamerism LLC，商店页的开发者网站指向 sing-box.sagernet.org）。

---

## 路由器、电视盒子与其他项目

**路由器**：在 OpenWrt 等系统上运行 OpenClash 之类的插件，可以让连接同一个 Wi-Fi 的所有设备自动走代理，电视、游戏机这类装不了客户端的设备也能覆盖。选型、主路由与旁路由的区别、性能要求，统一见 [软路由与旁路由](/posts/soft-router-guide/)；游戏场景的特殊问题见 [代理能打游戏吗](/posts/gaming-and-proxy/)。

**Apple TV**：sing-box 官方的 tvOS 版（随 App Store 中的 sing-box MT 提供，要求 tvOS 17 以上）、Karing（tvOS 17 以上）和 Stash（官方文档称支持 tvOS）都有 tvOS 版本。

**Android 电视盒子**：可以安装上文 Android 客户端的 APK（先用上面的 adb 命令确认架构，部分盒子只能装 32 位的 `armeabi-v7a` 包），但这些 App 主要为触屏设计，用遥控器操作的体验因应用而异。设备多的家庭更适合在路由器层统一处理。

**其他仍能见到的桌面项目**，简单列出核实到的状态，供有兴趣的读者自行了解：

| 项目 | 状态（核实时） |
|------|--------------|
| [Throne](https://github.com/throneproj/Throne) | 活跃，基于 sing-box 的 Qt 桌面客户端（README 列出 Xray VLESS 与 Xray 自定义出站），目标是延续已归档的 nekoray |
| GUI.for.Clash / GUI.for.SingBox | 活跃，同一组织（GUI-for-Cores）维护的轻量桌面 GUI，从名称看分别面向 Clash 系与 sing-box 内核 |
| Clash Nyanpasu | 仓库仍有提交，但最后一个正式版是 v1.6.1（2024-09），之后只有滚动预发布，新手不建议作为主力 |

---

## 按需求选客户端：决策表

把上面各平台的信息按常见需求重新组织一遍：

| 你的情况 | 可以考虑 | 理由与注意 |
|---------|---------|-----------|
| 刚入门，机场给了 Clash 订阅 | 电脑：Clash Verge Rev、Clash Party、FlClash；Android：CMFA、FlClash | mihomo 内核直接读取 Clash YAML，机场写好的规则和策略组原样可用 |
| 手机和电脑想用同一个 App | FlClash（Android + 桌面）；Karing、Hiddify（还覆盖 iOS） | 界面和概念一致，学一次就够 |
| 机场只给通用（Base64）订阅 | v2rayN / v2rayNG、Karing、Hiddify | 也可以转换成 Clash 格式后用 Clash 系，注意转换服务的隐私风险 |
| 自建 VLESS + Reality + XHTTP | v2rayN、v2rayNG；mihomo 系也支持 XHTTP | 官方 sing-box 内核的传输列表中没有 XHTTP，官方 sing-box 客户端用不了；Hiddify、Throne 可借内置的 Xray 内核处理 |
| 节点用 TUIC 或 AnyTLS | mihomo 系、sing-box 系客户端，或 v2rayN | v2rayNG 当前不支持这两种；Xray 的出站列表中也没有 |
| 节点用 Hysteria2 | 三大内核都支持；iOS 上 Stash、Loon、Surge 的资料列出支持 | 基于 UDP，部分网络环境下可能被限速 |
| 习惯手写 sing-box JSON | 官方 SFA、SFM、SFW / SFL，iOS 上的 sing-box MT | 官方客户端只接受 sing-box 配置文件 |
| iOS，想低价一次买断 | Shadowrocket | 美区 2.99 美元 |
| iOS，想沿用 Clash 配置与规则 | Stash（付费）；免费可试 Clash Mi | Stash 兼容 Clash 配置并扩展；Clash Mi 由 Karing 团队出品、使用 mihomo 内核，美区免费，开源程度以其仓库为准 |
| iOS，需要 MitM、脚本、网络调试 | Surge、Loon、Quantumult X | 付费、学习成本高；Surge 的官方资料未列出 VLESS |
| iOS，不想付费或想用开源 App | Karing、Hiddify；已有 sing-box 配置可用官方 sing-box MT | 均免费开源；sing-box MT 只接受 sing-box JSON 配置 |
| 家里设备多，电视、游戏机也要走代理 | 路由器 / 旁路由方案 | 见 [软路由与旁路由](/posts/soft-router-guide/) |

选出候选之后，再按节点协议做一次排除，避免装好了才发现连不上：

```text
按协议排除不合适的客户端
├── 有 TUIC / AnyTLS → 排除 v2rayNG；iOS 上逐个核对 App 的协议列表
├── 有 XHTTP        → 排除官方 sing-box 客户端（SFA / SFI / SFM / SFW / SFL）；
│                      Hiddify、Throne 等内置 Xray 内核的客户端，需确认该节点由 Xray 内核处理
└── 有 VLESS        → iOS 上排除 Surge
```

装好之后，客户端里看到的「延迟」数字到底测的是什么、为什么不等于实际速度，见 [延迟测试数字的含义](/posts/latency-test-explained/)。

---

## 下载安全：比「选哪个」更重要

代理客户端能看到你几乎所有的网络流量，还会修改系统代理、创建虚拟网卡，所以**从哪里下载，比下载哪一个更重要**。这里只列与本文客户端直接相关的要点和资料；怎样辨认仿冒仓库、在各平台查看签名、审视权限与根证书，以及发现可疑后怎么处置，完整方法见 [代理客户端安全自查](/posts/client-safety-check/)。

1. **只认官方渠道**，以下表和各项目 README 为准。搜索引擎里的「XX 官网」「XX 中文网」很多并不是项目方的：笔者核实时搜索 Clash、Mihomo Party 等名称，结果里就有多个自称官网、实际与项目无关的域名。
2. **不要下载「汉化版」「破解版」「绿色加速版」，也不要从网盘、群文件里找安装包**。本文列出的开源客户端本身就有中文界面、完全免费，不存在需要汉化或破解的理由。
3. **项目页面上的推广内容与客户端无关**。部分客户端的 README 或官网含有机场推广链接，这是项目方自己的商业合作，不代表客户端质量，也不代表本站立场。
4. **停更的客户端不要再用**（名单见下文）。它们不会再修复漏洞、跟进新协议，网上流传的「最新版」更是来源不明。还在用 Clash for Windows 的，迁移到 Clash Verge Rev 或 Clash Party 几乎零成本，原来的 Clash 订阅可以直接导入。
5. **下载后做一次校验**。Clash Party 为每个安装包附了 `.sha256` 文件，v2rayN / v2rayNG 还提供 GPG 签名，命令见下文「校验下载的文件」。
6. **安装时留意两个信号**。Android 提示「签名不一致」、要求先卸载才能更新时，先停下来核对来源；例外是同一应用的 F-Droid 版和 GitHub 版可能由不同密钥签名（除非项目像 sing-box 那样通过可复现构建统一了签名），两边都是官方渠道时，先导出配置再卸载重装即可。客户端要求安装并信任根证书时，那是 MitM（HTTPS 解密）功能才需要的，普通的翻墙和分流用不到，没有明确用途就不要装。

### 各客户端的官方渠道

| 客户端 | 官方获取渠道（以项目 README 为准） |
|--------|------------------------------|
| Clash Verge Rev | GitHub Releases |
| FlClash | GitHub Releases；作者维护的 F-Droid 仓库；Homebrew tap |
| Clash Party | GitHub Releases；官网 clashparty.org |
| v2rayN / v2rayNG | GitHub Releases |
| Clash Meta for Android | GitHub Releases；F-Droid |
| sing-box 官方客户端 | GitHub Releases；Google Play 与 F-Droid（Android）；App Store 中的 sing-box MT（iOS / tvOS，开发者 Metamerism LLC）；Homebrew（macOS） |
| Hiddify | GitHub Releases；Google Play；App Store；Microsoft Store |
| Karing | GitHub Releases；karing.app；App Store |
| NekoBox | 仅 GitHub Releases（Google Play 版非官方） |
| Shadowrocket、Stash、Loon、Quantumult X、Surge | App Store 中对应开发者的页面；Surge Mac 另从 nssurge.com 购买 |

### 这些已经停止维护，不要再用

| 项目 | 状态 | 核实依据 |
|------|------|---------|
| Clash for Windows | 作者于 2023-11-02 宣布停更并删除仓库 | 原仓库地址已无法访问；同期新闻报道 |
| Clash Verge（原版） | 2023 年 11 月归档，最后发布 v1.3.8（2023-10-30） | GitHub 显示 Archived；继任者为 Clash Verge Rev |
| Clash for Android（原版） | 原仓库已无法访问 | Clash 系 Android 客户端可改用 CMFA 或 FlClash |
| Clash Premium 内核 | 2023 年 11 月停更 | 不支持 VLESS、Reality、Hysteria2 等协议，详见 [Clash 系列全解](/posts/clash-family/) |
| nekoray（桌面） | 2024 年 12 月归档 | 仓库描述写明「不再维护，自寻替代品」 |
| NekoBox 的 Google Play 版 | 非官方、非开源版本 | NekoBox README 的明确声明 |

### 校验下载的文件

哈希和签名各自能证明什么、Windows / macOS / Android 上怎么查看签名，见 [代理客户端安全自查](/posts/client-safety-check/)。这里只给本文涉及的两个具体例子。

Clash Party 的每个安装包旁边都附有同名的 `.sha256` 文件（内容只有一行小写的哈希值，不带文件名）。64 位哈希靠肉眼比对容易看错，而且 PowerShell 输出的是大写，下面的写法让系统自动比对：

```powershell
# Windows PowerShell：计算 SHA256 并与同目录下的 .sha256 文件比对，输出 True 即一致（-eq 比较字符串时不区分大小写）
$f = '.\clash-party-windows-2.0.3-x64-setup.exe'
(Get-FileHash $f -Algorithm SHA256).Hash -eq (Get-Content "$f.sha256" -Raw).Trim()
```

```bash
# Linux：输出 OK 即一致
echo "$(cat clash-party-linux-2.0.3-amd64.deb.sha256)  clash-party-linux-2.0.3-amd64.deb" | sha256sum -c

# macOS：输出 OK 即一致
echo "$(cat clash-party-macos-2.0.3-arm64.pkg.sha256)  clash-party-macos-2.0.3-arm64.pkg" | shasum -a 256 -c
```

v2rayN 和 v2rayNG 更进一步，对发布文件做了 GPG 签名（每个文件旁有 `.sig`，两者共用发布页附带的公钥文件 `v2rayN-public-key.asc`），可以这样验证：

```bash
# 1. 导入前先查看公钥的完整指纹（64 位十六进制），
#    去掉空格后与 v2rayN README「公钥指纹」一节逐字比对，一致再继续
gpg --show-keys v2rayN-public-key.asc

# 2. 指纹一致后导入
gpg --import v2rayN-public-key.asc

# 3. 用签名文件验证安装包，看到 Good signature 才算通过
gpg --verify v2rayN-windows-64.zip.sig v2rayN-windows-64.zip

# v2rayNG 的 APK 同理
gpg --verify v2rayNG_2.2.6_arm64-v8a.apk.sig v2rayNG_2.2.6_arm64-v8a.apk
```

几个容易卡住的地方：

1. **GnuPG 版本**：这把公钥是 v5 格式的 Ed448 密钥，需要 GnuPG 2.3 及以上（2.4 系列可用）。Debian 12 自带的 2.2.40、Ubuntu 22.04 自带的 2.2.27 无法导入。
2. **Windows 上在哪里运行**：Windows 没有自带 gpg。可以直接在 Git Bash 里运行上面的命令（笔者核实时 Git for Windows 自带的是 GnuPG 2.4.8），也可以安装 Gpg4win；macOS 可用 `brew install gnupg`。
3. **指纹显示方式**：导入后如果改用 `gpg --fingerprint` 查看，GnuPG 2.4 对这类 v5 密钥只显示前 50 位、按 5 个字符一组分隔，与 README 按 4 个字符分组的 64 位指纹对不上，不要拿它直接比对，以第 1 步 `--show-keys` 的输出为准。
4. **信任警告**：验证通过时 gpg 还会提示「This key is not certified with a trusted signature」。这只表示你没有在本机为这把公钥签名、标记信任，只要第 1 步核对过指纹一致，并且看到了 Good signature，就可以忽略。

---

## 常见问题（FAQ）

### Mihomo Party 和 Clash Party 是同一个软件吗？

是的。Mihomo Party 在 v1.8.6（2025-08-31）更名为 Clash Party，同时更换了 Logo，GitHub 仓库迁移到 `mihomo-party-org/clash-party`，访问旧地址会自动跳转。内核仍是 mihomo，Clash 订阅照常导入。网上以「Mihomo Party 官网」为名的站点，同样要核对是否为项目方所有。

### v2rayN 不是只有 Windows 版吗？

已经不是了。v2rayN 当前的 README 写明支持 Windows、Linux 和 macOS，并列出了各平台支持的架构（Windows 需要 10 及以上，macOS 需要 13.6 及以上）。它还支持在 Xray、sing-box、mihomo 等多个内核之间切换。手机版仍然是独立的 v2rayNG。

### 为什么 sing-box 官方客户端导入订阅后什么都没有？

因为官方客户端的「远程配置」要求链接返回的是一份完整的 sing-box JSON 配置，而不是 Clash YAML 或分享链接列表。解决办法有三种：向机场要 sing-box 格式的订阅；用订阅转换工具生成 sing-box 配置（见 [订阅转换与管理](/posts/subscription-management/)）；或者改用能解析多种格式的 Karing、Hiddify。官方客户端还定义了 `sing-box://import-remote-profile?url=编码后的配置链接#编码后的名称` 格式的链接，用于一键导入远程配置。其中的配置链接和名称都必须先做 URL 编码，否则配置链接里的 `?`、`&` 会被当成导入链接自身的一部分，导入的地址就不完整了。

### 同一个节点，为什么 A 客户端能连、B 客户端连不上？

最常见的原因是协议或传输方式不被 B 支持，例如 v2rayNG 不支持 TUIC 和 AnyTLS，官方 sing-box 内核不支持 XHTTP（Hiddify、Throne 可借内置的 Xray 内核处理），Surge 的官方资料里没有 VLESS。其次是订阅解析时丢失了参数（例如 Reality 的公钥、短 ID），或者 B 的内核版本太旧。排查时先看 B 的日志里有没有「不支持的类型」一类的报错，再按 [节点连不上？系统排查流程](/posts/connectivity-checklist/) 逐项检查。

### Clash Verge Rev、Clash Party、FlClash 三个怎么选？

三者都用 mihomo 内核，导入同一份 Clash 订阅后，节点、规则和策略组完全一样，区别只在界面和附加功能：想找中文教程多一些的，可以用 Clash Verge Rev（本站有 [使用指南](/posts/clash-verge-guide/)）；要在客户端里合并、管理多个订阅，或者还在用 Windows 7，可以用内置 Sub-Store、另提供 win7 安装包的 Clash Party；手机和电脑想用同一套界面，可以用 FlClash。先装一个用起来，不满意再换，订阅链接可以直接复用。注意不要同时运行多个代理客户端，它们会互相抢占端口和 TUN，更多说明见 [我该用哪个？](/posts/software-overview/) 的常见问题。

### 开源客户端就一定安全吗？

不一定，但更可控。开源意味着代码可以被任何人审计，你也可以对照官方 Releases 核对自己下载的文件；闭源的付费客户端则只能信任开发者的信誉。真正的风险往往不在「开源还是闭源」，而在「是不是从官方渠道下载」——一个被二次打包的开源客户端，比正规商店里的闭源应用危险得多。

### iOS 上有没有既免费又开源的客户端？

有。Karing 和 Hiddify 在 App Store 上都是免费下载，源代码也在 GitHub 公开（许可证为 GPL-3.0 附加额外条款）。sing-box 官方客户端也已于 2026 年 8 月底以「sing-box MT」为名重新上架，同样免费开源，但只能导入 sing-box 格式的配置。如果你愿意付费，Shadowrocket 美区售价 2.99 美元，是付费客户端中价格较低的一个。

---

## 外部参考

以下链接均在写作时实际访问核对过：

- [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) — GitHub 仓库与 Releases
- [FlClash](https://github.com/chen08209/FlClash) — GitHub 仓库与 Releases
- [Clash Party](https://github.com/mihomo-party-org/clash-party) — GitHub 仓库（原 Mihomo Party）；[官网文档](https://clashparty.org)
- [v2rayN](https://github.com/2dust/v2rayN) — GitHub 仓库；[支持的内核列表](https://github.com/2dust/v2rayN/wiki/List-of-supported-cores)；[发布文件与系统要求](https://github.com/2dust/v2rayN/wiki/Release-files-introduction)
- [v2rayNG](https://github.com/2dust/v2rayNG) — GitHub 仓库与 Releases
- [Clash Meta for Android](https://github.com/MetaCubeX/ClashMetaForAndroid) — GitHub 仓库
- [Hiddify](https://github.com/hiddify/hiddify-app) — GitHub 仓库
- [Karing](https://github.com/KaringX/karing) — GitHub 仓库；[Karing 设置说明（含 TUN 需管理员运行）](https://karing.app/en/app-manual/settings)
- [NekoBox for Android](https://github.com/MatsuriDayo/NekoBoxForAndroid) — GitHub 仓库（含 Google Play 版声明）
- [mihomo](https://github.com/MetaCubeX/mihomo) — 内核仓库；[mihomo 文档：代理类型](https://wiki.metacubex.one/config/proxies/)
- [sing-box](https://github.com/SagerNet/sing-box) — 内核仓库与各平台官方客户端下载；[官方图形客户端列表](https://sing-box.sagernet.org/clients/)；[Apple 平台说明](https://sing-box.sagernet.org/clients/apple/)（核实时部分文字尚未随 1.14.0 更新）；[Android 说明](https://sing-box.sagernet.org/clients/android/)；[通用客户端说明（含 import-remote-profile 链接格式）](https://sing-box.sagernet.org/clients/general/)；[出站类型](https://sing-box.sagernet.org/configuration/outbound/)
- [sing-box 更新日志](https://sing-box.sagernet.org/changelog/) 与 [v1.14.0 发布说明](https://github.com/SagerNet/sing-box/releases/tag/v1.14.0) — Apple 平台客户端迁移、重新上架与桌面客户端说明；Android 5.x 的 legacy 构建说明；[sing-box MT（App Store）](https://apps.apple.com/us/app/sing-box-mt/id6785326793)；[macOS 独立版数据迁移](https://sing-box.sagernet.org/migration/#migrate-the-macos-standalone-client-data)
- [Xray-core](https://github.com/XTLS/Xray-core) — 内核仓库；[Xray 文档：Hysteria 出站](https://xtls.github.io/en/config/outbounds/hysteria.html)
- [Stash 文档：代理协议类型](https://stash.wiki/en/proxy-protocols/proxy-types)
- [Surge 手册：支持的代理协议](https://manual.nssurge.com/policies/overview.html)；[Surge iOS 功能更新订阅说明](https://kb.nssurge.com/surge-knowledge-base/license/ios-fus)；[Surge Mac 维护订阅说明](https://kb.nssurge.com/surge-knowledge-base/license/mac-fus)
- [Quantumult X 官方示例配置](https://github.com/crossutility/Quantumult-X)
- App Store 页面（价格、版本、最低系统均取自美区商店）：[Shadowrocket](https://apps.apple.com/us/app/shadowrocket/id932747118)、[Stash](https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349)、[Quantumult X](https://apps.apple.com/us/app/quantumult-x/id1443988620)、[Loon](https://apps.apple.com/us/app/loon/id1373567447)、[Surge 5](https://apps.apple.com/us/app/surge-5/id1442620678)（简介中列有其支持的代理协议）、[Karing](https://apps.apple.com/us/app/karing/id6472431552)、[Hiddify](https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532)、[Clash Mi](https://apps.apple.com/us/app/clash-mi/id6744321968)
- [Clash Mi](https://github.com/KaringX/clashmi) — GitHub 仓库
- [Hiddify v2.0.5 发布说明](https://github.com/hiddify/hiddify-app/releases/tag/v2.0.5) — 内置 Xray 内核的说明
- [Xboard 订阅接口源码](https://github.com/cedar2025/Xboard/blob/master/app/Http/Controllers/V1/Client/ClientController.php) — 按 flag 参数与 User-Agent 返回不同订阅格式的逻辑
- [GnuPG 2.3.0 发布公告](https://lists.gnupg.org/pipermail/gnupg-announce/2021q2/000458.html) — v5 密钥与 Ed448 支持自 2.3 起
- [Throne](https://github.com/throneproj/Throne)、[nekoray（已归档）](https://github.com/MatsuriDayo/nekoray)、[Clash Verge 原版（已归档）](https://github.com/zzzgydi/clash-verge)
- [中国数字时代：Clash for Windows 删库停更](https://chinadigitaltimes.net/chinese/701751.html) — 停更时间的新闻来源

站内相关文章：

- [V2Ray、Xray、Clash、Sing-box……我该用哪个？](/posts/software-overview/) — 内核与客户端的基本概念
- [Clash 系列全解：Clash Premium / Clash Meta / mihomo 的关系](/posts/clash-family/) — Clash 生态的来龙去脉
- [订阅转换与管理：SubConverter、Sub-Store 完全指南](/posts/subscription-management/) — 订阅格式不匹配时怎么办
- [Windows / macOS / iOS / Android 平台特有问题](/posts/platform-specific/) — 安装之后的平台排障
- [代理客户端安全自查](/posts/client-safety-check/) — 下载来源、哈希与签名校验、权限与出事后的处置
- [代理客户端演进史](/posts/proxy-client-history/) — 停更、删库、下架与改名的来龙去脉
- [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/) — HarmonyOS NEXT 上的原生客户端与侧载须知
