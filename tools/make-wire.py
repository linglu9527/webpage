"""
make-wire.py — 把「白底黑线」的线框图转成可叠加的 alpha 遮罩

用法：python make-wire.py <源图> <输出 png> [暗线阈值]

输出 RGBA：RGB 全白，A = 线条强度。着色交给 shader。
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
floor = float(sys.argv[3]) if len(sys.argv) > 3 else 0.06

# 源图自带 alpha（透明底），必须先铺白底再算亮度：
# 直接 convert("RGB") 会把透明区变成黑色，被误判成线条。
_src = Image.open(src).convert("RGBA")
_flat = Image.new("RGB", _src.size, (255, 255, 255))
_flat.paste(_src, (0, 0), _src.split()[-1])
im = _flat
if im.size[0] < 1400:
    im = im.resize((int(im.size[0] * 2), int(im.size[1] * 2)), Image.LANCZOS)

arr = np.asarray(im, dtype=np.float32) / 255.0
lum = arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114

# 白底 -> 0，黑线 -> 1
# 关键：源图背景不是纯白（有极淡的横向条纹/渐变），
# 用「暗到一定程度才算线」的硬阈值，再做柔化，避免把背景条纹带进来。
m = 1.0 - lum
line_th = 0.22                     # 只认真正偏暗的像素
m = np.clip((m - line_th) / (1.0 - line_th), 0, 1)
m = m ** 0.65                      # 提亮细线
m = np.clip(m * 1.5, 0, 1)

# 去掉孤立噪点（轻微中值 + 再开方提纯）
mid = Image.fromarray((m * 255).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(3))
m = np.asarray(mid, dtype=np.float32) / 255.0

out = np.zeros((m.shape[0], m.shape[1], 4), dtype=np.uint8)
out[..., 0:3] = 255
out[..., 3] = (m * 255).astype(np.uint8)

img = Image.fromarray(out, "RGBA")

# 裁到线条内容边界：线框图原始留白很大，
# 不裁的话和「头盔彩图」用同一个 w 会导致视觉尺寸对不上。
bbox = img.split()[-1].point(lambda v: 255 if v > 24 else 0).getbbox()
if bbox:
    pad = 6
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.width, x1 + pad), min(img.height, y1 + pad)
    img = img.crop((x0, y0, x1, y1))

img.save(dst, "PNG", optimize=True)
print("wire ->", dst, img.size, "line coverage:", round(float((m > 0.3).mean()), 4))
