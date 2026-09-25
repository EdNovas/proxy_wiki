---
title: "代理客户端安全自查：从下载入口、签名校验到出事后的处置"
date: 2026-09-24
updated: 2026-09-24
categories:
  - 隐私与安全
tags:
  - 安全
  - 隐私
  - 客户端
  - 签名校验
  - 新手入门
excerpt: "代理客户端能看到甚至改写你的全部流量，来源是否可信比功能多少更重要。本文给出一套普通用户也能完成的自查方法：核对官方仓库与下载渠道、校验哈希与签名、审视权限与根证书、判断维护状态，并附安装前清单与出事后的处置步骤。"
index_img: /images/posts/client-safety-check.svg
---

> **摘要**：代理客户端站在你的设备和整个互联网之间：它接管系统代理或虚拟网卡，保存着你的订阅，有时还要求管理员权限，甚至让你安装根证书。装到被篡改或仿冒的版本，后果远不止「被看到访问了哪些网站」。本文先讲清楚客户端在威胁模型中的位置，再给出普通用户也能完成的自查方法：确认下载来源、校验哈希与签名、理解开源与闭源的差别、审视权限与 MITM 证书、判断维护状态、保护订阅和管理接口。文末附「安装前 10 项自查清单」和发现可疑时的处置步骤。

---

## 先想清楚：客户端到底能碰到什么

### 它站在所有流量的必经之路上

[代理能做什么、不能做什么](/posts/privacy-boundaries/) 讲过：用了代理，信任就从运营商转移到了机场。但这条链上还有一个常被忽略的角色——客户端本身。机场只能看到经过它服务器的流量；客户端运行在你的设备上，看得更多，能做的也更多，具体取决于它的工作方式：

| 工作方式 | 客户端能看到什么 | 客户端能改动什么 |
|---------|----------------|----------------|
| 系统代理 | 遵循系统代理设置的应用（主要是浏览器）发出的每一个连接：目标域名、端口、流量大小和时间；明文 HTTP 的全部内容 | 决定每个连接走哪条路；篡改明文 HTTP 页面 |
| TUN / 系统 VPN 接口 | 几乎所有应用的 IP 数据包，包括 DNS 查询 | 在上面的基础上，还能伪造 DNS 应答、丢弃或重定向任意连接 |
| 你安装并信任了它生成的根证书（MITM） | 名单内域名的 HTTPS 明文：Cookie、登录令牌、表单内容 | 改写 HTTPS 请求和响应、向页面注入脚本 |
| 以管理员 / root / 系统服务身份运行 | 不再局限于网络：文件、进程、其他程序的数据（取决于系统隔离做得多严） | 安装驱动、常驻服务、修改系统设置 |

关键的边界是：**只要没有信任它的根证书，HTTPS 内容对客户端仍是加密的**。它能从 DNS 查询和 TLS 握手知道你连的是哪个域名，但读不到页面内容和密码。一旦装上并信任了它的根证书，对名单里的域名，这条边界就不存在了。

比「看流量」更值得警惕的是：**客户端首先是一个在你电脑上运行的程序**。安装程序通常需要管理员权限，TUN 和服务模式也需要高权限。被植入木马的安装包，本质上就是套着代理界面的恶意程序，它能做的事与流量无关。

### 恶意或被篡改的客户端可能做什么

下面只列有公开报告可查的风险类型。这些案例多是借热门软件之名传播的恶意程序，或同样握有网络权限的应用，用来说明手法；本文不指认任何具体客户端存在恶意行为。

| 风险类型 | 公开可查的同类案例 | 对你意味着什么 |
|---------|-----------------|--------------|
| 远控木马 | 国家互联网应急中心（CNCERT）2026 年 5 月风险提示：黑产在 Bing 上做 SEO 引流，批量注册 439 个仿冒域名传播「银狐」类远控木马；仿冒对象集中在办公、浏览器和通讯 / 代理类软件，WPS 与 Chrome 合计约 77%，名单里还有 Telegram、LetsVPN、快连和 Clash，报告附有仿冒「Clash 官网」下载页的截图 | 电脑被远程控制，数据与账号都可能失守 |
| 键盘记录、剪贴板与屏幕窃取 | FortiGuard Labs 2025 年 9 月披露针对中文用户的仿冒下载站：安装包同时装上正版软件以掩人耳目，木马能记录键盘、监控剪贴板、截屏 | 密码、验证码、钱包地址被截获 |
| 窃取凭据与浏览器数据 | Apiiro 2024 年初披露 GitHub「仓库混淆」攻击：复制热门仓库、植入窃密程序后同名上传并大量 fork，受感染仓库超过 10 万个 | 浏览器保存的密码、Cookie 被外传 |
| 注入脚本、拦截 TLS | 2016 年 IMC 会议论文分析 Google Play 上 283 个申请 VPN 权限的应用：38% 至少被一个 VirusTotal 引擎报毒，被 5 个以上引擎同时判定的约占全部样本的 4%；另有 2 款向用户流量注入广告与跟踪脚本，4 款篡改根证书信任并拦截 TLS | 页面被篡改，隐私被持续收集 |
| 把设备变成别人的出口节点 | Google 威胁情报团队 2026 年 1 月公布打击 IPIDEA 住宅代理网络：借嵌入应用的 SDK 和木马化应用（包括几款功能正常的免费 VPN）把用户设备变成出口，涉及 Android 应用超过 600 个 | 别人借你的 IP 作恶，IP 信誉受损，家庭内网也可能暴露 |
| 挖矿 | 卡巴斯基 Securelist 2025 年 2 月披露 StaryDobry 活动：在种子站传播捆绑 XMRig 挖矿程序的游戏安装包 | 设备发热、耗电、变慢 |
| 正规渠道推送恶意更新 | 2024 年 12 月的 Chrome 扩展供应链攻击（Sekoia 2025 年 1 月发布分析）：攻击者以「政策违规」钓鱼邮件骗开发者授权恶意 OAuth 应用，拿到十余个扩展的发布权限，向已有用户推送窃取 Cookie 和令牌的版本，受影响的包括 Proxy SwitchyOmega (V3)、Internxt VPN、VPNCity | 来源正确，也可能收到被投毒的更新 |

这些案例的共同点是：**恶意版本往往「能正常用」**。仿冒安装包会顺手装上正版软件，木马化的免费 VPN 真的能连上，所以「装上能翻墙」证明不了任何事。对代理客户端来说，**来源是否可信，比功能多少重要得多**，下面的自查步骤都围绕这一点展开。

---

## 第一关：下载来源

### 从可信入口出发，而不是从搜索框出发

多数「装错软件」的事故，发生在「搜索软件名、点第一个结果」这一步。更稳妥的入口依次是：

