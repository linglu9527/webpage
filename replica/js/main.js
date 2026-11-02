/* ============================================================================
 * main.js — 声明式引擎 + 启动
 *
 * 复刻原站「DOM 契约驱动运行时」的思路：页面只声明 data-*，
 * 这里统一扫描并建立行为。新增区块时基本不用写 JS。
 *
 * 支持的契约：
 *   data-gl="head"                  → 初始化 WebGL 人像层
 *   data-sticky-hero                → 标记吸顶区（实际钉住交给 CSS sticky）
 *   data-horizontal-section         → 竖向滚动转横向位移
 *     └ data-horizontal-track
 *   data-marquee-scroll="speed"     → 跑马灯随滚动位移
 *   data-section-theme="lime|dark"  → 进入该区切换整站主题
 *   data-reveal                     → 进入视口播放入场
 *   data-parallax="0.2"             → 随滚动做视差位移
 *   data-helmet-reveal              → 自下而上弧形揭幕，由滚动进度驱动
 *   data-countdown="ISO 日期"       → 倒计时
 * ========================================================================== */

import { PALETTE, ASSETS, CONTENT, MOTION, LINKS, HERO } from './config.js';
import { Scroll, elementProgress } from './scroll.js';
import { createHead } from './head-gl.js';
import { HELMET, posterSVG } from './graphics.js';
import { circuitSVG, markSVG, socialSVG, courtSVG } from './block-graphics.js';
import { createHeroCanvas } from './hero-canvas.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------------------------------
 * 0. 设计交付通道：读 theme.json 覆盖配置（设计稿换装走这里，不改代码）
 *    没有该文件时一切用 config.js 的默认值
 * ------------------------------------------------------------------------- */
function deepMerge(target, patch) {
  if (!patch || typeof patch !== 'object') return target;
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else if (v !== undefined && v !== null) {
      target[k] = Array.isArray(v) ? v.slice() : v;
    }
  }
  return target;
}

