# TLS 指纹识别：JA3/JA4 与反检测策略

> **摘要**：TLS 指纹识别是 GFW 检测代理流量的核心手段之一。即使流量内容完全加密，TLS 握手阶段的明文参数也会暴露客户端的身份。本文解释 JA3/JA4 指纹的计算方式、GFW 如何利用它识别代理、以及主流协议的应对策略。

## TLS 握手中暴露了什么

TLS 连接建立时，Client Hello 消息以明文发送，其中包含大量元数据：

<!-- 
列出 Client Hello 中的关键字段：
1. 支持的 TLS 版本列表
2. 支持的加密套件（Cipher Suites）列表及顺序
3. 支持的扩展（Extensions）列表及顺序
4. 支持的椭圆曲线（Supported Groups）
5. 支持的签名算法
6. ALPN（应用层协议协商）
7. SNI（服务器名称指示）

这些参数的组合是高度特征化的——不同的 TLS 库会产生截然不同的 Client Hello。
-->

## JA3 指纹是什么

<!-- 
JA3 的计算方式：
- 提取 Client Hello 中的五个字段：TLS版本、加密套件、扩展、椭圆曲线、椭圆曲线点格式
- 将这些字段的值用逗号拼接
- 对拼接后的字符串取 MD5 哈希
- 得到一个 32 字符的指纹字符串

举例（不需要真实值，用结构示意）：
TLSVersion,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats
→ MD5 → "e7d705a3286e19ea42f587b344ee6865"

不同客户端的指纹差异：
- Chrome 125 的 JA3 指纹 ≠ Firefox 126 的 JA3 指纹 ≠ Go crypto/tls 的 JA3 指纹
- 同一浏览器的不同版本指纹也可能不同
-->

## JA4 与 JA3 的区别

<!-- 
JA4 是 JA3 的改进版：
- 更结构化的指纹格式
- 考虑了更多参数
- 对 QUIC/HTTP3 也有覆盖
- 简要说明其格式差异
-->

## 这和代理有什么关系

**核心问题：代理客户端的 TLS 指纹与真实浏览器不同。**

<!-- 
展开说明：
1. 大多数代理工具用 Go 语言编写（V2Ray、Xray、Sing-box）
2. Go 的 crypto/tls 库产生的 Client Hello 与浏览器明显不同
3. GFW 可以通过 JA3 指纹判断：这个到 apple.com 的连接不是来自浏览器
4. 即使 SNI 是 apple.com，但指纹是 Go 程序，就暴露了

这就是为什么"套 TLS"并不等于"安全"——TLS 握手本身就泄漏了你的客户端类型
-->

## 各协议的应对方案

### uTLS：模拟浏览器指纹

<!-- 
- uTLS 库的原理：手动构造 Client Hello，模拟特定浏览器的参数
- 使用方式：在 Xray/Sing-box 中指定 fingerprint 参数（chrome、firefox、safari 等）
- 局限性：
  - 模拟的完整度取决于 uTLS 的更新频率
  - 浏览器更新后指纹可能变化，uTLS 需要跟进
  - 某些扩展（如 GREASE）的随机化行为难以完美模拟
-->

### Reality：从根本上解决问题

<!-- 
Reality 的方法更彻底：
- 不是模拟浏览器指纹，而是让 GFW 看到的 Server Hello 来自真实的目标服务器
- 流程：
  1. 客户端使用 uTLS 发送 Client Hello（模拟浏览器指纹）
  2. 服务端将 Client Hello 转发给真实的目标站点（如 apple.com）
  3. 目标站点返回真实的 Server Hello 和证书
  4. 服务端将真实的 Server Hello 转发给客户端
  5. 在此之后切换到代理的加密通道
- GFW 看到的是一个指纹正常、证书真实的 TLS 连接
- 主动探测者连接服务端时，看到的也是真实的目标站点
-->

### ECH (Encrypted Client Hello)：未来方向

<!-- 
- ECH 的设计目的就是加密 Client Hello 中的敏感字段
- 如果 ECH 普及，JA3/JA4 指纹将失去大部分价值
- 目前的采用状态：Chrome 和 Firefox 已支持，但 GFW 已在封锁 ECH
- 短期内不能依赖 ECH
-->

## 实践：如何检查自己的指纹

<!-- 
提供几个工具和方法：
1. 访问 ja3er.com 查看浏览器的 JA3 指纹
2. 通过代理访问同一站点，对比指纹差异
3. 使用 Wireshark 抓包分析 Client Hello

如果两个指纹一致，说明 uTLS 模拟成功
如果不一致，说明你的代理连接可以被指纹识别
-->

## 常见问题

### Q: uTLS 选哪个浏览器指纹最好？
<!-- chrome 是最安全的选择，因为市占率最高，不容易因为"少见的指纹"被标记 -->

### Q: 不配置 fingerprint 参数会怎样？
<!-- 默认使用 Go 原生 TLS 指纹，极易被识别 -->

### Q: JA3 指纹可以完全伪造吗？
<!-- 可以通过 uTLS 伪造，但完美度取决于实现 -->

---

*最后更新：2026-XX-XX*  
*更多技术分析：[ednovas.xyz](https://ednovas.xyz)*
