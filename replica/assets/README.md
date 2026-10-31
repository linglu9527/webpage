# assets/ — 素材替换目录

把文件放这里，然后在 `js/config.js` 的 `ASSETS` 里写相对路径（如 `assets/portrait.webp`）。
全部留 `null` 时，运行时会自动生成程序化占位图，项目依然可跑。

## 首屏人像（建议 1024×1024，WebP/PNG）

| 文件名（建议） | 用途 | 必需 |
|---|---|---|
| `portrait.webp` | 人像正片，**带透明通道**最佳 | 建议 |
| `portrait-depth.webp` | 深度图，灰度，越亮越靠近镜头 | 建议（否则用程序生成的） |
| `portrait-alpha.webp` | 轮廓遮罩（可选，替代 diffuse 的 alpha） | 否 |
| `portrait-normal.webp` | 法线贴图（本实现未启用） | 否 |

生成深度图的两种做法：

1. **单目深度估计**（MiDaS / DepthAnything / Depth Pro），输入人像，输出灰度图；
2. **手工画**：在 PS/Figma 里用径向渐变铺一层"鼻子最亮、边缘变暗"的灰度图，
   对剪影类头像效果已经够用（`js/head-gl.js` 的占位实现就是这么做的）。

## 社媒封面（建议 4:5，800×1000）

`poster-1.webp` … `poster-6.webp`，然后：

```js
posters: [
  'assets/poster-1.webp', 'assets/poster-2.webp', 'assets/poster-3.webp',
  'assets/poster-4.webp', 'assets/poster-5.webp', 'assets/poster-6.webp'
]
```

## 注意

- 路径相对 `replica/` 根目录，不是相对 `js/`；
- 文件名大小写敏感（部署到 Linux 时）；
- 人像建议先裁掉多余留白，让头部占画幅 60% 以上，浮雕效果更明显。
