---
title: 端口转发与中转：NAT 穿透原理
date: 2026-05-10
updated: 2026-05-10
categories:
  - 网络知识
tags:
  - 端口转发
  - 中转
  - NAT
  - iptables
  - 网络
index_img: /images/posts/port-forwarding-relay.png
excerpt: 中转节点是怎么把流量从国内服务器转发到海外的？本文解释端口转发、iptables 中转和隧道中转的原理。
---

> **摘要**：在代理架构中，中转（relay）是一个常见的优化手段——在国内放置一台服务器作为流量中转站，利用国内到中转站的优质网络，再由中转站通过优化线路连接海外服务器。这个过程的核心技术就是端口转发。本文从 NAT 基础讲起，介绍 iptables、socat、gost 和隧道等各种端口转发方案的原理和选择。

## 什么是端口转发

端口转发（Port Forwarding）的本质非常简单：**把发往本机某个端口的流量，原封不动地转发到另一台机器的某个端口**。

用一个生活中的类比：端口转发就像信件中转站。你寄了一封信到中转站（地址 A，端口 443），中转站收到后在信封上改写收件人地址，然后把信转寄到最终目的地（地址 B，端口 443）。对于寄信人来说，他只知道中转站的地址；对于收信人来说，信看起来来自中转站。

在代理中转的场景下，工作流程是这样的：

```
用户 → 国内中转服务器:443 → [端口转发] → 海外代理服务器:443 → 目标网站
```

用户的代理客户端连接的是国内中转服务器的地址和端口。中转服务器收到流量后，通过端口转发将流量发送到海外的代理服务器。整个过程对代理客户端来说是透明的——它以为自己直接连接的就是代理服务器。

### 为什么需要中转

中转的核心目的是**优化网络路径**。直接从用户到海外服务器的网络路径可能经过拥塞的国际出口，导致高延迟、高丢包。通过在国内放一台中转服务器，可以：

1. **用户到中转**：走国内网络，延迟极低（通常 <20ms），几乎不丢包
2. **中转到海外**：可以选择 CN2 GIA、IPLC 等优质线路，保证国际段的质量

相当于用两段优质的链路，替代了一段质量不可控的直连链路。

## NAT 基础

要理解端口转发的实现，需要先了解 NAT（Network Address Translation，网络地址转换）。

### NAT 是什么

NAT 最初是为了解决 IPv4 地址不够用的问题而发明的。它允许一个局域网内的多台设备共享一个公网 IP 地址。你家里的路由器就在做 NAT——你的手机、电脑、电视可能分别是 192.168.1.100、192.168.1.101、192.168.1.102，但对外只有一个公网 IP。

NAT 的工作原理是修改数据包的 IP 头部：

- **SNAT（Source NAT，源地址转换）**：修改数据包的源 IP 地址。用于出站流量——你的内网 IP 被替换为公网 IP
- **DNAT（Destination NAT，目标地址转换）**：修改数据包的目标 IP 地址。用于入站流量——发往公网 IP 特定端口的流量被转发到内网的某台设备

端口转发本质上就是 DNAT + SNAT 的组合。

### NAT 类型

不同的 NAT 实现对端口映射的限制不同，这影响了某些应用的连通性：

| NAT 类型 | 特点 | 对代理中转的影响 |
|----------|------|-----------------|
| 全锥形（Full Cone） | 最开放，外部任何主机都可以通过映射端口访问内部主机 | 最有利，所有转发方式都能工作 |
| 受限锥形（Restricted Cone） | 只有内部主机曾主动连接过的外部 IP 才能回连 | 大部分情况下没问题 |
| 端口受限锥形（Port Restricted Cone） | 在受限锥形基础上，还限制了端口 | 可能影响 UDP 转发 |
| 对称型（Symmetric） | 对不同目标使用不同的映射，最严格 | 可能需要 TURN 等额外手段 |

对于代理中转来说，NAT 类型通常不是大问题——因为中转服务器一般都有独立的公网 IP，不存在 NAT 限制。NAT 类型主要影响的是用户端（如果用户在多层 NAT 后面）。

## 实现方法一：iptables DNAT/SNAT

iptables 是 Linux 内核自带的防火墙/NAT 工具，使用它做端口转发是最轻量、性能最高的方式，因为转发在**内核态**完成，不需要用户态程序参与。

### 基本原理

iptables 端口转发需要做两件事：

1. **DNAT**：将发往本机端口的流量的目标地址改为落地服务器的地址
2. **SNAT/MASQUERADE**：将转发流量的源地址改为中转服务器的地址（否则落地服务器的回复会直接发给用户，而不经过中转服务器）

### 配置步骤

**第一步：开启 IP 转发**

Linux 默认不允许一个网络接口接收的数据包从另一个接口转发出去。需要先开启 IP 转发功能：

