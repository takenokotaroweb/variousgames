"""おうちの宝さがし の BGM を合成する(web/ の外に置く道具)。外部の音源・サンプル・既存の曲は使っていない。

フレンチ・カフェ風(アコーディオン + ジプシー・ギター + ウッドベース + ブラシ)の候補を3曲つくる:
    python3 tools/make_bgm.py <出力フォルダ>
  A: bgm_A_musette_waltz.mp3  … パリの朝のミュゼット・ワルツ(3拍子・ト長調/ホ短調)
  B: bgm_B_cafe_swing.mp3     … 午後のカフェ・スウィング(4拍子・ヘ長調)
  C: bgm_C_tiptoe_minor.mp3   … 抜き足さし足の宝さがし(4拍子・ニ短調)
  D: bgm_D_home_ballad.mp3    … おうちのジャズ・バラード(エレピ・ベース・ブラシ)
  E: bgm_E_sunday_bossa.mp3   … 日曜の午後のボサノバ(ナイロンギター・アコーディオン/エレピ)
  D1〜D4: D のバリエーション(D1 アコーディオンの旋律 / D2 ビブラフォン+ナイロンギター / D3 ボサノバのリズム / D4 さらにゆっくり・低め)
曲を選んで作る: python3 tools/make_bgm.py <出力フォルダ> D1 D2
どれも曲の終わりが頭につながるようにしてあり、ループ再生できる。
"""
import os, sys, subprocess, numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, butter, sosfilt

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
def hz(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def n(s):  # 'C5' 'F#4' 'Bb3'
    k = NOTE[s[0]]; i = 1
    if s[i] == '#': k += 1; i += 1
    elif s[i] == 'b': k -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + k

class Mix:
    def __init__(s, bpm, beats_total, tail=4):
        s.beat = 60 / bpm; s.loop = int(SR * s.beat * beats_total); s.buf = np.zeros((s.loop + SR * tail, 2))
    def add(s, at, sig, pan=0.0, gain=1.0):
        i = int(round(at * s.beat * SR)); l = gain * np.cos((pan + 1) * np.pi / 4); r = gain * np.sin((pan + 1) * np.pi / 4)
        s.buf[i:i + len(sig), 0] += sig * l; s.buf[i:i + len(sig), 1] += sig * r
    def render(s, name, peak=0.5, lowpass=6500, post=None, verb=None):
        if verb is not None:   # 長い残響(ホールのような響き)。ループのつなぎ目の前にかけて、余韻も頭へ回す
            from scipy.signal import fftconvolve
            sec, wet = verb; L = int(SR * sec); tt = np.arange(L) / SR; rng = np.random.default_rng(11)
            for ch in (0, 1):
                ir = rng.standard_normal(L) * np.exp(-tt * 6.9 / sec); ir = sosfilt(butter(1, 3500, fs=SR, output='sos'), ir)
                ir[:int(SR * 0.02)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
                s.buf[:, ch] = s.buf[:, ch] + wet * fftconvolve(s.buf[:, ch], ir)[:len(s.buf)]
        dry = s.buf.copy()   # 小さな部屋の響き(左右に散らした短い反射)
        for d, g in [(0.071, 0.20), (0.113, 0.17), (0.167, 0.14), (0.229, 0.10), (0.307, 0.07), (0.41, 0.045), (0.53, 0.03)]:
            k = int(SR * d); s.buf[k:, 0] += dry[:-k, 1] * g; s.buf[k:, 1] += dry[:-k, 0] * g
        sos = butter(2, lowpass, fs=SR, output='sos'); s.buf = sosfilt(sos, s.buf, axis=0)
        tail = s.buf[s.loop:]; s.buf[:len(tail)] += tail; out = s.buf[:s.loop]   # 余韻を頭に重ねてループを滑らかに
        if post is not None:   # 仕上げのあとは、まれな「プチッ」に引っぱられないよう、上位0.05%の大きさでそろえて軽く抑える
            out = post(out); out = out / np.percentile(np.abs(out), 99.95) * peak; out = np.tanh(out / 0.9) * 0.9
        else:
            out = out / np.max(np.abs(out)) * peak
        wav = os.path.join(OUT, name + '.wav'); mp3 = os.path.join(OUT, name + '.mp3')
        wavfile.write(wav, SR, (out * 32767).astype(np.int16))
        af = []
        if post is not None:   # ローファイ版は聞こえの大きさを約 -19 LUFS にそろえる(曲全体に同じ音量をかけるので、ループのつなぎ目は変わらない)
            r = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
            lufs = float([l for l in r.splitlines() if l.strip().startswith('I:')][-1].split()[1])
            af = ['-af', 'volume=%.2fdB,alimiter=limit=0.89:level=false' % (-19 - lufs)]
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav] + af + ['-b:a', '128k', mp3], check=True); os.remove(wav)
        return mp3

_cache = {}
def accordion(m, dur_s, reeds=(0.0, 13.0), bright=1.0):
    """アコーディオン風: 少しずらした2枚のリードのうなり(ミュゼット)+ リードらしい倍音。"""
    key = ('acc', m, round(dur_s, 3), reeds, bright)
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + 0.12)); t = np.arange(N) / SR; s = np.zeros(N)
    for c in reeds:
        f = hz(m) * 2 ** (c / 1200); ph = 2 * np.pi * f * t + (c * 0.37)
        for k in range(1, 11):
            if f * k > 9000: break
            a = (1.0 / k) if k % 2 else (0.55 / k)
            s += a * (bright if k > 3 else 1.0) * np.sin(k * ph)
    s /= len(reeds) * 1.8
    e = np.minimum(1, t / 0.03) * (0.92 + 0.08 * np.minimum(1, t / 0.4))   # ふいごで少しふくらむ
    end = int(SR * dur_s); e[end:] *= np.linspace(1, 0, N - end)
    _cache[key] = s * e; return _cache[key]

def guitar(m, dur_s, mute=None, seed=0):
    """弦をはじいた音(Karplus-Strong)。mute を指定すると、その秒数で指で止める(ラ・ポンプの刻み)。"""
    key = ('gtr', m, round(dur_s, 3), mute, seed % 5)
    if key in _cache: return _cache[key]
    N = int(SR * dur_s); L = max(2, int(SR / hz(m)))
    rng = np.random.default_rng(m * 7 + seed % 5)
    x = np.zeros(N); burst = rng.standard_normal(L); burst = lfilter([0.5, 0.5], [1], burst); x[:L] = burst
    a = np.zeros(L + 2); a[0] = 1; a[L] = -0.4985; a[L + 1] = -0.4985
    y = lfilter([1], a, x)
    y = lfilter([0.6, 0.4], [1], y)   # 少し丸く
    if mute is not None:
        k = int(SR * mute); fade = int(SR * 0.03)
        if k < N: y[k:k + fade] *= np.linspace(1, 0, min(fade, N - k)); y[k + fade:] = 0
    y /= (np.max(np.abs(y)) + 1e-9)
    _cache[key] = y; return y

def strum(mx, at, notes, length, mute, gain, pan=-0.35, down=True):
    order = notes if down else notes[::-1]
    for i, m in enumerate(order):
        mx.add(at + i * 0.012 / mx.beat, guitar(m, length, mute=mute, seed=i), pan=pan, gain=gain / len(notes) ** 0.5)

def bass(m, dur_s, decay=3.0):
    """ウッドベースのピチカート風。"""
    N = int(SR * (dur_s + 0.1)); t = np.arange(N) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 10)
    e = np.minimum(1, t / 0.004) * np.exp(-t * decay); end = int(SR * dur_s); e[end:] *= np.linspace(1, 0, N - end)
    return s * e

def brush(acc, swirl=False, seed=0):
    N = int(SR * (0.22 if swirl else 0.11)); t = np.arange(N) / SR
    w = np.random.default_rng(seed).standard_normal(N); w = np.diff(np.concatenate([[0], w]))
    env = np.sin(np.pi * t / t[-1]) if swirl else np.exp(-t * 32)
    return w * env * (0.55 if acc else 0.3)

def swing(pos, ratio=0.64):
    """拍の裏(0.5)を少し後ろへずらしてスウィングさせる。"""
    b = np.floor(pos + 1e-9); f = pos - b
    return b + (ratio if abs(f - 0.5) < 1e-6 else f)

def play_melody(mx, bars, bpb, mel, tr=0, gain=0.30, pan=0.15, sw=None, legato=0.92, reeds=(0.0, 13.0), bright=1.0, start_bar=0):
    for bi, bar in enumerate(mel):
        base = (start_bar + bi) * bpb; t = 0.0
        for nt, d in bar:
            if nt != 'R':
                st = swing(t) if sw else t; en = swing(t + d) if sw else t + d
                mx.add(base + st, accordion(n(nt) + tr, mx.beat * (en - st) * legato, reeds, bright), pan=pan, gain=gain)
            t += d

