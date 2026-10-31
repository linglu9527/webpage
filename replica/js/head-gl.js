/* ============================================================================
 * head-gl.js — 首屏 2.5D 人像层（零依赖 WebGL2）
 *
 * 复刻原站 headScene 的核心手法：
 *   1. 一张人像 + 一张深度图
 *   2. 平面细分网格，顶点按深度图沿 Z 推出 —— 得到浮雕体积
 *   3. 用深度梯度算法线做假光照
 *   4. 轮廓用遮罩边缘检测画出来，不是几何体
 *
 * 与原站的差异（已写进 README）：
 *   - 原站渲染到离屏 target 再做全屏合成；这里单 Pass 直出、背景透明
 *   - 原站光标拖尾是「画笔式累积遮罩」；这里是半径衰减近似
 *   - 头盔是真 GLB；这里用 SVG 图层做同样的「弧形自下而上揭幕」
 * ========================================================================== */

const M4 = {
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  },
  lookAt(eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz) || 1; zx /= len; zy /= len; zz /= len;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1; xx /= len; xy /= len; xz /= len;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  }
};

/* ---------- 程序化占位素材：编辑感双色调人像 ---------- */
function makePlaceholderSet(size = 640, palette = {}) {
  const S = size;
  const P = n => n * S;
  const ink = palette.ink || '#14110d';
  const rim = palette.rim || '#b23a1f';

  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);

  /* ---- 头/颈/肩的路径 ---- */
  const headPath = () => {
    const top = P(0.145), bot = P(0.655), hw = P(0.183), cx = P(0.5);
    g.beginPath();
    g.moveTo(cx, top);
    g.bezierCurveTo(cx + hw * 0.75, top, cx + hw, top + P(0.085), cx + hw, top + P(0.195));
    g.bezierCurveTo(cx + hw, bot - P(0.145), cx + hw * 0.55, bot - P(0.02), cx, bot);
    g.bezierCurveTo(cx - hw * 0.55, bot - P(0.02), cx - hw, bot - P(0.145), cx - hw, top + P(0.195));
    g.bezierCurveTo(cx - hw, top + P(0.085), cx - hw * 0.75, top, cx, top);
    g.closePath();
  };

  // 肩（弧线，不是圆顶）
  g.beginPath();
  g.moveTo(P(-0.05), P(1.18));
  g.bezierCurveTo(P(0.10), P(0.92), P(0.30), P(0.80), P(0.5), P(0.80));
  g.bezierCurveTo(P(0.70), P(0.80), P(0.90), P(0.92), P(1.05), P(1.18));
  g.closePath();
  g.fillStyle = ink;
  g.fill();

  // 颈
  g.beginPath();
  g.moveTo(P(0.437), P(0.60));
  g.lineTo(P(0.563), P(0.60));
  g.lineTo(P(0.548), P(0.86));
  g.lineTo(P(0.452), P(0.86));
  g.closePath();
  g.fill();

  // 头
  headPath();
  g.fill();

  // 耳
  g.beginPath();
  g.ellipse(P(0.682), P(0.435), P(0.028), P(0.045), 0.1, 0, Math.PI * 2);
  g.fill();

  /* ---- 半调网点：左侧密、右侧疏（做明暗） ---- */
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const step = S / 74;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const t = 1 - x / S;                       // 左黑右亮
      const r = step * (0.06 + t * 0.34);
      if (r < 0.5) continue;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = `rgba(0,0,0,${0.10 + t * 0.42})`;
      g.fill();
    }
  }
  g.restore();

  /* ---- 轮廓光：局部径向，只擦到头部右侧边沿 ---- */
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const rg = g.createRadialGradient(P(0.700), P(0.40), P(0.01), P(0.66), P(0.43), P(0.135));
  rg.addColorStop(0, hexA(rim, 0.95));
  rg.addColorStop(0.45, hexA(rim, 0.35));
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  g.restore();

  /* ---- 高光边（头部轮廓右上） ---- */
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const eg = g.createRadialGradient(P(0.665), P(0.305), P(0.005), P(0.63), P(0.33), P(0.11));
  eg.addColorStop(0, 'rgba(255,250,235,0.75)');
  eg.addColorStop(0.5, 'rgba(255,250,235,0.12)');
  eg.addColorStop(1, 'rgba(255,250,235,0)');
  g.fillStyle = eg;
  g.fillRect(0, 0, S, S);
  g.restore();

  /* ---- 颗粒 ---- */
  const grain = g.getImageData(0, 0, S, S);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 13;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);

  /* ---- alpha 遮罩 ---- */
  const ac = document.createElement('canvas');
  ac.width = ac.height = S;
  const ag = ac.getContext('2d');
  ag.drawImage(c, 0, 0);
  const ad = ag.getImageData(0, 0, S, S);
  for (let i = 0; i < ad.data.length; i += 4) {
    const inside = ad.data[i + 3] > 20 ? 255 : 0;
    ad.data[i] = ad.data[i + 1] = ad.data[i + 2] = inside;
    ad.data[i + 3] = 255;
  }
  ag.putImageData(ad, 0, 0);

  /* ---- depth：只作用于头部，肩颈保持平 ---- */
  const dc = document.createElement('canvas');
  dc.width = dc.height = S;
  const dg = dc.getContext('2d');
  dg.fillStyle = '#000';
  dg.fillRect(0, 0, S, S);
  const core = dg.createRadialGradient(P(0.47), P(0.42), P(0.01), P(0.5), P(0.44), P(0.30));
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.45, '#b4b4b4');
  core.addColorStop(1, '#000000');
  dg.save();
  dg.beginPath();
  dg.moveTo(P(0.5), P(0.145));
  dg.bezierCurveTo(P(0.637), P(0.145), P(0.683), P(0.23), P(0.683), P(0.34));
  dg.bezierCurveTo(P(0.683), P(0.51), P(0.60), P(0.635), P(0.5), P(0.655));
  dg.bezierCurveTo(P(0.40), P(0.635), P(0.317), P(0.51), P(0.317), P(0.34));
  dg.bezierCurveTo(P(0.317), P(0.23), P(0.363), P(0.145), P(0.5), P(0.145));
  dg.closePath();
  dg.clip();
  dg.fillStyle = core;
  dg.fillRect(0, 0, S, S);
  dg.restore();
  dg.filter = 'blur(16px)';
  dg.drawImage(dc, 0, 0);
  dg.filter = 'none';

  return { diffuse: c, alpha: ac, depth: dc };
}

