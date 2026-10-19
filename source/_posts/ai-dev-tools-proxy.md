---
title: "AI 编程工具走代理：VS Code、Copilot、Cursor、Claude Code、JetBrains 的代理配置与排障"
date: 2026-10-19
updated: 2026-10-19
categories:
  - 进阶技巧
tags:
  - AI
  - Claude
  - 配置
  - 排障
  - TUN
  - 编程工具
excerpt: "浏览器能打开 AI 服务，编辑器里的 AI 插件却一直转圈或报证书错误？因为 IDE 的界面、扩展进程和命令行子进程各自读取代理。本文对照官方文档，逐一整理 VS Code、Copilot、Cursor、Claude Code、JetBrains 与 Codex CLI 的代理设置和常见报错排查。"
index_img: /images/posts/ai-dev-tools-proxy.svg
---

> **摘要**：浏览器里 AI 服务能正常打开，编辑器里的 Copilot、Cursor 或 Claude Code 却报连接失败、证书错误或回复中途断开——这是开发者使用 AI 编程工具时很常见的代理问题。根源在于一个 IDE 里同时跑着好几类进程：Electron 界面跟随系统代理，扩展宿主由编辑器打补丁接管，而插件拉起的命令行子进程往往只认环境变量。本文先讲清这几类进程，以及 HTTP/2、WebSocket、SSE 长连接对代理的要求，再对照官方文档逐一整理 VS Code、GitHub Copilot、Cursor、Claude Code、JetBrains IDE 和 Codex CLI 的代理设置。最后给出 TUN 与分流规则的通用方案、常见报错排查表和服务条款提示。

---

## 为什么浏览器能用，编辑器里的 AI 却报错

浏览器只有一个网络栈，开了系统代理就全部生效。AI 编程工具不一样：一个编辑器窗口背后通常有三四类进程，它们**各自决定**要不要走代理、从哪里读代理。

| 进程类型 | 典型例子 | 网络栈 | 代理从哪里来 |
|---------|---------|-------|------------|
| Electron 主进程与界面 | VS Code / Cursor 的窗口、登录页、扩展市场 | Chromium | 系统代理（含 PAC），或编辑器自身设置、启动参数 |
| 扩展宿主 | Copilot 等大多数扩展 | Node.js，被编辑器打了补丁 | 编辑器的代理设置 → 环境变量 → 向主进程询问 |
| 扩展拉起的子进程 | Claude Code 插件启动的 `claude`、语言服务器、本地 MCP 服务器 | 各自的运行时 | 通常只看环境变量或自己的配置文件 |
| 终端里的 CLI | `claude`、`codex`、Cursor CLI | 各自的运行时 | 终端里的环境变量与自身配置 |
| JetBrains IDE 本体 | IntelliJ IDEA、PyCharm 及其 AI Assistant | JVM | IDE 的 HTTP Proxy 设置 |

于是就有了这些典型现象：

- **窗口和登录页正常，AI 请求超时**：界面走 Chromium，跟着系统代理走通了；AI 请求发自扩展宿主或子进程，没拿到代理，直连被墙。
- **Copilot 能用，同一个窗口里的 Claude Code 插件连不上**：Copilot 跑在被 VS Code 接管的扩展宿主里；Claude Code 插件则会启动一个独立的 `claude` 进程，它只读环境变量和 `~/.claude/settings.json`，拿到哪些环境变量取决于平台和编辑器的启动方式。Windows 上从开始菜单启动时，只带系统级和用户级环境变量，PowerShell 配置文件或某个终端里临时设置的代理变量传不进来。macOS / Linux 上从程序坞或启动器打开时，VS Code 会先运行一次登录 shell 读取环境，写在 `~/.zshrc`、`~/.bashrc` 里 export 的代理变量（包括指向已关闭端口的旧值）也会传给 `claude`，只在某个终端里临时设置的则不会。
- **终端里 `claude` 正常，换个终端就不行**：环境变量只属于设置它的那个 shell，原理见 [命令行与开发工具走代理](/posts/terminal-proxy/)。

系统代理本质上只是一条「公告」，读不读由程序自己决定，两种接管方式的完整对比见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。

### 长连接：HTTP/2、WebSocket 与 SSE 对代理的要求

AI 工具的流量和普通网页不同：回复是一个字一个字「流」回来的，一次生成可能持续几十秒到几分钟。常见的三种承载方式：

| 方式 | 特点 | 谁在用（据官方文档） |
|------|------|------------------|
| SSE（Server-Sent Events） | 一个不结束的 HTTP 响应，服务端持续推送事件 | Claude Code 的流式回复；Cursor 在 HTTP/2 不可用时的回退方案 |
| HTTP/2 双向流 | 一条连接上多路复用，双方可同时持续发送 | Cursor 的对话与 Agent 默认方式 |
| WebSocket | 升级后的全双工长连接 | Codex 的 Responses API 传输方式之一；Claude Code 发往本机（localhost）的连接，以及 Claude in Chrome 扩展经 `bridge.claudeusercontent.com` 的桥接 |

对本机的 mihomo、sing-box 这类代理客户端来说，这三种方式都不是问题。客户端访问 HTTPS 地址时，先向本地代理发一个 `CONNECT 主机:443`，之后 TLS 握手在隧道里端到端完成，HTTP/2 也是在这个握手里由客户端和服务器协商出来的（ALPN），代理只负责搬运加密字节，看不到也不关心里面是什么协议。

真正出问题的是下面三种情况：

1. **工具自己的 HTTP/2 实现不支持代理**。Node.js 的 `http2` 模块没有「代理 Agent」这个概念，要走代理得由程序自己先建 CONNECT 隧道。哪个功能漏了这一步，它的请求就会绕过代理直连，表现为部分功能可用、部分功能超时。
2. **中间有解密 HTTPS 的代理**。公司的安全网关、杀毒软件的 HTTPS 扫描、Fiddler / Charles / mitmproxy 这类抓包工具会终止 TLS 再重新发起连接。它们可能不支持 HTTP/2 双向流，或者把 SSE 响应缓冲到结束才一次性转发。Cursor 官方文档点名 Zscaler 是存在这一限制的代理中最常见的一种，HTTP/1.1 + SSE 回退方案就是为这类代理准备的。
3. **长连接被中途掐断**。节点不稳定、中间设备的空闲超时，或者客户端在切换节点时主动断开旧连接，都会让一条正在输出的回复断掉。普通网页刷新一下就好，流式回复则会直接报错。

### 还有一层：出口地区

能连通不代表能用。多数 AI 服务按请求的出口 IP 判断地区，不在支持列表里就会返回 403 或「地区不可用」。如果同一个工具的不同域名被分流规则分到了不同出口（一部分走美国节点，一部分直连或走香港节点），就可能出现登录正常、调用失败这类不一致的现象。各服务的地区策略见 [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/)。

---

## 准备：统一使用 HTTP 协议的本地代理地址

