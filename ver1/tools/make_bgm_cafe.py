"""ゲームの BGM を合成する(web/ の外に置く道具)。外部の音源・サンプル・既存の曲は使っていない。

ver09 から使っている曲は「午後のカフェ・低め・まろやか」(B3):
    python tools/make_bgm.py <出力フォルダ> cafe_low   → bgm_B3_cafe_low_mellow.mp3 (と、音色をそのままにした B2)
    できた B3 を、音量 +0.5dB(約 -18.8 LUFS)にして web/audio/bgm.mp3 に置く。
    例: ffmpeg -i bgm_B3_cafe_low_mellow.mp3 -af volume=0.5dB -b:a 128k web/audio/bgm.mp3
試聴用のほかの候補(ワルツ・カフェ・森のおさんぽ)は、引数なしで作れる:
    python tools/make_bgm.py <出力フォルダ>
ニ長調・88BPM・16小節(約44秒)。エレピ風の旋律とセブンスの和音、ベース、ごく小さなブラシの音。
"""
import os, sys, subprocess, numpy as np
from scipy.io import wavfile
SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
def hz(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def n(s):  # 'C5' 'F#4' 'Bb3'
    k = NOTE[s[0]]; i = 1
    if s[i] == '#': k += 1; i += 1
    elif s[i] == 'b': k -= 1; i += 1
    return 12 * (int(s[i:]) + 1) + k

class Mix:
    def __init__(s, bpm, beats_total):
        s.beat = 60 / bpm; s.loop = int(SR * s.beat * beats_total); s.buf = np.zeros((s.loop + SR * 4, 2))
    def add(s, at, sig, pan=0.0, gain=1.0):
        i = int(at * s.beat * SR); l = gain * np.cos((pan + 1) * np.pi / 4); r = gain * np.sin((pan + 1) * np.pi / 4)
        s.buf[i:i + len(sig), 0] += sig * l; s.buf[i:i + len(sig), 1] += sig * r
    def render(s, name, lufs_scale=0.5):
        dry = s.buf.copy()
        for d, g in [(0.083, 0.22), (0.131, 0.18), (0.197, 0.15), (0.271, 0.11), (0.353, 0.08), (0.45, 0.05)]:
            k = int(SR * d); s.buf[k:, 0] += dry[:-k, 1] * g; s.buf[k:, 1] += dry[:-k, 0] * g
        tail = s.buf[s.loop:]; s.buf[:len(tail)] += tail; out = s.buf[:s.loop]
        out = out / np.max(np.abs(out)) * lufs_scale
        wav = os.path.join(OUT, name + '.wav'); mp3 = os.path.join(OUT, name + '.mp3')
        wavfile.write(wav, SR, (out * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '128k', mp3], check=True); os.remove(wav)
        return mp3

def env_ad(n_, a, decay, rel_from=None):
    t = np.arange(n_) / SR; e = np.minimum(1, t / a) * np.exp(-t * decay)
    if rel_from is not None and rel_from < n_: e[rel_from:] *= np.linspace(1, 0, n_ - rel_from)
    return e
def musicbox(m, beat):
    N = int(SR * 2.2); t = np.arange(N) / SR; f = hz(m)
    return (np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*f*4.02*t)*np.exp(-t*7) + 0.12*np.sin(2*np.pi*f*7.1*t)*np.exp(-t*14)) * np.exp(-t*1.8) * np.minimum(1, t/0.003)
def strings(ms, dur_s):
    N = int(SR * (dur_s + 0.8)); t = np.arange(N) / SR; s = np.zeros(N)
    for m in ms:
        f = hz(m); vib = 0.004 * np.sin(2*np.pi*5*t)
        for det in (0.997, 1.0, 1.003):
            ph = 2*np.pi*f*det*t*(1+vib)
            s += np.sin(ph) + 0.3*np.sin(2*ph) + 0.12*np.sin(3*ph)
    e = np.minimum(1, t/0.5); end = int(SR*dur_s); e[end:] *= np.linspace(1, 0, N-end)
    return s * e / (3 * len(ms))
def softbass(m, dur_s, decay=1.2):
    N = int(SR * dur_s); t = np.arange(N) / SR; f = hz(m)
    return (np.sin(2*np.pi*f*t) + 0.15*np.sin(4*np.pi*f*t)) * env_ad(N, 0.02, decay, N - 600)
def rhodes(ms, dur_s, bright=0.9):
    N = int(SR * (dur_s + 1.0)); t = np.arange(N) / SR; s = np.zeros(N)
    for m in ms:
        f = hz(m); s += np.sin(2*np.pi*f*t + bright*np.sin(2*np.pi*f*t)*np.exp(-t*5)) * (1 + 0.15*np.sin(2*np.pi*4.5*t))
    return s * env_ad(N, 0.006, 1.3, int(SR*dur_s)) / len(ms)
