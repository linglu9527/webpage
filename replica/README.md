# REA Replica — landonorris.com 滚动流程复刻工程

对 `https://landonorris.com/` 的**整页滚动结构与动效**做的工程复刻。
零外部依赖（不需要 three.js / GSAP / Rive / 框架），打开就能跑。

---

## 一、怎么运行

```bash
# 在仓库根目录
node tools/serve-any.js replica 8766
# 浏览器打开 http://127.0.0.1:8766/
```

> 用 `file://` 直接打开 index.html 不行（ES Module 会被 CORS 拦），必须走本地 HTTP。

页面：

| 文件 | 说明 |
|---|---|
| `index.html` | 首页，完整 9 段滚动流程 |
| `on-track.html` | 数据页（生涯名次 / 分站冠军 / 倒计时） |
| `off-track.html` | 个人向页面（无 WebGL 场景，与原站一致） |
| `calendar.html` | 24 场赛历列表 |

顶部导航这四条互跳，走的是统一的「幕布转场」（对应原站 Taxi.js + `page-transition.riv`）。

---

## 二、目录结构

```
replica/
├─ index.html             ← 页面结构（只写 data-* 声明）
├─ on-track.html
├─ off-track.html
├─ calendar.html
├─ css/
│  └─ main.css            ← 布局 / 主题 / 动画曲线
├─ js/
│  ├─ config.js           ← ★★★ 唯一必须改的文件（替换接口全在这）
│  ├─ scroll.js           ← 平滑滚动 + 逐帧进度广播
│  ├─ head-gl.js          ← 首屏 2.5D 人像（WebGL2，位移 + 描边 + 假光照）
│  └─ main.js             ← 声明式引擎：扫 data-* 建行为
└─ assets/                ← 你自己的素材放这里
```

---

## 三、替换接口（这是你最需要的部分）

### 接口 A：素材 —— `js/config.js` 的 `ASSETS`

```js
export const ASSETS = {
  head: {
    diffuse: 'assets/portrait.webp',        // 人像，建议带透明通道
    depth:   'assets/portrait-depth.webp',  // 深度图（灰度，亮=近）
    alpha:   null,                          // 轮廓遮罩；null = 用 diffuse 的 alpha
    normal:  null                           // 法线；本实现未启用（见「差异」）
  },
  brandMark: null,
  posters: [null, null, null, null, null, null]   // 社媒 6 张封面
};
```

**`null` 就是内置的程序化占位图**（运行时用 Canvas 画一个人像剪影 + 深度场），
所以你什么都不放也能看到效果；放了文件就自动切换。

**深度图从哪来**：如果没有，用任意单目深度估计模型跑一张人像即可（MiDaS / DepthAnything 都行）。
尺寸建议 1024×1024、8bit 灰度、WebP。

| 换什么 | 改哪里 | 效果 |
|---|---|---|
| 首屏人像 | `ASSETS.head.diffuse` | 换人/换姿态 |
| 浮雕起伏 | `ASSETS.head.depth` | 决定脸有多"鼓" |
| 轮廓遮罩 | `ASSETS.head.alpha` | 换抠图边缘 |
| 社媒封面 | `ASSETS.posters[i]` | 6 个卡片底图 |

#### 封面 v2：单画布合成（当前实现）

`js/hero-canvas.js` 用一个 WebGL canvas 按顺序画三层，不再用 DOM 叠图：

| 顺序 | 素材 | 行为 |
|---|---|---|
| 1（底） | `assets/portrait.png` 刀盾狗 | 常显 |
| 2（中） | `assets/helmet-doge.png` 头盔狗 | **只在鼠标附近显现**，半径从 `min` 缓动增长到 `max`（要停留才变大），遮罩是「中间实、边缘虚」 |
| 3（顶） | `assets/helmet-wire.png` 线框 | 常显，带描边光；鼠标处再加一层暖色光 |

参数全在 `theme.json` 的 `HERO`：

```jsonc
"layout": { "base": {"w":0.50,"y":-0.30}, "helmet": {"w":0.24,"y":0.44}, "wire": {"w":0.24,"y":0.44} },
"reveal": { "min": 0.055, "max": 0.30, "ease": 0.025 },
"glow": 0.34, "lightStrength": 0.85, "lightColor": "#b23a1f"
```

- `layout.*.w` 宽度占视口宽比例，`y` 是 NDC 纵向位置（-1 底 / 1 顶）
- `reveal.min/max` 显现半径（按视口高度归一），`ease` 越小长得越慢
- 线框图必须是没有背景条纹的 alpha 遮罩，用 `tools/make-wire.py` 生成

