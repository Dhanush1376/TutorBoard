"""
TutorBoard v3 (60 s) — original score, sound design and voiceover mix.

Reads src/v3/plan.json (scripts/build-plan-v3.mjs) so every slam, keystroke,
click, swap and hit lands on its frame, and public/audio/vo/vo.json
(audio/voiceover.py) for the voiceover. Writes:
  public/audio/score_v3.wav     music + sound design (no voice)
  public/audio/score_v3_vo.wav  the same with the voiceover, music ducked under it
Run:  python -I audio/build_score_v3.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from synth import (SR, Mix, bass, bell, braam, clap, compress, envelope_follow, hat, hp, impact, kick, lp,  # noqa: E402
                   key_tick, mouse_click, note, pad, pluck, read_wav_mono, reverb, reverse_swell, riser, slam,
                   swap_note, thock, tick, whoosh, write_wav, bp)

with open(os.path.join(ROOT, 'src', 'v3', 'plan.json'), encoding='utf8') as fh:
    P = json.load(fh)
FPS = P['fps']
TOTAL = P['totalFrames'] / FPS
BEAT = 60.0 / P['bpm']
BAR = 4 * BEAT
C = P['cues']
MU = P['music']


def sec(f):
    return f / FPS


m = Mix(TOTAL + 0.5)

DROP = sec(MU['drop'])  # the downbeat everything is counted from
CHORDS = [  # D minor: i – VI – III – VII
    ['D3', 'F3', 'A3', 'C4', 'E4'],
    ['Bb2', 'D3', 'F3', 'A3', 'C4'],
    ['F3', 'A3', 'C4', 'E4', 'G4'],
    ['C3', 'E3', 'G3', 'A3', 'D4'],
]
ROOTS = ['D2', 'Bb1', 'F2', 'C2']
ARP = [['D4', 'A4', 'F4', 'C5'], ['Bb3', 'F4', 'D4', 'A4'], ['F4', 'C5', 'A4', 'E5'], ['C4', 'G4', 'E4', 'D5']]


def chord_at(t):
    return int(max(0.0, t - DROP) // BAR) % 4


# ── 1. Hook ──────────────────────────────────────────────────────────────────
show = sec(P['hook']['show'])
split = sec(P['hook']['split'][0])
# low drone that tightens towards SHOW
n = int((show + 0.15) * SR)
tt = np.arange(n) / SR
drone = (np.sin(2 * np.pi * note('D1') * tt) * 0.7 + np.sin(2 * np.pi * note('A1') * tt) * 0.35
         + lp(np.random.default_rng(3).standard_normal(n), 220) * 0.25)
drone *= np.clip(tt / show, 0, 1) ** 1.6 * 0.9 + 0.1
drone[-int(0.12 * SR):] *= np.linspace(1, 0, int(0.12 * SR))
m.place('music', 0.0, drone, gain=0.22)
# a clock in the dark — the drop's tempo, before the drop
t = DROP - BEAT
while t > 0.25:
    tick(m, t, gain=0.028, f=1500, pan=0.0)
    t -= BEAT
for s in C['slams']:
    slam(m, sec(s['f']), gain=s['gain'])
for r in C['risers']:
    riser(m, sec(r['f']), sec(r['dur']), gain=r['gain'])
braam(m, show, gain=0.55)
reverse_swell(m, show, dur=0.7, gain=0.12)

# ── 2. Drop into the product ─────────────────────────────────────────────────
reveal = sec(P['scenes']['hero'][0] + P['hero']['reveal'][0])
doubt0 = sec(MU['doubt'][0])
resume = sec(MU['doubt'][1])
mont0 = sec(MU['montage'][0])
wall = sec(MU['wall'])
brand = sec(MU['brand'])


def groove(t0, t1, level):
    """level 1: half-time · 2: full · 3: montage (busier hats, open hats, brighter arp)."""
    t = t0
    b = int(round((t0 - DROP) / BEAT))
    while t < t1 - 1e-6:
        beat = b % 4
        ci = chord_at(t)
        if level == 1:
            if beat in (0, 2):
                kick(m, t, gain=0.4)
            hat(m, t + BEAT / 2, gain=0.03)
        else:
            if beat in (0, 2) or (level == 3 and beat == 1):
                kick(m, t, gain=0.46)
            if beat == 1:
                kick(m, t + BEAT / 2, gain=0.3, punch=0.7)
            if beat in (1, 3):
                clap(m, t, gain=0.065)
            hat(m, t + BEAT / 2, gain=0.04, open_=(level == 3), pan=0.2)
            for s in (1, 3):
                hat(m, t + s * BEAT / 4, gain=0.018 if level == 2 else 0.026, pan=-0.2)
        # bass: 8th-note pulse on the chord root
        for e in (0, 1):
            bass(m, note(ROOTS[ci]), t + e * BEAT / 2, BEAT / 2 * 0.92, gain=0.13 if level > 1 else 0.11)
        if level > 1 or beat in (0, 2):
            for s in range(4 if level > 1 else 2):
                pluck(m, note(ARP[ci][(b * 4 + s) % 4]), t + s * BEAT / (4 if level > 1 else 2),
                      gain=0.032 if level == 2 else 0.036 if level == 3 else 0.028,
                      pan=-0.35 + 0.7 * (s % 2), bright=2600 if level < 3 else 4200, decay=9)
        t += BEAT
        b += 1


def pads(t0, t1, gain, cutoff):
    t = t0
    while t < t1 - 1e-6:
        d = min(BAR, t1 - t)
        pad(m, [note(x) for x in CHORDS[chord_at(t)]], t, d, gain=gain, cutoff=cutoff, attack=0.5, release=1.2)
        t += BAR


impact(m, DROP, gain=0.5, shimmer=True)
pads(DROP, doubt0, 0.085, 1800)
groove(DROP, reveal, 1)
groove(reveal, doubt0, 2)

# ── 3. Doubt: the room goes quiet — pad and a clock ──────────────────────────
pads(doubt0, resume, 0.07, 1100)
t = doubt0
while t < resume - 1e-6:
    tick(m, t, gain=0.03, f=1800, pan=0.25)
    if int(round((t - doubt0) / BEAT)) % 2 == 0:
        kick(m, t, gain=0.16, punch=0.4)
    t += BEAT
reverse_swell(m, resume, dur=1.0, gain=0.13)

# ── 4. Resume → montage: the groove comes back, then opens up ────────────────
pads(resume, wall, 0.085, 2400)
groove(resume, mont0, 2)
groove(mont0, wall + BAR / 2, 3)
# ── 5. Wall: hold, lift, breathe in ──────────────────────────────────────────
pad(m, [note(x) for x in ['D3', 'A3', 'D4', 'F4', 'A4', 'C5']], wall, brand - wall, gain=0.09, cutoff=3200, attack=0.4, release=1.0)
reverse_swell(m, brand, dur=1.2, gain=0.14)

# ── 6. Brand: resolve to D major (the "aha"), then let it ring ───────────────
pad(m, [note(x) for x in ['D3', 'A3', 'D4', 'F#4', 'A4', 'E5']], brand, TOTAL - brand - 1.2, gain=0.12, cutoff=3000, attack=1.0, release=2.4)
bass(m, note('D2'), brand, 6.5, gain=0.1)
motif = ['A4', 'D5', 'F#5', 'E5']
for k, nn in enumerate(motif):
    pluck(m, note(nn), sec(MU['brand'] + P['brand']['taglineB']) + 0.25 + k * BEAT, gain=0.05, pan=-0.3 + 0.2 * k, decay=3.5)

# ── Sound design on the cue sheet ────────────────────────────────────────────
for k, f in enumerate(C['keys']):
    key_tick(m, sec(f), k)
for f in C['clicks']:
    mouse_click(m, sec(f))
for f in C['sends']:
    thock(m, sec(f), gain=0.36)
for w in C['whooshes']:
    whoosh(m, sec(w['f']), w['dur'] / FPS, gain=w.get('gain', 0.14), up=w.get('up', True))
for f in C['impacts'][1:]:  # [0] is SHOW — the braam carries it
    if abs(sec(f['f']) - DROP) < 0.01:
        continue
    impact(m, sec(f['f']), gain=f.get('gain', 0.4), shimmer=f.get('shimmer', True))
PENTA = ['D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6']
for k, s in enumerate(C['swaps']):
    tick(m, sec(s['cmp']), gain=0.05, f=2600, pan=0.1)
    if s['swap']:
        swap_note(m, sec(s['f']), note(PENTA[k % len(PENTA)]), gain=0.085, pan=-0.2 + 0.1 * (k % 5))
    else:
        tick(m, sec(s['f']), gain=0.04, f=900, pan=-0.1)
for b in C['bells']:
    bell(m, note(b['note']), sec(b['f']), gain=b.get('gain', 0.15), pan=b.get('pan', 0.0))

# ── Voiceover ─────────────────────────────────────────────────────────────────
vo_bus = np.zeros((m.N, 2))
vo_path = os.path.join(ROOT, 'public', 'audio', 'vo', 'vo.json')
have_vo = os.path.exists(vo_path)
if have_vo:
    with open(vo_path, encoding='utf8') as fh:
        VO = json.load(fh)
    for line in VO['lines']:
        x = read_wav_mono(os.path.join(ROOT, line['file']))
        x = hp(x, 85, 2)
        x = x + bp(x, 2500, 5500, 1) * 0.35  # presence
        i = int(round(sec(line['f']) * SR))
        n = min(len(x), m.N - i)
        vo_bus[i:i + n] += np.stack([x[:n], x[:n]], axis=1)
    vo_bus = compress(vo_bus, thresh_db=-26, ratio=3.0, release=0.12)
    active = np.abs(vo_bus.mean(axis=1)) > 1e-4
    vo_rms = np.sqrt(np.mean(vo_bus[active] ** 2)) if active.any() else 1
    vo_bus *= (10 ** (-17.5 / 20)) / vo_rms


def master(with_vo):
    send = m.get('send').copy()
    music = m.get('music') + m.get('bass') * 0.95 + m.get('drums') * 0.9
    sfx = m.get('sfx').copy()
    if with_vo:
        e = envelope_follow(vo_bus, attack=0.02, release=0.4)
        e = np.clip(e / (np.percentile(e[e > 1e-4], 90) if (e > 1e-4).any() else 1), 0, 1)
        duck = 10 ** (-7.0 * e / 20)
        music *= duck[:, None]
        sfx *= (10 ** (-3.0 * e / 20))[:, None]
        send = send * duck[:, None]
        # a touch of the room on the voice
        send = send + vo_bus * 0.08
    wet = reverb(send)
    mix = music * 0.9 + sfx + wet * 0.5
    if with_vo:
        act = np.abs(vo_bus.mean(axis=1)) > 0.003
        db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
        print(f'  under the voice: bed {db(mix[act]):.1f} dB, voice {db(vo_bus[act]):.1f} dB')
        mix = mix + vo_bus
    mix = hp(mix, 28, 2)
    mix = compress(mix, thresh_db=-22, ratio=2.2)
    rms = np.sqrt(np.mean(mix ** 2))
    mix *= (10 ** (-15.5 / 20)) / rms
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    peak = np.max(np.abs(mix))
    if peak > 10 ** (-1.0 / 20):
        mix *= (10 ** (-1.0 / 20)) / peak
    fi = int(0.02 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(1.6 * SR)
    end = int(TOTAL * SR)
    mix[end - fo:end] *= np.linspace(1, 0, fo)[:, None] ** 2
    mix[end:] = 0
    return mix[:end]


out_dir = os.path.join(ROOT, 'public', 'audio')
for name, with_vo in (('score_v3.wav', False), ('score_v3_vo.wav', True)):
    if with_vo and not have_vo:
        print('no voiceover found (run audio/voiceover.py) — skipping', name)
        continue
    mix = master(with_vo)
    path = os.path.join(out_dir, name)
    write_wav(path, mix)
    print(f"wrote {path}  {len(mix) / SR:.2f}s  peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS  "
          f"rms {20 * np.log10(np.sqrt(np.mean(mix ** 2))):.1f} dB")
