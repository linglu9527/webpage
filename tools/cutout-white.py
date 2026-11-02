"""
cutout-white.py — 白底照片抠成透明 PNG（保留浅色毛发）

做法：把"接近白"的区域降采样后从边界做连通域泛洪，只有与边界连通的白色才算背景，
      所以狗身上被包围的浅色毛发不会被误当背景。

用法: python cutout-white.py <源图> <输出> [白阈值 0-255] [裁剪边距]
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 244
pad = int(sys.argv[4]) if len(sys.argv) > 4 else 8
DOWN = 4

im = Image.open(src).convert("RGBA")
flat = Image.new("RGB", im.size, (255, 255, 255))
flat.paste(im, (0, 0), im.split()[-1])
w, h = flat.size

g = np.asarray(flat.convert("L"))
white = g >= th

# ---- 降采样后从边界泛洪 ----
sw, sh = w // DOWN, h // DOWN
small = white[: sh * DOWN, : sw * DOWN].reshape(sh, DOWN, sw, DOWN).max(axis=(1, 3))

bg = np.zeros((sh, sw), dtype=bool)
q = deque()
for x in range(sw):
    for y in (0, sh - 1):
        if small[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
for y in range(sh):
    for x in (0, sw - 1):
        if small[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))

while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < sh and 0 <= nx < sw and small[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))

print("background ratio: %.3f" % float(bg.mean()))

# ---- 升回原尺寸 + 羽化 ----
bg_img = Image.fromarray((bg * 255).astype(np.uint8), "L").resize((w, h), Image.NEAREST)
bg_img = bg_img.filter(ImageFilter.MaxFilter(3))          # 稍微咬一点边，去掉白边
alpha_img = Image.fromarray((255 - np.asarray(bg_img)).astype(np.uint8), "L")
alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(1.0))
alpha = np.asarray(alpha_img, dtype=np.float32) / 255.0

# 主体内部强制不透明
inner = bg_img.filter(ImageFilter.MinFilter(11))
keep = 1.0 - np.asarray(inner, dtype=np.float32) / 255.0
alpha = np.clip(np.maximum(alpha, keep), 0, 1)

out = np.zeros((h, w, 4), dtype=np.uint8)
out[..., 0:3] = np.asarray(flat)
out[..., 3] = (alpha * 255).astype(np.uint8)

img = Image.fromarray(out, "RGBA")
bbox = img.split()[-1].point(lambda v: 255 if v > 12 else 0).getbbox()
if bbox:
    x0, y0, x1, y1 = bbox
    img = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))

img.save(dst, "PNG", optimize=True)
print("cutout ->", dst, img.size, "aspect=%.3f" % (img.width / img.height),
      "coverage=%.3f" % float((alpha > 0.5).mean()))
