---
title: "mihomo（Clash Meta）配置文件逐段详解：从通用设置到代理组"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 客户端教程
tags:
  - Clash
  - mihomo
  - 配置
  - 教程
  - 规则
  - 进阶
excerpt: "按配置文件的真实结构逐段拆解 mihomo：通用设置、DNS、TUN、节点、代理集合、代理组与规则，字段和默认值以官方文档与源码为依据，附一份带中文注释、可直接运行的最小配置和常见报错排查。"
index_img: /images/posts/mihomo-config-anatomy.svg
---

> **摘要**：Clash Verge Rev、FlClash 这类客户端的底层都是 mihomo 内核，界面上的每个开关最终都会落到一份 YAML 配置里。看懂这份配置，才能判断「该改哪里、为什么改了没生效、报错指向的是什么」。本文按顶层段落逐段讲解：YAML 语法坑、配置文件的位置与覆写、通用设置、dns、sniffer 与 tun、proxies、proxy-providers、proxy-groups 和规则。主要字段名与默认值参照 mihomo v1.19.31 的官方文档和源码整理，文末给出一份可直接运行的带注释最小配置和报错排查表；报错原文请以你自己日志里的实际输出为准。

---

## 先看全貌：配置文件的顶层结构

mihomo 的配置文件是一个 YAML 映射，顶层每个键负责一件事。内核会先把整份文件读完再统一解析，所以**顶层段落的先后顺序不影响结果**，只影响可读性。唯一的例外是 YAML 锚点：`&名称` 必须写在引用它的 `*名称` 之前，否则会报 `unknown anchor`。不少模板用锚点复用策略组参数，调整段落顺序时别把定义挪到引用后面。真正讲究顺序的是列表内部，比如 `rules` 自上而下匹配、`fallback` 组按列表顺序挑节点。

| 顶层键 | 负责什么 |
|--------|----------|
| 通用设置（`mixed-port`、`mode`、`log-level` 等直接写在顶层的键） | 入站端口、运行模式、日志、外部控制 API |
| `dns` | 内置 DNS 服务、Fake-IP |
| `sniffer` | 从流量里嗅探域名 |
| `tun` | 虚拟网卡，接管全局流量 |
| `proxies` | 手写的单个节点 |
| `proxy-providers` | 从订阅或文件批量加载节点 |
| `proxy-groups` | 把节点组织成可手选、可自动切换的策略组 |
| `rule-providers` | 外部规则集 |
| `rules` | 分流规则 |

一条连接在内核里的走向，大致对应这些段落：

```text
应用发起连接
  └─ 入站：mixed-port（系统代理）或 tun（虚拟网卡）
       └─ dns + sniffer：确定目标域名 / IP
            └─ rules：自上而下找到第一条命中的规则，得到一个策略名
                 └─ proxy-groups：策略组选出具体节点
                      └─ proxies / proxy-providers：按该节点的协议参数发出连接
```

**版本说明**：本文以 2026 年 9 月发布的 mihomo v1.19.31 为准。mihomo 更新频繁，也会移除旧字段（下文的 relay 组、`global-client-fingerprint` 就是例子）。如果你的客户端内置的是较旧的内核，个别字段的行为可能不同；内核版本一般能在客户端的设置或关于页面看到，命令行下用 `mihomo -v` 查看。mihomo 与 Clash、Clash Meta 的关系见 [Clash 系列全解](/posts/clash-family/)。

---

## YAML 基础与常见坑

mihomo 使用 go-yaml v3 解析配置。YAML 对空白字符极其敏感，大部分「配置加载失败」都出在这一层。

### 五条硬规则

1. **缩进只能用空格，不能用 Tab。** 同一层级必须对齐，习惯上每级缩进 2 个空格。
2. **键和值之间是「冒号 + 空格」**。`mode:rule` 会被当成一整个字符串，而不是键值对。
3. **列表项是「短横线 + 空格」**。少了空格的 `-MATCH,DIRECT` 视位置不同，要么报 `could not find expected ':'`，要么让整段列表被合并成一个长字符串，报出的类型错误和真正原因相距甚远。
4. **同一层级的键不能重复**。复制粘贴时写出两个 `dns:`，go-yaml v3 会直接报 `mapping key "dns" already defined`。
5. **` #` 之后是注释**。`password: abc #123` 的实际密码是 `abc`；没有空格的 `abc#123` 则不受影响。

```yaml
# 错误示范
dns:
	enable: true          # Tab 缩进 → found character that cannot start any token
mode:rule                 # 缺空格 → could not find expected ':'
rules:
  -DOMAIN,a.com,DIRECT    # 缺空格 → 报错，或整段被当成字符串

# 正确写法
dns:
  enable: true
mode: rule
rules:
  - DOMAIN,a.com,DIRECT
```

### 什么时候必须加引号

| 场景 | 错误写法 | 正确写法 | 原因 |
|------|----------|----------|------|
| 值以 `*` 开头 | `- *.lan` | `- "*.lan"` | `*` 在 YAML 里是别名符号 |
| 值里有「冒号 + 空格」 | `name: HK: 01` | `name: "HK: 01"` | 被解析成嵌套映射 |
| 值以 `[` 开头 | `name: [HK] 01` | `name: "[HK] 01"` | 被解析成流式列表 |
| 值里有「空格 + 井号」 | `password: abc #1` | `password: "abc #1"` | 后半截变成注释 |
| 纯数字且有前导零 | `short-id: 0123` | `short-id: "0123"` | 被当成八进制整数 83 |

最省心的习惯：**节点名、密码、short-id、正则表达式一律加双引号**。双引号里的反斜杠是转义符，写正则时要写成 `\\`；不想转义可以改用单引号，单引号内只有 `''` 表示一个单引号字面量。

### 列表的两种写法

下面以策略组里的 `proxies`（节点名称列表）为例。注意它和顶层的 `proxies` 不是一回事：顶层 `proxies` 的每一项必须是完整的节点定义，写成名称列表会报解析错误。

```yaml
# 块式：一行一项，便于增删和做差异对比
proxy-groups:
  - name: "节点选择"
    type: select
    proxies:
      - 香港-01
      - 日本-01
```

```yaml
# 流式：适合很短的列表，与上面等价
proxy-groups:
  - name: "节点选择"
    type: select
    proxies: [香港-01, 日本-01]
```

两种写法等价，二选一即可，同一个列表内不要混用。

### 改完先校验

- **客户端**：保存后看一眼日志页或弹出的错误通知，报错会指出行号。
- **命令行**：`mihomo -d 配置目录 -t` 只解析不运行，输出 `configuration file ... test is successful` 即通过。
- **编辑器**：VS Code 装一个 YAML 插件，让它把 Tab 和缩进错误直接标红。

---

## 配置放在哪里：订阅文件、覆写与「改了不生效」

### 直接运行内核

