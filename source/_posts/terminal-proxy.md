---
title: "命令行与开发工具走代理：终端、Git、npm、pip、Docker 配置大全"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 进阶技巧
tags:
  - 配置
  - 教程
  - Docker
  - TUN
  - Git
  - 终端
excerpt: "开了系统代理，终端里的 git clone 和 npm install 依然超时？多数命令行工具不读系统代理，只认环境变量或自身配置。本文讲清环境变量规则与 socks5h，并逐一给出 Git、npm、pip、Go、Docker、WSL2 的配置方法。"
index_img: /images/posts/terminal-proxy.svg
---

> **摘要**：浏览器能打开 GitHub，终端里的 `git clone`、`npm install` 却依旧超时——这是开发者最常遇到的代理困惑。原因在于系统代理只是一条「公告」，多数命令行工具根本不看它，只读环境变量或自己的配置文件。本文先讲清本地端口、socks5 与 socks5h 的区别、环境变量的大小写与 `no_proxy` 规则，再逐一给出 shell、Git、npm / pnpm / yarn、pip、Go、Homebrew / apt / dnf、Docker、WSL2 的配置方法，最后是排障对照表和「干脆不走代理」的镜像源方案。

---

## 为什么开了系统代理，终端还是不走代理

系统代理的本质是把代理地址写进操作系统的一块「公告栏」：Windows 写在 WinINet 的注册表设置里，macOS 写在网络偏好设置里。浏览器、Electron 应用会主动读这块公告栏，但绝大多数命令行工具不会——它们启动时只看**自己进程的环境变量**，或者自己的配置文件（Python 系工具在 Windows / macOS 上是例外，见 pip 一节）。两种模式的完整原理见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)，本文只关心开发工具。

| 工具 | 从哪里读代理 | 读系统代理吗 |
|------|-------------|-------------|
| curl / wget | 环境变量 | 否 |
| Git（HTTPS 远程） | `http.proxy` 配置，未设置时回落到环境变量 | 否 |
| Git（SSH 远程） | `~/.ssh/config` 的 `ProxyCommand` | 否，也不读环境变量 |
| npm / pnpm | 自身配置，未设置时读环境变量 | 否 |
| yarn 1.x | 以自身配置为主 | 否 |
| pip 及其他 Python 工具 | `--proxy`、配置文件、环境变量；都没有时读系统代理 | 仅 Windows / macOS，且未设代理环境变量时 |
| Go 工具链 | 环境变量 | 否 |
| Node.js 程序本身 | 默认都不读，需显式开启 | 否 |
| `docker pull` | Docker 守护进程自己的配置 | 仅 Docker Desktop 可选跟随 |

所以解决思路有四条：

1. **环境变量**：一次设置，多数 CLI 生效，适合日常终端；
2. **工具自身配置**：持久、优先级更高，适合 Git、npm、Docker 这类长期需要的工具；
3. **TUN 模式**：在网络层接管，所有程序都走，不需要逐个配置；
4. **镜像源**：干脆不走代理，只适用于公共包仓库。

---

## 准备：本地端口与代理地址写法

所有配置都要填一个本机代理地址，形如 `http://127.0.0.1:端口`。端口在代理客户端里找：

| 客户端 / 内核 | 配置项 | 常见值 | 在哪看 |
|--------------|--------|--------|--------|
| mihomo（配置文件） | `mixed-port`，同时接受 HTTP 与 SOCKS5；也可能是分开的 `port` / `socks-port` | 由配置文件决定，订阅里常见 7890 | 配置文件开头 |
| Clash Verge Rev | 端口设置 | 默认混合端口 7897（见官方 FAQ）；旧版本和不少教程写的是 7890 | 设置 → Clash 设置 → 端口设置 |
| v2rayN | 本地混合监听端口 | 10808。7.3.0 起 SOCKS 与 HTTP 合并为同一个入站；更早版本是 SOCKS 10808 + HTTP 10809 | 设置 → 参数设置，或主界面状态栏 |
| sing-box | `mixed` 入站的 `listen_port` | 无统一默认值 | 配置文件 `inbounds` |

> 默认值会随版本和订阅变化，**一律以客户端界面显示为准**。本文示例统一写 `7890`，请替换成你的实际端口。mihomo 各端口字段的含义见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)。

确认端口在监听，再用 `-x` 显式指定代理做一次测试：

```bash
# Linux
ss -lntp | grep 7890
# macOS
lsof -nP -iTCP:7890 -sTCP:LISTEN
# 显式走代理请求一次，能返回响应头说明端口和节点都正常
curl -x http://127.0.0.1:7890 -I https://www.google.com
```

```powershell
# Windows（PowerShell 里请写 curl.exe，原因见 FAQ）
netstat -ano | findstr 7890
curl.exe -x http://127.0.0.1:7890 -I https://www.google.com
```

### http、socks5 与 socks5h：域名在哪里解析

代理地址前面的协议头决定了**目标域名由谁来解析**，这直接关系到 DNS 泄漏和 DNS 污染：

| 写法 | 协议 | 目标域名由谁解析 | 说明 |
|------|------|-----------------|------|
| `http://127.0.0.1:7890` | HTTP 代理，HTTPS 目标走 CONNECT 隧道 | 代理端 | 客户端把域名原样发给代理，本地不查 DNS |
| `socks5://127.0.0.1:7890` | SOCKS5 | **本机** | 先在本地解析成 IP 再交给代理，被污染的域名会拿到错误 IP |
| `socks5h://127.0.0.1:7890` | SOCKS5 | 代理端 | 末尾的 `h` 即 hostname，交给代理解析 |

由此得出三条实用结论：

- **环境变量优先写 `http://`**：兼容的工具最多，而且天然是远程解析。mihomo 的 mixed-port 和 v2rayN 7.3.0 起的本地端口都同时接受 HTTP 与 SOCKS5，不用单独开 SOCKS 端口。
- **必须用 SOCKS 时写 `socks5h://`**：但不是所有工具都认识 `socks5h` 这个写法，遇到报错就换回 `http://`。
- **`https_proxy` 的值也写 `http://`**：变量名里的 https 指「访问 https 网站时用哪个代理」，不是「用 TLS 连接代理」。本地 mixed 端口是明文代理，写成 `https://127.0.0.1:7890` 会让客户端对它发起 TLS 握手而失败。

本地解析带来的隐私问题见 [DNS 泄漏是什么、怎么检测、怎么防](/posts/dns-leak/)。

---

## 环境变量：约定俗成，而非标准

