export type SheetResult = {
  title: string;
  summary: string;
  formula: string;
  naturalFormula: string;
  columns: { label: string; align: "left" | "right"; kind: "text" | "number" | "percent" }[];
  rows: string[][];
  steps: { title: string; detail: string }[];
  insights: { icon: "crown" | "growth" | "tag" | "alert" | "info"; text: string }[];
  suggestions: string[];
  donut: { title: string; totalLabel: string; items: { label: string; value: number }[] } | null;
  line: { title: string; xLabels: string[]; series: { name: string; values: number[] }[] } | null;
  charts?: ChartSpec[];
};

export const CHART_TYPES = ["bar", "hbar", "stacked", "line", "area", "pie", "donut", "scatter", "radar"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const CHART_LABELS: Record<ChartType, string> = {
  bar: "Barres", hbar: "Barres horiz.", stacked: "Empilé", line: "Courbe", area: "Aire",
  pie: "Camembert", donut: "Anneau", scatter: "Nuage", radar: "Radar",
};
export type ChartSpec = { type: ChartType; title: string; labels: string[]; series: { name: string; values: number[] }[] };

export type HistoryEntry = { prompt: string; result: SheetResult; at: string };

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--azure)",
];
