"""アプリアイコン(330x330)を作る。4倍の大きさで描いてから縮小して、ふちをなめらかにする。
絵: 夜空に3種類の宇宙人(ゲームと同じドット絵)、下に自分の船、船から出た光線の先で宇宙人が星に変わったところ。

使い方: python tools/make_icon.py <出力フォルダ> <ZenMaruGothic-Black.ttf>
出力: icon.ja.png / icon.en.png(下の帯に白の太字でゲーム名)、icon-base.png(文字なしの元絵)
"""
import sys, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 4; W = 330 * S
out, font = sys.argv[1], sys.argv[2]
NAMES = [('ja', '宇宙パトロール'), ('en', 'Space Patrol')]

# game.js と同じドット絵
GEM = ['....XX....', '...XXXX...', '..XX..XX..', '.XXXXXXXX.', '..X.XX.X..', '.X......X.']
EYE = ['..XXXXXX..', '.XX....XX.', 'XX..XX..XX', 'XX..XX..XX', '.XX....XX.', 'X.XXXXXX.X']
JELLY = ['...XXXX...', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', '.X.X..X.X.', 'X.X....X.X']
SHIP = ['.....X.....', '....XXX....', '....XXX....', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX.XXXXX.XX']
STAR = ['..X..', '..X..', 'XXXXX', '.XXX.', '.X.X.']

def grad(w, h, a, b):
    g = Image.new('RGB', (w, h)); d = ImageDraw.Draw(g)
    ca = tuple(int(a[i:i + 2], 16) for i in (1, 3, 5)); cb = tuple(int(b[i:i + 2], 16) for i in (1, 3, 5))
    for y in range(h):
        t = y / (h - 1); d.line([(0, y), (w, y)], fill=tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3)))
    return g

def dots(d, rows, cx, cy, px, color):
    w = len(rows[0]) * px; h = len(rows) * px
    x0 = cx - w / 2; y0 = cy - h / 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == 'X':
                d.rectangle([(x0 + x * px) * S, (y0 + y * px) * S, (x0 + (x + 1) * px) * S - 1, (y0 + (y + 1) * px) * S - 1], fill=color)

def draw(dy):
    base = grad(W, W, '#26307A', '#0B0F28').convert('RGBA')
    d = ImageDraw.Draw(base)
    rnd = random.Random(7)
    for _ in range(46):
        x = rnd.uniform(6, 324); y = rnd.uniform(6, 324); r = rnd.choice([1, 1, 1.5, 2])
        c = (201, 210, 255, 255) if r > 1 else (110, 122, 190, 255)
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=c)
    # 光(やわらかい玉)
    glow = Image.new('RGBA', (W, W), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.ellipse([95 * S, (60 + dy) * S, 235 * S, (170 + dy) * S], fill=(120, 140, 255, 70))
    base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(18 * S)))
    d = ImageDraw.Draw(base)
    # 宇宙人(上の段)と、星に変わったところ
    dots(d, GEM, 70, 62 + dy, 7, (255, 214, 107, 255))
    dots(d, JELLY, 262, 62 + dy, 7, (255, 142, 194, 255))
    dots(d, EYE, 108, 128 + dy, 7, (126, 224, 255, 255))
    dots(d, STAR, 196, 122 + dy, 9, (255, 226, 122, 255))
    for ang_x, ang_y in [(-26, -10), (26, -12), (-20, 22), (24, 20), (0, -30)]:
        cx = 196 + ang_x; cy = 122 + dy + ang_y
        d.rectangle([(cx - 3) * S, (cy - 3) * S, (cx + 3) * S, (cy + 3) * S], fill=(255, 236, 160, 255))
    # 光線(船から星へ)
    d.rectangle([(196 - 3) * S, (150 + dy) * S, (196 + 3) * S, (190 + dy) * S], fill=(255, 255, 255, 255))
    # 自分の船
    dots(d, SHIP, 196, 222 + dy, 8, (111, 242, 196, 255))
    # 地面の線
    d.rectangle([24 * S, (252 + dy) * S, 306 * S, (254 + dy) * S], fill=(70, 86, 170, 255))
    return base.convert('RGB').resize((330, 330), Image.LANCZOS)

os.makedirs(out, exist_ok=True)
draw(30).save(os.path.join(out, 'icon-base.png'))       # 文字なしは、帯が無い分だけ絵を下げて真ん中に置く
art = draw(-6)
for lang, text in NAMES:
    im = art.copy(); d = ImageDraw.Draw(im)
    d.rectangle([0, 262, 330, 330], fill='#1F2A44'); d.rectangle([0, 262, 330, 264], fill='#FFD43B')
    size = 34; f = ImageFont.truetype(font, size)
    while d.textlength(text, font=f) > 300: size -= 1; f = ImageFont.truetype(font, size)
    w = d.textlength(text, font=f); d.text(((330 - w) / 2, 297), text, font=f, fill='white', anchor='lm')
    im.save(os.path.join(out, 'icon.%s.png' % lang))
print('ok')