# ---------- A: パリの朝のミュゼット・ワルツ(3拍子、104BPM、64小節 ≒ 111秒) ----------
def musette_waltz():
    BPB = 3; bpm = 104
    A = [('G', [('D5',1),('B4',.5),('C5',.5),('D5',1)]), ('G', [('G5',2),('F#5',.5),('G5',.5)]),
         ('D7', [('A5',1),('F#5',1),('D5',1)]), ('D7', [('C5',2),('D5',1)]),
         ('D7', [('C5',1),('A4',.5),('B4',.5),('C5',1)]), ('D7', [('F#5',2),('E5',.5),('F#5',.5)]),
         ('G', [('G5',1),('D5',1),('B4',1)]), ('G', [('G4',2),('D5',1)]),
         ('G', [('B4',1),('D5',.5),('G5',.5),('B5',1)]), ('G7', [('A5',1),('G5',1),('F5',1)]),
         ('C', [('E5',1),('G5',.5),('E5',.5),('C5',1)]), ('C', [('E5',2),('F#5',1)]),
         ('G', [('G5',1),('B5',1),('D5',1)]), ('D7', [('C6',1),('A5',1),('F#5',1)]),
         ('G', [('G5',1.5),('D5',.5),('B4',1)]), ('G', [('G5',2),('B4',1)])]
    B = [('Em', [('E5',1),('G5',.5),('F#5',.5),('E5',1)]), ('Em', [('B5',2),('A5',.5),('G5',.5)]),
         ('B7', [('F#5',1),('A5',1),('D#5',1)]), ('B7', [('B4',2),('D#5',1)]),
         ('B7', [('F#5',1),('E5',.5),('D#5',.5),('F#5',1)]), ('B7', [('A5',2),('G5',.5),('F#5',.5)]),
         ('Em', [('G5',1),('E5',1),('B4',1)]), ('Em', [('E5',2),('G5',1)]),
         ('Am', [('A5',1),('C6',.5),('B5',.5),('A5',1)]), ('Am', [('E5',2),('C5',1)]),
         ('Em', [('B4',1),('E5',.5),('F#5',.5),('G5',1)]), ('Em', [('B5',2),('G5',1)]),
         ('F#7', [('A#5',1),('F#5',1),('E5',1)]), ('B7', [('D#5',1),('F#5',1),('A5',1)]),
         ('Em', [('G5',1),('F#5',1),('E5',1)]), ('D7', [('F#5',1),('A5',1),('C6',1)])]
    form = A + B + A + B; bars = len(form); mx = Mix(bpm, BPB * bars)
    ch = {'G': ['G3','B3','D4'], 'D7': ['F#3','A3','C4','D4'], 'G7': ['G3','B3','D4','F4'], 'C': ['G3','C4','E4'],
          'Em': ['G3','B3','E4'], 'B7': ['F#3','A3','B3','D#4'], 'Am': ['A3','C4','E4'], 'F#7': ['F#3','A#3','C#4','E4']}
    root = {'G': ('G2','D2'), 'D7': ('D2','A1'), 'G7': ('G2','D2'), 'C': ('C2','G1'), 'Em': ('E2','B1'),
            'B7': ('B1','F#2'), 'Am': ('A1','E2'), 'F#7': ('F#2','C#2')}
    for b, (c, mel) in enumerate(form):
        base = b * BPB
        second = b >= 32
        play_melody(mx, 1, BPB, [mel], tr=(-12 if second and b % 16 >= 8 else 0), gain=0.30, legato=0.97, start_bar=b, bright=0.7)
        mx.add(base, bass(n(root[c][b % 2]), mx.beat * 1.2), gain=0.22)
        notes = [n(x) for x in ch[c]]
        for k in (1, 2):
            strum(mx, base + k, notes, 0.9, mute=mx.beat * 0.6, gain=0.11, down=(k == 1))
            mx.add(base + k, accordion(notes[0] , mx.beat * 0.35, reeds=(0.0,), bright=0.5), pan=-0.1, gain=0.05)
        mx.add(base + 1, brush(1, seed=b), pan=0.4, gain=0.05); mx.add(base + 2, brush(0, seed=b + 99), pan=0.4, gain=0.04)
    return mx.render('bgm_A_musette_waltz', lowpass=5000)

# ---------- B: 午後のカフェ・スウィング(4拍子、84BPM、32小節 ≒ 91秒) ----------
def cafe_swing():
    BPB = 4; bpm = 84
    A1 = [('F6', [('C5',.5),('D5',.5),('F5',1),('A5',1.5),('G5',.5)]),
          ('D7', [('F#5',1),('A5',1),('C6',1.5),('A5',.5)]),
          ('Gm7', [('Bb5',1),('A5',.5),('G5',.5),('F5',1),('D5',1)]),
          ('C7', [('E5',1.5),('C5',.5),('G5',2)]),
          ('Am7', [('A5',1),('G5',.5),('E5',.5),('C5',1),('E5',1)]),
          ('D7', [('F#5',1.5),('A5',.5),('D6',1),('C6',1)]),
          ('Gm7|C7', [('Bb5',1),('G5',1),('E5',1),('C5',1)]),
          ('F6', [('F5',3),('R',1)])]
    A2 = A1[:7] + [('F6', [('F5',2),('E5',.5),('F5',.5),('G5',1)])]
    Bb = [('A7', [('C#5',1),('E5',1),('A5',1),('G5',1)]), ('A7', [('E5',3),('R',1)]),
          ('D7', [('F#5',1),('A5',1),('D6',1),('C6',1)]), ('D7', [('A5',3),('R',1)]),
          ('G7', [('B5',1),('A5',.5),('G5',.5),('F5',1),('D5',1)]), ('G7', [('B4',2),('D5',1),('F5',1)]),
          ('C7', [('E5',1),('G5',1),('Bb5',1),('A5',.5),('G5',.5)]), ('C7', [('E5',2),('C5',1),('R',1)])]
    form = A1 + A2 + Bb + A1; bars = len(form); mx = Mix(bpm, BPB * bars)
    ch = {'F6': ['F3','A3','D4'], 'D7': ['F#3','C4','D4'], 'Gm7': ['F3','Bb3','D4'], 'C7': ['E3','Bb3','C4'],
          'Am7': ['G3','C4','E4'], 'A7': ['G3','C#4','E4'], 'G7': ['F3','B3','D4']}
    root = {'F6': 'F2', 'D7': 'D2', 'Gm7': 'G2', 'C7': 'C2', 'Am7': 'A1', 'A7': 'A1', 'G7': 'G1'}
    for b, (c, mel) in enumerate(form):
        base = b * BPB
        chords = c.split('|'); per = BPB / len(chords)
        play_melody(mx, 1, BPB, [mel], tr=(-12 if 16 <= b < 24 else 0), gain=0.28, sw=True, legato=0.96, start_bar=b, bright=0.7)
        for beat in range(BPB):
            cc = chords[int(beat // per)]; notes = [n(x) for x in ch[cc]]
            strong = beat % 2 == 1   # 2拍目・4拍目を短く強く(ラ・ポンプ)
            strum(mx, base + beat, notes, 0.8, mute=(0.20 if strong else 0.35), gain=(0.12 if strong else 0.08))
            if beat % 2 == 0:
                r = n(root[cc]) + (7 if beat == 2 else 0)
                mx.add(base + beat, bass(r, mx.beat * 1.6, decay=2.2), gain=0.22)
            mx.add(base + beat, brush(strong, swirl=not strong, seed=b * 4 + beat), pan=0.4, gain=(0.035 if strong else 0.025))
    return mx.render('bgm_B_cafe_swing', lowpass=5000)

# ---------- C: 抜き足さし足の宝さがし(4拍子・ニ短調、78BPM、32小節 ≒ 98秒) ----------
def tiptoe_minor():
    BPB = 4; bpm = 78
    M = [('Dm6', [('D5',.5),('E5',.5),('F5',.5),('A5',.5),('D6',1),('A5',1)]),
         ('Dm6', [('Bb5',.5),('A5',.5),('G#5',.5),('A5',.5),('F5',2)]),
         ('Gm6', [('G5',.5),('A5',.5),('Bb5',.5),('D6',.5),('C6',1),('Bb5',1)]),
         ('Gm6', [('A5',.5),('G5',.5),('F#5',.5),('G5',.5),('D5',2)]),
         ('Dm6', [('F5',1),('E5',.5),('F5',.5),('A5',1),('D5',1)]),
         ('Dm6', [('C#5',.5),('D5',.5),('E5',.5),('F5',.5),('A5',2)]),
         ('A7', [('G5',1),('E5',.5),('C#5',.5),('A4',1),('C#5',1)]),
         ('A7', [('E5',1),('G5',1),('A5',1),('R',1)]),
         ('Gm6', [('Bb5',1.5),('A5',.5),('G5',1),('D5',1)]),
         ('Gm6', [('E5',.5),('G5',.5),('Bb5',.5),('D6',.5),('C6',2)]),
         ('Dm6', [('A5',1.5),('G5',.5),('F5',1),('D5',1)]),
         ('Dm6', [('F5',.5),('A5',.5),('D6',.5),('C#6',.5),('D6',2)]),
         ('Bb7', [('D6',1),('C6',.5),('Bb5',.5),('Ab5',1),('F5',1)]),
         ('A7', [('E5',1),('G5',.5),('F5',.5),('E5',1),('C#5',1)]),
         ('Dm6', [('D5',1),('F5',1),('A5',1),('D6',1)]),
         ('A7', [('C#6',1),('A5',1),('E5',1),('R',1)])]
    form = M + M; bars = len(form); mx = Mix(bpm, BPB * bars)
    ch = {'Dm6': ['F3','B3','D4'], 'Gm6': ['G3','Bb3','E4'], 'A7': ['G3','C#4','E4'], 'Bb7': ['Ab3','D4','F4']}
    walk = {'Dm6': ['D2','A2','D3','A2'], 'Gm6': ['G1','D2','G2','D2'], 'A7': ['A1','E2','A2','C#2'], 'Bb7': ['Bb1','F2','Bb2','F2']}
    for b, (c, mel) in enumerate(form):
        base = b * BPB; second = b >= 16
        if second:   # 2回目はギターが旋律(はじく音で、いたずらっぽく)、アコーディオンは低く支える
            t = 0.0
            for nt, d in mel:
                if nt != 'R': mx.add(base + swing(t), guitar(n(nt), min(1.2, mx.beat * d * 1.4), mute=mx.beat * d * 0.8, seed=int(t * 2)), pan=0.2, gain=0.26)
                t += d
            play_melody(mx, 1, BPB, [mel], tr=-12, gain=0.10, sw=True, legato=0.6, start_bar=b, bright=0.6)
        else:
            play_melody(mx, 1, BPB, [mel], gain=0.27, sw=True, legato=0.85, start_bar=b, bright=0.7)   # 短めに切って「抜き足」
        notes = [n(x) for x in ch[c]]
        for beat in range(BPB):
            strong = beat % 2 == 1
            strum(mx, base + beat, notes, 0.8, mute=(0.18 if strong else 0.30), gain=(0.11 if strong else 0.07))
            mx.add(base + beat, bass(n(walk[c][beat]), mx.beat * 0.85, decay=3.0), gain=0.20)
            mx.add(base + beat, brush(strong, seed=b * 4 + beat), pan=0.4, gain=(0.03 if strong else 0.018))
    return mx.render('bgm_C_tiptoe_minor', lowpass=5000)

def rhodes(ms, dur_s, bright=0.5):
    """エレクトリック・ピアノ風(やわらかいベルのような音)。"""
    key = ('rh', tuple(ms), round(dur_s, 3), bright)
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + 1.2)); t = np.arange(N) / SR; s = np.zeros(N)
    for m in ms:
        f = hz(m); s += np.sin(2*np.pi*f*t + bright*np.sin(2*np.pi*f*t)*np.exp(-t*4)) * (1 + 0.12*np.sin(2*np.pi*4.2*t))
    e = np.minimum(1, t / 0.008) * np.exp(-t * 0.9); end = int(SR * dur_s)
    if end < N: e[end:] *= np.linspace(1, 0, N - end)
    _cache[key] = s * e / max(1, len(ms)) ** 0.7; return _cache[key]

