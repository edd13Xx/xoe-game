#!/usr/bin/env python3
"""Original synth theme for XOE (all sound generated here with numpy; no samples, no third-party music).
Dark, mysterious, energetic space/cyber mood in D minor, 100 BPM, 16 bars = 38.4 s, built to loop seamlessly
(release tails wrap around the loop point). Usage: python3 make-theme.py out.wav ; then loudness-normalise with ffmpeg."""
import sys, wave
import numpy as np

SR = 44100
BPM = 100
BEAT = 60.0 / BPM
BARS = 16
N = int(round(BARS * 4 * BEAT * SR))
TAIL = SR * 4
rng = np.random.default_rng(20261113)
L = np.zeros(N + TAIL); R = np.zeros(N + TAIL)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def t_of(dur): return np.arange(int(dur * SR)) / SR
def lowpass(x, cutoff):  # one-pole, cutoff scalar or array (Hz)
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y
def saw(f, t, phase=0.0):
    ph = (f * t + phase) % 1.0
    # polyBLEP-free naive saw, softened later by filters
    return 2 * ph - 1
def add(buf_l, buf_r, start, sig, pan=0.0):
    i = int(start * SR); j = min(len(buf_l), i + len(sig))
    if i >= len(buf_l): return
    g_l = np.cos((pan + 1) * np.pi / 4); g_r = np.sin((pan + 1) * np.pi / 4)
    buf_l[i:j] += sig[: j - i] * g_l; buf_r[i:j] += sig[: j - i] * g_r
def env(n, a, d, s, r_start, r):
    e = np.ones(n); na = max(1, int(a * SR)); nd = max(1, int(d * SR))
    e[:na] = np.linspace(0, 1, na)
    e[na:na + nd] = np.linspace(1, s, min(nd, max(0, n - na)))[: max(0, n - na)][: nd] if n > na else e[na:na + nd]
    e[na + nd:] = s
    nr = int(r * SR); st = int(r_start * SR)
    if st < n:
        m = min(nr, n - st); e[st:st + m] *= np.linspace(1, 0, m); e[st + m:] = 0
    return e

