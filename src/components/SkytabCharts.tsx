import { useState } from "react";
import { CHART_TYPES, CHART_LABELS, type ChartSpec, type ChartType } from "@/lib/skytab-sheet-types";
import { CHART_COLORS, type SheetResult } from "@/lib/skytab-sheet-types";

const fmt = (n: number) =>
  Math.abs(n) >= 1e6
    ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M"
    : Math.abs(n) >= 1e3
      ? (n / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k"
      : n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function Donut({ data }: { data: NonNullable<SheetResult["donut"]> }) {
  const total = data.items.reduce((s, i) => s + (Number(i.value) || 0), 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--muted)" strokeWidth="22" />
        {data.items.map((it, i) => {
          const len = ((Number(it.value) || 0) / total) * c;
          const el = (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              className="transition-all duration-700"
            />
          );
          acc += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="70" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">
            {data.totalLabel}
          </text>
          <text x="70" y="86" textAnchor="middle" className="fill-muted-foreground text-[9px]">
            Total
          </text>
        </g>
      </svg>
      <ul className="w-full min-w-0 space-y-3 text-xs">
        {data.items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {(((Number(it.value) || 0) / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ data }: { data: NonNullable<SheetResult["line"]> }) {
  const W = 300, H = 150, P = 34;
  const all = data.series.flatMap((s) => s.values.map(Number)).filter((v) => !isNaN(v));
  const max = Math.max(...all, 1), min = Math.min(...all, 0);
  const span = max - min || 1;
  const n = Math.max(data.xLabels.length, 2);
  const x = (i: number) => P + (i * (W - P - 6)) / (n - 1);
  const y = (v: number) => H - 18 - ((v - min) / span) * (H - 30);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * span);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-0">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="0.5" />
            <text x={P - 4} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[7px]">{fmt(t)}</text>
          </g>
        ))}
        {data.xLabels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[7px]">{l}</text>
        ))}
        {data.series.map((s, si) => (
          <polyline
            key={si}
            fill="none"
            stroke={CHART_COLORS[si % CHART_COLORS.length]}
            strokeWidth="2"
            strokeLinejoin="round"
            className="animate-draw"
            points={s.values.map((v, i) => `${x(i)},${y(Number(v) || 0)}`).join(" ")}
          />
        ))}
      </svg>
      <ul className="shrink-0 space-y-3 text-xs sm:w-36">
        {data.series.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const col = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

export function UniversalChart({ spec }: { spec: ChartSpec }) {
  const [type, setType] = useState<ChartType>(CHART_TYPES.includes(spec.type) ? spec.type : "bar");
  const s = { ...spec, type };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{spec.title}</h3>
        <select
          aria-label="Type de graphique"
          value={type}
          onChange={(e) => setType(e.target.value as ChartType)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {CHART_TYPES.map((t) => <option key={t} value={t}>{CHART_LABELS[t]}</option>)}
        </select>
      </div>
      <ChartBody spec={s} />
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(type === "pie" || type === "donut" ? spec.labels : spec.series.map((x) => x.name)).map((n, i) => (
          <span key={i} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: col(i) }} />{n}</span>
        ))}
      </div>
    </div>
  );
}

