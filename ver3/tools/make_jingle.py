"""ゲームオーバーのジングルを合成する(web/ の外に置く道具)。外部の音源・サンプル・既存の曲は使っていない。

曲: 本ゲーム用に作曲した約2秒の短い曲。BGM と同じイ短調・ピコピコした音色で、
    半音ずつ下がっていく旋律のあと、低い「ラ」の和音で終わる(「おしまい」と分かる形)。
    ver09 で約3.4秒から約2秒に縮め、音の大きさを BGM と同じ(約 -20 LUFS)にした。

使い方(リポジトリのルートで。numpy と ffmpeg が必要):
    python tools/make_jingle.py web/audio
    → web/audio/gameover.mp3(128kbps ステレオ、約 -20 LUFS = BGM と同じ大きさ)

曲を替えたら game.js の 'audio/gameover.mp3?v=' の番号を上げること。
"""
import os, sys, wave, subprocess
import numpy as np

SR = 44100
BEAT = 60.0 / 150                 # 150BPM(1拍 0.4秒。全体で5拍 = 2秒)
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(s):
    k = NOTE[s[0]]; i = 1
    if s[i] == '#': k += 1; i += 1
    elif s[i] == 'b': k -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + k
def hz(m): return 440.0 * 2 ** ((m - 69) / 12.0)

def pulse(freq, dur, duty=0.5, vib=0.0, bend=0.0):
    n = int(SR * dur); t = np.arange(n) / SR
    f = freq * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) * 3, 0, 1))
    f = f * (2 ** (bend * np.clip((t - dur * 0.55) / (dur * 0.45), 0, 1) / 12.0))   # 最後の音を少し下げる
    ph = np.cumsum(f) / SR
    x = np.where((ph % 1.0) < duty, 1.0, -1.0)
    y = np.empty_like(x); a = 0.35; acc = 0.0
    for i in range(n):
        acc += a * (x[i] - acc); y[i] = acc
    return y
def tri(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    return 4 * np.abs(((freq * t) % 1.0) - 0.5) - 1
def env(n, a=0.004, d=0.08, s=0.6, r=0.04):
    e = np.ones(n); ia = max(1, int(SR * a)); idd = max(1, int(SR * d)); ir = max(1, int(SR * r))
    e[:ia] = np.linspace(0, 1, ia)
    e[ia:ia + idd] = np.linspace(1, s, len(e[ia:ia + idd]))
    e[ia + idd:] = s
    e[-ir:] *= np.linspace(1, 0, ir)
    return e
rng = np.random.RandomState(5)
def kick():
    d = 0.35; n = int(SR * d); t = np.arange(n) / SR
    f = 45 + 120 * np.exp(-t * 22)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
def snare(d=0.16):
    n = int(SR * d); t = np.arange(n) / SR
    nz = rng.uniform(-1, 1, n); nz = nz - np.concatenate([[0], nz[:-1]]) * 0.6
    return np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5 + nz * np.exp(-t * 22) * 0.7
def cymbal(d=0.9):
    n = int(SR * d); t = np.arange(n) / SR
    nz = rng.uniform(-1, 1, n); nz = nz - np.concatenate([[0], nz[:-1]])
    return nz * np.exp(-t * 3.2) * 0.35

TOTAL = int(SR * BEAT * 5)
buf = np.zeros((TOTAL + SR, 2))
def add(beat, sig, gain=1.0, pan=0.0):
    i = int(round(beat * BEAT * SR))
    l = gain * np.cos((pan + 1) * np.pi / 4); r = gain * np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * l; buf[i:i + len(sig), 1] += sig * r

# 旋律: (拍, 音, 長さ[拍])。半音ずつ下がって、最後は低いラを長くのばす
MEL = [(0.0, 'E5', 0.5), (0.5, 'D#5', 0.5), (1.0, 'D5', 0.5), (1.5, 'C#5', 0.5),
       (2.0, 'B4', 0.5), (2.5, 'G#4', 0.5), (3.0, 'A4', 2.0)]
for (bt, nm, ln) in MEL:
    last = ln >= 2
    d = ln * BEAT * (1.0 if last else 0.95)
    s = pulse(hz(midi(nm)), d, 0.5, vib=0.012 if last else 0.0, bend=-1.0 if last else 0.0)
    s = s * env(int(SR * d), d=0.1, s=0.6, r=0.45 if last else 0.04)
    add(bt, s, 0.30, -0.1)
    s2 = pulse(hz(midi(nm)) * 1.004, d, 0.25) * env(int(SR * d), d=0.1, s=0.5, r=0.45 if last else 0.04)
    add(bt + 0.02, s2, 0.12, 0.35)            # 少しずらした2本目で厚くする

# 伴奏の和音(細い矩形波): Am → Dm → E → Am
for (bt, chord, ln) in [(0, ['A4', 'C5', 'E5'], 1), (1, ['F4', 'A4', 'D5'], 1),
                        (2, ['E4', 'G#4', 'B4'], 1), (3, ['A3', 'C4', 'E4', 'A4'], 2)]:
    for nm in chord:
        d = ln * BEAT
        s = pulse(hz(midi(nm)), d, 0.125) * env(int(SR * d), d=0.15, s=0.4, r=0.5 if ln >= 2 else 0.05)
        add(bt, s, 0.05, 0.4)

# ベース
for (bt, nm, ln) in [(0, 'A2', 1), (1, 'D2', 1), (2, 'E2', 1), (3, 'A1', 2)]:
    d = ln * BEAT * 0.95
    s = (tri(hz(midi(nm)), d) * 0.8 + pulse(hz(midi(nm)), d, 0.25) * 0.25) * env(int(SR * d), d=0.1, s=0.6, r=0.5 if ln >= 2 else 0.04)
    add(bt, s, 0.30)

# ドラム: 拍ごとのキック、最後の前に小さなスネアの連打、終わりにキックとシンバル
for b in range(3):
    add(b, kick(), 0.45)
for k in range(4):
    add(2 + k * 0.25, snare(0.12), 0.10 + k * 0.04)
add(3, kick(), 0.7)
add(3, cymbal(), 0.5)

out = buf[:TOTAL]
fade = int(SR * 0.2); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
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
