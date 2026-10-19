---
title: "Telegram 一直「连接中」？原理、客户端内置代理、MTProxy 与分流规则"
date: 2026-10-19
updated: 2026-10-19
categories:
  - 排障手册
tags:
  - Telegram
  - 排障
  - 配置
  - 规则
  - 隐私
excerpt: "浏览器能打开 Google，Telegram 却停在「连接中」？它不先解析域名，而是直接连数据中心 IP。本文讲清各平台代理何时生效、应用内 SOCKS5 与 MTProxy 的区别、按官方 IP 段写分流规则的方法，以及排障与隐私要点。"
index_img: /images/posts/telegram-proxy-guide.svg
---

> **摘要**：浏览器已经能打开 Google，Telegram 却一直停在「连接中…」——这是代理用户最常遇到的困惑之一。原因在于 Telegram 不走网页那一套「先解析域名、再建立连接」的流程，而是用 MTProto 协议直接连接数据中心的 IP 地址，所以流量能不能进入代理客户端、进去之后走哪个出口，都和浏览器不一样。本文先讲清各平台客户端在什么情况下会走代理，再说明应用内 SOCKS5 与 MTProto 代理的设置方法和区别、MTProxy 的 secret 模式与公共代理的风险边界，然后给出按 Telegram 官方 IP 列表编写分流规则的方法，最后是排障清单和账号隐私设置。

---

## 为什么浏览器能上，Telegram 却一直「连接中」

### Telegram 怎样连接服务器

浏览器访问网站时，先把域名交给 DNS 解析，再去连接得到的 IP；代理客户端的大部分分流规则（`DOMAIN-SUFFIX`、`GEOSITE`）也是围绕域名工作的。

Telegram 客户端走的是另一条路。按官方 API 文档，Telegram 的服务端由若干数据中心（DC）组成，客户端通过 `help.getConfig` 获得每个 DC 的接入点列表，每一项就是一个 IP 加一个端口。文档特别提醒这些 IP 和端口可能频繁变化，并说明每个 DC 通常至少有一个 IPv4 和一个 IPv6 接入点。客户端首次启动时使用程序内置的地址，之后按服务器下发的配置更新。

也就是说，日常收发消息时，Telegram 直接拿 IP 建立 TCP 连接，中间没有「查询域名」这一步。只有在常规连接都失败时，客户端才会动用备用渠道拉取最新地址：从 TDLib 和 Telegram Desktop（`special_config_request.cpp`）的源码可以看到，它们会通过 DNS over HTTPS 查询 TXT 记录、从云服务读取备用配置等，这些请求才用到域名。

这带来两个直接后果：

1. **域名规则管不到 Telegram 客户端**。代理客户端看到的目标是 `149.154.x.x:443` 这样的 IP，`DOMAIN-SUFFIX`、`GEOSITE` 规则都不会命中，去向由 IP 类规则或兜底规则决定。
2. **流量能不能进入代理客户端，取决于平台和工作模式**。桌面版有自己的代理选项，手机端基本只认 VPN 模式或应用内代理，下一节逐一说明。

### 状态栏上的几种提示

| 提示（英文界面） | 常见中文译法 | 含义 |
|----------------|-------------|------|
| Waiting for network... | 等待网络… | 系统报告当前没有可用网络，与代理无关 |
| Connecting... | 连接中… | 正在尝试与数据中心建立连接，长时间停在这里说明连不上 |
| Connecting to proxy... | 正在连接代理… | Telegram 里启用了应用内代理，但连不上这个代理 |
| Updating... | 更新中… | 一般表示连接已建立，正在同步离线期间的消息；长时间停留多半是连接时断时续或太慢 |

以上是 Android 和 iOS 的提示文案，中文译法来自社区语言包，不同语言包的措辞可能略有差异。Telegram Desktop 没有其中的「等待网络」「正在连接代理」「更新中」：左下角只显示 Connecting...，连接失败后显示 Reconnect in N s...（旁边的 Try now 可立即重试），反复出现说明连不上数据中心或代理；代理列表里每一项则显示 online、checking…、not available 等状态。

> **法律提示**：在中国大陆，Telegram 无法直接连接。自行建立或使用非官方信道进行国际联网受相关法规约束，存在法律风险。本文只解释技术原理与排障思路，请自行了解并遵守所在地法律法规，以及 Telegram 和代理服务商的服务条款。

---

## 各平台：代理到底有没有生效

### Telegram Desktop：默认跟随系统代理

Telegram Desktop（Windows、macOS、Linux 通用的那个版本）的代理设置在 Settings → Advanced → Connection type，打开后有三个选项：

| 选项 | 行为 |
|------|------|
| Disable proxy | 不使用任何代理，**即使系统代理开着也直连** |
| Use system proxy settings | 读取操作系统的代理设置，这是默认值 |
| Use custom proxy | 使用下方列表里你自己添加的代理 |

源码中这一项的默认值就是「系统」。选中它时，程序调用 Qt 的系统代理机制，各平台读取的来源由 Qt 文档说明：

- **Windows**：通过 WinHTTP 读取，找不到时读取 Internet Explorer 的代理设置——代理客户端开启「系统代理」时写入的正是这里；
- **macOS**：读取系统网络设置，开了 SOCKS 代理就对所有连接使用 SOCKS，否则对 TCP 连接使用 HTTPS 代理；
- **其他系统**：依赖 libproxy（如果编译时启用）；没有 libproxy 时读环境变量。按 Qt 源码，对 Telegram 这类不带协议标签的 TCP 连接，Qt 先读 `all_proxy`，读不到再回退到 `http_proxy`，值可以写成 `http://`、`socks5://` 或 `socks5h://` 开头的地址。

所以在 Windows 和 macOS 上，「代理客户端开着系统代理，Telegram Desktop 保持默认」通常就能连上：Telegram 会把到 DC IP 的连接通过 HTTP CONNECT（或 SOCKS）交给本地端口。实际遇到的失败多半是下面几种：

- 曾经把连接类型改成了 Disable proxy，或者 Use custom proxy 里留着一个早已失效的代理；
- Linux 上从桌面菜单启动 Telegram，拿不到你在终端里设置的环境变量（原理见 [命令行与开发工具走代理](/posts/terminal-proxy/)），这时直接在 Telegram 里填自定义代理更可靠；
- 版本过旧：系统代理的处理在几个版本里改过。按官方更新日志，Linux 版曾在 4.15.5 测试版为排查崩溃临时停用系统代理、4.16.3 测试版恢复；Windows 版在 6.9.2（2026 年 6 月）修过系统代理的问题（Fix working with system proxy）。保持默认仍连不上时，先更新到最新版，再考虑改用自定义代理或 TUN。