# chords per 2 bars (D minor, Phrygian colour): Dm, Bb, Gm, A(sus/major tension)
CHORDS = [(50, [0, 3, 7, 12]), (46, [0, 4, 7, 12]), (43, [0, 3, 7, 12]), (45, [0, 4, 7, 11])]
def chord_at(bar):
    return CHORDS[(bar // 2) % 4]

# ---- pad: detuned saws, slow attack, lowpass that breathes over the 16 bars
for blk in range(BARS // 2):
    root, iv = chord_at(blk * 2)
    dur = 2 * 4 * BEAT + 1.2
    t = t_of(dur)
    sig = np.zeros_like(t)
    for k in iv[:3]:
        for det in (-0.12, 0.0, 0.14):
            sig += saw(midi(root + 12 + k + det * 0.1) , t, rng.random()) * 0.12
    cut = 500 + 700 * (0.5 + 0.5 * np.sin(2 * np.pi * (blk / 8.0) + t * 0.4))
    sig = lowpass(sig, cut)
    sig *= env(len(t), 1.4, 0.2, 0.8, 2 * 4 * BEAT, 1.2) * 0.55
    add(L, R, blk * 2 * 4 * BEAT, sig, -0.15); add(L, R, blk * 2 * 4 * BEAT + 0.012, sig * 0.8, 0.25)

# ---- eerie drone: low sine pair with slow vibrato and a bit of noise (the "unknown organic energy")
t = np.arange(N + TAIL) / SR
vib = 1 + 0.004 * np.sin(2 * np.pi * 0.23 * t)
drone = 0.10 * np.sin(2 * np.pi * midi(26) * t * vib) + 0.05 * np.sin(2 * np.pi * midi(38) * t * 1.002 * vib)
drone *= 0.7 + 0.3 * np.sin(2 * np.pi * (1 / (BARS * 4 * BEAT)) * 2 * t)  # 2 swells per loop, loop-safe
L += drone; R += drone * 0.95

# ---- sub bass: rolling 8ths on the chord root, filter pulses on every beat
for bar in range(BARS):
    root, _ = chord_at(bar)
    if bar < 2: continue  # intro: pad + drone only
    for e in range(8):
        start = bar * 4 * BEAT + e * BEAT / 2
        dur = BEAT / 2 * 0.92
        t = t_of(dur + 0.05)
        note = root - 12 + (12 if e in (3, 7) else 0) + (7 if e == 5 else 0)
        sig = saw(midi(note), t) * 0.5 + np.sin(2 * np.pi * midi(note) * t) * 0.7
        cut = 140 + 520 * np.exp(-t * 14)
        sig = lowpass(sig, cut) * env(len(t), 0.004, 0.05, 0.6, dur, 0.05) * 0.5
        add(L, R, start, sig, 0.0)

# ---- kick (from bar 4), hats (from bar 6), clap-ish noise on 2 and 4 (from bar 8)
def kick():
    t = t_of(0.34); f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.9
def hat(open_=False):
    n = int((0.22 if open_ else 0.045) * SR); x = rng.standard_normal(n)
    x = x - lowpass(x, 5500)  # crude highpass
    return x * np.exp(-np.arange(n) / SR * (14 if open_ else 80)) * 0.22
def clap():
    n = int(0.28 * SR); x = rng.standard_normal(n)
    x = lowpass(x, 3200) - lowpass(x, 700)
    e = np.exp(-np.arange(n) / SR * 22); e[: int(0.012 * SR)] *= 0.5
    return x * e * 0.45
K = kick(); H = hat(); HO = hat(True); C = clap()
for bar in range(4, BARS):
    for b in range(4):
        add(L, R, (bar * 4 + b) * BEAT, K * (0.85 if b % 2 else 1.0), 0.0)
for bar in range(6, BARS):
    for s in range(8):
        add(L, R, (bar * 4) * BEAT + (s + 0.5) * BEAT / 2, (HO if s == 7 and bar % 2 else H) * (1.0 if s % 2 else 0.6), 0.3 if s % 2 else -0.3)
for bar in range(8, BARS):
    for b in (1, 3):
        add(L, R, (bar * 4 + b) * BEAT, C, 0.1)

# ---- arpeggio: 16ths, pulse-ish lead through a moving lowpass, enters bar 4, opens up late
PAT = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 3, 1, 3, 2, 1, 0]
for bar in range(4, BARS):
    root, iv = chord_at(bar)
    for s in range(16):
        start = bar * 4 * BEAT + s * BEAT / 4
        note = root + 24 + iv[PAT[s] % len(iv)] + (12 if (bar >= 12 and s % 8 == 7) else 0)
        dur = BEAT / 4 * 1.4
        t = t_of(dur)
        sig = (saw(midi(note), t) - saw(midi(note), t, 0.3)) * 0.25 + saw(midi(note) * 1.004, t) * 0.12
        open_amt = 0.5 + 0.5 * np.sin(2 * np.pi * (bar * 16 + s) / (BARS * 16) * 1.0 - 1.2)
        sig = lowpass(sig, 700 + 2600 * open_amt * np.exp(-t * 6)) * env(len(t), 0.003, 0.04, 0.4, dur * 0.7, dur * 0.3) * 0.5
        add(L, R, start, sig, -0.5 if s % 2 else 0.5)

# ---- risers: filtered noise swelling into bars 8 and 0 (loop point)
for bar_end in (8, 16):
    dur = 4 * BEAT * 1.0
    n = int(dur * SR); x = rng.standard_normal(n)
    sw = np.linspace(0, 1, n) ** 2
    x = lowpass(x, 400 + 7000 * sw) * sw * 0.16
    start = bar_end * 4 * BEAT - dur
    add(L, R, start, x, 0.0)

# ---- simple stereo delay + slow feedback echo on the whole mix (dotted eighth)
def echo(buf, delay, fb, wet):
    d = int(delay * SR); out = buf.copy()
    for k in range(1, 5):
        out[k * d:] += buf[: len(buf) - k * d] * (wet * fb ** (k - 1))
    return out
L = echo(L, BEAT * 0.75, 0.55, 0.22); R = echo(R, BEAT * 0.5, 0.55, 0.22)

# ---- fold tails back onto the start so the loop is seamless
L[:TAIL] += L[N:N + TAIL]; R[:TAIL] += R[N:N + TAIL]
L = L[:N]; R = R[:N]
# soft clip + gentle fade of nothing (loopable), normalise peak
st = np.tanh(np.stack([L, R]) * 0.9)
st = st / (np.max(np.abs(st)) + 1e-9) * 0.89
fl = int(0.04 * SR); ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fl))
st[:, :fl] *= ramp; st[:, -fl:] *= ramp[::-1]  # 40 ms edge fades: click-free loop seam
pcm = (st.T * 32767).astype("<i2")
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "xoe-theme.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", N / SR, "seconds")