1. **项目官方文档或上游内核文档列出的链接**，例如 sing-box 官方文档专门有一页列出官方图形客户端；
2. **项目 GitHub 仓库 README 或 About 栏写明的官网与商店链接**，「官网」以这里为准；
3. **你已经核实过、一直在用的来源**。

自称官网或中文站的搜索结果、广告位、网盘和群文件，都不在这份名单里。[2026 各平台客户端推荐](/posts/client-recommendations-2026/) 整理了主流客户端的官方渠道，可作核对起点，最终以项目仓库为准。

### 怎样辨认一个 GitHub 仓库是不是本尊

即便已经在 GitHub 上，也可能点进仿冒仓库。下面这张表可以帮你快速判断：

| 看什么 | 本尊通常的样子 | 仿冒仓库的常见特征 |
|-------|--------------|-----------------|
| 地址与所有者 | 与 README、官方文档、社区长期引用的地址一致；组织账号可能带经过域名验证的 Verified 标识 | 名字高度相似（多一个字母、多一个连字符、加 -pro、-cn 后缀），所有者账号很新 |
| 创建时间与提交历史 | 数年的提交记录，多名贡献者 | 仓库刚建不久，只有一两次提交，甚至只有 README 加一个压缩包 |
| Fork 关系 | 独立仓库，或在 README 里写明继任关系 | 显示 forked from 官方仓库，但 Releases 里多出官方没有的文件 |
| Releases | 每个版本有更新说明，附件多由 CI 自动构建，常附 SHA256 或签名文件 | 附件是带密码的压缩包，或只有一个孤零零的 exe |
| Issues | 有真实用户提问，维护者有回复 | Issues 被关闭或几乎为空，README 引导你去别处下载 |
| Star 数 | 只能作参考 | 可以刷出来 |

关于最后一行：卡内基梅隆大学等机构发表在 ICSE 2026 的研究用自研工具 StarScout 在 GitHub 上识别出约 600 万个疑似虚假 Star，其中大部分流向存活时间很短、用来传播钓鱼和恶意软件的仓库。**Star 多，说明不了仓库可信**。

仓库的创建时间可以用 GitHub 的公开 API 查到：

```bash
# 把 OWNER/REPO 换成你要核对的仓库
curl -s https://api.github.com/repos/OWNER/REPO | grep -E '"(full_name|fork|created_at|pushed_at|archived)"'
```

```powershell
# Windows PowerShell（5.1 里的 curl 是 Invoke-WebRequest 的别名，请用下面的写法）
$r = Invoke-RestMethod https://api.github.com/repos/OWNER/REPO
$r | Select-Object full_name, fork, created_at, pushed_at, archived
# fork 为 True 时，查看它是从哪个仓库 fork 出来的
$r.parent.full_name
```

- `fork` 为 `true` 时，返回里还嵌着上游仓库（`parent`、`source`）的同名字段，bash 输出会多出几组。**只看最前面那一组**，那才是这个仓库自己的创建时间，别拿上游多年的历史给仿冒 fork 背书。
- 未登录调用每小时限 60 次，按出口 IP 计算。经机场节点访问时出口 IP 与他人共用，额度可能早已用完。命令没有输出时，去掉 `| grep ...` 看原始返回：出现 `API rate limit exceeded`（PowerShell 下是 403 错误）就换个网络或稍后再试。

一个号称「官方」、却是上个月才创建的仓库，基本可以直接排除。

### 搜索结果与「汉化版、破解版、绿色版」

CNCERT 的风险提示把攻击链概括为「网络钓鱼 → 木马下载 → 进程注入 → 远控控制」：钓鱼站在 Bing 上做 SEO，只对从搜索引擎点进来的访问者展示下载页，直接输入域名则跳走以躲避分析；下载到的是带恶意程序的压缩包，运行后把 Shellcode 注入系统关键进程。CNCERT 判断这些页面「疑似由 AI 编码快速生成」，外观专业，靠页面精不精致分辨不了真假。也就是说，**危险从在搜索框里敲下软件名那一刻就开始了**。

- **看清域名**。CNCERT 统计的这批域名大量使用字母重复、缺字、错拼等手法。官网地址以仓库 README 为准，不以搜索结果标题为准。
- **「汉化版」「破解版」「绿色版」一律不碰**。这些名目本身就是最常见的捆绑借口：你无法知道打包者往安装包里加了什么，而主流开源客户端既不收费、多数也自带中文界面，根本没有「破解」或「汉化」的必要。
- **带解压密码的压缩包是明显的危险信号**。加密后，浏览器和杀毒软件在下载时看不到里面的内容，正规项目几乎不会这样发布安装包。

### 应用商店里的同名应用

应用商店有审核，门槛更高，但同样不是保险箱：

- **iOS**：用户无法自行校验安装包，信任链完全建立在 App Store 和开发者账号上。请从项目 README 或官网给出的链接跳转，并核对开发者名称。Apple 的审核指南禁止仿冒其他应用的名称和图标，但审核不等于安全审计。不要使用来路不明的共享 Apple ID，也不要安装企业签名或第三方签名工具分发的 IPA，这些都无从核验。
- **Android**：Google Play 上的版本不一定是官方发布的，有项目在 README 里明确声明过 Play 版本并非官方（见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/)）。第三方应用市场和 APK 下载站转存的安装包，要按下一节的方法核对签名。
- **HarmonyOS**：多数鸿蒙代理客户端没有上架应用市场，只能用调试签名侧载：把设备登记为某个华为开发者账号（可以是你自己的，也可能是第三方签名工具或他人的）的调试设备，再以调试身份安装；签名到期后，应用既不能安装也不能运行。借用他人账号或第三方工具签名时，还要额外信任对方。详见 [鸿蒙代理客户端现状](/posts/harmonyos-proxy-clients/)。

---

## 第二关：完整性与签名

### 哈希、签名、发布证明各自证明什么

先弄清楚每种校验手段能回答什么问题，避免「校验通过就放心了」的错觉：

| 手段 | 能证明 | 不能证明 |
|------|-------|---------|
| SHA256 与发布页公布的值一致 | 你的文件与发布页上那份完全相同，下载过程中没有损坏或被替换 | 发布页本身是真的；发布者值得信任 |
| GPG 签名 / 代码签名 | 文件出自持有某把私钥的人，签名后没被改过 | 私钥持有者就是你以为的那个人（需要从独立渠道核对公钥指纹或签名者名称）；签名者没有恶意 |
| GitHub 不可变发布与构建证明 | 发布后附件没有被替换；由哪个仓库发布，构建证明还能说明由哪个工作流构建 | 仓库里的代码本身无害 |
| 可复现构建 | 二进制确实是由公开的源码构建出来的 | 源码本身无害 |