所有配置都要填本机代理地址，端口在代理客户端里查看，确认方法见 [命令行与开发工具走代理](/posts/terminal-proxy/) 的「准备」一节。本文示例统一写 `http://127.0.0.1:7890`，请替换成你的实际端口。

为什么强调 `http://`：各工具对代理协议的支持差别很大，而 mihomo 的 mixed 端口同时接受 HTTP 与 SOCKS5，写 `http://` 能兼容的工具更多。

| 工具 | 读系统代理 | 读代理环境变量 | 自身设置 | 已知限制 |
|------|----------|--------------|---------|---------|
| VS Code 窗口 | 是（默认） | 启动时环境里的 `HTTPS_PROXY` 等 | `http.proxy` | SOCKS5 认证未实现 |
| GitHub Copilot | 跟随编辑器 | 编辑器未设代理时读取 | 编辑器的代理设置 | 不支持 `https://` 开头的代理地址 |
| Cursor CLI | 文档未提及 | `HTTP_PROXY`、`HTTPS_PROXY`，另需 `NODE_USE_ENV_PROXY=1` | `cli-config.json` | 代理不支持 HTTP/2 流时需切 HTTP/1.1 |
| Claude Code | 文档只列环境变量 | `HTTPS_PROXY`、`HTTP_PROXY`、`NO_PROXY` | `settings.json` 的 `env` | 不支持 SOCKS 代理 |
| JetBrains IDE | 是（默认自动检测） | 文档未提及 | HTTP Proxy 设置页 | 构建工具需单独配置 |
| Codex CLI | 官方未专门说明 | 官方稳定变量列表未列出 | — | 社区反馈 SOCKS5 不稳定 |

几条通用原则：

- **代理地址写 `http://`，不要写 `https://`**：本地 mixed 端口是明文代理，变量名里的 https 指的是「访问 https 网站时用的代理」。
- **设了代理变量，就在 `NO_PROXY` 里放上 `localhost,127.0.0.1,::1`**：AI 工具大量依赖本地通信（IDE 与 CLI 之间、本地 MCP 服务器），这些请求不该被送到代理。但只在同时设置了 `HTTPS_PROXY` 等代理变量时才这样做；依赖系统代理时，不要单独往系统环境变量里写一个全局 `NO_PROXY`，否则 VS Code 的窗口会改为直连（见下一节）。
- **不要为了「能用」关闭证书校验**：后文专门讨论。

---

## VS Code：窗口和扩展是两套逻辑

### 窗口：默认跟随系统代理

VS Code 官方网络文档说明，它使用与 Chromium 相同的代理支持，系统代理设置（包括 PAC）会被自动识别。从 VS Code 源码（`windowImpl.ts`）可以看到更具体的规则：

1. 用户设置里填了 `http.proxy`，或 VS Code 启动时的环境中带有 `HTTPS_PROXY` / `HTTP_PROXY`（大小写均可），就把这个地址设给窗口的网络会话；
2. 绕过列表取自 `http.noProxy`，没有则取 `NO_PROXY`，并自动加上本地地址；
3. 只有代理地址和绕过列表**都**没有设置时，窗口才保留系统代理（含 PAC）。

第 3 条有一个不太直观的后果（据 VS Code、Electron 与 Chromium 的源码推断）：只设了绕过列表（`http.noProxy`，或启动环境里有 `NO_PROXY`）而没有代理地址时，VS Code 仍会用空的代理地址调用 Electron 的 `setProxy`，而 Chromium 把空的固定代理当作直连处理，于是窗口改为直连，系统代理反而失效。扩展向主进程查询代理时用的也是这个网络会话，Copilot 等扩展会一起直连。会话中途把 `http.proxy` 清空也一样会变成直连，要重启 VS Code 才会回到系统代理。

第 1 条则意味着从终端里执行 `code .` 首次启动的 VS Code（此前没有已在运行的实例），会受到当时终端里代理变量的影响；如果那个变量指向一个已经关掉的端口，整个窗口都会连不上网。

自动识别不奏效时，官方文档给出了 Chromium 的启动参数：

| 参数示例 | 作用 |
|---------|------|
| `--proxy-server=http://127.0.0.1:7890` | 手动指定代理 |
| `--proxy-pac-url=https://example.com/proxy.pac` | 指定 PAC 文件的地址 |
| `--proxy-bypass-list=localhost;127.0.0.1` | 不走代理的主机，分号分隔；只在同时指定 `--proxy-server` 时生效 |
| `--no-proxy-server` | 完全不用代理 |

用法如 `code --proxy-server=http://127.0.0.1:7890`。VS Code 已在运行时，要先完全退出再带参数启动，参数才会生效。

### 扩展宿主：http.proxySupport

扩展运行在 Node.js 里，而 Node.js 默认不读系统代理。VS Code 的做法是在扩展宿主里替换 `http`、`https`、`net`、`tls` 模块以及全局 `fetch`、`WebSocket` 的实现，让扩展发出的请求也能按代理走。按 `@vscode/proxy-agent` 的源码，扩展宿主为每个请求选代理的顺序是：

1. 发往 `localhost`、`127.0.0.1`、`::1` 的请求总是直连；
2. 命中 `http.noProxy`（没设置时看 `NO_PROXY`）的请求直连；
3. 用 `http.proxy`；
4. 没有设置时，看扩展宿主自己环境里的 `https_proxy`、`HTTPS_PROXY`、`http_proxy`、`HTTP_PROXY`；
5. 以上都没有时，才把请求的 URL 交给主进程，由窗口的网络会话解析（即上面的窗口规则或系统代理）。

所以开着系统代理时，多数扩展无需额外设置。

注意：VS Code 官方网络文档的「Legacy proxy server support」一节至今仍写着扩展尚未获得与 VS Code 同等的代理支持，这是旧说法，与当前源码不符：`http.proxySupport` 默认为 `override`，扩展宿主已按上述方式接管网络请求（见 proxyResolver.ts），本文以源码为准。

相关设置的键名、默认值取自 VS Code 源码中的设置注册（`request.ts`）：

| 设置 | 默认值 | 作用 |
|------|-------|------|
| `http.proxy` | 空 | 代理地址；留空时继承 `http_proxy` / `https_proxy` 环境变量或系统代理 |
| `http.noProxy` | 空 | 不走代理的域名列表 |
| `http.proxySupport` | `override` | 扩展的代理支持：`off` 关闭；`on` 开启；`fallback` 开启，找不到代理时沿用扩展自己的请求选项；`override` 开启并覆盖扩展自己的请求选项 |
| `http.proxyStrictSSL` | `true` | 是否用受信任的 CA 列表校验代理服务器的证书 |
| `http.proxyAuthorization` | `null` | 每个请求附带的 `Proxy-Authorization` 头 |
| `http.proxyKerberosServicePrincipal` | 空 | 覆盖 Kerberos 代理认证的服务主体名 |
| `http.systemCertificates` | `true` | 是否从操作系统加载 CA 证书 |
| `http.fetchAdditionalSupport` | `true` | 为扩展的 `fetch` 加上代理与系统证书支持 |
| `http.useLocalProxyConfiguration` | 随远程环境而定 | 远程开发时，远端扩展宿主是否使用本地的代理配置；只在远端设置中生效 |

