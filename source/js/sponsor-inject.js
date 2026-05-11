document.addEventListener('DOMContentLoaded', function () {
  var postContent = document.querySelector('.markdown-body');
  if (!postContent) return;

  var sponsorHTML = ''
    // ednovas 云
    + '<div class="sponsor-card" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%);border-color:rgba(59,130,246,0.3)">'
    + '  <div class="sponsor-card-header">'
    + '    <span class="sponsor-card-badge" style="background:rgba(59,130,246,0.2);color:#93c5fd">ednovas</span>'
    + '    <h3 class="sponsor-card-title">ednovas 云 — 全球代理服务</h3>'
    + '  </div>'
    + '  <div class="sponsor-card-desc">'
    + '    覆盖 80+ 国家节点，大部分节点支持流媒体和 AI 服务解锁。'
    + '    采用 IEPL 和隧道中转线路，提供回国节点，晚高峰也能流畅访问外网。'
    + '  </div>'
    + '  <div class="sponsor-card-features">'
    + '    <span class="sponsor-card-tag" style="border-color:rgba(59,130,246,0.3);background:rgba(59,130,246,0.1)">80+ 国家节点</span>'
    + '    <span class="sponsor-card-tag" style="border-color:rgba(59,130,246,0.3);background:rgba(59,130,246,0.1)">流媒体 & AI 解锁</span>'
    + '    <span class="sponsor-card-tag" style="border-color:rgba(59,130,246,0.3);background:rgba(59,130,246,0.1)">IEPL + 隧道中转</span>'
    + '    <span class="sponsor-card-tag" style="border-color:rgba(59,130,246,0.3);background:rgba(59,130,246,0.1)">回国节点</span>'
    + '  </div>'
    + '  <div class="sponsor-card-buttons">'
    + '    <a href="https://ednovas.me" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-primary" style="background:linear-gradient(135deg,#3b82f6,#2563eb)">访问 ednovas 云</a>'
    + '    <a href="https://help.ednovas.me" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-secondary">使用帮助</a>'
    + '    <a href="https://t.me/ednovasyun" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-secondary">Telegram 群组</a>'
    + '  </div>'
    + '</div>'

    // TransLink
    + '<div class="sponsor-card">'
    + '  <div class="sponsor-card-header">'
    + '    <span class="sponsor-card-badge">Sponsor</span>'
    + '    <h3 class="sponsor-card-title">TransLink — 高审查地区代理服务</h3>'
    + '  </div>'
    + '  <div class="sponsor-card-desc">'
    + '    采用 VLESS+Reality 和 AnyTLS 协议，通过 AWS 负载均衡中转线路，'
    + '    专为高审查地区设计。支持在俄罗斯、伊朗、土库曼斯坦等地区稳定使用。'
    + '  </div>'
    + '  <div class="sponsor-card-features">'
    + '    <span class="sponsor-card-tag">VLESS + Reality</span>'
    + '    <span class="sponsor-card-tag">AnyTLS</span>'
    + '    <span class="sponsor-card-tag">AWS 负载中转</span>'
    + '    <span class="sponsor-card-tag">支持高审查地区</span>'
    + '  </div>'
    + '  <div class="sponsor-card-buttons">'
    + '    <a href="https://translink.cc" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-primary">访问 TransLink</a>'
    + '    <a href="https://t.me/translink_cloud" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-secondary">Telegram 群组</a>'
    + '  </div>'
    + '</div>'

    // 底部链接
    + '<div class="ednovas-card">'
    + '  <span class="ednovas-card-text">'
    + '    更多技术文章：<a href="https://ednovas.xyz" target="_blank">ednovas.xyz</a>'
    + '    · ednovas 云帮助中心：<a href="https://help.ednovas.me" target="_blank">help.ednovas.me</a>'
    + '  </span>'
    + '</div>';

  postContent.insertAdjacentHTML('beforeend', sponsorHTML);
});