### macOS 原生版

App Store 上还有一个原生的 Telegram for macOS，和 Telegram Desktop 是两个不同的程序，代理入口在 Settings → Data and Storage → Use Proxy。官方没有说明它是否跟随系统代理，连不上时直接在这里手动添加代理，或者改用 TUN 模式。

### 手机端：VPN 模式或应用内代理

Android 和 iOS 上的代理客户端几乎都通过系统 VPN 接口工作，效果等同桌面的 TUN 模式：开着时 Telegram 的流量会被整体接管，不需要在 Telegram 里另做设置。手机 Wi-Fi 设置里的「HTTP 代理」只对主动读取它的应用有效，而 Telegram 自己建立 TCP 连接，一般不受它影响。

手机端常见的两个坑：

- 代理客户端的「分应用代理」或「访问控制」把 Telegram 排除在外，或者只代理名单里的应用却漏了它；
- Telegram 里还启用着一个以前用过的代理，VPN 开着也绕不过去（见后文排障清单）。

### TUN 模式：覆盖面最完整

TUN 在网络层接管所有流量，Telegram 无论读不读系统代理都会被捕获，再由分流规则决定出口；要让通话依赖的 UDP 也稳定走代理，最可靠的也是 TUN（或手机的 VPN 模式）。两种模式的原理与取舍见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。开着 TUN 时，Telegram 里选 Disable proxy 或保持系统代理默认值都可以，只是不要再指向一个失效的代理。

| 平台 / 程序 | 是否默认走系统代理 | 建议 |
|------------|------------------|------|
| Telegram Desktop（Windows / macOS） | 是 | 开系统代理或 TUN，Telegram 保持默认 |
| Telegram Desktop（Linux） | 取决于 libproxy 或环境变量（`all_proxy`、`http_proxy`） | 在 Telegram 里填自定义代理，或用 TUN |
| Telegram for macOS（原生版） | 官方未说明 | 应用内手动添加，或用 TUN |
| Android / iOS | 不适用 | 代理客户端开 VPN 模式；没有代理客户端时才用应用内代理 |

---

## 应用内代理：入口、类型与填法

### 各平台入口

以下路径来自 Telegram 官方的代理说明页：

| 客户端 | 路径（英文界面） |
|--------|-----------------|
| Android | Settings → Data and Storage → Proxy Settings（页面底部） |
| iOS | Settings → Data and Storage → Proxy（页面底部） |
| Telegram Desktop | Settings → Advanced → Connection type |
| macOS 原生版 | Settings → Data and Storage → Use Proxy |

使用中文语言包时，名称会变成「数据与存储」「代理设置」之类，以实际界面为准。连上代理后，对话列表顶部会出现一个盾牌图标，点它可以直接回到代理设置。列表里有多个代理时，可以打开 Auto-switch proxies，当前代理断开时自动切换到下一个。

### SOCKS5、HTTP、MTProto 与 WEB 有什么区别

| 类型 | 需要填写 | 哪些客户端支持 | 特点 |
|------|---------|--------------|------|
| SOCKS5 | 服务器、端口，可选用户名和密码 | 各平台官方客户端 | 通用代理协议，本身不加密、不伪装 |
| HTTP | 服务器、端口，可选认证 | Telegram Desktop | 通过 HTTP CONNECT 建立隧道 |
| MTProto | 服务器、端口、secret | 各平台官方客户端 | 专为 Telegram 设计，带传输混淆，只能代理 Telegram |
| WEB | 代理网页的主机名（Desktop 要求端口 443，可带路径）、16 字节 MTProxy secret（不支持 ee 形式） | Telegram Desktop 7.1（2026 年 8 月）起；Android 文案标注为概念验证；iOS 源码中也已出现 | 在后台运行代理提供方的网页来转发 Telegram 流量；添加时客户端提示只在信任提供方时使用，也可能展示赞助频道 |

WEB 是最新加入的类型（Desktop 7.1.2 起添加时会弹出风险警告），机制和风险都与前三种不同，本文不展开；遇到来路不明的 WEB 代理链接，按下文公共代理的风险从严对待。

无论选哪种，消息本身都由 MTProto 在客户端与 Telegram 服务器之间加密，代理读不到内容。区别在于流量在路上的样子：SOCKS5 的握手是明文协议，连接目标又是众所周知的 Telegram IP，所以直接连接境外的 SOCKS5 服务器在大陆几乎行不通。它真正的用处是连接**本机**的代理客户端，由代理客户端负责加密和伪装。

### 把本机代理客户端的端口填进 Telegram

适用场景：桌面端不想开系统代理或 TUN、Linux 桌面、macOS 原生版。

1. **找到本地端口**。mihomo 系客户端用 `mixed-port`，Clash Verge Rev 当前默认 7897，v2rayN 默认 10808（7.3.0 之前的版本 10808 只接受 SOCKS，HTTP 在 10809），以客户端界面显示为准；各客户端端口在哪里看，见 [命令行与开发工具走代理](/posts/terminal-proxy/) 的端口表。
2. **添加代理**。类型选 SOCKS5（Telegram Desktop 也可以选 HTTP，这时确认填的是 mixed 端口或 HTTP 端口），服务器填 `127.0.0.1`，端口填上一步的数字。用户名和密码留空，除非你在代理客户端里开启了认证。
3. **保存并选中**。代理列表里显示 online 或已连接即可。
4. **回到代理客户端核对**。在连接面板里应该能看到目标为 Telegram IP 的连接，确认它命中的规则和出口节点。

mixed 端口同时接受 SOCKS5 和 HTTP，而 Telegram 交给代理的本来就是 IP，不存在本地解析域名的问题。要注意的是：代理客户端一旦退出，Telegram 就会一直连不上（手机端显示「正在连接代理」，桌面版反复显示 Reconnect in N s...），所以退出前要么停用应用内代理，要么改回系统代理设置。手机上代理客户端开着 VPN 时，没有必要再这样设置。

### 代理链接

Telegram 支持一键导入代理的链接，常见格式如下（服务器、端口等是占位符）：

```text
tg://proxy?server=服务器&port=端口&secret=SECRET
https://t.me/proxy?server=服务器&port=端口&secret=SECRET
https://t.me/socks?server=服务器&port=端口&user=用户名&pass=密码
```

