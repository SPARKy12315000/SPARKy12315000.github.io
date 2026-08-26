#!/usr/bin/env python3
"""生成 SPARK 默认头像（星球）与背景图（星空+SPARK），替代占位 1x1。"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
os.makedirs(ASSETS, exist_ok=True)

GOLD = (245, 166, 35)
GOLD_L = (255, 210, 120)
DARK = (10, 10, 18)


def radial(w, h, cx, cy, inner, outer):
    img = Image.new('RGB', (w, h), outer)
    px = img.load()
    maxd = math.hypot(max(cx, w - cx), max(cy, h - cy))
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx, y - cy) / maxd
            r = int(inner[0] + (outer[0] - inner[0]) * d)
            g = int(inner[1] + (outer[1] - inner[1]) * d)
            b = int(inner[2] + (outer[2] - inner[2]) * d)
            px[x, y] = (r, g, b)
    return img


# ---- Logo：发光的星球 ----
def make_logo(path='logo.png', size=512):
    img = radial(size, size, size // 2, size // 2, GOLD_L, (60, 40, 10))
    d = ImageDraw.Draw(img)
    # 光晕
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(8, 0, -1):
        a = int(40 * (9 - i))
        gd.ellipse([size // 2 - i * 6, size // 2 - i * 6, size // 2 + i * 6, size // 2 + i * 6],
                   fill=(*GOLD, a))
    img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')
    d = ImageDraw.Draw(img)
    # 陨石坑
    random.seed(7)
    for _ in range(9):
        cx = random.randint(size * 0.25, size * 0.75)
        cy = random.randint(size * 0.25, size * 0.75)
        r = random.randint(12, 34)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(180, 110, 20), outline=(90, 55, 10))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(path, 'PNG')
    print('logo:', path)


# ---- 背景：深空 + 星点 + SPARK ----
def make_bg(path='background.png', w=1600, h=900):
    img = radial(w, h, w // 2, h // 2, (30, 20, 50), DARK)
    d = ImageDraw.Draw(img)
    random.seed(42)
    for _ in range(400):
        x = random.randint(0, w); y = random.randint(0, h)
        r = random.choice([1, 1, 1, 2, 3])
        c = random.choice([(255, 255, 255), (255, 230, 180), (180, 200, 255)])
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    # SPARK 字样
    try:
        from PIL import ImageFont
        font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 96)
    except Exception:
        font = ImageFont.load_default()
    text = 'SPARK'
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((w - tw) // 2, (h - th) // 2), text, fill=GOLD, font=font)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img.save(path, 'PNG')
    print('bg:  ', path)


if __name__ == '__main__':
    make_logo(os.path.join(ASSETS, 'logo.png'))
    make_bg(os.path.join(ASSETS, 'background.png'))