需要手动指定时，写在**用户设置**（`Preferences: Open User Settings (JSON)`）里。`http.proxy` 等代理设置在源码中注册为应用级（application）、受限的设置，写进项目的 `.vscode/settings.json` 不会生效；而且那个文件常被提交到仓库，容易泄露代理账号：

```json
{
  "http.proxy": "http://127.0.0.1:7890",
  "http.noProxy": ["localhost", "127.0.0.1", "::1"],
  "http.proxySupport": "override",
  "http.proxyStrictSSL": true
}
```

一般情况下保持默认的 `override` 即可。某个扩展自带了网络处理、和 VS Code 的接管冲突时，社区排障常见的做法是改成 `on` 或 `fallback` 试试；改完要重启窗口。

### 扩展拉起的子进程，不受上面这些设置管

VS Code 打的补丁只作用于扩展宿主这个进程本身。扩展另外启动的程序——语言服务器、CLI、本地 MCP 服务器——是独立进程，它们只继承扩展宿主的环境变量，`http.proxy` 和系统代理对它们都无效。这类程序要么在各自的配置里设代理（Claude Code 见后文），要么交给 TUN 模式统一接管。

### 认证、证书与远程开发

- **代理认证**：官方文档列出支持 Basic、Digest、NTLM 和 Negotiate，SOCKS5 代理认证尚未实现。
- **证书**：官方推荐把代理的根证书装进操作系统信任库；Linux 上除系统信任库外，还要加入 NSS 证书库。`--ignore-certificate-errors` 会忽略所有证书错误，官方明确不推荐。
- **远程开发**（Remote-SSH、WSL、Dev Containers）：运行在远端的扩展从远端机器发起请求，远端的 `127.0.0.1` 指的是远端自己，不是你的电脑。`http.useLocalProxyConfiguration` 控制远端扩展宿主是否向本地窗口查询代理，默认值由远程环境决定（源码为 `useHostProxy ?? !isRemote`，远程环境没有声明时为关闭）。按源码推断，开启它时远端扩展拿到的是本地解析出的代理地址，连接却仍从远端发起：本地代理是 `127.0.0.1:7890` 时，远端会去连它自己的 7890 端口，需要配合 FAQ 里的 SSH 端口转发。关闭它时，本地和远端的代理设置分别配置。

---

## GitHub Copilot

本文的 Copilot 均指 GitHub Copilot。它和站内 [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/) 一文提到的 Microsoft Copilot 是两个产品，域名和地区策略都不同，那里的规则不能直接套用。

Copilot 在 VS Code 和 JetBrains 中都优先使用编辑器自己的代理设置。GitHub 官方文档给出的规则：

- **编辑器未设置代理时，读取环境变量**，优先级从高到低为 `HTTPS_PROXY`、`https_proxy`、`HTTP_PROXY`、`http_proxy`。与通常的约定不同，Copilot 只取优先级最高的那个，并把它**同时**用于 HTTP 和 HTTPS 请求；
- **认证**：支持 Basic 认证（账号密码写进代理 URL）和 Kerberos；Kerberos 的服务主体名默认由代理地址推出，可在 VS Code 用 `http.proxyKerberosServicePrincipal`、在 JetBrains 的 Copilot 网络设置里覆盖，也可用环境变量 `AGENT_KERBEROS_SERVICE_PRINCIPAL`；
- **代理地址以 `https://` 开头时，目前不受支持**；
- **证书**：从操作系统信任库和 `NODE_EXTRA_CA_CERTS` 指定的文件读取，因此在透明代理、Zscaler 这类环境下装好公司根证书即可。

在 VS Code 中的配置位置：设置 → Application → Proxy，即上一节的 `http.proxy`；「Proxy Strict SSL」复选框对应 `http.proxyStrictSSL`，官方建议不要关闭证书校验。在 JetBrains 中：Settings → Appearance & Behavior → System Settings → HTTP Proxy，选择 Manual proxy configuration 和 HTTP，填主机与端口。

**排障入口**：VS Code 官方 Copilot 排障文档建议在命令面板运行 `GitHub Copilot: Chat Diagnostics`，它会生成一份连通性检查报告；报告没有失败项只能排除它测过的连接，问题仍在时，用 `Output: Show Output Channels` 查看「GitHub Copilot」和「GitHub Copilot Chat」两个输出频道，必要时用 `Developer: Set Log Level` 把日志级别调到 Trace（排查完记得调回）。

Copilot 需要访问的域名以 GitHub 的 [Copilot allowlist reference](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference) 为准，其中建议接口（Suggestions）除了 `*.githubcopilot.com`，还有 `copilot-proxy.githubusercontent.com` 和 `origin-tracker.githubusercontent.com`；用户管理与取令牌走 `api.github.com`（`/user`、`/copilot_internal/*`），认证走 `github.com/login/*`。这几类域名应走同一个出口，后文的分流规则会一并列出。

---

## Cursor

Cursor 是 VS Code 的分支，但它的 AI 请求发往 Cursor 自己的服务器，并默认使用 HTTP/2 双向流。官方文档重点讲的是 HTTP/2 兼容性，而不是代理地址怎么填。

### 官方明确的部分

据 Cursor 官方网络配置与常见问题文档：

- 对话和 Agent 默认使用 **HTTP/2 双向流**；流式传输失败时，会自动回退到 **HTTP/1.1 + SSE**，无需手动操作；
- 如果所在网络的代理不支持 HTTP/2，可以手动切换：**Cursor Settings → Network → HTTP Compatibility Mode**，设为 **HTTP/1.1**，然后重启 Cursor；
- 同一页面的 **Run Diagnostics** 会检测本机与 Cursor 服务器之间的连通性，向官方求助时附上结果；
- 官方推荐放行的通配域名为 `*.cursor.sh`、`*.cursor-cdn.com`、`*.cursorapi.com`、`*.cursorvm.com` 与 `*.*.cursorvm.com`（官方注明后两个都要加），另有用于客户端更新和扩展下载的 `downloads.cursor.com`；其中 Cursor Tab 与代码库检索的部分接口只支持 HTTP/2；
- **登录域名正在迁移**：登录页改到 `accounts.spacex.ai`、`accounts.x.ai`，另需 `auth.x.ai`、`auth.grok.com`、`auth.grokusercontent.com`、`auth.grokipedia.com` 等认证主机。官方帮助页说明，旧登录页 `authenticator.cursor.sh` 只作过渡期的回退，10 月 30 日停用后，登录必须能访问 `accounts.spacex.ai` 和 `accounts.x.ai`；`cursor.com`、`api*.cursor.com` 这些主机不变。完整列表以官方页面为准；
- 通过 SSH 远程开发时，**AI 请求从本地机器发出**，而不是远端主机——这和 VS Code 远端扩展的行为不同，排查时要注意；
- 断开 VPN 后出现 DNS 错误，官方建议完全退出并重启 Cursor，因为它可能沿用了 VPN 时期的 DNS 设置与环境变量。