def nylon(m, dur_s, seed=0):
    """ナイロン弦ギター風(丸い音)。"""
    g = guitar(m, dur_s, mute=dur_s - 0.03, seed=seed)
    return lfilter([0.35, 0.35, 0.3], [1], g)

def shaker(seed, acc):
    N = int(SR * 0.07); t = np.arange(N) / SR
    w = np.random.default_rng(seed).standard_normal(N); w = np.diff(np.concatenate([[0], w])); w = np.diff(np.concatenate([[0], w]))
    return w * np.sin(np.pi * t / t[-1]) * (0.5 if acc else 0.3)

def comp(mx, at, notes, dur_beats, gain, bright=0.4):
    mx.add(at, rhodes(notes, mx.beat * dur_beats, bright), pan=-0.3, gain=gain)

def piano(ms, dur_s, vel=0.7):
    """アコースティック・ピアノ風: 弦のわずかな音程のずれ(2本の弦のうなり)、高い倍音ほど早く消える減衰、ハンマーの当たる音。"""
    if isinstance(ms, (int, np.integer)): ms = [ms]
    key = ('pf', tuple(ms), round(dur_s, 3), vel)
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + 0.35)); t = np.arange(N) / SR; s = np.zeros(N)
    for m in ms:
        f = hz(m); hi = (f / 261.6) ** 0.5; B = 0.00035
        for k in range(1, 13):
            fk = k * f * np.sqrt(1 + B * k * k)
            if fk > 7000: break
            a = (1.0 / k ** 1.15) * (vel ** (0.4 * (k - 1)))
            d = (0.45 + 0.30 * k) * hi
            env = 0.65 * np.exp(-t * d * 2.8) + 0.35 * np.exp(-t * d * 0.55)
            for c in (-0.9, 0.9):
                s += 0.5 * a * env * np.sin(2 * np.pi * fk * 2 ** (c / 1200) * t + k)
        hn = int(SR * 0.012); h = np.random.default_rng(m).standard_normal(hn) * np.exp(-np.arange(hn) / SR * 300)
        s[:hn] += lfilter([0.2, 0.2], [1, -0.6], h) * 0.25 * vel
    s *= np.minimum(1, t / 0.002)
    end = int(SR * dur_s)
    if end < N: s[end:] *= np.exp(-np.arange(N - end) / SR * 14)   # ダンパーで止める
    s /= max(1, len(ms)) ** 0.75
    _cache[key] = s; return s

# ---------- D: おうちのジャズ・バラード(4拍子・ヘ長調、70BPM、32小節 ≒ 110秒) ----------
def vibes(m, dur_s):
    """ビブラフォン風(やさしい金属の響きと、ゆっくりした揺れ)。"""
    key = ('vib', m, round(dur_s, 3))
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + 1.5)); t = np.arange(N) / SR; f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*f*4*t)*np.exp(-t*6) + 0.06*np.sin(2*np.pi*f*10*t)*np.exp(-t*14)
    s *= (1 + 0.25*np.sin(2*np.pi*4.8*t)) * np.minimum(1, t/0.004) * np.exp(-t*1.1)
    end = int(SR * dur_s); s[end:] *= np.linspace(1, 0, N - end) ** 0.5
    _cache[key] = s; return s

