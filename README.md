# Proxy Wiki —— 科学上网技术文档

> 一份面向中文用户的代理技术参考手册。  
> 从零基础入门到深度技术解析，帮助你理解"为什么"而不仅仅是"怎么做"。

---

## 📖 目录

### 一、新手入门

面向零基础用户，解释核心概念，不涉及复杂技术细节。

- [科学上网是什么？一篇讲清楚](./beginner/what-is-proxy.md)
- [VPN、代理、机场——这些词到底什么意思](./beginner/terminology.md)
- [V2Ray、Xray、Clash、Sing-box……我该用哪个？](./beginner/software-overview.md)
- [第一次使用代理：从零开始的配置指南](./beginner/first-time-setup.md)
- [代理能做什么、不能做什么（安全与隐私的边界）](./beginner/privacy-boundaries.md)

### 二、代理软件详解

每个软件的定位、优劣、适用场景和配置方法。

- [V2Ray vs Xray vs Sing-box：核心（内核）的区别与演进](./software/core-comparison.md)
- [Clash 系列全解：Clash Premium / Clash Meta / mihomo 的关系](./software/clash-family.md)
- [Clash Verge Rev 使用指南](./software/clash-verge-guide.md)
- [Sing-box 使用指南](./software/singbox-guide.md)
- [TUN 模式 vs 系统代理：原理与选择](./software/tun-vs-system-proxy.md)
- [Sing-box TUN vs Clash Verge TUN：实际体验对比](./software/singbox-vs-clash-tun.md)
- [Shadowrocket 使用指南（iOS）](./software/shadowrocket-guide.md)
- [Surge 使用指南（iOS/macOS）](./software/surge-guide.md)
- [NekoBox / v2rayN / v2rayNG 使用指南](./software/v2ray-clients-guide.md)

### 三、规则与分流

代理的核心能力之一：让该走代理的走代理，该直连的直连。

- [什么是分流规则？为什么需要它](./rules/what-are-rules.md)
- [Clash 规则集详解：rule-provider 是什么、怎么用](./rules/clash-rule-providers.md)
- [如何自定义规则：让特定网站走代理/直连/特定节点](./rules/custom-rules.md)
- [常用规则集推荐与对比（Loyalsoldier / MetaCubeX / ACL4SSR）](./rules/popular-rulesets.md)
- [Sing-box 的路由规则与 Clash 规则的区别](./rules/singbox-vs-clash-rules.md)
- [GeoIP / GeoSite 数据库：原理与更新](./rules/geoip-geosite.md)

### 四、DNS 专题

DNS 是代理配置中最容易出错的环节。

- [DNS 基础：为什么代理和 DNS 总是一起出问题](./dns/dns-basics-for-proxy.md)
- [Fake-IP vs Redir-Host：一次讲清楚](./dns/fake-ip-vs-redir-host.md)
- [各客户端 DNS 配置最佳实践](./dns/dns-best-practices.md)
- [DNS 泄漏是什么、怎么检测、怎么防](./dns/dns-leak.md)
- [DoH / DoT / DoQ：加密 DNS 协议选择](./dns/encrypted-dns.md)

### 五、协议与原理

面向想深入理解技术原理的用户。

- [主流代理协议横向对比（2026）](./protocols/protocol-comparison.md)
- [VLESS + Reality 深度解析](./protocols/vless-reality-deep-dive.md)
- [AnyTLS 技术原理与适用场景](./protocols/anytls-explained.md)
- [从 VMess 到 VLESS：协议演进史](./protocols/vmess-to-vless-evolution.md)
- [Hysteria2 与 TUIC：基于 QUIC 的协议](./protocols/quic-protocols.md)
- [VLESS + XHTTP + Reality + XMUX：当前技术天花板](./protocols/xhttp-reality.md)
- [NaiveProxy：用 Chromium 网络栈做代理](./protocols/naiveproxy.md)
- [WebSocket / gRPC / HTTP/2 传输层对比](./protocols/transport-comparison.md)

