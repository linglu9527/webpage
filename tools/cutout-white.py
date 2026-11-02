"""
cutout-white.py — 白底照片抠成透明 PNG（全分辨率、无块状边缘）

之前的版本把掩膜降采样 1/4 再 NEAREST 放大，轮廓会留下 4px 的白色方块。
现在改成：
  1. 全分辨率连通域泛洪（只认与画面边界相连的白色）
  2. alpha 向内收 1px，去掉轮廓上的白边
  3. 对半透明像素做「去白」还原：rgb' = (rgb - (1-a)*255) / a
     这样边缘残留的白色不会在深色背景上显出来

用法: python cutout-white.py <源图> <输出> [白阈值 0-255] [内收像素]
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 246
shrink = int(sys.argv[4]) if len(sys.argv) > 4 else 1
pad = 8

im = Image.open(src).convert("RGBA")
flat = Image.new("RGB", im.size, (255, 255, 255))
flat.paste(im, (0, 0), im.split()[-1])
w, h = flat.size

rgb = np.asarray(flat, dtype=np.float32)
gray = np.asarray(flat.convert("L"))

white = (gray >= th)
print("近白像素 %.3f" % float(white.mean()))

# ---- 全分辨率泛洪：只把与边界连通的白色算背景 ----
bg = np.zeros((h, w), dtype=bool)
q = deque()

def push(y, x):
    if 0 <= y < h and 0 <= x < w and white[y, x] and not bg[y, x]:
        bg[y, x] = True
        q.append((y, x))

for x in range(w):
    push(0, x)
    push(h - 1, x)
for y in range(h):
    push(y, 0)
    push(y, w - 1)

while q:
    y, x = q.popleft()
    push(y - 1, x)
    push(y + 1, x)
    push(y, x - 1)
    push(y, x + 1)

print("背景占比 %.3f" % float(bg.mean()))

# ---- alpha：背景 0，主体 1；再向内收一点去掉白边 ----
alpha = np.where(bg, 0, 255).astype(np.uint8)
a_img = Image.fromarray(alpha, "L")
if shrink > 0:
    a_img = a_img.filter(ImageFilter.MinFilter(shrink * 2 + 1))   # 内收
a_img = a_img.filter(ImageFilter.GaussianBlur(0.6))               # 轻微羽化
a = np.asarray(a_img, dtype=np.float32) / 255.0

# ---- 去白：半透明像素把混入的白色减掉 ----
safe = np.maximum(a, 1e-3)[..., None]
rgb_fixed = (rgb - (1.0 - a)[..., None] * 255.0) / safe
rgb_fixed = np.clip(rgb_fixed, 0, 255)

out = np.zeros((h, w, 4), dtype=np.uint8)
out[..., 0:3] = rgb_fixed.astype(np.uint8)
out[..., 3] = (a * 255).astype(np.uint8)

img = Image.fromarray(out, "RGBA")
bbox = img.split()[-1].point(lambda v: 255 if v > 10 else 0).getbbox()
if bbox:
    x0, y0, x1, y1 = bbox
    img = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))

img.save(dst, "PNG", optimize=True)
print("cutout ->", dst, img.size, "aspect=%.3f" % (img.width / img.height),
      "coverage=%.3f" % float((a > 0.5).mean()))