### 代理地址怎么设

Cursor 官方文档没有说明编辑器里 `http.proxy` 等继承自 VS Code 的设置是否作用于 AI 请求，而社区论坛的反馈表明这一点并不可靠：

- 2026 年 7 月，Cursor 工作人员在 [论坛帖](https://forum.cursor.com/t/bug-always-local-singleton-ignores-http-proxy-and-server-overrides-cursor-general-disablehttp2/164325) 中确认了一个 3.8 到 3.9 的回归：AI 请求改走默认的 HTTP/2 通道，这条通道不经过代理，临时办法是强制使用 HTTP/1.1。工作人员随后表示计划在 3.11 修复，但未必能完全解决，该帖没有标记为已解决；
- 2026 年 10 月，仍有用户在 3.22 版本上 [报告](https://forum.cursor.com/t/agent-ignores-http-proxy-and-https-proxy-when-http-2-is-enabled-bypasses-corporate-proxy/173619) Agent 的模型请求绕过 `http.proxy` 和 `HTTPS_PROXY`，直连 `api2.cursor.sh` 等接口，关闭 HTTP/2 后才经过代理。

也就是说，只在 Cursor 里填代理地址，不一定能让它的 AI 请求走代理。论坛帖里用到的 `cursor.general.disableHttp2` 这个键名不在官方文档中，官方文档给出的是界面里的 HTTP Compatibility Mode 开关，建议优先用它。

所以对 Cursor 来说，最可靠的做法是本机代理开 **TUN 模式**，让所有进程都被接管。不用 TUN 时，至少把 HTTP Compatibility Mode 设为 HTTP/1.1，并在代理客户端的连接面板里确认发往 `*.cursor.sh` 的请求确实经过了代理；切到 HTTP/1.1 后，只支持 HTTP/2 的 Cursor Tab、代码库检索接口可能受影响。

### Cursor CLI

Cursor 的命令行 Agent 文档写得很明确，在运行前设置：

```bash
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
export NODE_USE_ENV_PROXY=1
# 中间有解密 HTTPS 的代理时，再信任对应的根证书
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
```

Windows PowerShell 的写法：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NODE_USE_ENV_PROXY = "1"
# 中间有解密 HTTPS 的代理时
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\corporate-ca.pem"
```

`NODE_USE_ENV_PROXY=1` 让 Node.js 内置的网络模块读取代理环境变量。据社区反馈，Cursor CLI 使用安装包自带的 Node 运行时，这个变量是否生效取决于内置版本，和你系统里装的 Node 无关；设置后仍不走代理，就改用 TUN。Node.js 对这个变量的版本要求见 [命令行与开发工具走代理](/posts/terminal-proxy/) 的 Node.js 一节。代理不支持 HTTP/2 双向流时，在全局配置文件里加上 `network` 段：

```json
{
  "network": {
    "useHttp1ForAgent": true
  }
}
```

全局配置文件位于 macOS / Linux 的 `~/.cursor/cli-config.json`，Windows 的 `$env:USERPROFILE\.cursor\cli-config.json`；该键默认为 `false`，开启后 Agent 连接改用 HTTP/1.1 + SSE。

---

## Claude Code

Claude Code 的官方文档对代理写得比较细，企业网络配置页面明确了以下规则。

### 环境变量与 settings.json

| 变量 | 说明 |
|------|------|
| `HTTPS_PROXY` / `https_proxy` | 推荐设置；按 `https_proxy`、`HTTPS_PROXY`、`http_proxy`、`HTTP_PROXY` 的顺序取第一个已设置的 |
| `HTTP_PROXY` / `http_proxy` | 没有 HTTPS 代理时使用 |
| `NO_PROXY` | 空格或逗号分隔，支持 `.example.com`，`*` 表示全部不走代理 |

几个要点：

- **不支持 SOCKS 代理**，本地 mixed 端口请写 `http://`；
- **Basic 认证**写进 URL：`http://用户名:密码@主机:端口`；NTLM、Kerberos 等高级认证，官方建议改用支持该认证方式的 LLM 网关；
- shell 里导出的变量**只在启动时读取一次**，会话运行中再改 shell 不会生效；改了 `settings.json` 里的代理后，稳妥起见也重开一次会话；
- 代理 URL 无法解析（例如漏了 `http://`）时，Claude Code 会直接拒绝启动，并提示是哪个变量出了问题；
- Claude Code 自己发往 `localhost`、`::1`、`127.0.0.0/8` 的 WebSocket 连接永远不走代理，不需要为此改 `NO_PROXY`。

官方文档说明，这些变量都可以写进 `settings.json` 的 `env` 块。Claude Code 直接从文件读取，**无论从哪里启动都生效**——终端、VS Code 插件、后台 Agent 都一样。对后台 Agent，官方明确建议把网络相关变量写在设置里而不是 shell 里：后台 Agent 由一个共享的常驻进程托管，它只继承第一次启动它的那个 shell 的环境。

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:7890",
    "NO_PROXY": "localhost,127.0.0.1,::1"
  }
}
```

写在哪个文件里有讲究：

| 文件 | 作用范围 | 是否适合放代理 |
|------|---------|--------------|
| `~/.claude/settings.json` | 你本人的所有项目，VS Code 插件与 CLI 共用 | 适合 |
| `.claude/settings.local.json` | 你本人、当前项目 | 适合只在某个项目用代理时 |
| `.claude/settings.json` | 项目共享，通常提交到仓库 | 不适合，会影响队友和 CI |

注意两个细节：

1. 同一个变量在 shell 和 `env` 块里都设置时，大多数情况下 `env` 块的值生效；
2. 但大小写不同的变量是两个变量。在 macOS / Linux 上，如果 shell 里残留着一个小写的 `https_proxy`（指向旧端口），按上面的优先顺序它会排在 `env` 块里大写的 `HTTPS_PROXY` 前面被选中。遇到「明明设置了却不生效」，先 `env | grep -i proxy` 看一眼，或者在 `env` 块里把小写的 `https_proxy` 也写上。Windows 的环境变量不分大小写，没有这个问题。

VS Code 插件的扩展设置里也有一个 `environmentVariables` 选项，可以只给插件启动的 Claude 进程设变量；官方的建议是共享配置放在 `~/.claude/settings.json`。

### 证书

Claude Code 默认同时信任自带的 Mozilla CA 证书集和操作系统的证书库（由 `CLAUDE_CODE_CERT_STORE` 控制，默认值 `bundled,system`；通过 npm 安装时，读取系统证书库需要 Node.js 22.15 或更高版本）。公司的 HTTPS 检查代理只要把根证书装进了系统信任库，一般无需额外配置；否则用 `NODE_EXTRA_CA_CERTS` 指向 PEM 文件。

### 验证配置是否生效

```bash
# 启动前，用同一个代理地址手动测一次
curl -x http://127.0.0.1:7890 -I https://api.anthropic.com

