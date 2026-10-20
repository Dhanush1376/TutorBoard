"""Contact sheets for an eval run: per domain, a middle and the last frame of every question.

    python client/scripts/eval-sheets.py docs/eval/runs/<run>

Writes <run>/sheet-<domain>.png — for reviewing the rubric's judgement scores at a glance.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

run = sys.argv[1]
def rows_of(run):
    path = os.path.join(run, 'report.json')
    if os.path.exists(path):
        report = json.load(open(path, encoding='utf8'))
        return report['rows'] if isinstance(report, dict) else report
    # a run still in progress: rebuild rows from the per-question results
    questions = {q['id']: q for q in json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'eval', 'questions.json'), encoding='utf8'))['questions']}
    rows = []
    for name in sorted(os.listdir(run)):
        qid = name[:-5]
        if not name.endswith('.json') or qid not in questions:
            continue
        d = json.load(open(os.path.join(run, name), encoding='utf8'))
        beats = len([f for f in os.listdir(run) if f.startswith(qid + '_') and f.endswith('.png')])
        rows.append({'id': qid, 'domain': questions[qid]['domain'], 'ok': bool(d.get('ok')), 'attempts': d.get('attempts', 0),
                     'seconds': round((d.get('ms') or 0) / 1000, 1), 'beats': beats,
                     'title': (d.get('scene') or {}).get('title', ''), 'error': '' if d.get('ok') else str((d.get('errors') or [{}])[0].get('message', d.get('error', '')))})
    return rows

rows = rows_of(run)
W, H = 560, 470  # one thumbnail
try:
    font = ImageFont.truetype('arial.ttf', 15)
except OSError:
    font = ImageFont.load_default()

by_domain = {}
for r in rows:
    by_domain.setdefault(r['domain'], []).append(r)

for domain, items in by_domain.items():
    sheet = Image.new('RGB', (W * 2, (H + 26) * len(items)), (10, 10, 12))
    draw = ImageDraw.Draw(sheet)
    for row, r in enumerate(items):
        y = row * (H + 26)
        status = f"{r['id']}  {'ok' if r['ok'] else 'FAILED'}  {r['attempts']} try  {r['seconds']}s  {r['beats']} beats  —  {r['title'] if r['ok'] else r['error']}"
        draw.text((8, y + 4), status[:140], fill=(230, 230, 230) if r['ok'] else (255, 120, 120), font=font)
        if not r['ok'] or not r['beats']:
            continue
        for col, beat in enumerate([max(0, r['beats'] // 2 - 1), r['beats'] - 1]):
            path = os.path.join(run, f"{r['id']}_{beat}.png")
            if not os.path.exists(path):
                continue
            img = Image.open(path).convert('RGB')
            img.thumbnail((W - 6, H - 6))
            sheet.paste(img, (col * W + 3, y + 26))
    out = os.path.join(run, f'sheet-{domain}.png')
    sheet.save(out)
    print(out)