点击后客户端会弹出确认框，显示服务器和端口；MTProto 代理还会提示它可能展示赞助频道。按下 Connect Proxy 后，代理会加入列表并**立即启用**，从这一刻起运营方就能看到你的 IP。确认框里的 Check Status 会先测一次连通性，客户端会提示这样做会把你的 IP 暴露给代理管理员——测试本身就是连到对方服务器上去。

还有两处容易忽略的自动连接：

- **打开代理设置页时的自动测速**。从源码看，Telegram Desktop 和 Android 每次打开代理设置页，都会自动测试列表里保存的所有代理（Android 对同一代理两分钟内不重复测），事先不弹任何警告。所以不信任的代理只停用还不够，要直接删除。
- **Auto-switch proxies**。开启后，本机代理客户端一旦断开，Telegram 可能自动切换到列表里的其他代理，包括你以前加过的公共代理。

### 通话与应用内代理

语音和视频通话使用单独的媒体连接（以 UDP 为主），和收发消息的 MTProto 连接是两回事。MTProto 代理不承载通话。SOCKS5 代理能不能承载通话，各平台不一样：

| 客户端 | 应用内代理能否承载通话 |
|-------|---------------------|
| iOS | 代理设置里有 Use for calls 开关，源码中开启后会把 SOCKS5 代理交给通话模块（注释写明通话只支持 SOCKS5） |
| macOS 原生版 | 代理设置里也有 Use for Calls 开关 |
| Telegram Desktop | 界面文案里有 Use proxy for calls，但当前源码中判断代理能否用于通话的函数直接返回否 |
| Android | 当前版本没有这个选项 |

想让通话稳定走代理，最可靠的是 TUN 或手机的 VPN 模式，并确认节点和协议支持 UDP 转发。另外，点对点通话会让对方看到你的 IP，设置方法见后文隐私一节。

---

## MTProxy：原理、secret 与 FakeTLS

### 它是什么

MTProxy 是 Telegram 官方开源的 MTProto 代理（C 语言实现，仓库为 TelegramMessenger/MTProxy），只转发 Telegram 客户端的流量，不能当通用代理用。可以把它的保护分成两层理解：

- **里层：MTProto 加密**。客户端与 Telegram 服务器之间协商密钥，代理拿不到，转发时看到的始终是密文；
- **外层：传输混淆**。按官方传输文档，客户端在 TCP 连接开头发送 64 字节随机初始化数据，从中派生 AES-256-CTR 的密钥和 IV；经过 MTProxy 时，这些密钥材料还要与 secret 拼接后再取 SHA256。不知道 secret 的人解不开外层，也就难以确认这是一条 Telegram 连接。

### secret 的三种形态

secret 本体是 16 字节，通常写成 32 位十六进制。前面加的前缀决定客户端使用哪种传输方式：

| 形态 | 写法 | 含义 |
|------|------|------|
| 普通 | 32 位十六进制 | 混淆传输，不处理包长特征 |
| dd | `dd` 加 32 位十六进制 | 改用 padded intermediate 传输，每个包附加 0 到 15 字节随机填充 |
| ee | `ee` 加 32 位十六进制，再接域名的十六进制编码 | FakeTLS：连接开头模拟一次 TLS 握手，域名用作 SNI |

几点补充：

- **dd 的来由**：MTProxy 的 README 解释说，有些运营商靠数据包大小识别 MTProxy，所以引入随机填充；填充只对主动请求的客户端生效，方法就是在 secret 前加 `dd`。
- **ee 的格式**：在 TDLib 的源码里，以 `0xee` 开头即启用 TLS 模拟，第 17 字节之后的部分就是伪装域名，长度上限为 182 字节。ee 类 secret 在链接里也常以 base64url 编码出现，看起来是一长串以 7 开头的字符，客户端两种写法都认。
- **服务端支持**：官方 MTProxy 用 `-D 域名` 参数开启 FakeTLS，参数说明写明启用后会禁用其他传输方式；只要同时用了 worker 进程（`-M` 参数，README 示例里的 `-M 1` 也算），程序就会提示 TLS 模式下不建议使用 worker，参数说明给出的理由是更好地防重放。第三方实现 mtg 的 v2 版本只支持 FakeTLS，它的示例配置注释明确说普通与 dd 模式被禁止。

### 从抗检测角度看

- **普通与 dd 模式**：流量从第一个字节起就是随机数据（官方传输文档还要求 64 字节初始化数据的开头避开 HTTP 方法名、`0xeeeeeeee`、`0xdddddddd` 等固定值）。USENIX Security 2023 的论文测到，GFW 在 2021 年 11 月至 2023 年 3 月间运行过一套按「看起来完全随机」被动识别全加密流量的系统：它只看客户端发出的第一个 TCP 数据包，只针对部分热门 VPS 网段，命中后按约 26% 的概率封锁。论文点名的是 Shadowsocks、VMess、obfs4 等协议。作者 2023 年 3 月 15 日的跟进测试显示，这套动态封锁已经停止，之后没有公开测量证实它重新启用。MTProxy 的这两种模式在形态上属于同一类，同类规则一旦重新启用，也会被覆盖——这是推论，论文没有点名 MTProxy。详见 [GFW 如何识别全加密流量](/posts/fully-encrypted-detection/)。
- **FakeTLS**：连接以 SNI 为伪装域名的 TLS ClientHello 开头，正好落在全加密检测对 TLS 的豁免范围内。它和 [ShadowTLS](/posts/ss2022-shadowtls/) 不同，不会与真实网站完成握手：对持有 secret 的客户端，ServerHello 和随后几条记录都由代理自己生成，客户端用 secret 校验其中的 HMAC；官方 MTProxy 会参照伪装域名的真实响应来模仿这些记录的长度。mtg 的配置注释提到有些国家会对 Telegram 连接做主动探测，因此它实现了防重放缓存、握手时间戳校验，以及校验失败时把连接转给真实网站的 domain fronting。伪装 TLS 能否经得起检测取决于实现细节，没有一劳永逸的方案。

### 自建的大致流程

以下命令按官方仓库 README 整理（Debian / Ubuntu，以 root 运行，或在命令前加 sudo）：