调试：`window.__hero.setPointer(nx, ny, inside, true)` 可立即定位并强制渲染一帧；
`window.__heroCfg` 是运行中的配置对象，改完下一帧生效。

#### 首屏交互：头盔「线描 → 显形」（旧方案，已停用）

结构（`index.html` 的 `.hero__stage`）：

```
.helmet-stage            ← 悬停判定区
├─ .helmet-stage__lines  ← 线描遮罩（用 CSS mask + 主题色上色）
│   └─ .helmet-stage__scan  ← 沿轮廓扫动的引导光带
├─ .helmet-stage__full   ← 完整彩色图（默认 opacity:0）
└─ .helmet-stage__hint   ← HOVER 提示
```

- 静止：只显示线描，一圈强调色的光带沿轮廓上下扫，提示"鼠标放这里"
- 悬停 / 聚焦 / 触屏点击：完整图淡入、线描淡出
- 线描颜色跟主题走（`background: var(--fg)` + mask），换配色不用重做图

生成线描（Sobel 梯度 + 剪影外沿 + 阈值收线）：

```bash
python tools/make-lines.py replica/assets/helmet-doge.png replica/assets/helmet-lines.png 3 0.07
```

调这几个数：线宽（第 3 参数，奇数）、阈值（第 4 参数，越小线越多）。

#### 已接入的两张自有素材

| 文件 | 用途 | 说明 |
|---|---|---|
| `assets/portrait.png` | 首屏主视觉（刀盾狗） | 原始图自带 alpha，未做抠图 |
| `assets/portrait-depth.png` | 首屏深度图 | 由亮度 + 中心偏置生成，目前**未启用**（见下） |
| `assets/helmet-doge.png` | 鼠标跟随图（头盔狗） | 在首屏随指针移动出现 |

**为什么首屏现在是平面的**：这两张是「贴纸型」素材，轮廓是硬边。
用深度位移会在剪影处形成台阶，透视投影后出现重影。
所以 `theme.json` 里设了 `displacementScale: 0` + `outline.enabled: false`。
想要 2.5D，把这两个值改回去（建议 `displacementScale` 0.15~0.25，
并且深度图要用「轮廓处平滑收敛到 0」的版本，`tools/prep-portrait.py` 已经是这么生成的）。

素材处理脚本：`tools/prep-portrait.py`

```bash
python tools/prep-portrait.py <主图> <鼠标图> replica/assets png
```

它做四件事：按 alpha 裁边 → alpha 归一化（清浮尘、边缘提纯）→ 透明区 RGB 用主体颜色外扩（防缩放出黑边）→ 生成深度图。

### 接口 B：文案与数据 —— `js/config.js` 的 `CONTENT`

区块内容全部从这里渲染（不是写死在 HTML 里）：

| 字段 | 对应区块 |
|---|---|
| `hero.*` | 首屏标题 / 副标 / 下一站 / 倒计时 / CTA |
| `marquee.top / bottom` | 跑马灯两行大字 |
| `track.panels[]` | 横向滚动的赛道卡片（编号/名称/长度/文案） |
| `otot.*` | On Track / Off Track 两张入口卡 |
| `helmets.items[]` | 头盔卡（名称/副标/强调色） |
| `exe.*` | Lando EXE 区块 |
| `collabs.items[]` | 联名列表 |
| `socials.items[]` | 社媒卡片 |
| `footer.*` | 页脚大字、声明、链接 |

赛历数据在 `calendar.html` 顶部那个 `RACES` 数组里（24 行，改完即生效）。

### 接口 C：动效参数与配色 —— `js/config.js` 的 `PALETTE` / `MOTION` / `LINKS`

| 想改什么 | 字段 | 说明 |
|---|---|---|
| 全站配色 | `PALETTE.lime` 等 12 个色 | 启动时注入成 CSS 变量 `--c-*` |
| 浮雕强度 | `MOTION.head.displacementScale` | 默认 0.55，调大脸更凸 |
| 人像大小 | `MOTION.head.scale` | 占视口高度比例 |
| 描边粗细/颜色 | `MOTION.head.outline` | 边缘检测采样偏移 |
| 鼠标视差 | `MOTION.head.parallax` | 相机偏移系数 |
| 光标高光 | `MOTION.head.cursor` | 半径 / 强度 / 缓动 |
| 入场展开 | `MOTION.head.revealSize` | UV 纵向拉伸量 |
| 平滑滚动 | `MOTION.scroll.smooth` | 0.05 很顺，0.2 很跟手 |
| 跑马灯速度 | `MOTION.marquee.speed` | 也可在元素上写 `data-marquee-scroll` |
| 导航与跳转 | `LINKS.*` | 站内路径 / 商店 / 四个社媒 |

