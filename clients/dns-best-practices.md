# 各客户端 DNS 配置最佳实践

> **摘要**：DNS 配置是科学上网中最容易出错、也最影响体验的环节。配置不当会导致 DNS 泄漏（暴露访问意图）、解析失败（网页打不开）、或国内网站变慢（走了错误的 CDN 节点）。本文给出各主流客户端的推荐 DNS 配置，并解释每个参数背后的原理。

## 先理解问题：为什么 DNS 这么麻烦

使用代理时，DNS 解析存在一个根本矛盾：

- **国内域名**需要用国内 DNS 解析，才能获得最近的 CDN 节点
- **国外域名**不能用国内 DNS 解析，否则会被污染（返回错误 IP）
- **代理客户端**需要判断一个域名走直连还是走代理，但判断本身可能依赖 DNS 结果

这个三角矛盾是所有 DNS 配置复杂性的根源。

## Fake-IP vs Redir-Host

理解这两种模式是配置 DNS 的前提。

### Fake-IP 模式（推荐）

**工作原理**：
<!-- 
- 客户端拦截所有 DNS 请求，立即返回一个假的 IP（如 198.18.x.x 段）
- 应用拿到假 IP 后发起连接，客户端用这个假 IP 反查出原始域名
- 根据域名匹配分流规则，决定走代理还是直连
- 走代理的域名：由远端节点负责真实 DNS 解析
- 走直连的域名：客户端自行做真实 DNS 解析
-->

**优势**：
<!-- 
- 解析速度快（本地直接返回）
- 彻底避免 DNS 泄漏（国外域名的 DNS 请求不会发往国内）
- 规则匹配基于域名，准确度高
-->

**注意事项**：
<!-- 
- 部分应用可能缓存 Fake-IP 导致代理关闭后连接异常
- 需要正确配置 fake-ip-filter 排除某些域名（如局域网发现、NTP 等）
-->

### Redir-Host 模式

**工作原理**：
<!-- 
- 客户端拦截 DNS 请求后，真正去做 DNS 解析
- 用解析得到的真实 IP 进行分流匹配
-->

**问题**：
<!-- 
- DNS 解析本身可能被污染，导致分流判断错误
- 需要配置 fallback DNS 来处理被污染的情况，配置复杂
- 解析延迟更高
-->

**结论**：除非有特殊需求，2026 年应该统一使用 Fake-IP 模式。

---

## Clash Meta / Clash Verge 配置

### 推荐配置

```yaml
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false  # 根据需要开启
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  
  # ⚠️ 关键：Fake-IP 模式下只需要 nameserver，不需要 fallback
  nameserver:
    - https://doh.pub/dns-query        # 腾讯 DoH
    - https://dns.alidns.com/dns-query  # 阿里 DoH
  
  # Fake-IP 过滤：这些域名返回真实 IP
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - '*.localhost'
    - 'dns.msftncsi.com'
    - 'www.msftncsi.com'
    - '*.msftconnecttest.com'
    - 'time.*.com'
    - 'ntp.*.com'
    - '+.stun.*.*'
    - '+.stun.*.*.*'
    - 'localhost.ptlogin2.qq.com'
    - 'lens.l.google.com'
```

### ⚠️ 最常见的配置错误

**不要在 Fake-IP 模式下配置 fallback 和 fallback-filter。**

<!-- 
展开解释（基于你的实际排障经验）：
- 很多网上的教程是从 Redir-Host 时代抄过来的，在 Fake-IP 下加 fallback 是多余的
- fallback 的存在反而可能导致 DNS 请求走向不必要的海外 DNS，增加延迟
- 在 Fake-IP 模式下，nameserver 只负责解析直连域名（命中直连规则的）
- 走代理的域名根本不会触发本地 DNS 解析，所以不存在"被污染"的问题
- 这是大陆用户遇到的最高频 DNS 配置错误
-->

---

## Shadowrocket 配置

<!-- 
- Shadowrocket 的 DNS 设置相对简单
- 建议配置
- 注意事项
-->

---

## Surge 配置

<!-- 
- Surge 的 DNS 配置方式
- 与 Clash 的主要区别
- 推荐配置
-->

---

## 特殊场景

### 透明代理（OpenWrt / 软路由）下的 DNS

<!-- 
基于你的 OpenWrt/OpenClash 经验展开：
- 透明代理下 DNS 劫持的方式（redirect vs tproxy）
- 如何确保所有设备的 DNS 请求被正确拦截
- dnsmasq 与 Clash DNS 的配合
- 常见问题：部分设备使用硬编码 DNS（如 8.8.8.8）绕过了本地 DNS
-->

### IPv6 环境

<!-- 
- 是否建议开启 IPv6 DNS
- IPv6 可能导致的 DNS 泄漏问题
- 推荐做法
-->

---

## 诊断方法

当怀疑 DNS 有问题时，按以下步骤排查：

```
1. 打开 Clash 的日志，观察 DNS 请求走向
2. 检查分流规则是否正确匹配
3. 用 nslookup / dig 直接查询 DNS，对比结果
4. 检查是否有 DNS 泄漏：访问 dnsleaktest.com
5. 如果国内网站变慢：检查 CDN 节点是否正确（可能 DNS 解析到了海外节点）
```

## 常见问题

### Q: 用了代理后国内网站反而变慢了？
<!-- DNS 解析到了海外节点，需要确保直连域名用国内 DNS 解析 -->

### Q: 为什么有些网站打不开但浏览器没报错？
<!-- 可能是 Fake-IP 缓存问题或 DNS 解析超时 -->

### Q: DoH 和 DoT 选哪个？
<!-- 简要对比，推荐 DoH 因为更不容易被封 -->

---

*最后更新：2026-XX-XX*  
*更多技术分析：[ednovas.xyz](https://ednovas.xyz)*