```bash
# 临时开启
echo 1 > /proc/sys/net/ipv4/ip_forward

# 永久开启（写入配置文件）
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p
```

**第二步：配置 iptables 规则**

假设中转服务器要将本机的 443 端口转发到海外落地服务器 `1.2.3.4` 的 443 端口：

```bash
# DNAT：将发往本机 443 端口的流量目标地址改为落地服务器
iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination 1.2.3.4:443

# SNAT：将转发流量的源地址改为中转服务器的公网 IP
# 方式一：明确指定源 IP
iptables -t nat -A POSTROUTING -d 1.2.3.4 -p tcp --dport 443 -j SNAT --to-source 中转服务器IP

# 方式二：自动使用出口网卡的 IP（推荐）
iptables -t nat -A POSTROUTING -d 1.2.3.4 -p tcp --dport 443 -j MASQUERADE

# 允许转发流量通过
iptables -A FORWARD -p tcp -d 1.2.3.4 --dport 443 -j ACCEPT
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
```

**如果还需要转发 UDP**（比如代理使用了 UDP 传输）：

```bash
iptables -t nat -A PREROUTING -p udp --dport 443 -j DNAT --to-destination 1.2.3.4:443
iptables -t nat -A POSTROUTING -d 1.2.3.4 -p udp --dport 443 -j MASQUERADE
iptables -A FORWARD -p udp -d 1.2.3.4 --dport 443 -j ACCEPT
```

**第三步：保存规则**

iptables 规则默认在重启后丢失。需要安装持久化工具：

```bash
# Debian/Ubuntu
apt install iptables-persistent
netfilter-persistent save

# CentOS/RHEL
service iptables save
```

### iptables 转发的优缺点

**优点**：
- **性能最高**：内核态转发，不经过用户态程序，延迟极低
- **资源占用最小**：不需要额外进程，几乎不消耗 CPU 和内存
- **成熟可靠**：iptables 是 Linux 最成熟的网络工具

**缺点**：
- **配置语法复杂**：iptables 的语法对新手不友好
- **不加密**：流量在中转和落地之间是明文传输（如果代理本身不加密的话）
- **调试困难**：规则配错后排查比较麻烦
- **仅 Linux**：Windows 和 macOS 需要使用其他工具

### nftables：iptables 的替代

nftables 是 iptables 的继任者，在较新的 Linux 发行版中逐渐替代 iptables。功能相同但语法更清晰：

```bash
nft add table ip nat
nft add chain ip nat prerouting { type nat hook prerouting priority 0 \; }
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }
nft add rule ip nat prerouting tcp dport 443 dnat to 1.2.3.4:443
nft add rule ip nat postrouting ip daddr 1.2.3.4 masquerade
```

如果你的系统默认使用 nftables，建议直接使用它而不是 iptables。

## 实现方法二：socat

socat（SOcket CAT）是一个多功能的网络工具，可以在用户态实现端口转发。

### 基本用法

```bash
# 将本机 443 端口的 TCP 流量转发到 1.2.3.4:443
socat TCP-LISTEN:443,reuseaddr,fork TCP:1.2.3.4:443

# 转发 UDP
socat UDP-LISTEN:443,reuseaddr,fork UDP:1.2.3.4:443

# 同时转发 TCP 和 UDP（需要运行两条命令）
socat TCP-LISTEN:443,reuseaddr,fork TCP:1.2.3.4:443 &
socat UDP-LISTEN:443,reuseaddr,fork UDP:1.2.3.4:443 &
```

### socat 的优缺点

**优点**：
- **使用简单**：一条命令就能完成端口转发
- **跨平台**：支持 Linux、macOS、Windows（通过 Cygwin）
- **不需要修改内核参数**：不需要开启 ip_forward
- **灵活性高**：支持多种 socket 类型和选项

**缺点**：
- **性能较低**：用户态转发，每个连接需要两次内核-用户态数据复制
- **资源消耗高**：每个连接 fork 一个新进程（`fork` 选项）
- **不适合高并发**：大量连接时会创建大量进程
- **没有连接管理**：无法限速、限连接数等

socat 适合临时测试或低流量场景，不推荐在生产环境中作为长期的中转方案。

## 实现方法三：gost