def home_ballad(name='bgm_D_home_ballad', bpm=70, tr=0, lead='rhodes', comp_inst='rhodes', groove='ballad', lowpass=4500, post=None):
    BPB = 4
    A1 = [('Fmaj7', [('A4',1),('C5',1),('E5',2)]), ('Em7b5|A7', [('G5',1.5),('F5',.5),('E5',1),('C#5',1)]),
          ('Dm7', [('D5',3),('F5',1)]), ('Cm7|F7', [('Eb5',1.5),('D5',.5),('C5',1),('A4',1)]),
          ('Bbmaj7', [('D5',1),('F5',1),('A5',2)]), ('Bbm6|Eb7', [('G5',1.5),('F5',.5),('Db5',2)]),
          ('Am7|D7', [('C5',1),('E5',1),('F#5',1),('A5',1)]), ('Gm7|C7', [('G5',3),('R',1)])]
    A2 = [('Fmaj7', [('A4',1),('C5',1),('E5',1),('G5',1)]), ('Em7b5|A7', [('Bb5',1.5),('A5',.5),('G5',1),('E5',1)]),
          ('Dm7', [('F5',2),('A5',1),('C6',1)]), ('Cm7|F7', [('Bb5',1.5),('A5',.5),('G5',1),('Eb5',1)]),
          ('Bbmaj7', [('D5',1),('F5',.5),('A5',.5),('C6',2)]), ('Bbm6|Eb7', [('Bb5',1),('G5',1),('Db5',2)]),
          ('Gm7|C7', [('C5',1),('D5',1),('E5',1),('G5',1)]), ('Fmaj7', [('F5',3),('R',1)])]
    B = [('Bbmaj7', [('D6',2),('C6',1),('A5',1)]), ('Am7', [('C6',2),('G5',2)]),
         ('Gm7', [('Bb5',1.5),('A5',.5),('G5',1),('F5',1)]), ('Fmaj7', [('E5',3),('R',1)]),
         ('Bbmaj7', [('F5',1),('A5',1),('D6',1),('C6',1)]), ('Am7|D7', [('A5',2),('F#5',2)]),
         ('Gm7', [('Bb5',1),('A5',1),('G5',1),('D5',1)]), ('C7sus|C7', [('F5',2),('E5',2)])]
    form = A1 + A2 + B + A2; bars = len(form); mx = Mix(bpm, BPB * bars)
    V = {'Fmaj7': ['A3','C4','E4','G4'], 'Em7b5': ['G3','Bb3','D4'], 'A7': ['G3','C#4','E4'], 'Dm7': ['F3','A3','C4','E4'],
         'Cm7': ['Bb3','Eb4','G4'], 'F7': ['A3','Eb4','G4'], 'Bbmaj7': ['A3','D4','F4'], 'Bbm6': ['Db4','F4','G4'], 'Eb7': ['Db4','F4','G4'],
         'Am7': ['G3','C4','E4'], 'D7': ['F#3','C4','E4'], 'Gm7': ['F3','Bb3','D4'], 'C7': ['E3','Bb3','D4'], 'C7sus': ['F3','Bb3','D4']}
    R = {'Fmaj7': 'F2', 'Em7b5': 'E2', 'A7': 'A1', 'Dm7': 'D2', 'Cm7': 'C2', 'F7': 'F2', 'Bbmaj7': 'Bb1', 'Bbm6': 'Bb1', 'Eb7': 'Eb2',
         'Am7': 'A1', 'D7': 'D2', 'Gm7': 'G1', 'C7': 'C2', 'C7sus': 'C2'}
    for b, (c, mel) in enumerate(form):
        base = b * BPB; chords = c.split('|'); per = BPB / len(chords)
        t = 0.0
        for nt, d in mel:
            if nt != 'R':
                at = base + (t if groove == 'bossa' else swing(t, 0.6)); m = n(nt) + tr; L = mx.beat * d * 0.98
                if lead == 'rhodes': mx.add(at, rhodes([m], L, 0.55), pan=0.15, gain=0.30)
                elif lead == 'accordion': mx.add(at, accordion(m - 12, L, reeds=(0.0, 6.0), bright=0.45), pan=0.15, gain=0.24)
                elif lead == 'vibes': mx.add(at, vibes(m, L), pan=0.15, gain=0.26)
                elif lead == 'piano': mx.add(at, piano(m, L * 1.1, 0.75), pan=0.12, gain=0.34)
                elif lead == 'musette':   # 1回目はミュゼットのアコーディオン、2回目(後半)はクラリネット
                    if b >= 16: mx.add(at, clarinet(m - 12, L), pan=0.1, gain=0.26)
                    else: mx.add(at, accordion(m, L, reeds=(0.0, 11.0), bright=0.6), pan=0.15, gain=0.24)
            t += d
        for i, cc in enumerate(chords):
            st = base + i * per; vs = [n(x) + tr for x in V[cc]]; rt = n(R[cc]) + tr
            if rt < n('E1'): rt += 12
            if groove == 'manouche':   # ジプシー・ギターのやさしいラ・ポンプ + ベースは1・3拍
                for q in range(int(per)):
                    strong = (i * per + q) % 2 == 1
                    strum(mx, st + q, vs, 0.8, mute=(0.16 if strong else 0.32), gain=(0.12 if strong else 0.08), down=True)
                mx.add(st, bass(rt, mx.beat * 1.8, decay=1.6), gain=0.19)
                if per == 4: mx.add(st + 2, bass(rt + 7, mx.beat * 1.8, decay=1.6), gain=0.16)
                if lead == 'musette' and b >= 16: mx.add(st, accordion(vs[0], mx.beat * per * 0.95, reeds=(0.0, 6.0), bright=0.35), pan=-0.15, gain=0.05)
            elif groove == 'bossa':
                for p_ in (0, 1.5, 2.5, 3.5):
                    if i * per <= p_ < (i + 1) * per:
                        for j, m in enumerate(vs): mx.add(base + p_ + j * 0.01 / mx.beat, nylon(m, mx.beat * 0.9, seed=j), pan=-0.3, gain=0.11)
                for p_, off in ((0, 0), (2, 7)):
                    if i * per <= p_ < (i + 1) * per or per == 4:
                        if per == 2 and p_ != i * per: continue
                        mx.add(base + p_, bass(rt + (off if per == 4 else 0), mx.beat * 1.6, decay=1.6), gain=0.18)
            else:
                if comp_inst == 'rhodes':
                    comp(mx, st, vs, per * 0.9, gain=0.16)
                    if per == 4: comp(mx, st + 2.6, vs, 1.2, gain=0.08)
                elif comp_inst == 'piano':
                    mx.add(st, piano(vs, mx.beat * per * 0.9, 0.5), pan=-0.12, gain=0.20)
                    if per == 4: mx.add(st + swing(2.5, 0.6), piano(vs[1:], mx.beat * 1.2, 0.4), pan=-0.12, gain=0.09)
                else:   # ナイロンギターで、やさしくアルペジオ
                    k = 0; q = 0.0
                    while q < per - 1e-6:
                        m = vs[[0, 1, 2, 1][k % 4] % len(vs)]
                        mx.add(st + q, nylon(m, mx.beat * 1.4, seed=k), pan=-0.3, gain=0.20); q += 0.5; k += 1
                mx.add(st, bass(rt, mx.beat * per * 0.95, decay=1.2), gain=0.20)
                if per == 4: mx.add(st + 2, bass(rt + 7, mx.beat * 1.9, decay=1.4), gain=0.16)
        for k in range(BPB):
            if groove == 'bossa':
                for h in (0, 0.5): mx.add(base + k + h, shaker(b * 8 + k * 2 + int(h * 2), h == 0), pan=0.4, gain=0.02)
            else:
                mx.add(base + k, brush(0, swirl=True, seed=b * 4 + k), pan=0.35, gain=0.022)
                if k % 2: mx.add(base + k, brush(1, seed=b * 9 + k), pan=0.4, gain=0.022)
    return mx.render(name, lowpass=lowpass, post=post)

# ---------- E: 日曜の午後のボサノバ(4拍子・ハ長調、76BPM、32小節 ≒ 101秒) ----------
def sunday_bossa():
    BPB = 4; bpm = 76
    M = [('Cmaj7', [('E5',1.5),('G5',.5),('B5',2)]), ('Am7', [('A5',1),('G5',1),('E5',2)]),
         ('Dm7', [('F5',1.5),('A5',.5),('C6',1),('A5',1)]), ('G7', [('B5',2),('G5',2)]),
         ('Em7', [('G5',1.5),('B5',.5),('D6',2)]), ('A7', [('C#6',1),('A5',1),('E5',2)]),
         ('Dm7', [('F5',1),('E5',1),('D5',1),('F5',1)]), ('G7', [('B4',3),('R',1)]),
         ('Fmaj7', [('A5',1.5),('G5',.5),('E5',2)]), ('Fm6', [('Ab5',1.5),('G5',.5),('D5',2)]),
         ('Em7', [('G5',1),('E5',1),('B4',2)]), ('A7', [('C#5',1),('E5',1),('G5',1),('A5',1)]),
         ('Dm7', [('F5',2),('A5',1),('C6',1)]), ('G7', [('B5',1.5),('A5',.5),('G5',1),('F5',1)]),
         ('Cmaj7', [('E5',3),('R',1)]), ('G7', [('G5',2),('F5',1),('D5',1)])]
    form = M + M; bars = len(form); mx = Mix(bpm, BPB * bars)
    V = {'Cmaj7': ['E3','G3','B3','D4'], 'Am7': ['E3','G3','C4'], 'Dm7': ['F3','A3','C4','E4'], 'G7': ['F3','B3','D4'],
         'Em7': ['D3','G3','B3'], 'A7': ['G3','C#4','E4'], 'Fmaj7': ['E3','A3','C4'], 'Fm6': ['D3','Ab3','C4']}
    R = {'Cmaj7': 'C3', 'Am7': 'A2', 'Dm7': 'D3', 'G7': 'G2', 'Em7': 'E2', 'A7': 'A2', 'Fmaj7': 'F2', 'Fm6': 'F2'}
    for b, (c, mel) in enumerate(form):
        base = b * BPB; vs = [n(x) for x in V[c]]; second = b >= 16
        t = 0.0
        for nt, d in mel:
            if nt != 'R':
                if second: mx.add(base + t, rhodes([n(nt)], mx.beat * d * 0.98, 0.5), pan=0.15, gain=0.28)
                else: mx.add(base + t, accordion(n(nt) - 12, mx.beat * d * 0.97, reeds=(0.0, 5.0), bright=0.45), pan=0.15, gain=0.26)
            t += d
        for st in (0, 1.5, 2.5, 3.5):   # ボサノバのギター(和音はシンコペーション、親指のベースは1・3拍)
            for i, m in enumerate(vs): mx.add(base + st + i * 0.01 / mx.beat, nylon(m, mx.beat * 0.9, seed=i), pan=-0.3, gain=0.07)
        for st, off in ((0, 0), (2, 7)):
            mx.add(base + st, nylon(n(R[c]) + off - (12 if off else 0), mx.beat * 1.8), pan=-0.2, gain=0.10)
            mx.add(base + st, bass(n(R[c]) - 12 + off, mx.beat * 1.6, decay=1.6), gain=0.17)
        for k in range(8): mx.add(base + k * 0.5, shaker(b * 8 + k, k % 2 == 0), pan=0.4, gain=0.02)
    return mx.render('bgm_E_sunday_bossa', lowpass=4500)

def clarinet(m, dur_s):
    """クラリネット風(奇数倍音中心のやわらかい木管。少し遅れてかかるビブラート)。"""
    key = ('cl', m, round(dur_s, 3))
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + 0.15)); t = np.arange(N) / SR; f = hz(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.25) / 0.4, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.sin(ph) + 0.42 * np.sin(3 * ph) + 0.20 * np.sin(5 * ph) + 0.08 * np.sin(7 * ph) + 0.05 * np.sin(2 * ph)
    s += np.random.default_rng(m).standard_normal(N) * 0.015
    e = np.minimum(1, t / 0.06); end = int(SR * dur_s); e[end:] *= np.linspace(1, 0, N - end)
    _cache[key] = s * e / 1.4; return _cache[key]