def brush(acc):
    N = int(SR*0.12); t = np.arange(N)/SR; w = np.random.default_rng(int(acc*7+3)).standard_normal(N)
    w = np.diff(np.concatenate([[0], w])); return w * np.exp(-t*35) * (0.5 if acc else 0.3)
def flute(m, dur_s):
    N = int(SR*(dur_s+0.4)); t = np.arange(N)/SR; f = hz(m)
    vib = 1 + 0.006*np.sin(2*np.pi*5.2*t)*np.minimum(1, t/0.4)
    ph = 2*np.pi*f*np.cumsum(vib)/SR
    noise = np.random.default_rng(m).standard_normal(N)*0.02
    s = np.sin(ph) + 0.25*np.sin(2*ph) + 0.08*np.sin(3*ph) + noise
    e = np.minimum(1, t/0.08); end = int(SR*dur_s); e[end:] *= np.linspace(1, 0, N-end)
    return s * e
def harp(m):
    N = int(SR*2.5); t = np.arange(N)/SR; f = hz(m)
    return (np.sin(2*np.pi*f*t) + 0.4*np.sin(4*np.pi*f*t)*np.exp(-t*3) + 0.15*np.sin(6*np.pi*f*t)*np.exp(-t*5)) * np.exp(-t*1.5) * np.minimum(1, t/0.004)

# ---------- A: やさしいワルツ(3拍子、ヘ長調、92BPM、24小節) ----------
def waltz():
    BPB = 3; bars = 24; mx = Mix(92, BPB*bars)
    prog = ['F','Dm','Bb','C','F','Am','Bb','C7', 'Dm','Am','Bb','F','Gm','C','F','C7',
            'F','Dm','Bb','C','Am','Dm','Gm','C']
    ch = {'F':['F4','A4','C5'],'Dm':['D4','F4','A4'],'Bb':['D4','F4','Bb4'],'C':['E4','G4','C5'],'Am':['E4','A4','C5'],
          'C7':['E4','G4','Bb4'],'Gm':['D4','G4','Bb4']}
    root = {'F':'F2','Dm':'D2','Bb':'Bb1','C':'C2','Am':'A1','C7':'C2','Gm':'G1'}
    mel = [['A5:2','C6:1'],['A5:3'],['F5:1','G5:1','A5:1'],['G5:3'],['A5:2','C6:1'],['E6:2','C6:1'],['D6:1','C6:1','Bb5:1'],['G5:3'],
           ['F5:2','A5:1'],['E5:2','C5:1'],['D5:1','F5:1','Bb5:1'],['A5:3'],['Bb5:2','G5:1'],['E5:2','G5:1'],['F5:3'],['E5:2','G5:1'],
           ['A5:2','C6:1'],['F6:2','D6:1'],['D6:1','C6:1','Bb5:1'],['G5:3'],['C6:2','A5:1'],['F5:2','D5:1'],['G5:1','A5:1','Bb5:1'],['G5:2','E5:1']]
    for b in range(bars):
        base = b*BPB; t = 0
        for it in mel[b]:
            nt, d = it.split(':'); d = int(d); mx.add(base+t, musicbox(n(nt), mx.beat), pan=0.15, gain=0.32); t += d
        mx.add(base, softbass(n(root[prog[b]]), mx.beat*1.6), gain=0.32)
        for k in (1, 2): mx.add(base+k, rhodes([n(x) for x in ch[prog[b]]], mx.beat*0.7), pan=-0.3, gain=0.10)
        mx.add(base, strings([n(x)-12 for x in ch[prog[b]]], mx.beat*3), pan=-0.1, gain=0.16)
    return mx.render('bgm_A_waltz')

