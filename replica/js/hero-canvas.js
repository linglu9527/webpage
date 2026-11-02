/* ============================================================================
 * hero-canvas.js — 封面单画布合成（三张图一次画完）
 *
 * 层级（由底到顶，与需求一致）：
 *   1. base   刀盾狗
 *   2. helmet 头盔狗完整图   —— 只在鼠标附近显现，半径随停留时间增长
 *   3. wire   头盔线框图     —— 常显，带描边光效；鼠标处加一层光
 *
 * 关键点：
 *   - 全部画在同一个 canvas 上（多次 draw call），不是三张 DOM 图叠
 *   - 显现遮罩是「中间实、边缘虚」：smoothstep(uRadius, uRadius*0.15, dist)
 *   - 靠近不等于全显：uRadius 从 min 缓动增长到 max，需要停留
 * ========================================================================== */

const VERT = `#version 300 es
in vec2 aPos;
uniform vec2 uScale;
uniform vec2 uOffset;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0);
}`;

/* 等高线背景：fbm 噪声取等值线，随时间起伏 */
const FRAG_CONTOUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uColorBg;
uniform vec3  uColorFg;
uniform vec3  uColorFg2;
uniform vec3  uColorOutline;
uniform float uOpacity;
uniform float uNoiseScale;
uniform float uSpeed;
uniform float uThickness;
uniform vec2  uMousePx;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + 11.3; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = vec2(vUv.x * (uRes.x / uRes.y), vUv.y);

  float t = uTime * uSpeed;
  vec2 p = uv * uNoiseScale - vec2(t * 0.16, t * 0.10);

  /* 域扭曲：让等值线随形体流动、拉丝 */
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.25)), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 3.6 * q + vec2(1.7, 9.2)),
    fbm(p + 3.6 * q + vec2(8.3, 2.8))
  );
  float f = fbm(p + 3.2 * r);

  /* 单一层等值线 */
  float width = max(uThickness * 6.0, 0.004);
  float g = fract(f * 13.0);
  float line = 1.0 - smoothstep(0.0, width, min(g, 1.0 - g));

  outColor = vec4(uColorOutline, line * uOpacity);
}`;

const FRAG_BASE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
void main(){ outColor = texture(uTex, vUv); }`;

const FRAG_HELMET = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2  uRes;
uniform vec2  uMousePx;
uniform float uRadius;
uniform float uReveal;
uniform float uDim;      // 远离时整体压暗一点
uniform float uOpacity;  // 图层透明度（对齐工具用）

