// vivia ships a single-category layout and a single-tag layout, but no
// "all categories" / "all tags" listing. We render those into the page body
// at filter time using hexo.locals (so they stay in sync as content changes).

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function rootPrefix(ctx) {
  // hexo.config.root is "/" or "/sub/"; normalize so we can concatenate.
  return (ctx.config.root || '/').replace(/\/?$/, '/');
}

function renderCategories(ctx) {
  const root = rootPrefix(ctx);
  const cats = ctx.locals.get('categories').sort('-length').toArray();
  if (!cats.length) return '<p>暂无分类。</p>';
  const items = cats.map(c =>
    `<li><a href="${root}${c.path}">${escapeHtml(c.name)}</a>` +
    ` <span class="category-count">(${c.length})</span></li>`
  ).join('');
  return `<ul class="all-categories-list">${items}</ul>`;
}

function renderTags(ctx) {
  const root = rootPrefix(ctx);
  const tags = ctx.locals.get('tags').sort('-length').toArray();
  if (!tags.length) return '<p>暂无标签。</p>';
  const items = tags.map(t =>
    `<a class="all-tag-chip" href="${root}${t.path}">` +
    `${escapeHtml(t.name)} <span class="tag-count">${t.length}</span></a>`
  ).join('');
  return `<div class="all-tags-cloud">${items}</div>`;
}

const ctx = hexo;

hexo.extend.filter.register('after_render:html', function (str, data) {
  if (!data || typeof data.path !== 'string') return str;
  if (data.path === 'categories/index.html') {
    return str.replace('<div id="all-categories-listing"></div>', renderCategories(ctx));
  }
  if (data.path === 'tags/index.html') {
    return str.replace('<div id="all-tags-listing"></div>', renderTags(ctx));
  }
  return str;
});
