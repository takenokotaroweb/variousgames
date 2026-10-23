"""ゲームオーバーのジングルを合成する(web/ の外に置く道具)。外部の音源・サンプル・既存の曲は使っていない。

曲: 本ゲーム用に、2秒の長さで作曲した短い曲(ver10)。BGM と同じイ短調・ピコピコした音色。
    120BPM の4拍(ちょうど2秒)。
      1拍目   「ミ・ド・ラ」と和音(Am)を駆け下りる
      2拍目   「レ・シ・ソ♯」と和音(E)を駆け下りる(1拍目への返事)
      3〜4拍目 低い「ラ」の和音を鳴らし、音程を少し下げながら消えていく。
               上に「電源が切れていく」ような下がる音を重ねて、ゲームオーバーと分かる形にする

使い方(リポジトリのルートで。numpy と ffmpeg が必要):
    python tools/make_jingle.py web/audio
    → web/audio/gameover.mp3(128kbps ステレオ、約 -20 LUFS = BGM と同じ大きさ)

曲を替えたら game.js の 'audio/gameover.mp3?v=' の番号を上げること。
"""
import os, sys, wave, subprocess
import numpy as np

SR = 44100
BPM = 120
BEAT = 60.0 / BPM                 # 1拍 0.5秒
BEATS = 4                         # 4拍 = 2秒
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(s):
    k = NOTE[s[0]]; i = 1
    if s[i] == '#': k += 1; i += 1
    elif s[i] == 'b': k -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + k
def hz(m): return 440.0 * 2 ** ((m - 69) / 12.0)

# ---------------- 音色(BGM と同じ考え方の矩形波・三角波) ----------------
def pulse(freq, dur, duty=0.5, drop=0.0):
    """drop: 音の後半で下げる量(半音)。最後の音を「しぼむ」ように下げるのに使う"""
    n = int(SR * dur); t = np.arange(n) / SR
    f = freq * (2 ** (drop * np.clip((t - dur * 0.3) / (dur * 0.7), 0, 1) / 12.0))
    ph = np.cumsum(f) / SR
    x = np.where((ph % 1.0) < duty, 1.0, -1.0)
    y = np.empty_like(x); a = 0.35; acc = 0.0
    for i in range(n):
        acc += a * (x[i] - acc); y[i] = acc
    return y
def tri(freq, dur, drop=0.0):
    n = int(SR * dur); t = np.arange(n) / SR
    f = freq * (2 ** (drop * np.clip((t - dur * 0.3) / (dur * 0.7), 0, 1) / 12.0))
    ph = np.cumsum(f) / SR
    return 4 * np.abs((ph % 1.0) - 0.5) - 1
def sweep(f0, f1, dur):
    """電源が切れていくような、下がっていく音(矩形波を指数的に下げる)"""
    n = int(SR * dur); t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    ph = np.cumsum(f) / SR
    return np.where((ph % 1.0) < 0.5, 1.0, -1.0) * np.exp(-t * 2.5)
def env(n, a=0.004, d=0.06, s=0.6, r=0.03):
    e = np.ones(n); ia = max(1, int(SR * a)); idd = max(1, int(SR * d)); ir = max(1, int(SR * r))
    e[:ia] = np.linspace(0, 1, ia)
    e[ia:ia + idd] = np.linspace(1, s, len(e[ia:ia + idd]))
    e[ia + idd:] = s
    e[-ir:] *= np.linspace(1, 0, ir)
    return e
rng = np.random.RandomState(11)
def kick():
    d = 0.3; n = int(SR * d); t = np.arange(n) / SR
    f = 45 + 120 * np.exp(-t * 24)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def snare(d=0.1):
    n = int(SR * d); t = np.arange(n) / SR
    nz = rng.uniform(-1, 1, n); nz = nz - np.concatenate([[0], nz[:-1]]) * 0.6
    return np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5 + nz * np.exp(-t * 26) * 0.7
def cymbal(d=1.0):
    n = int(SR * d); t = np.arange(n) / SR
    nz = rng.uniform(-1, 1, n); nz = nz - np.concatenate([[0], nz[:-1]])
    return nz * np.exp(-t * 4.0) * 0.35

TOTAL = int(SR * BEAT * BEATS)
buf = np.zeros((TOTAL + SR, 2))
def add(beat, sig, gain=1.0, pan=0.0):
    i = int(round(beat * BEAT * SR))
    l = gain * np.cos((pan + 1) * np.pi / 4); r = gain * np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * l; buf[i:i + len(sig), 1] += sig * r