换句话说，这些校验回答的都是「这个文件是不是它」，而「它值不值得信」仍然取决于上一节的来源判断。两关缺一不可。

### SHA256：三个平台的命令

很多项目会在 Releases 里给每个附件配一个 `.sha256` 文件，或者在发布说明里列出哈希值。下载后算一遍、比一遍：

```powershell
# Windows PowerShell：Get-FileHash 的默认算法就是 SHA256
Get-FileHash .\客户端安装包.exe -Algorithm SHA256

# 直接与发布页公布的值比较，输出 True 才算一致
# PowerShell 的 -eq 比较字符串时不区分大小写，不必担心大小写差异
(Get-FileHash .\客户端安装包.exe).Hash -eq '把发布页上的 64 位哈希值粘贴到这里'
```

```bash
# macOS
shasum -a 256 客户端安装包.dmg

# Linux
sha256sum 客户端安装包.deb

# 如果校验文件的格式是「哈希值 + 两个空格 + 文件名」，可以让工具自动比对，显示 OK 才算通过
sha256sum -c 客户端安装包.deb.sha256        # Linux
shasum -a 256 -c 客户端安装包.dmg.sha256     # macOS
```

- 校验文件只有哈希值、没有文件名时 `-c` 用不了，请完整比对 64 位字符，或用 PowerShell 的 `-eq` 写法，不要只看开头几位。
- 微软文档指出 MD5 和 SHA1 已不再被认为能抵御攻击，只提供 MD5 时只能发现下载损坏，防不了蓄意篡改。
- 发布页一旦被人控制，哈希值可以和安装包一起被换掉。所以哈希只能证明「和这个页面上公布的一致」，页面本身的真伪要靠上一关的来源判断。

### 进阶：GPG 签名与 GitHub 发布证明

有的项目用 GPG 给发布文件签名，例如 v2rayN，验证命令见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/) 的「校验下载的文件」一节。关键不在命令，而在于**公钥指纹要从独立渠道核对**（如项目 README），不能只信任和安装包放在一起的那份公钥。

GitHub 在 2025 年 10 月正式推出「不可变发布」（Immutable releases）：发布后附件和对应标签都不能再修改，并自动生成可验证的发布证明，Releases 页面会显示带锁图标的 Immutable 标识。项目启用了它或构建证明（artifact attestation）时，可以用 GitHub CLI 验证：

```bash
# 需要先安装 GitHub CLI 并登录
# 验证某个版本是否为不可变发布
gh release verify v1.2.3 -R OWNER/REPO

# 验证本地文件是否与该版本发布的附件一致
gh release verify-asset v1.2.3 ./下载的文件 -R OWNER/REPO

# 如果项目说明启用了构建证明，可以验证文件由哪个仓库的工作流构建
gh attestation verify ./下载的文件 -R OWNER/REPO
```

多数代理客户端目前没有启用这些机制。验证不了不等于有问题，退回到哈希加来源判断即可。

### Windows：看数字签名

右键安装包 → 属性，如果有「数字签名」选项卡，就能看到签名者名称；没有这个选项卡，说明文件没有签名。也可以用 PowerShell 查看：

```powershell
Get-AuthenticodeSignature .\客户端安装包.exe | Format-List Status, StatusMessage, SignerCertificate
```

结果怎么解读：

| 结果 | 含义 | 建议 |
|------|------|------|
| `NotSigned` | 没有签名 | 开源项目很常见，SmartScreen 会提示「未知发布者」，此时以哈希校验为主要依据 |
| `Valid`，签名者与项目方一致 | 签名完整有效 | 好信号 |
| `Valid`，但签名者是与项目无关的公司或个人 | 文件被他人重新打包签名 | 高度可疑，不要运行 |
| `NotTrusted` 或 `UnknownError` | 有签名，但证书链不受系统信任（常见于自签名证书），或签名本身无效 | 签名者名称证明不了身份，按未签名对待，以哈希和来源为准 |
| `HashMismatch` | 签名后文件被改动过 | 立即删除 |

例外是代签：有些开源项目由 SignPath Foundation 这类机构免费签名，机构确认安装包由公开仓库构建后以自己的名义担保，签名者显示为代签机构。是否属实，以项目 README 的说明为准。

不要为了让安装包「能运行」给来源不明的文件添加杀毒软件排除项，只有官方渠道下载、哈希无误的客户端才谈得上排除误报（参见 [平台特有问题](/posts/platform-specific/)）。

### macOS：codesign 与 spctl

macOS 自带的两个命令可以看清一个 App 的签名和 Gatekeeper 的态度：

```bash
# 查看签名信息：Authority 行是证书链，TeamIdentifier 是开发者团队 ID
codesign -dv --verbose=4 /Applications/某客户端.app

# 严格校验签名是否完整、包内文件是否被改动（Apple 技术说明中模拟 Gatekeeper 检查的写法）
codesign --verify --deep --strict --verbose=2 /Applications/某客户端.app

# 询问 Gatekeeper 的评估结果：accepted 或 rejected，source 说明依据（例如 Notarized Developer ID）
spctl -a -t exec -vv /Applications/某客户端.app
```

- `accepted` 且来源是经过公证的 Developer ID：签名者身份经过 Apple 确认，这是最好的情况。
- 只有临时签名（`Signature=adhoc`）：开源客户端常见，Gatekeeper 会拦截，只能依靠哈希和来源判断。
- `codesign --verify` 报告文件被修改：不要运行。

很多教程让你用 `xattr -d com.apple.quarantine` 去掉隔离标记来绕开 Gatekeeper。这等于主动关掉系统的最后一道检查，**只应在哈希核对无误之后做**，绝不要对来源不明的 App 这样做。

### Android：看 APK 的签名证书指纹

Android 要求所有应用都必须签名，而且更新版本必须由同一个签名者签发（v3 签名方案支持密钥轮换，属于例外）。因此，**APK 的签名证书指纹就是发布者的身份证**。

```bash
# 打印 APK 的签名证书信息
apksigner verify --print-certs 下载的客户端.apk
```

apksigner 随 Android SDK Build-Tools（24.0.3 及以上）提供，运行需要 Java；Windows 上是 build-tools 下对应版本文件夹里的 `apksigner.bat`，没加进 PATH 时要写完整路径。输出中有签名证书的 SHA-256 摘要，与官方 Releases 同一版本 APK 或 README 公布的指纹一致，即为同一签名者。

只为核对一次而装 SDK 门槛偏高。更省事的办法是用上文的 SHA256 命令，比较下载站的 APK 与官方 Releases 同一版本的 APK：哈希完全一致就是同一个文件，不必再查签名。