# 带调试日志启动，日志写到 ~/.claude/debug/ 下
claude --debug
```

```powershell
# Windows PowerShell 里请写 curl.exe，否则会调用自带的 Invoke-WebRequest
curl.exe -x http://127.0.0.1:7890 -I https://api.anthropic.com
```

进入会话后运行 `/status`，其中的 Proxy 一行会显示当前生效的代理地址，无法解析的值会被标为无效并忽略。

### 需要放行的域名

官方「Network access requirements」表列出了 Claude Code 需要访问的主机，核心几项：

| 域名 | 用途 |
|------|------|
| `api.anthropic.com` | Claude API 请求 |
| `claude.ai`、`claude.com` | claude.ai 账号登录 |
| `platform.claude.com` | Console 账号登录，以及 OAuth 令牌交换与刷新 |
| `mcp-proxy.anthropic.com` | claude.ai 上的 MCP 连接器（claude.ai 账号登录时默认启用） |
| `downloads.claude.ai` | 原生安装、自动更新与插件下载 |

另有插件市场（`github.com`）、插件安装与 `npx` 启动的 MCP 服务器（`registry.npmjs.org`）、Claude in Chrome 的桥接（`bridge.claudeusercontent.com`）、遥测等主机，配置分流规则或防火墙前请对照官方完整列表。如果你是通过公司或第三方提供的 LLM 网关接入（设置了 `ANTHROPIC_BASE_URL`），模型请求会发往网关地址而不是上面的域名。

---

## JetBrains IDE

### IDE 本体：HTTP Proxy 设置页

位置：**Settings → Appearance & Behavior → System Settings → HTTP Proxy**（macOS 上 Settings 在应用名菜单下）。据 IntelliJ IDEA 当前版本的帮助文档：

| 选项 | 说明 |
|------|------|
| No proxy | 直连 |
| Auto-detect proxy settings | 默认项，使用系统代理设置或自动发现的 PAC 文件；可填 Automatic proxy configuration URL 指定 PAC |
| Manual proxy configuration | 选 HTTP 或 SOCKS，填 Host name、Port number |
| No proxy for | 不走代理的主机，逗号分隔，支持 `*` 通配 |
| Proxy authentication | 代理需要认证时勾选并填写账号密码；勾选 Remember 会在会话间保存密码 |
| Check connection | 输入一个 URL 测试代理是否可用 |

JetBrains 的支持文章与 GitHub 文档都把这里作为 AI Assistant 和 JetBrains 版 Copilot 的代理配置入口。GitHub 文档给 Copilot 的说明是选择 Manual proxy configuration 和 HTTP；Copilot 提示证书问题时，对应的开关在 Appearance & Behavior → System Settings → Server Certificates 里的「Accept non-trusted certificates automatically」，GitHub 不建议勾选。

### AI Assistant 的地区与域名

JetBrains 支持文章给出了 AI Assistant / Junie 需要访问的地址，包括 `api.jetbrains.ai`、`api.jetbrains.cloud`、`api.app.prod.grazie.aws.intellij.net`、`www.jetbrains.com/config/`、`account.jetbrains.com` 等（中国大陆位置使用单独的 `api.ai.jetbrains.com.cn`）。在 AI Assistant 里使用 Claude Agent、Codex 等第三方 Agent 时，还需要 `cdn.agentclientprotocol.com`、`frameworks.jetbrains.com`、`nodejs.org` 和 `registry.npmjs.org`。

AI Assistant 还有一个容易被忽略的设置：**Settings → Appearance & Behavior → System Settings → Language and Region** 里的地区。JetBrains 的排障文章列出，地区设置不对、防火墙 / 代理 / VPN 拦截、所在地不在服务范围内，都会导致「AI Assistant is not available in your location」一类提示；IDE 地区、JetBrains 账号资料里的地区与实际情况要一致。同一篇文章还特别注明，AI Assistant 在香港、澳门不可用，给 JetBrains AI 用的策略组不要选这两地的节点。

### 构建工具要单独配

IDE 的代理设置管不到 Gradle、Maven 这些构建工具自己的下载。Gradle 官方文档给出的方式是在 `gradle.properties` 里写 JVM 系统属性。我们建议写在用户级的 `~/.gradle/gradle.properties`（Windows 为 `%USERPROFILE%\.gradle\gradle.properties`），而不是项目里会被提交的那个：

```properties
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=7890
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=7890
# HTTPS 的绕过列表也用 http 前缀，官方注明这不是笔误
systemProp.http.nonProxyHosts=localhost|127.0.0.1
```

Maven 则在 `~/.m2/settings.xml` 的 proxies 段里配置。

---

## Codex CLI：能核实的部分

OpenAI 的 Codex 文档在代理方面信息有限，这里只写能从官方文档核实的内容：

- **证书**：在有 HTTPS 检查代理或私有根证书的网络里，设置 `CODEX_CA_CERTIFICATE` 指向 PEM 证书包；未设置时回落到 `SSL_CERT_FILE`。这两个变量同时作用于登录、普通 HTTPS 请求和安全 WebSocket 连接；
- **登录回调**：浏览器登录需要把令牌回传到本机的回调服务器（默认 `localhost:1455`）。Codex 运行在远程主机上时，官方给出的办法是在本地执行 `ssh -L 1455:localhost:1455 user@remote` 转发回调端口，再在这个 SSH 会话里运行 `codex login`。也可以改用设备码登录（测试版）`codex login --device-auth`，但要先在 ChatGPT 账号的安全设置里开启设备码登录，工作区账号则需管理员在工作区权限中开启；
- **配置项里的 network_proxy 不是给 Codex 自己用的**：配置参考里 `features.network_proxy` 等设置的作用对象是沙箱里执行的命令（控制它们能访问哪些网络），而不是 Codex 与模型服务之间的连接，别把两者混淆。

至于 Codex 自身如何读取代理：官方环境变量页（列出 Codex 直接读取的稳定变量）里没有 `HTTPS_PROXY` 这类变量，也没有专门的代理配置章节。GitHub 上的 [issue #20844](https://github.com/openai/codex/issues/20844) 中（截至发稿仍未关闭），有 Windows 用户反馈把 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 都设为 `socks5://` 时连接不稳定，改为 `http://` 地址并取消 `ALL_PROXY` 后恢复正常；后续还有 Linux 用户反映，WebSocket 请求能经过 SOCKS 代理，HTTPS 回退路径却不行。日志里出错的请求发往 `chatgpt.com/backend-api/codex/...`，即 ChatGPT 账号登录时 Codex 的接口。

