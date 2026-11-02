
/* ==========================================================================
   区块图形（全部为内联 SVG，跟随 currentColor，随主题变色）
   ========================================================================== */

/** 确定性伪随机：同一个 seed 每次渲染结果一致 */
function seeded(seed) {
  let s = (seed | 0) * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** 闭合 Catmull-Rom → 三次贝塞尔路径 */
function closedSmooth(pts, scale, cx, cy) {
  const n = pts.length;
  const p = (i) => {
    const q = pts[(i + n) % n];
    return [cx + q[0] * scale, cy + q[1] * scale];
  };
  let d = `M${p(0)[0].toFixed(1)},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 9, p1[1] + (p2[1] - p0[1]) / 9];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 9, p2[1] - (p3[1] - p1[1]) / 9];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/**
 * 赛道电路图：确定性生成的闭合环线（不是真实赛道坐标，是同风格的示意图）
 */
export function circuitSVG(seed = 0, { size = 180, stroke = 'currentColor' } = {}) {
  const r = seeded(seed + 13);
  // 赛道：长直道 + 发卡弯的组合，半径变化大，转角更硬
  const n = 9 + Math.floor(r() * 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const straight = r() > 0.62;                 // 部分顶点拉成"直道端点"
    const rad = straight ? 0.86 + r() * 0.12 : 0.34 + r() * 0.34;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.72]);
  }
  const cx = size / 2;
  const cy = size / 2;
  const d = closedSmooth(pts, size * 0.46, cx, cy);

  // 起跑线：在第一个点附近画一小段垂直短线
  const p0 = [cx + pts[0][0] * size * 0.46, cy + pts[0][1] * size * 0.46];
  const p1 = [cx + pts[1][0] * size * 0.46, cy + pts[1][1] * size * 0.46];
  const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const tick = 7;
  const tx = Math.cos(ang + Math.PI / 2) * tick;
  const ty = Math.sin(ang + Math.PI / 2) * tick;

  return `<svg class="circuit" viewBox="0 0 ${size} ${size}" aria-hidden="true" fill="none"
      stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${d}" stroke-width="1.6"/>
    <line x1="${(p0[0] - tx).toFixed(1)}" y1="${(p0[1] - ty).toFixed(1)}"
          x2="${(p0[0] + tx).toFixed(1)}" y2="${(p0[1] + ty).toFixed(1)}" stroke-width="2.4"/>
    <circle cx="${p0[0].toFixed(1)}" cy="${p0[1].toFixed(1)}" r="2.6" fill="${stroke}" stroke="none"/>
  </svg>`;
}

/**
 * 联名标记：几何抽象符号（正方形 / 菱形 / 圆弧组合）
 */
export function markSVG(seed = 0, { size = 44 } = {}) {
  const r = seeded(seed + 31);
  const s = size;
  const c = s / 2;
  const kind = Math.floor(r() * 3);
  const rot = Math.round(r() * 45);
  const inner = s * (0.24 + r() * 0.1);

  let core = '';
  if (kind === 0) {
    core = `<rect x="${c - inner}" y="${c - inner}" width="${inner * 2}" height="${inner * 2}"
              transform="rotate(${rot} ${c} ${c})" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="${c}" cy="${c}" r="${inner * 0.42}" fill="currentColor"/>`;
  } else if (kind === 1) {
    core = `<circle cx="${c}" cy="${c}" r="${inner}" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M${c - inner},${c} L${c + inner},${c} M${c},${c - inner} L${c},${c + inner}"
              stroke="currentColor" stroke-width="1.4"/>`;
  } else {
    core = `<path d="M${c - inner},${c + inner} L${c},${c - inner} L${c + inner},${c + inner} Z"
              fill="none" stroke="currentColor" stroke-width="1.4"/>
            <line x1="${c - inner}" y1="${c + inner}" x2="${c + inner}" y2="${c + inner}"
              stroke="currentColor" stroke-width="1.4"/>`;
  }

  return `<svg class="mark" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-hidden="true">
    <rect x=".7" y=".7" width="${s - 1.4}" height="${s - 1.4}" fill="none"
          stroke="currentColor" stroke-width="1" opacity=".32"/>
    ${core}
  </svg>`;
}

/**
 * 社媒图标：简洁几何字形
 */
export function socialSVG(kind = '') {
  const k = kind.toLowerCase();
  const box = '<rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/>';
  let glyph = '';

  if (k.includes('tiktok')) {
    glyph = `<path d="M19 7v11.2a4.2 4.2 0 1 1-3.4-4.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             <path d="M19 7c.6 2.6 2.2 4.1 4.6 4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  } else if (k.includes('instagram')) {
    glyph = `<rect x="9" y="9" width="14" height="14" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
             <circle cx="16" cy="16" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/>
             <circle cx="20.6" cy="11.4" r="1.1" fill="currentColor"/>`;
  } else if (k.includes('youtube')) {
    glyph = `<rect x="7.5" y="10" width="17" height="12" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
             <path d="M14.4 13.6 L19.6 16 L14.4 18.4 Z" fill="currentColor"/>`;
  } else if (k.includes('twitch')) {
    glyph = `<path d="M10 9h12v9l-3.4 3.4h-3.2L12.8 24H11v-2.6H8V11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
             <line x1="14.5" y1="12.5" x2="14.5" y2="17" stroke="currentColor" stroke-width="1.8"/>
             <line x1="18.5" y1="12.5" x2="18.5" y2="17" stroke="currentColor" stroke-width="1.8"/>`;
  } else {
    glyph = `<path d="M16 8 L24 16 L16 24 L8 16 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>`;
  }

  return `<svg class="glyph" viewBox="0 0 32 32" aria-hidden="true">${box}${glyph}</svg>`;
}


/**
 * 板式网球球场（俯视）：矩形场地 + 发球线 + 中线
 */
export function courtSVG({ size = 200 } = {}) {
  const w = size;
  const h = size * 0.62;
  const pad = size * 0.06;
  const x0 = pad, y0 = (size - h) / 2, x1 = w - pad, y1 = y0 + h;
  const midX = (x0 + x1) / 2;
  const sv = (y0 + y1) / 2;
  const serve = h * 0.30;

  return `<svg class="court" viewBox="0 0 ${size} ${size}" aria-hidden="true" fill="none"
      stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${h}" rx="3"/>
    <line x1="${x0}" y1="${sv}" x2="${x1}" y2="${sv}"/>
    <line x1="${midX}" y1="${y0}" x2="${midX}" y2="${y1}"/>
    <line x1="${x0}" y1="${sv - serve}" x2="${x1}" y2="${sv - serve}" stroke-dasharray="4 5"/>
    <line x1="${x0}" y1="${sv + serve}" x2="${x1}" y2="${sv + serve}" stroke-dasharray="4 5"/>
  </svg>`;
}