/* 拉主题配置：网络抖动时自动重试，避免首屏退回默认配色且没有素材 */
async function fetchTheme(retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch('theme.json', { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) { /* 进入重试 */ }
    if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  console.warn('[theme] theme.json 读取失败，使用内置默认值');
  return null;
}

async function applyThemeOverride() {
  try {
    const theme = await fetchTheme();
    if (!theme) return null;
    deepMerge(PALETTE, theme.PALETTE);
    deepMerge(ASSETS, theme.ASSETS);
    deepMerge(CONTENT, theme.CONTENT);
    deepMerge(MOTION, theme.MOTION);
    deepMerge(HERO, theme.HERO);
    deepMerge(LINKS, theme.LINKS);
    // 可选：字体与圆角
    if (theme.FONTS) {
      const s = document.documentElement.style;
      if (theme.FONTS.display) s.setProperty('--font-display', theme.FONTS.display);
      if (theme.FONTS.body) s.setProperty('--font-body', theme.FONTS.body);
      if (theme.FONTS.googleHref) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = theme.FONTS.googleHref;
        document.head.appendChild(link);
      }
    }
    if (theme.RADIUS) document.documentElement.style.setProperty('--radius', theme.RADIUS);
    return theme;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * 1. 用配置渲染导航 / 页脚 / 文案占位
 * ------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
 * 1b. 用 CONTENT 渲染列表区块（改配置即改内容）
 * ------------------------------------------------------------------------- */
const HELMET_SVG = HELMET;

function renderCollections() {
  // 首屏头盔（图形来自 graphics.js）
  document.querySelectorAll('[data-graphic="helmet"]').forEach(el => { el.innerHTML = HELMET; });

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const panelHost = $('[data-list="trackPanels"]');
  if (panelHost) {
    CONTENT.track.panels.forEach((p, i) => {
      const d = el('article', 'h-panel');
      d.innerHTML = `<div class="h-panel__no">${p.no}</div><div class="h-panel__map">${circuitSVG(i)}</div>
        <h3>${p.title}</h3>
        <div class="eyebrow">${p.meta}</div>
        <p class="body-sm" style="margin-top:14px">${p.text}</p>`;
      panelHost.appendChild(d);
    });
    // 末尾补一块引导卡，避免横向尽头空
    const cta = el('article', 'h-panel');
    cta.innerHTML = `<div class="h-panel__no">—</div><h3>${CONTENT.track.title}</h3>
      <a class="eyebrow" href="${LINKS.onTrack}">SEE FULL SCHEDULE →</a>`;
    panelHost.appendChild(cta);
  }

  const helmetHost = $('[data-list="helmets"]');
  if (helmetHost) {
    CONTENT.helmets.items.forEach(h => {
      const d = el('article', 'card');
      d.setAttribute('data-reveal', '');
      const accent = PALETTE[h.accent] || h.accent;
      d.style.setProperty('--accent', accent);
      d.style.setProperty('--helmet-visor', accent);
      d.innerHTML = `<div class="card__art">${HELMET_SVG}</div>
        <div><div class="card__name">${h.name}</div>
        <div class="eyebrow" style="margin-top:6px">${h.meta}</div></div>`;
      helmetHost.appendChild(d);
    });
  }

  const collabHost = $('[data-list="collabs"]');
  if (collabHost) {
    CONTENT.collabs.items.forEach((name, i) => {
      const d = el('a', 'list__row');
      d.href = '#';
      d.setAttribute('data-reveal', '');
      d.innerHTML = `<span class="list__mark">${markSVG(i)}</span><span class="list__name">${name}</span><span class="list__no">${String(i + 1).padStart(2, '0')}</span>`;
      collabHost.appendChild(d);
    });
  }

  const socialHost = $('[data-list="socials"]');
  if (socialHost) {
    CONTENT.socials.items.forEach((name, i) => {
      const d = el('a', 'social');
      d.href = LINKS.socials[name.toLowerCase()] || '#';
      d.setAttribute('data-reveal', '');
      const poster = ASSETS.posters[i];
      d.innerHTML = (poster
        ? `<img class="social__poster" src="${poster}" alt="">`
        : posterSVG(i, { kind: i % 3, label: '', invert: i % 2 === 1 })) +
        `<span class="social__label"><span class="social__glyph">${socialSVG(name)}</span>${name}</span>`;
      socialHost.appendChild(d);
    });
  }

  const footHost = $('[data-list="footerLinks"]');
  if (footHost) {
    CONTENT.footer.links.forEach(l => {
      const a = el('a', null, l.label);
      a.href = l.href;
      footHost.appendChild(a);
    });
  }
}

function hydrate() {
  $$('[data-content]').forEach(el => {
    const path = el.dataset.content.split('.');
    let v = CONTENT;
    for (const k of path) v = v?.[k];
    if (typeof v === 'string') el.textContent = v;
  });

  renderCollections();

  // 导航链接
  const navMap = {
    home: LINKS.home, onTrack: LINKS.onTrack, offTrack: LINKS.offTrack,
    calendar: LINKS.calendar, store: LINKS.store
  };
  $$('[data-link]').forEach(a => {
    const key = a.dataset.link;
    if (navMap[key]) a.href = navMap[key];
  });

  // 跑马灯文案复制（无缝滚动）
  $$('[data-marquee-scroll]').forEach(el => {
    const raw = el.dataset.marqueeText || el.textContent.trim();
    if (!raw) return;
    el.textContent = '';
    for (let i = 0; i < 4; i++) {
      const s = document.createElement('span');
      s.textContent = raw + ' ';
      el.appendChild(s);
    }
  });
}

/* ---------------------------------------------------------------------------
 * 2. 主题切换（对应原站 data-theme / data-nav-theme）
 * ------------------------------------------------------------------------- */
function initThemes(scroll) {
  const sections = $$('[data-section-theme]');
  if (!sections.length) return;
  scroll.onFrame(() => {
    const mid = window.innerHeight * 0.5;
    let active = null;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { active = s; break; }
    }
    if (!active) return;
    const theme = active.dataset.sectionTheme;
    if (document.body.dataset.theme !== theme) {
      document.body.dataset.theme = theme;
    }
  });
}

/* ---------------------------------------------------------------------------
 * 3. 入场揭示
 * ------------------------------------------------------------------------- */
function initReveals() {
  const els = $$('[data-reveal]');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));

  // 逐字入场
  $$('[data-split]').forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'char';
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.setProperty('--i', i);
      el.appendChild(s);
    });
  });
}

/* ---------------------------------------------------------------------------
 * 4. 滚动驱动的动效
 * ------------------------------------------------------------------------- */