# ---------------- 旋律: (拍, 音, 長さ[拍]) ----------------
# 1拍目・2拍目は、16分音符(0.25拍)3つで和音を駆け下りて、16分休符で区切る
MEL = [(0.00, 'E5', 0.25), (0.25, 'C5', 0.25), (0.50, 'A4', 0.25),
       (1.00, 'D5', 0.25), (1.25, 'B4', 0.25), (1.50, 'G#4', 0.25)]
for (bt, nm, ln) in MEL:
    d = ln * BEAT * 0.9
    s = pulse(hz(midi(nm)), d, 0.5) * env(int(SR * d), d=0.05, s=0.65)
    add(bt, s, 0.30, -0.1)
    add(bt + 0.03, pulse(hz(midi(nm)) * 1.004, d, 0.25) * env(int(SR * d), d=0.05, s=0.55), 0.12, 0.35)
# 3〜4拍目: 低いラ(と1オクターブ上のラ)を長くのばし、半音の3分の2ほど下げながら消えていく
for nm, g, pan in [('A4', 0.26, -0.1), ('A3', 0.20, 0.2)]:
    d = 2 * BEAT
    s = pulse(hz(midi(nm)), d, 0.5, drop=-0.7) * env(int(SR * d), d=0.12, s=0.6, r=0.55)
    add(2, s, g, pan)
# 「電源が切れていく」下がる音(高い所から低い所へ)
add(2.1, sweep(1400, 160, 0.75) * env(int(SR * 0.75), a=0.01, d=0.05, s=0.8, r=0.1), 0.07, 0.3)

# ---------------- 伴奏の和音(細い矩形波): Am → E → Am ----------------
for (bt, chord, ln) in [(0, ['A4', 'C5', 'E5'], 1), (1, ['E4', 'G#4', 'B4'], 1), (2, ['A3', 'C4', 'E4'], 2)]:
    for nm in chord:
        d = ln * BEAT
        drop = -0.7 if ln == 2 else 0.0
        s = pulse(hz(midi(nm)), d, 0.125, drop=drop) * env(int(SR * d), d=0.12, s=0.4, r=0.5 if ln == 2 else 0.04)
        add(bt, s, 0.05, 0.4)

# ---------------- ベース ----------------
for (bt, nm, ln) in [(0, 'A2', 0.5), (0.5, 'A2', 0.5), (1, 'E2', 0.5), (1.5, 'E2', 0.5), (2, 'A1', 2)]:
    d = ln * BEAT * 0.92
    drop = -0.7 if ln == 2 else 0.0
    s = (tri(hz(midi(nm)), d, drop) * 0.8 + pulse(hz(midi(nm)), d, 0.25, drop) * 0.25) * env(int(SR * d), d=0.08, s=0.6, r=0.55 if ln == 2 else 0.03)
    add(bt, s, 0.30)

# ---------------- ドラム ----------------
add(0, kick(), 0.5); add(1, kick(), 0.5)
for k in range(3):                          # 2拍目の後半に小さなスネアの連打(だんだん大きく)
    add(1.25 + k * 0.25, snare(), 0.10 + k * 0.05)
add(2, kick(), 0.7)
add(2, cymbal(), 0.45)

out = buf[:TOTAL]
fade = int(SR * 0.15); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out = out / np.max(np.abs(out)) * 0.6

os.makedirs(OUT, exist_ok=True)
wav = os.path.join(OUT, 'gameover.wav'); mp3 = os.path.join(OUT, 'gameover.mp3')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
# 音の大きさを BGM と同じ約 -20 LUFS にそろえる。曲が短く loudnorm が使いにくいので、
# 大きさを測って(ebur128)、その差だけ音量を変える
TARGET_LUFS = -20.0
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'],
                   capture_output=True, text=True)
lufs = None
for line in r.stderr.splitlines():
    line = line.strip()
    if line.startswith('I:') and 'LUFS' in line:
        lufs = float(line.split()[1])
gain_db = TARGET_LUFS - lufs
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'volume=%.2fdB' % gain_db,
                '-ar', '44100', '-b:a', '128k', mp3], check=True)
os.remove(wav)
print(mp3, os.path.getsize(mp3) // 1024, 'KB', '%.1f sec' % (TOTAL / SR))
