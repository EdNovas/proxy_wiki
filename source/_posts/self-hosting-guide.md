---
title: 自建代理完整指南：从购买 VPS 到配置 VLESS+Reality
date: 2026-05-10
updated: 2026-05-10
categories:
  - 入门指南
tags:
  - 自建
  - VPS
  - VLESS
  - Reality
  - Xray
  - 教程
index_img: /images/posts/self-hosting-guide.png
excerpt: 不依赖机场，自己搭建代理。从选购 VPS、安装 Xray、配置 VLESS+Reality 到客户端连接的完整教程。
---

> **摘要**：不想依赖机场，想完全掌控自己的代理服务？本文从零开始，手把手带你走完自建代理的全流程——选购 VPS、配置服务器环境、安装 Xray、部署 VLESS+Reality、客户端连接，一步不落。适合有一定 Linux 基础、愿意动手的用户。

---

## 自建 vs 机场

在投入时间和金钱之前，先确认自建确实适合你。

自建代理的核心优势是**完全控制**和**隐私最优**——服务器只有你一个人用，没有任何第三方能看到你的流量元数据。但代价也很明确：单点故障、IP 被封需要自己处理、缺少多地区覆盖、运维成本不低。

如果你不确定自建是否适合自己的情况，建议先阅读 [月付 vs 年付、自建 vs 机场：决策框架](/posts/decision-framework/) 那篇文章，里面有一套系统的评估方法。

**简单来说**：如果你具备基本的 Linux 操作能力、只需要一个地区的节点、对隐私有较高要求、并且愿意投入时间维护——自建值得尝试。反之，机场可能更适合你。

本文假设你已经做出了自建的决定，接下来进入实操环节。

---

## 第一步：选购 VPS

VPS（Virtual Private Server，虚拟专用服务器）是你运行代理的基础设施。选购 VPS 需要考虑以下几个维度。

### 地理位置

VPS 的地理位置直接影响延迟和使用体验。常见的选择：

| 地区 | 典型延迟（大陆直连） | 适合场景 | 备注 |
|------|----------------------|----------|------|
| 香港（HK） | 30-60ms | 低延迟需求、游戏 | 价格较贵，带宽常受限 |
| 日本（JP） | 50-80ms | 日常使用、流媒体 | 线路成熟，选择多 |
| 新加坡（SG） | 60-100ms | 东南亚服务、通用 | 部分线路绕美国 |
| 美国（US） | 150-200ms | 大带宽需求、低价 | 延迟高但带宽便宜 |

**建议**：如果只买一台，日本是综合性价比最高的选择。延迟可接受，线路稳定，价格也不算太贵。

### VPS 提供商

以下是一些适合自建代理的 VPS 提供商，各有侧重：

**BandwagonHost（搬瓦工）**
老牌提供商，中国用户群体最大。CN2 GIA 线路质量优秀，但价格相对较高（年付 $49.99 起）。适合对线路质量有要求的用户。官网有中文界面，支持支付宝。

**RackNerd**
以极低价格著称，美国节点年付低至 $10 左右。经常在促销期间推出超低价套餐。适合预算有限、对延迟要求不高的用户。缺点是线路质量一般，走的是普通线路。

**DMIT**
提供优质的香港和日本 CN2 GIA 线路，价格比搬瓦工略低。Premium 线路质量非常好，但基础套餐带宽较小。适合追求线路质量且预算充足的用户。

**AWS Lightsail**
亚马逊云的轻量级 VPS 服务，$3.5/月起。优势是 IP 被封后可以免费更换（释放旧 IP 绑定新 IP），缺点是到大陆的线路质量一般。适合怕折腾 IP 问题的用户。

**DigitalOcean**
界面简洁，操作友好，$4/月起。新加坡和旧金山节点到大陆的线路尚可。IP 被封后也可以通过销毁重建 Droplet 的方式更换 IP。适合有一定英文基础的用户。

### 硬件规格

运行 Xray 代理不需要多好的配置。最低要求：