function initMotion(scroll) {
  const marquees = $$('[data-marquee-scroll]').map(el => ({
    el,
    speed: parseFloat(el.dataset.marqueeScroll) || MOTION.marquee.speed
  }));

  const horizontals = $$('[data-horizontal-section]').map(sec => ({
    sec,
    track: $('[data-horizontal-track]', sec),
    width: 0
  })).filter(h => h.track);

  const measure = () => {
    horizontals.forEach(h => { h.width = h.track.scrollWidth - window.innerWidth; });
  };
  measure();
  window.addEventListener('resize', measure);

  const parallax = $$('[data-parallax]').map(el => ({
    el, amt: parseFloat(el.dataset.parallax) || 0.15
  }));

  const helmetReveals = $$('[data-helmet-reveal]');

  let acc = 0;

  scroll.onFrame(f => {
    // 跑马灯
    acc += f.velocity;
    marquees.forEach(m => {
      const base = -f.y * m.speed;
      const w = m.el.scrollWidth / 2 || 1;
      const x = ((base % w) + w) % w;
      m.el.style.transform = `translate3d(${-x}px,0,0)`;
    });

    // 横向区块
    horizontals.forEach(h => {
      const p = elementProgress(h.sec, { start: 'top top', end: 'bottom bottom' });
      h.track.style.transform = `translate3d(${-p * h.width}px,0,0)`;
    });

    // 视差
    parallax.forEach(({ el, amt }) => {
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-center * amt).toFixed(2)}px, 0)`;
    });

    // 头盔揭幕：自下而上弧形扫过
    helmetReveals.forEach(el => {
      const p = clamp(elementProgress(el, { start: 'top bottom', end: 'top center' }));
      const eased = p * p * (3 - 2 * p);       // smoothstep
      // 用弧形 clip-path 模拟原站 sine 分界
      const y = (1 - eased) * 100;
      el.style.clipPath = `ellipse(120% ${Math.max(0.01, eased * 62)}% at 50% ${100 - y / 2}%)`;
      el.style.opacity = String(0.25 + eased * 0.75);
    });
  });
}

/* ---------------------------------------------------------------------------
 * 5. 首屏 WebGL
 * ------------------------------------------------------------------------- */
async function initHead(scroll) {
  const canvas = $('[data-gl="head"] canvas') || $('[data-gl="head"]');
  if (!canvas) return;

  const head = await createHead(canvas, MOTION.head, ASSETS.head);

  if (head.fallback) {
    canvas.replaceWith(Object.assign(document.createElement('div'), {
      className: 'gl-fallback',
      textContent: 'WebGL2 not available'
    }));
    return;
  }

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    head.setMouse(
      ((e.clientX - r.left) / r.width - 0.5) * 2,
      -((e.clientY - r.top) / r.height - 0.5) * 2
    );
  });
  canvas.addEventListener('pointerleave', () => head.setMouse(0, 0));

  // 入场：时间驱动的纵向展开（对应原站 REVEAL_DURATION 1.1s）
  const t0 = performance.now();
  const DUR = 1100;
  scroll.onFrame(() => {
    const k = clamp((performance.now() - t0) / DUR);
    head.setReveal(1 - Math.pow(1 - k, 3));   // easeOutCubic
  });
}

/* ---------------------------------------------------------------------------
 * 6. 倒计时
 * ------------------------------------------------------------------------- */

/* 区块配图：全部用代码生成的 SVG，随主题变色 */
function initSectionArt() {
  const on = $('[data-art="on-track"]');
  if (on) on.innerHTML = circuitSVG(21, { size: 240 });

  const off = $('[data-art="off-track"]');
  if (off) off.innerHTML = courtSVG({ size: 240 });

  const exe = $('[data-art="exe"]');
  if (exe) exe.innerHTML = posterSVG(2, { kind: 2, label: 'LN4' });
}

function initCountdown() {
  const el = $('[data-countdown]');
  if (!el) return;
  const target = new Date(el.dataset.countdown).getTime();
  const pad = n => String(n).padStart(2, '0');

  const tick = () => {
    const d = target - Date.now();
    if (d <= 0) { el.textContent = 'RACE WEEKEND'; return; }
    const dd = Math.floor(d / 86400000);
    const hh = Math.floor(d % 86400000 / 3600000);
    const mm = Math.floor(d % 3600000 / 60000);
    const ss = Math.floor(d % 60000 / 1000);
    el.textContent = `${pad(dd)}d ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------------------------------------------------------------------------
 * 7. 页面转场（对应原站 Taxi + page-transition.riv）
 * ------------------------------------------------------------------------- */
function initTransitions() {
  // 幕布默认不覆盖页面，只在离开时升起
  const veil = document.createElement('div');
  veil.className = 'page-veil';
  document.body.appendChild(veil);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
    if (a.target === '_blank') return;
    e.preventDefault();
    veil.classList.add('is-active');
    setTimeout(() => { window.location.href = href; }, 380);
  });
}