`http_proxy` 这组变量没有正式标准，是各工具多年来互相模仿形成的惯例，所以细节各不相同。

### 四个变量

| 变量 | 作用 |
|------|------|
| `http_proxy` | 访问 `http://` 地址时使用的代理 |
| `https_proxy` | 访问 `https://` 地址时使用的代理，值通常仍是 `http://...` |
| `all_proxy` | 没有对应协议变量时的兜底，常填 SOCKS 地址；Go 等工具不读它 |
| `no_proxy` | 不走代理的主机列表，逗号分隔 |

### 大小写：两种都设最保险

| 工具 | 小写 | 大写 | 备注 |
|------|------|------|------|
| curl | 读 | 除 `HTTP_PROXY` 外都读 | 出于安全考虑：CGI 环境里，请求头 `Proxy:` 会变成环境变量 `HTTP_PROXY`，可被远端注入 |
| wget | 读 | 不读 | |
| Python（urllib / requests） | 读 | 读 | 两者都有且不一致时小写优先；CGI 环境下忽略大写 `HTTP_PROXY`；Windows / macOS 上都没设时回落到系统代理 |
| Go（net/http） | 读 | 读，且优先 | 访问 `localhost` 时永远不走代理 |
| npm / pnpm | 读 | 读 | 显式配置优先 |
| Node.js 内置 fetch / http | 默认不读 | 默认不读 | 需 `NODE_USE_ENV_PROXY=1` 开启，见下文 |

Windows 的环境变量名**不区分大小写**，在 PowerShell 或 cmd 里 `HTTP_PROXY` 和 `http_proxy` 是同一个变量，大小写问题主要出现在 Linux 和 macOS。

### no_proxy：各家解析规则不同

| 写法 | curl | wget | Python（urllib） | Go |
|------|------|------|--------|-----|
| `example.com` 同时匹配子域名 | 是 | 是 | 是 | 是 |
| `.example.com` 也匹配 `example.com` 本身 | 是 | 否 | 是 | 否 |
| `*` 表示全部不走代理 | 是 | 否 | 是 | 是 |
| CIDR（如 `10.0.0.0/8`） | 7.86.0 起支持 | 否 | 否（requests 及内置它的 pip 对 IPv4 目标支持） | 是 |

一个兼容性较好的写法：

```bash
export no_proxy="localhost,127.0.0.1,::1,.local,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
```

要点：逗号之间不留空格；域名不写 `*.` 通配，想连主域一起排除就写 `example.com` 而不是 `.example.com`；CIDR 在不支持的工具里只是匹配不上、不会报错，所以常用的内网主机最好直接写 IP 或主机名。

---

## 在各个 shell 里设置

### bash / zsh

```bash
# 临时：只对当前终端窗口有效
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890

# 只对单条命令生效
https_proxy=http://127.0.0.1:7890 curl -I https://www.google.com
```

不建议把 `export` 直接写进启动文件——代理客户端一关，所有联网命令都会报 `Connection refused`。更好的做法是写一对开关函数，需要时手动开：

```bash
# 追加到 ~/.bashrc 或 ~/.zshrc，然后 source 一次
PROXY_ADDR="http://127.0.0.1:7890"
NO_PROXY_LIST="localhost,127.0.0.1,::1,.local,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"

proxy_on() {
  export http_proxy="$PROXY_ADDR" https_proxy="$PROXY_ADDR"
  export HTTP_PROXY="$PROXY_ADDR" HTTPS_PROXY="$PROXY_ADDR"
  export no_proxy="$NO_PROXY_LIST" NO_PROXY="$NO_PROXY_LIST"
  echo "代理已开启：$PROXY_ADDR"
}

proxy_off() {
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY no_proxy NO_PROXY
  echo "代理已关闭"
}
```

### fish

```fish
function proxy_on
    set -gx http_proxy http://127.0.0.1:7890
    set -gx https_proxy $http_proxy
    set -gx HTTP_PROXY $http_proxy
    set -gx HTTPS_PROXY $http_proxy
    set -gx no_proxy localhost,127.0.0.1,::1
    set -gx NO_PROXY $no_proxy
end

function proxy_off
    set -e http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY
end

# 保存到 ~/.config/fish/functions/，以后新开的终端都能用
funcsave proxy_on
funcsave proxy_off
```

### PowerShell

临时设置用 `$env:HTTPS_PROXY = "http://127.0.0.1:7890"`，只对当前窗口有效，取消用 `Remove-Item Env:HTTPS_PROXY`。开关函数写进 `$PROFILE`（用 `notepad $PROFILE` 打开；文件不存在时先执行 `if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }`）：

```powershell
function proxy_on {
    $p = "http://127.0.0.1:7890"
    $env:HTTP_PROXY = $p
    $env:HTTPS_PROXY = $p
    $env:NO_PROXY = "localhost,127.0.0.1,::1"
    Write-Host "Proxy ON: $p"
}
function proxy_off {
    Remove-Item Env:HTTP_PROXY, Env:HTTPS_PROXY, Env:NO_PROXY -ErrorAction SilentlyContinue
    Write-Host "Proxy OFF"
}
```

提示文字用英文是有意为之：Windows PowerShell 5.1 按系统 ANSI 代码页读取不带 BOM 的脚本，而记事本默认保存为不带 BOM 的 UTF-8，中文会显示成乱码。想写中文，就把 `$PROFILE` 另存为「带有 BOM 的 UTF-8」；PowerShell 7 没有这个问题。

系统自带的 Windows PowerShell 5.1 在 Windows 客户端上的默认执行策略是 `Restricted`，第一次使用 `$PROFILE` 的人大多会看到「无法加载文件 …Microsoft.PowerShell_profile.ps1，因为在此系统上禁止运行脚本」。常见做法是只对当前用户放宽为 `RemoteSigned`：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

放宽后本地脚本可以运行，从网上下载的脚本仍需签名。这属于安全设置，含义见微软文档 about_Execution_Policies（链接在文末）；不想改的话，可以每次手动粘贴 `$env:` 命令，或用下文 Clash Verge Rev 的「复制环境变量」。

确实需要永久生效时，可写入用户级环境变量（只影响之后启动的程序，删除时把值设为 `$null`）：

```powershell
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://127.0.0.1:7890", "User")
```

**注意**：用户级变量对之后启动的**所有**程序生效，包括 VS Code 等图形程序，代理客户端一关，这些程序都会连不上。它的影响比把 `export` 写进 bash 启动文件更大，能用开关函数就尽量别写永久变量。

### cmd

```bat
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890
set NO_PROXY=localhost,127.0.0.1,::1
```

