# 项目四-rea — 封面复刻工程

对 `landonorris.com` 首页封面的**结构与动效复刻**，以及配套的素材处理工具链。

纯 HTML / CSS / 原生 JavaScript（WebGL2），**零外部依赖**，不需要构建步骤。

## 运行

```bash
node tools/serve-any.js replica 8766
# 打开 http://127.0.0.1:8766/
```

> 必须走本地 HTTP，直接双击 `index.html`（`file://`）会因为 ES Module 的 CORS 限制无法运行。

## 封面由什么组成

一个 WebGL canvas 里叠三层，外加四角文案：

| 层 | 素材 | 行为 |
|---|---|---|
| 1（底） | `replica/assets/portrait.png` 刀盾狗 | 常显 |
| 2（中） | `replica/assets/helmet-doge.png` 头盔彩图 | 鼠标靠近处渐显，遮罩「中间实、边缘虚」，半径随停留增长 |
| 3（顶） | `replica/assets/helmet-wire.png` 3D 线框 | 自上而下扫描，淡入—实—淡出；鼠标靠近退场 |

全部在 `replica/js/hero-canvas.js` 里用三次 draw call 画在同一个 canvas 上。

## 对齐工具

```text
http://127.0.0.1:8766/align.html
```

拖动 / 滚轮 / 方向键调整头盔层与线框层的位置与缩放，可单独调两者的透明度（方便用狗眼睛对位），
「应用到主页」会把布局存进 localStorage。

## 工具链

| 脚本 | 用途 |
|---|---|
| `tools/prep-portrait.py` | 透明图裁边、alpha 归一化、边缘色溢修复、生成深度图 |
| `tools/make-wire-fine.py` | 白底线稿 → 可叠加的 alpha 遮罩（保留最细线条） |
| `tools/make-wire-3d.py` | 从成品图计算 3D 网格线框（三角网格 + 结构线 + 剪影） |
| `tools/make-lines.py` | Sobel 边缘 → 线描遮罩 |
| `tools/serve-any.js` | 静态服务器 |

## 目录

```
replica/
├─ index.html          首页（封面 + 后续区块）
├─ align.html          图层对齐工具
├─ theme.json          当前主题与封面参数
├─ theme.d1/d2/d3.json 三套配色方向
├─ js/
│  ├─ config.js        配置默认值
│  ├─ hero-canvas.js   封面单画布合成（三层 + 流扫描）
│  ├─ scroll.js        平滑滚动
│  ├─ main.js          声明式 data-* 引擎
│  └─ graphics.js      头盔 SVG / 封面图案生成
├─ css/main.css
└─ assets/             素材
tools/                 素材处理脚本
```

详细参数说明见 [`replica/README.md`](replica/README.md)。

## 说明

- 封面素材为自有图片；页面其余区块（跑马灯、横向赛道、联名等）为结构复刻示例。
- `target/`（本地调试产物与第三方 JS）不纳入版本库。
