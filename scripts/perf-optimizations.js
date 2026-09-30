// First-paint optimizations for hexo-theme-vivia, applied at build time so the
// theme in node_modules stays untouched.
//
// 1. Font Awesome: vivia hard-codes three render-blocking stylesheets from
//    cdn.staticfile.org (a CDN tied to the 2024 polyfill.io supply-chain
//    operator). The site only uses ~10 icons, so we build a same-origin subset
//    (CSS masks from the official SVGs) and swap the links out.
// 2. Roboto: vivia's @font-face has no unicode-range / font-display, so the
//    browser must download 2 x 89 KB TTF before it knows Chinese text isn't
//    covered, and may hide text meanwhile. We drop those faces and the TTF
//    preloads; source/css/custom.css defines latin-only woff2 faces instead.
// 3. color.global.min.js is only used by the preview-mode color widget, but is
//    loaded synchronously on every page. Skip it unless previewMode is on.
// 4. The banner image comes from a random-image API; mark it low priority so it
//    doesn't compete with CSS/fonts for bandwidth.

const fs = require('fs');
const path = require('path');

const FA_PKG = path.join(hexo.base_dir, 'node_modules/@fortawesome/fontawesome-free');
const FA_STYLES = { 'fa-solid': 'solid', 'fa-brands': 'brands', 'fa-regular': 'regular' };
const FA_CSS_PATH = 'css/fa-subset.css';

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return listFiles(p, exts);
    return exts.includes(path.extname(d.name)) ? [p] : [];
  });
}

// Scan everything that can emit icon classes: theme layouts, theme config,
// site scripts and posts. Each match is a run of fa-* tokens, e.g.
// "fa-solid fa-angle-right" or "fa-brands fa-github".
function collectIcons() {
  const files = [
    ...listFiles(path.join(hexo.theme_dir, 'layout'), ['.ejs']),
    ...listFiles(path.join(hexo.source_dir, 'js'), ['.js']),
    ...listFiles(path.join(hexo.source_dir, '_posts'), ['.md']),
    path.join(hexo.base_dir, '_config.yml'),
    path.join(hexo.base_dir, `_config.${hexo.config.theme}.yml`),
  ].filter(f => fs.existsSync(f));

  const icons = new Map(); // "solid/bolt" -> { style, name }
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const run of text.match(/fa-[a-z0-9-]+(?:\s+fa-[a-z0-9-]+)*/g) || []) {
      const tokens = run.split(/\s+/);
      const style = tokens.find(t => FA_STYLES[t]);
      if (!style) continue;
      for (const t of tokens) {
        if (FA_STYLES[t]) continue;
        const name = t.slice(3);
        if (fs.existsSync(path.join(FA_PKG, 'svgs', FA_STYLES[style], `${name}.svg`))) {
          icons.set(`${FA_STYLES[style]}/${name}`, { style, name });
        }
      }
    }
  }
  return [...icons.values()];
}

function svgToDataUri(svg) {
  const clean = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim()
    .replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23')
    .replace(/</g, '%3C').replace(/>/g, '%3E');
  return `data:image/svg+xml,${clean}`;
}

function buildFaCss() {
  const version = JSON.parse(fs.readFileSync(path.join(FA_PKG, 'package.json'), 'utf8')).version;
  const icons = collectIcons();
  const rules = icons.map(({ style, name }) => {
    const svg = fs.readFileSync(path.join(FA_PKG, 'svgs', FA_STYLES[style], `${name}.svg`), 'utf8');
    const [, , w, h] = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 512 512'])[1].split(/\s+/).map(Number);
    const width = +(w / h).toFixed(4);
    return `.${style}.fa-${name}{--fa-i:url("${svgToDataUri(svg)}");width:${width}em}`;
  });
  hexo.log.info(`fa-subset: ${icons.length} icons (${icons.map(i => i.name).join(', ')})`);
  return `/*! Font Awesome Free ${version} subset by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0) */\n` +
    `.fa-solid,.fa-brands,.fa-regular{display:inline-block;height:1em;width:1em;vertical-align:-.125em;font-style:normal;` +
    `background-color:currentColor;-webkit-mask:var(--fa-i) center/contain no-repeat;mask:var(--fa-i) center/contain no-repeat}\n` +
    rules.join('\n') + '\n';
}

hexo.extend.generator.register('fa_subset', function () {
  return { path: FA_CSS_PATH, data: buildFaCss };
});

hexo.extend.filter.register('after_render:html', function (str) {
  const root = (hexo.config.root || '/').replace(/\/?$/, '/');

  // 1. staticfile.org Font Awesome links -> one same-origin subset stylesheet
  let faReplaced = false;
  str = str.replace(/<link href="https:\/\/cdn\.staticfile\.org\/font-awesome\/[^"]+" rel="stylesheet">\s*/g, () => {
    if (faReplaced) return '';
    faReplaced = true;
    return `<link rel="stylesheet" href="${root}${FA_CSS_PATH}">\n`;
  });

  // 2. Roboto TTF preloads (replaced by latin woff2 faces in custom.css)
  str = str.replace(/<link rel="preload" href="[^"]*\/Roboto-[A-Za-z]+\.ttf"[^>]*>\s*/g, '');

  // 3. color.js is only needed by the preview-mode color widget
  if (!(hexo.theme.config && hexo.theme.config.previewMode)) {
    str = str.replace(/<script src="[^"]*\/js\/color\.global\.min\.js"\s*><\/script>\s*/g, '');
  }

  // 4. Banner image: don't let it compete with render-critical requests
  str = str.replace(/(<div id="banner"[^>]*>\s*<img )src=/, '$1fetchpriority="low" decoding="async" src=');

  return str;
});

// Drop vivia's full-range Roboto TTF faces from the compiled theme stylesheet.
hexo.extend.filter.register('after_render:css', function (str, data) {
  if (!data || !/css[\\/]style\.styl$/.test(data.path || '')) return str;
  return str.replace(/@font-face\s*\{[^}]*Roboto-(?:Regular|Bold)\.ttf[^}]*\}\s*/g, '');
});
