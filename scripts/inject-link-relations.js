// Site-wide link relations (RFC 8288) injected into <head>
// As real HTTP Link: headers require Cloudflare Transform Rules or a server,
// we emit <link rel="..."> tags which most agent crawlers will read.

const siteWideLinks = [
  '<link rel="sitemap" type="application/xml" href="/sitemap.xml">',
  '<link rel="search" type="application/opensearchdescription+xml" href="/local-search.xml" title="代理百科">',
  '<link rel="service-doc" href="/about/">',
  '<link rel="describedby" href="/.well-known/agent-skills/index.json" type="application/json">',
  '<link rel="stylesheet" href="/css/custom.css">'
].join('');

hexo.extend.injector.register('head_end', siteWideLinks, 'default');
hexo.extend.injector.register('body_end', '<script src="/js/sponsor-inject.js"></script>', 'default');

// Per-post: advertise the markdown mirror via rel="alternate".
// after_render:html runs on every rendered page; we filter by path.
hexo.extend.filter.register('after_render:html', function (str, data) {
  if (!data || typeof data.path !== 'string') return str;
  if (!data.path.startsWith('posts/') || !data.path.endsWith('/index.html')) return str;

  const slug = data.path.slice('posts/'.length, -('/index.html'.length));
  const mdHref = `/posts/${slug}/index.md`;
  const tag = `<link rel="alternate" type="text/markdown" href="${mdHref}">`;
  return str.replace('</head>', tag + '</head>');
});
