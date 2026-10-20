/*
 * Saves what is on the canvas as a PNG: the lesson drawing (if any), the
 * learner's strokes and shapes, and their sticky notes.
 */

const PAINT = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight'];

// CSS variables and classes don't survive into an <img>, so copy computed paint onto the clone.
function inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  PAINT.forEach((p) => {
    const v = cs.getPropertyValue(p);
    if (v) dst.style.setProperty(p, v);
  });
  for (let i = 0; i < src.children.length; i++) {
    if (dst.children[i]) inlineStyles(src.children[i], dst.children[i]);
  }
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const rect = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    inlineStyles(svg, clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', rect.width);
    clone.setAttribute('height', rect.height);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, rect });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(' ').forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    lines.push(line);
  });
  return lines;
}

export default async function exportCanvasImage() {
  const layer = document.querySelector('[data-annotation-layer]');
  if (!layer) throw new Error('Canvas not found');
  const box = layer.getBoundingClientRect();
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
  ctx.fillRect(0, 0, box.width, box.height);

  const svgs = [document.querySelector('svg[viewBox="0 0 800 600"]'), layer.querySelector(':scope > svg')].filter(Boolean);
  for (const svg of svgs) {
    try {
      const { img, rect } = await svgToImage(svg);
      ctx.drawImage(img, rect.left - box.left, rect.top - box.top, rect.width, rect.height);
    } catch {
      /* skip a layer that can't be rasterised */
    }
  }

  // Notes: drawn as tilted paper with a glue strip, soft shadow and handwriting.
  if (document.fonts?.load) {
    try {
      await document.fonts.load('500 21px Caveat');
    } catch {
      /* fall back to the system hand */
    }
  }
  layer.querySelectorAll('[data-note]').forEach((el) => {
    const paper = el.querySelector('[data-note-paper]') || el;
    const r = el.getBoundingClientRect();
    const w = paper.offsetWidth;
    const h = paper.offsetHeight;
    const cx = r.left - box.left + r.width / 2;
    const cy = r.top - box.top + r.height / 2;
    const rot = (Number(el.dataset.rot) || 0) * (Math.PI / 180);
    const cs = getComputedStyle(paper);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,0.045)';
    ctx.fillRect(-w / 2, -h / 2, w, 30);

    ctx.fillStyle = cs.color;
    let ty = -h / 2 + 46;
    const quote = el.querySelector('.line-clamp-4')?.textContent || '';
    if (quote) {
      ctx.font = '11.5px Geist, Inter, sans-serif';
      ctx.globalAlpha = 0.7;
      wrap(ctx, quote, w - 34).slice(0, 4).forEach((l) => {
        ctx.fillText(l, -w / 2 + 22, ty);
        ty += 16;
      });
      ctx.globalAlpha = 1;
      ty += 10;
    }
    ctx.font = '500 21px Caveat, "Segoe Print", cursive';
    wrap(ctx, el.querySelector('textarea')?.value || '', w - 28).forEach((l) => {
      if (ty < h / 2 - 8) ctx.fillText(l, -w / 2 + 14, ty);
      ty += 25;
    });
    ctx.restore();
  });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `tutorboard-canvas-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