取消时把等号后面留空，例如 `set HTTP_PROXY=`、`set HTTPS_PROXY=`。`setx HTTPS_PROXY http://127.0.0.1:7890` 可以永久保存，但同样只对之后新开的窗口生效，风险同上，慎用。

> **省事技巧**：Clash Verge Rev 的「设置 → Verge 基础设置 → 复制环境变量类型」可选 Bash / Fish / Nushell / CMD / PowerShell，点旁边的复制图标或托盘菜单里的「复制环境变量」，就能得到带当前端口的命令。

### sudo 的坑

`sudo` 默认会重置环境变量（`env_reset`），多数发行版不会把代理变量带进去，所以 `export` 之后 `sudo apt update` 仍然直连。可以用 `sudo -E` 保留当前环境（受 sudoers 策略限制），更稳妥的做法是写进工具自己的配置，见后文 apt 一节。

---

## Git

### HTTPS 远程：http.proxy

```bash
# 全局：所有 HTTPS 远程都走代理
git config --global http.proxy http://127.0.0.1:7890

# 或者只对 GitHub 生效，公司内网 GitLab、Gitee 等保持直连
git config --global http.https://github.com.proxy http://127.0.0.1:7890

# 查看当前的代理配置
git config --global --get-regexp proxy
# 取消时执行对应的一行：
#   git config --global --unset http.proxy
#   git config --global --unset http.https://github.com.proxy
```

几个要点：

- Git 的 HTTP 传输基于 libcurl，`http.proxy` 支持 curl 认识的所有写法（包括 `socks5h://`）；未设置时回落到 `http_proxy` / `https_proxy` / `all_proxy` 环境变量。
- 网上流传的 `git config --global https.proxy ...`，在 Git 官方 `git-config` 文档里并没有 `https.proxy` 这个配置项，HTTPS 远程同样由 `http.proxy` 控制。
- 按 URL 匹配时主机名可以用 `*` 匹配一级子域，例如 `http.https://*.example.com.proxy`。
- 想让某个站点即使设置了环境变量也不走代理，可以把对应的 `http.<url>.proxy` 设为空字符串。

想确认 Git 到底有没有经过代理，可以打开 curl 调试输出：

```bash
GIT_CURL_VERBOSE=1 git ls-remote https://github.com/git/git.git 2>&1 | head -20
```

```powershell
$env:GIT_CURL_VERBOSE = 1; git ls-remote https://github.com/git/git.git
Remove-Item Env:GIT_CURL_VERBOSE   # 用完删掉
```

### SSH 远程：ProxyCommand

`git@github.com:user/repo.git` 这类地址走 SSH 协议，`http.proxy` 和环境变量都管不到，需要在 `~/.ssh/config` 里让 ssh 经由代理建立 TCP 连接。

**Linux / macOS**（OpenBSD 版 nc：macOS 自带；Debian / Ubuntu 安装 `netcat-openbsd` 包）：

```text
Host github.com
    User git
    ProxyCommand nc -X 5 -x 127.0.0.1:7890 %h %p
```

`-X 5` 表示 SOCKS5，改成 `-X connect` 则使用 HTTP CONNECT。Fedora / RHEL 上的 `nc` 通常是 Nmap 的 ncat，参数不同：

```text
    ProxyCommand ncat --proxy 127.0.0.1:7890 --proxy-type socks5 %h %p
```

**Windows**：Git for Windows 自带 `connect.exe`（位于安装目录的 `mingw64\bin`）。Git 默认使用自带的 ssh，可直接写：

```text
Host github.com
    User git
    ProxyCommand connect -S 127.0.0.1:7890 %h %p
```

`-S` 是 SOCKS5，`-H` 是 HTTP 代理。这个文件在 Windows 上是 `C:\Users\你的用户名\.ssh\config`，不存在就新建，注意不要带 `.txt` 扩展名。

如果你用的是系统自带的 Windows OpenSSH（在 PowerShell 里直接运行 `ssh`），它通常找不到 Git 目录下的 `connect`。最省事的做法是改在 Git Bash 里运行 ssh；或者把 `connect.exe` 复制到无空格的目录（如 `C:\tools\`），改写成 `ProxyCommand C:/tools/connect.exe -S 127.0.0.1:7890 %h %p`。较旧的 Windows OpenSSH 处理带引号或空格的路径有问题，尽量避免。

保存后执行 `ssh -T git@github.com`，看到 `Hi 用户名! You've successfully authenticated` 就说明连通了。

### SSH over 443

有些网络会封锁出站 22 端口。GitHub 提供了 `ssh.github.com` 的 443 端口作为替代：

```text
Host github.com
    HostName ssh.github.com
    Port 443
    User git
```

先用 `ssh -T -p 443 git@ssh.github.com` 测试。第一次连接会提示写入 known_hosts，请核对指纹与 GitHub 官方公布的一致再确认。该方式不适用于 GitHub Enterprise Server。

它可以和上面的 `ProxyCommand` 叠加使用，同一个 Host 只写一个块，不要重复写两个 `Host github.com`：

```text
Host github.com
    HostName ssh.github.com
    Port 443
    User git
    ProxyCommand nc -X 5 -x 127.0.0.1:7890 %h %p
```

Windows 下把 `ProxyCommand` 换成上面 connect 的那一行。要清楚：443 端口只解决「22 端口被封」，并不能替代代理。简单记：HTTPS 地址看 `http.proxy`，SSH 地址看 `~/.ssh/config`，两者互不影响。

---

## Node.js 生态：npm、pnpm、yarn

### npm

```bash
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890
npm config set noproxy "localhost,127.0.0.1"
npm config list                 # 查看当前生效的配置
# 取消：npm config delete proxy 与 npm config delete https-proxy
```