- **CPU**：1 核
- **内存**：512MB（够用），1GB（更稳）
- **硬盘**：10GB SSD
- **带宽**：500GB/月以上（日常使用足够）
- **系统**：Debian 12 或 Ubuntu 22.04 LTS（推荐 Debian，更轻量）

### 注意事项

**避免严重超售的提供商**。如果一个 VPS 价格低到不合理（比如 1GB 内存年付 $5），大概率是严重超售。大量用户共享同一台物理服务器，高峰期 CPU 和网络都会被争抢，代理体验会很差。

**购买前测试 IP 是否可用**。很多 VPS 提供商的 IP 段已经被 GFW 封锁过。购买后发现 IP 不通会非常麻烦。部分提供商支持购买前测试 IP 或提供 IP 更换服务，优先选择这类提供商。

测试 IP 是否被封的方法：在大陆环境下用浏览器访问 `https://ping.pe/<你的IP>`，看各地区的连通性。

---

## 第二步：服务器基础配置

拿到 VPS 后，首先做一些基础配置来保障安全和性能。

### 连接服务器

VPS 提供商会给你一个 IP 地址和 root 密码（或 SSH 密钥）。用 SSH 连接：

```bash
ssh root@你的服务器IP
```

如果是 Windows 用户，可以用 PowerShell 自带的 SSH 或 PuTTY、FinalShell 等工具。

### 更新系统

连上服务器后，第一件事是更新系统包：

```bash
apt update && apt upgrade -y
```

### 安装常用工具

```bash
apt install -y curl wget vim unzip
```

### 开启 BBR

BBR（Bottleneck Bandwidth and Round-trip propagation time）是 Google 开发的 TCP 拥塞控制算法，能显著提升代理连接的速度和稳定性。Debian 12 和 Ubuntu 22.04 的内核已经内置了 BBR，只需要启用即可：

```bash
# 写入配置
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf

# 使配置生效
sysctl -p

# 验证 BBR 是否启用
sysctl net.ipv4.tcp_congestion_control
# 输出应为：net.ipv4.tcp_congestion_control = bbr

lsmod | grep bbr
# 输出应包含 tcp_bbr
```

### 配置防火墙

用 `ufw`（Uncomplicated Firewall）配置基础防火墙规则。只放行必要的端口：

```bash
# 安装 ufw
apt install -y ufw

# 默认策略：拒绝所有入站，允许所有出站
ufw default deny incoming
ufw default allow outgoing

# 放行 SSH（重要！先放行再启用，否则会把自己锁在外面）
ufw allow 22/tcp

# 放行你打算给 Xray 使用的端口（这里以 443 为例）
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看规则
ufw status verbose
```

{% note warning %}
**务必先放行 SSH 端口再启用 ufw**，否则你会被锁在服务器外面，只能通过 VPS 提供商的控制台 VNC 才能重新登录。
{% endnote %}

### （可选）创建普通用户

出于安全考虑，不建议长期使用 root 账户。可以创建一个普通用户并赋予 sudo 权限：

```bash
adduser proxyuser
usermod -aG sudo proxyuser
```

后续操作用 `proxyuser` 登录，需要管理员权限时加 `sudo`。本文为了简化演示，后续步骤仍以 root 执行。

---

## 第三步：安装 Xray

