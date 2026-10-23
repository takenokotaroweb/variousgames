"""タイトルの文字を Zen Maru Gothic Black の形のまま図形(アウトライン)にした SVG を作る。

使い方: python tools/make_title_svg.py <ZenMaruGothic-Black.ttf> <文字> <出力.svg> [色]
字間は 0.04em、色は既定で #FFD43B(夜空の上の黄色)。フォントのデータは SVG に含まれない。
例:
    python tools/make_title_svg.py ZenMaruGothic-Black.ttf "宇宙パトロール" web/img/ui/title-ja.svg
    python tools/make_title_svg.py ZenMaruGothic-Black.ttf "Space Patrol" web/img/ui/title-en.svg
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

def make(ttf, text, out, color='#FFD43B', tracking=0.04):
    font = TTFont(ttf)
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); hmtx = font['hmtx']
    upm = font['head'].unitsPerEm
    asc = font['hhea'].ascent
    x = 0; parts = []; xmin = ymin = 1e9; xmax = ymax = -1e9
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs); gs[g].draw(pen)
        d = pen.getCommands()
        bp = BoundsPen(gs); gs[g].draw(bp)
        if d and bp.bounds:
            bx0, by0, bx1, by1 = bp.bounds
            xmin = min(xmin, x + bx0); xmax = max(xmax, x + bx1)
            ymin = min(ymin, asc - by1); ymax = max(ymax, asc - by0)
            parts.append('<path transform="translate(%g %g) scale(1 -1)" d="%s"/>' % (x, asc, d))
        x += hmtx[g][0] + (tracking * upm if i < len(text) - 1 else 0)
    pad = upm * 0.02
    vb = (xmin - pad, ymin - pad, (xmax - xmin) + pad * 2, (ymax - ymin) + pad * 2)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%g %g %g %g"><g fill="%s">%s</g></svg>'
           % (vb[0], vb[1], vb[2], vb[3], color, ''.join(parts)))
    with open(out, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(out, len(svg) // 1024, 'KB', 'aspect %.2f' % (vb[2] / vb[3]))

if __name__ == '__main__':
    make(sys.argv[1], sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