> 想改单个区块的节奏（比如横向滚多长），改 `css/main.css` 里 `.h-section { height: 320vh }`。

---

### 接口 D：图形与图案 —— `js/graphics.js`

不涉及照片的"图形"都集中在这一个文件，换造型只改这里：

| 导出 | 用在哪 | 怎么改 |
|---|---|---|
| `HELMET` | 首屏头盔 + 头盔卡 | 改 `<path>` / `<ellipse>` 的形状与颜色 |
| `posterSVG(index, opts)` | 社媒/作品封面 | `kind: 0` 半调网点 / `1` 斜线排线 / `2` 同心圆；`invert` 切深底，`label` 换角标 |

颜色全部走 CSS 变量（`var(--fg)` / `var(--c-lime)` / `var(--helmet-visor)`），
所以换 `PALETTE` 时图形会跟着变色，不需要改 SVG。

> 照片类素材（人像、封面图）仍然优先：`ASSETS.posters[i]` 有值时用照片，
> 没有才回退到 `posterSVG` 图案。首屏人像同理，`ASSETS.head.diffuse` 决定用照片还是程序生成的剪影。

**首屏人像的程序化实现**在 `js/head-gl.js` 的 `makePlaceholderSet()`：
半调网点 + 侧向轮廓光 + 颗粒，颜色取 `MOTION.head.portrait.ink` / `rim`
（不写则用 `#14110d` 和 `colors.foreground`）。

---

## 四、页面是怎么被驱动的（对应原站的做法）

原站最值得抄的一点：**页面只声明 `data-*`，运行时统一扫描建行为**。
这套复刻保留了同一个模型：

| 契约 | 作用 |
|---|---|
| `data-gl="head"` | 初始化 WebGL 人像层 |
| `data-sticky-hero` | 标记吸顶区（钉住交给 CSS `position: sticky`） |
| `data-horizontal-section` + `data-horizontal-track` | 竖向滚动转横向位移 |
| `data-marquee-scroll="0.12"` | 跑马灯滚动速度 |
| `data-section-theme="lime\|dark\|white"` | 进入该区切换整站主题 |
| `data-reveal` | 进入视口播放入场 |
| `data-split` | 逐字入场 |
| `data-parallax="0.12"` | 视差位移 |
| `data-helmet-reveal` | 弧形自下而上揭幕 |
| `data-countdown="ISO"` | 倒计时 |

新增一个区块 = 写 HTML + 加一个 `data-*`，通常不用碰 JS。

---

## 五、与原站的真实差异（别当等价物）

| 项 | 原站 | 本复刻 |
|---|---|---|
| 3D 头盔 | Draco GLB + PBR + HDRI 环境光 | **SVG 图层**（同样的揭幕时机，但不是真模型） |
| 合成方式 | 渲染到离屏 target → 全屏 shader 二次合成 | 单 Pass 直出，背景透明交给 CSS |
| 光标拖尾 | 画笔式累积遮罩（`tCursorEffect` 渲染目标） | 半径衰减近似 |
| 遮罩轮廓 | simplex 噪声场实时生成，边缘会"抖" | 静态遮罩边缘检测，边缘不抖 |
| 转场 duotone | 灰度 + 硬光 + `uFilter` 混合 | 幕布缩放转场 |
| Rive 动效 | 8 个 `.riv` 状态机、滚动驱动 | 未接入（可用 `@rive-app/canvas` 替换占位层） |
| 3D 文字跑马灯 | MSDF 字体 + Three.js | DOM 文字 + 滚动位移 |
| 赛道 3D | `tracks-06.glb` + 顶点匹配 | 卡片式横向列表 |

**保真度结论**：滚动流程、区块顺序、主题切换时机、动效分工是忠实复刻；
3D 资产与 Rive 层是"同位置、同交互、低配实现"。

---

## 六、想进一步提保真度，按优先级补

1. **接 three.js**：把 `head-gl.js` 里的头盔层换成真 GLB（`GLTFLoader` + `DRACOLoader`），
   原站资产是 `helmet-21.glb` / `disco-02.glb`。
2. **接 Rive**：`@rive-app/canvas` + 原站 `.riv` 文件，把 `data-rive-*` 契约补回 `main.js`。
3. **真噪声遮罩**：把 `makePlaceholderSet()` 的 alpha 换成 simplex 噪声实时生成，边缘就会"呼吸"。
4. **光标拖尾渲染目标**：单独一张 FBO 累积笔画，替代半径近似。