[Xray-core](https://github.com/XTLS/Xray-core) 是 VLESS+Reality 协议的实现核心。使用官方的一键安装脚本：

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

安装完成后，验证版本：

```bash
xray version
```

输出应显示当前安装的 Xray 版本号，类似 `Xray 24.12.31 (Xray, Pair of Conditions) ...`。

接下来生成配置所需的密钥和 UUID：

```bash
# 生成 UUID（用于客户端认证）
xray uuid
# 输出示例：a1b2c3d4-e5f6-7890-abcd-ef1234567890

# 生成 x25519 密钥对（用于 Reality）
xray x25519
# 输出示例：
# Private key: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
# Public key:  BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=
```

**记下这三个值**：UUID、Private key（私钥）、Public key（公钥）。私钥配置在服务端，公钥配置在客户端。

---

## 第四步：配置 VLESS+Reality

编辑 Xray 的主配置文件：

```bash
vim /usr/local/etc/xray/config.json
```

将以下内容写入（替换注释标注的部分为你自己生成的值）：

```json
{
    // 日志设置
    "log": {
        "loglevel": "warning"  // 日志级别：debug/info/warning/error/none
    },

    // 入站配置（监听来自客户端的连接）
    "inbounds": [
        {
            "listen": "0.0.0.0",           // 监听所有网卡
            "port": 443,                    // 监听端口，建议 443
            "protocol": "vless",            // 协议：VLESS
            "settings": {
                "clients": [
                    {
                        "id": "你生成的UUID",           // 第三步生成的 UUID
                        "flow": "xtls-rprx-vision"      // 流控模式，必须为 vision
                    }
                ],
                "decryption": "none"        // VLESS 不需要额外加密
            },
            "streamSettings": {
                "network": "tcp",           // 传输层：TCP
                "security": "reality",      // 安全层：Reality
                "realitySettings": {
                    "dest": "www.apple.com:443",     // 伪装目标网站（见下方说明）
                    "serverNames": [                  // 允许的 SNI 列表
                        "www.apple.com",
                        "apple.com"
                    ],
                    "privateKey": "你生成的私钥",       // 第三步生成的 Private key
                    "shortIds": [                      // 短 ID，可自定义（0-16位十六进制）
                        "",
                        "abcd1234"
                    ]
                }
            }
        }
    ],

    // 出站配置（代理服务器如何访问目标网站）
    "outbounds": [
        {
            "protocol": "freedom",          // 直连出站：直接访问目标
            "tag": "direct"
        },
        {
            "protocol": "blackhole",        // 黑洞出站：丢弃流量
            "tag": "block"
        }
    ]
}
```

{% note info %}
Xray 的 JSON 配置支持 `//` 注释，这是 Xray 的特性而非 JSON 标准。如果你使用其他工具解析此文件可能会报错。
{% endnote %}

### 关键参数说明

**dest（伪装目标）**

`dest` 是 Reality 的核心参数之一，指定客户端伪装访问的目标网站。当 GFW 或任何第三方探测你的服务器时，服务器会将请求转发到这个真实网站并返回真实的 TLS 证书，使探测者认为你的服务器只是一个普通的反向代理。

选择 `dest` 目标的要求：
- 必须是境外网站（不在 GFW 封锁名单上）
- 必须支持 TLS 1.3 和 HTTP/2
- 域名不能有重定向（访问时不能自动跳转到其他域名）
- 目标站 IP 与你的 VPS IP 不能相差太远（最好在同一地区）

常用的 `dest` 目标：`www.apple.com:443`、`www.microsoft.com:443`、`www.samsung.com:443`、`www.lovelive-anime.jp:443`。你也可以自己找——用浏览器开发者工具检查目标站是否支持 TLS 1.3 和 HTTP/2。

**serverNames（SNI 列表）**

`serverNames` 是允许客户端使用的 SNI（Server Name Indication）值。必须与 `dest` 目标的域名一致。通常填写 `dest` 中的域名及其主域名即可。

**privateKey（私钥）**

服务端使用的 x25519 私钥，用于与客户端完成 Reality 的密钥协商。这个值必须保密，只存在于服务端配置中。对应的公钥需要配置在客户端。

**shortIds（短 ID）**

额外的认证字段，可以理解为一个简单的密码。空字符串 `""` 表示允许不带 shortId 的连接。你可以生成随机的十六进制字符串作为 shortId（最长 16 位），客户端连接时必须携带匹配的 shortId。

**flow（流控）**

设置为 `xtls-rprx-vision`。Vision 模式会对内层 TLS 握手包进行填充处理，消除 TLS-in-TLS 的流量特征，提高隐蔽性。使用 Reality 时必须配合 vision 使用。

关于 VLESS+Reality 原理的深入解析，参见 [VLESS+Reality 深度解析](/posts/vless-reality-deep-dive/)。各协议的横向对比可参考 [主流代理协议横向对比](/posts/protocol-comparison/)。

---

## 第五步：启动与验证

配置写完后，启动 Xray 并设置开机自启：

```bash
# 启用开机自启
systemctl enable xray

# 启动 Xray
systemctl start xray

# 查看运行状态
systemctl status xray
```

如果状态显示 `active (running)`，说明启动成功。如果显示 `failed`，需要查看日志排查问题：

```bash
# 查看 Xray 日志（实时跟踪）
journalctl -u xray -f

# 查看最近 50 行日志
journalctl -u xray -n 50
```

常见的启动失败原因：

- **JSON 格式错误**：多了或少了逗号、引号不匹配。可以先用 `xray run -test -c /usr/local/etc/xray/config.json` 测试配置文件语法。
- **端口被占用**：443 端口可能被 Nginx 或其他服务占用。用 `ss -tlnp | grep 443` 检查。
- **密钥格式错误**：确保 UUID 和 x25519 密钥是完整复制的，没有多余的空格或换行。

---

## 第六步：客户端配置

服务端跑起来后，需要在本地设备上配置客户端来连接。

### Clash Verge Rev（推荐）

[Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) 支持 VLESS+Reality。你需要创建一个本地配置文件。

在 Clash Verge 的"订阅"（Profiles）页面中，点击"新建"，选择"Local"类型，创建一个 YAML 配置文件，填入以下内容：

```yaml
proxies:
  - name: "我的VPS"
    type: vless
    server: 你的服务器IP           # VPS 的 IP 地址
    port: 443                       # 与服务端配置一致
    uuid: 你生成的UUID              # 与服务端配置一致
    network: tcp
    udp: true
    tls: true
    flow: xtls-rprx-vision          # 与服务端配置一致
    servername: www.apple.com       # 与服务端 serverNames 一致
    reality-opts:
      public-key: 你生成的公钥      # 第三步生成的 Public key（不是私钥！）
      short-id: "abcd1234"          # 与服务端 shortIds 中的某一个一致

proxy-groups:
  - name: "Proxy"
    type: select
    proxies:
      - "我的VPS"

rules:
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

保存后，在 Clash Verge 中选中这个配置，切换代理模式为"规则"模式（Rule），然后开启系统代理或 TUN 模式。打开浏览器访问 `https://www.google.com`，如果能正常加载，说明一切配置正确。

{% note info %}
上面的 rules 只是最简化的示例——大陆 IP 直连，其余走代理。如果需要更精细的分流规则，参考 [规则入门](./what-are-rules.md) 和 [自定义规则](./custom-rules.md)。
{% endnote %}

### v2rayN（Windows）

v2rayN 同样支持 VLESS+Reality。添加服务器时选择 VLESS 协议，然后填入对应的参数：

- 地址：你的服务器 IP
- 端口：443
- UUID：与服务端一致
- 流控（Flow）：xtls-rprx-vision
- 传输方式：tcp
- TLS：reality
- SNI：www.apple.com
- 公钥（Public Key）：第三步生成的公钥
- 短 ID（Short Id）：与服务端一致

v2rayN 的界面会引导你逐项填写，按照服务端配置对应填入即可。

---

## 进阶优化

基础搭建完成后，可以通过以下手段进一步优化体验。

### 确认 BBR 生效

第二步中我们已经启用了 BBR。如果你跳过了那一步，或者想确认是否真的生效了：

```bash
sysctl net.ipv4.tcp_congestion_control
```

输出应为 `bbr`。如果显示 `cubic` 或其他值，回到第二步重新配置。BBR 对代理速度的提升非常明显，尤其是在丢包率较高的国际线路上。

### 使用 warp-cli 获取 IPv6 和解锁能力

很多 VPS 默认只有 IPv4，部分流媒体服务（如 Netflix）和 AI 服务可能需要特定地区的 IP 才能解锁。Cloudflare WARP 可以为你的 VPS 提供一个 Cloudflare 的出口 IP，有时能绕过一些 IP 限制。

安装 WARP CLI：

```bash
# 添加 Cloudflare 的 APT 仓库（以 Debian 为例）
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg \
  | gpg --dearmor -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" \
  | tee /etc/apt/sources.list.d/cloudflare-client.list

apt update && apt install -y cloudflare-warp

# 注册并启用代理模式
warp-cli registration new
warp-cli mode proxy
warp-cli connect

# 验证（通过 WARP 的 socks5 代理访问）
curl --proxy socks5://127.0.0.1:40000 https://cloudflare.com/cdn-cgi/trace
```

然后在 Xray 的出站配置中，可以添加一条通过 WARP 出去的出站规则，配合路由将特定流量经由 WARP 转发。这属于更高级的配置，适合有具体解锁需求的用户。

### IP 监控与告警

自建节点最怕 IP 被封。你可以写一个简单的定时脚本来监控 VPS 的可达性。在大陆的一台设备上（或使用国内的云函数服务）设置 cron 任务：

```bash
# 每 30 分钟检测一次 VPS 端口是否可达
*/30 * * * * nc -z -w5 你的服务器IP 443 || curl -s "你的告警Webhook"
```

如果端口不通，通过 Webhook 发送通知到 Telegram 或微信。这样你能在 IP 被封后第一时间知道并着手更换 IP。

---

## 常见问题

### Q1：配置完成后客户端连不上怎么办？

按以下顺序排查：

1. **确认服务端运行正常**：`systemctl status xray` 应显示 `active (running)`。
2. **确认端口放行**：`ufw status` 中应有你配置的端口（如 443）的 ALLOW 规则。VPS 控制面板中如果有安全组/防火墙，也需要放行对应端口。
3. **确认 IP 未被封**：在大陆网络下访问 `https://ping.pe/你的IP`，看是否全国范围不通。如果大陆全部 timeout 而海外正常，说明 IP 已被 GFW 封锁，需要更换 IP。
4. **检查客户端参数**：UUID、公钥（注意是公钥不是私钥）、shortId、SNI、服务器 IP/端口是否与服务端配置完全一致。

### Q2：IP 被封了怎么办？

取决于你的 VPS 提供商：

- **AWS Lightsail / DigitalOcean**：释放当前 IP，重新分配一个弹性 IP（或销毁重建实例），不需要额外付费。
- **搬瓦工**：部分套餐支持在控制面板中免费更换 IP（每 10 周一次）。也可以购买付费更换。
- **其他提供商**：提工单咨询是否支持更换 IP。如果不支持，可能需要新购一台 VPS。

更换 IP 后，只需修改客户端配置中的服务器地址，服务端配置无需改动。

### Q3：Reality 的 dest 目标站怎么选？

好的 `dest` 目标需要满足：支持 TLS 1.3、不做 301/302 重定向、在你的 VPS 地区有 CDN 节点（这样 IP 地理位置看起来合理）。一些常用选择：`www.apple.com`、`www.microsoft.com`、`www.samsung.com`、`www.lovelive-anime.jp`、`www.swift.org`。

避免使用冷门小站（可能宕机）、已被大量自建用户使用导致被标记的目标、以及墙内可直连访问的站点。

### Q4：Xray 需要手动更新吗？

是的。Xray 不会自动更新，你需要定期手动升级以获得安全补丁和性能优化。更新方法很简单，重新运行安装脚本即可：

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
systemctl restart xray
```

建议每 1-2 个月检查一次 [Xray-core Releases](https://github.com/XTLS/Xray-core/releases) 页面，看是否有重要更新。

---

## 相关资源

- [Xray-core](https://github.com/XTLS/Xray-core) — VLESS/Reality 协议的核心实现
- [Xray-install](https://github.com/XTLS/Xray-install) — 官方安装脚本
- [REALITY](https://github.com/XTLS/REALITY) — Reality 协议的设计文档
- [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) — 跨平台代理客户端

站内相关文章：
- [VLESS+Reality 深度解析](./vless-reality-deep-dive.md) — 理解 Reality 的工作原理
- [月付 vs 年付、自建 vs 机场：决策框架](./decision-framework.md) — 判断自建是否适合你
- [第一次使用代理：从零开始的配置指南](./first-time-setup.md) — 如果你最终选择了机场方案
- [速度优化指南](./speed-optimization.md) — 进一步提升代理性能
