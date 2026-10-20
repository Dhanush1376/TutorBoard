"""
Small synthesis toolkit for the TutorBoard film scores (numpy/scipy only).
Every sound is generated here — no samples, no licensed material.
"""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


def note(name):
    """'A4' -> Hz."""
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4,
             "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def env(n, a, d, s=0.0, r=0.0):
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


class Mix:
    """Named stereo buses of a fixed length, plus a reverb send."""

    def __init__(self, seconds):
        self.N = int(seconds * SR)
        self.bus = {}

    def get(self, name):
        if name not in self.bus:
            self.bus[name] = np.zeros((self.N, 2))
        return self.bus[name]

    def place(self, name, t, x, pan=0.0, gain=1.0, send=0.0):
        i = int(round(t * SR))
        if i >= self.N or i < 0:
            return
        if x.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            x = np.stack([x * l, x * r], axis=1)
        n = min(len(x), self.N - i)
        self.get(name)[i:i + n] += x[:n] * gain
        if send > 0:
            self.get('send')[i:i + n] += x[:n] * gain * send


# ── Instruments (each places itself on a bus of the mixer) ───────────────────

def pad(m, freqs, t, dur, gain=0.12, cutoff=1800, attack=1.6, release=2.2, bus='music'):
    n = int((dur + release) * SR)
    out = np.zeros((n, 2))
    for f in freqs:
        for ch, det in enumerate((-0.11, 0.11)):
            v = saw(f * 2 ** (det / 12), n, phase=RNG.random()) * 0.5
            v += np.sin(2 * np.pi * f * 0.5 * np.arange(n) / SR) * 0.35
            out[:, ch] += v
    out = lp(out, cutoff, 2) / max(1, len(freqs))
    out *= env(n, attack, 0.5, 1.0, release)[:, None] * gain
    m.place(bus, t, out, send=0.6)


def kick(m, t, gain=0.55, punch=1.0):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    f = 44 + 100 * punch * np.exp(-tt * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7.0)
    x += bp(RNG.standard_normal(n), 1500, 5000) * np.exp(-tt * 140) * 0.09
    m.place('drums', t, x, gain=gain)


def hat(m, t, gain=0.05, open_=False, pan=0.25):
    n = int((0.24 if open_ else 0.06) * SR)
    tt = np.arange(n) / SR
    x = hp(RNG.standard_normal(n), 7200) * np.exp(-tt * (16 if open_ else 75))
    m.place('drums', t, x, pan=pan, gain=gain)


def clap(m, t, gain=0.07):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 900, 3200)
    burst = sum(np.exp(-np.maximum(tt - d, 0) * 60) * (tt >= d) for d in (0, 0.011, 0.023))
    x = x * burst * 0.5 + x * np.exp(-tt * 12) * 0.3
    m.place('drums', t, x, gain=gain, send=0.8)


def bass(m, f, t, dur, gain=0.16):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) + 0.35 * lp(saw(f, n), 650, 2)
    x *= env(n, 0.008, 0.22, 0.7, 0.06)
    m.place('bass', t, x, gain=gain)


def pluck(m, f, t, gain=0.09, pan=0.0, bright=3200, decay=5.5, bus='music'):
    n = int(1.1 * SR)
    tt = np.arange(n) / SR
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * tt) * 0.4
    x = lp(x, bright, 2) * np.exp(-tt * decay)
    x[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    m.place(bus, t, x, pan=pan, gain=gain, send=0.7)


def bell(m, f, t, gain=0.16, pan=0.0, decay=1.6):
    n = int(4.0 * SR)
    tt = np.arange(n) / SR
    idx = 2.4 * np.exp(-tt * 3.0)
    x = np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 3.5 * tt))
    x += 0.25 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3)
    x *= np.exp(-tt * decay)
    x[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    m.place('sfx', t, x, pan=pan, gain=gain, send=1.2)


def key_tick(m, t, k):
    n = int(0.035 * SR)
    tt = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 2500 + 900 * (k % 3), 7000) * np.exp(-tt * 260)
    x += np.sin(2 * np.pi * (1700 + 140 * (k % 4)) * tt) * np.exp(-tt * 400) * 0.25
    m.place('sfx', t, x, pan=-0.15 + 0.1 * ((k * 37) % 7) / 7, gain=0.10)


