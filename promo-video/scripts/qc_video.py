"""QC a rendered film: stream info, black runs, frozen runs, audio level per section.

usage: python -I scripts/qc_video.py out/TutorBoard-Film-v3.mp4
Uses Remotion's bundled ffmpeg/ffprobe (`npx remotion ffmpeg|ffprobe`), which
lacks blackdetect/freezedetect — so the analysis happens here on raw frames.
"""
import json
import subprocess
import sys

import numpy as np

path = sys.argv[1]
W, H = 192, 108


def run(args, binary=False):
    cmd = 'npx remotion ' + ' '.join(args)
    return subprocess.run(cmd, shell=True, capture_output=True, check=True).stdout if binary else \
        subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True).stdout


info = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f'"{path}"']))
for s in info['streams']:
    if s['codec_type'] == 'video':
        print(f"video  {s['codec_name']} {s['width']}x{s['height']} {s.get('pix_fmt')} {s['r_frame_rate']} fps, {s.get('nb_frames')} frames")
    else:
        print(f"audio  {s['codec_name']} {s['sample_rate']} Hz {s['channels']} ch")
print(f"duration {float(info['format']['duration']):.3f} s, size {int(info['format']['size']) / 1e6:.1f} MB")

# (the bundled ffmpeg has no raw muxers — go through small images and a wav)
import os
import tempfile
import wave
from PIL import Image

tmp = tempfile.mkdtemp(prefix='qc_')
run(['ffmpeg', '-v', 'error', '-i', f'"{path}"', '-vf', f'scale={W}:{H}', '-q:v', '3', f'"{tmp}/%05d.jpg"'])
names = sorted(n for n in os.listdir(tmp) if n.endswith('.jpg'))
frames = np.stack([np.asarray(Image.open(os.path.join(tmp, n)).convert('L'), dtype=np.float32) for n in names])
fps = 30
mean = frames.mean(axis=(1, 2))
diff = np.r_[np.inf, np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))]


def runs(mask, min_len):
    out, start = [], None
    for i, m in enumerate(np.r_[mask, False]):
        if m and start is None:
            start = i
        elif not m and start is not None:
            if i - start >= min_len:
                out.append((start, i - 1))
            start = None
    return out


black = runs(mean < 2.0, 6)
frozen = runs(diff < 0.15, 24)  # jpeg noise floor
print('black runs (>=0.2 s):', [(a, b, f'{a / fps:.2f}-{b / fps:.2f}s') for a, b in black] or 'none')
print('frozen runs (>=0.8 s):', [(a, b, f'{a / fps:.2f}-{b / fps:.2f}s') for a, b in frozen] or 'none')

run(['ffmpeg', '-v', 'error', '-i', f'"{path}"', '-ac', '1', '-ar', '8000', f'"{tmp}/a.wav"'])
with wave.open(os.path.join(tmp, 'a.wav')) as w:
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
sec = 8000
lv = [20 * np.log10(np.sqrt(np.mean(a[i * sec:(i + 2) * sec] ** 2)) + 1e-9) for i in range(0, len(a) // sec - 1, 2)]
print('audio dB per 2 s:', ' '.join(f'{v:.0f}' for v in lv))
print(f'audio peak {20 * np.log10(np.abs(a).max() + 1e-9):.1f} dBFS')
