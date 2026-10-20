"""
TutorBoard launch film — original score and sound design, synthesized in code.

Reads the film's cue sheet (src/timeline.json, written by scripts/build-timeline.mjs)
so every keystroke, click and musical hit lands on the exact frame it scores.
Writes public/audio/score.wav (48 kHz, 16-bit stereo).

No samples, no licensed material: every sound is generated here.
Run:  python -I audio/build_score.py
"""
import json
import os
import sys

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
RNG = np.random.default_rng(7)

with open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf8") as fh:
    TL = json.load(fh)

FPS = TL["fps"]
TOTAL = TL["totalFrames"] / FPS + 1.5  # room for the final tail
N = int(TOTAL * SR)
BEAT = 60.0 / TL["bpm"]

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
send = np.zeros((N, 2))  # reverb send


def sec(frame):
    return frame / FPS


def note(name):
    """'A4' -> Hz."""
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4,
             "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def place(bus, t, x, pan=0.0, gain=1.0):
    """Add mono or stereo buffer x at time t (s) with equal-power pan."""
    i = int(t * SR)
    if i >= N or i < 0:
        return
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], axis=1)
    n = min(len(x), N - i)
    bus[i:i + n] += x[:n] * gain


def env(n, a, d, s=0.0, r=0.0, hold=None):
    """ADSR in seconds over n samples (sustain until release)."""
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(1, min(na, n))
    e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na)
    if nd > 0:
        e[na:na + nd] = np.linspace(1, s, nd)
    if nr > 0:
        e[max(0, n - nr):] *= np.linspace(1, 0, min(nr, n))
    return e


def lp(x, hz, order=2):
    b, a = signal.butter(order, min(hz, SR * 0.45) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1


# ── Instruments ──────────────────────────────────────────────────────────────

def pad(freqs, t, dur, gain=0.12, cutoff=1800, attack=1.6, release=2.2):
    n = int((dur + release) * SR)
    out = np.zeros((n, 2))
    for k, f in enumerate(freqs):
        for ch, det in enumerate((-0.11, 0.11)):
            v = saw(f * 2 ** (det / 12), n, phase=RNG.random()) * 0.5
            v += np.sin(2 * np.pi * f * 0.5 * np.arange(n) / SR) * 0.35  # warmth
            out[:, ch] += v
    out = lp(out, cutoff, 2) / max(1, len(freqs))
    e = env(n, attack, 0.5, 1.0, release)
    out *= e[:, None] * gain
    place(music, t, out)
    place(send, t, out * 0.6)


def kick(t, gain=0.55):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    f = 46 + 90 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-tt * 7.5)
    x += bp(RNG.standard_normal(n), 1500, 5000) * np.exp(-tt * 140) * 0.08
    place(music, t, x, gain=gain)


def hat(t, gain=0.05, open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    tt = np.arange(n) / SR
    x = hp(RNG.standard_normal(n), 7000) * np.exp(-tt * (18 if open_ else 70))
    place(music, t, x, pan=0.25, gain=gain)


def clap(t, gain=0.07):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 900, 3200)
    burst = sum(np.exp(-np.maximum(tt - d, 0) * 60) * (tt >= d) for d in (0, 0.011, 0.023))
    x = x * burst * 0.5 + x * np.exp(-tt * 12) * 0.3
    place(music, t, x, gain=gain)
    place(send, t, x * gain * 0.8)


def bass(f, t, dur, gain=0.16):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) + 0.35 * lp(saw(f, n), 600, 2)
    x *= env(n, 0.01, 0.25, 0.7, 0.08)
    place(music, t, x, gain=gain)


def pluck(f, t, gain=0.09, pan=0.0, bright=3200, decay=5.5):
    n = int(1.1 * SR)
    tt = np.arange(n) / SR
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * tt) * 0.4
    x = lp(x, bright, 2) * np.exp(-tt * decay)
    x[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    place(music, t, x, pan=pan, gain=gain)
    place(send, t, x * gain * 0.7, pan=pan)


def bell(f, t, gain=0.16, pan=0.0, decay=1.6):
    """FM bell — glassy, used for insight moments."""
    n = int(4.0 * SR)
    tt = np.arange(n) / SR
    idx = 2.4 * np.exp(-tt * 3.0)
    x = np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 3.5 * tt))
    x += 0.25 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3)
    x *= np.exp(-tt * decay)
    x[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    place(sfx, t, x, pan=pan, gain=gain)
    place(send, t, x * gain * 1.2, pan=pan)


def key_tick(t, k):
    n = int(0.035 * SR)
    tt = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 2500 + 900 * (k % 3), 7000) * np.exp(-tt * 260)
    x += np.sin(2 * np.pi * (1700 + 140 * (k % 4)) * tt) * np.exp(-tt * 400) * 0.25
    place(sfx, t, x, pan=-0.15 + 0.1 * ((k * 37) % 7) / 7, gain=0.10)