def mouse_click(m, t, gain=0.22):
    for dt, g, hz in ((0.0, 1.0, 3800), (0.045, 0.55, 2900)):
        n = int(0.03 * SR)
        tt = np.arange(n) / SR
        x = bp(RNG.standard_normal(n), hz * 0.6, hz * 1.4) * np.exp(-tt * 320) * g
        x += np.sin(2 * np.pi * 950 * tt) * np.exp(-tt * 220) * 0.3 * g
        m.place('sfx', t + dt, x, gain=gain)


def thock(m, t, gain=0.4):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 180 * np.exp(-tt * 9) + 70
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 16)
    x += bp(RNG.standard_normal(n), 2000, 6000) * np.exp(-tt * 300) * 0.25
    m.place('sfx', t, x, gain=gain, send=0.5)


def whoosh(m, t, dur, gain=0.16, up=True):
    n = int(dur * SR)
    noise = RNG.standard_normal(n)
    out = np.zeros(n)
    blocks = 64
    edges = np.linspace(0, n, blocks + 1, dtype=int)
    for b in range(blocks):
        p = b / blocks
        c = 300 * (12 ** (p if up else 1 - p))
        out[edges[b]:edges[b + 1]] = bp(noise[edges[b]:edges[b + 1]], c * 0.7, c * 1.6, 1)
    out *= np.sin(np.linspace(0, np.pi, n)) ** 1.6
    st = np.stack([out, np.roll(out, 240)], axis=1)
    m.place('sfx', t, st, gain=gain, send=0.6)


