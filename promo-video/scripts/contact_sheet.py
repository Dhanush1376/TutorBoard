"""Review helper: tile selected frames of a render into a labelled contact sheet."""
import sys
from PIL import Image, ImageDraw

src, out, *frames = sys.argv[1:]
frames = [int(f) for f in frames]
cols = 3
w, h = 480, 270
rows = (len(frames) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "black")
draw = ImageDraw.Draw(sheet)
for k, f in enumerate(frames):
    im = Image.open(f"{src}/{f:04d}.jpg").convert("RGB").resize((w, h))
    x, y = (k % cols) * w, (k // cols) * h
    sheet.paste(im, (x, y))
    draw.rectangle([x, y, x + 52, y + 18], fill="black")
    draw.text((x + 4, y + 3), str(f), fill="#F5A524")
sheet.save(out)
