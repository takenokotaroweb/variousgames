"""アプリアイコン(330x330)を作る。4倍の大きさで描いてから縮小して、ふちをなめらかにする。
使い方: python make_icon.py <問題画像0.png> <出力フォルダ> <案の名前> <背景上の色> <背景下の色> <レンズの中心x(px)> <y(px)> <フォント(Black)>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
S = 4; W = 330 * S; BAND = 262 * S
src, out, name, c1, c2, lx, ly, font = sys.argv[1:9]
lx, ly = float(lx), float(ly)
im = Image.open(src).convert('RGB')
L = im.crop((76, 61, 1242, 1235)); R = im.crop((1261, 61, 2427, 1235))

def grad(w, h, a, b):
    g = Image.new('RGB', (w, h)); d = ImageDraw.Draw(g)
    ca = tuple(int(a[i:i+2], 16) for i in (1, 3, 5)); cb = tuple(int(b[i:i+2], 16) for i in (1, 3, 5))
    for y in range(h):
        t = y / (h - 1); d.line([(0, y), (w, y)], fill=tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3)))
    return g
import math
def card(pic, size, angle):
    inner = pic.resize((size * S, size * S), Image.LANCZOS)
    pad = 7 * S; rad = 14 * S
    c = Image.new('RGBA', (size * S + pad * 2, size * S + pad * 2), (0, 0, 0, 0))
    m = Image.new('L', c.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, c.size[0] - 1, c.size[1] - 1], rad, fill=255)
    c.paste(Image.new('RGBA', c.size, (255, 255, 255, 255)), (0, 0), m)
    im2 = Image.new('L', inner.size, 0); ImageDraw.Draw(im2).rounded_rectangle([0, 0, inner.size[0] - 1, inner.size[1] - 1], rad - pad // 2, fill=255)
    c.paste(inner, (pad, pad), im2)
    return c.rotate(angle, resample=Image.BICUBIC, expand=True)
def shadow_paste(dst, layer, xy, blur=6, off=(0, 5), alpha=90):
    sh = Image.new('RGBA', dst.size, (0, 0, 0, 0))
    a = layer.split()[3].point(lambda v: v * alpha // 255)
    sh.paste((20, 30, 50, 255), (xy[0] + off[0] * S, xy[1] + off[1] * S), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur * S))
    dst = Image.alpha_composite(dst, sh); dst.alpha_composite(layer, xy); return dst

def draw(dy):
    base = grad(W, W, c1, c2).convert('RGBA')
    # やわらかい光の玉(背景の飾り)
    deco = Image.new('RGBA', (W, W), (0, 0, 0, 0)); dd = ImageDraw.Draw(deco)
    for cx, cy, r, a in [(40, 40, 70, 60), (300, 70, 40, 50), (60, 230, 30, 40), (290, 220, 22, 45)]:
        dd.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=(255, 255, 255, a))
    base = Image.alpha_composite(base, deco.filter(ImageFilter.GaussianBlur(6 * S)))

    size = 126
    cl = card(L, size, 7); cr = card(R, size, -6)
    base = shadow_paste(base, cl, (int(14 * S), int((40 + dy) * S)))
    base = shadow_paste(base, cr, (int(166 * S), int((28 + dy) * S)))
    # 2枚のカードの間の「≠」っぽい小さな印は付けない(すっきりさせる)

    # 虫めがね: 2枚のカードにまたがって重ねる。レンズはただの透明なガラス(下の絵がそのまま見える)
    lr = 64; lcx, lcy = int(lx), int(ly) + dy      # レンズの中心(アイコン座標 px)
    mg = Image.new('RGBA', (W, W), (0, 0, 0, 0)); md = ImageDraw.Draw(mg)
    ink = (31, 42, 68, 255)
    ang = math.radians(45); x0 = lcx + (lr + 6) * math.cos(ang); y0 = lcy + (lr + 6) * math.sin(ang)
    x1 = lcx + (lr + 50) * math.cos(ang); y1 = lcy + (lr + 50) * math.sin(ang)
    md.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=(120, 72, 36, 255), width=int(20 * S))
    md.ellipse([(x1 - 10) * S, (y1 - 10) * S, (x1 + 10) * S, (y1 + 10) * S], fill=(120, 72, 36, 255))
    md.line([x0 * S, y0 * S, (x0 + 10) * S, (y0 + 10) * S], fill=ink, width=int(22 * S))
    md.ellipse([(lcx - lr - 7) * S, (lcy - lr - 7) * S, (lcx + lr + 7) * S, (lcy + lr + 7) * S], outline=ink, width=int(10 * S))
    base = shadow_paste(base, mg, (0, 0), blur=5, off=(0, 4), alpha=80)
    # ガラス: ほんのり明るく、左上につや
    gl = Image.new('RGBA', (W, W), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.ellipse([(lcx - lr) * S, (lcy - lr) * S, (lcx + lr) * S, (lcy + lr) * S], fill=(235, 248, 255, 45))
    gd.ellipse([(lcx - lr * 0.62) * S, (lcy - lr * 0.80) * S, (lcx + lr * 0.05) * S, (lcy - lr * 0.38) * S], fill=(255, 255, 255, 120))
    gd.ellipse([(lcx + lr * 0.35) * S, (lcy + lr * 0.30) * S, (lcx + lr * 0.55) * S, (lcy + lr * 0.50) * S], fill=(255, 255, 255, 90))
    base = Image.alpha_composite(base, gl.filter(ImageFilter.GaussianBlur(1.5 * S)))
    md2 = ImageDraw.Draw(base)
    md2.ellipse([(lcx - lr - 1) * S, (lcy - lr - 1) * S, (lcx + lr + 1) * S, (lcy + lr + 1) * S], outline=(255, 255, 255, 200), width=int(2 * S))


    return base.convert('RGB').resize((330, 330), Image.LANCZOS)

art = draw(0)                       # 文字入り(下に帯)用
BASE_DY = 35                        # 文字なしの元絵は、帯が無い分だけ絵を下げて真ん中に置く
os.makedirs(out, exist_ok=True)
draw(BASE_DY).save(os.path.join(out, name + '_icon-base.png'))
for lang, text in [('ja', 'まちがいさがしゲーム'), ('en', 'Find the Differences')]:
    im2 = art.copy(); d = ImageDraw.Draw(im2); d.rectangle([0, 262, 330, 330], fill='#1F2A44')
    size = 30; f = ImageFont.truetype(font, size)
    while d.textlength(text, font=f) > 306: size -= 1; f = ImageFont.truetype(font, size)
    w = d.textlength(text, font=f); d.text(((330 - w) / 2, 296), text, font=f, fill='white', anchor='lm')
    im2.save(os.path.join(out, name + '_icon.%s.png' % lang))
print('ok', name)