function hexA(hex, a) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16), gg = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${gg},${b},${a})`;
}

function canvasTexture(gl, src) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('load failed: ' + url));
    img.src = url;
  });
}

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform sampler2D uDepth;
uniform float uDisp;
uniform float uAspectImg;
uniform float uScale;
out vec2 vUv;

void main(){
  vUv = aPos + 0.5;
  float d = texture(uDepth, vUv).r;
  vec3 p = vec3(aPos.x * uAspectImg * uScale, aPos.y * uScale, d * uDisp * uScale);
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uDiffuse;
uniform sampler2D uAlpha;
uniform sampler2D uDepth;
uniform float uUseAlphaTex;
uniform float uReveal;
uniform float uRevealSize;
uniform float uAspect;
uniform vec2  uMouse;
uniform float uCursorRadius;
uniform float uCursorIntensity;
uniform vec3  uFg;
uniform vec3  uOutlineColor;
uniform float uOutlineThickness;
uniform float uOutlineOn;
uniform float uShade;            // 0 = 平面原图，1 = 按深度做假光照

void main(){
  // 入场：UV 纵向拉伸（复刻原站 REVEAL_SIZE 手法）
  vec2 uv = vUv;
  uv.y += (uRevealSize + uRevealSize / 3.0) * (1.0 - uReveal);
  uv.y /= 1.0 + uRevealSize * (1.0 - uReveal);

  vec4 diffuse = texture(uDiffuse, uv);
  float mask = uUseAlphaTex > 0.5 ? texture(uAlpha, uv).r : diffuse.a;

  // 边缘检测 => 轮廓
  float edge = 0.0;
  if (uOutlineOn > 0.5) {
    float t = uOutlineThickness;
    float m0 = uUseAlphaTex > 0.5 ? texture(uAlpha, uv).r            : texture(uDiffuse, uv).a;
    float mr = uUseAlphaTex > 0.5 ? texture(uAlpha, uv + vec2(t,0)).r : texture(uDiffuse, uv + vec2(t,0)).a;
    float ml = uUseAlphaTex > 0.5 ? texture(uAlpha, uv - vec2(t,0)).r : texture(uDiffuse, uv - vec2(t,0)).a;
    float mu = uUseAlphaTex > 0.5 ? texture(uAlpha, uv + vec2(0,t)).r : texture(uDiffuse, uv + vec2(0,t)).a;
    float md = uUseAlphaTex > 0.5 ? texture(uAlpha, uv - vec2(0,t)).r : texture(uDiffuse, uv - vec2(0,t)).a;
    if (mr != m0 || ml != m0 || mu != m0 || md != m0) edge = 1.0;
  }

  // 假光照：深度梯度当法线
  float h  = texture(uDepth, uv).r;
  float hx = texture(uDepth, uv + vec2(0.002, 0.0)).r;
  float hy = texture(uDepth, uv + vec2(0.0, 0.002)).r;
  vec3 n = normalize(vec3((h - hx) * 60.0, (h - hy) * 60.0, 1.0));
  float lambert = clamp(dot(n, normalize(vec3(0.45, 0.72, 0.55))), 0.0, 1.5);
  vec3 lit = mix(diffuse.rgb, diffuse.rgb * (0.70 + lambert * 0.55), uShade);

  vec3 col = lit;
  float a = mask * uReveal;

  // 轮廓
  col = mix(col, uOutlineColor, edge * 0.9);
  a = max(a, edge * 0.7 * uReveal);

  // 光标影响
  float dist = distance(uMouse * vec2(uAspect, 1.0), uv * vec2(uAspect, 1.0));
  float cursor = smoothstep(uCursorRadius, uCursorRadius * 0.2, dist) * uCursorIntensity;
  col = mix(col, uFg, cursor * mask * 0.35);

  outColor = vec4(col, a);
}`;

