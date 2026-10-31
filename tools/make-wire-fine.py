"""
make-wire-fine.py — 保留全部线条（含极细的连接线）

与 make-wire.py 的区别：
  * 阈值放得很低（默认 0.04），淡灰线也算
  * 不用中值滤波（会把 1px 细线整条抹掉），改用 MaxFilter 轻微增粗
  * 用 gamma 提亮细线，让 1px 和 3px 的线看起来同样清楚

用法：python make-wire-fine.py <源图> <输出> [阈值] [增粗像素]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
th = float(sys.argv[3]) if len(sys.argv) > 3 else 0.04
grow = int(sys.argv[4]) if len(sys.argv) > 4 else 3     # 必须是奇数

im = Image.open(src).convert("RGBA")
flat = Image.new("RGB", im.size, (255, 255, 255))
flat.paste(im, (0, 0), im.split()[-1])

lum = np.asarray(flat.convert("L"), dtype=np.float32) / 255.0
m = 1.0 - lum                                   # 白 = 0，黑 = 1

m = np.clip((m - th) / (1.0 - th), 0, 1)
m = m ** 0.55                                    # 提亮，细线不至于消失

img = Image.fromarray((m * 255).astype(np.uint8), "L")
if grow >= 3:
    img = img.filter(ImageFilter.MaxFilter(grow))   # 增粗，保证缩放后仍可见
img = img.filter(ImageFilter.GaussianBlur(0.6))

m = np.asarray(img, dtype=np.float32) / 255.0

out = np.zeros((m.shape[0], m.shape[1], 4), dtype=np.uint8)
out[..., 0:3] = 255
out[..., 3] = (np.clip(m, 0, 1) * 255).astype(np.uint8)

img = Image.fromarray(out, "RGBA")
bbox = img.split()[-1].point(lambda v: 255 if v > 12 else 0).getbbox()
if bbox:
    x0, y0, x1, y1 = bbox
    p = 4
    img = img.crop((max(0, x0 - p), max(0, y0 - p),
                    min(img.width, x1 + p), min(img.height, y1 + p)))

img.save(dst, "PNG", optimize=True)
print("wire-fine ->", dst, img.size, "coverage:", round(float((m > 0.25).mean()), 4))
