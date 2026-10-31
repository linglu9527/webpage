/* ============================================================================
 * graphics.js — 图形资产（可整块替换）
 *
 * 这里只有"图案"类的东西，不含照片：
 *   1. HELMET      全盔侧 3/4 视图（首屏 + 头盔卡共用）
 *   2. posterSVG() 社媒/作品封面图案（无照片时的占位，带编号）
 *
 * 换法：
 *   - 想换头盔造型 → 改 HELMET 里那条 <path>
 *   - 想换封面图案 → 改 posterSVG 的 kind 分支
 *   - 照片类素材仍然走 theme.json 的 ASSETS（放文件，优先生效）
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 1. 全盔（viewBox 240×240，朝左 3/4）
 *    分件：shell 壳体 / visor 面罩 / chin 下巴 / vent 通风口 / spoiler 尾翼
 *    颜色全部走 CSS 变量，跟随主题
 * ------------------------------------------------------------------------- */
export const HELMET = `
<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- 尾翼 -->
  <path d="M184 76 L228 66 L226 96 L186 102 Z"
        fill="var(--c-darkGreenTint2)" stroke="var(--fg)" stroke-width="1.4" stroke-linejoin="round"/>
  <!-- 壳体 -->
  <ellipse cx="118" cy="114" rx="92" ry="88" fill="var(--fg)"/>
  <!-- 壳体高光 -->
  <path d="M60 60 C82 34 118 26 148 32" stroke="var(--c-white)" stroke-opacity=".38"
        stroke-width="3" stroke-linecap="round"/>
  <!-- 面罩开口 -->
  <path d="M36 96 H166 A20 20 0 0 1 186 116 V128 A26 26 0 0 1 160 154 H56 A22 22 0 0 1 34 132 V114 A18 18 0 0 1 36 96 Z"
        fill="var(--helmet-visor, var(--c-lime))"/>
  <!-- 面罩反光 -->
  <path d="M54 108 H150" stroke="var(--c-white)" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>
  <!-- 下巴护栏 -->
  <path d="M44 152 H158 A20 20 0 0 1 178 172 V178 A20 20 0 0 1 158 198 H64 A22 22 0 0 1 42 176 V166 A14 14 0 0 1 44 152 Z"
        fill="var(--c-darkGreenTint1)"/>
  <!-- 下巴通风 -->
  <path d="M74 168 H132 M74 180 H132" stroke="var(--c-white)" stroke-opacity=".5"
        stroke-width="4" stroke-linecap="round"/>
  <!-- 顶部通风 -->
  <path d="M112 34 H150 L148 50 H110 Z" fill="var(--c-darkGreenTint2)"/>
  <!-- 颈口 -->
  <path d="M96 198 C112 190 132 190 148 198" stroke="var(--c-white)" stroke-opacity=".25"
        stroke-width="3" stroke-linecap="round"/>
</svg>`;

/* 小尺寸用：卡片刻度优化（去掉细高光，减少节点） */
export const HELMET_SMALL = HELMET;

/* ---------------------------------------------------------------------------
 * 2. 封面图案
 *    kind 0 = 半调网点（渐变圆点）
 *    kind 1 = 斜线排线
 *    kind 2 = 同心圆
 *    没有照片时用它当底；有照片（ASSETS.posters[i]）就优先用照片
 * ------------------------------------------------------------------------- */
export function posterSVG(index = 0, { kind = 0, label = '', invert = false } = {}) {
  const id = 'p' + index + kind;
  const bg = invert ? 'var(--c-darkGreen)' : 'var(--c-cream)';
  const fg = invert ? 'var(--c-cream)' : 'var(--c-darkGreen)';
  const accent = 'var(--c-lime)';
  const num = String(index + 1).padStart(2, '0');

  let pattern = '';
  if (kind === 0) {
    pattern = `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="4.6" fill="${accent}" opacity=".55"/>
      </pattern>`;
  } else if (kind === 1) {
    pattern = `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="5" height="14" fill="${accent}" opacity=".5"/>
      </pattern>`;
  } else {
    pattern = `<pattern id="${id}" width="60" height="60" patternUnits="userSpaceOnUse">
        <circle cx="30" cy="30" r="26" fill="none" stroke="${accent}" stroke-width="1.6" opacity=".65"/>
        <circle cx="30" cy="30" r="14" fill="none" stroke="${accent}" stroke-width="1.6" opacity=".45"/>
      </pattern>`;
  }

  return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>${pattern}</defs>
    <rect width="400" height="500" fill="${bg}"/>
    <rect width="400" height="500" fill="url(#${id})"/>
    <text x="26" y="66" font-family="var(--font-display), sans-serif" font-size="54"
          font-weight="700" fill="${fg}" letter-spacing="-2">${num}</text>
    <text x="26" y="462" font-family="var(--font-body), sans-serif" font-size="13"
          fill="${fg}" opacity=".7" letter-spacing="4">${label}</text>
  </svg>`;
}