function ChartBody({ spec }: { spec: ChartSpec }) {
  const W = 320, H = 180, P = 34;
  const series = spec.series.map((x) => ({ ...x, values: x.values.map((v) => Number(v) || 0) }));
  const labels = spec.labels.length ? spec.labels : (series[0]?.values.map((_, i) => String(i + 1)) ?? []);
  const n = Math.max(labels.length, 1);

  if (spec.type === "pie" || spec.type === "donut") {
    const vals = series[0]?.values ?? [];
    const tot = vals.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
    let a0 = -Math.PI / 2;
    const R = 70, r = spec.type === "donut" ? 40 : 0, cx = W / 2, cy = H / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full">
        {vals.map((v, i) => {
          const a1 = a0 + (Math.max(v, 0) / tot) * Math.PI * 2;
          const big = a1 - a0 > Math.PI ? 1 : 0;
          const p = (rad: number, ang: number) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
          const d = r
            ? `M${p(R, a0)}A${R} ${R} 0 ${big} 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 ${big} 0 ${p(r, a0)}Z`
            : `M${cx} ${cy}L${p(R, a0)}A${R} ${R} 0 ${big} 1 ${p(R, a1)}Z`;
          a0 = a1;
          return <path key={i} d={vals.length === 1 ? "" : d} fill={col(i)} stroke="var(--background)" strokeWidth="1"><title>{`${labels[i]}: ${fmt(v)}`}</title></path>;
        })}
        {vals.length === 1 && <circle cx={cx} cy={cy} r={R} fill={col(0)} />}
        {r > 0 && <text x={cx} y={cy + 4} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">{fmt(tot)}</text>}
      </svg>
    );
  }

  if (spec.type === "radar") {
    const cx = W / 2, cy = H / 2, R = 70;
    const max = Math.max(...series.flatMap((x) => x.values), 1);
    const pt = (i: number, v: number) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `${cx + (v / max) * R * Math.cos(a)},${cy + (v / max) * R * Math.sin(a)}`;
    };
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full">
        {[0.33, 0.66, 1].map((k) => <polygon key={k} points={labels.map((_, i) => pt(i, max * k)).join(" ")} fill="none" stroke="var(--border)" />)}
        {labels.map((l, i) => {
          const [x, y] = pt(i, max * 1.18).split(",").map(Number);
          return <text key={i} x={x} y={y} textAnchor="middle" className="fill-muted-foreground text-[8px]">{l.slice(0, 12)}</text>;
        })}
        {series.map((sr, si) => <polygon key={si} points={sr.values.map((v, i) => pt(i, v)).join(" ")} fill={col(si)} fillOpacity="0.2" stroke={col(si)} strokeWidth="1.5" />)}
      </svg>
    );
  }

  const stacked = spec.type === "stacked";
  const hbar = spec.type === "hbar";
  const totals = labels.map((_, i) => series.reduce((a, x) => a + Math.max(x.values[i] ?? 0, 0), 0));
  const all = stacked ? totals : series.flatMap((x) => x.values);
  const xs = spec.type === "scatter" ? labels.map((l) => Number(String(l).replace(/\s/g, "").replace(",", ".")) || 0) : [];
  const max = Math.max(...all, 1), min = stacked ? 0 : Math.min(...all, 0), span = max - min || 1;
  const y = (v: number) => H - P / 1.5 - ((v - min) / span) * (H - P);
  const innerW = W - P - 6;

  if (hbar) {
    const bh = (H - 10) / n / Math.max(series.length, 1);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full">
        {labels.map((l, i) => (
          <g key={i}>
            <text x={P + 26} y={5 + i * (H - 10) / n + ((H - 10) / n) / 2 + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{l.slice(0, 12)}</text>
            {series.map((sr, si) => (
              <rect key={si} x={P + 30} y={5 + i * (H - 10) / n + si * bh} height={bh * 0.85} width={Math.max(0, ((sr.values[i] ?? 0) / max) * (W - P - 40))} fill={col(si)} rx="2"><title>{fmt(sr.values[i] ?? 0)}</title></rect>
            ))}
          </g>
        ))}
      </svg>
    );
  }

  const xAt = (i: number) => spec.type === "scatter"
    ? P + (((xs[i] ?? 0) - Math.min(...xs)) / ((Math.max(...xs) - Math.min(...xs)) || 1)) * innerW
    : P + (i + 0.5) * (innerW / n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full">
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={P} x2={W - 6} y1={y(min + span * k)} y2={y(min + span * k)} stroke="var(--border)" strokeDasharray="3 3" />
          <text x={P - 4} y={y(min + span * k) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{fmt(min + span * k)}</text>
        </g>
      ))}
      {n <= 16 && labels.map((l, i) => <text key={i} x={xAt(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[8px]">{String(l).slice(0, 8)}</text>)}
      {(spec.type === "bar" || stacked) && labels.map((_, i) => {
        const gw = (innerW / n) * 0.75;
        let acc = 0;
        return series.map((sr, si) => {
          const v = Math.max(sr.values[i] ?? 0, stacked ? 0 : -Infinity);
          if (stacked) {
            const el = <rect key={`${i}-${si}`} x={xAt(i) - gw / 2} width={gw} y={y(acc + v)} height={Math.max(0, y(acc) - y(acc + v))} fill={col(si)}><title>{fmt(v)}</title></rect>;
            acc += v;
            return el;
          }
          const bw = gw / series.length;
          return <rect key={`${i}-${si}`} x={xAt(i) - gw / 2 + si * bw} width={bw * 0.9} y={Math.min(y(v), y(0))} height={Math.abs(y(0) - y(v))} fill={col(si)} rx="1.5"><title>{fmt(v)}</title></rect>;
        });
      })}
      {(spec.type === "line" || spec.type === "area") && series.map((sr, si) => {
        const pts = sr.values.map((v, i) => `${xAt(i)},${y(v)}`).join(" ");
        return (
          <g key={si}>
            {spec.type === "area" && <polygon points={`${xAt(0)},${y(Math.max(min, 0))} ${pts} ${xAt(sr.values.length - 1)},${y(Math.max(min, 0))}`} fill={col(si)} fillOpacity="0.2" />}
            <polyline points={pts} fill="none" stroke={col(si)} strokeWidth="2" />
          </g>
        );
      })}
      {spec.type === "scatter" && series.map((sr, si) => sr.values.map((v, i) => <circle key={`${si}-${i}`} cx={xAt(i)} cy={y(v)} r="3.5" fill={col(si)} fillOpacity="0.8"><title>{`${labels[i]} ; ${fmt(v)}`}</title></circle>))}
    </svg>
  );
}