export async function createHead(canvas, cfg, assets = {}) {
  const palette = { ink: cfg.portrait?.ink || '#14110d', rim: cfg.portrait?.rim || cfg.colors.foreground };
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return { fallback: true, setMouse() {}, setReveal() {}, destroy() {} };

  let sources;
  try {
    if (assets.diffuse) {
      const [d, dep, al] = await Promise.all([
        loadImage(assets.diffuse),
        assets.depth ? loadImage(assets.depth) : Promise.resolve(null),
        assets.alpha ? loadImage(assets.alpha) : Promise.resolve(null)
      ]);
      const ph = makePlaceholderSet(640, palette);
      sources = { diffuse: d, depth: dep || ph.depth, alpha: al, useAlpha: !!al };
    } else {
      throw new Error('no asset');
    }
  } catch {
    const ph = makePlaceholderSet(640, palette);
    sources = { diffuse: ph.diffuse, depth: ph.depth, alpha: ph.alpha, useAlpha: true };
  }

  const texDiffuse = canvasTexture(gl, sources.diffuse);
  const texDepth = canvasTexture(gl, sources.depth);
  const texAlpha = canvasTexture(gl, sources.alpha || sources.diffuse);

  const SEG = cfg.segments || 96;
  const verts = [];
  for (let y = 0; y <= SEG; y++) for (let x = 0; x <= SEG; x++) verts.push(x / SEG - 0.5, y / SEG - 0.5);
  const idx = [];
  for (let y = 0; y < SEG; y++) for (let x = 0; x < SEG; x++) {
    const a = y * (SEG + 1) + x;
    idx.push(a, a + 1, a + SEG + 1, a + 1, a + SEG + 2, a + SEG + 1);
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const U = n => gl.getUniformLocation(prog, n);
  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    uProj: U('uProj'), uView: U('uView'), uDepth: U('uDepth'), uDiffuse: U('uDiffuse'),
    uAlpha: U('uAlpha'), uUseAlphaTex: U('uUseAlphaTex'), uDisp: U('uDisp'),
    uAspectImg: U('uAspectImg'), uScale: U('uScale'), uAspect: U('uAspect'),
    uReveal: U('uReveal'), uRevealSize: U('uRevealSize'), uMouse: U('uMouse'),
    uCursorRadius: U('uCursorRadius'), uCursorIntensity: U('uCursorIntensity'),
    uFg: U('uFg'), uOutlineColor: U('uOutlineColor'),
    uOutlineThickness: U('uOutlineThickness'), uOutlineOn: U('uOutlineOn'),
    uShade: U('uShade')
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enableVertexAttribArray(loc.aPos);
  gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);

  const hex = h => {
    const v = h.replace('#', '');
    return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
  };

  const state = { mouse: [0, 0], target: [0, 0], reveal: 0, dpr: Math.min(devicePixelRatio || 1, 2) };

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * state.dpr);
    canvas.height = Math.round(h * state.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);

  gl.useProgram(prog);
  gl.uniform1i(loc.uDepth, 0);
  gl.uniform1i(loc.uDiffuse, 1);
  gl.uniform1i(loc.uAlpha, 2);
  gl.uniform1f(loc.uUseAlphaTex, sources.useAlpha ? 1 : 0);
  gl.uniform1f(loc.uDisp, cfg.displacementScale ?? 0.5);
  gl.uniform1f(loc.uRevealSize, cfg.revealSize ?? 0.4);
  gl.uniform1f(loc.uCursorRadius, cfg.cursor?.radius ?? 0.3);
  gl.uniform1f(loc.uCursorIntensity, cfg.cursor?.intensity ?? 0.5);
  gl.uniform3fv(loc.uFg, hex(cfg.colors.foreground));
  gl.uniform3fv(loc.uOutlineColor, hex(cfg.colors.outline));
  gl.uniform1f(loc.uOutlineThickness, cfg.outline?.thickness ?? 0.0015);
  gl.uniform1f(loc.uOutlineOn, cfg.outline?.enabled ? 1 : 0);
  // 位移为 0 时不打假光照，保持原图对比度
  gl.uniform1f(loc.uShade, (cfg.displacementScale ?? 0) > 0.001 ? 1 : 0);

  const imgAspect = sources.diffuse.width / sources.diffuse.height;
  gl.uniform1f(loc.uAspectImg, imgAspect);

  const FOV = Math.PI / 4;
  const DIST = 1.55;
  const viewH = 2 * DIST * Math.tan(FOV / 2);
  gl.uniform1f(loc.uScale, viewH * (cfg.scale ?? 0.78));

  let raf;
  const frame = () => {
    state.mouse[0] += (state.target[0] - state.mouse[0]) * (cfg.cursor?.ease ?? 0.08);
    state.mouse[1] += (state.target[1] - state.mouse[1]) * (cfg.cursor?.ease ?? 0.08);

    const aspect = canvas.width / canvas.height;
    const proj = M4.perspective(FOV, aspect, 0.1, 20);
    const px = (cfg.parallax ?? 0.05) * state.mouse[0];
    const py = (cfg.parallax ?? 0.05) * state.mouse[1];
    const view = M4.lookAt([px, py, DIST], [0, 0, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(loc.uProj, false, proj);
    gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniform1f(loc.uAspect, aspect);
    gl.uniform2fv(loc.uMouse, new Float32Array([state.mouse[0], state.mouse[1]]));
    gl.uniform1f(loc.uReveal, state.reveal);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texDepth);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texDiffuse);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texAlpha);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);

    raf = requestAnimationFrame(frame);
  };
  frame();

  return {
    fallback: false,
    setMouse(nx, ny) { state.target[0] = nx; state.target[1] = ny; },
    setReveal(v) { state.reveal = v; },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
