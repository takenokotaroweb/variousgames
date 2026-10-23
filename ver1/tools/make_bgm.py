"""ゲームの BGM を合成する(web/ の外に置く道具)。外部の音源・サンプル・既存の曲は使っていない。

曲: 「宇宙パトロールのテーマ」(本ゲーム用に作曲)。ピコピコしたテクノポップ調。
    イ短調・140BPM・32小節(約55秒)をくり返す。
    矩形波(ピコピコ音)の旋律、オクターブで跳ねるベース、16分音符のアルペジオ、電子ドラム。
    1周目(A→B)は旋律1本、2周目(A→B')は旋律を少しずらした2本重ねで厚くする。

使い方(リポジトリのルートで。numpy と ffmpeg が必要):
    python tools/make_bgm.py web/audio
    → web/audio/bgm.mp3(128kbps ステレオ、約 -20 LUFS)

曲を替えたら game.js の 'audio/bgm.mp3?v=' の番号を上げること(端末に古い曲が残らないように)。
"""
import os, sys, wave, subprocess
import numpy as np

SR = 44100
BPM = 140
BEAT = 60.0 / BPM
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(s):                      # 'C5' 'G#4' 'Bb3'
    k = NOTE[s[0]]; i = 1
    if s[i] == '#': k += 1; i += 1
    elif s[i] == 'b': k -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + k
def hz(m): return 440.0 * 2 ** ((m - 69) / 12.0)

# ---------------- 音色 ----------------
def pulse(freq, dur, duty=0.5, vib=0.0):
    n = int(SR * dur); t = np.arange(n) / SR
    f = freq * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.12) * 4, 0, 1))
    ph = np.cumsum(f) / SR
    x = np.where((ph % 1.0) < duty, 1.0, -1.0)
    # ごく軽いローパス(耳に痛い高音を少し丸める)
    y = np.empty_like(x); a = 0.35; acc = 0.0
    for i in range(n):
        acc += a * (x[i] - acc); y[i] = acc
    return y
def tri(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    ph = (freq * t) % 1.0
    return 4 * np.abs(ph - 0.5) - 1
def env(n, a=0.004, d=0.08, s=0.6, r=0.03):
    e = np.ones(n); ia = max(1, int(SR * a)); idd = max(1, int(SR * d)); ir = max(1, int(SR * r))
    e[:ia] = np.linspace(0, 1, ia)
    e[ia:ia + idd] = np.linspace(1, s, len(e[ia:ia + idd]))
    e[ia + idd:] = s
    e[-ir:] *= np.linspace(1, 0, ir)
    return e
rng = np.random.RandomState(3)
def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))

def kick():
    d = 0.22; n = int(SR * d); t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
def snare():
    d = 0.16; n = int(SR * d); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    nz = noise(d); nz = nz - np.concatenate([[0], nz[:-1]]) * 0.6
    return body + nz * np.exp(-t * 22) * 0.7
def hat(open_=False):
    d = 0.12 if open_ else 0.035; n = int(SR * d); t = np.arange(n) / SR
    nz = noise(d); nz = nz - np.concatenate([[0], nz[:-1]])   # 高い音だけ残す
    return nz * np.exp(-t * (18 if open_ else 90)) * 0.5

# ---------------- 楽譜 ----------------
# 和音(1小節ずつ)
CH = {'Am': ['A', 'C', 'E'], 'F': ['F', 'A', 'C'], 'C': ['C', 'E', 'G'], 'G': ['G', 'B', 'D'],
      'E': ['E', 'G#', 'B'], 'Dm': ['D', 'F', 'A']}
PROG_A = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E']
PROG_B = ['Dm', 'Am', 'F', 'C', 'Dm', 'Am', 'E', 'E']
# 旋律: 1小節を8分音符8つで書く。'-' は前の音をのばす、'.' は休み
MEL_A = [
    'A4 C5 E5 A5 G5 E5 - .',
    'F5 - E5 C5 A4 C5 - .',
    'G4 C5 E5 G5 A5 G5 E5 C5',
    'D5 - - B4 G4 - . .',
    'A4 C5 E5 A5 B5 A5 - E5',
    'F5 - A5 - C6 A5 F5 -',
    'G5 - D5 G5 B5 - A5 G5',
    'G#5 - - - E5 - . .',
]
MEL_B = [
    'D5 F5 A5 - F5 D5 F5 -',
    'E5 - C5 - A4 C5 E5 -',
    'F5 - G5 - A5 - C6 -',
    'G5 - E5 C5 E5 G5 - .',
    'A5 - F5 D5 F5 A5 D6 -',
    'C6 - B5 A5 E5 - A5 -',
    'B5 - G#5 E5 G#5 B5 D6 -',
    'E6 - - - B5 G#5 E5 B4',
]
# 2周目の最後(B')は、頭に戻る前に下がって終わる
MEL_B2_END = 'E6 - D6 B5 G#5 E5 D5 B4'