# ---------- F: パリのゆったりワルツ(3拍子・イ短調→ハ長調、84BPM、48小節 ≒ 103秒) ----------
def valse_lente():
    BPB = 3; bpm = 84
    A = [('Am', [('E5',1.5),('A5',.5),('C6',1)]), ('Am', [('B5',2),('A5',1)]),
         ('Dm', [('F5',1.5),('A5',.5),('D6',1)]), ('Dm', [('C6',2),('A5',1)]),
         ('E7', [('G#5',1.5),('B5',.5),('D6',1)]), ('E7', [('C6',1),('B5',1),('G#5',1)]),
         ('Am', [('A5',3)]), ('Am', [('E5',2),('C5',1)]),
         ('Am', [('A4',1),('C5',1),('E5',1)]), ('A7', [('G5',2),('C#5',1)]),
         ('Dm', [('D5',1),('F5',1),('A5',1)]), ('Dm', [('D6',2),('C6',1)]),
         ('Am', [('C6',1.5),('B5',.5),('A5',1)]), ('E7', [('B5',1),('G#5',1),('E5',1)]),
         ('Am', [('A5',2),('E5',1)]), ('E7', [('G#5',2),('B4',1)])]
    B = [('C', [('E5',1.5),('G5',.5),('C6',1)]), ('C', [('B5',1),('A5',1),('G5',1)]),
         ('G7', [('F5',1.5),('G5',.5),('B5',1)]), ('G7', [('D6',2),('B5',1)]),
         ('G7', [('A5',1),('G5',1),('F5',1)]), ('G7', [('D5',2),('G5',1)]),
         ('C', [('E5',1),('G5',1),('C6',1)]), ('C7', [('Bb5',2),('G5',1)]),
         ('F', [('A5',1.5),('G5',.5),('F5',1)]), ('Fm', [('Ab5',2),('F5',1)]),
         ('C', [('E5',1),('G5',1),('C6',1)]), ('A7', [('C#6',2),('A5',1)]),
         ('Dm', [('F5',1),('A5',1),('D6',1)]), ('G7', [('B5',1),('A5',1),('G5',1)]),
         ('C', [('E5',3)]), ('E7', [('G#5',1),('B5',1),('D6',1)])]
    form = A + B + A; bars = len(form); mx = Mix(bpm, BPB * bars)
    ch = {'Am': ['A3','C4','E4'], 'Dm': ['A3','D4','F4'], 'E7': ['G#3','B3','D4'], 'A7': ['G3','C#4','E4'],
          'C': ['G3','C4','E4'], 'G7': ['F3','B3','D4'], 'C7': ['G3','Bb3','E4'], 'F': ['A3','C4','F4'], 'Fm': ['Ab3','C4','F4']}
    root = {'Am': ('A1','E2'), 'Dm': ('D2','A1'), 'E7': ('E2','B1'), 'A7': ('A1','E2'), 'C': ('C2','G1'),
            'G7': ('G1','D2'), 'C7': ('C2','G1'), 'F': ('F1','C2'), 'Fm': ('F1','C2')}
    for b, (c, mel) in enumerate(form):
        base = b * BPB; last = b >= 32; t = 0.0
        for nt, d in mel:
            L = mx.beat * d * 0.97
            if last: mx.add(base + t, clarinet(n(nt) - 12, L), pan=0.1, gain=0.27)   # 3回目はクラリネットが歌う
            else: mx.add(base + t, accordion(n(nt), L, reeds=(0.0, 12.0), bright=0.6), pan=0.15, gain=0.25)
            t += d
        notes = [n(x) for x in ch[c]]
        mx.add(base, bass(n(root[c][b % 2]), mx.beat * 1.5, decay=1.5), gain=0.20)
        for k in (1, 2): strum(mx, base + k, notes, 0.9, mute=mx.beat * 0.7, gain=0.09, down=(k == 1))
        if last: mx.add(base, accordion(notes[0], mx.beat * 2.9, reeds=(0.0, 6.0), bright=0.35), pan=-0.2, gain=0.06)
        mx.add(base + 1, brush(0, swirl=True, seed=b), pan=0.4, gain=0.02)
    return mx.render('bgm_F_valse_lente', lowpass=4800)

# ---------- G: 午後のパリのスウィング(4拍子・ト長調、86BPM、32小節 ≒ 89秒。アコーディオンとクラリネット) ----------
def paris_slow_swing():
    BPB = 4; bpm = 86
    A1 = [('G6', [('D5',1),('E5',.5),('G5',.5),('B5',2)]), ('E7', [('G#5',1.5),('B5',.5),('D6',1),('B5',1)]),
          ('Am7', [('C6',1),('B5',.5),('A5',.5),('G5',1),('E5',1)]), ('D7', [('F#5',3),('R',1)]),
          ('G6', [('D5',1),('G5',1),('B5',1),('D6',1)]), ('E7', [('D6',1.5),('B5',.5),('G#5',2)]),
          ('Am7|D7', [('A5',1),('C6',1),('F#5',1),('A5',1)]), ('G6', [('G5',3),('R',1)])]
    A2 = A1[:7] + [('G6', [('G5',2),('R',2)])]
    Br = [('Dm7|G7', [('F5',1),('A5',1),('B5',1),('D6',1)]), ('Cmaj7', [('C6',1.5),('B5',.5),('G5',2)]),
          ('Cm6', [('A5',1),('G5',.5),('Eb5',.5),('C5',2)]), ('G6', [('D5',1),('E5',1),('G5',2)]),
          ('E7', [('B5',1.5),('G#5',.5),('E5',2)]), ('A7', [('C#6',1.5),('A5',.5),('E5',2)]),
          ('Am7', [('C6',1),('A5',1),('G5',1),('E5',1)]), ('D7', [('F#5',2),('A5',1),('C6',1)])]
    form = A1 + A2 + Br + A1; bars = len(form); mx = Mix(bpm, BPB * bars)
    V = {'G6': ['G3','B3','E4'], 'E7': ['G#3','D4','E4'], 'Am7': ['G3','C4','E4'], 'D7': ['F#3','C4','D4'],
         'Dm7': ['F3','A3','C4'], 'G7': ['F3','B3','D4'], 'Cmaj7': ['G3','B3','E4'], 'Cm6': ['G3','A3','Eb4'], 'A7': ['G3','C#4','E4']}
    R = {'G6': 'G2', 'E7': 'E2', 'Am7': 'A1', 'D7': 'D2', 'Dm7': 'D2', 'G7': 'G1', 'Cmaj7': 'C2', 'Cm6': 'C2', 'A7': 'A1'}
    for b, (c, mel) in enumerate(form):
        base = b * BPB; chords = c.split('|'); per = BPB / len(chords); t = 0.0
        sec = b // 8   # 0: アコーディオン 1: クラリネット 2: アコーディオン(低め) 3: 二人で(クラリネットが1オクターブ下で重なる)
        for nt, d in mel:
            if nt != 'R':
                at = base + swing(t, 0.62); en = base + swing(t + d, 0.62); L = mx.beat * (en - at) * 0.95; m = n(nt)
                if sec in (0, 3): mx.add(at, accordion(m, L, reeds=(0.0, 11.0), bright=0.6), pan=0.15, gain=0.24)
                if sec == 1: mx.add(at, clarinet(m - 12, L), pan=0.1, gain=0.28)
                if sec == 2: mx.add(at, accordion(m - 12, L, reeds=(0.0, 8.0), bright=0.5), pan=0.15, gain=0.26)
                if sec == 3: mx.add(at, clarinet(m - 12, L), pan=-0.1, gain=0.10)
            t += d
        for i, cc in enumerate(chords):
            st = base + i * per; vs = [n(x) for x in V[cc]]
            for q in range(int(per)):
                strong = (i * per + q) % 2 == 1
                strum(mx, st + q, vs, 0.8, mute=(0.15 if strong else 0.30), gain=(0.12 if strong else 0.08))
            mx.add(st, bass(n(R[cc]), mx.beat * 1.8, decay=1.6), gain=0.19)
            if per == 4: mx.add(st + 2, bass(n(R[cc]) + 7, mx.beat * 1.8, decay=1.6), gain=0.16)
        for k in range(BPB):
            mx.add(base + k, brush(0, swirl=True, seed=b * 4 + k), pan=0.35, gain=0.02)
            if k % 2: mx.add(base + k, brush(1, seed=b * 9 + k), pan=0.4, gain=0.02)
    return mx.render('bgm_G_paris_slow_swing', lowpass=4800)

