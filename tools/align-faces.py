"""
align-faces.py — 用「同一只狗的脸」在两张图之间做模板匹配，
算出把头盔图对齐到裸头图所需的 缩放/偏移。

用法： python align-faces.py <裸头图> <头盔图> <线框图>

输出：可写进 theme.json HERO.layout 的 helmet/wire 建议值
"""
import sys
import numpy as np
from PIL import Image


def load_gray(path, target_w=260):
    im = Image.open(path).convert("RGBA")
    flat = Image.new("RGB", im.size, (255, 255, 255))
    flat.paste(im, (0, 0), im.split()[-1])
    g = flat.convert("L")
    scale = target_w / g.width
    g = g.resize((target_w, max(1, round(g.height * scale))), Image.LANCZOS)
    return np.asarray(g, dtype=np.float32), scale, flat.size


def ncc(a, b):
    a = a - a.mean()
    b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d else -1.0


def main():
    base_path, helm_path, wire_path = sys.argv[1], sys.argv[2], sys.argv[3]

    base, _, base_orig = load_gray(base_path)
    helm, helm_scale, helm_orig = load_gray(helm_path)

    # 头盔图里「狗脸」所在的相对区域（面罩开口内，避开护目镜）
    hx0, hx1 = 0.28, 0.72
    hy0, hy1 = 0.42, 0.70
    py0, py1 = int(helm.shape[0] * hy0), int(helm.shape[0] * hy1)
    px0, px1 = int(helm.shape[1] * hx0), int(helm.shape[1] * hx1)
    patch = helm[py0:py1, px0:px1]

    best = (-2, None)
    for scale in np.arange(0.45, 1.65, 0.05):
        pw = max(8, int(patch.shape[1] * scale))
        ph = max(8, int(patch.shape[0] * scale))
        p = np.asarray(Image.fromarray(patch).resize((pw, ph), Image.LANCZOS), dtype=np.float32)
        if ph >= base.shape[0] or pw >= base.shape[1]:
            continue
        step = 2
        for y in range(0, base.shape[0] - ph, step):
            for x in range(0, base.shape[1] - pw, step):
                win = base[y:y + ph, x:x + pw]
                s = ncc(win, p)
                if s > best[0]:
                    best = (s, (scale, x, y, pw, ph))

    score, (scale, x, y, pw, ph) = best
    print(f"best NCC={score:.3f}  patch-scale={scale:.2f}  at ({x},{y}) size {pw}x{ph}")

    # ---- 换算成 layout ----
    # 基准图在页面上：宽占比 BW、中心 y = BY（NDC）
    BW, BY = 0.62, -0.10
    CW, CH = 1186.0, 778.0

    base_w_px = BW * CW
    base_h_px = base_w_px * (base_orig[1] / base_orig[0])
    base_cy = (1 - BY) / 2 * CH

    # 补丁在 base 中的位置（缩略图坐标 -> 原图归一）
    gx = x / base.shape[1]
    gy = y / base.shape[0]
    gw = pw / base.shape[1]
    gh = ph / base.shape[0]

    # 补丁在屏幕上应落到的位置
    px_screen = CW / 2 + (gx + gw / 2 - 0.5) * base_w_px
    py_screen = base_cy - base_h_px / 2 + (gy + gh / 2) * base_h_px
    p_w_screen = gw * base_w_px

    # 头盔图里该补丁占整图的比例
    patch_frac_w = (hx1 - hx0)
    helm_w_px = p_w_screen / patch_frac_w

    helm_w = helm_w_px / CW
    helm_y = 1 - 2 * py_screen / CH

    print(f"helmet layout  w={helm_w:.3f}  y={helm_y:.3f}   (patch center screen x={px_screen:.0f}, y={py_screen:.0f})")

    # 线框图：把线框内容缩放到与头盔图同宽
    wire = Image.open(wire_path)
    print(f"wire aspect={wire.width / wire.height:.3f}  helmet aspect={helm_orig[0] / helm_orig[1]:.3f}")
    print(f"若两者均为内容裁边，wire 用同一组 w/y 即可；否则 wire.w = {helm_w * (helm_orig[0] / helm_orig[1]) / (wire.width / wire.height):.3f}")


if __name__ == "__main__":
    main()
