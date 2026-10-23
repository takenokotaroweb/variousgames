"""ゲームで使う文字だけに絞った Zen Maru Gothic を作る(web/ の外に置く道具)。

使い方(リポジトリのルートで):
    pip install fonttools brotli
    python tools/make_fonts.py <ZenMaruGothic の ttf があるフォルダ>

- web/js/i18n.js と web/index.html に出てくる文字＋英数字・記号を集めて、
  Medium(500)と Bold(700)のサブセットを web/fonts/ に書き出す。
- brotli が入っていれば woff2、無ければ woff を作る(style.css は両方を読める)。
- 辞書(i18n.js)の文言を変えたら、必ずこの道具を実行し直すこと。
"""
import os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(ROOT, 'web', 'fonts')

def collect_text():
    text = set(chr(c) for c in range(0x20, 0x7F))               # 英数字・記号
    text |= set('→…〜–—・、。「」『』（）！？：／ー々〇“”‘’×')
    for p in ('web/js/i18n.js', 'web/index.html'):
        with open(os.path.join(ROOT, p), encoding='utf-8') as f:
            text |= set(f.read())
    return ''.join(sorted(c for c in text if c >= ' '))

def build(weight_name, out_base, text):
    try:
        import brotli  # noqa: F401
        flavor, ext = 'woff2', '.woff2'
    except ImportError:
        flavor, ext = 'woff', '.woff'
    opts = subset.Options()
    opts.flavor = flavor
    opts.layout_features = ['*']
    opts.name_IDs = ['*']           # 著作権表示とライセンスの情報を残す(OFL 2条)
    opts.name_languages = ['*']
    opts.notdef_outline = True
    font = TTFont(os.path.join(SRC, 'ZenMaruGothic-%s.ttf' % weight_name))
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    path = os.path.join(OUT, out_base + ext)
    subset.save_font(font, path, opts)
    print(path, os.path.getsize(path) // 1024, 'KB')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    t = collect_text()
    print('characters:', len(t))
    build('Medium', 'zenmaru-500', t)
    build('Bold', 'zenmaru-700', t)