# ---------- なつかしい音(ローファイ)の仕上げ: テープの揺れ・レコードのチリノイズ・やわらかい歪み ----------
def lofi(cut=3600, wow=0.0018, crackle=0.010, seed=5):
    def fx(out):
        N = len(out); t = np.arange(N) / SR; T = N / SR
        f1 = max(1, round(0.35 * T)) / T; f2 = max(1, round(5.3 * T)) / T   # 揺れの周期をループの長さにそろえる(つなぎ目が切れない)
        d = wow * (1 + np.sin(2 * np.pi * f1 * t)) + 0.00025 * (1 + np.sin(2 * np.pi * f2 * t))
        src = np.clip(t - d, 0, T - 1 / SR) * SR
        y = np.stack([np.interp(src, np.arange(N), out[:, ch]) for ch in (0, 1)], axis=1)
        y = np.tanh(y / np.max(np.abs(y)) * 1.6) / np.tanh(1.6)
        sos = butter(2, [45, cut], btype='band', fs=SR, output='sos'); y = sosfilt(sos, y, axis=0)
        rng = np.random.default_rng(seed)
        hiss = sosfilt(butter(2, [800, 5000], btype='band', fs=SR, output='sos'), rng.standard_normal(N)) * 0.012
        clicks = np.zeros(N); idx = rng.integers(0, N, int(T * 9)); clicks[idx] = rng.uniform(-1, 1, len(idx))
        clicks = sosfilt(butter(2, [1500, 7000], btype='band', fs=SR, output='sos'), clicks) * 2.5
        noise = (hiss + clicks) * crackle / 0.01
        y[:, 0] += noise; y[:, 1] += np.roll(noise, 331)
        return y
    return fx

def kick():
    N = int(SR * 0.35); t = np.arange(N) / SR; f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * np.minimum(1, t / 0.002)
def snare(seed=0):
    N = int(SR * 0.22); t = np.arange(N) / SR; w = np.random.default_rng(seed).standard_normal(N)
    w = sosfilt(butter(2, [900, 4500], btype='band', fs=SR, output='sos'), w)
    return (w * 2.2 + 0.4 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 22)
def hat(seed=0, open_=False):
    N = int(SR * (0.12 if open_ else 0.05)); t = np.arange(N) / SR; w = np.random.default_rng(seed).standard_normal(N)
    w = sosfilt(butter(2, 6000, btype='high', fs=SR, output='sos'), w)
    return w * np.exp(-t * (25 if open_ else 70))

# ---------- H / I: なつかしい午後(ローファイ・ジャズ、78BPM、32小節 ≒ 98秒) ----------
def nostalgic(name, lead='guitar', post=None, song=None, bpm=78, beat=True):
    BPB = 4
    prog = ['Fmaj9', 'Em7', 'Dm9', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm9', 'C13']
    V = {'Fmaj9': ['A3','C4','E4','G4'], 'Em7': ['G3','B3','D4','E4'], 'Dm9': ['F3','A3','C4','E4'], 'Cmaj7': ['E3','G3','B3','D4'],
         'Bbmaj7': ['F3','A3','D4'], 'Am7': ['G3','C4','E4'], 'Gm9': ['F3','Bb3','D4','A4'], 'C13': ['E3','Bb3','D4','A4']}
    R = {'Fmaj9': 'F2', 'Em7': 'E2', 'Dm9': 'D2', 'Cmaj7': 'C2', 'Bbmaj7': 'Bb1', 'Am7': 'A1', 'Gm9': 'G1', 'C13': 'C2'}
    mel = [[('A5',1.5),('G5',.5),('E5',1),('C5',1)], [('D5',1),('E5',.5),('G5',1.5),('R',1)],
           [('F5',1.5),('E5',.5),('D5',1),('A4',1)], [('B4',1),('C5',.5),('E5',2.5)],
           [('D5',1.5),('F5',.5),('A5',1),('G5',1)], [('E5',2),('C5',1),('E5',1)],
           [('F5',1),('D5',1),('Bb4',1),('A4',1)], [('G4',2),('R',2)]]
    mel2 = [[('C6',1.5),('A5',.5),('G5',1),('E5',1)], [('G5',1),('E5',.5),('D5',1.5),('R',1)],
            [('A5',1.5),('F5',.5),('E5',1),('C5',1)], [('D5',1),('E5',.5),('G5',2.5)],
            [('F5',1.5),('A5',.5),('C6',1),('A5',1)], [('G5',2),('E5',1),('C5',1)],
            [('D5',1),('F5',1),('A5',1),('G5',1)], [('E5',2),('R',2)]]
    if song is not None: prog, V, R, mel, mel2 = song['prog'], song['V'], song['R'], song['mel'], song['mel2']
    bars = 32; mx = Mix(bpm, BPB * bars)
    for b in range(bars):
        base = b * BPB; sec = b // 8; c = prog[b % 8]; vs = [n(x) for x in V[c]]; rt = n(R[c])
        # エレピの和音(1拍目と、3拍目の裏で軽く)
        if lead == 'piano':   # 左手: 低いベース音 + 和音、右手の飾り
            mx.add(base, piano(rt + 12, mx.beat * 3.6, 0.5), pan=-0.2, gain=0.16)
            mx.add(base + 0.5, piano(vs, mx.beat * 3.2, 0.45), pan=-0.15, gain=0.17)
            mx.add(base + swing(3.5, 0.6), piano(vs[1:], mx.beat * 0.5, 0.35), pan=-0.15, gain=0.06)
        else:
            mx.add(base, rhodes(vs, mx.beat * 3.3, 0.35), pan=-0.25, gain=0.17)
            mx.add(base + 3.5, rhodes(vs[1:], mx.beat * 0.5, 0.3), pan=-0.25, gain=0.07)
        # ギターのつまびき(和音の音を順に、ゆっくり)
        if lead == 'piano':
            if sec == 0:   # はじめは右手で和音の音を静かに分散
                for k, (pos, idx) in enumerate([(1, 0), (1.75, 2), (2.5, 3), (3.25, 1)]):
                    mx.add(base + swing(pos, 0.6), piano(vs[idx % len(vs)] + 12, mx.beat * 1.2, 0.45), pan=0.2, gain=0.11)
        elif sec != 2 or lead != 'guitar':
            for k, (pos, idx) in enumerate([(0, 0), (0.75, 2), (1.5, 3), (2.5, 1), (3.25, 2)]):
                m = vs[idx % len(vs)] + 12
                mx.add(base + swing(pos, 0.6), guitar(m, mx.beat * 1.5, mute=mx.beat * 1.3, seed=k), pan=0.35, gain=0.13)
        if sec >= 1 and beat:   # ゆるいビートとベース
            mx.add(base, kick(), gain=0.13); mx.add(base + 2.62, kick(), gain=0.08)
            mx.add(base + 1, snare(b * 2), pan=0.05, gain=0.06); mx.add(base + 3, snare(b * 2 + 1), pan=0.05, gain=0.06)
            for h in range(8): mx.add(base + swing(h * 0.5, 0.6), hat(b * 8 + h), pan=0.3, gain=(0.035 if h % 2 == 0 else 0.022))
            mx.add(base, bass(rt, mx.beat * 2.4, decay=0.9), gain=0.16)
            mx.add(base + 3.5, bass(rt + 7 - 12 if rt + 7 - 12 >= n('E1') else rt + 7, mx.beat * 0.45, decay=3), gain=0.12)
        elif sec >= 1:   # ビートなし: ベースだけ静かに
            mx.add(base, bass(rt, mx.beat * 3.5, decay=0.7), gain=0.14)
        if not beat and lead == 'piano' and sec == 1:   # ビートなしの2周目は、右手の分散和音を少し高く
            for k, (pos, idx) in enumerate([(1, 1), (1.75, 3), (2.5, 2), (3.25, 0)]):
                mx.add(base + swing(pos, 0.6), piano(vs[idx % len(vs)] + 12, mx.beat * 1.2, 0.45), pan=0.2, gain=0.10)
        if sec >= 2:   # 旋律
            line = mel if sec == 2 else mel2; t = 0.0
            for nt, d in line[b % 8]:
                if nt != 'R':
                    at = base + swing(t, 0.6); L = mx.beat * d * 0.96; m = n(nt)
                    if lead == 'guitar': mx.add(at, guitar(m, L + 0.6, mute=L, seed=int(t * 4)), pan=0.1, gain=0.34)
                    elif lead == 'piano': mx.add(at, piano(m + (12 if sec == 3 else 0), L * 1.1, 0.7), pan=0.12, gain=0.30)
                    else: mx.add(at, accordion(m - 12 if sec == 2 else m, L, reeds=(0.0, 9.0), bright=0.5), pan=0.1, gain=0.30)
                t += d
    return mx.render(name, lowpass=6000, post=post if post is not None else lofi())

# ---------- K のバリエーション用の曲(どれも新しく作曲。8小節の和音と、2通りの旋律) ----------
SONG_RAIN = dict(   # K2: 雨の日の窓辺(変ホ長調)
    prog=['Abmaj9', 'Gm7', 'Fm9', 'Bb13', 'Ebmaj7', 'Cm9', 'Fm9', 'Bb7sus'],
    V={'Abmaj9': ['G3','Bb3','C4','Eb4'], 'Gm7': ['F3','Bb3','D4'], 'Fm9': ['Eb3','G3','Ab3','C4'], 'Bb13': ['Ab3','D4','G4'],
       'Ebmaj7': ['G3','Bb3','D4'], 'Cm9': ['Eb3','G3','Bb3','D4'], 'Bb7sus': ['Ab3','C4','Eb4']},
    R={'Abmaj9': 'Ab1', 'Gm7': 'G1', 'Fm9': 'F1', 'Bb13': 'Bb1', 'Ebmaj7': 'Eb2', 'Cm9': 'C2', 'Bb7sus': 'Bb1'},
    mel=[[('C5',1),('Eb5',.5),('G5',1.5),('F5',1)], [('D5',2),('Bb4',1),('D5',1)], [('Eb5',1.5),('C5',.5),('Ab4',1),('G4',1)],
         [('G4',1),('Ab4',.5),('C5',2.5)], [('Bb4',1),('D5',.5),('G5',1.5),('F5',1)], [('Eb5',2),('D5',1),('Bb4',1)],
         [('C5',1),('Eb5',1),('G5',1),('Ab5',1)], [('G5',2),('R',2)]],
    mel2=[[('Eb5',1.5),('G5',.5),('Bb5',1),('G5',1)], [('F5',2),('D5',1),('R',1)], [('Ab5',1.5),('G5',.5),('Eb5',1),('C5',1)],
          [('D5',1),('Eb5',.5),('F5',2.5)], [('G5',1.5),('Bb5',.5),('D6',1),('Bb5',1)], [('G5',2),('Eb5',1),('D5',1)],
          [('C5',1),('Eb5',1),('F5',1),('Ab5',1)], [('G5',2),('F5',1),('R',1)]])
SONG_DUSK = dict(   # K3: 夕暮れの思い出(イ短調)
    prog=['Am9', 'Dm9', 'G13', 'Cmaj9', 'Fmaj7', 'Bm7b5', 'E7b9', 'E7'],
    V={'Am9': ['G3','B3','C4','E4'], 'Dm9': ['F3','A3','C4','E4'], 'G13': ['F3','B3','E4'], 'Cmaj9': ['E3','G3','B3','D4'],
       'Fmaj7': ['E3','A3','C4'], 'Bm7b5': ['A3','D4','F4'], 'E7b9': ['G#3','D4','F4'], 'E7': ['G#3','B3','D4']},
    R={'Am9': 'A1', 'Dm9': 'D2', 'G13': 'G1', 'Cmaj9': 'C2', 'Fmaj7': 'F1', 'Bm7b5': 'B1', 'E7b9': 'E2', 'E7': 'E2'},
    mel=[[('E5',1),('C5',.5),('B4',1.5),('A4',1)], [('C5',1.5),('D5',.5),('F5',2)], [('E5',1),('D5',.5),('B4',1.5),('G4',1)],
         [('B4',2),('C5',1),('E5',1)], [('A5',1.5),('G5',.5),('E5',1),('C5',1)], [('D5',1.5),('F5',.5),('A5',2)],
         [('G#5',1),('F5',1),('D5',1),('B4',1)], [('G#4',2),('R',2)]],
    mel2=[[('A5',1),('G5',.5),('E5',1.5),('C5',1)], [('F5',1.5),('E5',.5),('D5',2)], [('B5',1),('A5',.5),('G5',1.5),('D5',1)],
          [('E5',2),('R',1),('G5',1)], [('C6',1.5),('B5',.5),('A5',1),('E5',1)], [('F5',1.5),('A5',.5),('C6',2)],
          [('B5',1),('G#5',1),('F5',1),('D5',1)], [('E5',2),('R',2)]])
SONG_MORNING = dict(   # K4: 日だまりの朝(ト長調)
    prog=['Cmaj9', 'Bm7', 'Am9', 'D13', 'Gmaj9', 'Em9', 'Am9', 'D7sus'],
    V={'Cmaj9': ['E3','G3','B3','D4'], 'Bm7': ['A3','D4','F#4'], 'Am9': ['G3','B3','C4','E4'], 'D13': ['F#3','B3','C4','E4'],
       'Gmaj9': ['F#3','A3','B3','D4'], 'Em9': ['G3','B3','D4','F#4'], 'D7sus': ['G3','C4','E4']},
    R={'Cmaj9': 'C2', 'Bm7': 'B1', 'Am9': 'A1', 'D13': 'D2', 'Gmaj9': 'G1', 'Em9': 'E2', 'D7sus': 'D2'},
    mel=[[('G5',1),('E5',.5),('D5',1.5),('B4',1)], [('A4',1),('B4',.5),('D5',2.5)], [('E5',1),('G5',.5),('B5',1.5),('A5',1)],
         [('F#5',2),('E5',1),('D5',1)], [('B4',1),('D5',.5),('F#5',1.5),('A5',1)], [('G5',2),('F#5',1),('E5',1)],
         [('C5',1),('E5',1),('G5',1),('B5',1)], [('A5',2),('R',2)]],
    mel2=[[('B5',1.5),('A5',.5),('G5',1),('E5',1)], [('F#5',1),('D5',.5),('B4',1.5),('R',1)], [('C5',1),('E5',.5),('A5',1.5),('G5',1)],
          [('F#5',1),('A5',1),('C6',1),('B5',1)], [('A5',1.5),('F#5',.5),('D5',1),('B4',1)], [('E5',2),('G5',1),('B5',1)],
          [('A5',1),('G5',1),('E5',1),('C5',1)], [('D5',2),('R',2)]])

# =====================================================================================
#  ヒーリング(リラックス)系: パッド・ハープ・チェレスタ・フルート・シンギングボウル・小川の音。ビートなし。
# =====================================================================================
def pad(ms, dur_s, attack=1.8, release=2.5, warm=1.7):
    key = ('pad', tuple(ms), round(dur_s, 3), attack, release, warm)
    if key in _cache: return _cache[key]
    N = int(SR * (dur_s + release)); t = np.arange(N) / SR; s = np.zeros(N)
    for m in ms:
        for c in (-7, -2.5, 2.5, 7):
            f = hz(m) * 2 ** (c / 1200); ph = 2 * np.pi * f * t + c
            for k in range(1, 9):
                if f * k > 5000: break
                s += np.sin(k * ph) / k ** warm
    e = np.minimum(1, t / attack) ** 2; end = int(SR * dur_s); e[end:] *= np.exp(-np.arange(N - end) / SR * 4 / release)
    s *= e * (1 + 0.06 * np.sin(2 * np.pi * 0.13 * t)) / (4 * len(ms))
    _cache[key] = s; return s
def harp(m):
    key = ('harp', m)
    if key in _cache: return _cache[key]
    N = int(SR * 3.0); t = np.arange(N) / SR; f = hz(m)
    s = (np.sin(2*np.pi*f*t) + 0.4*np.sin(4*np.pi*f*t)*np.exp(-t*3) + 0.15*np.sin(6*np.pi*f*t)*np.exp(-t*5)) * np.exp(-t*1.3) * np.minimum(1, t/0.004)
    _cache[key] = s; return s
def celesta(m):
    key = ('cel', m)
    if key in _cache: return _cache[key]
    N = int(SR * 3.0); t = np.arange(N) / SR; f = hz(m)
    s = (np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*f*4*t)*np.exp(-t*8) + 0.10*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*5)) * np.exp(-t*1.4) * np.minimum(1, t/0.002)
    _cache[key] = s; return s
