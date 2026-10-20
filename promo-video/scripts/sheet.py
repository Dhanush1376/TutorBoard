"""QC: tile a folder of stills into a labelled contact sheet.

usage: python -I scripts/sheet.py <dir> <out.jpg> [cols] [tile_width]
"""
import os
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
files = sorted(f for f in os.listdir(src) if f.endswith('.jpg'))
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(src, f)).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 52, y + 16], fill=(0, 0, 0))
    d.text((x + 3, y + 2), f[:-4], fill=(255, 210, 80))
sheet.save(out, quality=88)
print(out, sheet.size)
