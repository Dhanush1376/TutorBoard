"""QC: blend a rendered still of the recreated UI with the real 4K capture.

usage: python -I scripts/compare_ui.py <ours.png> <real.jpg> <out_prefix>
Writes <out_prefix>_blend.jpg (50/50) and <out_prefix>_pair.jpg (ours | real crops).
"""
import sys
from PIL import Image

ours, real, out = sys.argv[1], sys.argv[2], sys.argv[3]
a = Image.open(ours).convert('RGB')
b = Image.open(real).convert('RGB').resize((1920, 1080), Image.LANCZOS)
Image.blend(a, b, 0.5).save(out + '_blend.jpg', quality=92)
w = Image.new('RGB', (1000, 800))
w.paste(a.crop((0, 0, 500, 400)), (0, 0))
w.paste(b.crop((0, 0, 500, 400)), (500, 0))
w.paste(a.crop((1550, 90, 1900, 490)).resize((500, 400)), (0, 400))
w.paste(b.crop((1550, 90, 1900, 490)).resize((500, 400)), (500, 400))
w.save(out + '_pair.jpg', quality=92)