void main(){
  vec4 t = texture(uTex, vUv);
  vec2 p = (gl_FragCoord.xy - uMousePx) / uRes.x;
  float d = length(p);
  // 中间实、边缘虚
  float mask = smoothstep(uRadius, uRadius * 0.12, d) * uReveal;
  outColor = vec4(t.rgb * mix(1.0, uDim, 1.0 - mask), t.a * mask * uOpacity);
}`;

const FRAG_WIRE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2  uTexel;
uniform vec2  uRes;
uniform vec2  uMousePx;
uniform vec3  uFlowColor;
uniform vec3  uLightColor;
uniform float uLightStrength;
uniform float uTime;
uniform float uOpacity;
uniform float uWarp;
uniform float uSpeed;
uniform float uWidth;
uniform float uGain;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main(){
  float t = uTime;

  /* 极轻微的板材呼吸，保持"干净线稿"观感 */
  vec2 push = vec2(
    noise(vUv * 4.0 + vec2(0.0, -t * 0.35)) - 0.5,
    noise(vUv * 4.0 + vec2(t * 0.30, 0.0)) - 0.5
  );
  vec2 uv = vUv + push * uWarp;

  /* 干净的线条，不做模糊/颗粒 */
  float w = texture(uTex, uv).a;

  /* 自上而下的扫描带：淡入 → 实 → 淡出 */
  float travel = fract(t * uSpeed);
  float front = 1.0 - travel;                 /* 1 = 顶部, 0 = 底部 */
  float x = (vUv.y - front) / max(uWidth, 0.01);

  float fadeIn  = smoothstep(-1.0, -0.10, x);  /* 光带还没扫到 -> 0 */
  float fadeOut = 1.0 - smoothstep(0.20, 1.25, x);
  float env = fadeIn * fadeOut;

  /* 鼠标靠近时线描退场，让位给彩色头盔 */
  vec2 mp = (gl_FragCoord.xy - uMousePx) / uRes.x;
  float md = length(mp);
  float suppress = smoothstep(0.34, 0.12, md);

  float light = smoothstep(0.26, 0.0, md) * uLightStrength;

  float a = w * env * (1.0 - suppress) * uOpacity * uGain;

  vec3 col = uFlowColor + uLightColor * light * w * 0.5;

  outColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s), src.slice(0, 200));
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  return p;
}

function upload(gl, img) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, w: img.width, h: img.height };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('load failed ' + src));
    im.src = src;
  });
}

function hex(h) {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}

export async function createHeroCanvas(canvas, cfg = {}, assets = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) return { fallback: true, setPointer() {}, destroy() {} };

  let base, helmet, wire;
  try {
    const [b, h, w] = await Promise.all([
      loadImage(assets.base),
      loadImage(assets.helmet),
      loadImage(assets.wire)
    ]);
    base = upload(gl, b);
    helmet = upload(gl, h);
    wire = upload(gl, w);
  } catch (e) {
    console.warn('[hero-canvas]', e.message);
    return { fallback: true, setPointer() {}, destroy() {} };
  }

  const progBase = program(gl, VERT, FRAG_BASE);
  const progHelmet = program(gl, VERT, FRAG_HELMET);
  const progWire = program(gl, VERT, FRAG_WIRE);
  const progContour = program(gl, VERT, FRAG_CONTOUR);
  const loc = (p, n) => gl.getUniformLocation(p, n);

  // 全屏 quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = {
    base: gl.getAttribLocation(progBase, 'aPos'),
    helmet: gl.getAttribLocation(progHelmet, 'aPos'),
    wire: gl.getAttribLocation(progWire, 'aPos')
  };

  const state = {
    mx: 0.5, my: 0.62, tx: 0.5, ty: 0.62,
    reveal: 0, target: 0,
    dpr: Math.min(devicePixelRatio || 1, 2)
  };

  const resize = () => {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    canvas.width = Math.round(w * state.dpr);
    canvas.height = Math.round(h * state.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const layout = cfg.layout || {};
  const reveal = cfg.reveal || {};

  const colors = {
    wire: hex(cfg.wireColor || '#14110d'),
    light: hex(cfg.lightColor || '#b23a1f'),
    flow: hex(cfg.flowColor || '#ffffff'),
    contour: hex(cfg.contour?.color || '#14110d')
  };

  let raf;
  const render = () => {
    const cw = canvas.width, ch = canvas.height;

    // 指针缓动
    state.mx += (state.tx - state.mx) * (cfg.pointerEase ?? 0.12);
    state.my += (state.ty - state.my) * (cfg.pointerEase ?? 0.12);

    // 显现强度：靠近慢慢长，离开慢慢收
    const ease = reveal.ease ?? 0.025;
    state.reveal += (state.target - state.reveal) * ease;
    const radius = (reveal.min ?? 0.055) + ((reveal.max ?? 0.3) - (reveal.min ?? 0.055)) * state.reveal;

    const mousePx = [state.mx * cw, state.my * ch];   // gl_FragCoord.y 自底向上

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(vao);

    const drawLayer = (prog, texInfo, conf, frag, alpha = 1) => {
      gl.useProgram(prog);
      gl.enableVertexAttribArray(gl.getAttribLocation(prog, 'aPos'));
      gl.vertexAttribPointer(gl.getAttribLocation(prog, 'aPos'), 2, gl.FLOAT, false, 0, 0);

      const wFrac = conf.w ?? 0.6;
      const sx = wFrac;
      const sy = (wFrac * cw / (texInfo.w / texInfo.h)) / ch;

      gl.uniform2f(loc(prog, 'uScale'), sx, sy);
      // 统一标尺：x/y 都按画布宽度换算，改窗口大小时三层一起缩放，永不散位
      gl.uniform2f(loc(prog, 'uOffset'),
        ((conf.x ?? 0) * unitPx) / cw,
        ((conf.y ?? 0) * unitPx) / ch);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texInfo.tex);
      gl.uniform1i(loc(prog, 'uTex'), 0);

      gl.uniform1f(loc(prog, 'uOpacity'), alpha);
      if (frag) frag(prog, texInfo);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ---- 舞台标尺：所有图层的尺寸与偏移都乘以它 ----
    const stageAspect = cfg.stage?.aspect ?? 1.6;
    let stageW = cw, stageH = cw / stageAspect;
    if (stageH > ch) { stageH = ch; stageW = ch * stageAspect; }
    // width：以画布宽度为标尺（默认，构图随窗口等比缩放）
    // contain：以能放进窗口的最大 16:10 舞台为标尺
    const unitPx = (cfg.stage?.mode === 'contain') ? stageW : cw;

    const opac = cfg.opacity || {};
    const ccfg = cfg.contour || {};
    const bcfg = cfg.background || {};
    if (bcfg.enabled === true) {   // 必须显式开启，避免默认就画背景
      gl.useProgram(progContour);
      const aP = gl.getAttribLocation(progContour, 'aPos');
      gl.enableVertexAttribArray(aP);
      gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(loc(progContour, 'uScale'), 1.0, 1.0);
      gl.uniform2f(loc(progContour, 'uOffset'), 0.0, 0.0);
      gl.uniform2f(loc(progContour, 'uRes'), cw, ch);
      gl.uniform1f(loc(progContour, 'uTime'), performance.now() * 0.001);
      gl.uniform3fv(loc(progContour, 'uColorBg'), new Float32Array(hex(bcfg.bg || '#f2efe6')));
      gl.uniform3fv(loc(progContour, 'uColorFg'), new Float32Array(hex(bcfg.fg || '#e8e2d2')));
      gl.uniform3fv(loc(progContour, 'uColorFg2'), new Float32Array(hex(bcfg.fg2 || bcfg.fg || '#e7e1d0')));
      gl.uniform3fv(loc(progContour, 'uColorOutline'), new Float32Array(hex(bcfg.outline || '#c9c2ae')));
      gl.uniform1f(loc(progContour, 'uOpacity'), bcfg.opacity ?? 1.0);
      gl.uniform1f(loc(progContour, 'uNoiseScale'), bcfg.scale ?? 2.2);
      gl.uniform1f(loc(progContour, 'uSpeed'), bcfg.speed ?? 0.25);
      gl.uniform1f(loc(progContour, 'uThickness'), bcfg.thickness ?? 0.004);
      gl.uniform2fv(loc(progContour, 'uMousePx'), new Float32Array(mousePx));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawLayer(progBase, base, layout.base || { w: 0.66, y: -0.16 }, null, opac.base ?? 1);

    drawLayer(progHelmet, helmet, layout.helmet || { w: 0.3, y: 0.2 }, (p) => {
      gl.uniform2f(loc(p, 'uRes'), cw, ch);
      gl.uniform2fv(loc(p, 'uMousePx'), new Float32Array(mousePx));
      gl.uniform1f(loc(p, 'uRadius'), radius);
      gl.uniform1f(loc(p, 'uReveal'), state.reveal);
      gl.uniform1f(loc(p, 'uDim'), cfg.dimFar ?? 0.9);
    }, opac.helmet ?? 1);

    drawLayer(progWire, wire, layout.wire || { w: 0.34, y: 0.2 }, (p) => {
      gl.uniform2f(loc(p, 'uRes'), cw, ch);
      gl.uniform2fv(loc(p, 'uMousePx'), new Float32Array(mousePx));
      gl.uniform2f(loc(p, 'uTexel'), 1 / wire.w, 1 / wire.h);
      gl.uniform3fv(loc(p, 'uWireColor'), new Float32Array(colors.wire));
      gl.uniform3fv(loc(p, 'uLightColor'), new Float32Array(colors.light));
      gl.uniform1f(loc(p, 'uLightStrength'), cfg.lightStrength ?? 0.85);
      gl.uniform1f(loc(p, 'uTime'), performance.now() * 0.001);
      gl.uniform1f(loc(p, 'uWarp'), cfg.wireWarp ?? 0.003);
      gl.uniform1f(loc(p, 'uSpeed'), cfg.flowSpeed ?? 0.16);
      gl.uniform1f(loc(p, 'uWidth'), cfg.flowWidth ?? 0.05);
      gl.uniform1f(loc(p, 'uGain'), cfg.wireGain ?? 1.5);
      gl.uniform3fv(loc(p, 'uFlowColor'), new Float32Array(colors.flow));
    }, opac.wire ?? 1);

  };

  let lastRaf = 0;
  const loop = () => {
    lastRaf = performance.now();
    render();
    raf = requestAnimationFrame(loop);
  };
  loop();

  // 后台标签页里 rAF 会被暂停，用定时器兜底：只要超过 220ms 没渲染就补一帧
  const fallback = setInterval(() => {
    if (performance.now() - lastRaf > 220) render();
  }, 120);

  return {
    fallback: false,
    // nx, ny 为 0..1 的画布归一化坐标；inside 表示指针是否在封面上
    // instant=true 时立即到位（用于调试/截图）
    setPointer(nx, ny, inside, instant) {
      state.tx = nx;
      state.ty = ny;
      state.target = inside ? 1 : 0;
      if (instant) {
        state.mx = state.tx;
        state.my = state.ty;
        state.reveal = state.target;
        render();   // 手动补一帧（后台标签页 rAF 会被暂停）
      }
    },
    render,
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(fallback);
      window.removeEventListener('resize', resize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