这些设置写入用户目录的 `~/.npmrc`。按 npm 文档，未显式配置时也会读取 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`（大小写均可）。

### pnpm

pnpm 同样读取上述环境变量，这是各版本都认的方式。持久配置要看大版本：pnpm 11 起 `.npmrc` 原则上只管认证和 registry，代理等网络设置改由 YAML 文件保存（旧的 `.npmrc` 代理键仍可读取，以便迁移）。用户级的持久位置是全局 `config.yaml`，`pnpm config set` 默认写到这里，键名为驼峰：

```bash
pnpm config set httpsProxy http://127.0.0.1:7890
pnpm config set httpProxy http://127.0.0.1:7890
# 取消：pnpm config delete httpsProxy
```

| 平台 | 全局 config.yaml 位置 |
|------|---------------------|
| Linux | `~/.config/pnpm/config.yaml`（设置了 `XDG_CONFIG_HOME` 时在其下） |
| macOS | `~/Library/Preferences/pnpm/config.yaml` |
| Windows | `%LOCALAPPDATA%\pnpm\config\config.yaml` |

pnpm 10 及更早版本沿用 `~/.npmrc` 里 npm 风格的 `https-proxy`、`proxy`、`no-proxy` 即可。**注意**：项目里的 `pnpm-workspace.yaml` 和 `.npmrc` 通常会提交到仓库，别把只属于你本机的代理地址写进去，否则会影响队友和 CI。

### yarn：1.x 与 2+ 完全不同

先用 `yarn --version` 确认版本：

| 版本 | 配置文件 | 键名 | 设置命令 |
|------|---------|------|---------|
| Yarn 1.x（classic） | `~/.yarnrc` | `proxy`、`https-proxy` | `yarn config set https-proxy http://127.0.0.1:7890` |
| Yarn 2+（berry） | 项目 `.yarnrc.yml`，加 `-H` 则写用户目录 | `httpProxy`、`httpsProxy` | `yarn config set -H httpsProxy http://127.0.0.1:7890` |

Yarn 1.x 对代理环境变量的支持历来不稳定，显式配置更可靠；berry 用 `yarn config unset -H httpsProxy` 取消。

### Node.js 程序本身

npm 能下包，不代表你写的 Node 脚本会走代理。Node.js 内置的 `fetch()` 与 `http` / `https` 模块默认**不读取**代理环境变量。按 Node.js 官方文档，v22.21.0 及以上、v24.0.0 及以上（含之后的大版本）可以显式开启：环境变量 `NODE_USE_ENV_PROXY=1` 从 v24.0.0 起对 `fetch()` 生效，`http` / `https` 模块从 v24.5.0 起支持；命令行参数 `--use-env-proxy` 则从 v22.21.0 和 v24.5.0 起才有。该功能在文档中仍标为「积极开发中」。

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export NODE_USE_ENV_PROXY=1
node app.js
# 或者（需要 v22.21.0+ / v24.5.0+）
node --use-env-proxy app.js
```

更早的版本需要借助第三方代理 Agent 库。另外，很多包在安装时会额外下载二进制文件（浏览器内核、原生模块等），它们各有下载逻辑和专用环境变量，需要查对应项目的文档。

---

## Python：pip

```bash
# 单次指定
pip install requests --proxy http://127.0.0.1:7890

# 持久保存到用户级配置文件
pip config set global.proxy http://127.0.0.1:7890
pip config list
# 取消：pip config unset global.proxy
```

`pip config set` 写入的用户级配置文件位置：

| 平台 | 用户级配置文件 |
|------|--------------|
| Linux | `~/.config/pip/pip.conf`（旧路径 `~/.pip/pip.conf`） |
| macOS | `~/Library/Application Support/pip/` 目录存在时用其中的 `pip.conf`，否则为 `~/.config/pip/pip.conf`（旧路径 `~/.pip/pip.conf` 也会读） |
| Windows | `%APPDATA%\pip\pip.ini` |

手动编辑时格式如下：

```ini
[global]
proxy = http://127.0.0.1:7890
```

实际生效的是哪个文件，可以用 `pip config debug` 查看。

pip 也读取标准的 `http_proxy`、`https_proxy`、`no_proxy`。如果把代理写成 SOCKS 地址，pip 需要额外的 SOCKS 依赖（如 PySocks），没装就会报错——直接用 `http://` 地址最省事。

**Windows / macOS 上的例外**：pip 底层的 Python 标准库在找不到任何代理环境变量时，会回落读取系统代理——Windows 读注册表里的 Internet 设置，macOS 读系统网络配置。所以开着系统代理时，pip 往往不用配置就能走代理；反过来，代理客户端已经退出、系统代理却没关，pip 就会报 `ProxyError` 之类的连接错误。遇到这种情况，先在客户端里关闭系统代理再退出，或者用 `--proxy` 显式指定；想让它彻底直连，可以临时设置 `no_proxy=*`。requests 等其他 Python 库同理。

---

## Go：GOPROXY 不是网络代理

Go 开发者最容易混淆的是两个名字很像的变量：

| 变量 | 是什么 | 默认值 |
|------|-------|--------|
| `GOPROXY` | 模块代理**服务**，go 命令按 GOPROXY 协议从这里下载模块 | `https://proxy.golang.org,direct` |
| `HTTPS_PROXY` / `HTTP_PROXY` | 网络代理，决定 go 命令的 HTTP 请求经由哪台代理服务器发出 | 无 |
| `GOPRIVATE` / `GONOPROXY` | 哪些模块跳过模块代理，直接从版本控制系统拉取 | 无 |

两种思路任选其一：

```bash
# 方案 A：继续用官方模块代理，让网络请求走本地代理
export HTTPS_PROXY=http://127.0.0.1:7890
go mod download

# 方案 B：换成国内模块代理，一般不再需要网络代理
go env -w GOPROXY=https://goproxy.cn,direct
```

`GOPROXY` 列表里的 `direct`，以及 `GOPRIVATE` 覆盖的私有模块，都会让 go 命令直接调用 git 等版本控制工具拉代码——此时生效的是**Git 的代理配置**，拉不动时回头检查上一节。

---

## 系统包管理器：Homebrew、apt、dnf

### Homebrew

Homebrew 通过 curl 和 git 下载，官方文档明确支持 `http_proxy`、`https_proxy`、`all_proxy`、`no_proxy`：

```bash
export https_proxy=http://127.0.0.1:7890
brew update
```

### apt（Debian / Ubuntu）

apt 以 root 运行，前面说过 sudo 不带代理变量，所以写进 apt 自己的配置：

```bash
sudo tee /etc/apt/apt.conf.d/95proxy <<'EOF'
Acquire::http::Proxy "http://127.0.0.1:7890";
Acquire::https::Proxy "http://127.0.0.1:7890";
EOF

# 只临时用一次
sudo apt -o Acquire::http::Proxy="http://127.0.0.1:7890" update
```

apt 支持 `http`、`https` 和 `socks5h` 三种代理协议；可以用 `DIRECT` 让特定主机不走代理，例如 `Acquire::http::Proxy::mirrors.tuna.tsinghua.edu.cn "DIRECT";`。不用时删除 `95proxy` 文件即可。实际上在大陆访问官方源慢时，更常见的做法是换成国内镜像源。

### dnf（Fedora / RHEL）