在官方补充说明之前，可以先把 `HTTPS_PROXY`、`HTTP_PROXY` 设为 `http://127.0.0.1:端口`，同时清除 `ALL_PROXY` 里的 `socks5://` 值（`unset ALL_PROXY`，PowerShell 用 `Remove-Item Env:ALL_PROXY`），这与 issue 中恢复正常的配置一致；仍不行再用 TUN 模式。

---

## 通用方案：TUN 模式 + 分流规则

### TUN：不用逐个工具配置

上面每个工具的规则都不一样，而且子进程、构建工具、MCP 服务器还会各自带来新的变数。TUN 模式在网络层接管所有进程的流量，程序本身完全不需要知道代理的存在，这对 AI 编程工具尤其合适：编辑器、插件拉起的 CLI、语言服务器、`npx` 启动的 MCP 服务器，一次全部覆盖。原理与取舍见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)，开启后不生效、WSL 或 Docker 断网等问题见 [TUN 模式不生效的常见原因](/posts/tun-not-working/)。

配合客户端的 DNS 设置，TUN 还能减少 DNS 方面的问题：系统代理模式下，不走代理的程序会在本地解析域名，既可能拿到被污染的结果，也会暴露你在访问哪些服务，详见 [DNS 泄漏是什么、怎么检测、怎么防](/posts/dns-leak/)。

### 分流规则：域名以官方列表为准

TUN 只负责把流量交给代理客户端，最终走哪个出口仍由规则决定。给 AI 工具单独建一个策略组，把官方列出的域名都指向它，可以避免「一部分请求走代理、一部分直连」造成的超时和地区不一致。各工具的官方域名清单：

| 工具 | 官方清单 |
|------|---------|
| Claude Code | 官方网络配置页的 Network access requirements |
| GitHub Copilot | GitHub Docs 的 Copilot allowlist reference |
| Cursor | Cursor Docs 的 Network Configuration 与登录域名帮助页 |
| Codex | 官方没有单独的放行清单；ChatGPT 账号登录时接口在 `chatgpt.com` 下，登录与 API Key 方式涉及 `openai.com` 下的域名 |
| VS Code 本体 | VS Code 网络文档中的常用主机名列表 |
| JetBrains AI Assistant | JetBrains 支持文章 SUPPORT-A-297 |

下面是按这些清单摘录的 mihomo 规则示例（只列核心接口，完整列表请以官方页面为准）：

```yaml
proxy-groups:
  - name: AI
    type: select          # 手动选择，避免自动切换导致出口 IP 频繁变化
    proxies:
      - 美国节点A
      - 日本节点B

rules:
  # 以下规则要放在 rules 列表靠前的位置：至少排在 GEOSITE、RULE-SET 这类
  # 通用代理列表（如 gfw、proxy）以及 GEOIP、MATCH 之前，
  # 否则这些域名会先被通用规则分到别的策略组
  # Claude Code
  - DOMAIN-SUFFIX,anthropic.com,AI          # 含 api、mcp-proxy 等子域名
  - DOMAIN-SUFFIX,claude.ai,AI
  - DOMAIN-SUFFIX,claude.com,AI
  - DOMAIN-SUFFIX,claudeusercontent.com,AI  # Claude in Chrome 桥接等
  # Codex（OpenAI）
  - DOMAIN-SUFFIX,openai.com,AI
  - DOMAIN-SUFFIX,chatgpt.com,AI
  # GitHub Copilot
  - DOMAIN-SUFFIX,githubcopilot.com,AI
  - DOMAIN,copilot-proxy.githubusercontent.com,AI
  - DOMAIN,origin-tracker.githubusercontent.com,AI
  - DOMAIN,api.github.com,AI
  # Cursor
  - DOMAIN-SUFFIX,cursor.sh,AI
  - DOMAIN-SUFFIX,cursorapi.com,AI
  - DOMAIN-SUFFIX,cursor-cdn.com,AI
  - DOMAIN-SUFFIX,cursorvm.com,AI
  - DOMAIN-SUFFIX,cursor.com,AI
  # Cursor 新登录页（2026 年 10 月起）
  - DOMAIN-SUFFIX,x.ai,AI
  - DOMAIN-SUFFIX,spacex.ai,AI
  - DOMAIN,auth.grok.com,AI
  - DOMAIN,auth.grokusercontent.com,AI
  - DOMAIN,auth.grokipedia.com,AI
  # JetBrains AI Assistant
  - DOMAIN-SUFFIX,jetbrains.ai,AI
  - DOMAIN,api.jetbrains.cloud,AI
  - DOMAIN,api.app.prod.grazie.aws.intellij.net,AI
```

几点说明：

- **规则顺序**：mihomo 的规则自上而下匹配，订阅配置里常有在 GEOIP 之前就出现的通用代理列表，其中往往已经包含 anthropic.com、github.com 这类域名。AI 规则排在它们后面就形同虚设，写好后在连接面板里确认每条请求命中的规则；
- **策略组类型**：`url-test` 自动测速组换节点后，已经建立的连接一般仍走旧节点（mihomo 的 url-test 实现不会主动断开旧连接，sing-box 的 `interrupt_exist_connections` 默认也是关闭的），但重试、下一轮对话和同一任务的后续请求会从新的出口 IP 发出，同一会话里出口 IP 来回变化，可能触发服务商的风控。部分图形客户端还有「切换节点时断开连接」一类选项，开着它时，正在输出的回复会被直接打断。用 `select` 手动固定，或用 `fallback` 只在节点故障时切换，更适合这类流量，取舍见 [故障检测与自动切换策略](/posts/failover-strategies/)；
- **节点地区**：AI 策略组里不要放香港、澳门节点。Anthropic 的支持地区列表里没有这两地，OpenAI 的列表里也没有香港，JetBrains 则明确注明 AI Assistant 在港澳不可用；
- **GitHub 其他域名**（`github.com` 等）大多已被常用规则集分到代理，可以在连接面板里确认，最好与 AI 策略组的出口地区一致；
- 规则写法与规则集维护见 [如何自定义规则](/posts/custom-rules/) 和 [Clash 规则集详解](/posts/clash-rule-providers/)。

---

## 常见报错与排查

### 对照表

