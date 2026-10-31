"""
prep-portrait.py — 素材处理（透明图 → 网页可用资产 + 深度图）

用法：
  python prep-portrait.py <主图> <鼠标图> <输出目录> [png|webp]

关键事实：用户给的图**本来就有 alpha 通道**，所以不做抠图，只做：
  1. 按 alpha 裁边
  2. alpha 归一化（清掉 <8 的浮尘、给边缘轻微提纯，避免半透明发灰）
  3. 全透明像素的 RGB 用主体颜色外扩填充（防止缩放后出现黑边）
  4. 从亮度 + 中心偏置生成深度图
"""
import sys
from PIL import Image, ImageFilter
import numpy as np


def normalize_alpha(img: Image.Image, floor: int = 46) -> Image.Image:
    # 源图在主体外有一圈很淡的半透明（alpha 10~50），会形成"光晕矩形"。
    # 提高底线并使用更陡的曲线把它压掉。
    a = np.asarray(img.split()[-1], dtype=np.uint8).astype(np.float32) / 255.0
    a = np.clip((a - floor / 255.0) / (1.0 - floor / 255.0), 0, 1)
    a = a ** 1.15
    a_img = Image.fromarray((a * 255).astype(np.uint8), "L")
    return a_img


def bleed_rgb(rgba: Image.Image, alpha: Image.Image) -> Image.Image:
    rgb = rgba.convert("RGB")
    bleed = rgb.filter(ImageFilter.GaussianBlur(14))
    arr = np.asarray(rgb).copy()
    keep = (np.asarray(alpha) > 8)[..., None]
    arr = np.where(keep, arr, np.asarray(bleed)).astype(np.uint8)
    out = Image.fromarray(arr, "RGB").convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.split()[-1].getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.width, x1 + pad), min(img.height, y1 + pad)
    return img.crop((x0, y0, x1, y1))


def fit(img: Image.Image, longest: int) -> Image.Image:
    w, h = img.size
    s = longest / max(w, h)
    if s >= 1:
        return img
    # 用 LANCZOS 前先放大 alpha 的对比，减少缩放导致的模糊边
    return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def make_depth(rgba: Image.Image) -> Image.Image:
    lum = rgba.convert("RGB").convert("L").filter(ImageFilter.GaussianBlur(22))
    w, h = lum.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w * 0.5, h * 0.48
    r = np.sqrt(((xx - cx) / (w * 0.58)) ** 2 + ((yy - cy) / (h * 0.58)) ** 2)
    falloff = np.clip(1.0 - r, 0, 1) ** 0.7

    base = np.asarray(lum, dtype=np.float32) / 255.0
    base = 0.30 + base * 0.70
    depth = np.clip(base * (0.40 + falloff * 0.80), 0, 1)

    # 关键：用「模糊后的 alpha」当遮罩，让位移在轮廓处平滑收敛到 0。
    # 直接用硬边 alpha 会在剪影处形成台阶，透视投影后出现重影。
    a_img = rgba.split()[-1].filter(ImageFilter.GaussianBlur(26))
    a = np.asarray(a_img, dtype=np.float32) / 255.0
    a = np.clip((a - 0.12) / 0.88, 0, 1) ** 0.9
    depth = depth * a
    d = Image.fromarray((depth * 255).astype(np.uint8), "L")
    return d.filter(ImageFilter.GaussianBlur(16)).convert("RGB")


def save(img: Image.Image, base: str, fmt: str) -> str:
    if fmt == "webp":
        path = base + ".webp"
        img.save(path, "WEBP", quality=92, method=6, exact=True)
    else:
        path = base + ".png"
        img.save(path, "PNG", optimize=True)
    return path


def process(path: str, longest: int) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    alpha = normalize_alpha(src)
    src = bleed_rgb(src, alpha)
    src = trim(src)
    return fit(src, longest)


def main():
    src_main, src_cursor, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    fmt = sys.argv[4] if len(sys.argv) > 4 else "png"

    m = process(src_main, 1100)
    print("portrait ->", save(m, out_dir + "/portrait", fmt), m.size)
    print("depth    ->", save(make_depth(m), out_dir + "/portrait-depth", fmt))
    c = process(src_cursor, 900)
    print("cursor   ->", save(c, out_dir + "/helmet-doge", fmt), c.size)


if __name__ == "__main__":
    main()
