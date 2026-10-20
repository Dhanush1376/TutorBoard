"""Light-mode version of a finished cut: same frames, same timing, same audio.

usage: python -I scripts/grade_light.py <in.mp4> <out.mp4> [crf]
       python -I scripts/grade_light.py --stills <outdir> <frame.png> [...]   (preview)

Each pixel of the dark film is unmixed into "a grey + some amount of one accent
colour", and both parts are mapped to the light theme:

- the grey flips along the app's light axis: background -> bone #F9F6E5,
  ink -> #1A1A18 (client/src/index.css). The curve flattens the faint backdrop
  gradients near the background and darkens mid greys so secondary text reads
  clearly;
- every accent hue maps to one fixed light-mode hex (PALETTE), chosen to read
  on bone. A pale accent tint becomes a dark tinted ink, a dark tinted panel a
  light tint;
- amber / orange / yellow are removed: solid strokes, text and borders become
  ink, and their glows, flashes and tinted fills disappear. Red keeps its hex
  but loses its glows too (on bone a red halo fades through peach). Glow vs.
  stroke is decided per frame: these pixels survive only right next to solid
  colour.

The audio stream is copied untouched. Needs a full ffmpeg (rawvideo +
libx264): the one shipped with imageio-ffmpeg; and OpenCV for the glow mask.
"""
import json
import re
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# ── light axis ───────────────────────────────────────────────────────────────
# The dark film's measured background and ink (film plates and real captures).
SRC_BG = np.array([7, 7, 6], np.float64)
SRC_INK = np.array([248, 247, 243], np.float64)
BONE = np.array([0xF9, 0xF6, 0xE5], np.float64)  # --color-bg-primary
INK = np.array([0x1A, 0x1A, 0x18], np.float64)  # --color-text-primary
TOE, TOE_SOFT = 0.02, 0.008  # source lightness below ~TOE collapses onto flat bone
BOOST = 2.0  # >1 darkens mid greys: the app's tertiary labels reach 4.5:1 on bone and on panels
KNEE = 0.3  # ...while greys below this stay linear, so panels keep their light tone (#F1EEDE)

# ── accents: dark-film colour -> light-mode hex ──────────────────────────────
# Each target clears WCAG 4.5:1 on bone and on the panel grey (#F1EEDE).
# None = removed (drawn in ink). Families in STRIP lose their glows and tints.
PALETTE = [
    ('red', '#EF4444', '#B91C1C'),
    ('orange', '#F97316', None),
    ('amber', '#F59E0B', None),
    ('yellow', '#FBBF24', None),
    ('green', '#22C55E', '#137336'),
    ('teal', '#2DD4BF', '#0F766E'),
    ('cyan', '#22D3EE', '#0B6E88'),
    ('blue', '#60A5FA', '#1D4ED8'),
    ('indigo', '#6366F1', '#4F46E5'),
    ('pink', '#EC4899', '#BE185D'),
]
STRIP = {'red', 'orange', 'amber', 'yellow'}
HUE_SHARPNESS = 30.0
REMOVED_BIAS = 1.5  # pulls the red/orange boundary toward red (~28 deg), so orange edges never turn red
# glow mask: a STRIP colour counts as "solid" from CORE_LO..CORE_HI strength,
# or when it is fine detail (a thin icon stroke: DETAIL_LO..DETAIL_HI above its
# blurred surroundings); anything farther than ~CORE_REACH px from solid colour
# is a glow, flash or tinted fill and is dropped. Thin strokes arrive at ~half
# strength (1.5 px lines, 4:2:0 chroma), so solid colour is drawn at
# SOLID_GAIN x its strength.
CORE_LO, CORE_HI, CORE_REACH = 0.25, 0.5, 2
DETAIL_LO, DETAIL_HI, DETAIL_SIGMA = 0.06, 0.14, 3.0
SOLID_GAIN = 1.6

LUMA = np.array([0.2126, 0.7152, 0.0722])
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float64)


def light_axis(lum):
    """Luma of a dark-film grey -> light-theme RGB."""
    l0, l1 = SRC_BG @ LUMA, SRC_INK @ LUMA
    t = np.clip((lum - l0) / (l1 - l0), 0, 1)
    sp = lambda x: TOE_SOFT * np.logaddexp(0, x / TOE_SOFT)
    g = (sp(t - TOE) - sp(-TOE)) / (sp(1 - TOE) - sp(-TOE))
    g = np.clip(g, 0, 1)
    w = np.clip(g / KNEE, 0, 1)
    h = g + (1 - (1 - g) ** BOOST - g) * w * w * (3 - 2 * w)
    return BONE + h[..., None] * (INK - BONE)


# chroma plane (luma-free) and its hue angle
_e1 = np.array([1.0, -1.0, 0.0]); _e1 -= LUMA * (_e1 @ LUMA) / (LUMA @ LUMA); _e1 /= np.linalg.norm(_e1)
_e2 = np.cross(LUMA / np.linalg.norm(LUMA), _e1)


