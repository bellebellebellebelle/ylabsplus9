import { newId, type ImageEl } from "./board-types";

/**
 * Reconstitution fidèle au trait d'une photo de schéma dessiné à la main.
 * 1. mise à l'échelle + niveaux de gris
 * 2. seuillage adaptatif (moyenne locale) -> encre pure sur fond transparent
 * 3. découpage en composantes connexes -> éléments déplaçables / effaçables
 * Aucune bibliothèque externe.
 */

const MAX_SIDE = 1400;
const MIN_COMPONENT_PX = 12;
const MAX_COMPONENTS = 220;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

export type VectorizeResult = { elements: ImageEl[]; width: number; height: number };

export async function vectorizeSketch(
  file: File,
  origin: { x: number; y: number },
  inkColor: string,
): Promise<VectorizeResult> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, w, h);
  const data = sctx.getImageData(0, 0, w, h).data;

  // Niveaux de gris
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }

  // Image intégrale pour la moyenne locale
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x]!;
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)]! + rowSum;
    }
  }
  const radius = Math.max(6, Math.round(Math.min(w, h) / 40));
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)]! -
        integral[y0 * (w + 1) + (x1 + 1)]! -
        integral[(y1 + 1) * (w + 1) + x0]! +
        integral[y0 * (w + 1) + x0]!;
      const mean = sum / area;
      if (gray[y * w + x]! < mean - 10) ink[y * w + x] = 1;
    }
  }

  // Composantes connexes (8-voisins), BFS itératif
  const labels = new Int32Array(w * h).fill(-1);
  const comps: { minX: number; minY: number; maxX: number; maxY: number; count: number }[] = [];
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!ink[start] || labels[start] !== -1) continue;
    const label = comps.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      count = 0;
    while (head < tail) {
      const p = queue[head++]!;
      const px = p % w;
      const py = (p / w) | 0;
      count++;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (ink[np] && labels[np] === -1) {
            labels[np] = label;
            queue[tail++] = np;
          }
        }
      }
    }
    comps.push({ minX, minY, maxX, maxY, count });
  }

  // Les composantes les plus grandes d'abord, le reste fusionné en un calque
  const order = comps
    .map((c, i) => ({ c, i }))
    .filter((e) => e.c.count >= MIN_COMPONENT_PX)
    .sort((a, b) => b.c.count - a.c.count);
  const kept = new Set(order.slice(0, MAX_COMPONENTS).map((e) => e.i));

  const rgb = hexToRgb(inkColor);
  const elements: ImageEl[] = [];

  const makeElement = (indices: number[], box: { minX: number; minY: number; maxX: number; maxY: number }) => {
    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;
    const c = document.createElement("canvas");
    c.width = bw;
    c.height = bh;
    const ctx = c.getContext("2d")!;
    const out = ctx.createImageData(bw, bh);
    for (const p of indices) {
      const px = (p % w) - box.minX;
      const py = ((p / w) | 0) - box.minY;
      const o = (py * bw + px) * 4;
      out.data[o] = rgb[0];
      out.data[o + 1] = rgb[1];
      out.data[o + 2] = rgb[2];
      out.data[o + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    elements.push({
      id: newId(),
      type: "image",
      x: origin.x + box.minX,
      y: origin.y + box.minY,
      w: bw,
      h: bh,
      src: c.toDataURL("image/png"),
    });
  };

  const buckets = new Map<number, number[]>();
  const rest: number[] = [];
  const restBox = { minX: w, minY: h, maxX: 0, maxY: 0 };
  for (let p = 0; p < w * h; p++) {
    const l = labels[p]!;
    if (l === -1) continue;
    if (kept.has(l)) {
      const arr = buckets.get(l);
      if (arr) arr.push(p);
      else buckets.set(l, [p]);
    } else {
      rest.push(p);
      const px = p % w;
      const py = (p / w) | 0;
      if (px < restBox.minX) restBox.minX = px;
      if (py < restBox.minY) restBox.minY = py;
      if (px > restBox.maxX) restBox.maxX = px;
      if (py > restBox.maxY) restBox.maxY = py;
    }
  }
  for (const [label, indices] of buckets) makeElement(indices, comps[label]!);
  if (rest.length > 0 && restBox.maxX >= restBox.minX) makeElement(rest, restBox);

  return { elements, width: w, height: h };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [26, 26, 26];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
