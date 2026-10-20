"""
Measures where the real captured footage moves, so the edit can speed through
static holds and play every real animation at 1x.

Writes public/capture/analysis.json:
  { shot: { canvas: [energy per frame], panel: [...], amberFrame: n | null } }
Run:  python -I scripts/analyze_capture.py
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "public", "capture")
manifest = json.load(open(os.path.join(CAP, "manifest.json"), encoding="utf8"))

W, H = 384, 216  # analysis resolution (1920x1080 / 5)
# Regions in app CSS px → analysis px
CANVAS = (360 // 5, 120 // 5, 1550 // 5, 880 // 5)
PANEL = (1560 // 5, 100 // 5, 1900 // 5, 980 // 5)


def load(shot, i):
    im = Image.open(os.path.join(CAP, shot, f"{i:04d}.jpg")).convert("RGB").resize((W, H), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32)


def amber_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 170) & (g > 90) & (g < 200) & (b < 90) & (r - b > 110)


out = {}
for shot in ("play", "answer", "resume", "doubt-wait", "reveal", "send"):
    info = manifest["shots"].get(shot)
    if not info:
        continue
    n = info["frames"]
    prev = None
    canvas, panel, amber = [], [], []
    for i in range(n):
        f = load(shot, i)
        g = f.mean(axis=2)
        if prev is None:
            canvas.append(0.0)
            panel.append(0.0)
        else:
            d = np.abs(g - prev)
            x0, y0, x1, y1 = CANVAS
            canvas.append(float(d[y0:y1, x0:x1].mean()))
            x0, y0, x1, y1 = PANEL
            panel.append(float(d[y0:y1, x0:x1].mean()))
        x0, y0, x1, y1 = CANVAS
        amber.append(int(amber_mask(f[y0:y1, x0:x1]).sum()))
        prev = g
    first_amber = next((i for i, a in enumerate(amber) if a > 12), None)
    out[shot] = {
        "canvas": [round(v, 3) for v in canvas],
        "panel": [round(v, 3) for v in panel],
        "amber": amber,
        "amberFrame": first_amber,
    }
    print(f"{shot}: {n} frames, amber at {first_amber}, peak canvas motion {max(canvas):.2f}")

json.dump(out, open(os.path.join(CAP, "analysis.json"), "w"), indent=1)