def build_luts():
    """For every 24-bit colour: light output with its STRIP colour dropped (out0)
    or kept solid (out1), and that colour's strength (for the glow mask)."""
    fam = []
    for name, src, dst in PALETTE:
        a = hexrgb(src)
        c = a - a @ LUMA
        fam.append(dict(name=name, A=a, lA=a @ LUMA, c=c, cc=c @ c,
                        th=np.arctan2(c @ _e2, c @ _e1),
                        dst=None if dst is None else hexrgb(dst)))
    n = 1 << 24
    out0 = np.empty((n, 3), np.uint8)
    out1 = np.empty((n, 3), np.uint8)
    strip = np.empty(n, np.uint8)
    step = 1 << 20
    for lo in range(0, n, step):
        i = np.arange(lo, lo + step)
        s = np.stack([(i >> 16) & 255, (i >> 8) & 255, i & 255], 1).astype(np.float64)
        ls = s @ LUMA
        c = s - ls[:, None]
        th = np.arctan2(c @ _e2, c @ _e1)
        logits = np.stack([HUE_SHARPNESS * np.cos(th - f['th']) + (REMOVED_BIAS if f['dst'] is None else 0) for f in fam], 1)
        w = np.exp(logits - logits.max(1, keepdims=True))
        w /= w.sum(1, keepdims=True)
        o0 = np.zeros_like(s); o1 = np.zeros_like(s); am = np.zeros(len(s))
        for k, f in enumerate(fam):
            a = np.clip((c @ f['c']) / f['cc'], 0, 0.985)
            grey = light_axis((ls - a * f['lA']) / (1 - a))
            wk = w[:, k:k + 1]
            if f['name'] in STRIP:
                o0 += wk * grey
                ag = np.minimum(1, SOLID_GAIN * a)[:, None]
                o1 += wk * ((1 - ag) * grey + ag * (INK if f['dst'] is None else f['dst']))
                am += w[:, k] * a
            else:
                mixed = (1 - a)[:, None] * grey + a[:, None] * f['dst']
                o0 += wk * mixed
                o1 += wk * mixed
        out0[lo:lo + step] = np.clip(np.rint(o0), 0, 255)
        out1[lo:lo + step] = np.clip(np.rint(o1), 0, 255)
        strip[lo:lo + step] = np.clip(np.rint(am * 255), 0, 255)
    return out0, out1, strip


def grade(rgb, luts):
    """One HxWx3 uint8 dark frame -> light frame."""
    out0, out1, strip = luts
    idx = (rgb[..., 0].astype(np.int32) << 16) | (rgb[..., 1].astype(np.int32) << 8) | rgb[..., 2]
    o0 = out0[idx]
    a = strip[idx]
    if a.max() < DETAIL_LO * 255:
        return o0
    a = a.astype(np.float32) / 255
    detail = a - cv2.GaussianBlur(a, (0, 0), DETAIL_SIGMA)
    core = np.clip(np.maximum((a - CORE_LO) / (CORE_HI - CORE_LO), (detail - DETAIL_LO) / (DETAIL_HI - DETAIL_LO)), 0, 1)
    k = 2 * CORE_REACH + 1
    keep = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    keep = cv2.GaussianBlur(keep, (0, 0), 0.8)[..., None]
    o1 = out1[idx].astype(np.float32)
    return np.clip(np.rint(o0 + keep * (o1 - o0)), 0, 255).astype(np.uint8)


def probe(src):
    """Width, height and frame rate of the source (ffmpeg -i prints them)."""
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', src], capture_output=True, text=True).stderr
    m = re.search(r'Video: .*?, (\d{2,5})x(\d{2,5})', out)
    fps = re.search(r'(\d+(?:\.\d+)?) fps', out)
    return int(m.group(1)), int(m.group(2)), fps.group(1)


def grade_video(src, dst, crf='12'):
    luts = build_luts()
    W, H, FPS = probe(src)
    frame_bytes = W * H * 3
    decode = subprocess.Popen(
        [FFMPEG, '-v', 'error', '-i', src, '-map', '0:v:0', '-fps_mode', 'passthrough',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        stdout=subprocess.PIPE,
    )
    # Same delivery format as the source render: H.264 high, 4:2:0, full range BT.601.
    encode = subprocess.Popen(
        [FFMPEG, '-v', 'error', '-y',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-framerate', FPS, '-i', '-',
         '-i', src,
         '-map', '0:v', '-map', '1:a?',
         '-vf', 'scale=out_color_matrix=bt601:out_range=full,format=yuvj420p',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high',
         '-color_range', 'pc', '-colorspace', 'bt470bg',
         '-c:a', 'copy', '-movflags', '+faststart', dst],
        stdin=subprocess.PIPE,
    )
    n = 0
    while True:
        buf = decode.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        encode.stdin.write(grade(np.frombuffer(buf, np.uint8).reshape(H, W, 3), luts).tobytes())
        n += 1
        if n % 150 == 0:
            print(f'{n} frames', flush=True)
    encode.stdin.close()
    decode.wait()
    encode.wait()
    print(json.dumps({'frames': n, 'size': f'{W}x{H}', 'fps': FPS, 'out': dst}))
    return decode.returncode or encode.returncode


if __name__ == '__main__':
    if sys.argv[1] == '--stills':
        from pathlib import Path
        from PIL import Image
        luts = build_luts()
        out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        for p in sys.argv[3:]:
            Image.fromarray(grade(np.asarray(Image.open(p).convert('RGB')), luts)).save(out / Path(p).name)
        sys.exit(0)
    sys.exit(grade_video(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '12'))
