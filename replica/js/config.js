/* ============================================================================
 * config.js — 唯一需要改的文件（替换接口层）
 *
 * 三段式：
 *   PALETTE  颜色 / 设计变量
 *   ASSETS   素材地址（留 null 用内置占位程序生成）
 *   CONTENT  文案与数据
 *   MOTION   动效参数
 *   LINKS    跳转链接
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 1. 调色板 —— 取自原站 :root CSS 变量
 * ------------------------------------------------------------------------- */
export const PALETTE = {
  lime:              '#d2ff00',   // 主强调色
  limeOff:           '#b2c73a',
  darkGreen:         '#282c20',   // 主深色底
  darkGreenTint1:    '#3b3c38',
  darkGreenTint2:    '#535450',
  white:             '#f4f4ed',   // 暖白
  cream:             '#efefe5',
  greenLight:        '#ebeee0',
  grey1:             '#ebeee0',
  grey2:             '#c8cbbd',
  greenOffWhite2:    '#b4b8a5',
  black:             '#111112',
  orange:            '#ff6b00'
};

/* ---------------------------------------------------------------------------
 * 2. 素材接口
 *
 * 把文件放进 replica/assets/ 然后写成 'assets/xxx.webp' 即可替换。
 * 留 null  =>  运行时用程序化占位图（画布生成），项目零素材也能跑。
 *
 * head.* 是首屏 2.5D 人像那四张图：
 *   diffuse 人像（建议透明背景 PNG/WebP）
 *   depth   深度图（灰度，越亮越靠近镜头）—— 没有的话留 null 用自动生成的
 *   alpha   轮廓遮罩（可留 null，回退用 diffuse 的 alpha 通道）
 *   normal  法线（可选，留 null 关闭细节光照）
 * ------------------------------------------------------------------------- */
export const ASSETS = {
  head: {
    diffuse: null,   // e.g. 'assets/portrait.webp'
    depth:   null,   // e.g. 'assets/portrait-depth.webp'
    alpha:   null,
    normal:  null
  },
  // 头像小图 / 品牌标记 / 背景视频封面，都走这里
  // 封面三张图（单画布合成，由底到顶）
  hero: {
    // 内置默认值：即使 theme.json 加载失败也能出图
    base: 'assets/portrait.png',
    helmet: 'assets/helmet-doge.png',
    wire: 'assets/helmet-wire.png'
  },
  // 鼠标跟随图（旧方案，已停用）
  cursorReveal: null,
  brandMark: null,
  posters: [
    null, null, null, null, null, null   // socials 区的 6 张视频封面
  ]
};

/* ---------------------------------------------------------------------------
 * 3. 文案与数据 —— 改这里就能换内容，不用碰代码
 * ------------------------------------------------------------------------- */
export const CONTENT = {
  brand: 'NORRIS',
  hero: {
    title: 'WO DE DAO DUN',      // 顶部标题
    tl: 'NIUYANTAO',             // 左上角
    tr: '大狗',                   // 右上角
    bl: 'gogogo JIAO',           // 左下角
    br: 'VIEW ON TRACK'          // 右下角（本轮不改）
  },
  marquee: {
    top: 'WE DID IT AT HOME WE DID IT AT HOME',
    bottom: 'A BRITISH GP WEEKEND I WILL REMEMBER FOREVER'
  },
  track: {
    title: 'ON TRACK',
    panels: [
      { no: '01', title: 'AUSTIN',   meta: 'COTA · 5.513 KM', text: 'Nineteen corners, one long back straight.' },
      { no: '02', title: 'MEXICO',   meta: 'HERMANOS RODRIGUEZ · 4.304 KM', text: 'Thin air, big braking zones.' },
      { no: '03', title: 'MONACO',   meta: 'MONTE CARLO · 3.337 KM', text: 'No room for a second thought.' },
      { no: '04', title: 'SILVERSTONE', meta: '3.600 KM', text: 'Home race. The one that mattered.' }
    ]
  },
  otot: {
    onLabel: 'ON TRACK',
    onHref: 'on-track.html',
    onText: 'Live results, career stats and every race weekend.',
    offLabel: 'OFF TRACK',
    offHref: 'off-track.html',
    offText: 'Padel, photography, lego and everything else.'
  },
  helmets: {
    title: 'HELMETS',
    items: [
      // accent 写调色板键名（lime / greenOffWhite2 / orange ...），渲染时解析，
      // 这样换主题配色时卡片会跟着变
      { name: 'GOLD',  meta: 'SEASON 2025', accent: 'lime' },
      { name: 'DISCO', meta: 'ONE-OFF',     accent: 'greenOffWhite2' }
    ]
  },
  exe: {
    label: 'LANDO EXE',
    title: 'Always bringing the fight.',
    text: 'A personal corner: the stuff that happens when the visor is up.'
  },
  collabs: {
    title: 'COLLABS',
    items: ['QUADRANT', 'McLAREN', 'OFF BRAND', 'MINIS']
  },
  socials: {
    title: "WHAT'S UP ON SOCIALS",
    items: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITCH']
  },
  footer: {
    big: 'LN4',
    note: 'Fan-made structural replica. Not affiliated.',
    links: [
      { label: 'Home',      href: 'index.html' },
      { label: 'On Track',  href: 'on-track.html' },
      { label: 'Off Track', href: 'off-track.html' },
      { label: 'Calendar',  href: 'calendar.html' }
    ]
  }
};