def flute(m, dur_s):
    N = int(SR * (dur_s + 0.6)); t = np.arange(N) / SR; f = hz(m)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 5.0 * t) * np.minimum(1, t / 0.6)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    br = sosfilt(butter(2, [f, min(f * 4, 9000)], btype='band', fs=SR, output='sos'), np.random.default_rng(m).standard_normal(N)) * 0.08
    s = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph) + br
    e = np.minimum(1, t / 0.15); end = int(SR * dur_s); e[end:] *= np.linspace(1, 0, N - end) ** 2
    return s * e
def bowl(m):
    key = ('bowl', m)
    if key in _cache: return _cache[key]
    N = int(SR * 9); t = np.arange(N) / SR; f = hz(m); s = np.zeros(N)
    for r, a, d in ((1.0, 1.0, 0.35), (2.71, 0.45, 0.6), (5.15, 0.18, 1.1)):
        s += a * np.sin(2 * np.pi * f * r * t) * (1 + 0.3 * np.sin(2 * np.pi * (1.1 + r * 0.4) * t)) * np.exp(-t * d)
    s *= np.minimum(1, t / 0.01); _cache[key] = s; return s
def stream(mx, gain=0.03, seed=3):
    """小川のせせらぎ・そよ風(ループ全体に、周期をそろえたゆらぎで)。"""
    N = len(mx.buf); T = mx.loop / SR; t = np.arange(N) / SR; rng = np.random.default_rng(seed)
    for ch in (0, 1):
        w = rng.standard_normal(N)
        w = sosfilt(butter(2, [400, 2500], btype='band', fs=SR, output='sos'), w)
        mod = 0.6 + 0.25 * np.sin(2 * np.pi * round(T / 7) / T * t + ch) + 0.15 * np.sin(2 * np.pi * round(T / 2.3) / T * t * 1.0 + 2 * ch)
        mx.buf[:, ch] += w * mod * gain