```ini
# /etc/dnf/dnf.conf
[main]
proxy=http://127.0.0.1:7890
```

某个仓库不想继承这个代理时，在该仓库的 `.repo` 文件里写空的 `proxy=`（旧写法为 `_none_`）。

---

## Docker：三条路径分开看

Docker 的代理最容易配错，因为 `docker` 命令只是个客户端：拉镜像的是后台守护进程 dockerd，容器和构建又各自有独立的网络环境。你在终端里 `export` 的变量，这三者**一个都不会继承**。

| 场景 | 谁在发起网络请求 | 在哪配置 |
|------|----------------|---------|
| `docker pull`、`docker compose pull` | dockerd 守护进程 | Linux：systemd drop-in 或 daemon.json；Docker Desktop：图形设置 |
| 容器运行时访问外网 | 容器内的进程 | `~/.docker/config.json` 的 `proxies`，或 `docker run -e` |
| `docker build` 中的 RUN 步骤 | 构建容器 | 自动取自 config.json，或 `--build-arg` |

### 拉镜像：配置 dockerd（Linux）

dockerd 运行在宿主机网络里，这里写 `127.0.0.1` 指的就是宿主机。通用做法是 systemd drop-in：

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf <<'EOF'
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:7890"
Environment="HTTPS_PROXY=http://127.0.0.1:7890"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
sudo systemctl show --property=Environment docker
```

Docker Engine 23.0 起也可以写在 `/etc/docker/daemon.json`，官方文档说明它的优先级高于环境变量：

```json
{
  "proxies": {
    "http-proxy": "http://127.0.0.1:7890",
    "https-proxy": "http://127.0.0.1:7890",
    "no-proxy": "localhost,127.0.0.1"
  }
}
```

重启 dockerd 会影响正在运行的容器，请挑合适的时机操作。rootless 模式的 drop-in 路径在 `~/.config/systemd/user/docker.service.d/`，命令改用 `systemctl --user`。

**Docker Desktop** 会忽略 daemon.json 里的 `proxies`，要在 Settings → Resources → Proxies 中设置。新版界面分成两块：

| 设置块 | 管哪些流量 | 可选模式 |
|-------|-----------|---------|
| Docker Desktop proxy | 登录 Docker、Desktop 应用本身、CLI、扩展等宿主机侧流量 | System proxy / No proxy / Manual configuration |
| Containers proxy | `docker pull`、`docker compose pull` 一律走这里 | Same as host proxy / System proxy / No proxy / Manual configuration |

拉镜像看的是 **Containers proxy**，只改上面那块不一定有用，请确认它选的是 Same as host proxy（沿用上面那块），或同样手动填写。System proxy 即跟随系统代理（支持 PAC），Manual configuration 可填 HTTP / HTTPS 地址与绕过列表。这些代理由宿主机侧的进程使用，手动填写本机回环地址通常可用。旧版界面只有一组设置。

### 容器与构建：先解决 127.0.0.1 问题

容器有自己的网络命名空间，**容器里的 127.0.0.1 是容器自己**，不是宿主机。所以给容器配的代理地址，必须是从容器内部能访问到的宿主机地址：

- **Docker Desktop**（Windows / macOS）：使用特殊域名 `host.docker.internal`；
- **Linux 原生 Docker**：没有自动的 `host.docker.internal`。要么每次 `docker run` 和 `docker build` 都加 `--add-host=host.docker.internal:host-gateway`（compose 中写 `extra_hosts`），要么直接使用宿主机在网桥上的地址（默认 `docker0` 为 `172.17.0.1`；自定义网络的网关不同）；
- **代理客户端要监听非回环地址**：Linux 原生 Docker 下必须开启 allow-lan（Clash Verge Rev 的「局域网连接」、v2rayN 的「允许来自局域网的连接」），并在防火墙中**只对容器网段**放行，例如：

```bash
# ufw 示例：Docker 默认网桥多分配在 172.16.0.0/12 内，只允许这个网段访问 7890
# 实际网段以 docker network inspect 的输出为准
sudo ufw allow from 172.16.0.0/12 to any port 7890 proto tcp
```

> **安全提示**：有公网 IP 的云服务器或开发机上，**切勿对所有来源放行代理端口**，否则等于在公网上开放了一个无认证代理，很快会被扫描和滥用。allow-lan 的其他风险与限制方法见文末 FAQ「开启 allow-lan 安全吗？」。

容器的代理写在 `~/.docker/config.json`。下面的写法适用于 **Docker Desktop**：

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://host.docker.internal:7890",
      "httpsProxy": "http://host.docker.internal:7890",
      "noProxy": "localhost,127.0.0.1,.local,.internal"
    }
  }
}
```

**Linux 原生 Docker** 默认解析不到 `host.docker.internal`，而这个文件会对之后所有新容器和所有构建生效——照抄上面的写法，凡是漏加 `--add-host` 的 `docker run` 里的程序和 `docker build` 的 RUN 步骤，curl、pip、npm 都会因为解析不到代理主机而报错，不会退回直连。Linux 上建议把地址直接写成 docker0 网关（默认 `172.17.0.1`，以 `ip addr show docker0` 的结果为准），它是宿主机自己的地址，接在其他自定义网络上的容器通常也能访问：

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://172.17.0.1:7890",
      "httpsProxy": "http://172.17.0.1:7890",
      "noProxy": "localhost,127.0.0.1,.local,.internal"
    }
  }
}
```

保存后，**新创建**的容器会自动注入大小写两套代理变量（`HTTP_PROXY` 与 `http_proxy` 等），`docker build` 也会自动带上对应的构建参数；已存在的容器需要重建才生效。这个文件只影响容器和构建，不影响 dockerd 拉镜像。

还要注意两点：

- **它是全局配置**：之后创建的**所有**容器都会注入代理，docker compose 项目也不例外。容器之间按服务名互相调用（如 `http://api:8080`）时，只要客户端读代理变量（curl、Python requests、Go 程序等），请求就会先被发到宿主机的代理，而代理解析不了 compose 服务名，常见表现是 502 或超时。请把服务名和内部域名加进 `noProxy`；如果只有个别容器需要代理，干脆不写 config.json，改用 `docker run -e` 或 compose 的 `environment` 单独注入。
- **大小写都要设**：apt、wget 只认小写变量，curl 访问 http 地址也不读大写 `HTTP_PROXY`。手动注入时把四个变量都带上，例如 `docker run -e http_proxy=... -e https_proxy=... -e HTTP_PROXY=... -e HTTPS_PROXY=...`。

