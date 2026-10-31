# 设计交接说明 — 你怎么给我设计稿

结论先说：**不需要 Adobe Illustrator 源文件，也不要只给一张 JPG。**
最好的方式是「分三层给」——视觉方向用图，素材用矢量/透明图，规范用文字。

---

## 一、格式对照：什么能干什么不能干

| 你手上的东西 | 我能用它做什么 | 建议 |
|---|---|---|
| **JPG / PNG 截图**（Figma、AI、PS、网页截图都行） | 看懂风格、布局意图、层级关系 | ✅ 一定给，但它是「方向参考」，我会重写 CSS 而不是像素描摹 |
| **Adobe Illustrator → 导出 SVG** | logo、图标、插画、装饰图形**精确还原** | ✅✅ 最该给的东西 |
| **Figma 链接** | 我只能看导出的静态图；读不到 Figma 文件内部（无授权） | ⚠️ 附上「导出 PNG@2x + SVG」更稳 |
| **PSD / .ai / .sketch / .fig 源文件** | **打不开**（本机没有 Adobe/Sketch） | ❌ 别发，白费 |
| **PDF**（矢量排版稿） | 能读文字与大概位置，但图层信息丢失 | ⚠️ 不如 SVG |
| **照片 / 人像 / 产品图** | 直接用 | ✅ PNG 或 WebP，**带透明通道** |
| **颜色 / 字体 / 间距规范** | 直接落地成 CSS 变量 | ✅ 一行文字或一个 JSON 就够 |

### 从 Illustrator 导出时的两个注意点

1. **文字转曲**（创建轮廓），或同时告诉我字体名 + 字重；
   否则我拿到的 SVG 会缺字形。
2. 导出设置选 **「演示属性」**（Presentation Attributes），不要用「样式元素」，
   否则生成一堆 `<style>` 类名，不好维护。

---

## 二、这个项目已经开好「不用改代码」的通道

新增了 `theme.json`：**复制 `theme.example.json` 为 `theme.json`，改里面的值就生效**，
不用碰任何 JS/CSS。

### 已出的三个方向（可直接切换对比）

| 文件 | 方向 | 特征 |
|---|---|---|
| `theme.d1-editorial.json` | **D1 EDITORIAL** | 纸白底 + Playfair 衬线大标 + 锈红点缀，杂志排版感 |
| `theme.d2-terminal.json` | **D2 TERMINAL** | 近黑底 + 酸性绿描边 + 等宽字体，技术/示波器感 |
| `theme.d3-boldpop.json` | **D3 BOLD POP** | 米白底 + Archivo Black 超粗 + 荧光粉，海报感 |

切换方式（一次一个）：

```bash
copy theme.d1-editorial.json theme.json    # 或 d2 / d3
```

对应截图：`assets/preview-d1-editorial.png`、`preview-d2-terminal.png`、`preview-d3-boldpop.png`。

> 三个方向都是在**同一套结构**上换皮，所以切换零成本、不会推倒重来。
> `SECTIONS` 字段可以逐段指定明暗（`hero` / `marquee` / `track` / `otot` / `helmets` /
> `exe` / `collabs` / `socials` / `footer` 各填 `lime` / `dark` / `white`）。

```bash
# 在 replica/ 目录
cp theme.example.json theme.json      # Windows: copy theme.example.json theme.json
# 刷新页面即可
```

它覆盖四类东西：

```jsonc
{
  "FONTS":   { "display": "...", "body": "...", "googleHref": "..." },
  "RADIUS":  "6px",
  "PALETTE": { "lime": "#ff5a1f", "darkGreen": "#0e1220", "white": "#f7f7f5", ... },
  "ASSETS":  { "head": { "diffuse": "assets/portrait.webp", "depth": "..." },
               "posters": ["assets/poster-1.webp", ...] },
  "CONTENT": { "brand": "ACME", "hero": { "line1": "NOVA", ... }, ... },
  "LINKS":   { "store": "...", "onTrack": "..." }
}
```

只写你想改的字段，没写的沿用默认。

**已实测**：把 `PALETTE` 换成橙/藏青、`CONTENT` 全换、`FONTS` 换 Google 字体后，
整站立刻变成另一个品牌（截图见 `assets/preview-theme-swap.png`）。
素材路径写错也不会崩，会自动回退到内置占位图。

---

## 二·补、图形（图案）怎么换

跟"照片素材"分开：**图形走代码，照片走文件。**

| 想换什么 | 改哪里 |
|---|---|
| 头盔造型 | `js/graphics.js` 里的 `HELMET`（改 path/ellipse） |
| 封面图案（网点/排线/同心圆） | `js/graphics.js` 的 `posterSVG()` |
| 首屏剪影的网点/轮廓光 | `js/head-gl.js` 的 `makePlaceholderSet()`，颜色在 `MOTION.head.portrait` |
| 主题色（图形会跟着变） | `theme.json` 的 `PALETTE` |

图形全部用 CSS 变量上色，所以**换配色不用改 SVG**。
你给 SVG 我直接替换 `HELMET`；给导出图我会按构图重画成矢量。

---

## 三、我的建议：最小可开工包

你不需要一次给全。**只要这三样我就能开始做第一版界面**：

1. **一张 JPG**：首屏 + 一个内容区的样子（有移动端更好）
2. **5 个颜色**：主色、背景深色、背景浅色、强调色、文字色（hex）
3. **1–2 个字体名**：标题字体 + 正文字体（有就用，没有我推荐）

然后补：

4. **logo SVG**（没有就先给品牌名，我用文字排版）
5. **文案**：纯文本或 Excel/CSV 都行，按区块列
6. **素材图**：人像/产品图（PNG 带透明）、社媒封面 6 张

---

## 四、两种合作方式，你选一种

### 方式 A：你出稿，我实现
你给我上面那份包，我把 `theme.json` + 素材 + 布局细节调到接近你的稿子。
适合：已经有明确设计稿 / 有品牌规范。

### 方式 B：我出方向，你挑
你只给品牌名 + 3–5 个词（比如「冷、硬、贵、极简」）+ 必须保留的内容，
我先做 2–3 个视觉方向（配色/字体/版式不一样），你挑一个再深做。
适合：还没定视觉，想先看可能性。

> 我在方式 B 里只改 `theme.json` 和少量 CSS，不动结构 ——
> 所以切换方向的成本很低，不会推倒重来。

---

## 五、哪些地方值得你重点决策

不是所有区块都同等重要。按投入产出排序：

1. **首屏那张人像** —— 决定气质。是真人照片、产品图、还是纯图形？
   这决定要不要深度图（`assets/portrait-depth.webp`）。
2. **主色 + 深底色的关系** —— 现在这套是「荧光绿 on 暖白 / 深绿」，
   换成任何双色组合，全站观感立刻变。
3. **大标题字体** —— 现在是无衬线紧凑字。换衬线会立刻变「编辑感」，换等宽会变「技术感」。
4. **跑马灯两句话** —— 这是全站唯一的「口号」，字数最好控制在 12–20 字符。
5. 其余区块（横向卡、联名列表、社媒）都是模板化的，换文案就够。

---

## 六、我需要你确认的事

- 是**换品牌做自己的站**，还是**保留 Lando 的框架只改内容**？
- 有没有现成的 **logo 矢量**和**品牌色**？
- 首屏那张主视觉，你打算用**照片**还是**图形**？（决定要不要深度图）
- 要不要**移动端稿**？（现在布局是响应式的，但移动端版式没专门设计过）
