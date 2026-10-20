# TutorBoard — Launch Film

A cinematic product film of TutorBoard: real captures of the running app,
a resolution-independent rebuild of its lesson screen for the parts the app
can't film yet, code-driven motion design and an original synthesized score.
Isolated from the app: nothing here is imported by `client/` or `server/`.

- **v3 (current) — 60 s, 1920×1080, 30 fps, H.264 + AAC 48 kHz**
  - `out/TutorBoard-Film-v3.mp4` — with voiceover (composition `TutorBoardFilm`)
  - `out/TutorBoard-Film-v3-music-only.mp4` — no voice (composition `TutorBoardFilmNoVO`)
  - `TUTORBOARD VIDEO - LIGHT.mp4` — the voiceover cut in the app's light theme, frame for frame
    (`python -I scripts/grade_light.py <in.mp4> <out.mp4>`: per-hue light palette, amber/orange and
    red glows removed, every text colour and accent at least 4.5:1 on bone; audio copied).
    The first, plain-inversion light cut is kept as `out/TutorBoard-Film-v3-light-v1.mp4`.
- Earlier cuts: `out/TutorBoard-Launch-Film.mp4` (v2, 104 s, capture-only, `TutorBoardLaunch`),
  `out/TutorBoard-Launch-Film-v1-BubbleSort.mp4` (v1, 77 s)
- Creative plan / shot list: [STORYBOARD.md](STORYBOARD.md)

## v3 — what's real and what's rebuilt

| Shot | Source |
|---|---|
| Hook ("What if AI didn't just answer your questions? … SHOW you the answer?") | Motion typography |
| Deep Visual Dive → question typed → Send → *Synthesizing experience* → lesson appears | **Real 4K capture** of the running app |
| Controls tour, Play, Bubble Sort comparing and swapping (pass 1) | **Rebuild** (`src/v3/ui/LessonUI.tsx`), cut in on the real lesson at the same pixel positions |
| Pause → doubt typed in the control bar → the 5 lights up, callout, answer in the Session panel | **Rebuild** of the captured flow; question, answer, follow-up, highlighted cell and callout text are the AI's real output from the capture run |
| Resume → pass 2 → sorted | Rebuild |
| Stack vs Queue, triangle angle sum, projectile at 45°, water molecule, neural network | **Imagined lessons** drawn in the renderer's visual language (`src/v3/boards/Subjects.tsx`) — the intended experience, not captures |
| Wall of lessons, brand end card (logo geometry from `VisaiLogo.jsx`, monochrome) | Motion design |

The rebuild was measured against 4K captures of the app (layout, colours, the
SessionGuide / control-bar font sizes from the source) and checked by
overlaying rendered stills on the real frames (`scripts/compare_ui.py`).

### Reproduce v3

```bash
cd promo-video
npm run plan:v3                     # scene/cue timings → src/v3/plan.json
python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install edge-tts
npm run vo                          # voiceover lines + word timings (network, no credentials)
npm run plan:v3                     # again: locks the hook's word slams to the voice
npm run audio:v3                    # score_v3.wav + score_v3_vo.wav
npm run render:v3 && npm run render:v3:novo
```

Voice: Microsoft Edge neural TTS (`en-US-AndrewNeural`) via `edge-tts`. It is
free and needs no key, but it uses Microsoft's online read-aloud service —
check its terms before commercial use, or swap in a licensed voice: replace the
files in `public/audio/vo/` and re-run `npm run audio:v3`.

## How it's made

| Stage | Tool | Output |
|---|---|---|
| 1. Run the real app | `capture/start-backend.mjs`, `capture/vite.capture.config.mjs` | backend on :5055, client on :5174 |
| 2. Capture the real UI | `capture/film-capture.mjs` (Playwright + virtual clock, 4K, GPU) | `public/capture/**` + `manifest.json` |
| 2b. Capture other subjects | `capture/capture-subjects.mjs` (maths, physics, ML, chemistry) | `public/capture/subjects/**` |
| 3. Measure motion | `scripts/analyze_capture.py` | `public/capture/analysis.json` |
| 4. Build the cue sheet | `scripts/build-timeline.mjs` | `src/timeline.json` |
| 5. Synthesize the score | `audio/build_score.py` (numpy/scipy) | `public/audio/score.wav` |
| 6. Render | Remotion | `out/TutorBoard-Launch-Film.mp4` |

The virtual clock (`page.clock`) drives every timer, `requestAnimationFrame`
and `performance.now` in the page, so the app's own GSAP/framer-motion
animations are captured at exactly 30 fps no matter how long each 4K
screenshot takes. The AI pipeline itself runs for real over the network.

## Reproduce

Prerequisites: Node 22, Python 3 with `numpy`, `scipy`, `Pillow`; the app's
`server/.env` configured; `npm install` in `client/`, `server/`, the repo root
and this folder.

```bash
# 1. Start the real app on isolated ports (never touches :5000)
node promo-video/capture/start-backend.mjs          # terminal A
node client/node_modules/vite/bin/vite.js --configLoader native --config promo-video/capture/vite.capture.config.mjs   # terminal B

# 2–6. From promo-video/
npm run capture                     # ~25 min (4K, GPU)
node capture/capture-subjects.mjs   # ~8 min, the any-subject montage
python -I scripts/analyze_capture.py
node scripts/build-timeline.mjs
npm run audio
npm run render
```

Preview interactively with `npm run studio`.

Notes:
- The capture backend runs with `AI_MODEL=gemini-3.5-flash-lite`
  (`TB_CAPTURE_MODEL` to override). The app's configured default,
  `gemini-3.8-flash`, measured ~70–85 s per call at capture time, which made
  doubts time out.
- Narration is muted in the capture with the app's own control (headless
  Chrome's TTS never reports completion).
- Captured frames and the score are generated, not committed (see `.gitignore`).
- `CAPTURE_PART=doubt npm run capture` re-records only pause → doubt → answer →
  resume in a fresh session (the lesson itself is cached, so it is identical).
  The AI's doubt answer varies run to run; the film uses a take in which it
  highlighted the specific cell asked about. The resume-to-step-4 footage comes
  from an earlier take of the same lesson (the answer card has cleared by then,
  so the frames match).
- Edit decisions on real footage: holds where the app waits for reading time
  are speed-ramped (transitions always play at 1x), and the "Looking at this
  step on your canvas…" frame is held ~1.3 s because the virtual clock was
  paused while the AI answered in real time.