Linux 上构建镜像时，还可以让构建容器共享宿主机网络，这样 `127.0.0.1` 就是宿主机。命令行里显式给出的 `--build-arg` 会覆盖 config.json 注入的同名参数，所以要把大小写四个都覆盖掉：

```bash
P=http://127.0.0.1:7890
docker build --network host \
  --build-arg http_proxy=$P --build-arg https_proxy=$P \
  --build-arg HTTP_PROXY=$P --build-arg HTTPS_PROXY=$P .
```

`--network host` 在默认的 docker 驱动构建器上可以直接用；使用 docker-container 驱动的 buildx 构建器时，还需要为构建器开启 `network.host` 授权（entitlement），见 buildx 文档。

`HTTP_PROXY`、`HTTPS_PROXY` 这类预定义构建参数只在构建容器里可见，不会写进最终镜像。**不要在 Dockerfile 里用 `ENV` 设置代理**，那会把代理地址（甚至账号密码）永久固化进镜像。

至于 Docker Hub 镜像加速：国内公共加速地址近年变动频繁，不少已停止服务或限制使用，选用前请确认来源可信、仍在运营。

---

## WSL2：先看网络模式

WSL2 的代理配置取决于它运行在哪种网络模式下。

### mirrored 模式（Windows 11 22H2 及以上）

```ini
# %UserProfile%\.wslconfig
[wsl2]
networkingMode=mirrored
autoProxy=true
```

保存后在 PowerShell 执行 `wsl --shutdown`，再重新打开发行版。mirrored 模式下 WSL 与 Windows 共享 `127.0.0.1`，直接用 `http://127.0.0.1:7890` 即可。`autoProxy`（需要 Windows 11 22H2 及以上，默认开启）会把 Windows 的 HTTP 代理设置同步进 WSL——如果 Windows 已开系统代理，WSL 里可能已经有代理变量了，先 `env | grep -i proxy` 看一眼。

### NAT 模式（默认）

NAT 模式下 WSL 的 localhost 与 Windows 不是同一个。此时若 Windows 系统代理指向 `127.0.0.1`，WSL 启动时会提示 `A localhost proxy configuration was detected but not mirrored into WSL`。解决办法是让代理客户端开启 allow-lan，然后在 WSL 里用宿主机地址：

```bash
# 在 WSL 内获取 Windows 宿主机地址（微软文档给出的方法）
HOST_IP=$(ip route show | grep -i default | awk '{ print $3}')
export http_proxy="http://${HOST_IP}:7890"
export https_proxy="http://${HOST_IP}:7890"
```

想配合前面的开关函数使用，就把 `HOST_IP=...` 这一行放进 WSL 的 `~/.bashrc`，**写在 `PROXY_ADDR=` 之前**，再把 `PROXY_ADDR` 改成 `"http://${HOST_IP}:7890"`——bash 在赋值时就会展开变量，顺序反了会得到 `http://:7890`。两个注意点：

- 较早的教程用 `/etc/resolv.conf` 里的 nameserver 当宿主机 IP。但 Windows 11 22H2 及以上默认开启 DNS 隧道（`dnsTunneling`），那里写的是 `10.255.255.254`，已不再是宿主机地址；
- Windows Defender 防火墙可能拦截 WSL 发往宿主机代理端口的连接：WSL 的虚拟网卡通常被归为「公用网络」，如果当初放行代理客户端时只勾了「专用网络」，来自 WSL 的连接就会被拦。不要为此对整个公用网络放行代理客户端（那样在咖啡馆等公共 Wi-Fi 下也会暴露端口），更稳妥的是只为 WSL 网段加一条入站规则（管理员 PowerShell，网段以 WSL 里 `ip route` 的结果为准）。Windows 11 22H2 及以上且 WSL 2.0.9+ 时还会默认启用 Hyper-V 防火墙，相关规则也要一并检查。

```powershell
New-NetFirewallRule -DisplayName "WSL to local proxy" -Direction Inbound -Protocol TCP -LocalPort 7890 -RemoteAddress 172.16.0.0/12 -Action Allow
```

如果系统满足条件，改用上面的 mirrored 模式可以绕开这些麻烦。Windows 上开启 TUN 后 WSL 断网是另一类问题，见 [TUN 模式不生效的常见原因](/posts/tun-not-working/)；UWP 回环、Defender 误报等其他 Windows 问题见 [平台特有问题](/posts/platform-specific/)。

---

## 不认环境变量的程序：proxychains-ng 与 TUN

### proxychains-ng