```bash
# 安装依赖并编译，产物在 objs/bin/mtproto-proxy
apt install git curl build-essential libssl-dev zlib1g-dev
git clone https://github.com/TelegramMessenger/MTProxy
cd MTProxy && make && cd objs/bin

# 获取与 Telegram 服务器通信所需的密钥和配置（README 建议配置每天更新一次）
curl -s https://core.telegram.org/getProxySecret -o proxy-secret
curl -s https://core.telegram.org/getProxyConfig -o proxy-multi.conf

# 生成给用户使用的 16 字节 secret（32 位十六进制）
# README 用的是 xxd -ps；较新的 Debian / Ubuntu 上 xxd 是单独的包，精简镜像可能没有，这里改用 coreutils 自带的 od
head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; echo

# 启动：-H 是客户端连接的端口，-p 是只能从本机访问的统计端口
./mtproto-proxy -u nobody -p 8888 -H 443 -S 你的SECRET --aes-pwd proxy-secret proxy-multi.conf -M 1
```

上面原样启动得到的是普通模式（客户端可以在 secret 前加 `dd` 使用随机填充）。按前文的分析，更建议启用 FakeTLS：

```bash
# -D 填一个服务器能正常访问的 HTTPS 网站域名；启用后其他传输方式会被禁用
# 源码提示 TLS 模式下不建议使用 worker 进程，因此去掉 -M 1
./mtproto-proxy -u nobody -p 8888 -H 443 -S 你的SECRET -D www.example.com --aes-pwd proxy-secret proxy-multi.conf

# 发给客户端的 secret = ee + 你的SECRET + 域名的十六进制编码
echo "ee你的SECRET$(printf '%s' www.example.com | od -An -tx1 | tr -d ' \n')"
```

服务端 `-S` 仍然填原始的 32 位 secret，`ee` 前缀和域名只出现在发给客户端的链接里。`www.example.com` 只是占位，伪装域名怎么挑可以参考 [如何选择 SNI 伪装目标](/posts/sni-target-selection/) 的思路。

几点现实情况：

- **官方镜像过时**：README 自己写明官方 Docker 镜像已经过时（Docker Hub 上 `latest` 标签最后推送于 2020 年 2 月），官方代理说明页却仍在推荐用它一键部署。
- **长期停更后才有修复**：仓库在 2019 年 10 月到 2025 年 11 月之间没有任何提交，2025 年 11 月和 2026 年 8 月各出现过一批修复。其中 2025 年 11 月的一项修复针对 FakeTLS 下较长的 ClientHello：此前的版本只接受记录长度在 512 到 767 字节之间的握手，而按 TDLib 源码，当前客户端模拟的 ClientHello 带有 ML-KEM-768 密钥份额，单这一项就有 1184 字节。所以要用 `-D` 开启 FakeTLS，请从最新源码编译，不要沿用旧的二进制或镜像。
- **第三方实现**：也可以选择 mtg 等第三方实现，使用前同样自行查看项目的最新状态。

无论哪种实现，VPS 选择、防火墙和日常维护都和自建其他代理一样，可参考 [自建代理完整指南](/posts/self-hosting-guide/)。在 Telegram 里找 @MTProxybot 注册代理会得到一个 proxy tag（启动时用 `-P` 传入），用于查看统计和设置赞助频道，属于可选项。

---

## 公共 MTProxy：运营方能看到什么

群组和网页上流传着大量「免费 MTProxy」。用之前先弄清楚运营方的视角，以下内容以 Telegram 官方代理说明页为准：

| 运营方 | 内容 |
|-------|------|
| 能看到、能记录 | 你的 IP 地址；连接的时间；你在使用 Telegram 这件事本身 |
| 看不到 | 你的消息内容；Telegram 用户名和账号 ID；对话列表和你在 Telegram 里的活动 |

也就是说，MTProxy 运营方掌握的是元数据，而不是内容。它也不会改变 Telegram 服务器本身能看到什么。

### 赞助频道是怎么来的

连上某些 MTProxy 后，对话列表顶部会多出一个陌生频道。机制如下：

1. 运营方在 @MTProxybot 注册代理，拿到 proxy tag，启动时传给 MTProxy，这个 tag 会随转发的请求一起交给 Telegram 服务器；
2. 客户端每次建立新的 MTProxy 连接时，会向服务器请求推广数据（`help.getPromoData`）；如果该代理关联了频道，服务器就把它下发给客户端；
3. 客户端把这个频道固定在对话列表顶部。

官方客户端对此的说明是：这个频道由你的代理服务器展示，想移除它，在设置里停用代理即可；添加 MTProto 代理时也会提示，它可能展示赞助频道，但这不会泄露你的任何 Telegram 流量。换句话说，频道由 Telegram 服务器下发，不是代理往你的流量里注入内容，它的出现也不代表运营方能看到你的账号。不过频道内容由运营方挑选，可能是广告、引流甚至诈骗，按陌生频道对待即可。

### 风险清单

- **元数据**：IP 加连接时间，和其他数据结合后可能被用来关联身份；
- **可用性**：公共代理被大量转发，往往拥挤且寿命很短；
- **来源不明**：你无从知道运营者是谁、是否记录日志。不要因为某个代理链接附带的说明去下载其他软件，或者在陌生网页上登录 Telegram 账号；
- **测速也会暴露 IP**：确认框里的「检查状态」和打开代理设置页时的自动测速，都会去连接对方服务器。用不上的公共代理直接从列表删除，只停用不够；
- **WEB 类型代理**：它会在后台加载提供方的网页，信任要求比普通 MTProxy 更高，来路不明的不要添加。

能用自己的代理客户端时，没必要依赖公共 MTProxy；确实要用，就把它当作不可信的基础设施。

---

## 分流规则：让 Telegram 的 IP 走对出口

### 先判断需不需要专门的规则

- **白名单模式**（国内直连，其余 `MATCH` 到代理）：Telegram 的 IP 不属于 CN，会落到 `MATCH`，默认就走代理。专门写规则的意义在于把它分到指定的节点组。
- **黑名单或 GFWList 模式**（只代理名单内的，其余直连）：名单如果只有域名，Telegram 客户端的 IP 连接会全部直连，结果就是一直「连接中」。这是规则层面最常见的原因。
- **想让 Telegram 固定走某个地区或某个稳定节点**：同样需要专门的规则。

分流规则的基本概念见 [什么是分流规则](/posts/what-are-rules/)。

### 域名部分：GEOSITE,telegram

网页版、`t.me` 链接、Telegraph 文章等走的是域名，用 `GEOSITE,telegram` 即可。v2fly 的 domain-list-community 中这一类目前收录了 `telegram.org`、`t.me`、`telegram.me`、`telegra.ph`、`telesco.pe`、`cdn-telegram.org` 等二十来个域名，也包括 TON、Fragment 相关的域名；mihomo 常用的 GeoSite 数据来自这个项目或其衍生版本。GeoSite 的机制见 [GeoIP / GeoSite 数据库](/posts/geoip-geosite/)。