### 六、GFW 检测机制

了解审查系统的工作原理，才能理解为什么某些方案有效。

- [GFW 工作原理全解：从 DPI 到主动探测](./gfw/gfw-detection-overview.md)
- [TLS 指纹识别：JA3/JA4 与反检测策略](./gfw/tls-fingerprinting.md)
- [为什么你的节点会被封：常见触发条件分析](./gfw/node-blocking-causes.md)
- [敏感时期封锁加强的规律与应对](./gfw/sensitive-periods.md)
- [ECH（Encrypted Client Hello）：未来能解决问题吗](./gfw/ech-future.md)

### 七、流媒体与解锁

Netflix、Disney+、ChatGPT……不是连上代理就能用。

- [流媒体解锁是什么？为什么有的节点能解锁有的不能](./unlock/streaming-unlock-basics.md)
- [DNS 解锁 vs 原生 IP 解锁：原理与区别](./unlock/dns-vs-native-unlock.md)
- [IPv4 与 IPv6 在解锁中的作用](./unlock/ipv4-vs-ipv6-unlock.md)
- [ChatGPT / Claude / Gemini 的 IP 策略与解锁](./unlock/ai-services-unlock.md)
- [常见流媒体解锁检测工具与方法](./unlock/unlock-testing-tools.md)

### 八、网络与 IP 知识

理解底层网络概念，对选择节点和排障都有帮助。

- [IPv4 与 IPv6 基础：为什么机场越来越多提到 IPv6](./network/ipv4-vs-ipv6-basics.md)
- [什么是原生 IP、广播 IP、住宅 IP](./network/ip-types.md)
- [AS 号与 IP 归属查询：怎么看一个节点的 IP 质量](./network/as-number-lookup.md)
- [BGP 与 Anycast：为什么有些节点全球都快](./network/bgp-anycast.md)
- [端口转发与中转：NAT 穿透原理](./network/port-forwarding-relay.md)

### 九、机场运营与架构（进阶）

面向机场运营者或对后端架构感兴趣的用户。

- [代理节点池是什么：架构设计与负载均衡](./infra/node-pool-architecture.md)
- [直连 vs 中转 vs CDN：线路类型与成本分析](./infra/line-types-explained.md)
- [面板系统对比：V2Board / Xboard / SSPanel](./infra/panel-comparison.md)
- [节点部署自动化：从手动到批量管理](./infra/node-deployment-automation.md)
- [故障检测与自动切换策略](./infra/failover-strategies.md)
- [如何选择 SNI 伪装目标](./infra/sni-target-selection.md)

### 十、选择与评估

帮助用户做出理性选择。

- [如何评估一个机场的质量](./guide/how-to-evaluate.md)
- [月付 vs 年付、自建 vs 机场：决策框架](./guide/decision-framework.md)
- [看懂机场参数：倍率、流量、限速、在线设备数](./guide/airport-parameters.md)

### 十一、排障手册

遇到问题时的系统排查流程。

- [节点连不上？系统排查流程](./troubleshooting/connectivity-checklist.md)
- [速度慢的常见原因与优化思路](./troubleshooting/speed-optimization.md)
- [Fake-IP 模式下的 DNS 问题排查](./troubleshooting/fake-ip-dns-issues.md)
- [TUN 模式不生效的常见原因](./troubleshooting/tun-not-working.md)
- [Windows / macOS / iOS / Android 平台特有问题](./troubleshooting/platform-specific.md)

---

## 🗺️ 阅读路线建议

**零基础用户**：一 → 二 → 三 → 十一（入门 → 选软件 → 学规则 → 会排障）

**想选机场的用户**：十 → 七 → 四（评估 → 解锁 → DNS）

**技术爱好者**：五 → 六 → 八 → 九（协议 → GFW → 网络 → 架构）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。技术性内容请附上来源或验证方法。

## 📄 许可

本文档以 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 协议发布。

---

*由 [ednovas](https://ednovas.xyz) 维护*
