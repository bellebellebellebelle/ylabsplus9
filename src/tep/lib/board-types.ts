export type StrokeEl = {
  id: string;
  type: "stroke";
  points: number[]; // [x0,y0,x1,y1,...]
  color: string;
  width: number;
};

export type ShapeEl = {
  id: string;
  type: "rect" | "ellipse" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
};

export type TextEl = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
};

export type ImageEl = {
  id: string;
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};

export type BoardEl = StrokeEl | ShapeEl | TextEl | ImageEl;

export type Camera = { x: number; y: number; scale: number };

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function elementBounds(el: BoardEl) {
  if (el.type === "stroke") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      const x = el.points[i]!;
      const y = el.points[i + 1]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const p = el.width;
    return { x: minX - p, y: minY - p, w: maxX - minX + p * 2, h: maxY - minY + p * 2 };
  }
  if (el.type === "text") {
    return {
      x: el.x - 4,
      y: el.y - el.size,
      w: Math.max(20, el.text.length * el.size * 0.55) + 8,
      h: el.size * 1.4,
    };
  }
  const x = Math.min(el.x, el.x + el.w);
  const y = Math.min(el.y, el.y + el.h);
  return { x, y, w: Math.abs(el.w), h: Math.abs(el.h) };
}

export function hitTest(el: BoardEl, x: number, y: number, tol = 8) {
  if (el.type === "stroke") {
    for (let i = 0; i < el.points.length; i += 2) {
      const dx = el.points[i]! - x;
      const dy = el.points[i + 1]! - y;
      if (dx * dx + dy * dy <= (tol + el.width) ** 2) return true;
    }
    return false;
  }
  const b = elementBounds(el);
  return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
}

export function moveElement(el: BoardEl, dx: number, dy: number): BoardEl {
  if (el.type === "stroke") {
    const points = el.points.slice();
    for (let i = 0; i < points.length; i += 2) {
      points[i] = points[i]! + dx;
      points[i + 1] = points[i + 1]! + dy;
    }
    return { ...el, points };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}