def mouse_click(t, gain=0.22):
    for dt, g, hz in ((0.0, 1.0, 3800), (0.045, 0.55, 2900)):
        n = int(0.03 * SR)
        tt = np.arange(n) / SR
        x = bp(RNG.standard_normal(n), hz * 0.6, hz * 1.4) * np.exp(-tt * 320) * g
        x += np.sin(2 * np.pi * 950 * tt) * np.exp(-tt * 220) * 0.3 * g
        place(sfx, t + dt, x, gain=gain)


def thock(t, gain=0.4):
    """The send: a soft, satisfying low click."""
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 180 * np.exp(-tt * 9) + 70
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 16)
    x += bp(RNG.standard_normal(n), 2000, 6000) * np.exp(-tt * 300) * 0.25
    place(sfx, t, x, gain=gain)
    place(send, t, x * gain * 0.5)


def whoosh(t, dur, gain=0.16, up=True):
    n = int(dur * SR)
    noise = RNG.standard_normal(n)
    out = np.zeros(n)
    blocks = 64
    edges = np.linspace(0, n, blocks + 1, dtype=int)
    for b in range(blocks):
        p = b / blocks
        c = 300 * (12 ** (p if up else 1 - p))
        seg = noise[edges[b]:edges[b + 1]]
        out[edges[b]:edges[b + 1]] = bp(seg, c * 0.7, c * 1.6, 1)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    out *= shape
    st = np.stack([out, np.roll(out, 240)], axis=1)
    place(sfx, t, st, gain=gain)
    place(send, t, st * gain * 0.6)


