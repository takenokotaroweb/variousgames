"""アプリアイコン(330x330)を作る(web/ の外に置く道具)。ver15 で作り直し、ver16 でキャラクターを原画(art/characters/*.svg)に差し替えた。
4倍の大きさで描いてから縮小して、ふちをなめらかにする。

絵: 夜空に、ゲームと同じドット絵のキャラクター
      左上 輪のある星の子(黄)  右上 人工衛星ロボ(桃)
      左下 目のある結晶(水色)  右下 円盤型の宇宙船(橙)
    まん中 下のロケットから光線がのび、その先で宇宙人が星に変わったところ
    下の帯にゲーム名(文字なし版は帯なしで、絵を下げて真ん中に置く)
    光るキャラクター・流れ星・星雲で、ネオンのような雰囲気にする

使い方: python tools/make_icon.py <出力フォルダ> <ZenMaruGothic-Black.ttf>(art/characters/ の SVG を読む)
出力: icon.ja.png / icon.en.png(下の帯に白の太字でゲーム名)、icon-base.png(文字なし)
"""
import sys, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 4; W = 330 * S
out, font = sys.argv[1], sys.argv[2]
NAMES = [('ja', '宇宙パトロール'), ('en', 'Space Patrol')]

# キャラクターは game.js と同じ原画(art/characters/*.svg)から読む。1文字 = 半マス('X' 色 / 'W' 白)
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from svg_to_rows import rows_of, polys_of
def art(name): return rows_of(os.path.join(HERE, '..', 'art', 'characters', name + '.svg'))[0]
GEM = art('ringed-planet-2'); EYE = art('crystal-2'); JELLY = art('satellite-robot-1')
SHIP = art('rocket'); UFO = art('saucer-1')
STAR = polys_of(os.path.join(HERE, '..', 'art', 'characters', 'star.svg'))   # 斜めの形があるので多角形で描く(ver18)

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def lighter(c, k=0.45): return tuple(int(v + (255 - v) * k) for v in c)

def grad(w, h, a, b):
    g = Image.new('RGB', (w, h)); d = ImageDraw.Draw(g)
    ca, cb = rgb(a), rgb(b)
    for y in range(h):
        t = y / (h - 1); d.line([(0, y), (w, y)], fill=tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3)))
    return g

def sprite_layer(rows, cx, cy, px, color):
    """ドット絵を1枚の透明な層に描く(1文字 = 半マス)。上がすいている段は少し明るくして立体感を出す"""
    L = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    c = rgb(color); hi = lighter(c); q = px / 2
    w = len(rows[0]) * q; h = len(rows) * q
    x0 = cx - w / 2; y0 = cy - h / 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            if ch == 'W':
                col = (255, 255, 255)
            else:
                above = y > 1 and rows[y - 2][x] != '.'   # 1マス上(2文字上)
                col = c if above else hi
            d.rectangle([round((x0 + x * q) * S), round((y0 + y * q) * S), round((x0 + (x + 1) * q) * S) - 1, round((y0 + (y + 1) * q) * S) - 1], fill=col + (255,))
    return L

def glow_paste(base, layer, radius=7, strength=1.6):
    """層をぼかした光を下に敷いてから、層そのものを重ねる"""
    a = layer.split()[3]
    g = layer.copy(); g.putalpha(a.point(lambda v: min(255, int(v * 0.85))))
    g = g.filter(ImageFilter.GaussianBlur(radius * S))
    ga = g.split()[3].point(lambda v: min(255, int(v * strength))); g.putalpha(ga)
    base = Image.alpha_composite(base, g)
    return Image.alpha_composite(base, layer)