/* ---------------------------------------------------------------------------
 * 4. 动效参数 —— 对应原站 window.landoGL.params
 * ------------------------------------------------------------------------- */
export const MOTION = {
  head: {
    segments: 96,            // 网格细分；越低越轻
    displacementScale: 0.55, // 深度位移强度（原站 0.25，这里按视觉调）
    scale: 0.66,             // 人像占视口高度比例
    outline: { enabled: true, thickness: 0.0045, color: '#f4f4ed' },
    parallax: 0.06,          // 鼠标视差强度
    revealSize: 0.45,        // 入场 UV 拉伸
    colors: {
      background: '#F8F8F3',
      foreground: '#D2FF00',
      outline:    '#CBCBB9',
      cursor:     '#CFD2C5',
      filter:     '#50593F'
    },
    cursor: { radius: 0.30, intensity: 0.5, ease: 0.08 },
    // 鼠标跟随图的尺寸与跟随缓动
    cursorReveal: { width: '30vw', ease: 0.14, onlyInHero: true },
    autoRotate: 0.06
  },
  scroll: {
    smooth: 0.09,       // 平滑滚动系数（0-1，越大越快跟手）
    revealAt: 0.12      // 元素入场触发比例
  },
  marquee: { speed: 0.12 },
  horizontal: { scrub: true }
};

/* ---------------------------------------------------------------------------
 * 5. 封面合成参数 —— 单画布三图叠加
 *
 * layout.*.w  该图宽度占视口宽的比例
 * layout.*.y  垂直位置（NDC，-1 到底、1 到顶）
 * reveal      鼠标附近显现的半径范围与缓动（min→max 需要停留才会长大）
 * ------------------------------------------------------------------------- */
export const HERO = {
  layout: {
    base:   { w: 0.66, y: -0.16 },
    helmet: { w: 0.30, y: 0.20 },
    wire:   { w: 0.34, y: 0.20 }
  },
  reveal: { min: 0.055, max: 0.30, ease: 0.025 },
  pointerEase: 0.12,
  // 等高线背景（代码生成，非贴图）
  contour: {
    enabled: true,
    color: '#14110d',
    opacity: 0.30,     // 线条强度
    scale: 2.4,        // 噪声尺度（越大线越密）
    levels: 9.0,       // 等高线层数
    speed: 1.0,        // 起伏/流动速度
    fade: 0.05         // 从下往上的淡出起点（0=最底，1=最顶）
  },
  wireGain: 1.5,
  wireColor: '#14110d',
  lightColor: '#b23a1f',
  glow: 0.55,
  lightStrength: 0.85,
  dimFar: 0.9
};

/* ---------------------------------------------------------------------------
 * 6. 跳转链接 —— 导航与 CTA 全在这里改
 * ------------------------------------------------------------------------- */
export const LINKS = {
  home:      'index.html',
  onTrack:   'on-track.html',
  offTrack:  'off-track.html',
  calendar:  'calendar.html',
  store:     '#',            // 原站是 store.landonorris.com 外链
  socials: {
    tiktok:    '#',
    instagram: '#',
    youtube:   '#',
    twitch:    '#'
  }
};