def riser(t, dur, gain=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 220 * (4 ** (tt / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    nz = hp(RNG.standard_normal(n), 2000) * 0.3
    x = (tone + nz) * (tt / dur) ** 2.2
    place(sfx, t, x, gain=gain)
    place(send, t, x * gain * 0.8)


def impact(t, gain=0.5, shimmer=True):
    n = int(3.0 * SR)
    tt = np.arange(n) / SR
    f = 38 + 50 * np.exp(-tt * 6)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    place(sfx, t, x, gain=gain)
    if shimmer:
        sh = sum(np.sin(2 * np.pi * note(nn) * tt) for nn in ("D6", "A6", "E7")) / 3
        sh *= np.exp(-tt * 1.4) * (1 - np.exp(-tt * 30))
        place(sfx, t, sh, gain=gain * 0.14)
        place(send, t, sh * gain * 0.3)


def pop(t, value, gain=0.13):
    """Tuned cell pop: value 1..9 mapped onto D minor pentatonic."""
    scale = ["D5", "F5", "G5", "A5", "C6", "D6", "F6", "G6", "A6"]
    f = note(scale[(int(value) - 1) % len(scale)])
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + 0.3 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 18)
    place(sfx, t, x, pan=(value - 4) / 8, gain=gain)
    place(send, t, x * gain * 0.6)


def tick(t, gain=0.05):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 120)
    place(sfx, t, x, gain=gain, pan=0.3)


# ── Arrangement ──────────────────────────────────────────────────────────────

CHORDS = [  # D minor: i – VI – III – VII
    ["D3", "F3", "A3", "C4", "E4"],
    ["Bb2", "D3", "F3", "A3", "C4"],
    ["F3", "A3", "C4", "E4", "G4"],
    ["C3", "E3", "G3", "A3", "D4"],
]
ROOTS = ["D2", "Bb1", "F2", "C2"]
ARP = [["D4", "A4", "F4", "C5"], ["Bb3", "F4", "D4", "A4"], ["F4", "C5", "A4", "E5"], ["C4", "G4", "E4", "D5"]]

M = TL["music"]
bar = 4 * BEAT


def chord_at(t):
    return int((t - sec(M["groove"][0])) // bar) % 4 if t >= sec(M["groove"][0]) else 0


# 1. Pad bed across the whole film, one chord per bar once the story moves.
t = 0.0
end_pad = sec(TL["totalFrames"])
while t < end_pad:
    i = chord_at(t) if t >= sec(M["groove"][0]) else 0
    g = 0.10 if t < sec(M["doubtDrop"]) or t >= sec(M["resume"]) else 0.075
    pad([note(n) for n in CHORDS[i]], t, bar, gain=g, cutoff=1400 if t < sec(M["groove"][0]) else 2200)
    t += bar

# 2. Sparse motif while the question is asked.
motif = ["A4", "D5", "F5", "E5"]
t = sec(M["motif"][0])
k = 0
while t < sec(M["motif"][1]):
    pluck(note(motif[k % 4]), t, gain=0.06, pan=-0.2 + 0.4 * (k % 2), decay=4.0)
    t += 2 * BEAT
    k += 1


def groove(t0, t1, full=True):
    t = t0
    b = 0
    while t < t1 - 1e-6:
        beat_in_bar = b % 4
        kick(t, gain=0.42 if full else 0.3)
        hat(t + BEAT / 2, gain=0.035)
        if full and beat_in_bar in (1, 3):
            clap(t, gain=0.05)
        ci = chord_at(t)
        if beat_in_bar == 0:
            bass(note(ROOTS[ci]), t, bar * 0.95, gain=0.15 if full else 0.1)
        for s in range(4):  # 16th arpeggio
            pluck(note(ARP[ci][(b * 4 + s) % 4]), t + s * BEAT / 4, gain=0.035 if full else 0.025,
                  pan=-0.35 + 0.7 * (s % 2), bright=2400 + 1600 * min(1, (t - t0) / 8), decay=9)
        t += BEAT
        b += 1


# 3. Think: pulse + arpeggio build, riser into the lesson reveal.
groove(sec(M["build"][0]), sec(M["build"][1]), full=False)
riser(sec(M["build"][1]) - 2.6, 2.6, gain=0.11)

# 4. Unfold: full groove.
groove(sec(M["groove"][0]), sec(M["doubtDrop"]), full=True)

# 5. Doubt: tension — soft ticks only, then the groove returns on resume.
t = sec(M["doubtDrop"])
while t < sec(M["resume"]):
    tick(t, gain=0.035)
    t += BEAT
# The groove carries the "any subject" montage, then lifts out for the closing line.
groove_end = M.get("outro", M["brand"])
groove(sec(M["resume"]), sec(groove_end), full=True)
if groove_end < M["brand"]:
    riser(sec(M["brand"]) - 2.4, 2.4, gain=0.10)

# 6. Brand: wide final chord swell and resolve.
pad([note(n) for n in ["D3", "A3", "D4", "F4", "A4", "E5"]], sec(M["brand"]), 7.5, gain=0.13, cutoff=3000,
    attack=0.8, release=3.5)
bass(note("D2"), sec(M["brand"]), 6.0, gain=0.12)

# ── Sound design cues ────────────────────────────────────────────────────────
C = TL["cues"]
for k, f in enumerate(C["keys"]):
    key_tick(sec(f), k)
for f in C["clicks"]:
    mouse_click(sec(f))
for f in C["sends"]:
    thock(sec(f))
for w in C["whooshes"]:
    whoosh(sec(w["f"]), w["dur"] / FPS, gain=w.get("gain", 0.14), up=w.get("up", True))
for p in C["pops"]:
    pop(sec(p["f"]), p["value"])
for f in C["impacts"]:
    impact(sec(f["f"]), gain=f.get("gain", 0.45), shimmer=f.get("shimmer", True))
for b in C["bells"]:
    bell(note(b["note"]), sec(b["f"]), gain=b.get("gain", 0.15), pan=b.get("pan", 0.0))

# ── Mix ──────────────────────────────────────────────────────────────────────
ir_len = int(2.8 * SR)
tt = np.arange(ir_len) / SR
ir = RNG.standard_normal((ir_len, 2)) * np.exp(-tt * 2.6)[:, None]
ir = lp(ir, 6000, 1)
ir /= np.sqrt(np.sum(ir ** 2, axis=0))
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)

mix = music * 0.9 + sfx + wet * 0.55
mix = hp(mix, 28, 2)


def compress(x, thresh_db=-24.0, ratio=2.4, release=0.18):
    """RMS bus compressor: evens out the arc so quiet passages stay audible."""
    from scipy.ndimage import uniform_filter1d
    power = uniform_filter1d((x ** 2).mean(axis=1), size=int(0.03 * SR))
    level = 10 * np.log10(power + 1e-12)
    over = np.maximum(level - thresh_db, 0)
    gr = -over * (1 - 1 / ratio)  # dB of gain reduction (<= 0)
    a = np.exp(-1 / (release * SR))
    gr = signal.lfilter([1 - a], [1, -a], gr)  # smooth release
    return x * (10 ** (gr / 20))[:, None]


mix = compress(mix)
rms = np.sqrt(np.mean(mix ** 2))
mix *= (10 ** (-16.0 / 20)) / rms  # target ~-16 dB RMS before the limiter
mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # gentle glue / soft clip
peak = np.max(np.abs(mix))
if peak > 10 ** (-1.0 / 20):
    mix *= (10 ** (-1.0 / 20)) / peak

fade_in = int(0.4 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
fade_out = int(1.4 * SR)
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 2

out_dir = os.path.join(ROOT, "public", "audio")
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, "score.wav")
pcm = (mix * 32767).astype(np.int16)
import wave

with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {path}  {N / SR:.1f}s  peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS  "
      f"rms {20 * np.log10(np.sqrt(np.mean(mix ** 2))):.1f} dB")