| 现象 / 报错 | 常见原因 | 处理 |
|------------|---------|------|
| `ECONNREFUSED`、`Connection refused` 指向 `127.0.0.1:7890` | 代理客户端没开或端口写错；设置里残留旧代理 | 核对端口；检查 `http.proxy`、`settings.json` 的 `env`、shell 变量 |
| `self-signed certificate in certificate chain`、`unable to get local issuer certificate`、`SELF_SIGNED_CERT_IN_CHAIN` | 有程序在解密 HTTPS：公司网关、杀毒软件、抓包工具 | 把对应根证书装进系统信任库，或用 `NODE_EXTRA_CA_CERTS` / `CODEX_CA_CERTIFICATE`；不用时关掉抓包工具 |
| `407 Proxy Authentication Required` | 代理要求认证 | 把账号密码写进代理 URL；本机代理可对回环地址免认证 |
| `ERR_PROXY_TUNNEL`，Claude Code 显示 Couldn't connect through your proxy | 代理拒绝建立 CONNECT 隧道 | 检查认证信息，以及代理是否允许访问该主机 |
| `ECONNRESET`、`Socket is closed`、`stream disconnected before completion` | 长连接被中途掐断：节点不稳、中间设备空闲超时，或客户端在切换节点时主动断开了旧连接 | 固定节点；换更稳定的线路；更新工具到带自动重试的版本 |
| 回复不逐字出现，长时间无响应后一次性出现或超时；Claude Code 报 `No response from API` | 中间代理缓冲 SSE，或不支持 HTTP/2 双向流 | Cursor 切 HTTP/1.1 模式；Claude Code 调大 `API_TIMEOUT_MS` / `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS`；请 IT 对相关域名免除 HTTPS 检查 |
| 启动即报代理 URL 无法解析（Claude Code 会点名出错的变量），或代理地址写成 `https://`、`socks5://` 后连接失败 | 漏写协议头；本机 mixed 端口写成了 `https://`（端口是明文代理，TLS 握手会失败）；给不支持 SOCKS 的工具（如 Claude Code）填了 `socks5://`；Copilot 不支持 `https://` 开头的代理地址 | 改为 `http://127.0.0.1:端口` |
| `403`、OpenAI API 的 `unsupported_country_region_territory`、JetBrains 的「AI Assistant is not available in your location」 | 出口 IP 不在服务支持地区，或部分请求漏走直连 | 检查分流规则与出口地区，见 [AI 服务的 IP 策略](/posts/ai-services-unlock/) |
| 浏览器里登录成功，工具仍显示未登录 | 工具运行在远程主机、WSL 或容器里，浏览器回调的 localhost 不是它所在的机器；或安全软件拦截了本地回调端口 | 远程场景用 SSH 转发回调端口（Codex 默认 1455）或改用设备码登录；本机场景检查安全软件 |

### 证书错误：先找出是谁在「中间」

常规的代理客户端（mihomo、sing-box 等规则分流类客户端）只转发加密流量，不会替换网站证书——除非你在客户端里主动开启了 MITM / HTTPS 解密功能。所以出现自签名证书错误，几乎总是有别的东西在解密 HTTPS：

1. **公司网络**：安全网关做 SSL 检查，需要 IT 提供根证书；
2. **杀毒 / 安全软件**的「HTTPS 扫描」「网页防护」功能；
3. **抓包工具**：Fiddler、Charles、mitmproxy 等调试完忘了关，系统代理还指向它们。

处理顺序：先确认来源；该信任的根证书装进系统信任库（VS Code、Copilot、Claude Code 都会读取系统证书）；Node.js 系工具补一个 `NODE_EXTRA_CA_CERTS`。网上流传的 `NODE_TLS_REJECT_UNAUTHORIZED=0`、关闭 `http.proxyStrictSSL`、`--ignore-certificate-errors` 都是关掉证书校验，等于放弃了 HTTPS 防中间人的能力，你的代码、API 密钥和登录令牌都可能因此暴露，不建议使用。

### 407：本机代理开了认证

如果你给 mihomo 设置了 `authentication`（例如为了安全开启了局域网连接），本机工具也会被要求认证。可以把账号密码写进代理 URL，也可以用 mihomo 的 `skip-auth-prefixes` 让回环地址免认证：

```yaml
authentication:
  - "user:password"
skip-auth-prefixes:
  - 127.0.0.1/8
  - ::1/128
```

账号密码写进代理 URL 后，它会以明文出现在配置文件、环境变量甚至进程列表里，不要把这类配置提交到仓库。`authentication`、`skip-auth-prefixes` 与 `lan-allowed-ips` 的完整写法和注意事项见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

### 流式输出中断

偶发中断多数工具会自动重试：Claude Code 官方文档说明它会对超时、连接断开、流停滞等瞬时故障自动重试，默认最多 10 次。频繁中断时按顺序检查：

1. **是否在自动切换节点**：看客户端日志里有没有节点切换记录。url-test 组频繁换节点，通常说明当前节点本身不稳；同时检查客户端是否开了「切换节点时断开连接」。AI 策略组改为手动选择；
2. **节点本身是否稳定**：用 [节点连不上？系统排查流程](/posts/connectivity-checklist/) 的方法排除线路问题；
3. **中间是否有公司代理**：缓冲型代理会把响应攒到生成结束才转发，流式请求迟迟拿不到响应头，Claude Code 会报 `No response from API`。直连 Anthropic API（包括经过 HTTPS 代理）时，第一次尝试最多等约 180 秒（首字节截止时间，可用 `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS` 调整），超时后重试一次，重试的等待时间比 `API_TIMEOUT_MS`（默认 600000 毫秒）少一秒。官方建议：代理会扣住响应直到生成完成时，调大 `API_TIMEOUT_MS`；第一次尝试总是超时、重试才成功时，再调大 `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS`；
4. **工具版本**：Claude Code 官方错误文档提到，`Socket is closed` 最常见的原因是 Windows 上的公司代理中途关闭隧道，v2.1.214 起会对此自动重试。

### 区域不可用

连接正常、返回 403 或「地区不可用」，问题不在代理配置，而在出口地区。先在浏览器访问一个显示 IP 归属地的页面，确认 AI 策略组当前节点的地区；再检查连接面板里该工具的所有域名是否都走了同一个策略组。不同服务的地区与 IP 类型要求见 [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/)。

---

## 服务条款与安全提示

- **服务条款**：Anthropic 的 Supported Regions Policy（页面标注自 2026 年 11 月 12 日起生效的版本）同时适用于 Claude.ai、Claude Code 和 API 等产品。它规定身处不支持地区的个人不在服务范围内，中国大陆、香港、澳门都不在支持列表中；注册地或总部在不支持地区的实体，以及被不支持地区的个人或实体直接或间接多数持股、控制的实体，其员工和用户即使身在支持地区，也不在服务范围内。OpenAI 的支持国家页面也写明，在列表之外访问或提供访问，可能导致账号被封禁或暂停。通过代理在服务不支持的地区使用这些产品，可能违反服务条款，由此带来的封号、付费订阅损失等风险需要你自行评估。
- **公司设备与网络**：公司电脑上的代理、证书和网关配置往往是安全策略的一部分，自行绕过可能违反信息安全制度，操作前先了解单位规定，必要时咨询 IT 部门。
- **凭据安全**：代理账号密码、API 密钥不要写进会提交到仓库的文件（`.vscode/settings.json`、`.claude/settings.json`、项目里的 `gradle.properties`）。
- **第三方中转**：通过非官方的 API 中转服务接入，你的代码和提示词会经过第三方服务器，隐私与合规风险与直连官方完全不同，代理能保护什么、不能保护什么见 [代理能做什么、不能做什么](/posts/privacy-boundaries/)。

---

## 常见问题（FAQ）

### 开了 TUN 模式，还需要在 VS Code、Claude Code 里填代理吗？