def _arp(mx, base, notes, pattern, inst, gain, pan):
    for pos, idx in pattern:
        m = notes[idx % len(notes)] + 12 * (idx // len(notes))
        mx.add(base + pos, inst(m), pan=pan, gain=gain)

# ---------- M1: 森の静けさ(ニ長調、60BPM、24小節 ≒ 96秒。パッド・ハープ・フルート・小川) ----------
def healing_forest():
    BPB = 4; mx = Mix(60, BPB * 24, tail=10)
    cyc = [('D', ['D3','A3','E4','F#4'], ['D4','F#4','A4','E5']), ('Bm', ['B2','F#3','A3','D4','E4'], ['B3','D4','F#4','A4']),
           ('G', ['G2','D3','F#3','A3','B3'], ['G3','B3','D4','F#4']), ('Asus', ['A2','E3','B3','D4'], ['A3','D4','E4','B4'])]
    mel = [[('F#5',2),('A5',2)], [('E5',3),('R',1)], [('D5',2),('F#5',1),('E5',1)], [('B4',3),('R',1)],
           [('D5',1.5),('E5',.5),('F#5',2)], [('A5',4)], [('B5',2),('A5',1),('E5',1)], [('E5',4)],
           [('A5',2),('B5',1),('A5',1)], [('F#5',3),('R',1)], [('E5',2),('D5',1),('B4',1)], [('D5',2),('E5',2)],
           [('F#5',2),('D5',2)], [('B4',3),('R',1)], [('A4',2),('B4',1),('D5',1)], [('E5',4)]]
    pat = [(0, 0), (0.5, 1), (1, 2), (1.5, 3), (2, 4), (2.5, 3), (3, 2), (3.5, 1)]
    for b in range(24):
        base = b * BPB; name, pv, ar = cyc[(b // 2) % 4]
        if b % 2 == 0: mx.add(base, pad([n(x) for x in pv], mx.beat * 8 - 0.5), gain=0.30)
        _arp(mx, base, [n(x) for x in ar], pat if b % 2 == 0 else pat[:6], harp, 0.10, -0.25)
        if b >= 8:
            t = 0.0
            for nt, d in mel[b - 8]:
                if nt != 'R':
                    mx.add(base + t, flute(n(nt), mx.beat * d * 0.95), pan=0.15, gain=0.16)
                    if b >= 16: mx.add(base + t, celesta(n(nt) + 12), pan=0.3, gain=0.05)
                t += d
    stream(mx, 0.025)
    return mx.render('bgm_M1_healing_forest', lowpass=6000, post=lambda x: x, verb=(3.2, 0.35))

# ---------- M2: 水面のひかり(ヘ・リディア、56BPM、24小節 ≒ 103秒。ピアノ・チェレスタ・パッド) ----------
def healing_water():
    BPB = 4; mx = Mix(56, BPB * 24, tail=10)
    cyc = [('Fmaj9', ['F2','C3','E3','G3','A3'], ['F3','C4','G4','A4','E5']), ('G/F', ['F2','D3','G3','B3'], ['G3','D4','B4','D5','A4']),
           ('Em7', ['E2','B2','D3','G3'], ['E3','B3','D4','G4','B4']), ('Am9', ['A2','E3','G3','B3','C4'], ['A3','E4','B4','C5','G4'])]
    mel = [[('C6',2),('A5',2)], [('G5',3),('R',1)], [('B5',2),('D6',1),('B5',1)], [('A5',4)],
           [('G5',2),('E5',2)], [('D5',1),('E5',1),('G5',2)], [('C6',2),('B5',1),('A5',1)], [('E5',4)]]
    pat = [(0, 0), (1, 1), (1.5, 2), (2.5, 3), (3, 4)]
    for b in range(24):
        base = b * BPB; name, pv, ar = cyc[(b // 2) % 4]
        if b % 2 == 0: mx.add(base, pad([n(x) for x in pv], mx.beat * 8 - 0.5, attack=2.5, warm=2.0), gain=0.26)
        _arp(mx, base, [n(x) for x in ar], pat, lambda m: piano(m, mx.beat * 2.5, 0.4), 0.13, -0.2)
        if b >= 8:
            t = 0.0
            for nt, d in mel[(b - 8) % 8]:
                if nt != 'R':
                    m = n(nt) - (12 if b >= 16 else 0)
                    mx.add(base + t, piano(m, mx.beat * d * 1.05, 0.55), pan=0.15, gain=0.22)
                    if b >= 16: mx.add(base + t, celesta(n(nt) + 12), pan=0.35, gain=0.06)
                t += d
        if b % 4 == 3: mx.add(base + 3.5, celesta(n(ar[-1]) + 12), pan=0.4, gain=0.05)
    return mx.render('bgm_M2_healing_water', lowpass=6000, post=lambda x: x, verb=(3.6, 0.40))

# ---------- M3: ゆらぎ(ハ長調、50BPM、32小節 ≒ 154秒。パッドの持続音・シンギングボウル・チェレスタ・そよ風) ----------
def healing_drift():
    BPB = 4; mx = Mix(50, BPB * 32, tail=12)
    cyc = [('Cadd9', ['C3','G3','D4','E4']), ('Am9', ['A2','E3','G3','B3','C4']), ('Fmaj9#11', ['F2','C3','E3','G3','B3']), ('G6/9sus', ['G2','D3','E3','A3','C4'])]
    penta = ['C5','D5','E5','G5','A5','C6','D6','E6']
    rng = np.random.default_rng(42)
    for b in range(32):
        base = b * BPB; name, pv = cyc[(b // 4) % 4]
        if b % 4 == 0:
            mx.add(base, pad([n(x) for x in pv], mx.beat * 16 - 0.5, attack=3.5, release=4.0, warm=2.1), gain=0.32)
            mx.add(base, bowl(n(pv[0]) + 12), pan=-0.2, gain=0.10)
        for k in range(2):   # ときどき、ぽつんと鳴るチェレスタ
            if rng.random() < 0.55:
                pos = k * 2 + rng.choice([0, 0.5, 1, 1.5]); m = n(penta[rng.integers(0, len(penta))])
                mx.add(base + pos, celesta(m), pan=float(rng.uniform(-0.5, 0.5)), gain=0.07)
        if b % 8 == 6: mx.add(base + 2, bowl(n(pv[1]) + 12), pan=0.3, gain=0.06)
    stream(mx, 0.018, seed=8)
    return mx.render('bgm_M3_healing_drift', lowpass=5500, post=lambda x: x, verb=(4.5, 0.45))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[2:] or ['A', 'B', 'C', 'D', 'E']
    table = {'A': musette_waltz, 'B': cafe_swing, 'C': tiptoe_minor, 'D': home_ballad, 'E': sunday_bossa,
             # D のバリエーション
             'D1': lambda: home_ballad('bgm_D1_ballad_accordion', bpm=68, lead='accordion'),
             'D2': lambda: home_ballad('bgm_D2_ballad_vibes_guitar', bpm=66, lead='vibes', comp_inst='nylon'),
             'D3': lambda: home_ballad('bgm_D3_ballad_bossa', bpm=74, groove='bossa'),
             'D4': lambda: home_ballad('bgm_D4_ballad_night_slow', bpm=60, tr=-3, lowpass=3800),
             # フレンチ・ジャズ調(ゆったり)
             'D5': lambda: home_ballad('bgm_D5_ballad_french', bpm=68, lead='musette', groove='manouche', lowpass=4800),
             'F': valse_lente, 'G': paris_slow_swing,
             # なつかしい雰囲気(ローファイ仕上げ)
             'H': lambda: nostalgic('bgm_H_nostalgic_guitar', lead='guitar'),
             'I': lambda: nostalgic('bgm_I_nostalgic_accordion', lead='accordion'),
             'J': lambda: home_ballad('bgm_J_french_ballad_lofi', bpm=66, lead='musette', groove='manouche', lowpass=5200, post=lofi(cut=3400)),
             # ピアノ(チリチリ音なし。テープの揺れだけ少し)
             'K': lambda: nostalgic('bgm_K_nostalgic_piano', lead='piano', post=lofi(cut=5000, wow=0.0012, crackle=0)),
             'K2': lambda: nostalgic('bgm_K2_rainy_window', lead='piano', song=SONG_RAIN, bpm=72, post=lofi(cut=5000, wow=0.0012, crackle=0)),
             'K3': lambda: nostalgic('bgm_K3_dusk_memory', lead='piano', song=SONG_DUSK, bpm=70, post=lofi(cut=4800, wow=0.0014, crackle=0)),
             'K4': lambda: nostalgic('bgm_K4_sunny_morning', lead='piano', song=SONG_MORNING, bpm=82, post=lofi(cut=5200, wow=0.0010, crackle=0)),
             'K5': lambda: nostalgic('bgm_K5_nostalgic_piano_quiet', lead='piano', bpm=72, beat=False, post=lofi(cut=5000, wow=0.0012, crackle=0)),
             'M1': healing_forest, 'M2': healing_water, 'M3': healing_drift,
             'L': lambda: home_ballad('bgm_L_piano_trio_ballad', bpm=66, lead='piano', comp_inst='piano', lowpass=5500, post=lofi(cut=5200, wow=0.0010, crackle=0))}
    for k in which: print(table[k]())
