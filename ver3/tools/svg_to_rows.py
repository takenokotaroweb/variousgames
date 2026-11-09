"""art/characters/*.svg(キャラクターの原画)を、game.js の SPR に貼る文字の並びに直す(web/ の外に置く道具)。
SVG は 10 単位 = 1マス。半マス(5 単位)ずれた四角があるので、1文字 = 半マスで並べる。
  '.' 透明  'X' キャラクターの色  'W' 白(目・窓)
四角は SVG に書かれた順に塗る(あとの四角が上になる)。Illustrator の 180度回転(translate + rotate(-180))と、
長方形の形をした polygon(Illustrator が四角をつないだときに書き出す)にも対応。
斜め(45度など)に回した四角がある絵(ver18 の star.svg)は、マス目に直せないので
polys_of() で多角形の頂点の並び(SVG の単位)にして、game.js では線で囲んで塗る。
使い方: python tools/svg_to_rows.py art/characters
"""
import sys, os, re, glob
H = 5  # 半マスの大きさ(SVG の単位)
def color_of(attrs, styles, group_fill):
    m = re.search(r'class="(\w+)"', attrs)
    if m: return styles[m.group(1)]
    m = re.search(r'fill="(#\w+)"', attrs)
    return (m.group(1) if m else group_fill)
def rows_of(path):
    s = open(path, encoding='utf-8').read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    w, h = int(vb[2] / H), int(vb[3] / H)
    styles = {k: v for k, v in re.findall(r'\.(\w+)\s*\{\s*fill:\s*(#\w+);', s)}
    gm = re.search(r'<g[^>]*fill="(#\w+)"', s); gfill = gm.group(1) if gm else None
    grid = [['.'] * w for _ in range(h)]
    main = None
    for tag, attrs in re.findall(r'<(rect|polygon)([^>]*)/>', s):
        g = lambda k: float((re.search(r'\b' + k + r'="([-\d.]+)"', attrs) or [0, '0'])[1])
        if tag == 'polygon':
            v = [float(n) for n in re.search(r'points="([^"]+)"', attrs).group(1).replace(',', ' ').split()]
            xs, ys = v[0::2], v[1::2]
            x, y, rw, rh = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
            assert all(px in (x, x + rw) or py in (y, y + rh) for px, py in zip(xs, ys)), ('長方形でない polygon', path)
        else:
            x, y, rw, rh = g('x'), g('y'), g('width'), g('height')
        assert not re.search(r'rotate\((?!-?180\))', attrs), ('斜めの四角はマス目に直せない。polys_of を使う', path)
        t = re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*rotate\(-?180\)', attrs)
        if t:
            tx, ty = float(t.group(1)), float(t.group(2)); x, y = tx - x - rw, ty - y - rh
        c = color_of(attrs, styles, gfill).lower()
        ch = 'W' if c in ('#fff', '#ffffff') else 'X'
        if ch == 'X': main = main or c
        for yy in range(int(y / H), int((y + rh) / H)):
            for xx in range(int(x / H), int((x + rw) / H)):
                grid[yy][xx] = ch
    return [''.join(r) for r in grid], main
def polys_of(path):
    """四角と polygon を、多角形の頂点の並び [x0, y0, x1, y1, ...](SVG の単位)の配列にする。
    transform は translate(a b) rotate(θ) の組み合わせに対応(Illustrator の書き出し)"""
    import math
    s = open(path, encoding='utf-8').read()
    out = []
    for tag, attrs in re.findall(r'<(rect|polygon)([^>]*)/>', s):
        g = lambda k: float((re.search(r'\b' + k + r'="([-\d.]+)"', attrs) or [0, '0'])[1])
        if tag == 'polygon':
            v = [float(n) for n in re.search(r'points="([^"]+)"', attrs).group(1).replace(',', ' ').split()]
            pts = list(zip(v[0::2], v[1::2]))
        else:
            x, y, w, h = g('x'), g('y'), g('width'), g('height')
            pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        tx = ty = 0.0; th = 0.0
        m = re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)', attrs)
        if m: tx, ty = float(m.group(1)), float(m.group(2))
        m = re.search(r'rotate\(([-\d.]+)\)', attrs)
        if m: th = math.radians(float(m.group(1)))
        c, sn = math.cos(th), math.sin(th)
        flat = []
        for px, py in pts:
            flat += [round(tx + c * px - sn * py, 2), round(ty + sn * px + c * py, 2)]
        out.append(flat)
    return out

if __name__ == '__main__':
    for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.svg'))):
        if 'rotate(' in open(p, encoding='utf-8').read().replace('rotate(-180)', ''):
            print(os.path.basename(p), '斜めの四角あり → 多角形'); print('   ', polys_of(p)); continue
        rows, c = rows_of(p)
        print(os.path.basename(p), c, len(rows[0]) // 2, 'x', len(rows) // 2, 'マス')
        for r in rows: print('   ', r)