def parse(bars):
    notes = []                                          # (拍, 音, 長さ[拍])
    for b, line in enumerate(bars):
        toks = line.split()
        assert len(toks) == 8, line
        for i, tk in enumerate(toks):
            if tk in ('-', '.'):
                continue
            ln = 1
            while i + ln < 8 and toks[i + ln] == '-':
                ln += 1
            notes.append((b * 4 + i * 0.5, midi(tk), ln * 0.5))
    return notes

BARS = 32
TOTAL = int(SR * BEAT * 4 * BARS)
buf = np.zeros((TOTAL + SR * 2, 2))
def add(beat, sig, gain=1.0, pan=0.0):
    i = int(round(beat * BEAT * SR))
    l = gain * np.cos((pan + 1) * np.pi / 4); r = gain * np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * l; buf[i:i + len(sig), 1] += sig * r

prog = PROG_A + PROG_B + PROG_A + PROG_B
mel = parse(MEL_A + MEL_B + MEL_A + MEL_B[:7] + [MEL_B2_END])

# 旋律(ピコピコの矩形波。少しビブラート)。2周目は少しずらした2本目を重ねて厚くする
for (bt, m, ln) in mel:
    d = ln * BEAT * 0.92
    s = pulse(hz(m), d, 0.5, vib=0.006) * env(int(SR * d), d=0.1, s=0.55)
    add(bt, s, 0.20, -0.1)
    if bt >= 64:
        s2 = pulse(hz(m) * 1.004, d, 0.25) * env(int(SR * d), d=0.1, s=0.5)
        add(bt + 0.03, s2, 0.09, 0.35)

# アルペジオ(16分音符で和音の音を上がり下がり。細い矩形波)
pat = [0, 1, 2, 3, 2, 1, 0, 1]                 # 3=1オクターブ上の根音
for bar, ch in enumerate(prog):
    names = CH[ch]
    tones = sorted(midi(nm + '5') for nm in names)
    tones = [tones[0], tones[1], tones[2], tones[0] + 12]
    for k in range(16):
        m = tones[pat[k % 8]]
        d = BEAT / 4 * 0.7
        s = pulse(hz(m), d, 0.125) * env(int(SR * d), d=0.03, s=0.3, r=0.01)
        add(bar * 4 + k * 0.25, s, 0.06, 0.45 if (k // 4) % 2 == 0 else -0.45)

# ベース(8分音符で低い根音と1オクターブ上を交互に。三角波＋細い矩形波)
for bar, ch in enumerate(prog):
    root = midi(CH[ch][0] + '2')
    if root < midi('E2'):
        root += 12
    for k in range(8):
        m = root + (12 if k % 2 else 0)
        d = BEAT / 2 * 0.8
        s = (tri(hz(m), d) * 0.8 + pulse(hz(m), d, 0.25) * 0.25) * env(int(SR * d), d=0.06, s=0.6, r=0.02)
        add(bar * 4 + k * 0.5, s, 0.22, 0.0)

# 電子ドラム(1・3拍目にキック、2・4拍目にスネア、8分の裏にハイハット)。8小節ごとに小さなフィル
for bar in range(BARS):
    for beat in range(4):
        b = bar * 4 + beat
        if beat in (0, 2):
            add(b, kick(), 0.55)
        if beat in (1, 3):
            add(b, snare(), 0.22)
        add(b + 0.5, hat(open_=(beat == 3)), 0.10, 0.2)
        add(b, hat(), 0.05, -0.2)
    if bar % 8 == 7:
        for k in range(4):
            add(bar * 4 + 3 + k * 0.25, snare(), 0.10 + k * 0.03)
    if bar % 8 == 0:
        add(bar * 4, hat(open_=True), 0.16, 0.0)     # 区切りのシンバル代わり

# くり返しのつなぎ目: はみ出した音の尻尾を頭に重ねる
tail = buf[TOTAL:]; buf[:len(tail)] += tail
out = buf[:TOTAL]
out = out / np.max(np.abs(out)) * 0.6

os.makedirs(OUT, exist_ok=True)
wav = os.path.join(OUT, 'bgm.wav'); mp3 = os.path.join(OUT, 'bgm.mp3')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
# 音の大きさをそろえる(約 -20 LUFS)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-20:TP=-2:LRA=11:linear=true',
                '-ar', '44100', '-b:a', '128k', mp3], check=True)
os.remove(wav)
print(mp3, os.path.getsize(mp3) // 1024, 'KB', '%.1f sec' % (TOTAL / SR))