mihomo 内核默认的工作目录是 `~/.config/mihomo/`（Windows 为 `%USERPROFILE%\.config\mihomo`），配置文件名为 `config.yaml`。订阅下载的节点文件、规则集、GeoIP 数据库默认也放在这个目录。出于安全考虑，provider 的 `path` 只允许落在工作目录内，放到其他位置需要用 `SAFE_PATHS` 环境变量额外放行。

内核文件从 [mihomo Releases](https://github.com/MetaCubeX/mihomo/releases) 下载对应平台的版本：Windows 是 `.zip`，解压后重命名为 `mihomo.exe`；Linux / macOS 是 `.gz`，需要先解压并加上执行权限。macOS 如果提示无法验证开发者，可以去掉隔离属性。老 CPU 运行时报 `illegal instruction`，改用文件名带 `compatible` 的版本。

```bash
# Linux 示例（macOS 把文件名换成 darwin 对应的版本）
gunzip mihomo-linux-amd64-v1.19.31.gz
mv mihomo-linux-amd64-v1.19.31 mihomo
chmod +x mihomo
# 仅 macOS：去掉下载文件的隔离属性
xattr -d com.apple.quarantine mihomo
```

```bash
# Linux / macOS：只校验配置
./mihomo -d ~/.config/mihomo -t

# 前台运行，-f 可以另外指定配置文件
./mihomo -d ~/.config/mihomo -f ~/.config/mihomo/config.yaml
```

```powershell
# Windows PowerShell（在 mihomo.exe 所在目录执行）
.\mihomo.exe -d "$env:USERPROFILE\.config\mihomo" -t
```

### Clash Verge Rev 等图形客户端

以 Clash Verge Rev 为例，它的数据目录名为 `io.github.clash-verge-rev.clash-verge-rev`，Windows 在 `%APPDATA%` 下，macOS 在 `~/Library/Application Support/` 下，Linux 一般在 `~/.local/share/` 下；也可以在设置页点「配置目录」直接打开。订阅文件存放在其中的 `profiles` 子目录。**订阅每次更新都会用新文件整体替换旧文件**，所以直接改订阅文件，下次更新就会丢。

它的官方文档给出的处理链是：

```text
订阅原文 → 应用设置 → 全局扩展配置 → 全局扩展脚本 → 订阅扩展配置 → 订阅扩展脚本 → 应用设置回写
```

两个关键结论：

1. **自定义内容放进扩展配置（YAML，旧版叫 Merge）或扩展脚本（JavaScript，旧版叫 Script）**，它们在每次订阅更新后都会重新执行。只想在前面加几条规则的话，新版把 prepend / append 移到了订阅右键菜单「编辑规则」的可视化编辑器里，扩展配置只负责字段的覆写与合并。具体写法见 [Clash Verge Rev 使用指南](/posts/clash-verge-guide/) 和 [如何自定义规则](/posts/custom-rules/)；多机场合并、节点重命名等更适合交给 [订阅转换工具](/posts/subscription-management/)。
2. **有一批字段由应用设置接管**，链路最后会被界面上的值覆盖回去。官方文档列出的包括：`external-controller`、`external-controller-cors`、`secret`、`mixed-port`、`socks-port`、`port`、`redir-port`、`tproxy-port`、`mode`、`allow-lan`、`log-level`、`ipv6`、`unified-delay`，以及 `tun.enable` 和在 TUN 设置对话框里保存过的 `stack`、`device`、`auto-route`、`route-exclude-address`、`auto-redirect`、`auto-detect-interface`、`dns-hijack`、`strict-route`、`mtu`。**在 YAML 里改这些字段不会生效，要去设置页改。** 另外，开启「DNS 覆写」时，覆写页面中填了值的 `dns` 字段和 `hosts` 会替换订阅（包括你自己粘贴的本地配置）里的对应内容，且如果覆写页启用了 IPv6，`dns.ipv6` 也由应用接管，这时 dns 段应在 DNS 覆写页修改。

FlClash 等其他客户端也有各自的覆写入口和接管字段，名称和范围以对应项目的文档为准。

---

## 通用设置逐项说明

下表中的「内核默认」取自 mihomo 源码中的默认配置，客户端可能会写入自己的默认值。例如 Clash Verge Rev v2.5.5 的源码里，混合端口默认 7897、`unified-delay` 默认开启；它的 HTTP 外部控制器默认关闭，界面通过 Unix socket（macOS / Linux）或命名管道（Windows）和内核通信，在设置里打开「外部控制」后才会监听，默认地址为 `127.0.0.1:9097`。下文命令里的端口请换成你实际使用的值。

| 字段 | 作用 | 内核默认 | 建议 |
|------|------|----------|------|
| `mixed-port` | HTTP 与 SOCKS5 共用的代理端口 | 不监听 | 桌面端只开这一个即可 |
| `port` / `socks-port` | 单独的 HTTP / SOCKS 端口 | 不监听 | 一般不需要 |
| `redir-port` / `tproxy-port` | 透明代理端口 | 不监听 | 仅 Linux（redir 也支持 macOS）网关场景 |
| `allow-lan` | 允许局域网设备连接代理端口 | `false` | 需要共享给手机等设备时再开 |
| `bind-address` | `allow-lan` 开启时绑定的地址 | `"*"` | 保持 `"*"`；改成某个局域网 IP 后内核只在该 IP 上监听，不再监听 127.0.0.1，本机的系统代理也要改指向这个 IP |
| `mode` | `rule` / `global` / `direct` | `rule` | 保持 `rule` |
| `log-level` | `silent` / `error` / `warning` / `info` / `debug` | `info` | 日常 `info`，排障时临时 `debug` |
| `ipv6` | IPv6 总开关，关闭后内核不再解析 IPv6 地址 | `true` | 没有稳定 IPv6 时设 `false` |
| `external-controller` | RESTful API 监听地址 | 不开启 | `127.0.0.1:9090` |
| `secret` | API 访问密钥 | 空 | 必须设置，见下文 |
| `unified-delay` | 统一延迟，扣除握手差异 | `false` | `true` |
| `tcp-concurrent` | 对解析出的所有 IP 并发建连，用最先成功的 | `false` | 按需开启 |
| `find-process-mode` | `always` / `strict` / `off` | `strict` | 路由器上建议 `off` |
| `geodata-mode` | GEOIP 使用 dat（`true`）还是 mmdb（`false`） | `false` | 保持默认 |
| `geo-auto-update` / `geo-update-interval` | 自动更新 Geo 数据库，间隔单位为小时 | `false` / `24` | 按需 |
| `profile.store-selected` | 记住 select 组的手动选择 | `true` | `true` |
| `profile.store-fake-ip` | 持久化 Fake-IP 映射 | 未开启 | 按需 |

### 入站端口与局域网共享

`mixed-port` 同时接受 HTTP 和 SOCKS5，系统代理、浏览器插件、命令行工具都连它即可（命令行怎么用见 [命令行与开发工具走代理](/posts/terminal-proxy/)）。`port`、`socks-port`、`mixed-port` 都不写时，内核不会监听任何代理端口。

开启 `allow-lan` 后，同一局域网的设备可以把代理设为「本机 IP + 端口」来共用。访问限制有两层：`lan-allowed-ips` / `lan-disallowed-ips` 按来源 IP 放行或拒绝，`authentication` 要求提供用户名和密码。如果这台机器有公网 IP（VPS、拨号拿到公网地址的软路由），两层都要加上，否则就是一个任何人都能用的开放代理：

```yaml
allow-lan: true
bind-address: "*"
lan-allowed-ips:          # 白名单：不在列表里的来源会被直接断开，本机回环也不例外
  - 192.168.0.0/16
  # 必须保留本机回环，否则本机的系统代理也会被拒绝
  - 127.0.0.1/8
  - ::1/128
lan-disallowed-ips:       # 黑名单，优先级高于白名单
  - 192.168.1.100/32
authentication:           # http / socks / mixed 入站的用户名和密码，只用英文字母、数字和符号
  - "user:change-me-long-password"
skip-auth-prefixes:       # 这些来源免验证
  - 127.0.0.1/8
  - ::1/128
  - 192.168.0.0/16        # 手机、电视的 Wi-Fi 代理多半填不了密码，局域网免验证
```

两层按场景取舍：只在家庭局域网里共享时，用 `lan-allowed-ips` 限制网段就够了；机器有公网 IP、又确实需要从外网连入时，外网来源必须经过 `authentication`，不要把它们放进 `skip-auth-prefixes`。Android、鸿蒙等系统的 Wi-Fi 手动代理没有填写账号密码的地方，所以局域网网段要放进 `skip-auth-prefixes`，否则手机会连不上。开启后还要在系统防火墙里放行 mihomo 或客户端的入站连接：Windows 第一次开启时一般会弹出防火墙提示，不要点「取消」。

### mode、log-level 与 ipv6

`mode: global` 让所有流量走 `GLOBAL` 组选中的策略，`direct` 则全部直连，两者都绕过 `rules`，只适合临时排障。`info` 级别已经会逐条记录每个连接命中的规则和出站；`debug` 会额外输出 DNS 查询等细节，日志量很大，排查完记得改回。`ipv6` 是总开关，设为 `false` 后，内核不再解析 IPv6 地址（内置 DNS 对 AAAA 查询返回空结果），TUN 也不再分配 IPv6 地址，因此绝大多数流量只会走 IPv4。宽带没有稳定 IPv6 时关掉更省心。

### external-controller 与 secret：面板的钥匙

`external-controller` 开启的 RESTful API 能做的事情很多：切换节点、查看全部连接（包括你访问的每个域名）、修改运行中的配置，甚至触发内核升级与重启。Yacd、metacubexd 等 Web 面板和图形客户端都靠它工作。

```yaml
external-controller: 127.0.0.1:9090
secret: "change-me-to-a-long-random-string"   # 只用英文字母、数字和符号
external-controller-cors:
  allow-origins:            # 只放行你实际使用的面板地址
    - "https://metacubex.github.io"
  allow-private-network: true
```

需要特别注意三点：

1. **只监听 `127.0.0.1`**。改成 `0.0.0.0` 等于把控制权交给整个局域网，如果机器有公网 IP 则是整个互联网。
2. **一定要设 `secret`**。内核默认的 CORS 设置允许任意来源（`allow-origins` 为 `*`）。没有密钥时，只要浏览器放行了本地网络访问，网页脚本就能读写这个接口。Chrome 从 142 版起，公网网页访问本机或局域网地址前会先弹出授权提示，其他浏览器的限制程度不一，不要把安全寄托在浏览器上。Clash Verge Rev 的默认 secret 是公开的占位值 `set-your-secret`（留空也会被改回这个值），它默认只允许少数几个面板域名跨域访问，但不要依赖这一点：如果你在设置里打开了外部控制，务必把 secret 改成自己的随机字符串。
3. 官方文档注明，`external-controller-unix`、`external-controller-pipe` 以及挂在 API 端口上的 `external-doh-server` **都不校验 secret**，启用前要确认只有本机可达。

验证密钥是否生效（把 9090 换成你实际的 external-controller 端口，Clash Verge Rev 打开外部控制后默认是 9097）：

```bash
# macOS / Linux：不带密钥应返回 401
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9090/version
# 带密钥应返回版本信息
curl -s -H "Authorization: Bearer 你的secret" http://127.0.0.1:9090/version
```

```powershell
# Windows PowerShell 5.1 里 curl 是 Invoke-WebRequest 的别名，要写 curl.exe，空设备用 NUL
curl.exe -s -o NUL -w "%{http_code}\n" http://127.0.0.1:9090/version
curl.exe -s -H "Authorization: Bearer 你的secret" http://127.0.0.1:9090/version
```

### unified-delay 与 tcp-concurrent

`unified-delay` 开启后，延迟测试会扣除连接握手带来的差异，让不同协议节点的数字更可比。它只改变测出来的数字，不会让节点变快，数字的含义见 [延迟测试数字的含义](/posts/latency-test-explained/)。`tcp-concurrent` 开启后，一个域名解析出多个 IP 时内核会同时向所有 IP 建连、用最先成功的那个，能减少个别 IP 不通时的等待。

### find-process-mode、Geo 数据与已移除的字段

`find-process-mode` 决定内核是否查找连接所属的进程，`PROCESS-NAME` 等进程规则依赖它：`always` 强制对所有连接查找，`strict` 由内核自行判断（默认），`off` 完全关闭。路由器转发的主要是局域网其他设备的流量，本机查不到对应进程，官方文档推荐路由器使用 `off`。

使用 `GEOIP`、`GEOSITE` 规则时，内核需要 Geo 数据库（数据库的来源和更新方式见 [GeoIP / GeoSite 数据库：原理与更新](/posts/geoip-geosite/)）。源码里的默认下载地址位于 GitHub Releases，国内首次启动可能下载失败，可以用 `geox-url` 换成 CDN 地址（下面用的域名与官方文档示例一致）：

```yaml
geodata-mode: false        # false 用 mmdb，true 用 dat
geo-auto-update: true
geo-update-interval: 24    # 单位：小时
geox-url:
  geoip: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat"
  geosite: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat"
  mmdb: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.metadb"
```

jsDelivr 各个子域在不同地区、不同时期的可达性不一。下载仍然失败时，可以在 `cdn.jsdelivr.net`、`fastly.jsdelivr.net`、`testingcf.jsdelivr.net` 之间换着试，或者改用自建镜像。文末规则集的地址同理。

网上的旧模板里常见两个已经失效的写法：

- **`global-client-fingerprint`**：v1.19.19 标记弃用，v1.19.27 移除。现在写了不会生效，日志会报错提示，应改为在每个节点里单独写 `client-fingerprint`。
- **策略组里的 `interface-name`、`routing-mark`**：v1.19.6 起从策略组移除，需要写在具体节点上。

---

## dns 段：只看骨架

DNS 是代理配置里最容易出问题的环节，本站已有专门文章：模式选择见 [Fake-IP vs Redir-Host](/posts/fake-ip-vs-redir-host/)，推荐配置与常见错误见 [各客户端 DNS 配置最佳实践](/posts/dns-best-practices/)。这里只梳理结构，方便你读懂订阅里的 dns 段。

```yaml
dns:
  enable: true                 # false 时不启用内置 DNS，使用系统 DNS
  listen: 127.0.0.1:1053       # 可选：开启 DNS 监听，127.0.0.1 仅本机可用，说明见下表
  ipv6: false                  # false 时对 AAAA 查询返回空结果
  enhanced-mode: fake-ip       # 不写时默认为 redir-host
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:              # 这些域名返回真实 IP
    - "*.lan"
    - "+.msftconnecttest.com"
  default-nameserver:          # 只能填 IP，用于解析下面各个 DoH 地址里的域名
    - 223.5.5.5
  nameserver:                  # 主力上游
    - https://doh.pub/dns-query
  nameserver-policy:           # 按域名指定上游，优先于 nameserver
    "+.internal.example.com": 10.0.0.1
  proxy-server-nameserver:     # 只用来解析节点服务器的域名
    - https://dns.alidns.com/dns-query
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `enable` | `false` | 不写 dns 段时内置 DNS 不启用 |
| `listen` | 不监听 | `127.0.0.1` 只接受本机查询，软路由上常由 dnsmasq 转发到这里；要让局域网设备直接查询需改为 `0.0.0.0:1053`，有公网 IP 的机器不要这样做，以免变成开放的 DNS 解析器 |
| `enhanced-mode` | `redir-host` | 想用 Fake-IP 必须显式写出 |
| `ipv6` | `false` | 是否返回 AAAA 记录。实际生效值是它与顶层 `ipv6` 的「与」：两者都为 `true` 才会返回 AAAA，顶层关掉时这里写 `true` 也无效 |
| `fake-ip-filter-mode` | `blacklist` | 还可选 `whitelist`、`rule` |
| `use-hosts` / `use-system-hosts` | `true` / `true` | 是否响应配置内与系统的 hosts |
| `respect-rules` | `false` | DNS 查询连接是否也走 rules，开启时必须配置 `proxy-server-nameserver` |
| `fallback-filter.geosite` | 无 | 已被官方标记为废弃，改用 `nameserver-policy` |

`proxy-server-nameserver` 值得单独配置：节点地址通常是域名，连接节点之前要先把它解析出来。给它一组稳定的国内 DoH，可以避免「解析节点域名本身也要走代理」的死循环。

---

## sniffer 与 tun 段

### sniffer：从流量里把域名找回来

在 TUN 或透明代理模式下，内核拿到的往往只有目标 IP：应用可能自带 DNS，浏览器可能用了内置 DoH（绕过了内核的 DNS，映射表里查不到）；Redir-Host 模式下内核只能靠 DNS 映射表把 IP 反查成域名，多个域名共用一个 IP 时容易认错。此时基于域名的规则就可能失效或误判。sniffer 的作用是读取 TLS 握手里的 SNI、HTTP 请求的 Host 或 QUIC 握手信息，把域名找回来。完整写法见文末的最小配置。

| 字段 | 作用 |
|------|------|
| `sniff` | 要嗅探的协议，仅支持 `HTTP`、`TLS`、`QUIC`，每项可设 `ports` 和 `override-destination` |
| `override-destination` | 是否用嗅探结果替换原目标，全局默认 `true`，可在各协议下单独覆盖 |
| `force-dns-mapping` | 对 Redir-Host 模式识别的流量强制嗅探 |
| `parse-pure-ip` | 对所有没有域名的流量强制嗅探 |
| `force-domain` | 强制嗅探的域名，支持 `+.example.com` 这类通配 |
| `skip-domain` / `skip-src-address` / `skip-dst-address` | 跳过特定域名、来源 IP 段、目标 IP 段 |

旧写法 `sniffing` 和 `port-whitelist` 已废弃，配置了 `sniff` 后它们不再生效。如果某个应用在开启嗅探后连接异常（常见于 SNI 与实际访问目标不一致的场景），把它的域名加进 `skip-domain`。

### tun：虚拟网卡

TUN 与系统代理的原理区别见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)，开了不生效的排查见 [TUN 模式不生效的常见原因](/posts/tun-not-working/)。文末最小配置里的 tun 段可以直接参考，这里说明各字段的含义：

| 字段 | 作用 | 说明 |
|------|------|------|
| `stack` | 协议栈 | 默认 `gvisor`；官方文档建议无问题时用 `mixed`（TCP 走 system，UDP 走 gvisor）。开着系统防火墙时 `system` / `mixed` 需要放行内核 |
| `auto-route` | 自动把全局流量路由进虚拟网卡 | 关掉则需自己改路由表 |
| `auto-detect-interface` | 自动识别真实出口网卡，避免流量回环 | 多网卡同时在线的设备建议手动指定 |
| `dns-hijack` | 把匹配的 DNS 请求导入内置 DNS，常写 `any:53` 与 `tcp://any:53` | 不写协议默认 UDP。macOS / Windows 无法自动劫持发往局域网地址的 DNS；Android 开启「私人 DNS」后也无法劫持 |
| `strict-route` | 严格路由 | 防泄漏更彻底，但可能让虚拟机等软件异常 |
| `route-exclude-address` | 排除网段 | 让局域网、公司内网不进入 TUN |
| `auto-redirect` | 用 iptables / nftables 重定向 TCP | 仅 Linux，需开启 `auto-route` |

TUN 需要管理员（root）权限。在 Clash Verge Rev 里，这些字段大多由 TUN 设置对话框接管，应在界面里修改。

---

## proxies：六种常见协议的最小写法

### 通用字段

| 字段 | 说明 |
|------|------|
| `name` | 必填，全局唯一。策略组和规则都靠它引用，**区分大小写、空格和 emoji** |
| `type` | 必填，协议类型 |
| `server` / `port` | 必填，服务器地址与端口 |
| `udp` | 是否允许 UDP 走该节点，**默认 `false`**；TUIC 等基于 UDP 的协议默认开启 |
| `ip-version` | `dual`（默认）/ `ipv4` / `ipv6` / `ipv4-prefer` / `ipv6-prefer` |
| `client-fingerprint` | uTLS 指纹，适用于 VMess、VLESS、Trojan、AnyTLS，可选 `chrome`、`firefox`、`safari`、`random` 等 |
| `skip-cert-verify` | 跳过证书校验。会让中间人攻击成为可能，自签证书更稳妥的做法是用 `fingerprint` 固定证书 |
| `dialer-proxy` | 先经过另一个节点或策略组再连本节点，见下文 |

`udp` 的默认值很关键：官方文档说明，UDP 请求遇到不支持 UDP 的节点时，**规则会继续往下匹配**。节点忘了写 `udp: true`，游戏、语音、QUIC 流量就可能悄悄落到后面的规则甚至直连上。

### 最小可用写法

以下地址、密码、UUID 全部是占位值，请替换为服务端提供的真实参数，字段写法以官方文档为依据：

```yaml
proxies:
  # Shadowsocks（2022 系列加密方式的 password 必须是服务端生成的 base64 密钥）
  - name: "SS"
    type: ss
    server: ss.example.com
    port: 8388
    cipher: aes-128-gcm
    password: "your-password"
    udp: true

  # VMess + WebSocket + TLS
  - name: "VMess-WS"
    type: vmess
    server: vmess.example.com
    port: 443
    uuid: 00000000-0000-0000-0000-000000000000
    alterId: 0                 # 非 0 会启用旧版协议
    cipher: auto
    udp: true
    tls: true
    servername: vmess.example.com
    client-fingerprint: chrome
    network: ws
    ws-opts:
      path: /your-path
      headers:
        Host: vmess.example.com

  # VLESS + Reality + Vision
  - name: "VLESS-Reality"
    type: vless
    server: 203.0.113.10
    port: 443
    uuid: 00000000-0000-0000-0000-000000000000
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    servername: www.example.com     # 与服务端 serverNames 之一一致
    client-fingerprint: chrome      # Reality 不能留空
    reality-opts:
      public-key: "服务端私钥对应的公钥"
      short-id: "服务端 shortIds 之一"

  # Trojan（TLS 强制开启）
  - name: "Trojan"
    type: trojan
    server: trojan.example.com
    port: 443
    password: "your-password"
    udp: true
    sni: trojan.example.com
    client-fingerprint: chrome

  # Hysteria2
  - name: "Hysteria2"
    type: hysteria2
    server: hy2.example.com
    port: 443
    password: "your-password"
    sni: hy2.example.com
    # up: "30 Mbps"            # up、down 都不写则使用 BBR 拥塞控制
    # down: "200 Mbps"
    # obfs: salamander
    # obfs-password: "your-obfs-password"

  # TUIC v5（v5 用 uuid + password，v4 用 token，二者不能同时写）
  - name: "TUIC-v5"
    type: tuic
    server: tuic.example.com
    port: 443
    uuid: 00000000-0000-0000-0000-000000000000
    password: "your-password"
    sni: tuic.example.com
    alpn: [h3]
    udp-relay-mode: native          # native 或 quic
    congestion-controller: bbr      # cubic / new_reno / bbr
```

| 协议 | 易错点 |
|------|--------|
| SS | `cipher` 必须与服务端一致；2022 系列对密钥长度有要求，随便填会直接加载失败 |
| VMess | 现代服务端一般用 `alterId: 0`；传输层参数放在 `ws-opts`、`grpc-opts` 等对应字段里 |
| VLESS + Reality | SNI 字段叫 `servername` 而不是 `sni`；公钥格式不对会报 `invalid REALITY public key` |
| Trojan | SNI 字段叫 `sni`；证书域名与 `sni` 不符会握手失败 |
| Hysteria2 | 写了 `up` / `down` 就按设定速率发送，填得比实际带宽高反而会加剧丢包；端口跳跃用 `ports` 与 `hop-interval` |
| TUIC | v4 与 v5 字段互斥；`alpn` 需与服务端一致 |

另外，mihomo 官方文档在 TLS 字段页的 Reality 部分注明：由于 Xray-core 的刻意不兼容改动，mihomo 不再考虑与 Xray v26.7.11 及之后版本服务端的 Reality 兼容性。如果自建服务端较新、客户端连不上，可按文档建议换用其他服务端实现或其他协议。协议本身的原理见 [VLESS + Reality 深度解析](/posts/vless-reality-deep-dive/)。

---

## proxy-providers：把订阅变成节点池

`proxy-providers` 把一个订阅链接或本地文件变成一个「节点集合」，策略组再通过 `use` 引入。这样订阅更新只会刷新节点，你自己写的策略组和规则不受影响，这也是手写配置时管理机场节点最干净的方式。

```yaml
proxy-providers:
  airport:
    type: http                                  # http / file / inline
    url: "https://example.com/your-subscription"
    path: ./proxy_providers/airport.yaml        # 可省略，默认按 url 的 MD5 命名
    interval: 86400                             # 自动更新间隔，单位：秒
    proxy: DIRECT                               # 下载订阅时走哪个出站，不写则按 rules 匹配
    header:
      User-Agent:
        - "mihomo/1.19.31"
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 300                             # 开启且不写时默认 300 秒
      timeout: 5000                             # 单位：毫秒
      lazy: true                                # 默认 true：没被使用时不测
    filter: "(?i)港|hk|日本|jp|新加坡|sg"         # 只保留匹配的节点
    exclude-filter: "(?i)剩余|到期|官网|套餐"     # 去掉匹配的节点
    exclude-type: "ss|http"                     # 按类型排除，不支持正则
    override:
      udp: true
      additional-prefix: "[机场] "
      # dialer-proxy: 某个节点或组
```

几个值得了解的细节：

- **订阅内容格式**：内核读取的是订阅内容里的 `proxies:` 列表，所以机场下发完整的 Clash 配置也能用，其中的策略组和规则会被忽略；读不到时还会尝试按 V2Ray 分享链接列表解析。有的机场会按 User-Agent 返回不同格式，可以用 `header` 调整。
- **`override`** 能批量改写节点参数，支持 `udp`、`skip-cert-verify`、`dialer-proxy`、`ip-version`、名称前后缀 `additional-prefix` / `additional-suffix`、正则改名 `proxy-name` 等。
- **provider 名称不要和策略组重名**，否则会出现 `duplicate provider name` 一类的冲突。
- **首次下载失败不会导致内核退出**，日志会记录 `initial proxy provider ... error`。之前下载成功过的，会继续使用 `path` 里的缓存文件；从未成功过的，只引用它的策略组会因为没有节点而回退到 `COMPATIBLE`（等同直连）。

---

## proxy-groups：四种组与 relay 的替代写法

### 通用字段

| 字段 | 说明 |
|------|------|
| `name` / `type` | 必填；名称含特殊符号时用引号包裹 |
| `proxies` | 引入节点或其他策略组，可以引用写在后面的组，但不能形成环 |
| `use` | 引入 proxy-providers |
| `url` | 健康检查地址。不写时，含 `use` 的组先沿用 provider 的 health-check 地址，都没有才默认 `https://www.gstatic.com/generate_204` |
| `interval` | 健康检查间隔（秒）。组里用 `proxies` 列出的节点，非 select 类型不写时按 300 秒处理；只用 `use` 引入 provider 的组不会自动补默认值，见下方说明 |
| `lazy` | 默认 `true`，组没被使用时不测试 |
| `timeout` / `max-failed-times` | 检查超时（毫秒）/ 失败多少次后触发强制检查，后者默认 5 |
| `expected-status` | 期望的 HTTP 状态码，如 `204`、`200/302`、`400-503` |
| `include-all` | 引入全部单节点和全部 provider，相当于同时开启 `include-all-proxies` 与 `include-all-providers`；按名称排序，不包含策略组 |
| `filter` | 正则筛选，只作用于 `use` 引入的 provider 节点和 `include-all-proxies` 引入的节点 |
| `exclude-filter` | 按名称正则排除 |
| `exclude-type` | 按类型排除，不支持正则，不区分大小写。策略组里要写适配器类型名，如 `Shadowsocks\|Http\|Vmess`；provider 里写的是配置中的 type，如 `ss\|http`，两者不能混用 |
| `empty-fallback` | 组为空时的回退，默认 `COMPATIBLE`，只能填节点不能填组 |
| `hidden` / `icon` | 供面板隐藏组或显示图标，需要前端适配 |

**只用 `use` 引入节点的 url-test / fallback 组要特别注意**：按源码，「不写 interval 就按 300 秒」只对 `proxies` 里列出的节点生效。纯 `use` 的组里写了 `url` 时，会把组的 `interval`（不写就是 0）交给 provider；provider 自己没开 `health-check` 时间隔就保持 0，不做任何定时测速，组只会在连续失败达到 `max-failed-times` 后被动测一次，看起来就像「自动选择从不切换」。稳妥的做法是两边都写：组里同时写 `url` 和 `interval`，provider 的 `health-check` 里也开启 `enable` 并设置 `url`，文末最小配置就是这样写的。

### 各类型的行为与适用场景

| 类型 | 如何选节点 | 适合 |
|------|------------|------|
| `select` | 手动选择；`default-selected` 可指定初始项 | 主入口，以及 AI、流媒体等需要固定出口的服务 |
| `url-test` | 选延迟最低的，`tolerance` 为切换容差（毫秒） | 日常浏览等对出口 IP 变化不敏感的流量 |
| `fallback` | 按列表顺序选第一个可用的 | 主备切换、需要出口 IP 尽量稳定 |
| `load-balance` | 按 `strategy` 分散到多个节点 | 多个同质节点分摊不同网站的连接；想让同一网站的多线程下载也分散开，需要 `strategy: round-robin`（出口 IP 会随连接变化） |
| `relay` | 已移除 | 改用 `dialer-proxy` |

```yaml
proxy-groups:
  - name: "自动选择"
    type: url-test
    include-all: true
    exclude-filter: "(?i)剩余|到期|官网"
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50            # 新节点至少快 50 ms 才切换，减少来回跳
    lazy: true

  - name: "负载均衡"
    type: load-balance
    use: [airport]
    filter: "(?i)港|hk"
    strategy: consistent-hashing
```

`load-balance` 的 `strategy` 有三个取值，不写时使用 `consistent-hashing`：

- **`consistent-hashing`**：同一目标地址固定走同一个节点（目标是域名时按主域名计算），适合「换 IP 就要求重新验证」的网站。
- **`round-robin`**：请求轮流分给各个节点，分散得更均匀，但同一网站的连接会从不同 IP 发出，容易触发登录态失效或风控。
- **`sticky-sessions`**：同一「来源地址 + 目标地址」固定走同一个节点，缓存 10 分钟过期。

url-test 与 fallback 的取舍、检测间隔怎么设，见 [故障检测与自动切换策略](/posts/failover-strategies/)。

### relay 已移除，改用 dialer-proxy

relay 类型在 v1.18.6 被标记弃用，**v1.19.17 起彻底移除**。新内核遇到 `type: relay` 会直接报错，整份配置加载失败。本站 [代理链与链式代理](/posts/proxy-chain/) 一文里的 relay 写法只适用于旧内核，原理部分仍然适用。

替代方案是写在节点上的 `dialer-proxy`：「连这个节点之前，先通过另一个节点或策略组」。

```yaml
proxies:
  - name: "自建落地"
    type: ss
    server: exit.example.com
    port: 8388
    cipher: aes-128-gcm
    password: "your-password"
    dialer-proxy: "中转选择"   # 先连到该组选中的节点，再由它连到自建落地

proxy-groups:
  - name: "中转选择"
    type: select
    use: [airport]
```

效果是：目标网站看到的是「自建落地」的 IP，本地运营商只看到你在连机场节点。需要注意：

- `dialer-proxy` **只能写在节点上**（或通过 provider 的 `override` 批量设置），写在策略组上不会生效，日志会提示。
- 引用了不存在的名称会报 `dialer-proxy [...] not found`，互相引用成环会报 `circular dialer-proxy dependency`。
- 官方文档建议：被中转的落地节点优先用 SS（AEAD）或 VMess 这类简单协议，避免 Hysteria2、TUIC、WireGuard 等 UDP 类协议和 Reality、ShadowTLS 等 TLS 伪装类协议，因为中转节点未必能正常承载它们。

---

## rule-providers 与 rules：结构速览

规则的写法、顺序原则和调试方法已在 [如何自定义规则](/posts/custom-rules/) 和 [Clash 规则集详解](/posts/clash-rule-providers/) 中展开。结构上，`rule-providers` 下每个规则集有 `type`（`http` / `file` / `inline`）、`behavior`（`domain` / `ipcidr` / `classical`）、`format`、`url`、`path`、`interval` 几个字段，再由 `rules` 里的 `RULE-SET,名称,策略` 引用，文末的最小配置就是完整示例。这里只补充几处容易忽略的点：

- `format` 不写时默认是 `yaml`。下载的是纯文本列表却没写 `format: text`，规则集会解析失败。
- `mrs` 是 mihomo 的二进制格式，加载快、占内存少，但只支持 `domain` 和 `ipcidr` 两种 behavior。
- `type: inline` 可以直接在 `payload` 里写规则，不需要外部文件。
- 规则里的策略段（`MATCH,策略` 是第二段，其余规则一般是第三段，写在 `no-resolve` 等附加参数之前）必须是已存在的节点、策略组或内置策略（`DIRECT`、`REJECT`、`REJECT-DROP`、`PASS` 等），名称区分大小写。
- 按源码，rule-provider 不写 `proxy` 时，下载请求会像普通连接一样按 `rules` 匹配出站（在文末最小配置里会落到「漏网之鱼」）。日志里出现规则集下载失败时，可以按上文换一个 jsDelivr 子域，或者用 `proxy` 显式指定出站，例如 `proxy: DIRECT` 或 `proxy: 节点选择`。

---

## 把各段串起来：一份可直接运行的最小配置

下面的配置把前面各段串在一起，保存为 `config.yaml` 就能被内核加载。它刻意用 MRS 规则集代替 `GEOIP` / `GEOSITE`，首次启动不必下载 Geo 数据库。使用前替换三处：`secret`、自建节点参数、订阅地址。订阅地址未替换时，只引用订阅的「自动选择」组会回退为 `COMPATIBLE`（等同直连），而它正是「节点选择」默认选中的第一项，所以请先替换订阅地址，或在面板里手动选中自建节点。如果日志提示规则集下载失败，处理方法见上一节。

```yaml
# ========== 通用设置 ==========
mixed-port: 7890                 # 系统代理 / 命令行连这个端口
allow-lan: false                 # 不对局域网开放
mode: rule
log-level: info
ipv6: false                      # 网络有稳定 IPv6 再改为 true
external-controller: 127.0.0.1:9090
secret: "change-me-to-a-long-random-string"   # 只用英文字母、数字和符号
unified-delay: true
tcp-concurrent: true
find-process-mode: strict
profile:
  store-selected: true           # 重启后保留手动选择的节点

# ========== DNS ==========
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:                # 这些域名返回真实 IP
    - "*.lan"
    - "*.local"
    - "+.msftconnecttest.com"
    - "+.msftncsi.com"
    - "time.*.com"
    - "ntp.*.com"
  default-nameserver:            # 纯 IP，用来解析下面的 DoH 域名
    - 223.5.5.5
    - 119.29.29.29
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  proxy-server-nameserver:       # 专门解析节点域名
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query

# ========== 域名嗅探 ==========
sniffer:
  enable: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]

# ========== TUN（默认关闭；开启需管理员权限）==========
tun:
  enable: false
  stack: mixed
  auto-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53
    - tcp://any:53

# ========== 手写节点 ==========
proxies:
  - name: "自建-SS"
    type: ss
    server: ss.example.com
    port: 8388
    cipher: aes-128-gcm
    password: "your-password"      # 替换为服务端的真实密码
    udp: true

# ========== 订阅 ==========
proxy-providers:
  airport:
    type: http
    url: "https://example.com/your-subscription"   # 替换为你的订阅地址
    path: ./proxy_providers/airport.yaml
    interval: 86400
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 300
      lazy: true
    exclude-filter: "(?i)剩余|到期|官网|套餐"

# ========== 策略组 ==========
proxy-groups:
  - name: "节点选择"              # 主入口，手动选择
    type: select
    proxies:
      - 自动选择
      - 故障转移
      - 自建-SS
      - DIRECT
    use:
      - airport

  - name: "自动选择"              # 订阅里延迟最低的节点
    type: url-test
    use:
      - airport
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: "故障转移"              # 优先自建，不可用时依次换订阅节点
    type: fallback
    proxies:
      - 自建-SS
    use:
      - airport
    url: https://www.gstatic.com/generate_204
    interval: 300

  - name: "漏网之鱼"              # 未命中任何规则的流量
    type: select
    proxies:
      - 节点选择
      - DIRECT

# ========== 规则集 ==========
rule-providers:
  private-domain:
    type: http
    behavior: domain
    format: mrs
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs"
    path: ./rule_providers/private-domain.mrs
    interval: 86400
  private-ip:
    type: http
    behavior: ipcidr
    format: mrs
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/private.mrs"
    path: ./rule_providers/private-ip.mrs
    interval: 86400
  cn-domain:
    type: http
    behavior: domain
    format: mrs
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.mrs"
    path: ./rule_providers/cn-domain.mrs
    interval: 86400
  cn-ip:
    type: http
    behavior: ipcidr
    format: mrs
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/cn.mrs"
    path: ./rule_providers/cn-ip.mrs
    interval: 86400

# ========== 规则（自上而下，命中即停）==========
rules:
  - RULE-SET,private-domain,DIRECT
  - RULE-SET,private-ip,DIRECT,no-resolve
  - RULE-SET,cn-domain,DIRECT
  - RULE-SET,cn-ip,DIRECT
  - MATCH,漏网之鱼
```

使用方式：

1. **纯内核**：放进 `~/.config/mihomo/config.yaml`，先 `mihomo -d ~/.config/mihomo -t` 校验，再正常启动，把系统代理指向 `127.0.0.1:7890`。
2. **Clash Verge Rev**：在订阅页新建一个本地配置并粘贴内容。注意端口、`secret`、TUN 等字段，以及开启「DNS 覆写」后的 dns 段，会以设置页为准，不必和上面保持一致。
3. **验证**：打开连接页或面板，访问国内网站应命中 `RULE-SET,cn-domain`，访问境外网站应命中 `MATCH` 并显示所选节点。

---

## 常见报错与排查

| 报错关键词 | 原因 | 处理 |
|------------|------|------|
| `found character that cannot start any token` | 用了 Tab 缩进，或行首有非法字符 | 把 Tab 全部换成空格 |
| `could not find expected ':'` | 冒号后缺空格，或上一行结构没闭合 | 检查报错行和它的前一行 |
| `mapping values are not allowed in this context` | 值里有未加引号的「冒号 + 空格」，或缩进错位 | 给值加引号，对齐缩进 |
| `mapping key "..." already defined at line N` | 同一层级出现重复键 | 合并两段内容 |
| `proxy group[N]: 组名: '某名称' not found` | 组的 `proxies` 里引用了不存在的节点或组 | 逐字核对名称，包括空格、emoji、全半角 |
| `rules[N] [...] error: proxy [...] not found` | 规则指向的策略不存在 | 名称区分大小写，如 `Proxy` 与 `PROXY` |
| `rule set [...] not found` | `RULE-SET` 引用了未定义的 rule-provider | 在 `rule-providers` 里补上定义 |
| `is the duplicate name` / `the duplicate name` | 节点或组重名 | 改名，订阅节点可用 `additional-prefix` |
| `loop is detected in ProxyGroup` | 策略组互相引用成环 | 拆掉其中一个方向的引用 |
| `The group [...] with relay type was removed` | 使用了已移除的 relay 组 | 改用 `dialer-proxy` |
| `global-client-fingerprint` configuration is removed | 使用了已移除的全局指纹字段 | 删掉，改在节点上写 `client-fingerprint` |
| `Start Mixed(http+socks) server error` | 端口被占用 | 见下方命令 |

YAML 报错里的行号指向的是**解析器发现问题的位置**，真正的错误常常在它上面一两行。

**端口被占用**时，Linux 与 macOS 的报错里通常带有 `address already in use`，Windows 上一般是 `Only one usage of each socket address ... is normally permitted`，中文系统显示为「通常每个套接字地址(协议/网络地址/端口)只允许使用一次」，搜索日志时用「套接字地址」即可。先找出占用端口的进程（命令里的 7890 换成你的 mixed-port，Clash Verge Rev 默认是 7897）：

```powershell
# Windows PowerShell
Get-NetTCPConnection -LocalPort 7890 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
Get-Process -Id 12345          # 12345 换成上一条输出的 OwningProcess
```

```bash
# macOS / Linux
lsof -nP -iTCP:7890 -sTCP:LISTEN
# Linux 也可以用
ss -lntp | grep 7890
```

最常见的情况是同时开着两个 Clash 系客户端，或者上一次的内核进程没有退出。关掉多余的实例，或者换一个端口。

**external-controller 暴露**不会报错，所以更需要主动检查。在局域网另一台设备上执行下面的命令，IP 换成代理所在机器的局域网 IP，9090 换成你实际的 external-controller 端口（Clash Verge Rev 打开外部控制后默认是 9097，可在设置页查看）：

```bash
# macOS / Linux
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.1.10:9090/version
```

```powershell
# Windows PowerShell
curl.exe -s -o NUL -w "%{http_code}\n" http://192.168.1.10:9090/version
```

返回 `000` 只说明这个地址和端口连不上，请先确认端口没填错，再下「没有对外暴露」的结论；返回 `401` 说明对外可达但有密钥保护；返回 `200` 说明任何人都能控制你的内核，应立即把 `external-controller` 改回 `127.0.0.1` 并设置 `secret`。

---

## 常见问题（FAQ）

### 我在配置里改了 mixed-port 和 allow-lan，为什么没生效？

如果你用的是 Clash Verge Rev，这两个字段属于「应用设置接管」的范围，处理链的最后一步会用设置页的值覆盖回去。端口、局域网、日志等级、TUN 开关等请在设置页修改。纯内核运行时不存在这个问题，修改后重载配置即可。

### 订阅自带了 proxy-groups，我还要自己写吗？

不一定。如果订阅自带的分组和规则够用，只需要用订阅右键菜单的「编辑规则」或扩展脚本在前面插几条自定义规则。如果你想完全掌控分组，可以把订阅当作 `proxy-providers` 引入，自己写策略组和规则；这种做法下订阅更新只会刷新节点。两种思路没有对错，取决于你愿意花多少时间维护。

### 为什么游戏或语音的 UDP 流量没有走代理？

先检查三件事：节点是否写了 `udp: true`（默认是 `false`，不支持 UDP 时规则会继续往下匹配）；是否开启了 TUN（系统代理基本只承载 TCP）；所在策略组是否设置了 `disable-udp`。三者都没问题，再看节点和服务端本身是否支持 UDP 转发。游戏场景的更多讨论见 [代理能打游戏吗](/posts/gaming-and-proxy/)。

### 旧配置里的 relay 组报错了，怎么迁移？

把 relay 链条里「后面的节点」改成在节点上写 `dialer-proxy`，指向「前面的节点或组」。如果 relay 里用的是两个 select 组，官方文档给出的迁移方式是：把后一组的节点放进一个 `inline` 类型的 proxy-provider，用 `override.dialer-proxy` 统一指向前一组，再让一个 select 组 `use` 这个 provider。

### 节点名里的 emoji 和特殊符号要加引号吗？

emoji 本身不需要，但名称以 `[`、`*`、`&`、`!`、`|`、`>`、`'`、`"`、`%`、`@` 等符号开头，或中间含有「冒号 + 空格」「空格 + 井号」时必须加引号。统一给名称加双引号最省事。另外，规则和策略组引用名称时必须逐字一致，从面板里复制往往比手打可靠。

### GEOIP / GEOSITE 和 RULE-SET 该用哪个？

两者都能用，也可以混用。`GEOIP`、`GEOSITE` 依赖本地 Geo 数据库，写法短；`RULE-SET` 按需下载单个分类的规则集，更新粒度更细，配合 MRS 格式加载也快。规则集的选择与对比见 [常用规则集推荐与对比](/posts/popular-rulesets/)，Geo 数据库本身见 [GeoIP / GeoSite 数据库：原理与更新](/posts/geoip-geosite/)。

### 自动选择组一直在几个节点之间来回切换，正常吗？

多数是延迟相近的节点在互相超越。给 url-test 组设 `tolerance`（比如 50 ms），`interval` 不要太短；需要出口 IP 稳定就改用 fallback 或 select。原因拆解见 [延迟测试数字的含义](/posts/latency-test-explained/)。

---

## 外部参考

- [mihomo 官方文档（MetaCubeX Wiki）](https://wiki.metacubex.one/) — 本文各字段的一手依据，包括 [全局配置](https://wiki.metacubex.one/config/general/)、[DNS](https://wiki.metacubex.one/config/dns/)、[TUN](https://wiki.metacubex.one/config/inbound/tun/)、[域名嗅探](https://wiki.metacubex.one/config/sniff/)、[出站代理](https://wiki.metacubex.one/config/proxies/)、[策略组](https://wiki.metacubex.one/config/proxy-groups/)、[代理集合](https://wiki.metacubex.one/config/proxy-providers/)、[规则集合](https://wiki.metacubex.one/config/rule-providers/)、[路由规则](https://wiki.metacubex.one/config/rules/)
- [dialer-proxy 文档](https://wiki.metacubex.one/config/proxies/dialer-proxy/) — 链式代理写法与 relay 迁移示例
- [TLS 与 Reality 字段](https://wiki.metacubex.one/config/proxies/tls/) — client-fingerprint 适用范围与 Reality 兼容性说明
- [负载均衡策略组](https://wiki.metacubex.one/config/proxy-groups/load-balance/) — 三种 strategy 的分配方式
- [mihomo 官方完整示例配置 config.yaml](https://github.com/MetaCubeX/mihomo/blob/Meta/docs/config.yaml) — 所有字段的注释版参考
- [mihomo Releases](https://github.com/MetaCubeX/mihomo/releases) — 版本更新与字段弃用、移除说明
- [Clash Verge Rev：扩展配置与脚本](https://www.clashverge.dev/guide/extend.html) — 处理链、应用接管字段列表与 DNS 覆写的优先级
- [Chrome 142 发布说明](https://developer.chrome.com/release-notes/142) 与 [Local Network Access 权限提示](https://developer.chrome.com/blog/local-network-access) — 浏览器对本机、局域网请求的新限制
- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) — 示例中使用的 MRS 规则集与 Geo 数据库
- 站内相关：[Clash Verge Rev 使用指南](/posts/clash-verge-guide/) · [Clash 系列全解](/posts/clash-family/) · [Clash 规则集详解](/posts/clash-rule-providers/) · [各客户端 DNS 配置最佳实践](/posts/dns-best-practices/) · [2026 各平台客户端推荐](/posts/client-recommendations-2026/)