- **F-Droid 版和 GitHub 版互相不能覆盖安装，不一定是坏事**。F-Droid 通常用自己的密钥重新签名，只有项目支持可复现构建时才直接分发开发者原签名的 APK。
- **某个下载站拿到的 APK，指纹与所有官方渠道都对不上**，这才是真正的警报。
- **Android 拒绝用不同签名的包覆盖安装，这正是签名机制在保护你**。遇到这个提示，先把新包的证书指纹与官方渠道对照，确认它来自官方再决定去留；直接卸载重装会清空应用数据，也等于绕过了这道保护。
- JDK 的 `keytool -printcert -jarfile` 只认旧式 v1 签名，遇到只用 v2 / v3 签名的 APK 会输出 `Not a signed jar file`，容易被误读成「没有签名」。请以 apksigner 的结果为准。

---

## 开源不等于安全，闭源不等于危险

「开源的就安全」和「闭源的就有后门」都是常见误解。下表的三档划分借用了华润赢客户端目录对代码状态的分类口径（开源 / 源码不完整 / 未公开），后面几列是本文补上的两个问题：**你能验证多少、必须信任多少**。

| 源码状态 | 你能验证什么 | 你必须信任什么 | 作者停更后 |
|---------|------------|--------------|----------|
| 源码完整公开，可以独立构建 | 代码可审阅；理论上可以自己构建并比对；社区能接手 | 你下载的二进制确实由这份源码构建（除非有可复现构建）；有人真的认真看过代码 | 可以 fork 延续 |
| 源码不完整：只公开界面、核心以预编译库引入、缺少构建脚本或依赖私有组件 | 只能看到公开的部分 | 闭源的那部分 | 公开部分能延续，闭源部分不行 |
| 源码未公开 | 只能观察它的行为 | 开发者的信誉、商店审核、商业模式 | 无法延续 |

### 为什么开源不等于安全

- **没人看过的开源，和闭源差不多**。代码公开只提供了审计的可能，不代表有人审计过。
- **你运行的是二进制，不是源码**。没有可复现构建，就没法确认 Releases 里的安装包是由仓库代码编译出来的。
- **构建和发布环节也是攻击面**。前面的 Chrome 扩展事件里，出问题的不是源码，而是被钓鱼拿走的发布权限。

**可复现构建**（Reproducible Builds）指的是：给定同样的源码、构建环境和步骤，任何人都能构建出逐位相同的产物，第三方因此可以独立验证二进制确实来自公开源码。F-Droid 正是借此在自行构建结果与开发者 APK 一致时，直接分发开发者原签名的版本。

### 为什么闭源不等于危险

Surge、Shadowrocket、Quantumult X 等 iOS 付费客户端都不开源，但有长期经营的开发者、清楚的商业模式（卖软件本身），也要过 App Store 审核。对闭源软件，你信任的是开发者长期以来的表现：是否可追溯、是否持续维护、有没有不良记录。

### 许可证也值得看一眼

- **仓库没有许可证文件**：GitHub 文档说明，此时适用默认版权规则，别人可以查看和 fork，但无权使用、修改或再分发。作者一旦停更，社区很难正式接手。
- **GPL 附加额外条款**：有的项目附加了命名、商用等限制，不影响个人使用，但影响二次分发。
- **闭源部分无法被接手**：Clash Premium 内核一直以闭源二进制发布，2023 年 11 月作者删库后就此终止；延续 Clash 配置格式的，是早在 2021 年就从开源 Clash fork 出来的 Clash.Meta（现 mihomo），见 [Clash 系列全解](/posts/clash-family/) 和 [代理客户端演进史](/posts/proxy-client-history/)。

---

## 权限：它要的权限和它的功能对得上吗

### Android：VpnService 与 Root 模块是两回事

绝大多数 Android 客户端通过系统的 VpnService 接口工作。首次连接时系统会弹窗请求你的同意；连接期间状态栏会有钥匙图标和系统通知；同一时间只能有一个 VPN 在运行。它能接管经过虚拟网卡的全部流量，但**仍然被关在应用沙箱里**，读不到其他应用的私有数据。

Root 方案是另一回事：

| 对比项 | VpnService（普通客户端） | Root 模块（Magisk、KernelSU 等） |
|-------|---------------------|------------------------------|
| 前提 | 无，系统原生支持 | 解锁 Bootloader 并获取 Root |
| 权限来源 | 系统弹窗，你点同意 | 你给模块或应用授予 root |
| 能做到的事 | 接管虚拟网卡上的流量 | 用 iptables 做透明代理、修改系统分区、把证书放进系统信任区，以及任何 root 能做的事 |
| 系统提示 | 钥匙图标、常驻通知 | 通常没有 VPN 图标 |
| 风险边界 | 受沙箱约束 | 等于把整台手机交给它；刷机本身还有数据丢失、失去保修、部分应用拒绝运行的风险 |

Root 透明代理的原理和取舍见 [Android Root 透明代理](/posts/android-root-transparent-proxy/)。

权限要和功能对得上。代理客户端合理需要的权限包括：网络、VPN、通知（维持前台服务）；使用分应用代理时需要列出已安装应用；使用「按 Wi-Fi 名称切换规则」这类功能时，较新的 Android 版本要求授予定位权限（通常还要打开系统定位）才能读取 Wi-Fi 名称，这是系统限制，不等于客户端在收集位置。**以下权限与代理功能无关，出现就应警惕**：短信、通讯录、通话记录、无障碍服务（能读取屏幕内容并代替你点击）、设备管理器。

### iOS 与 macOS：Network Extension 和描述文件

iOS 客户端通过 Network Extension 框架（数据包隧道提供者）创建 VPN 配置，在「设置 → 通用 → VPN 与设备管理」里可见。它接管网络流量，App 本身仍在沙箱内。真正需要多一分警惕的是**描述文件**：它可以安装根证书、配置 VPN 和其他系统设置，除非明确知道用途，不要安装来路不明的描述文件。

macOS 上，客户端可能需要你批准网络扩展或系统扩展，有的还会安装以 root 身份运行的特权辅助程序来管理 TUN。批准之前，确认它来自你刚核验过的那个 App。

### 桌面端：服务模式、管理员权限与 TUN 驱动

TUN 模式要创建虚拟网卡、改写路由表，所以需要管理员权限。Windows 上，sing-box 和 mihomo 所用的 sing-tun 库都借助 Wintun 驱动创建虚拟网卡；Wintun 最初为 WireGuard 开发，按微软的驱动签名要求提供已签名版本。「服务模式」把一个高权限组件装成常驻的系统服务，开关 TUN 不必再点 UAC，代价是多了一个常驻的高权限组件。**只用系统代理、不用 TUN，就没必要装服务**。两种模式的区别见 [TUN 模式 vs 系统代理](/posts/tun-vs-system-proxy/)。

