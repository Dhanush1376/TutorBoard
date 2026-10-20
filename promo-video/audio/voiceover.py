"""
Voiceover for the v3 cut, synthesized with Microsoft Edge's neural TTS (edge-tts).

Reads the VO lines from src/v3/plan.json, writes one file per line to
public/audio/vo/NN.mp3 and a manifest with each line's measured duration
(public/audio/vo/vo.json) so the score can duck under it and the film can
check the lines fit their windows.

Run inside the isolated venv (no credentials needed; requires network):
    .venv-vo/Scripts/python.exe -I audio/voiceover.py [--voice en-US-AndrewNeural]
Note: edge-tts uses Microsoft's online read-aloud service; check its terms
before commercial use.
"""
import argparse
import asyncio
import json
import os
import subprocess

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--voice', default='en-US-AndrewNeural')
ap.add_argument('--rate', default='-4%')
ap.add_argument('--pitch', default='-2Hz')
args = ap.parse_args()

with open(os.path.join(ROOT, 'src', 'v3', 'plan.json'), encoding='utf8') as fh:
    plan = json.load(fh)

out_dir = os.path.join(ROOT, 'public', 'audio', 'vo')
os.makedirs(out_dir, exist_ok=True)


WORDS = {}


async def synth(i, text):
    """Write line i to NN.mp3, keeping the service's word timings for kinetic type."""
    path = os.path.join(out_dir, f'{i:02d}.mp3')
    for attempt in range(4):
        try:
            # word timings when the service provides them; plain sentence mode as a fallback
            boundary = 'WordBoundary' if attempt < 2 else 'SentenceBoundary'
            com = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch, boundary=boundary)
            words = []
            with open(path, 'wb') as fh:
                async for chunk in com.stream():
                    if chunk['type'] == 'audio':
                        fh.write(chunk['data'])
                    elif chunk['type'] == 'WordBoundary':
                        words.append({'w': chunk['text'], 't': round(chunk['offset'] / 1e7, 3), 'd': round(chunk['duration'] / 1e7, 3)})
            WORDS[i] = words
            return path
        except edge_tts.exceptions.NoAudioReceived:
            print(f'  retry {i} ({attempt + 1}): {text}')
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f'no audio for line {i}: {text}')


async def main():
    paths = []
    for i, line in enumerate(plan['vo']):
        paths.append(await synth(i, line['text']))
    return paths


paths = asyncio.run(main())

# Decode to 48 kHz wav with Remotion's bundled ffmpeg and measure.
ffmpeg = ['npx', 'remotion', 'ffmpeg']
lines = []
for i, (p, line) in enumerate(zip(paths, plan['vo'])):
    wav = p[:-4] + '.wav'
    subprocess.run(' '.join(ffmpeg + ['-y', '-loglevel', 'error', '-i', f'"{p}"', '-ar', '48000', '-ac', '1', f'"{wav}"']),
                   check=True, shell=True, cwd=ROOT)
    import wave
    with wave.open(wav) as w:
        dur = w.getnframes() / w.getframerate()
    lines.append({**line, 'file': os.path.relpath(wav, ROOT).replace('\\', '/'), 'dur': round(dur, 3), 'words': WORDS.get(i, [])})
    print(f"{i:02d}  {dur:5.2f}s  @{line['f'] / plan['fps']:6.2f}s  {line['text']}")

with open(os.path.join(out_dir, 'vo.json'), 'w', encoding='utf8') as fh:
    json.dump({'voice': args.voice, 'rate': args.rate, 'pitch': args.pitch, 'lines': lines}, fh, indent=1)
