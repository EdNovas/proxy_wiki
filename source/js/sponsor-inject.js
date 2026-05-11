document.addEventListener('DOMContentLoaded', function () {

  // ========== 1. 文章底部广告卡片（仅文章页） ==========
  // vivia 用 .article-entry 包裹正文；只在 post 类型上注入
  var postContent = document.querySelector('.article-type-post .article-entry');
  if (postContent) {
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
  }

  // ========== 2. 右下角悬浮按钮（全站） ==========
  var fabHTML = ''
    + '<div class="fab-sponsor">'
    + '  <div class="fab-sponsor-panel" id="fabPanel">'
    + '    <h4>🚀 推荐服务</h4>'
    + '    <a class="fab-sponsor-link" href="https://ednovas.me" target="_blank">'
    + '      <span class="fab-sponsor-dot" style="background:#3b82f6"></span>'
    + '      <span>ednovas 云<small>80+ 国家 · IEPL 中转</small></span>'
    + '    </a>'
    + '    <a class="fab-sponsor-link" href="https://translink.cc" target="_blank">'
    + '      <span class="fab-sponsor-dot" style="background:#8b5cf6"></span>'
    + '      <span>TransLink<small>高审查地区 · AWS 中转</small></span>'
    + '    </a>'
    + '    <a class="fab-sponsor-link" href="https://t.me/ednovasyun" target="_blank">'
    + '      <span class="fab-sponsor-dot" style="background:#0ea5e9"></span>'
    + '      <span>ednovas 云 TG 群</span>'
    + '    </a>'
    + '    <a class="fab-sponsor-link" href="https://t.me/translink_cloud" target="_blank">'
    + '      <span class="fab-sponsor-dot" style="background:#0ea5e9"></span>'
    + '      <span>TransLink TG 群</span>'
    + '    </a>'
    + '  </div>'
    + '  <button class="fab-sponsor-toggle" id="fabToggle" title="推荐服务">✦</button>'
    + '</div>';

  document.body.insertAdjacentHTML('beforeend', fabHTML);

  var fabToggle = document.getElementById('fabToggle');
  var fabPanel = document.getElementById('fabPanel');
  fabToggle.addEventListener('click', function () {
    fabPanel.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.fab-sponsor')) {
      fabPanel.classList.remove('open');
    }
  });

  // ========== 3. 侧边栏赞助组件（vivia 侧边栏底部） ==========
  var sidebar = document.getElementById('sidebar-wrapper');
  if (sidebar) {
    var sidebarHTML = ''
      + '<div class="sidebar-sponsor">'
      + '  <div class="sidebar-sponsor-title">推荐服务</div>'
      + '  <a href="https://ednovas.me" target="_blank">'
      + '    ednovas 云'
      + '    <small>高质量国内中转代理服务</small>'
      + '  </a>'
      + '  <a href="https://translink.cc" target="_blank">'
      + '    TransLink'
      + '    <small>高质量海外中转代理服务</small>'
      + '  </a>'
      + '</div>';

    sidebar.insertAdjacentHTML('beforeend', sidebarHTML);
  }

});