有些程序既不读环境变量，也没有代理选项。[proxychains-ng](https://github.com/rofl0r/proxychains-ng) 通过预加载动态库（Linux 上是 `LD_PRELOAD`）拦截程序的 libc 网络调用，把 TCP 连接转发给代理：

```bash
# Debian / Ubuntu
sudo apt install proxychains4
# macOS
brew install proxychains-ng
```

配置文件按以下顺序查找：环境变量 `PROXYCHAINS_CONF_FILE` 或 `-f` 参数指定的文件、`./proxychains.conf`、`~/.proxychains/proxychains.conf`、系统配置目录（发行版包里可能叫 `/etc/proxychains4.conf` 或 `/etc/proxychains.conf`，Homebrew 安装的在 `$(brew --prefix)/etc/proxychains.conf`）。核心内容：

```ini
strict_chain
proxy_dns

[ProxyList]
socks5 127.0.0.1 7890
```

编辑自带的默认配置文件时，要把 `[ProxyList]` 下原有的 `socks4 127.0.0.1 9050`（Tor 的默认端口）删掉或注释掉，否则 `strict_chain` 会把两个代理串起来，先去连这个多半不存在的 9050 端口而失败。`proxy_dns` 让域名也交给代理处理，避免本地解析。使用时在命令前加 `proxychains4`，`-q` 可关闭它自己的日志：

```bash
proxychains4 -q some-command --args
```

局限也要清楚：只对通过 libc 发起连接的**动态链接**程序有效，静态链接程序无效；Go 程序在 Linux 上由网络库直接发起系统调用、不经过 libc，基本都无效；macOS 上受 SIP 保护的系统自带程序无法被注入；只能代理 TCP。

### TUN 模式：全局接管，但有代价

TUN 模式在网络层接管所有流量，不需要逐个工具配置，这是它最大的吸引力。代价是需要管理员权限，并且容易与 WSL、Docker、公司 VPN 的虚拟网卡冲突。另外，TUN 只负责「把流量交给代理客户端」，最终走不走代理仍由分流规则决定。如果想让整个局域网的设备都透明走代理，可以把这件事交给路由器，见 [软路由与旁路由](/posts/soft-router-guide/)。

| 方案 | 覆盖范围 | 需要管理员权限 | 适合场景 |
|------|---------|--------------|---------|
| 环境变量 | 读变量的 CLI | 否 | 日常终端 |
| 工具自身配置 | 单个工具 | 否 | Git、npm、Docker 等长期配置 |
| proxychains-ng | 动态链接程序的 TCP | 否 | 个别不配合的程序 |
| TUN 模式 | 全部程序与协议 | 是 | 不想逐个配置，或需要 UDP |

---

## 验证与排障

### 三步验证

**第一步：变量是否真的设上了。**

```bash
env | grep -i proxy
```

```powershell
Get-ChildItem Env: | Where-Object Name -like "*proxy*"
```

**第二步：用 `curl -v` 看请求是否经过代理。**

```bash
curl -v -o /dev/null https://example.com
```

```powershell
curl.exe -v -o NUL https://example.com
```

正常输出类似：

```text
* Uses proxy env variable https_proxy == 'http://127.0.0.1:7890'
*   Trying 127.0.0.1:7890...
* Establish HTTP proxy tunnel to example.com:443
> CONNECT example.com:443 HTTP/1.1
< HTTP/1.1 200 Connection established
* CONNECT tunnel established, response 200
```

注意 CONNECT 行里带的是**域名**——这正是 `http://` 代理由远端解析 DNS 的证据。如果没有第一行 `Uses proxy env variable`，说明 curl 根本没读到变量（比如只设了大写的 `HTTP_PROXY` 却访问 http 地址）。

**第三步：比较出口 IP。**

```bash
# 走代理
curl -s https://www.cloudflare.com/cdn-cgi/trace | grep -E "^(ip|loc)="
# 强制不走代理，作为对照
curl -s --noproxy "*" https://www.cloudflare.com/cdn-cgi/trace | grep -E "^(ip|loc)="
```

```powershell
curl.exe -s https://www.cloudflare.com/cdn-cgi/trace | findstr /b "ip= loc="
curl.exe -s --noproxy "*" https://www.cloudflare.com/cdn-cgi/trace | findstr /b "ip= loc="
```

两次结果不同，说明代理生效。注意出口取决于这个域名命中的分流规则；开着 TUN 时，对照组的请求同样会被 TUN 接管。

### 常见报错对照

| 现象 / 报错 | 常见原因 | 处理 |
|------------|---------|------|
| `Connection refused`，或 `Failed to connect to 127.0.0.1 port 7890` | 端口写错、客户端没开；在容器或 WSL NAT 模式里用了 127.0.0.1 | 核对端口；改用宿主机地址并开启 allow-lan |
| 连接宿主机代理超时 | 防火墙拦截了来自容器或 WSL 的入站 | 只对容器 / WSL 网段放行代理端口 |
| 容器里报 `Could not resolve proxy: host.docker.internal` | Linux 原生 Docker 没有这个名字，config.json 却写了它 | 改用 `172.17.0.1`，或每次加 `--add-host` |
| 客户端已退出，pip 报 `ProxyError` | Windows / macOS 上 Python 读到了残留的系统代理 | 先关闭系统代理，或用 `--proxy` 显式指定 |
| `wrong version number` 等 TLS 握手错误 | 代理地址写成了 `https://127.0.0.1:7890` | 改为 `http://` |
| `Could not resolve host`，或连到明显错误的 IP | `socks5://` 在本地解析，遇到 DNS 污染 | 改用 `socks5h://` 或 `http://` |
| 访问 localhost 本地服务返回 502 或超时 | `no_proxy` 没有包含 localhost | 补全 `no_proxy` |
| `407 Proxy Authentication Required` | 客户端开启了代理认证 | 地址写成 `http://用户名:密码@主机:端口`，或对本机跳过认证 |
| HTTPS 克隆正常，SSH 克隆超时 | SSH 不读 `http.proxy` 和环境变量 | 配置 `ProxyCommand` |
| 终端里设了变量，`docker pull` 仍超时 | dockerd 不继承 shell 环境 | 配置 dockerd 的代理 |
| 普通用户正常，`sudo` 后失效 | sudo 重置了环境变量 | `sudo -E` 或写进工具配置 |

如果显式 `curl -x` 都连不通，问题不在终端配置，而在节点或客户端本身，按 [节点连不上？系统排查流程](/posts/connectivity-checklist/) 排查。

---

## 另一条路：国内镜像源

对于「下载公共软件包」这件事，国内镜像源往往比代理更快、更稳，而且完全不依赖代理：

| 生态 | 镜像 | 配置方式 |
|------|------|---------|
| npm / pnpm / Yarn 1.x | npmmirror | `npm config set registry https://registry.npmmirror.com` |
| Yarn 2+ | npmmirror | `yarn config set npmRegistryServer https://registry.npmmirror.com`（berry 不读 `.npmrc`） |
| pip | 清华 TUNA | `pip config set global.index-url https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple` |
| Go 模块 | goproxy.cn | `go env -w GOPROXY=https://goproxy.cn,direct` |
| Homebrew | 清华 TUNA | 设置下方两个环境变量 |
| apt / dnf | 高校与云厂商镜像 | 替换软件源列表 |

```bash
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
```

适用边界要心里有数：

- **只覆盖公共包仓库**：`git clone` GitHub 仓库、GitHub Release 附件、各种 SDK 与二进制下载都不在其列，这些仍需要代理；
- **有同步延迟**：刚发布的版本可能暂时拉不到；
- **只读**：镜像不支持发布，`npm publish` 前要切回官方 registry；
- **lockfile 会记录来源**：npm 的 `package-lock.json` 会写下每个包的下载地址，团队成员或 CI 在海外时可能被带到镜像站，提交前确认团队约定；
- **信任与完整性**：npm 的 integrity 字段、Go 的校验和数据库仍会校验包内容，但镜像能否持续可用由第三方决定。

镜像源和代理可以并存：国内镜像的域名一般会被分流规则判为直连，也可以把它加进 `no_proxy`，让请求不必绕到本地代理客户端。

---

## 常见问题（FAQ）

### 开了 TUN 模式，还需要设置这些环境变量吗？

一般不需要。TUN 在网络层接管了所有程序的流量，命令行工具即使完全不知道代理存在，也会被捕获并按规则分流。同时设置也没有坏处，工具会直接连本地端口。例外是 WSL NAT 模式和 Linux 容器：它们有独立的网络环境，TUN 能否覆盖取决于客户端对这些虚拟网卡的处理，出问题时参考 [TUN 模式不生效的常见原因](/posts/tun-not-working/)。

### 关掉代理客户端后，pip、npm 等报 ProxyError 或连不上怎么办？

这说明某处还残留着代理设置，工具仍在连一个已经没人监听的端口。按下面的顺序排查：

1. **系统代理**：Windows / macOS 上的 Python 在没有代理环境变量时会读系统代理。先确认客户端退出前关闭了系统代理，必要时到系统网络设置里手动关掉；
2. **环境变量**：`env | grep -i proxy`（PowerShell 用 `Get-ChildItem Env: | Where-Object Name -like "*proxy*"`）查残留，执行 `proxy_off`；Windows 上还要检查是否用 `setx` 或 `SetEnvironmentVariable` 写过永久变量；
3. **工具自身配置**：`npm config get proxy`、`npm config get https-proxy`、`git config --global --get-regexp proxy`、`pip config list`，有残留就按前文对应小节取消。

### 为什么 git clone 已经走代理了，速度还是很慢？

先在客户端的连接面板里确认 `github.com` 实际走了哪个策略组——有些规则集会把它分到直连或低速组，此时可以用 [自定义规则](/posts/custom-rules/) 调整。其次是节点本身的带宽和延迟，参考 [速度慢的常见原因与优化思路](/posts/speed-optimization/)。大仓库还可以用 `git clone --depth 1` 只拉最新一次提交，下载量会少很多。

### 在公司电脑上可以这样配置吗？

要谨慎。公司网络可能已经通过 `HTTP_PROXY` 或 PAC 配置了企业代理，覆盖它会导致内网资源无法访问；自行搭建代理绕过公司网关，也可能违反公司的信息安全制度，带来审计和合规风险。在公司设备上操作前，请先了解并遵守所在单位的规定，必要时咨询 IT 部门。

### 开启 allow-lan 安全吗？

allow-lan 让代理端口监听在所有网卡上，同一局域网内的设备都能连接。在家庭网络里风险有限；在公司、宿舍、咖啡馆等共享网络中，陌生人可能借用你的代理流量；在有公网 IP 的服务器上，如果防火墙又对所有来源放行了这个端口，就等于开放了一个公网代理，风险最高。建议用 mihomo 的 `authentication` 设置账号密码，或用 `lan-allowed-ips` 只放行需要的网段（比如 Docker 网桥或 WSL 的地址段），系统防火墙也只对这些网段放行，不用时关掉。

### 为什么 PowerShell 里的 curl 和 Linux 上表现不一样？

在 Windows PowerShell 5.1 中，`curl` 是 `Invoke-WebRequest` 的别名，并不是真正的 curl：它使用 .NET 的默认代理设置，也不接受 curl 的参数。较新的 Windows 10 和 Windows 11 都自带真正的 curl，调用时写 `curl.exe` 即可。PowerShell 7 已经移除了这个别名。

---

## 外部参考

- 环境变量规则：[curl 代理环境变量](https://everything.curl.dev/usingcurl/proxies/env.html)、[GitLab 关于 NO_PROXY 的对比](https://about.gitlab.com/blog/we-need-to-talk-no-proxy/)
- Shell 与 Windows：[about_Execution_Policies](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
- Git：[git-config 文档](https://git-scm.com/docs/git-config)、[GitHub：SSH over the HTTPS port](https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port)
- Node.js 生态：[npm config](https://docs.npmjs.com/cli/v11/using-npm/config)、[pnpm 设置总览](https://pnpm.io/settings)、[pnpm 网络设置](https://pnpm.io/settings/network)、[pnpm config 命令](https://pnpm.io/cli/config)、[pnpm 11.0 发布说明](https://pnpm.io/blog/releases/11.0)、[Yarn 设置](https://yarnpkg.com/configuration/yarnrc)、[Node.js 命令行参数](https://nodejs.org/api/cli.html#--use-env-proxy)、[Node.js 企业网络配置](https://nodejs.org/learn/http/enterprise-network-configuration)
- Python 与 Go：[pip 配置](https://pip.pypa.io/en/stable/topics/configuration/)、[pip 用户指南](https://pip.pypa.io/en/stable/user_guide/)、[urllib.request.getproxies](https://docs.python.org/3/library/urllib.request.html#urllib.request.getproxies)、[requests 源码 utils.py](https://github.com/psf/requests/blob/main/src/requests/utils.py)、[GOPROXY](https://go.dev/ref/mod#goproxy)、[ProxyFromEnvironment](https://pkg.go.dev/net/http#ProxyFromEnvironment)
- 系统包管理器：[Homebrew Manpage](https://docs.brew.sh/Manpage)、[apt-transport-http(1)](https://manpages.debian.org/testing/apt/apt-transport-http.1.en.html)、[dnf.conf 参考](https://dnf.readthedocs.io/en/latest/conf_ref.html)
- Docker：[守护进程代理](https://docs.docker.com/engine/daemon/proxy/)、[容器与构建代理](https://docs.docker.com/engine/cli/proxy/)、[docker container run](https://docs.docker.com/reference/cli/docker/container/run/)、[docker buildx build](https://docs.docker.com/reference/cli/docker/buildx/build/)、[Docker Desktop 设置](https://docs.docker.com/desktop/settings-and-maintenance/settings/)
- WSL：[WSL 网络](https://learn.microsoft.com/en-us/windows/wsl/networking)、[WSL 高级设置](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- 客户端与工具：[mihomo 端口配置](https://wiki.metacubex.one/config/inbound/port/)、[mihomo 全局配置](https://wiki.metacubex.one/config/general/)、[Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)、[Clash Verge Rev 常见问题](https://www.clashverge.dev/faq/other.html)、[v2rayN 7.3.0 发布说明](https://github.com/2dust/v2rayN/releases/tag/7.3.0)、[proxychains-ng](https://github.com/rofl0r/proxychains-ng)
- 镜像源：[npmmirror](https://npmmirror.com/)、[TUNA PyPI](https://mirrors.tuna.tsinghua.edu.cn/help/pypi/)、[TUNA Homebrew Bottles](https://mirrors.tuna.tsinghua.edu.cn/help/homebrew-bottles/)、[goproxy.cn](https://goproxy.cn/)

**站内相关文章**：

- [TUN 模式 vs 系统代理：原理与选择](/posts/tun-vs-system-proxy/)
- [TUN 模式不生效的常见原因](/posts/tun-not-working/)
- [DNS 泄漏是什么、怎么检测、怎么防](/posts/dns-leak/)
- [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)