/* ---------------------------------------------------------------------------
 * 7b. 鼠标跟随图（第二张图）
 *    对应原站的 tCursorEffect：指针附近揭示另一张图
 * ------------------------------------------------------------------------- */
function initCursorReveal() {
  const src = ASSETS.cursorReveal;
  if (!src) return;
  if (window.matchMedia('(hover: none)').matches) return;   // 触屏跳过

  const cfg = MOTION.head.cursorReveal || {};
  const el = document.createElement('div');
  el.className = 'cursor-reveal';
  el.style.setProperty('--cr-w', cfg.width || '30vw');

  const img = new Image();
  img.src = src;
  img.alt = '';
  el.appendChild(img);
  document.body.appendChild(el);

  let tx = innerWidth / 2, ty = innerHeight / 2;
  let x = tx, y = ty;
  let active = false;

  const heroSel = document.querySelector('.hero');

  const setActive = (on) => {
    if (on === active) return;
    active = on;
    el.classList.toggle('is-on', on);
  };

  window.addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    let inside = true;
    if (cfg.onlyInHero !== false && heroSel) {
      const r = heroSel.getBoundingClientRect();
      inside = e.clientY >= r.top && e.clientY <= r.bottom;
    }
    setActive(inside);
  }, { passive: true });

  window.addEventListener('pointerleave', () => setActive(false));

  const ease = cfg.ease ?? 0.14;
  const loop = () => {
    x += (tx - x) * ease;
    y += (ty - y) * ease;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------------------
 * 7c. 头盔舞台：线描 → 悬停显形
 * ------------------------------------------------------------------------- */
function initHelmetStage() {
  const stage = document.querySelector('[data-helmet-stage]');
  if (!stage) return;

  // 鼠标引导：线描层里塞一条扫动光带（被父级 mask 裁成"沿轮廓走"的效果）
  const lines = stage.querySelector('.helmet-stage__lines');
  if (lines && !lines.querySelector('.helmet-stage__scan')) {
    const scan = document.createElement('span');
    scan.className = 'helmet-stage__scan';
    lines.appendChild(scan);
  }

  const open = () => stage.classList.add('is-open');
  const close = () => stage.classList.remove('is-open');

  stage.addEventListener('pointerenter', open);
  stage.addEventListener('pointerleave', close);
  stage.addEventListener('focus', open);
  stage.addEventListener('blur', close);
  // 触屏：点一下切换
  stage.addEventListener('click', () => stage.classList.toggle('is-open'));
}

/* ---------------------------------------------------------------------------
 * 7d. 封面：单画布合成 + 指针驱动显现
 * ------------------------------------------------------------------------- */
async function initHero(scroll) {
  const host = document.querySelector('[data-hero-canvas]');
  if (!host) return;
  const canvas = host.querySelector('canvas');
  if (!canvas) return;

  const hero = await createHeroCanvas(canvas, HERO, ASSETS.hero || {});
  window.__hero = hero;
  window.__heroCfg = HERO;
  if (hero.fallback) { console.warn('[hero] fallback'); return; }

  const heroEl = document.querySelector('.hero');
  let raf;

  const onPointer = (e) => {
    const r = heroEl.getBoundingClientRect();
    const inside = e.clientY >= r.top && e.clientY <= r.bottom &&
                   e.clientX >= r.left && e.clientX <= r.right;
    const nx = (e.clientX - r.left) / r.width;
    const ny = 1 - (e.clientY - r.top) / r.height;   // GL 的 y 向上
    hero.setPointer(nx, ny, inside);
  };

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerleave', () => hero.setPointer(0.5, 0.62, false));

  // 封面滚出视口后停止请求指针，交给默认状态
  scroll.onFrame(() => {
    const r = heroEl.getBoundingClientRect();
    if (r.bottom < 0 && !raf) { raf = 1; hero.setPointer(0.5, 0.62, false); }
    else if (r.bottom >= 0 && raf) { raf = 0; }
  });
}

/* ---------------------------------------------------------------------------
 * 7e. 对齐调参（仅 ?tune=1 时出现）
 *     拖动 = 上下移动，滚轮 = 缩放，把数值抄回 theme.json 即可
 * ------------------------------------------------------------------------- */
function initTuner(hero) {
  if (!/[?&]tune=1/.test(location.search)) return;
  const host = document.querySelector('[data-hero-canvas]');
  const heroEl = document.querySelector('.hero');

  const panel = document.createElement('div');
  panel.style.cssText = `position:fixed;right:16px;bottom:16px;z-index:9999;background:#111;color:#8f8;
    font:12px/1.5 ui-monospace,monospace;padding:12px 14px;border-radius:8px;white-space:pre;
    box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:auto;user-select:none;`;
  document.body.appendChild(panel);

  const paint = () => {
    panel.textContent =
      `TUNE  拖动=上下  滚轮=缩放\n` +
      `helmet  w=${HERO.layout.helmet.w.toFixed(3)}  y=${HERO.layout.helmet.y.toFixed(3)}\n` +
      `（wire 自动同步）\n双击=复制配置`;
  };

  const sync = () => {
    HERO.layout.wire.w = HERO.layout.helmet.w;
    HERO.layout.wire.y = HERO.layout.helmet.y;
    paint();
    hero.render && hero.render();
  };

  let dragging = false, lastY = 0;
  host.addEventListener('pointerdown', (e) => { dragging = true; lastY = e.clientY; e.preventDefault(); });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = heroEl.getBoundingClientRect().height;
    HERO.layout.helmet.y -= ((e.clientY - lastY) / h) * 2;
    lastY = e.clientY;
    sync();
  });
  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    HERO.layout.helmet.w = Math.max(0.05, HERO.layout.helmet.w + (e.deltaY > 0 ? 0.008 : -0.008));
    sync();
  }, { passive: false });

  panel.addEventListener('dblclick', async () => {
    const text = `"layout": { "base": { "w": ${HERO.layout.base.w.toFixed(3)}, "y": ${HERO.layout.base.y.toFixed(3)} }, "helmet": { "w": ${HERO.layout.helmet.w.toFixed(3)}, "y": ${HERO.layout.helmet.y.toFixed(3)} }, "wire": { "w": ${HERO.layout.wire.w.toFixed(3)}, "y": ${HERO.layout.wire.y.toFixed(3)} } }`;
    try { await navigator.clipboard.writeText(text); panel.textContent = '已复制:\n' + text; }
    catch { panel.textContent = text; }
    setTimeout(paint, 2600);
  });

  // 调参时让显现常驻，方便看边界
  HERO.reveal.min = 0.9;
  HERO.reveal.max = 0.9;
  hero.setPointer(0.5, 0.45, true, true);
  sync();
}