def draw(dy):
    rnd = random.Random(21)
    base = grad(W, W, '#1B2470', '#070B26').convert('RGBA')
    # 星雲(左右の下のほうに、紫と青のやわらかい光)
    neb = Image.new('RGBA', (W, W), (0, 0, 0, 0)); nd = ImageDraw.Draw(neb)
    for (cx, cy, rx, ry, col) in [(30, 200, 70, 40, (150, 70, 230, 110)), (300, 190, 70, 45, (70, 90, 240, 110)),
                                  (60, 230, 60, 25, (230, 80, 200, 70)), (280, 225, 55, 25, (120, 120, 255, 70))]:
        nd.ellipse([(cx - rx) * S, (cy + dy - ry) * S, (cx + rx) * S, (cy + dy + ry) * S], fill=col)
    base = Image.alpha_composite(base, neb.filter(ImageFilter.GaussianBlur(16 * S)))
    # 小さな星(光る点)
    stars = Image.new('RGBA', (W, W), (0, 0, 0, 0)); sd = ImageDraw.Draw(stars)
    for _ in range(70):
        x = rnd.uniform(4, 326); y = rnd.uniform(4, 326); r = rnd.choice([1, 1, 1.4, 2])
        col = rnd.choice([(200, 215, 255), (255, 235, 150), (150, 200, 255), (230, 160, 255)])
        sd.rectangle([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=col + (255,))
    base = glow_paste(base, stars, radius=2, strength=1.2)
    # きらめき(十字の星)
    spk = Image.new('RGBA', (W, W), (0, 0, 0, 0)); kd = ImageDraw.Draw(spk)
    for (x, y, r, col) in [(30, 30, 6, (255, 220, 90)), (300, 100, 6, (255, 220, 90)), (35, 150, 5, (255, 255, 255)),
                           (295, 30, 5, (180, 220, 255)), (128, 30, 5, (255, 220, 90)), (210, 210, 5, (255, 220, 90))]:
        y = y + dy
        kd.rectangle([(x - 1) * S, (y - r) * S, (x + 1) * S, (y + r) * S], fill=col + (255,))
        kd.rectangle([(x - r) * S, (y - 1) * S, (x + r) * S, (y + 1) * S], fill=col + (255,))
    base = glow_paste(base, spk, radius=3, strength=1.5)
    # 流れ星
    met = Image.new('RGBA', (W, W), (0, 0, 0, 0)); md = ImageDraw.Draw(met)
    for (x0, y0, x1, y1) in [(70, 4, 20, 34), (318, 118, 276, 146)]:
        for k in range(12):
            t = k / 11; a = int(40 + 215 * t)
            md.line([(x0 + (x1 - x0) * t) * S, (y0 + (y1 - y0) * t + dy) * S, (x0 + (x1 - x0) * min(1, t + 0.09)) * S, (y0 + (y1 - y0) * min(1, t + 0.09) + dy) * S],
                    fill=(140, 220, 255, a), width=int(2.4 * S))
        md.ellipse([(x1 - 3) * S, (y1 - 3 + dy) * S, (x1 + 3) * S, (y1 + 3 + dy) * S], fill=(230, 250, 255, 255))
    base = glow_paste(base, met, radius=3, strength=1.4)

    # キャラクター
    for rows, cx, cy, px, col in [(GEM, 74, 58, 7, '#FFD66B'), (JELLY, 256, 58, 7, '#FF8EC2'),
                                  (EYE, 78, 146, 6, '#7EE0FF'), (UFO, 254, 146, 4, '#FF8A5B')]:
        base = glow_paste(base, sprite_layer(rows, cx, cy + dy, px, col), radius=6, strength=1.3)
    # まん中: 星に変わったところ(星と、まわりの光の粒)
    st = Image.new('RGBA', (W, W), (0, 0, 0, 0)); sdr = ImageDraw.Draw(st)
    k = 9 / 10; ox = 165 - 25 * k; oy = 104 + dy - 25 * k   # 1マス 9 で、50x50 の星をまん中に置く
    for q in STAR:
        sdr.polygon([((ox + q[i] * k) * S, (oy + q[i + 1] * k) * S) for i in range(0, len(q), 2)], fill=(255, 226, 122, 255))
    sd2 = ImageDraw.Draw(st)
    for (x, y) in [(165, 70), (136, 88), (194, 88), (138, 126), (192, 126)]:
        sd2.rectangle([(x - 4) * S, (y - 4 + dy) * S, (x + 4) * S, (y + 4 + dy) * S], fill=(255, 205, 80, 255))
    base = glow_paste(base, st, radius=9, strength=1.6)
    # 光線(ロケットから星まで、点線)
    beam = Image.new('RGBA', (W, W), (0, 0, 0, 0)); bd = ImageDraw.Draw(beam)
    for y in range(134, 186, 18):
        bd.rectangle([162 * S, (y + dy) * S, 168 * S, (y + 12 + dy) * S], fill=(235, 250, 255, 255))
    base = glow_paste(base, beam, radius=6, strength=1.8)
    # ロケットと地面の線
    base = glow_paste(base, sprite_layer(SHIP, 165, 220 + dy, 7, '#6FF2C4'), radius=7, strength=1.4)
    gl = Image.new('RGBA', (W, W), (0, 0, 0, 0)); ImageDraw.Draw(gl).rectangle([14 * S, (250 + dy) * S, 316 * S, (252 + dy) * S], fill=(60, 140, 255, 255))
    base = glow_paste(base, gl, radius=4, strength=1.6)
    return base

def band_text(img, text):
    """下の帯とゲーム名(4倍の大きさで描いてから縮小)"""
    d = ImageDraw.Draw(img)
    d.rectangle([0, 262 * S, W, W], fill=(13, 20, 64, 255))
    for y in (262, 326):
        gold = Image.new('RGBA', (W, W), (0, 0, 0, 0)); ImageDraw.Draw(gold).rectangle([0, y * S, W, (y + 2) * S], fill=(255, 205, 60, 255))
        img = glow_paste(img, gold, radius=3, strength=1.3)
    size = 36 * S; f = ImageFont.truetype(font, size)
    tmp = ImageDraw.Draw(img)
    while tmp.textlength(text, font=f) > 250 * S:
        size -= S; f = ImageFont.truetype(font, size)
    w = tmp.textlength(text, font=f); x = (W - w) / 2; y = 295 * S
    tl = Image.new('RGBA', (W, W), (0, 0, 0, 0)); td = ImageDraw.Draw(tl)
    td.text((x + 2 * S, y + 2 * S), text, font=f, fill=(30, 60, 200, 255), anchor='lm')   # 影(青)
    td.text((x, y), text, font=f, fill=(255, 255, 255, 255), anchor='lm', stroke_width=int(1.2 * S), stroke_fill=(40, 70, 210, 255))
    img = glow_paste(img, tl, radius=4, strength=0.9)
    # 名前の左右のきらめき
    sp = Image.new('RGBA', (W, W), (0, 0, 0, 0)); spd = ImageDraw.Draw(sp)
    for cx in (x / S - 16, (x + w) / S + 16):
        cy = 295; r = 6
        spd.rectangle([(cx - 1) * S, (cy - r) * S, (cx + 1) * S, (cy + r) * S], fill=(255, 220, 90, 255))
        spd.rectangle([(cx - r) * S, (cy - 1) * S, (cx + r) * S, (cy + 1) * S], fill=(255, 220, 90, 255))
    return glow_paste(img, sp, radius=3, strength=1.4)

os.makedirs(out, exist_ok=True)
draw(30).convert('RGB').resize((330, 330), Image.LANCZOS).save(os.path.join(out, 'icon-base.png'))   # 文字なしは、帯が無い分だけ絵を下げる
art = draw(0)
for lang, text in NAMES:
    band_text(art.copy(), text).convert('RGB').resize((330, 330), Image.LANCZOS).save(os.path.join(out, 'icon.%s.png' % lang))
print('ok')
