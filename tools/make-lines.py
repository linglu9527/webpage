"""
make-lines.py — 从成品图生成「线描」遮罩

用法：
  python make-lines.py <源图> <输出 png> [线宽] [阈值]

输出为 RGBA：线条为纯白、其余透明。
这样在 CSS 里可以直接当 mask 用，线条颜色由主题控制：

  .helmet-lines {
    background: var(--fg);
    mask-image: url(assets/helmet-lines.png);
    mask-size: contain; mask-repeat: no-repeat; mask-position: center;
  }
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def sobel(g: np.ndarray):
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = kx.T
    out = np.zeros_like(g, dtype=np.float32)
    for ky_i in range(3):
        for kx_i in range(3):
            shifted = np.roll(np.roll(g, ky_i - 1, axis=0), kx_i - 1, axis=1)
            out += shifted * kx[ky_i, kx_i]
    ox = np.zeros_like(g, dtype=np.float32)
    oy = np.zeros_like(g, dtype=np.float32)
    for ky_i in range(3):
        for kx_i in range(3):
            shifted = np.roll(np.roll(g, ky_i - 1, axis=0), kx_i - 1, axis=1)
            ox += shifted * kx[ky_i, kx_i]
            oy += shifted * ky[ky_i, kx_i]
    return np.sqrt(ox ** 2 + oy ** 2)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    thickness = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    thresh = float(sys.argv[4]) if len(sys.argv) > 4 else 0.10

    img = Image.open(src).convert("RGBA")
    alpha = np.asarray(img.split()[-1], dtype=np.float32) / 255.0

    # 在「去掉背景」的图上算梯度：背景填成主体平均色，避免边缘产生假强边
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    inside = alpha > 0.5
    if inside.any():
        mean = rgb[inside].mean(axis=0)
    else:
        mean = np.array([1, 1, 1], dtype=np.float32)
    rgb = np.where(inside[..., None], rgb, mean)

    # 感知亮度
    lum = rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114

    # 先轻微模糊，压掉噪点
    lum_img = Image.fromarray((lum * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.3))
    lum = np.asarray(lum_img, dtype=np.float32) / 255.0

    mag = sobel(lum)
    mag = mag / (mag.max() + 1e-6)

    # 轮廓外沿也算线
    a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.0))
    a_arr = np.asarray(a_img, dtype=np.float32) / 255.0
    edge_alpha = np.abs(a_arr - np.roll(a_arr, 1, axis=0)) + np.abs(a_arr - np.roll(a_arr, 1, axis=1))
    mag = np.maximum(mag, np.clip(edge_alpha * 5.0, 0, 0.85))

    # 阈值 + 伽马 + 提亮（线描需要比原始梯度更"硬"）
    m = np.clip((mag - thresh) / (1.0 - thresh), 0, 1) ** 0.5
    m = np.clip(m * 2.0, 0, 1)

    # 明确的剪影轮廓：从 alpha 取边界并加粗，保证外形完整闭合
    a_bin = (np.asarray(img.split()[-1], dtype=np.float32) / 255.0) > 0.45
    inner = a_bin.copy()
    shape_edge = np.zeros_like(a_bin)
    pad = np.pad(a_bin, 1, mode="edge")
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            shifted = pad[1 + dy:1 + dy + a_bin.shape[0], 1 + dx:1 + dx + a_bin.shape[1]]
            shape_edge |= (inner & ~shifted)
    se_img = Image.fromarray((shape_edge * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(3))
    shape_edge = np.asarray(se_img, dtype=np.float32) / 255.0
    m = np.maximum(m, shape_edge)

    # 加粗：先膨胀再收缩回去，让线条更实
    m_img = Image.fromarray((m * 255).astype(np.uint8), "L")
    m_img = m_img.filter(ImageFilter.MaxFilter(thickness | 1))
    m_img = m_img.filter(ImageFilter.GaussianBlur(0.6))
    m = np.asarray(m_img, dtype=np.float32) / 255.0

    # 去掉整片的淡填充：只保留真正的线（否则会形成一层"方框"般的雾）
    m = np.clip((m - 0.22) / 0.78, 0, 1)

    out = np.zeros((m.shape[0], m.shape[1], 4), dtype=np.uint8)
    out[..., 0:3] = 255
    out[..., 3] = np.clip(m * 255, 0, 255).astype(np.uint8)

    Image.fromarray(out, "RGBA").save(dst, "PNG", optimize=True)
    print("lines ->", dst, "coverage:", round(float((m > 0.25).mean()), 4))


if __name__ == "__main__":
    main()