| 权限请求 | 合理的场景 | 需要警惕的情况 |
|---------|----------|-------------|
| UAC 或管理员密码 | 开启 TUN、安装服务模式 | 只用系统代理，却每次启动都要管理员权限 |
| 安装系统服务 / 守护进程 | 你主动开启服务模式 | 你没开，它自己装了；卸载后服务还在 |
| 安装根证书 | 你主动开启 MITM 功能 | 首次运行就要求安装，说不清用途 |
| 修改 hosts 或系统 DNS | 你启用了相关功能 | 未经说明就修改 |
| 开机自启 | 你在设置里打开 | 默认开启且无法关闭 |

### MITM 证书：装上意味着什么，用完怎么删

Surge、Quantumult X、Loon、Shadowrocket、Stash 等客户端都提供 HTTPS 解密（MITM）功能：客户端生成一张根证书，你安装并信任它，此后对名单里的域名，客户端就能以「中间人」身份解开 HTTPS。它用于重写请求、屏蔽广告、运行脚本，**与翻墙和分流本身无关**，普通使用不需要开启。确实要用时，请注意：

1. **证书私钥就在你的配置里**。以 Surge 为例，官方手册说明证书在本地用随机密钥生成，保存在配置文件和钥匙串中，私钥以 `ca-p12` 字段写在配置里。所以**把开启了 MITM 的完整配置分享出去，就等于交出了根证书私钥**。
2. **不要用别人给的固定证书**。Surge 官方指南提醒过：打包了固定根证书和私钥的工具非常不安全，网络一旦被劫持，攻击者就能用这把公开的私钥解密你的流量。应在本地生成自己独有的证书。
3. **远程模块和脚本要当作代码对待**。别人的模块可能顺带往 MITM 名单里加域名并附带脚本，这些脚本能读到解密后的 Cookie 和令牌。只导入可信来源，导入后检查名单，不要放入银行、支付、邮箱类域名。
4. **Android 上更要谨慎**。从 Android 7.0 起，面向新系统版本开发的应用默认不信任用户自行安装的 CA 证书，于是有些教程让你用 Root 模块把证书移进系统信任区，这等于让所有应用都信任它，风险随之放大。

用完之后，按平台清理：

| 平台 | 移除位置 |
|------|---------|
| iOS / iPadOS | 先到「设置 → 通用 → 关于本机 → 证书信任设置」关闭完全信任；再到「设置 → 通用 → VPN 与设备管理」选中对应描述文件，点「移除描述文件」 |
| macOS | 打开「钥匙串访问」，搜索证书名称并删除；如果是以描述文件安装的：macOS 15 及以上在「系统设置 → 通用 → 设备管理」中移除，macOS 13、14 在「系统设置 → 隐私与安全性」最下方的「描述文件」中移除 |
| Windows | 运行 `certmgr.msc`，在「受信任的根证书颁发机构 → 证书」中找到并删除（本机范围的证书需要用管理员身份打开 `certlm.msc`） |
| Android | 「设置 → 安全（与隐私）→ 更多安全设置 → 加密与凭据 → 用户凭据」中删除，各厂商路径略有不同；用 Root 模块移入系统区的，需要停用并移除该模块 |

同时在客户端里关闭 MITM；如果分享过含证书的配置，就重新生成证书并删除旧证书的信任。Shadowrocket 的安装步骤见 [Shadowrocket 使用指南](/posts/shadowrocket-guide/)，按相反顺序即可移除。

---

## 维护状态：停更的客户端为什么危险

### 看哪几个信号

| 信号 | 在哪里看 | 怎么解读 |
|------|---------|---------|
| 仓库已归档（Archived） | 仓库顶部的提示横幅；API 返回的 `archived` 字段 | 所有内容变为只读，不能再提交 Issue、PR 和发布。归档可以撤销，但很少发生 |
| 最近一次推送 | API 的 `pushed_at` | 半年以上没有任何推送，需要留意 |
| 最近一次正式发布 | Releases 页；API 的 `releases/latest` | 与所用内核上游的发布节奏对比 |
| Issue 响应 | Issues 页 | 大量「连不上」「新系统打不开」的问题无人回复 |
| README 声明 | 仓库首页顶部 | 「不再维护」「请寻找替代品」一类字样 |
| 内置内核版本 | 客户端的关于页或日志 | 落后上游很多个版本 |

用 API 看得更清楚。以原版 Clash Verge 为例：

```bash
curl -s https://api.github.com/repos/zzzgydi/clash-verge | grep -E '"(archived|created_at|pushed_at|updated_at)"'

# 查看某个仓库最近一次正式发布的版本号与时间
curl -s https://api.github.com/repos/OWNER/REPO/releases/latest | grep -E '"(tag_name|published_at)"'
```

```powershell
Invoke-RestMethod https://api.github.com/repos/zzzgydi/clash-verge | Select-Object full_name, archived, created_at, pushed_at, updated_at

# 最近一次正式发布
Invoke-RestMethod https://api.github.com/repos/OWNER/REPO/releases/latest | Select-Object tag_name, published_at
```

`releases/latest` 只返回最新的正式版。返回 `Not Found`，说明项目没有正式版（可能只发预发布版），请直接到 Releases 页面查看。命令没有输出时，先按上文的方法排除频率限制。

笔者核实时，这个仓库返回 `archived` 为 `true`，`pushed_at` 停在 2023-11-03，`updated_at` 却是最近的日期。这是因为 `updated_at` 记录的是「仓库对象」本身的任何变化，描述、设置等元数据都算，GitHub 没有公开完整的触发条件；一个早已归档的仓库，它还在刷新，恰好说明它反映的不是代码。**判断活跃度看 `pushed_at` 和 Releases，不看 `updated_at`**。

### 停更意味着什么

- **协议过时**。VLESS、Reality、Hysteria2 等近几年的主流协议，停更的客户端不会再跟进，连不上时你可能误以为是机场的问题。
- **漏洞不再修**。客户端要解析订阅、规则、配置这些「别人提供的内容」，解析环节本身就是攻击面。CVE-2022-26255 记录了 Clash for Windows 0.19.8 可被注入代理名称的特制内容触发任意代码执行，节点名这种看似无害的字段也能成为攻击载体。停更之后，这类问题再出现也没人修，内置的浏览器内核、TLS 库等组件也会一起老化。
- **「最新版」来源不明**。官方渠道关闭后，网上流传的「最新版」「修复版」都无法核验。

