/* ============================================================================
 * scroll.js — 平滑滚动 + 逐帧进度广播
 *
 * 设计要点（对应原站 Lenis + ScrollTrigger 的分工）：
 *   - 本类负责「滚动位置」这一个事实源
 *   - 其它模块（头部 WebGL、跑马灯、横向区块、主题切换）都只是订阅者
 *   - 不使用 transform 劫持页面，因此 position:sticky / 原生锚点仍然可用
 * ========================================================================== */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Scroll {
  constructor({ smooth = 0.09 } = {}) {
    this.smooth = smooth;
    this.target = window.scrollY;
    this.current = window.scrollY;
    this.velocity = 0;
    this.listeners = new Set();
    this.running = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._onWheel = this._onWheel.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;

    if (!this.reduced) window.addEventListener('wheel', this._onWheel, { passive: false });
    // 用户拖动滚动条 / 键盘 / 触屏时，同步目标值，避免被平滑逻辑拉回去
    window.addEventListener('scroll', this._onScroll, { passive: true });

    this._raf = requestAnimationFrame(this._tick);
    return this;
  }

  stop() {
    this.running = false;
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('scroll', this._onScroll);
    cancelAnimationFrame(this._raf);
  }

  /* 滚轮 → 累积目标位置 */
  _onWheel(e) {
    // 让页面内部可滚动的元素保持原生行为
    const scroller = e.target.closest?.('[data-native-scroll]');
    if (scroller) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.target = clamp(this.target + e.deltaY, 0, max);
    e.preventDefault();
  }

  _onScroll() {
    // 程序性滚动会触发 scroll 事件；只在偏差较大时纠正（用户手动操作）
    if (Math.abs(window.scrollY - this.current) > 2) {
      this.target = window.scrollY;
      this.current = window.scrollY;
    }
  }

  _tick() {
    if (!this.running) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.target = clamp(this.target, 0, max);

    const prev = this.current;
    this.current = this.reduced ? this.target : lerp(this.current, this.target, this.smooth);
    if (Math.abs(this.current - this.target) < 0.35) this.current = this.target;

    this.velocity = this.current - prev;

    if (Math.abs(window.scrollY - this.current) > 0.5) {
      window.scrollTo(0, this.current);
    }

    const frame = {
      y: this.current,
      velocity: this.velocity,
      max,
      progress: max > 0 ? this.current / max : 0
    };
    for (const fn of this.listeners) fn(frame);

    this._raf = requestAnimationFrame(this._tick);
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  scrollTo(y, { immediate = false } = {}) {
    this.target = typeof y === 'string' ? this._resolve(y) : y;
    if (immediate) {
      this.current = this.target;
      window.scrollTo(0, this.current);
    }
  }

  _resolve(selector) {
    const el = document.querySelector(selector);
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp(window.scrollY + rect.top, 0, document.documentElement.scrollHeight);
  }
}

/* ---------------------------------------------------------------------------
 * 元素进度：0 = 刚好进入视口底部，1 = 刚好滑出顶部
 * sticky 区块用 raw 进度；已钉住的区块用 pinned
 * ------------------------------------------------------------------------- */
export function elementProgress(el, { start = 'top bottom', end = 'bottom top' } = {}) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const map = {
    'top bottom':  vh,                  // 元素顶部到视口底部
    'top top':     0,
    'top center':  vh * 0.5,
    'bottom bottom': vh - r.height,
    'bottom top':  -r.height
  };
  const s = map[start] ?? vh;
  const e = map[end] ?? -r.height;
  const total = s - e;
  if (!total) return 0;
  return clamp((s - r.top) / total);
}