def riser(m, t, dur, gain=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 220 * (4 ** (tt / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    nz = hp(RNG.standard_normal(n), 2000) * 0.3
    x = (tone + nz) * (tt / dur) ** 2.2
    m.place('sfx', t, x, gain=gain, send=0.8)


def impact(m, t, gain=0.5, shimmer=True):
    n = int(3.0 * SR)
    tt = np.arange(n) / SR
    f = 38 + 50 * np.exp(-tt * 6)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    m.place('sfx', t, x, gain=gain)
    if shimmer:
        sh = sum(np.sin(2 * np.pi * note(nn) * tt) for nn in ("D6", "A6", "E7")) / 3
        sh *= np.exp(-tt * 1.4) * (1 - np.exp(-tt * 30))
        m.place('sfx', t, sh, gain=gain * 0.14, send=0.3 / 0.14)


def slam(m, t, gain=0.3):
    """Kinetic-type hit: a tight sub thump with a felt transient and a short room."""
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    f = 52 + 120 * np.exp(-tt * 45)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11)
    x += bp(RNG.standard_normal(n), 400, 2600) * np.exp(-tt * 70) * 0.35
    x += hp(RNG.standard_normal(n), 5000) * np.exp(-tt * 200) * 0.12
    m.place('sfx', t, x, gain=gain, send=0.5)


def braam(m, t, gain=0.5, root='D1'):
    """Cinematic brass-like swell for the SHOW hit: detuned saw stack, filter opening then closing."""
    dur = 3.4
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros((n, 2))
    base = note(root)
    for mult, g in ((1, 1.0), (2, 0.8), (3, 0.45), (4, 0.3), (6, 0.15)):
        for ch, det in enumerate((-0.09, 0.09)):
            out[:, ch] += saw(base * mult * 2 ** (det / 12), n, phase=RNG.random()) * g
    # time-varying low-pass: block-wise cutoff 300 → 2600 → 500 Hz
    blocks = 80
    edges = np.linspace(0, n, blocks + 1, dtype=int)
    y = np.zeros_like(out)
    for b in range(blocks):
        p = b / blocks
        c = 300 + 2300 * np.exp(-((p - 0.06) ** 2) / 0.01) + 200 * (1 - p)
        y[edges[b]:edges[b + 1]] = lp(out[edges[b]:edges[b + 1]], c, 2)
    y *= (env(n, 0.012, 0.4, 0.55, 2.4) * np.exp(-tt * 0.5))[:, None]
    y = np.tanh(y * 0.6)
    m.place('sfx', t, y, gain=gain, send=0.7)
    # sub drop underneath
    f = 70 * np.exp(-tt * 1.4) + 32
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.3)
    m.place('sfx', t, sub, gain=gain * 0.9)
    # crash
    cn = int(2.4 * SR)
    ct = np.arange(cn) / SR
    crash = hp(RNG.standard_normal((cn, 2)), 3000) * np.exp(-ct * 2.2)[:, None]
    m.place('sfx', t, crash, gain=gain * 0.12, send=0.8)


def reverse_swell(m, t_end, dur=0.8, gain=0.12):
    """Reversed noise+tone swell that lands at t_end."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 800, 7000) * 0.5 + np.sin(2 * np.pi * note('A4') * tt) * 0.2
    x *= np.exp(-tt * 4)
    x = x[::-1]
    m.place('sfx', t_end - dur, x, gain=gain, send=1.0)


def swap_note(m, t, f, gain=0.08, pan=0.0):
    """A swap: a soft pitched glide between two notes (the two cells trading places)."""
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    glide = f * (1 + 0.5 * (1 - np.exp(-tt * 18)))
    x = np.sin(2 * np.pi * np.cumsum(glide) / SR) * np.exp(-tt * 7)
    x += 0.25 * np.sin(4 * np.pi * np.cumsum(glide) / SR) * np.exp(-tt * 12)
    m.place('sfx', t, x, pan=pan, gain=gain, send=0.6)


def tick(m, t, gain=0.05, f=2200, pan=0.3):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120)
    m.place('sfx', t, x, gain=gain, pan=pan)


# ── Mastering helpers ─────────────────────────────────────────────────────────

def reverb(send, seconds=2.6, decay=2.6):
    ir_len = int(seconds * SR)
    tt = np.arange(ir_len) / SR
    ir = RNG.standard_normal((ir_len, 2)) * np.exp(-tt * decay)[:, None]
    ir = lp(ir, 6000, 1)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    return np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:len(send)] for c in range(2)], axis=1)


def compress(x, thresh_db=-24.0, ratio=2.4, release=0.18):
    from scipy.ndimage import uniform_filter1d
    power = uniform_filter1d((x ** 2).mean(axis=1), size=int(0.03 * SR))
    level = 10 * np.log10(power + 1e-12)
    gr = -np.maximum(level - thresh_db, 0) * (1 - 1 / ratio)
    a = np.exp(-1 / (release * SR))
    gr = signal.lfilter([1 - a], [1, -a], gr)
    return x * (10 ** (gr / 20))[:, None]


def envelope_follow(x, attack=0.03, release=0.35):
    """Smoothed amplitude envelope (mono) for side-chain ducking."""
    a = np.abs(x if x.ndim == 1 else x.mean(axis=1))
    out = np.zeros_like(a)
    ga = np.exp(-1 / (attack * SR))
    gr = np.exp(-1 / (release * SR))
    # vectorised approximation: peak-hold over 20 ms, then one-pole smoothing
    from scipy.ndimage import maximum_filter1d
    a = maximum_filter1d(a, size=int(0.02 * SR))
    out = signal.lfilter([1 - gr], [1, -gr], a)
    return np.maximum(out, signal.lfilter([1 - ga], [1, -ga], a))


def write_wav(path, mix):
    import wave
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_wav_mono(path):
    import wave
    with wave.open(path) as w:
        assert w.getframerate() == SR, path
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(axis=1)
    return x