维护活跃也不代表可以放松：Chrome 扩展事件说明正规渠道的更新也可能被劫持。务实的做法是关注项目公告和 Issues，更新后留意有没有突然出现的新权限请求或证书安装提示。迁移成本通常很低，替代选择见 [2026 各平台客户端推荐](/posts/client-recommendations-2026/)。

---

## 订阅链接本身就是凭据

订阅链接通常带着一段代表你账号的令牌，拿到它的人能拉取你全部节点的地址、端口、UUID 或密码。后果包括：别人用你的流量、占用在线设备数把你挤下线、多地同时使用可能被机场判定为共享而封号；自建节点泄露的则是服务器凭据本身。

常见的泄露途径：

1. 求助时截图或贴出完整配置，没有打码；
2. 粘贴进来路不明的「在线订阅转换」网站，对方可以记录链接并随时自行拉取（风险与自建方案见 [订阅转换与管理](/posts/subscription-management/)）；
3. 云剪贴板、输入法云同步把链接带到了别处；
4. 上传的客户端日志里带着订阅地址。

还有一点常被忽略：**订阅里的内容也是输入**。CVE-2022-26255 说明节点名这种字段都可能被利用；来自他人的覆写脚本、远程规则集、模块，也应当像代码一样对待。

发现可能泄露时，机场用户在面板里重置订阅链接（多数面板提供此功能）、修改密码、查看流量与设备记录；自建用户更换 UUID 或密码，Reality 节点重新生成密钥对。

---

## 管理接口：别把遥控器挂在外面

mihomo 等内核提供外部控制接口（`external-controller`），图形客户端和 Web 面板都靠它工作。按 mihomo 的 API 文档，能访问它的人可以查看所有活动连接（目标地址、进程名、命中的规则，也就是你正在访问的每个网站），可以用任意内容重新加载配置（比如把流量指向他控制的服务器），还能触发内核重启和升级。最低限度要做到：

1. `external-controller` 只监听 `127.0.0.1`（例如 `127.0.0.1:9090`），不要改成 `0.0.0.0`；省略地址、只写 `:9090` 的写法，同样会监听所有网卡；
2. 一定要设置足够长的随机 `secret`，不要沿用教程里的示例值；
3. 以 Unix 套接字或 Windows 命名管道方式开放的控制接口不做 secret 校验，没有明确需要就别启用；
4. 开启 `allow-lan` 共享代理时，用 `lan-allowed-ips` 限定来源或用 `authentication` 设置认证，否则同一网络里的任何人都能用你的代理；机器有公网 IP 时，等于在公网上开了一个开放代理；
5. 路由器、VPS 上的 Web 面板不要直接暴露到公网，更不要通过明文 HTTP 远程访问，否则 secret 会以明文形式在网络上传输。

逐项配置和自检命令见 [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/)，路由器场景见 [软路由与旁路由](/posts/soft-router-guide/)，给终端和容器共享代理时的注意事项见 [命令行与开发工具走代理](/posts/terminal-proxy/)。

---

## 安装前 10 项自查清单

可以打印出来，或者存进备忘录，每装一个新客户端就对照一遍：

| # | 检查项 | 怎么查 | 通过标准 |
|---|-------|-------|---------|
| 1 | 入口 | 从项目 README 或官方文档点进下载页 | 地址与文档一致，不是搜索结果里的仿冒站、网盘或群文件 |
| 2 | 仓库身份 | 看所有者、创建时间、提交历史、fork 关系 | 历史长、有真实维护者，不是新建的同名仓库 |
| 3 | 维护状态 | 看 Archived 横幅和最近一次发布时间 | 未归档，近几个月内有发布 |
| 4 | 文件形式 | 看 Releases 附件 | 不是带密码的压缩包，不是汉化、破解、绿色版 |
| 5 | 哈希 | `Get-FileHash`、`shasum -a 256`、`sha256sum` | 与发布页公布的值完全一致 |
| 6 | 签名 | 数字签名选项卡、`codesign` / `spctl`、`apksigner` | 签名者与项目方一致；未签名时哈希必须通过 |
| 7 | 权限 | 看安装和首次运行时的权限请求 | 与功能对应；不索要短信、通讯录、无障碍、设备管理器 |
| 8 | 根证书 | 看是否要求安装证书或描述文件 | 不需要 MITM 就不装 |
| 9 | 管理接口 | 看 `external-controller`、`secret`、`allow-lan` | 地址是 `127.0.0.1`（不是 `0.0.0.0`，也不是只写端口）并已设 secret；局域网共享有白名单或认证 |
| 10 | 订阅 | 看导入方式 | 直接粘贴进客户端，不经过不信任的转换站；截图前先打码 |

---

## 发现可疑之后怎么办

如果签名对不上、杀毒软件报出明确的木马家族名，或电脑出现不明进程和弹窗，按下面的顺序处理。

### 第 1 步：先断网

拔网线或关闭 Wi-Fi。远控木马和窃密程序要联网才能外传数据、接收指令，先切断再处理。

### 第 2 步：退出、卸载，并检查残留

**Windows**：

```powershell
# 残留的系统代理（浏览器等使用的 WinINet 设置）
# ProxyEnable 为 0x1 表示系统代理开着，0x0 表示关着
# 关着的时候，残留的 ProxyServer（如 127.0.0.1:7890）不会生效
# ProxyServer、AutoConfigURL 提示找不到指定的注册表项或值，说明从没设置过
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL

# WinHTTP 代理（部分系统组件使用）
netsh winhttp show proxy

# 残留的服务（同时匹配服务名和显示名）、计划任务和虚拟网卡
$kw = 'clash|mihomo|verge|sing-box|v2ray|xray'
Get-Service | Where-Object { $_.Name -match $kw -or $_.DisplayName -match $kw }
Get-ScheduledTask | Where-Object TaskName -Match $kw
Get-NetAdapter | Select-Object Name, InterfaceDescription, Status

# 受信任的根证书（CurrentUser\Root 已包含本机范围的证书），按证书有效期起始时间（NotBefore，不是安装时间）倒序列出前 10 个
Get-ChildItem Cert:\CurrentUser\Root | Sort-Object NotBefore -Descending | Select-Object -First 10 Subject, NotBefore, Thumbprint
```

如果 `ProxyEnable` 是 `0x1`，或者 `AutoConfigURL` 有值，而客户端已经卸载，请到「设置 → 网络和 Internet → 代理」里关掉。

关键词请按你实际装过的客户端调整。根证书那一条：本地生成的 MITM 证书有效期通常从生成当天开始，会排在前面；但外设驱动、游戏平台等正常软件也可能装有本地根证书，名称陌生不等于恶意，请对照装过的软件逐个判断。想确认某张证书是否装在本机范围（删除需要管理员权限），把 `CurrentUser` 换成 `LocalMachine` 再查一遍。开机自启项可以在任务管理器的「启动应用」里查看。