# ---------- B: 午後のカフェ(4拍子、ト長調、88BPM、16小節。セブンスの和音) ----------
def cafe(tr=0, bright=0.9, brush_gain=0.07, lowpass=None, outname='bgm_B_cafe'):
    bars = 16; mx = Mix(88, 4*bars)
    prog = [('Gmaj7',['F#4','B4','D5','G4'],'G2'),('Em7',['G4','B4','D5','E4'],'E2'),('Am7',['G4','C5','E5','A4'],'A2'),('D7',['F#4','A4','C5','D4'],'D2')]*2 + \
           [('Cmaj7',['E4','G4','B4','C4'],'C2'),('Bm7',['F#4','A4','D5','B3'],'B1'),('Em7',['G4','B4','D5','E4'],'E2'),('A7',['G4','C#5','E5','A3'],'A1'),
            ('Am7',['G4','C5','E5','A4'],'A2'),('D7',['F#4','A4','C5','D4'],'D2'),('Gmaj7',['F#4','B4','D5','G4'],'G2'),('D7',['F#4','A4','C5','D4'],'D2')]
    mel = [[('B4',1.5),('D5',.5),('F#5',2)],[('E5',1),('D5',1),('B4',2)],[('C5',1.5),('E5',.5),('A5',1),('G5',1)],[('F#5',3),('A4',1)],
           [('B4',1.5),('D5',.5),('G5',2)],[('F#5',1),('E5',1),('D5',2)],[('E5',1),('C5',1),('A4',1),('C5',1)],[('A4',4)],
           [('E5',1.5),('G5',.5),('B5',2)],[('A5',1),('F#5',1),('D5',2)],[('G5',1.5),('F#5',.5),('E5',2)],[('C#5',2),('E5',2)],
           [('C5',1.5),('E5',.5),('G5',1),('A5',1)],[('F#5',2),('D5',2)],[('B4',3),('D5',1)],[('A4',2),('F#4',2)]]
    for b in range(bars):
        base = b*4; name, notes, rt = prog[b]; t = 0
        for nt, d in mel[b]:
            mx.add(base+t, rhodes([n(nt)+tr], mx.beat*d, bright), pan=0.15, gain=0.30); t += d
        for st, d in [(0, 1.5), (1.5, 2.5)]: mx.add(base+st, rhodes([n(x)+tr for x in notes], mx.beat*d*0.8, bright), pan=-0.3, gain=0.17)
        for st, off in [(0, 0), (2, 7), (3.5, 12)]: mx.add(base+st, softbass(n(rt)+off+(tr if n(rt)+tr >= 31 else tr+12), mx.beat*(1.4 if st < 3 else 0.5), decay=2), gain=0.30)
        for k in range(8): mx.add(base+k*0.5 + (0.08 if k % 2 else 0), brush(k % 2), pan=0.4, gain=brush_gain)
    if lowpass:
        from scipy.signal import butter, sosfilt
        sos = butter(2, lowpass, fs=SR, output='sos'); mx.buf = sosfilt(sos, mx.buf, axis=0)
    return mx.render(outname)

# ---------- C: 森のおさんぽ(4拍子、ニ長調、80BPM、16小節。フルート風＋ハープ) ----------
def forest():
    bars = 16; mx = Mix(80, 4*bars)
    prog = ['D','Bm','G','A','D','F#m','G','A','G','A','F#m','Bm','G','A','D','D']
    ch = {'D':['D3','A3','D4','F#4'],'Bm':['B2','F#3','B3','D4'],'G':['G2','D3','G3','B3'],'A':['A2','E3','A3','C#4'],'F#m':['F#2','C#3','F#3','A3']}
    mel = [[('F#5',2),('A5',1),('B5',1)],[('A5',3),('F#5',1)],[('G5',1.5),('F#5',.5),('E5',1),('D5',1)],[('E5',4)],
           [('F#5',2),('A5',1),('D6',1)],[('C#6',2),('A5',2)],[('B5',1.5),('A5',.5),('G5',1),('E5',1)],[('A5',4)],
           [('B5',2),('G5',1),('B5',1)],[('A5',2),('E5',2)],[('F#5',1),('A5',1),('C#6',2)],[('B5',3),('F#5',1)],
           [('G5',1.5),('A5',.5),('B5',1),('D6',1)],[('C#6',2),('E5',2)],[('D5',4)],[('F#5',2),('E5',2)]]
    for b in range(bars):
        base = b*4; t = 0
        for nt, d in mel[b]: mx.add(base+t, flute(n(nt)-12, mx.beat*d*0.95), pan=0.1, gain=0.20); t += d
        notes = [n(x) for x in ch[prog[b]]]
        for k in range(8): mx.add(base+k*0.5, harp(notes[[0,1,2,3,2,1,2,3][k]] + 12), pan=-0.35, gain=0.11)
        mx.add(base, softbass(notes[0], mx.beat*1.8, decay=1.0), gain=0.30); mx.add(base+2, softbass(notes[1]-12 if notes[1]-12 > 33 else notes[0], mx.beat*1.8, decay=1.0), gain=0.24)
        mx.add(base, strings(notes[1:], mx.beat*4), pan=0.0, gain=0.10)
    return mx.render('bgm_C_forest')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 2 and sys.argv[2] == 'cafe_low':
        # B2: 音程を5つ下げる(ト長調→ニ長調)/ B3: さらに音色を丸く(明るさを抑え、高い音を削る)
        print(cafe(tr=-5, outname='bgm_B2_cafe_low'))
        print(cafe(tr=-5, bright=0.45, brush_gain=0.045, lowpass=3200, outname='bgm_B3_cafe_low_mellow'))
    else:
        for f in (waltz, cafe, forest): print(f())
