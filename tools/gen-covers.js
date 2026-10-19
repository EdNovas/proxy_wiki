// Generate 16:9 SVG article covers in the site's shared style.
// Usage: node tools/gen-covers.js [slug ...]   (no args = all covers below)
//
// The visual and title sit in the central band so vivia's list view
// (right panel, background-size: cover, ~35% width) still shows them.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'source', 'images', 'posts');
const W = 1200, H = 675, CX = 600;
const FONT = "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',sans-serif";
const MONO = "'JetBrains Mono','Cascadia Code','Consolas','Menlo',monospace";

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frame(accent, accent2, icon, title, subtitle) {
  const nodes = [[90,120],[210,560],[330,90],[160,360],[1050,110],[1110,420],[960,580],[880,70],[260,250],[1000,300]];
  const links = [[0,2],[0,3],[3,1],[3,8],[8,2],[4,7],[4,9],[9,5],[5,6],[9,6]];
  const net = links.map(([a, b]) =>
    `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="${accent}" stroke-opacity="0.18" stroke-width="1.5"/>`
  ).join('') + nodes.map(([x, y], i) =>
    `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 5 : 3.5}" fill="${accent}" fill-opacity="0.45"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#171b36"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="${accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent2}"/></linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${net}
  ${icon}
  <text x="${CX}" y="500" text-anchor="middle" font-family="${FONT}" font-size="60" font-weight="700" fill="#f1f5f9" letter-spacing="2">${esc(title)}</text>
  <rect x="${CX - 60}" y="524" width="120" height="4" rx="2" fill="url(#acc)"/>
  <text x="${CX}" y="572" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="600" fill="${accent}" fill-opacity="0.9" letter-spacing="5">${esc(subtitle)}</text>
</svg>
`;
}

const covers = [
  {
    slug: 'fully-encrypted-detection', accent: '#f87171', accent2: '#fb923c',
    title: '全加密流量检测', subtitle: 'ENTROPY · POPCOUNT · USENIX 2023',
    icon: (a) => {
      const hex = ['9f','3c','e1','07','b4','5a','d2','88','4e','f0','1b','c7','6d','a3','29','e8','70','5c','b9','03','de','41','8a','f6'];
      const cells = hex.map((h, i) => {
        const x = 400 + (i % 6) * 58, y = 150 + Math.floor(i / 6) * 50;
        return `<rect x="${x}" y="${y}" width="46" height="36" rx="6" fill="#0f172a" stroke="${a}" stroke-opacity="${(0.25 + (i % 5) * 0.12).toFixed(2)}" stroke-width="2"/><text x="${x + 23}" y="${y + 25}" text-anchor="middle" font-family="${MONO}" font-size="18" fill="#e2e8f0" fill-opacity="0.85">${h}</text>`;
      }).join('');
      return `<g>${cells}
        <circle cx="760" cy="290" r="62" fill="#0f172a" fill-opacity="0.7" stroke="${a}" stroke-width="7"/>
        <line x1="804" y1="334" x2="850" y2="380" stroke="${a}" stroke-width="12" stroke-linecap="round"/>
        <text x="760" y="300" text-anchor="middle" font-family="${MONO}" font-size="26" font-weight="700" fill="${a}">H≈8</text></g>`;
    },
  },
  {
    slug: 'gfw-leak-2025', accent: '#facc15', accent2: '#f97316',
    title: 'GFW 泄露事件解读', subtitle: '2025 · PUBLIC REPORTING · ANALYSIS',
    icon: (a) => `<g>
        <rect x="470" y="150" width="200" height="230" rx="10" fill="#0f172a" stroke="${a}" stroke-opacity="0.45" stroke-width="3" transform="rotate(-8 570 265)"/>
        <rect x="500" y="140" width="200" height="230" rx="10" fill="#0f172a" stroke="${a}" stroke-opacity="0.7" stroke-width="3" transform="rotate(4 600 255)"/>
        <rect x="520" y="130" width="200" height="230" rx="10" fill="#0f172a" stroke="${a}" stroke-width="4"/>
        <rect x="545" y="160" width="120" height="10" rx="5" fill="${a}" fill-opacity="0.7"/>
        ${[186, 206, 226, 246, 266, 286].map((y, i) => `<rect x="545" y="${y}" width="${[150, 140, 150, 110, 150, 130][i]}" height="8" rx="4" fill="${i === 2 || i === 4 ? '#0b1020' : '#cbd5e1'}" fill-opacity="${i === 2 || i === 4 ? 1 : 0.45}"/>`).join('')}
        <circle cx="760" cy="330" r="48" fill="#0f172a" stroke="${a}" stroke-width="6"/>
        <line x1="794" y1="364" x2="832" y2="402" stroke="${a}" stroke-width="11" stroke-linecap="round"/></g>`,
  },
  {
    slug: 'return-route-lines', accent: '#38bdf8', accent2: '#34d399',
    title: '回程线路科普', subtitle: 'CN2 GIA · 9929 · CMIN2 · NEXTTRACE',
    icon: (a) => {
      const hops = [[345, 290], [475, 195], [600, 275], [725, 175], [855, 255]];
      const labels = ['VPS', 'AS4809', 'AS9929', 'AS58807', 'CN'];
      const d = hops.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
      return `<g>
        <path d="M345 330 C500 410 700 410 855 300" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-width="5" stroke-dasharray="12 10"/>
        <path d="${d}" fill="none" stroke="${a}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
        ${hops.map(([x, y], i) => {
          const end = i === 0 || i === hops.length - 1;
          return `<circle cx="${x}" cy="${y}" r="${end ? 22 : 15}" fill="${end ? a : '#0f172a'}" stroke="${a}" stroke-width="6"/><text x="${x}" y="${y - 36}" text-anchor="middle" font-family="${MONO}" font-size="24" font-weight="700" fill="${end ? a : '#cbd5e1'}">${labels[i]}</text>`;
        }).join('')}</g>`;
    },
  },
  {
    slug: 'ss2022-shadowtls', accent: '#c084fc', accent2: '#60a5fa',
    title: 'SS-2022 与 ShadowTLS', subtitle: 'SIP022 · BLAKE3 · SHADOWTLS V3',
    icon: (a) => `<g>
        <rect x="390" y="140" width="420" height="230" rx="28" fill="#0f172a" stroke="${a}" stroke-width="4" stroke-dasharray="14 8"/>
        <text x="420" y="176" font-family="${MONO}" font-size="18" font-weight="700" fill="${a}">TLS handshake</text>
        <rect x="450" y="200" width="300" height="140" rx="18" fill="#0f172a" stroke="${a}" stroke-width="4"/>
        <text x="600" y="262" text-anchor="middle" font-family="${MONO}" font-size="30" font-weight="700" fill="#f1f5f9">SS-2022</text>
        <circle cx="560" cy="302" r="11" fill="none" stroke="${a}" stroke-width="4"/>
        <path d="M571 302 H640 M620 302 V316 M634 302 V312" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/></g>`,
  },
  {
    slug: 'ai-dev-tools-proxy', accent: '#2dd4bf', accent2: '#a78bfa',
    title: 'AI 编程工具走代理', subtitle: 'VS CODE · CURSOR · CLAUDE CODE · JETBRAINS',
    icon: (a) => `<g>
        <rect x="380" y="130" width="330" height="240" rx="14" fill="#0f172a" stroke="${a}" stroke-width="3"/>
        <rect x="380" y="130" width="330" height="36" rx="14" fill="#1e293b"/>
        <rect x="380" y="152" width="330" height="14" fill="#1e293b"/>
        <circle cx="404" cy="148" r="6" fill="#f87171"/><circle cx="424" cy="148" r="6" fill="#fbbf24"/><circle cx="444" cy="148" r="6" fill="#4ade80"/>
        <text x="545" y="270" text-anchor="middle" font-family="${MONO}" font-size="64" font-weight="700" fill="${a}">&lt;/&gt;</text>
        <rect x="410" y="300" width="180" height="9" rx="4.5" fill="#cbd5e1" fill-opacity="0.35"/>
        <rect x="410" y="320" width="130" height="9" rx="4.5" fill="#cbd5e1" fill-opacity="0.25"/>
        <path d="M770 200 L782 236 L818 248 L782 260 L770 296 L758 260 L722 248 L758 236 Z" fill="${a}"/>
        <path d="M820 300 L826 318 L844 324 L826 330 L820 348 L814 330 L796 324 L814 318 Z" fill="${a}" fill-opacity="0.6"/></g>`,
  },
  {
    slug: 'telegram-proxy-guide', accent: '#38bdf8', accent2: '#818cf8',
    title: 'Telegram 连接与代理', subtitle: 'MTPROXY · SOCKS5 · IP-CIDR',
    icon: (a) => `<g>
        <path d="M440 250 L760 140 L700 370 L620 300 Z" fill="#0f172a" stroke="${a}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M620 300 L760 140 L590 280 Z" fill="${a}" fill-opacity="0.35" stroke="${a}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M590 280 L600 350 L620 300" fill="none" stroke="${a}" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="800" cy="320" r="34" fill="none" stroke="${a}" stroke-opacity="0.3" stroke-width="7"/>
        <path d="M800 286 A34 34 0 0 1 834 320" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round"/></g>`,
  },
];

const only = process.argv.slice(2);
for (const c of covers.filter(c => !only.length || only.includes(c.slug))) {
  const file = path.join(OUT, `${c.slug}.svg`);
  fs.writeFileSync(file, frame(c.accent, c.accent2, c.icon(c.accent), c.title, c.subtitle), 'utf8');
  console.log('wrote', path.relative(process.cwd(), file));
}
