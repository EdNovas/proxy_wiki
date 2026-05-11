---
title: Clash Verge Rev 使用指南
date: 2026-05-10
updated: 2026-05-10
categories:
  - 代理软件
tags:
  - Clash Verge
  - mihomo
  - 教程
  - 配置
  - Windows
  - macOS
index_img: /images/posts/clash-verge-guide.webp
excerpt: Clash Verge Rev 是当前最推荐的桌面代理客户端。本文详解安装、导入订阅、节点选择、规则配置、TUN 模式等核心功能。
---

> **摘要**：Clash Verge Rev 是当前桌面平台上最受欢迎的代理客户端之一，基于 [mihomo](https://github.com/MetaCubeX/mihomo) 内核，提供直观的图形界面和强大的规则分流能力。本文将从安装到进阶配置，系统地讲解它的核心功能和使用方法，帮助你充分发挥这个工具的能力。

---

## Clash Verge Rev 是什么

Clash Verge Rev 是一个跨平台的代理客户端，支持 Windows、macOS 和 Linux。它的前身是 Clash Verge，在原项目停止维护后由社区接手继续开发，加上了"Rev"后缀以示区别。

它的底层使用的是 [mihomo](https://github.com/MetaCubeX/mihomo)（原 Clash Meta）内核。mihomo 是目前 Clash 生态中功能最全面的内核，支持 VLESS、Reality、Hysteria 2、TUIC 等新一代协议——这意味着 Clash Verge Rev 不仅能用于传统的 Shadowsocks 和 VMess，也能跟上最新的协议发展。

项目地址：[https://github.com/clash-verge-rev/clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev)

---

## 安装

### Windows

1. 打开 [Clash Verge Rev 的 GitHub Releases 页面](https://github.com/clash-verge-rev/clash-verge-rev/releases)。
2. 在最新版本的 Assets 列表中，找到文件名包含 `x64-setup.exe` 或 `x64.msi` 的安装包。绝大多数现代 Windows 电脑选 `x64` 版本即可；如果你的设备使用 ARM 处理器（部分高通骁龙笔记本），选 `arm64` 版本。
3. 下载后双击运行，按向导提示安装。安装过程可能会提示安装 **WebView2 Runtime**，同意即可。
4. 安装完成后，在桌面或开始菜单找到 Clash Verge Rev 图标，双击打开。

### macOS

1. 同样在 [Releases 页面](https://github.com/clash-verge-rev/clash-verge-rev/releases) 下载 `.dmg` 文件。Apple Silicon（M1/M2/M3/M4）芯片选 `aarch64.dmg`，Intel 芯片选 `x64.dmg`。不确定芯片型号的话，点左上角苹果菜单 →"关于本机"查看。
2. 打开 `.dmg`，将应用拖入 Applications 文件夹。
3. 首次打开时 macOS 可能会拦截，提示"无法验证开发者"。前往 **系统设置 → 隐私与安全性**，在底部找到 Clash Verge Rev 的提示，点击"仍要打开"。

### Linux

Linux 用户可以根据发行版选择对应的包格式：

- Debian/Ubuntu 系：下载 `.deb` 包，运行 `sudo dpkg -i xxx.deb`
- Fedora/RHEL 系：下载 `.rpm` 包
- 通用方案：下载 `.AppImage`，添加执行权限后直接运行

注意 Linux 下 TUN 模式需要额外的权限配置，后面会讲到。

---

## 导入订阅

安装完成并打开客户端后，第一件事是导入你的机场订阅。

1. 点击左侧菜单栏的 **Profiles**（配置）标签。
2. 页面顶部有一个输入框和一个下载按钮。
3. 将你从机场获取的**订阅链接**粘贴进输入框，点击下载按钮或按回车。
4. 等待几秒钟，客户端会拉取订阅内容并解析出所有节点。
5. 成功后下方会出现一个新的配置项卡片，显示配置名称、节点数量和更新时间。**确保该配置项被选中**（高亮状态）。

### 订阅格式

Clash Verge Rev 使用的是 Clash（YAML）格式的订阅。大多数机场都提供这种格式，有些会标注为"Clash"或"Clash Meta"订阅。如果你的机场只提供通用订阅链接，客户端通常也能自动识别并转换——mihomo 内核对多种格式都有兼容处理。

### 定时更新

配置项卡片的右侧有一个菜单按钮，点击可以设置**自动更新间隔**。建议设为每 12 小时或每 24 小时自动更新一次，这样机场新增或调整节点后你不需要手动刷新。

---

## 代理模式选择：系统代理 vs TUN

导入订阅后，你需要选择一种方式让系统流量经过代理。Clash Verge Rev 提供两种核心工作模式。

### 系统代理

点击 **Settings**（设置）标签，找到 **System Proxy** 开关并打开。

系统代理的原理是在本地启动一个 HTTP/SOCKS5 代理服务器，然后修改操作系统的代理设置，让支持系统代理的应用（主要是浏览器）把流量转发到这个端口。

- **优点**：配置简单，无需管理员权限，对系统侵入性低
- **缺点**：只能捕获部分应用的流量，游戏、部分命令行工具、UDP 流量等不走系统代理

对于大多数只需要浏览器翻墙的用户，系统代理已经够用。

### TUN 模式

在 Settings 标签中找到 **TUN Mode** 开关并打开。首次开启会弹出管理员权限请求，需要同意。

TUN 模式通过创建一个虚拟网卡并修改系统路由表，让**所有网络流量**都经过代理客户端处理。游戏、原生应用、UDP 流量——全部都会被捕获。

- **优点**：全局生效，无遗漏，DNS 查询也能被接管
- **缺点**：需要管理员权限，可能与 VPN 或虚拟机软件冲突

关于两种模式的详细对比，参见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。

### TUN 模式下的协议栈选择

在 TUN 设置区域，你会看到 **Stack** 选项，通常有三个选项：

| 协议栈 | 特点 |
|--------|------|
| **system** | 使用系统原生网络栈，性能最好，但兼容性略低 |
| **gVisor** | 用户态网络栈，兼容性最好，但高带宽下 CPU 占用较高 |
| **mixed** | 结合两者优点，推荐选择 |

新用户建议选 **mixed** 或 **gVisor**，遇到性能问题再切换到 **system** 尝试。

---

## 节点选择与延迟测试

点击左侧菜单栏的 **Proxies**（代理）标签，你会看到机场配置好的**策略组**。

### 延迟测试

每个策略组旁边有一个闪电图标，点击它可以对组内所有节点进行延迟测试。测试完成后，每个节点后面会显示延迟数值（单位 ms）：

- **< 150ms**（通常显示绿色）：延迟很低，体验好
- **150~300ms**（通常显示黄色）：可用，日常浏览没问题
- **> 300ms 或超时**：延迟过高或不可用，建议跳过

### 选择策略

策略组里除了具体节点外，通常还有一些自动策略可选：

- **auto / url-test**：自动选择延迟最低的节点，定期重测。适合懒人，交给程序选就行
- **fallback**：按顺序尝试节点，第一个不可用时自动切换到下一个。适合追求稳定性
- **load-balance**：在多个节点间做负载均衡。适合需要高吞吐的场景
- **select**：手动选择。你自己点哪个就用哪个

如果你不想操心，把主策略组设成 **auto** 就行。如果你有特定需求（比如需要某个地区的 IP），就用 **select** 手动指定。

---

## 配置管理：Override 与 Merge

Clash Verge Rev 提供了一套强大的配置管理系统，允许你在不修改原始订阅的情况下自定义行为。这在订阅更新时特别有用——你的自定义规则不会被覆盖。

### Script（脚本覆写）

在 Profiles 页面，点击底部的 **Script** 标签，可以编写 JavaScript 脚本来动态修改配置。比如：

```javascript
// 在所有规则最前面插入一条自定义规则
export default function main(config) {
  config.rules.unshift("DOMAIN-SUFFIX,openai.com,美国节点");
  return config;
}
```

这种方式灵活性最高，但需要一点编程基础。

### Merge（合并配置）

如果你不想写脚本，可以用 Merge 功能。它允许你用 YAML 格式来追加或覆盖配置项。比如你想修改 DNS 设置或添加自定义规则，写在 Merge 配置里就行，每次订阅更新后会自动与原始配置合并。

这两种方式的核心目的是一样的：**让你的个性化配置与订阅解耦**。你可以放心地更新订阅，自定义的部分不会丢失。

---

## 代理组与分流规则

Clash 系客户端的核心优势之一就是强大的规则分流系统。如果你想深入了解规则的工作原理，建议阅读 [什么是规则分流](/posts/what-are-rules/)。

### 代理组的作用

策略组不仅是节点的容器，更是分流规则的执行单元。一个典型的机场订阅可能包含这样的策略组结构：

- **节点选择**：主策略组，大部分流量经过这里
- **流媒体**：Netflix、Disney+、YouTube 等流媒体服务走这个组
- **AI 服务**：ChatGPT、Claude、Gemini 等 AI 服务走这个组
- **国内直连**：匹配到国内域名和 IP 的流量直连，不走代理

每个策略组可以独立选择不同的节点或自动策略，实现精细的流量控制。

### 查看连接日志

在 **Connections**（连接）标签页中，你可以实时查看当前所有活跃连接的详细信息：

- 目标域名 / IP
- 匹配到的规则
- 走的哪个策略组和节点
- 上传 / 下载速度
- 连接持续时间

这是排查"某个网站为什么打不开"最有用的工具。你可以清楚地看到请求被哪条规则匹配、走了哪个节点，从而判断是节点问题还是规则问题。

---

## 日志查看

**Logs**（日志）标签页记录了 mihomo 内核运行过程中的各种事件。当遇到问题时，日志是最重要的诊断工具。

常见的日志级别：

- **info**：正常运行信息
- **warning**：警告信息，不一定影响使用但值得关注
- **error**：错误信息，通常意味着某个功能出了问题

你可以在 Settings 中调整日志级别。日常使用设为 **info** 即可；排查问题时可以切换到 **debug** 获取更详细的信息。

---

## 常用设置

### 开机自启

Settings 标签中找到 **Auto Launch**（开机自启）选项，打开即可。这样每次开机后代理自动生效，不需要手动打开客户端。

### 允许局域网连接

打开 **Allow LAN** 选项后，局域网内的其他设备（手机、平板等）可以通过你的电脑来使用代理。配置方法是在其他设备的 Wi-Fi 设置中，将代理服务器设为你电脑的局域网 IP，端口设为 Clash Verge Rev 的混合端口（默认 7890）。

### 混合端口

**Mixed Port** 是客户端监听的本地代理端口，默认 7890。同时支持 HTTP 和 SOCKS5 协议。通常不需要修改，但如果端口被占用可以换一个。

### 外部控制

Clash Verge Rev 支持通过 RESTful API 进行外部控制，这意味着你可以用其他工具（比如 Yacd 面板或命令行）来管理代理。外部控制的端口和密钥在 Settings 中可以查看和修改。

### 服务模式

在 Windows 上，Clash Verge Rev 支持以系统服务的方式运行。开启服务模式后，TUN 模式不需要每次都弹出管理员权限请求，而且在用户注销后代理依然保持运行。这对需要 TUN 模式的用户来说很方便。

安装服务模式：Settings → 找到 Clash Verge Service → 点击安装。

---

## Linux 上的额外注意事项

Linux 用户使用 TUN 模式需要额外设置权限。通常需要给二进制文件 `setcap` 权限：

```bash
sudo setcap cap_net_admin,cap_net_bind_service=ep /path/to/clash-verge
```

或者以 root 身份运行。具体取决于你的发行版和桌面环境。

此外，Linux 上系统代理的行为因桌面环境而异。GNOME 和 KDE 对系统代理的支持较好，其他窗口管理器可能需要手动配置环境变量。

---

## 与其他客户端的比较

| 特性 | Clash Verge Rev | Clash for Windows（已停更） | Clash Nyanpasu |
|------|----------------|---------------------------|----------------|
| 内核 | mihomo | Clash Premium | mihomo / sing-box |
| 当前维护状态 | 活跃 | 已停止 | 活跃 |
| 平台 | Win / macOS / Linux | Win / macOS / Linux | Win / macOS / Linux |
| TUN 模式 | 支持 | 支持 | 支持 |
| 服务模式 | 支持 | 支持 | 支持 |
| 配置覆写 | Script / Merge | Parsers / Mixin | Script / Merge |

简单来说，如果你之前用的是 Clash for Windows，Clash Verge Rev 是最自然的迁移目标。功能更强，而且在持续更新。

---

## 常见问题

### Q: Clash Verge Rev 和 Clash Verge 有什么关系？

Clash Verge Rev 是 Clash Verge 的社区延续版本。原版 Clash Verge 在 2023 年底停止维护后，社区开发者 fork 了项目并继续开发，加上了"Rev"（Revolution）后缀。功能上完全兼容原版并有大量改进。

### Q: 导入订阅失败怎么办？

按以下顺序排查：

1. 确认订阅链接复制完整，末尾没有被截断或多出空格
2. 确认网络连通——如果你连基本的网络都不通，自然无法下载订阅
3. 尝试在浏览器中直接打开订阅链接，看看是否有内容返回
4. 确认机场账号状态正常、套餐已生效
5. 如果以上都没问题，可能是机场订阅接口暂时故障，稍后重试

### Q: 开启代理后浏览器能翻墙但某些应用不行？

这是系统代理模式的正常现象。系统代理只能捕获读取系统代理设置的应用的流量，很多原生应用和游戏不会读取系统代理。解决方案是切换到 TUN 模式。详见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。

### Q: TUN 模式开了但没效果，所有网页都打不开？

首先检查是否以管理员身份运行。Windows 上可以在 Settings 中安装服务模式来解决权限问题。其次检查是否有其他 VPN 或虚拟机软件的网卡冲突。最后查看日志中是否有报错信息。

### Q: 配置更新后我的自定义规则丢失了？

使用 Override（脚本覆写）或 Merge（合并配置）功能来管理自定义规则，而不是直接修改订阅配置。这样每次订阅更新时，你的自定义部分会自动保留。

### Q: Clash Verge Rev 是免费的吗？

是的，完全免费且开源。源代码在 [GitHub](https://github.com/clash-verge-rev/clash-verge-rev) 上公开。你不需要为客户端付费——但代理服务（机场订阅）是另一回事。

---

## 相关资源

- [Clash Verge Rev GitHub 仓库](https://github.com/clash-verge-rev/clash-verge-rev) —— 下载和问题反馈
- [mihomo GitHub 仓库](https://github.com/MetaCubeX/mihomo) —— 内核项目
- [Clash Wiki（MetaCubeX）](https://wiki.metacubex.one/) —— mihomo 的官方文档，包含完整的配置参考
- [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/) —— 深入理解两种工作模式
- [什么是规则分流](/posts/what-are-rules/) —— 理解 Clash 规则的工作原理
