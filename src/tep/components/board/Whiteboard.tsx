import {
  elementBounds,
  hitTest,
  moveElement,
  newId,
  type BoardEl,
  type Camera,
} from "@/tep/lib/board-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Tool = "select" | "pen" | "eraser" | "text" | "rect" | "ellipse" | "arrow" | "hand";

type Props = {
  elements: BoardEl[];
  onChange: (updater: (prev: BoardEl[]) => BoardEl[]) => void;
  tool: Tool;
  color: string;
  strokeWidth: number;
  camera: Camera;
  onCamera: (c: Camera) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
};

export function Whiteboard({
  elements,
  onChange,
  tool,
  color,
  strokeWidth,
  camera,
  onCamera,
  canvasRef,
}: Props) {
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const ref = canvasRef ?? localRef;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<BoardEl | null>(null);
  const [editing, setEditing] = useState<{ x: number; y: number; value: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const pointer = useRef<{ mode: string; sx: number; sy: number; cam: Camera; id?: string } | null>(
    null,
  );
  const images = useRef(new Map<string, HTMLImageElement>());
  const [, force] = useState(0);

  const toWorld = useCallback(
    (cx: number, cy: number) => {
      const rect = ref.current!.getBoundingClientRect();
      return {
        x: (cx - rect.left - camera.x) / camera.scale,
        y: (cy - rect.top - camera.y) / camera.scale,
      };
    },
    [camera, ref],
  );

  // Cache des images (traits reconstitués)
  useEffect(() => {
    for (const el of elements) {
      if (el.type === "image" && !images.current.has(el.id)) {
        const img = new Image();
        img.onload = () => force((n) => n + 1);
        img.src = el.src;
        images.current.set(el.id, img);
      }
    }
  }, [elements]);

  const all = useMemo(() => (draft ? [...elements, draft] : elements), [elements, draft]);

  // Rendu
  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // grille
    const step = 28 * camera.scale;
    if (step > 8) {
      ctx.strokeStyle = "rgba(0,0,0,0.055)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = camera.x % step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = camera.y % step; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const el of all) {
      ctx.strokeStyle = "color" in el ? el.color : "#000";
      ctx.fillStyle = "color" in el ? el.color : "#000";
      if (el.type === "stroke") {
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.moveTo(el.points[0] ?? 0, el.points[1] ?? 0);
        for (let i = 2; i < el.points.length; i += 2) ctx.lineTo(el.points[i]!, el.points[i + 1]!);
        ctx.stroke();
      } else if (el.type === "rect") {
        ctx.lineWidth = el.width;
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === "ellipse") {
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.ellipse(
          el.x + el.w / 2,
          el.y + el.h / 2,
          Math.abs(el.w / 2),
          Math.abs(el.h / 2),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else if (el.type === "arrow") {
        ctx.lineWidth = el.width;
        const x2 = el.x + el.w;
        const y2 = el.y + el.h;
        const a = Math.atan2(el.h, el.w);
        const head = 8 + el.width * 2;
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
        ctx.stroke();
      } else if (el.type === "text") {
        ctx.font = `${el.size}px "Segoe Print", "Bradley Hand", ui-rounded, system-ui, sans-serif`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(el.text, el.x, el.y);
      } else {
        const img = images.current.get(el.id);
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, el.x, el.y, el.w, el.h);
      }

      if (el.id === selected) {
        const b = elementBounds(el);
        ctx.save();
        ctx.strokeStyle = "rgba(14,116,144,0.9)";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5 / camera.scale;
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
        ctx.restore();
      }
    }
    ctx.restore();
  }, [all, camera, selected, ref]);

  // Redimensionnement
  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Suppression clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !editing) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        onChange((prev) => prev.filter((el) => el.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editing, onChange]);

  const eraseAt = (x: number, y: number) => {
    onChange((prev) => prev.filter((el) => !hitTest(el, x, y, 10 + strokeWidth)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    if (tool === "hand" || e.button === 1 || e.shiftKey) {
      pointer.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cam: camera };
      return;
    }
    if (tool === "pen") {
      setDraft({ id: newId(), type: "stroke", points: [p.x, p.y], color, width: strokeWidth });
      pointer.current = { mode: "draw", sx: p.x, sy: p.y, cam: camera };
    } else if (tool === "eraser") {
      pointer.current = { mode: "erase", sx: p.x, sy: p.y, cam: camera };
      eraseAt(p.x, p.y);
    } else if (tool === "rect" || tool === "ellipse" || tool === "arrow") {
      setDraft({ id: newId(), type: tool, x: p.x, y: p.y, w: 0, h: 0, color, width: strokeWidth });
      pointer.current = { mode: "shape", sx: p.x, sy: p.y, cam: camera };
    } else if (tool === "text") {
      setEditing({ x: p.x, y: p.y, value: "" });
    } else {
      const hit = [...elements].reverse().find((el) => hitTest(el, p.x, p.y));
      setSelected(hit?.id ?? null);
      pointer.current = hit
        ? { mode: "move", sx: p.x, sy: p.y, cam: camera, id: hit.id }
        : { mode: "pan", sx: e.clientX, sy: e.clientY, cam: camera };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = pointer.current;
    if (!st) return;
    if (st.mode === "pan") {
      onCamera({ ...st.cam, x: st.cam.x + (e.clientX - st.sx), y: st.cam.y + (e.clientY - st.sy) });
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (st.mode === "draw") {
      setDraft((d) => (d && d.type === "stroke" ? { ...d, points: [...d.points, p.x, p.y] } : d));
    } else if (st.mode === "erase") {
      eraseAt(p.x, p.y);
    } else if (st.mode === "shape") {
      setDraft((d) => (d && d.type !== "stroke" && d.type !== "text" ? { ...d, w: p.x - st.sx, h: p.y - st.sy } : d));
    } else if (st.mode === "move" && st.id) {
      const dx = p.x - st.sx;
      const dy = p.y - st.sy;
      st.sx = p.x;
      st.sy = p.y;
      onChange((prev) => prev.map((el) => (el.id === st.id ? moveElement(el, dx, dy) : el)));
    }
  };

  const onPointerUp = () => {
    const st = pointer.current;
    pointer.current = null;
    if (!st) return;
    if (draft) {
      const d = draft;
      setDraft(null);
      if (d.type === "stroke" ? d.points.length >= 4 : Math.abs(d.type === "text" ? 1 : d.w) + Math.abs(d.type === "text" ? 1 : d.h) > 6) {
        onChange((prev) => [...prev, d]);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0012);
    const scale = Math.min(4, Math.max(0.15, camera.scale * factor));
    const k = scale / camera.scale;
    onCamera({ x: mx - (mx - camera.x) * k, y: my - (my - camera.y) * k, scale });
  };

  const commitText = () => {
    if (editing && editing.value.trim()) {
      const t = editing;
      onChange((prev) => [
        ...prev,
        { id: newId(), type: "text", x: t.x, y: t.y, text: t.value.trim(), color, size: 16 + strokeWidth * 3 },
      ]);
    }
    setEditing(null);
  };

  const cursor =
    tool === "hand" ? "grab" : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-canvas touch-none">
      <canvas
        ref={ref}
        className="block h-full w-full"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      {editing && (
        <input
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") setEditing(null);
          }}
          placeholder="Votre texte…"
          className="absolute rounded-md border border-ring bg-card px-2 py-1 text-sm text-foreground shadow-soft outline-none"
          style={{
            left: editing.x * camera.scale + camera.x,
            top: editing.y * camera.scale + camera.y - 18,
          }}
        />
      )}
    </div>
  );
}
