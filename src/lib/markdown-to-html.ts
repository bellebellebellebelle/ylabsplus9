/** Lightweight Markdown → SkyDoc HTML converter (no dependencies). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** True when the content is plain text/Markdown rather than HTML. */
export function looksLikeMarkdown(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  if (/^<\w/.test(t) && !/^<p>\s*#/.test(t)) return false;
  return /(^|\n)\s*#{1,6}\s|\*\*.+?\*\*|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|(^|\n)\s*\|.*\|/.test(t) || !/<\w/.test(t);
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    let m: RegExpMatchArray | null;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { out.push("<hr>"); i++; continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const lvl = Math.min(m[1].length, 3);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); i++; continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!r.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) rows.push(r);
        i++;
      }
      if (rows.length) {
        const [h, ...b] = rows;
        out.push(`<table class="doc-table"><tr>${h.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>${b.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</table>`);
      }
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote class="doc-callout">${buf.map(inline).join("<br>")}</blockquote>`);
      continue;
    }
    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d/.test(line);
      const re = ordered ? /^\d+[.)]\s+/ : /^[-*•]\s+/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i].trim())) { items.push(inline(lines[i].trim().replace(re, ""))); i++; }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((x) => `<li>${x}</li>`).join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{1,6}\s|>|\||[-*•]\s|\d+[.)]\s|-{3,}$)/.test(l)) break;
      para.push(inline(l)); i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}

/** Returns SkyDoc-ready HTML whatever the input format. */
export function toDocHtml(content: string): string {
  return looksLikeMarkdown(content) ? markdownToHtml(content.replace(/^<p>|<\/p>$/g, "")) : content;
}