### IP 部分：用官方列表，不要手抄

Telegram 在 [core.telegram.org/resources/cidr.txt](https://core.telegram.org/resources/cidr.txt) 公布了自己的 IP 段：纯文本，每行一个 CIDR，同时包含 IPv4 和 IPv6。本文写作时（2026 年 10 月）文件里有 9 个 IPv4 段和 5 个 IPv6 段，例如 `149.154.160.0/20`、`91.108.4.0/22`——这只是举例，请以官方文件的实时内容为准。

想自己看一眼（这个域名在大陆同样需要经代理访问；下面用的 7897 是 Clash Verge Rev 的默认端口，换成你自己的）：

```bash
curl -s -x http://127.0.0.1:7897 https://core.telegram.org/resources/cidr.txt
```

Windows PowerShell 里把 `curl` 写成 `curl.exe`，参数相同。

### 方法一：rule-provider 直接引用官方文件

mihomo 的 rule-provider 支持 `behavior: ipcidr` 加 `format: text`，格式正好和官方文件吻合，还能定时自动更新：

```yaml
rule-providers:
  telegram-ip:
    type: http
    behavior: ipcidr
    format: text
    url: "https://core.telegram.org/resources/cidr.txt"
    path: ./ruleset/telegram-ip.txt
    interval: 86400      # 每天更新一次
    proxy: Proxy         # 经由哪个策略组下载，换成你配置里实际存在的组名

rules:
  - GEOSITE,telegram,Telegram
  - RULE-SET,telegram-ip,Telegram,no-resolve
  # ……其他规则
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

要点：

- **proxy 字段建议写上**：mihomo 没有指定 `proxy` 时，规则集的下载请求会作为内部连接按规则分流。如果 `core.telegram.org` 被分到 `DIRECT`（比如黑名单模式，又没有 `GEOSITE,telegram`），下载就会失败，规则集为空，Telegram 的连接会落到后面的规则。显式指定 `proxy` 可以绕开规则的影响；
- **Telegram 是策略组名**：需要在 `proxy-groups` 里定义，或者直接改成已有的组名；
- **顺序**：放在 `GEOIP,CN` 和 `MATCH` 之前，越靠前越优先。

用 Clash Verge Rev 加载订阅时，不要直接改订阅文件——订阅一更新就会被覆盖。改用覆写脚本注入（原理见 [如何自定义规则](/posts/custom-rules/)）：

```javascript
function main(config) {
  config["rule-providers"] = config["rule-providers"] || {};
  config["rule-providers"]["telegram-ip"] = {
    type: "http",
    behavior: "ipcidr",
    format: "text",
    url: "https://core.telegram.org/resources/cidr.txt",
    path: "./ruleset/telegram-ip.txt",
    interval: 86400,
    proxy: "Proxy",
  };
  // "Proxy" 换成订阅里实际存在的策略组名
  config.rules = [
    "GEOSITE,telegram,Proxy",
    "RULE-SET,telegram-ip,Proxy,no-resolve",
    ...(config.rules || []),
  ];
  return config;
}
```

rule-provider 各参数的含义见 [Clash 规则集详解](/posts/clash-rule-providers/)。

### 方法二：生成静态规则

不方便使用 rule-provider 的场景，可以把官方文件转换成规则行，再粘贴进配置的 `rules:` 段：

```bash
curl -s -x http://127.0.0.1:7897 https://core.telegram.org/resources/cidr.txt \
  | tr -d '\r' \
  | awk 'NF { t = index($0, ":") ? "IP-CIDR6" : "IP-CIDR"; print "  - " t "," $0 ",Telegram,no-resolve" }'
```

```powershell
$cidr = curl.exe -s -x http://127.0.0.1:7897 https://core.telegram.org/resources/cidr.txt
$cidr | Where-Object { $_.Trim() } | ForEach-Object {
    $c = $_.Trim()
    $t = if ($c.Contains(':')) { 'IP-CIDR6' } else { 'IP-CIDR' }
    "  - $t,$c,Telegram,no-resolve"
}
```

输出形如 `- IP-CIDR,149.154.160.0/20,Telegram,no-resolve`。在 mihomo 里 `IP-CIDR6` 只是 `IP-CIDR` 的别名，两者效果相同；分开写是为了兼容 Surge、Shadowrocket 等要求区分的客户端。静态规则不会自动更新，隔一段时间要重新生成一次。

### 方法三：第三方规则集

Loyalsoldier/clash-rules 的 `telegramcidr.txt`、MetaCubeX/meta-rules-dat 的 `geoip/telegram` 都提供现成的 Telegram IP 规则集，自动更新、接入方便，对比见 [常用规则集推荐与对比](/posts/popular-rulesets/)。需要知道的是，它们不是官方文件的原样副本：对照本文写作时的内容，这两份列表把部分相邻网段合并成了更大的段，还多出一个官方列表里没有的 `95.161.64.0/20`。多出来的网段不一定有错，可能来自路由公告等其他来源，只是数据来源不同。

接入时还要注意格式：Loyalsoldier 的 `telegramcidr.txt` 虽然扩展名是 `.txt`，内容却是 YAML（以 `payload:` 开头的列表），按它的 README 不写 `format`（默认按 yaml 解析）即可，不能照搬方法一的 `format: text`，否则这些行会被原样当成规则，规则集实际为空。MetaCubeX 的 `geo/geoip/telegram.list` 是每行一个 CIDR 的纯文本，可以用 `format: text`；`.mrs` 版本则写 `format: mrs`。引用时同样加 `no-resolve`。

### no-resolve 是什么意思

mihomo 文档的解释是：当一个目标为域名的请求开始匹配 IP 类规则时，mihomo 会先触发一次 DNS 解析，用解析出的 IP 判断是否命中；加上 `no-resolve` 就跳过这次解析，域名请求直接视为不匹配，继续往下走。文档还补充：如果更早的规则已经触发过解析，带 `no-resolve` 的 IP 规则照样会用那次的结果来匹配。

放到 Telegram 身上：

- 客户端本来就是按 IP 连接，加了 `no-resolve` 也不会漏匹配；
- 不加的话，每个走到这条规则的域名请求（包括你访问的普通网站）都要先由 mihomo 用配置里的 `nameserver`（或 `nameserver-policy`）解析一次；没有启用 `dns` 模块时，交给系统 DNS。这既徒增延迟，配置的又多是国内 DNS，等于把这些域名的访问记录发给了它。开启 fake-ip 也一样：fake-ip 只是让应用拿到假地址，规则匹配到不带 `no-resolve` 的 IP 类规则时，内核仍会解析一次。规则越靠前，影响面越大。

mihomo 源码中 `RULE-SET` 同样接受 `no-resolve` 参数，ipcidr 类规则集建议都加上。

### sing-box 与其他客户端

sing-box 的规则集用 JSON「源格式」，可以把官方文件转换后作为本地规则集引用：

```bash
# 先把官方文件保存为 cidr.txt，再转换成 sing-box 的源格式
python3 -c 'import json; c=[l.strip() for l in open("cidr.txt") if l.strip()]; json.dump({"version": 1, "rules": [{"ip_cidr": c}]}, open("telegram-ip.json", "w"), indent=2)'
```

```json
{
  "route": {
    "rule_set": [
      {
        "tag": "telegram-ip",
        "type": "local",
        "format": "source",
        "path": "telegram-ip.json"
      }
    ],
    "rules": [
      {
        "rule_set": "telegram-ip",
        "outbound": "proxy"
      }
    ]
  }
}
```

源格式的 `version` 1 从 sing-box 1.8.0 起支持，只用到 `ip_cidr` 时写 1 兼容面最广；`outbound` 换成你实际的出站标签。sing-box 的路由模型与 Clash 有差异，见 [Sing-box 的路由规则与 Clash 规则的区别](/posts/singbox-vs-clash-rules/)。Surge、Shadowrocket 的写法与上面的静态规则类似（`IP-CIDR,网段,策略,no-resolve`），具体语法以各自文档为准。

### 按进程分流：补充而非替代

mihomo 的规则文档里就有 `PROCESS-NAME-WILDCARD,*telegram*,PROXY` 这样的示例，桌面端可以按进程名把 Telegram 整体分到某个组。注意 `PROCESS-NAME-WILDCARD` 是 mihomo v1.19.19（2026 年 1 月）才加入的规则类型，客户端内置的旧内核遇到它可能整份配置都加载失败；旧内核可以按平台写 `PROCESS-NAME`，例如 Windows 上写 `PROCESS-NAME,Telegram.exe,组名`，进程名以连接面板里显示的为准。

按进程分流只对本机发起的连接有效，在路由器、旁路由上不起作用，还依赖 `find-process-mode` 没有被关闭。建议作为 IP 规则的补充。

### 怎样确认规则生效

打开代理客户端的连接面板，在 Telegram 里发一条消息或刷新对话，找目标为 `149.154.*`、`91.108.*` 或 `2001:b28:*` 这类地址的连接：

- 规则一栏应显示 RuleSet（telegram-ip）或 IPCIDR（149.154.160.0/20）一类内容。mihomo 上报的规则类型写作 `RuleSet`、`IPCIDR`、`Match`，规则内容单独给出，具体怎么拼在一起显示因面板而异，不会照搬配置文件里的写法；
- 链路一栏应是预期的节点组和节点；
- 如果显示 `Match` 并走了 `DIRECT`，或命中了别的规则，说明 IP 规则没生效，先到客户端的规则集页面看看 `telegram-ip` 是否下载成功、条目数是否为零。

---

## 排障清单

### 按顺序排查

1. **代理本身是否可用**：用浏览器打开境外网站。不行的话问题不在 Telegram，按 [节点连不上？系统排查流程](/posts/connectivity-checklist/) 处理。
2. **Telegram 里的代理设置**：确认没有指向失效的代理，桌面版的连接类型不是 Disable proxy。
3. **流量是否进入代理客户端**：连接面板里有没有 Telegram IP 的连接。没有的话，检查系统代理、TUN 或手机端的分应用设置。
4. **命中的规则与出口**：见上一节的验证方法。
5. **换节点、换协议**：排除单个节点的问题。
6. **专项问题**：媒体、通话、IPv6、时间，见下表。

### 常见现象对照

| 现象 | 常见原因 | 处理 |
|------|---------|------|
| 浏览器正常，桌面版一直「连接中」 | 连接类型被设为 Disable proxy；或 Telegram 的 IP 连接命中了直连 | 改回 Use system proxy settings 或开 TUN；在连接面板查看命中的规则 |
| 一直「正在连接代理」（手机端；桌面版表现为反复 Reconnect in N s...） | 应用内代理失效：端口填错、代理客户端已退出、公共代理挂了 | 核对端口；停用或删除失效代理 |
| 开着 TUN 仍连不上，应用内配了 MTProxy | Telegram 先去连 MTProxy 服务器，该服务器被封，或其 IP 被规则判为直连 | 用 TUN 时停用应用内代理 |
| 只有手机连不上 | VPN 没开，或分应用代理把 Telegram 排除在外 | 检查代理客户端的分应用设置 |
| 黑名单模式下只有 Telegram 不通 | 名单里只有域名，没有 Telegram IP 段 | 按上文加入 IP 规则 |
| 写了规则仍走直连 | 规则集下载失败（下载请求被规则分到直连，或 `proxy` 指向的策略组不可用）；第三方规则集的 `format` 写错；规则放在了 `MATCH` 之后 | 查看规则集更新状态和条目数；调整顺序 |
| 有 IPv6 的网络里时好时坏 | IPv6 连接没进代理，或节点没有 IPv6 出口 | 让代理客户端接管 IPv6 并选支持 IPv6 的节点；或在桌面版取消 Try connecting through IPv6 |
| 别人能用的 FakeTLS 代理你连不上 | secret 抄错或不完整；代理的 IP 或端口在你所在的网络被封；新装客户端还没和服务器对过时，本机时间偏差超出服务端容差（mtg 默认只有 3 秒） | 重新复制完整链接；换网络测试；开启系统自动对时 |
| 文字正常，图片和视频一直转圈 | 媒体在别的 DC 或 CDN 节点上，连接命中了不同的规则；节点带宽不足 | 在连接面板找对应连接看规则；换节点 |
| 长时间停在「更新中」（手机端） | 连接不稳定、丢包；离线太久，需要同步的更新很多 | 换节点；稍等同步完成 |
| 通话打不通或没有声音 | 通话依赖 UDP；MTProto 代理不承载通话，Desktop 和 Android 的应用内代理也不承载；节点不支持 UDP | 用 TUN 或 VPN 模式，并选支持 UDP 的节点（iOS 使用 SOCKS5 代理时可打开 Use for calls） |

### 时间不同步：问题常在代理这一环

MTProto 自己能处理时钟偏差：官方文档说明，当服务器因消息 ID 的时间过早或过晚而拒绝时，客户端会更新它与服务器的时间差，然后重发。所以本机时间不准，通常不会直接让 Telegram 协议失败，出问题的往往是代理这一环：

- **FakeTLS 的 MTProxy** 会校验握手里的时间戳，容差只有秒级：mtg 的示例配置写明 `tolerate-time-skewness` 默认 3 秒；官方 MTProxy 拒绝比服务器时间快 3 秒以上的握手。不过官方客户端写入的是与 Telegram 服务器校准过的时间，通常只有新装、还没和服务器对过时的客户端才会受本机时钟影响；
- **VMess** 要求系统 UTC 时间误差在 90 秒（V2Fly 文档）或 120 秒（Xray 文档）以内，Shadowsocks 2022 只容忍 30 秒；
- **TLS 证书校验**也依赖大致正确的时间。

手机和电脑都打开自动对时即可。

### 媒体下载慢：先分清是哪一段慢

- **文件存放在不同的 DC**：按官方文档，文件要从它所在的 DC 下载，客户端会因此连接其他 DC，有些 DC 只承担文件传输。这些连接的目标 IP 与收发消息的不同，可能命中不同的规则。
- **CDN 节点**：对于成员超过 10 万的公开频道，热门文件可能从 Telegram 的 CDN 节点下载。官方说这些节点设在 Telegram 流量大、但不便部署主服务器的地区，文件经过加密，CDN 本身拿不到明文。官方没有说明 CDN 节点的地址是否都在 `cidr.txt` 里，遇到「文字正常、媒体卡住」时，直接在连接面板里找这些连接，看它们命中了哪条规则。
- **账号层面的速度**：官方在 2022 年发布 Premium 时说明，Premium 用户可以用最快的速度下载媒体和文件。普通账号的具体速度官方没有公布，但这说明下载慢不一定是代理的问题。
- **节点本身**：带宽、晚高峰拥堵、线路质量，见 [速度慢的常见原因与优化思路](/posts/speed-optimization/)。

IPv6 的基础知识见 [IPv4 与 IPv6 基础](/posts/ipv4-vs-ipv6-basics/)；Windows 上开启 TUN 后的各类异常见 [TUN 模式不生效的常见原因](/posts/tun-not-working/)。

---

## 账号隐私与安全

代理解决的是「连得上」，账号安全要靠 Telegram 自己的设置。以下路径以英文界面为准。

### 手机号可见性

Settings → Privacy and Security → Phone Number 里有两项：

| 设置项 | 作用 | 建议 |
|-------|------|------|
| Who can see my phone number | 谁能在你的资料里看到手机号 | 设为 Nobody |
| Who can find me by my number（仅在上一项设为 Nobody 后出现，可选 Everybody 或 My Contacts） | 存了你号码的人能否据此找到你、看到号码 | 设为 My Contacts |

官方 FAQ 提醒：默认情况下，只有你通讯录里的联系人能看到你的号码，但只要对方知道你的号码并存进通讯录，就能在 Telegram 上看到它。把上一项设为 Nobody、这一项设为 My Contacts 后，客户端的说明是：存了你号码的人，只有本身也是你的联系人时才能看到号码。想让别人联系你又不暴露号码，可以设置用户名，通过用户名找到你的人看不到你的号码（除非隐私设置允许）。

### 两步验证与会话管理

- **两步验证**：Settings → Privacy and Security → Two-Step Verification。开启后登录需要短信验证码加密码，手机号被他人接管时也无法单凭验证码登录。建议设置恢复邮箱，并给这个邮箱本身也开启两步验证。
- **活跃会话**：Settings → Devices（或 Privacy and Security → Active Sessions），定期检查有没有不认识的设备，发现后立即终止。
- **验证码不外泄**：登录验证码和两步验证密码不要告诉任何人，包括自称 Telegram 官方或「代理客服」的人。

### 通话的点对点设置

Settings → Privacy and Security → Calls → Peer-to-peer 可以选择 Everybody、My Contacts 或 Nobody。官方客户端的说明是：关闭点对点后，所有通话都经 Telegram 服务器中转，避免暴露你的 IP，代价是通话质量可能略有下降。对陌生人建议关闭。

### 代理链接与客户端来源

- 不添加来路不明的代理链接，也不要随手对陌生代理「检查状态」；已经加进列表的不信任代理直接删除（原因见前文「代理链接」一节）；
- 带用户名密码的 SOCKS5 认证是明文传输的，不要在公共 SOCKS5 上复用其他地方的密码；
- 只从 telegram.org、官方应用商店或官方 GitHub 获取客户端。国家互联网应急中心（CNCERT）2026 年 5 月发布的银狐木马风险提示中，附件列出的仿冒下载站就有一批以 Telegram 为仿冒对象，警惕「中文版」「汉化版」安装包——界面汉化用 Telegram 自带的语言包机制即可，不需要另装修改版。下载与校验方法见 [代理客户端安全自查](/posts/client-safety-check/)；
- 代理运营方（包括机场）能看到哪些元数据，见 [代理能做什么、不能做什么](/posts/privacy-boundaries/)。

---

## 常见问题（FAQ）

### 开了 TUN，Telegram 里还要设置代理吗？

不需要。TUN 已经在网络层接管了 Telegram 的流量，Telegram 里选 Disable proxy 或保持默认的系统代理设置都可以。真正要避免的是应用内还启用着一个失效的代理，那样流量会先去连那个代理，TUN 也救不了。

### Telegram 里该填 SOCKS5 还是 HTTP？

连接本机代理客户端时两者都可以，mixed 端口同时支持（旧版 v2rayN 的 HTTP 端口是单独的 10809）。SOCKS5 在各平台官方客户端里都有，HTTP 类型只有 Telegram Desktop 提供。Telegram 交给代理的是 IP，不涉及域名解析，选哪种对分流结果没有影响。较新客户端里的 WEB 类型由提供方的网页转发流量，不能用来连本机端口。

### 已经有代理客户端了，还需要 MTProxy 吗？

一般不需要。代理客户端的协议有自己的加密和伪装，再叠一层 MTProxy 只会多一跳。MTProxy 适合的场景是：设备上不方便或不允许安装代理客户端，或者只想让 Telegram 一个应用走代理。

### 赞助频道能去掉吗？会泄露我的信息吗？

官方客户端的说明是：这个频道由代理服务器展示，在设置里停用该代理即可移除。频道由 Telegram 服务器根据代理注册的 tag 下发，客户端提示它不会泄露你的 Telegram 流量。运营方依然能看到你的 IP 和连接时间，这一点与是否有赞助频道无关。

### IP 规则不加 no-resolve 会怎样？

Telegram 本身照样能匹配，因为它直接按 IP 连接。问题出在其他流量：每个走到这条规则的域名请求都会先交给 mihomo 配置的 DNS 服务器解析一次（未启用 `dns` 模块时交给系统 DNS），增加延迟；配置的如果是国内 DNS，就等于把访问记录发给了它，开启 fake-ip 也不例外。对 Telegram 这类纯 IP 规则，加上 `no-resolve` 几乎只有好处。

### 网页版 web.telegram.org 能用，客户端却不行，为什么？

网页版走域名和 HTTPS，会被 `GEOSITE`、域名规则或浏览器的系统代理覆盖；客户端走 IP 直连，依赖 IP 规则和流量捕获方式。这个现象几乎可以断定是「客户端流量没进代理」或「IP 连接命中了直连」，按排障清单的第 2 到第 4 步检查。

### 为什么第三方规则集的 Telegram IP 段和官方不一样？

第三方规则集可能合并相邻网段，或者从路由公告等其他来源补充网段，更新时间也不同步。想与官方完全一致，就直接引用 `core.telegram.org/resources/cidr.txt`；图省事用第三方规则集也可以，只要知道两者的来源不同。

---

## 外部参考

- Telegram 官方文档：[代理说明（入口路径、运营方可见范围、赞助频道）](https://core.telegram.org/proxy)、[官方 IP 段列表 cidr.txt](https://core.telegram.org/resources/cidr.txt)、[MTProto 传输与混淆](https://core.telegram.org/mtproto/mtproto-transports)、[数据中心与接入点](https://core.telegram.org/api/datacenter)、[config 结构（dc_options 等字段）](https://core.telegram.org/constructor/config)、[CDN 数据中心](https://core.telegram.org/cdn)、[客户端配置与 MTProxy 赞助](https://core.telegram.org/api/config)、[help.getPromoData](https://core.telegram.org/method/help.getPromoData)、[时间同步相关服务消息](https://core.telegram.org/mtproto/service_messages_about_messages)、[Telegram FAQ](https://telegram.org/faq)、[Premium 发布说明](https://telegram.org/blog/700-million-and-premium)
- 源码：[TelegramMessenger/MTProxy](https://github.com/TelegramMessenger/MTProxy)、[MTProxy 参数定义 mtproto-proxy.c](https://github.com/TelegramMessenger/MTProxy/blob/master/mtproto/mtproto-proxy.c)、[TDLib ProxySecret.h](https://github.com/tdlib/td/blob/master/td/mtproto/ProxySecret.h)、[TDLib ConfigManager.cpp](https://github.com/tdlib/td/blob/master/td/telegram/ConfigManager.cpp)、[TDLib FakeTLS 握手 TlsInit.cpp](https://github.com/tdlib/td/blob/master/td/mtproto/TlsInit.cpp)、[Telegram Desktop 更新日志 changelog.txt](https://github.com/telegramdesktop/tdesktop/blob/dev/changelog.txt)、[Telegram Desktop 备用配置获取 special_config_request.cpp](https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/mtproto/special_config_request.cpp)、[Telegram Desktop 代理类型与通话判断 mtproto_proxy_data.cpp](https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/mtproto/mtproto_proxy_data.cpp)、[Telegram Desktop 代理设置与链接确认框 connection_box.cpp](https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/boxes/connection_box.cpp)、[Telegram Desktop 代理应用逻辑 sandbox.cpp](https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/core/sandbox.cpp)、[Telegram Desktop 代理默认值 core_settings_proxy.h](https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/core/core_settings_proxy.h)、[Telegram Android 界面文案 strings.xml](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/res/values/strings.xml)、[Telegram Android 代理列表 ProxyListActivity.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/ProxyListActivity.java)、[Telegram Android 隐私设置 PrivacyControlActivity.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/PrivacyControlActivity.java)、[Telegram iOS 通话代理 PresentationCallManager.swift](https://github.com/TelegramMessenger/Telegram-iOS/blob/master/submodules/TelegramCallsUI/Sources/PresentationCallManager.swift)、[mtg](https://github.com/9seconds/mtg)、[mtg 示例配置](https://github.com/9seconds/mtg/blob/master/example.config.toml)
- 系统代理：[Qt QNetworkProxyFactory](https://doc.qt.io/qt-6/qnetworkproxyfactory.html)、[Qt 环境变量代理实现 qnetworkproxy_generic.cpp](https://github.com/qt/qtbase/blob/dev/src/network/kernel/qnetworkproxy_generic.cpp)
- 分流规则：[mihomo 规则](https://wiki.metacubex.one/config/rules/)、[mihomo rule-providers](https://wiki.metacubex.one/config/rule-providers/)、[sing-box 规则集](https://sing-box.sagernet.org/configuration/rule-set/)、[sing-box 规则集源格式](https://sing-box.sagernet.org/configuration/rule-set/source-format/)、[v2fly domain-list-community：telegram](https://github.com/v2fly/domain-list-community/blob/master/data/telegram)、[Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)、[MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)、[mihomo v1.19.19 发布说明（PROCESS-NAME-WILDCARD）](https://github.com/MetaCubeX/mihomo/releases/tag/v1.19.19)
- 其他：[How the Great Firewall of China Detects and Blocks Fully Encrypted Traffic（USENIX Security 2023）](https://gfw.report/publications/usenixsecurity23/en/)、[该论文的工件附录（含 2023 年 3 月跟进测试）](https://www.usenix.org/system/files/usenixsecurity23-appendix-wu-mingshi.pdf)、[Xray VMess 出站配置](https://xtls.github.io/config/outbounds/vmess.html)、[V2Fly VMess 协议说明](https://www.v2fly.org/config/protocols/vmess.html)、[CNCERT 关于银狐木马仿冒下载站的风险提示（2026 年 5 月）](https://www.cert.org.cn/publish/main/10/2026/20260522113326926111046/20260522113326926111046_.html)

**站内相关文章**：

- [节点连不上？系统排查流程](/posts/connectivity-checklist/)
- [如何自定义规则：让特定网站走代理/直连/特定节点](/posts/custom-rules/)
- [Clash 规则集详解：rule-provider 是什么、怎么用](/posts/clash-rule-providers/)
- [代理能做什么、不能做什么（安全与隐私的边界）](/posts/privacy-boundaries/)