**macOS**：

```bash
# 当前生效的代理设置（HTTP、HTTPS、SOCKS、自动代理配置）
scutil --proxy

# 列出本机所有网络服务的准确名称
networksetup -listallnetworkservices

# 查看某个网络服务的代理状态，把 Wi-Fi 换成上一条列出的服务名
networksetup -getwebproxy "Wi-Fi"
networksetup -getsecurewebproxy "Wi-Fi"
networksetup -getsocksfirewallproxy "Wi-Fi"

# 列出用户级和管理员级被设置了自定义信任的证书
security dump-trust-settings
security dump-trust-settings -d

# 残留的特权辅助程序和启动项（含对所有用户生效的 /Library/LaunchAgents）
ls /Library/LaunchDaemons /Library/LaunchAgents /Library/PrivilegedHelperTools ~/Library/LaunchAgents
```

另外检查「系统设置 → 通用 → 登录项与扩展」（macOS 13、14 为「通用 → 登录项」），以及描述文件列表（macOS 15 及以上在「通用 → 设备管理」，macOS 13、14 在「隐私与安全性 → 描述文件」）。

**Linux**：

```bash
# 当前 shell 的代理变量，以及配置文件里下次开终端时会重新生效的残留
env | grep -i proxy
grep -isE 'proxy' ~/.bashrc ~/.profile ~/.zshrc /etc/environment

# 已安装的系统服务与用户服务（包括没在运行的）
systemctl list-unit-files --type=service | grep -Ei 'clash|mihomo|sing-box|xray|v2ray'
systemctl --user list-unit-files --type=service | grep -Ei 'clash|mihomo|sing-box|xray|v2ray'

# 桌面登录自启项
ls ~/.config/autostart/

# GNOME 桌面的系统代理模式
gsettings get org.gnome.system.proxy mode
```

**手机**：iOS 检查「设置 → 通用 → VPN 与设备管理」里有没有残留的 VPN 配置和描述文件，以及「证书信任设置」；Android 检查「网络和互联网 → VPN」里的条目（可以选择忘记）、前面提到的用户凭据、无障碍服务列表和设备管理应用列表。

### 第 3 步：在另一台干净的设备上更换凭据

键盘记录程序可能还在运行，所以不要在可疑设备上改密码。在另一台可信设备上：

1. 重置订阅链接，修改机场账号密码；自建节点更换 UUID、密码和密钥；
2. 修改可疑客户端运行期间登录过的重要账号密码，尤其是它装过根证书或以管理员身份运行过的情况；
3. 为重要账号开启两步验证，并退出其他设备上的登录；
4. 这台设备上用过加密货币钱包的，应视为密钥可能已泄露，按钱包方的安全指引处理。

### 第 4 步：扫描，必要时重装系统

用系统自带或可信的安全软件全盘扫描，但扫描干净不能证明没问题，多引擎扫描同样存在漏报。如果可疑程序曾以管理员或 root 身份运行、装过驱动或证书，最稳妥的是备份个人数据后重装系统。**重装会清空数据，务必先备份，备份时不要带上来源不明的可执行文件**。

### 第 5 步：保留证据，向项目方反馈

记下下载地址，保存文件的 SHA256 值。遇到仿冒仓库或站点，可以到原项目的 Issues 提醒维护者，或用 GitHub 的举报功能报告仿冒仓库，帮下一个差点点进去的人避坑。

---

## 常见问题（FAQ）

### 杀毒软件报毒，就说明客户端有问题吗？

不一定。修改系统代理和 DNS、安装虚拟网卡驱动、监听端口，这些行为本身就容易触发启发式检测，官方渠道的开源客户端被误报并不少见。先核对来源、哈希和签名，再看报毒名称：泛泛的「可疑行为」与明确的木马家族名分量完全不同。可以上传到 VirusTotal 看多引擎结果，但上传的文件可能被共享给安全厂商和付费用户，不要上传含个人信息的文件。反过来，**没有报毒也不代表安全**。

### GitHub 上 Star 很多的仓库就可信吗？

不能这么判断。前面提到的研究识别出约 600 万个疑似虚假 Star，大量流向传播钓鱼和恶意软件的短命仓库。Star 只能参考，要结合创建时间、提交历史、维护者，以及官方文档是否引用了这个地址一起看。

### 从 App Store 或 Google Play 下载就一定安全吗？

门槛更高，但不是保证。商店里仍有名字近似的应用和非官方发布的版本；2016 年那项研究分析的 283 个 VPN 应用全部来自 Google Play，其中就有向流量注入脚本、拦截 TLS 的应用；Chrome 扩展事件说明商店的更新渠道也可能被劫持。商店解决的是「文件确实来自某个开发者账号」，不解决「这个开发者值不值得信任」。

### 机场自己发的专用客户端安全吗？

这相当于把信任集中到同一方：机场本来就能看到经过它服务器的流量元数据，专用客户端又运行在你的设备上，能看到的更多，而且多为闭源或二次打包，外人很难核验。机场同时提供标准订阅时，更稳妥的是用通用开源客户端导入；必须用专用客户端时，同样按清单检查，不授予与代理无关的权限。

### 只开系统代理、不开 TUN，是不是就安全了？

经过客户端的流量会少一些，但不改变「它是一个在你电脑上运行的程序」这个事实，安装程序本身往往就以管理员权限运行。安全与否首先取决于程序是否可信，其次才是工作模式。不需要时不开 TUN、不装服务，是减少攻击面的好习惯，但替代不了来源核验。

### 装过 MITM 证书忘了删，会怎样？

只要证书还被信任，拿到它私钥的人在能劫持你网络路径时，就可以对这台设备冒充任意网站。私钥又恰好在你的客户端配置里，配置一旦外流，风险就成了现实。不用就删，并在客户端里关掉 MITM；配置分享过就重新生成证书。

### 停更的客户端还能连上，继续用有什么问题？

「能连上」只说明协议还兼容。停更意味着漏洞不再修、组件逐渐老化、新协议不会跟进，而它仍要持续解析来自网络的订阅和规则。迁移到仍在维护的同类客户端，成本通常只是重新导入一次订阅。

---

## 外部参考

以下链接均在写作时实际访问核对过（2026-09-24 前后）：