/* ---------------------------------------------------------------------------
 * 8. 启动
 * ------------------------------------------------------------------------- */
async function boot() {
  // 先读设计交付覆盖，再注入变量与渲染
  const themeOverride = await applyThemeOverride();

  // 允许设计稿指定每一段的明暗主题：{ "SECTIONS": { "hero": "white", "marquee": "dark" } }
  if (themeOverride && themeOverride.SECTIONS) {
    for (const [name, themeName] of Object.entries(themeOverride.SECTIONS)) {
      document.querySelectorAll('[data-section="' + name + '"]').forEach(el => {
        el.dataset.sectionTheme = themeName;
      });
    }
  }

  // 设计变量注入（改 config 即改全站配色）
  const root = document.documentElement.style;
  Object.entries(PALETTE).forEach(([k, v]) => root.setProperty('--c-' + k, v));

  // 对齐工具保存的布局优先（align.html 的「应用到主页」）
  try {
    const saved = JSON.parse(localStorage.getItem('heroLayout') || 'null');
    if (saved) deepMerge(HERO.layout, saved);
  } catch {}

  hydrate();

  const scroll = new Scroll({ smooth: MOTION.scroll.smooth }).start();

  initThemes(scroll);
  initMotion(scroll);
  initReveals();
  initSectionArt();
  initCountdown();
  initTransitions();
  try { await initHero(scroll); } catch (e) { window.__heroError = (e && e.message) || String(e); console.error(e); }
  if (window.__hero && !window.__hero.fallback) initTuner(window.__hero);

  // 首帧让入场动画跑起来
  requestAnimationFrame(() => document.body.classList.add('is-booted'));

  // 暴露调试句柄（对应原站 window.landoGL）
  window.__replica = { scroll, config: { PALETTE, ASSETS, CONTENT, MOTION, LINKS } };
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();