[gost](https://github.com/ginuerzh/gost)（GO Simple Tunnel）是一个用 Go 语言编写的隧道工具，专为代理中转场景设计。

### 基本用法

```bash
# TCP 端口转发
gost -L tcp://:443 -F forward+tcp://1.2.3.4:443

# 带加密的端口转发（TLS）
gost -L tcp://:443 -F forward+tls://1.2.3.4:443

# WebSocket 隧道转发
gost -L tcp://:443 -F forward+ws://1.2.3.4:443

# 多级转发（链式代理）
gost -L tcp://:443 -F forward+tcp://relay1:443 -F forward+tcp://relay2:443
```

### gost 的特点

**优点**：
- **支持加密**：可以在中转和落地之间建立加密隧道（TLS、WSS 等）
- **支持多种传输协议**：TCP、UDP、WebSocket、gRPC、QUIC 等
- **链式转发**：支持多级中转
- **丰富的功能**：限速、认证、负载均衡、心跳检测等
- **Go 编写**：单文件部署，无依赖

**缺点**：
- **性能不如 iptables**：用户态程序，有额外的处理开销
- **需要两端配合**：如果使用加密隧道，落地端也需要运行 gost
- **配置较复杂**：功能多导致参数也多

gost 是目前中转场景最推荐的用户态工具之一，特别是当你需要在中转和落地之间加密传输时。

## 实现方法四：WireGuard/IPIP 隧道

使用 VPN 隧道在中转和落地之间建立加密通道，然后在隧道内做端口转发。

### WireGuard 隧道

WireGuard 是一个轻量级、高性能的 VPN 协议。在中转场景中，可以在中转服务器和落地服务器之间建立 WireGuard 隧道，然后通过隧道 IP 做 iptables 转发。

**中转服务器配置**（/etc/wireguard/wg0.conf）：

```ini
[Interface]
PrivateKey = 中转服务器私钥
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = 落地服务器公钥
AllowedIPs = 10.0.0.2/32
Endpoint = 落地服务器公网IP:51820
PersistentKeepalive = 25
```

**落地服务器配置**：

```ini
[Interface]
PrivateKey = 落地服务器私钥
Address = 10.0.0.2/24
ListenPort = 51820

[Peer]
PublicKey = 中转服务器公钥
AllowedIPs = 10.0.0.1/32
Endpoint = 中转服务器公网IP:51820
PersistentKeepalive = 25
```

**隧道建立后，在中转服务器配置 iptables 转发**：

```bash
# 通过 WireGuard 隧道转发——目标地址使用隧道内的 IP
iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination 10.0.0.2:443
iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
```

### WireGuard 隧道的优缺点

**优点**：
- **加密传输**：中转与落地之间的所有流量都经过 WireGuard 加密
- **内核态性能**：WireGuard 实现在 Linux 内核中，性能极高
- **稳定可靠**：自动重连、保活机制

**缺点**：
- **UDP 协议**：WireGuard 使用 UDP，某些网络可能限制 UDP 流量
- **配置稍复杂**：需要在两端都配置 WireGuard
- **额外开销**：WireGuard 封装增加约 60 字节的头部开销

### IPIP 隧道

IPIP 是最简单的 IP 隧道协议——把一个 IP 包封装在另一个 IP 包里。它的优势是极低的开销（只增加 20 字节头部），但**没有加密**。

```bash
# 中转服务器
ip tunnel add ipiptun mode ipip remote 落地服务器IP local 中转服务器IP
ip addr add 10.0.0.1/24 dev ipiptun
ip link set ipiptun up

# 落地服务器
ip tunnel add ipiptun mode ipip remote 中转服务器IP local 落地服务器IP
ip addr add 10.0.0.2/24 dev ipiptun
ip link set ipiptun up
```

IPIP 隧道适合对性能要求极高、且中转和落地之间的链路本身是安全的（如 IPLC 专线）场景。

## 实现方法五：Cloudflare Tunnel

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)（原 Argo Tunnel）提供了一种不同的思路——不需要中转服务器有公网 IP，通过 Cloudflare 的全球网络进行中转。

### 工作原理

1. 在落地服务器上运行 `cloudflared` 客户端
2. `cloudflared` 主动向 Cloudflare 的最近节点建立加密连接
3. 用户通过 Cloudflare 的网络访问你配置的域名
4. Cloudflare 将流量通过隧道转发到落地服务器

### 优缺点

**优点**：
- **不需要公网 IP**：落地服务器即使在 NAT 后面也能工作
- **自动 TLS**：流量自动加密
- **Cloudflare 全球网络**：利用 Anycast 提供低延迟
- **免费额度**：有免费计划可以使用

**缺点**：
- **受 Cloudflare 控制**：流量经过 Cloudflare，有隐私考虑
- **仅 HTTP/HTTPS**：主要支持 HTTP 类流量，TCP/UDP 通用代理有限制
- **依赖 Cloudflare 可用性**：如果 Cloudflare 在你所在地区的节点被干扰，隧道也会受影响
- **不适合所有代理协议**：不支持原生的 VLESS、Trojan 等协议通过隧道

## 如何选择转发方案

不同的转发方案适合不同的场景：