- [国家互联网应急中心：黑产团伙批量搭建高仿真钓鱼网站传播银狐木马的风险提示（2026-05-22）](https://www.cert.org.cn/publish/main/10/2026/20260522113326926111046/20260522113326926111046_.html)；[风险提示原文 PDF（含仿冒软件统计与钓鱼页样例）](https://www.cert.org.cn/publish/main/upload/File/SilverFox.pdf)；[澎湃新闻转载](https://m.thepaper.cn/newsDetail_forward_33209189)
- [FortiGuard Labs：SEO Poisoning Attack Targets Chinese-Speaking Users with Fake Software Sites](https://www.fortinet.com/blog/threat-research/seo-poisoning-attack-targets-chinese-speaking-users-with-fake-software-sites)
- [Developer Tech：GitHub suffers from over 100K infected repos](https://www.developer-tech.com/news/github-suffers-over-100k-infected-repos/) — 转述 Apiiro 披露的仓库混淆攻击
- [Ikram 等：An Analysis of the Privacy and Security Risks of Android VPN Permission-enabled Apps（IMC 2016）](https://dl.acm.org/doi/10.1145/2987443.2987471)
- [Google Cloud 威胁情报：Disrupting the World's Largest Residential Proxy Network](https://cloud.google.com/blog/topics/threat-intelligence/disrupting-largest-residential-proxy-network)
- [Securelist：StaryDobry campaign spreads XMRig miner via torrents](https://securelist.com/starydobry-campaign-spreads-xmrig-miner-via-torrents/115509/)
- [Sekoia：Targeted supply chain attack against Chrome browser extensions（2025-01-22）](https://www.sekoia.com/blog/targeted-supply-chain-attack-against-chrome-browser-extensions)
- [He 等：Six Million (Suspected) Fake Stars in GitHub（ICSE 2026）](https://arxiv.org/abs/2412.13459)
- [Microsoft Learn：Get-FileHash](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash)；[Get-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature)；[SignatureStatus 枚举](https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.signaturestatus)
- [SignPath Foundation](https://signpath.org/) — 为开源项目免费代签的机构
- [Apple TN2206：macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/_index.html) — codesign 与 spctl 的检查写法
- [Android Developers：apksigner](https://developer.android.com/tools/apksigner)；[Android 开源项目：APK 签名方案](https://source.android.com/docs/security/features/apksigning)
- [Android Developers：VpnService](https://developer.android.com/reference/android/net/VpnService)；[网络安全配置（用户 CA 的默认信任规则）](https://developer.android.com/privacy-and-security/security-config)；[Wi-Fi 相关权限](https://developer.android.com/develop/connectivity/wifi/wifi-permissions)
- [Google 帮助：在 Android 上连接 VPN](https://support.google.com/android/answer/9089766)；[添加和移除证书](https://support.google.com/pixelphone/answer/2844832)
- [Apple 开发者文档：NEPacketTunnelProvider](https://developer.apple.com/documentation/networkextension/nepackettunnelprovider)；[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple 支持：信任手动安装的证书描述文件](https://support.apple.com/en-us/102390)；[在 iPhone 上安装或移除配置描述文件](https://support.apple.com/guide/iphone/install-or-remove-configuration-profiles-iph6c493b19/ios)；[更改 Mac 上的设备管理设置](https://support.apple.com/guide/mac-help/mh35474/mac)（macOS 14 版本见 [此页](https://support.apple.com/guide/mac-help/mh35474/14.0/mac/14.0)）；[登录项与扩展设置](https://support.apple.com/guide/mac-help/mtusr003/mac)
- [Surge 手册：HTTPS 解密（MITM）](https://manual.nssurge.com/http/mitm.html)；[Understanding Surge 官方指南](https://manual.nssurge.com/book/understanding-surge/en/)
- [mihomo 文档：通用配置](https://wiki.metacubex.one/config/general/)；[mihomo 文档：API](https://wiki.metacubex.one/api/)
- [GitHub Docs：归档仓库](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)；[为仓库授权许可](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)；[验证组织域名](https://docs.github.com/en/organizations/managing-organization-settings/verifying-or-approving-a-domain-for-your-organization)
- [GitHub Docs：验证发布的完整性](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verifying-the-integrity-of-a-release)；[GitHub Changelog：Immutable releases 正式可用](https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/)；[使用构建证明确立来源](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds)
- [GitHub REST API：获取仓库（fork 时附带 parent 与 source）](https://docs.github.com/en/rest/repos/repos#get-a-repository)；[获取最新正式版](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)；[频率限制](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub API 示例：原版 Clash Verge 仓库信息](https://api.github.com/repos/zzzgydi/clash-verge)；[GitHub 社区讨论：updated_at 与 pushed_at 的区别](https://github.com/orgs/community/discussions/24442)
- [CVE-2022-26255](https://www.cve.org/CVERecord?id=CVE-2022-26255) — Clash for Windows 0.19.8 任意代码执行漏洞记录
- [Reproducible Builds：定义](https://reproducible-builds.org/docs/definition/)；[F-Droid：Reproducible Builds](https://f-droid.org/docs/Reproducible_Builds/)
- [Wintun](https://www.wintun.net/) — Windows TUN 驱动；[sing-tun 源码中的 wintun 目录](https://github.com/SagerNet/sing-tun/tree/dev/internal)
- [MetaCubeX/mihomo 仓库信息](https://api.github.com/repos/MetaCubeX/mihomo) — 创建于 2021-05-20
- [sing-box 文档：官方图形客户端](https://sing-box.sagernet.org/clients/) — 从上游文档找客户端入口的示例
- [VirusTotal 文档：How it works](https://docs.virustotal.com/docs/how-it-works)

客户端目录与时间线线索参考：华润赢（[huarun.win](https://huarun.win/)）

本文的选题与「开源 / 源码不完整 / 未公开」三档分类参考了：[首页 FAQ](https://huarun.win/)、[编辑与收录标准](https://huarun.win/editorial-policy)、[源码不完整分类](https://huarun.win/incomplete-source)。文中事实均已回到上面列出的一手来源核实。

站内相关文章：

- [代理能做什么、不能做什么（安全与隐私的边界）](/posts/privacy-boundaries/) — 机场、运营商、目标网站分别能看到什么
- [2026 各平台代理客户端推荐清单](/posts/client-recommendations-2026/) — 各客户端的官方获取渠道与停更名单
- [代理客户端演进史](/posts/proxy-client-history/) — 删库、归档、改名背后的来龙去脉
- [订阅转换与管理](/posts/subscription-management/) — 公共转换服务的风险与自建方案
- [mihomo 配置文件逐段详解](/posts/mihomo-config-anatomy/) — external-controller、secret、allow-lan 的配置与自检
- [DNS 泄漏是什么、怎么检测、怎么防](/posts/dns-leak/) — 换完客户端后顺手做一次泄漏检测
- [浏览器指纹与隐私防护](/posts/browser-fingerprint/) — 代理之外的追踪手段
