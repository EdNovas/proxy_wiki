// 在文章页底部注入 TransLink 赞助卡片
document.addEventListener('DOMContentLoaded', function () {
  var postContent = document.querySelector('.markdown-body');
  if (!postContent) return;

  var sponsorHTML = ''
    + '<div class="sponsor-card">'
    + '  <div class="sponsor-card-header">'
    + '    <span class="sponsor-card-badge">Sponsor</span>'
    + '    <h3 class="sponsor-card-title">TransLink — 稳定高速的代理服务</h3>'
    + '  </div>'
    + '  <div class="sponsor-card-desc">'
    + '    本站由 TransLink 提供运营支持。TransLink 采用 VLESS+Reality 和 AnyTLS 协议，'
    + '    通过 AWS 负载均衡中转线路，提供覆盖全球的高质量代理服务。'
    + '    支持在俄罗斯、伊朗、土库曼斯坦等高审查地区使用。'
    + '  </div>'
    + '  <div class="sponsor-card-features">'
    + '    <span class="sponsor-card-tag">VLESS + Reality</span>'
    + '    <span class="sponsor-card-tag">AnyTLS</span>'
    + '    <span class="sponsor-card-tag">AWS 负载中转</span>'
    + '    <span class="sponsor-card-tag">全球节点</span>'
    + '    <span class="sponsor-card-tag">支持高审查地区</span>'
    + '  </div>'
    + '  <div class="sponsor-card-buttons">'
    + '    <a href="https://translink.cc" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-primary">访问 TransLink</a>'
    + '    <a href="https://ednovas.me" target="_blank" rel="noopener" class="sponsor-card-btn sponsor-card-btn-secondary">ednovas.me</a>'
    + '  </div>'
    + '  <div class="sponsor-card-divider"></div>'
    + '  <div class="sponsor-card-footer">'
    + '    更多技术文章请访问 <a href="https://ednovas.xyz" target="_blank" style="color:#93c5fd">ednovas.xyz</a>'
    + '    · 使用帮助请访问 <a href="https://help.ednovas.me" target="_blank" style="color:#93c5fd">help.ednovas.me</a>'
    + '  </div>'
    + '</div>';

  postContent.insertAdjacentHTML('beforeend', sponsorHTML);
});