一般不需要，原因见上文「TUN：不用逐个工具配置」，通用说明见 [命令行与开发工具走代理](/posts/terminal-proxy/) 的 FAQ。AI 工具要额外注意一点：关掉 TUN 或退出客户端后，残留在 `http.proxy`、`~/.claude/settings.json` 的 `env` 块或 shell 配置里的代理地址会让工具连不上，排查时一并检查。

### 为什么 Copilot 能用，同一个窗口里的 Claude Code 插件却连不上？

两者的进程模型不同，见开头「为什么浏览器能用」一节：Copilot 的请求由 VS Code 接管，Claude Code 插件拉起的 `claude` 进程不读系统代理。把代理写进 `~/.claude/settings.json` 的 `env` 块，或者开 TUN，都能解决。

### Remote-SSH 或 WSL 里的 AI 工具，代理该怎么配？

先分清请求从哪台机器发出。VS Code 远端扩展、在远端终端里运行的 `claude` 都从远端发起请求，而远端的 `127.0.0.1` 并不是你的电脑；Cursor 官方文档则说明它的 AI 请求从本地发出。远端需要用本地代理时，可以用 SSH 远程端口转发把本地端口带过去：

```bash
# 远端的 7890 端口转发到本机的 127.0.0.1:7890
ssh -R 7890:127.0.0.1:7890 user@server
# 然后在远端设置 HTTPS_PROXY=http://127.0.0.1:7890
```

也可以在 `~/.ssh/config` 对应的 Host 下写 `RemoteForward 7890 127.0.0.1:7890`。在多人共用的服务器上，同机其他用户也能连到这个端口，要评估风险。

VS Code 的远端扩展有两种配法：在 Remote 设置（`Preferences: Open Remote Settings (JSON)`）里开启 `http.useLocalProxyConfiguration` 时，远端会使用本地解析出的代理地址，用上面的方法把同一端口转发过去即可；也可以让它保持关闭，在 Remote 设置里单独设置 `"http.proxy": "http://127.0.0.1:7890"`。WSL 的情况见 [命令行与开发工具走代理](/posts/terminal-proxy/) 的 WSL2 一节。

### 可以把证书校验关掉一劳永逸吗？

不建议，理由见上文「常见报错与排查」里的证书错误一节：这等于放弃 HTTPS 防中间人的能力，而 AI 编程工具传输的正是源代码、密钥和登录令牌。正确做法是信任解密 HTTPS 的那个程序的根证书，或者不让它解密这些域名。

### 频繁切换节点会影响账号吗？

可能会。同一账号短时间内从多个国家登录或调用，可能触发风控验证，原因和策略组写法见上文「分流规则」一节的说明。IP 类型与质量的判断方法见 [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/)。

### 浏览器能打开 claude.ai，命令行里 curl api.anthropic.com 却超时？

浏览器走的是系统代理，curl 默认只读环境变量，没设就直连了。用 `curl -x http://127.0.0.1:7890 -I https://api.anthropic.com` 显式走代理测一次（Windows PowerShell 中写 `curl.exe`）：能通说明代理没问题，是工具没读到代理；不通再查节点和分流规则。终端环境变量的设置方法见 [命令行与开发工具走代理](/posts/terminal-proxy/)。

---

## 外部参考

- VS Code：[Network connections in Visual Studio Code](https://code.visualstudio.com/docs/setup/network)、[设置注册源码 request.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/request/common/request.ts)、[窗口代理源码 windowImpl.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/windows/electron-main/windowImpl.ts)、[扩展宿主代理源码 proxyResolver.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/node/proxyResolver.ts)、[代理解析顺序 vscode-proxy-agent](https://github.com/microsoft/vscode-proxy-agent/blob/main/src/index.ts)、[登录 shell 环境解析 shellEnv.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/shell/node/shellEnv.ts)、[Chromium 网络设置与启动参数](https://www.chromium.org/developers/design-documents/network-settings/)
- GitHub Copilot：[Network settings for GitHub Copilot](https://docs.github.com/en/copilot/concepts/network-settings)、[Configuring network settings](https://docs.github.com/en/copilot/how-tos/configure-personal-settings/configure-network-settings)、[Copilot allowlist reference](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference)、[Troubleshoot AI in VS Code](https://code.visualstudio.com/docs/agents/agent-troubleshooting/troubleshooting)
- Cursor：[Network Configuration](https://cursor.com/docs/enterprise/network-configuration)、[Sign-in domains](https://cursor.com/help/troubleshooting/sign-in-domains)、[Common Issues](https://cursor.com/docs/troubleshooting/common-issues)、[CLI Configuration](https://cursor.com/docs/cli/reference/configuration)、论坛帖：[3.9 起 AI 请求不经过代理](https://forum.cursor.com/t/bug-always-local-singleton-ignores-http-proxy-and-server-overrides-cursor-general-disablehttp2/164325)、[HTTP/2 下 Agent 绕过代理](https://forum.cursor.com/t/agent-ignores-http-proxy-and-https-proxy-when-http-2-is-enabled-bypasses-corporate-proxy/173619)
- Claude Code：[Enterprise network configuration](https://code.claude.com/docs/en/network-config)、[Environment variables](https://code.claude.com/docs/en/env-vars)、[Settings](https://code.claude.com/docs/en/settings)、[Error reference](https://code.claude.com/docs/en/errors)、[Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install)、[Use Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- JetBrains：[HTTP Proxy 设置](https://www.jetbrains.com/help/idea/settings-http-proxy.html)、[AI Assistant 防火墙与代理放行地址](https://youtrack.jetbrains.com/articles/SUPPORT-A-297)、[AI Assistant 地区设置问题](https://youtrack.jetbrains.com/articles/SUPPORT-A-558)、[Gradle 网络与代理](https://docs.gradle.org/current/userguide/networking.html)、[Maven 代理配置](https://maven.apache.org/guides/mini/guide-proxies.html)
- Codex：[Authentication](https://learn.chatgpt.com/docs/auth)、[Environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables)、[Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)、[openai/codex issue #20844](https://github.com/openai/codex/issues/20844)
- 服务条款：[Anthropic Supported Regions Policy](https://www.anthropic.com/legal/supported-regions)、[OpenAI Supported countries and territories](https://developers.openai.com/api/docs/supported-countries)
- 代理客户端：[mihomo 全局配置](https://wiki.metacubex.one/config/general/)、[mihomo url-test 实现源码](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/outboundgroup/urltest.go)、[sing-box URLTest 出站](https://sing-box.sagernet.org/configuration/outbound/urltest/)

**站内相关文章**：

- [命令行与开发工具走代理：终端、Git、npm、pip、Docker 配置大全](/posts/terminal-proxy/)
- [TUN 模式 vs 系统代理：原理与选择](/posts/tun-vs-system-proxy/)
- [TUN 模式不生效的常见原因](/posts/tun-not-working/)
- [ChatGPT / Claude / Gemini 的 IP 策略与解锁](/posts/ai-services-unlock/)
