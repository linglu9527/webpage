"""
make-wire-3d.py — 从成品图计算「3D 建模线框」风格图

思路：
  1. 取剪影 mask
  2. 用亮度做伪高度场 h，再求梯度
  3. 网格点按 -grad(h) 偏移 → 网格线自然随形体弯曲，像 3D 网格贴合曲面
  4. 画三角网格（放射对角线） + 内部结构边线（Sobel） + 剪影
  5. 全部裁在剪影内，细而锐利

输出：RGBA，白色线条 + alpha（着色交给 shader 的 uFlowColor）
"""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw


def load(src):
    im = Image.open(src).convert("RGBA")
    arr = np.asarray(im)
    mask = arr[:, :, 3] > 100
    flat = Image.new("RGB", im.size, (255, 255, 255))
    flat.paste(im, (0, 0), im.split()[-1])
    return flat, mask


def main():
    src, dst = sys.argv[1], sys.argv[2]
    step = int(sys.argv[3]) if len(sys.argv) > 3 else 15
    warp_strength = float(sys.argv[4]) if len(sys.argv) > 4 else 9.0

    flat, mask = load(src)
    w, h = flat.size
    lum = np.asarray(flat.convert("L").filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) / 255.0

    # ---- 伪高度场：亮 = 近 ----
    height = np.asarray(
        flat.convert("L").filter(ImageFilter.GaussianBlur(14)), dtype=np.float32
    ) / 255.0
    gy, gx = np.gradient(height)

    # ---- 网格点 ----
    xs = np.arange(0, w + step, step)
    ys = np.arange(0, h + step, step)
    pts = {}
    for yi, y in enumerate(ys):
        for xi, x in enumerate(xs):
            cx, cy = int(min(x, w - 1)), int(min(y, h - 1))
            if not mask[cy, cx]:
                pts[(xi, yi)] = None
                continue
            s = warp_strength
            pts[(xi, yi)] = (x + gx[cy, cx] * s, y + gy[cy, cx] * s)

    # ---- 画 ----
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)

    def link(a, b):
        pa, pb = pts.get(a), pts.get(b)
        if pa and pb:
            d.line([pa, pb], fill=210, width=1)

    for yi in range(len(ys)):
        for xi in range(len(xs)):
            link((xi, yi), (xi + 1, yi))
            link((xi, yi), (xi, yi + 1))
            if (xi + yi) % 2 == 0:
                link((xi, yi), (xi + 1, yi + 1))
            else:
                link((xi + 1, yi), (xi, yi + 1))

    mesh = np.asarray(layer, dtype=np.float32) / 255.0

    # ---- 内部结构边线（Sobel） ----
    blurred = np.asarray(
        flat.convert("L").filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32
    ) / 255.0
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = kx.T
    ox = np.zeros_like(blurred)
    oy = np.zeros_like(blurred)
    pad = np.pad(blurred, 1, mode="edge")
    for j in range(3):
        for i in range(3):
            sh = pad[j:j + h, i:i + w]
            ox += sh * kx[j, i]
            oy += sh * ky[j, i]
    mag = np.sqrt(ox ** 2 + oy ** 2)
    mag = mag / (mag.max() + 1e-6)
    detail = np.clip((mag - 0.06) / 0.5, 0, 1) ** 0.8

    # ---- 剪影外沿 ----
    m = mask.astype(np.uint8)
    er = np.asarray(
        Image.fromarray(m * 255).filter(ImageFilter.MinFilter(3)), dtype=np.uint8
    ) > 127
    outline = (mask & ~er).astype(np.float32)

    # ---- 合成 ----
    alpha = np.clip(mesh * 0.62 + detail * 0.95 + outline * 1.0, 0, 1)

    # 只保留剪影内部（向外扩一点，保住外轮廓线）
    dil = np.asarray(
        Image.fromarray(m * 255).filter(ImageFilter.MaxFilter(3)), dtype=np.uint8
    ) > 127
    alpha = alpha * dil

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0:3] = 255
    out[..., 3] = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)

    img = Image.fromarray(out, "RGBA")
    # 裁到内容
    bbox = img.split()[-1].point(lambda v: 255 if v > 10 else 0).getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        pad2 = 4
        img = img.crop((max(0, x0 - pad2), max(0, y0 - pad2), min(w, x1 + pad2), min(h, y1 + pad2)))

    img.save(dst, "PNG", optimize=True)
    print("wire3d ->", dst, img.size, "coverage:", round(float((alpha > 0.25).mean()), 4))


if __name__ == "__main__":
    main()