| 方案 | 性能 | 加密 | 配置难度 | 适用场景 |
|------|------|------|----------|----------|
| iptables | 最高 | 无 | 中 | 性能优先，代理本身已加密 |
| nftables | 最高 | 无 | 中 | iptables 的现代替代 |
| socat | 低 | 无 | 低 | 临时测试 |
| gost | 中高 | 可选 | 中高 | 需要加密隧道 |
| WireGuard | 高 | 有 | 中 | 需要加密且性能要求高 |
| IPIP | 极高 | 无 | 低 | 专线环境，性能极致 |
| Cloudflare Tunnel | 中 | 有 | 低 | 无公网 IP 场景 |

### 一般建议

- **大多数情况**：iptables 转发足够用。代理协议本身（VLESS+TLS、Trojan 等）已经提供了加密，中转段不需要额外加密
- **需要加密中转段**：gost 或 WireGuard。gost 更灵活，WireGuard 性能更高
- **临时测试**：socat，一条命令搞定
- **没有公网 IP**：Cloudflare Tunnel

## iptables 转发完整示例

以下是一个将 TCP 443 端口转发到落地服务器的完整配置脚本：

```bash
#!/bin/bash

# 配置变量
LANDING_SERVER="1.2.3.4"   # 落地服务器 IP
LOCAL_PORT="443"            # 本机监听端口
REMOTE_PORT="443"           # 落地服务器端口

# 开启 IP 转发
echo 1 > /proc/sys/net/ipv4/ip_forward
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

# 清理旧规则（谨慎使用）
iptables -t nat -F
iptables -F FORWARD

# 配置 DNAT（目标地址转换）
iptables -t nat -A PREROUTING -p tcp --dport $LOCAL_PORT -j DNAT --to-destination $LANDING_SERVER:$REMOTE_PORT
iptables -t nat -A PREROUTING -p udp --dport $LOCAL_PORT -j DNAT --to-destination $LANDING_SERVER:$REMOTE_PORT

# 配置 SNAT（源地址转换）
iptables -t nat -A POSTROUTING -d $LANDING_SERVER -j MASQUERADE

# 允许转发
iptables -A FORWARD -p tcp -d $LANDING_SERVER --dport $REMOTE_PORT -j ACCEPT
iptables -A FORWARD -p udp -d $LANDING_SERVER --dport $REMOTE_PORT -j ACCEPT
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# 保存规则
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
elif command -v iptables-save &> /dev/null; then
    iptables-save > /etc/iptables.rules
fi

echo "端口转发配置完成: 本机:$LOCAL_PORT → $LANDING_SERVER:$REMOTE_PORT"
```

## 常见问题（FAQ）

### Q1：中转会增加多少延迟？

理论上会增加一跳的延迟。如果中转服务器和用户在同一城市（比如都在上海），增加的延迟通常在 5ms 以内，几乎感觉不到。而中转带来的线路质量提升远远大于这点额外延迟。

### Q2：中转服务器需要多大的带宽？

中转服务器的带宽需要至少等于你期望的代理速度。如果你希望有 100Mbps 的代理速度，中转服务器的带宽至少需要 100Mbps。注意，大部分国内云服务器的带宽是按上行计费的。

### Q3：中转服务器的流量会被审查吗？

中转服务器转发的流量对于审查系统来说，看起来就是普通的加密连接（因为代理协议本身已经加密了）。但如果审查系统检查连接的目标 IP（即落地服务器），且该 IP 已被标记，则中转可能也会受到影响。

### Q4：iptables 和 socat 性能差多少？

在高并发场景下，差异显著。iptables 在内核态处理，单个数据包的处理延迟在微秒级；socat 需要在用户态接收和发送，延迟在毫秒级。对于普通用户的日常使用，差异不明显；但如果中转服务器承载大量用户，iptables 是唯一的选择。

### Q5：可以用一台中转服务器转发多个端口吗？

可以。为每个端口添加对应的 iptables 规则即可。你可以将不同端口转发到不同的落地服务器，实现一台中转机对应多个出口。

### Q6：中转服务器宕机了怎么办？

中转服务器是单点故障。如果它宕机，所有通过它的代理连接都会中断。解决方案是使用多台中转服务器做负载均衡或故障切换。一些面板工具（如 iptables-manager）提供了中转管理和健康检查功能。

## 外部链接

- [gost 项目](https://github.com/ginuerzh/gost) — Go 语言隧道工具
- [WireGuard 官网](https://www.wireguard.com/) — 轻量级 VPN
- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — Cloudflare 隧道
- [iptables 手册](https://linux.die.net/man/8/iptables) — iptables 完整参考
- [nftables Wiki](https://wiki.nftables.org/) — nftables 文档

---

*端口转发是代理中转的基础技术。对于大多数场景，iptables 转发已经足够好用。选择更复杂的方案之前，先评估是否真的需要额外的加密或隧道功能。*
