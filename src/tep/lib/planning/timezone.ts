/** Fuseau horaire de l'application (sans heure d'été). */
export const APP_TZ = "Indian/Reunion";
export const APP_TZ_OFFSET = "+04:00";

const pad = (n: number) => String(n).padStart(2, "0");

/** Parties date/heure du "maintenant" (ou d'une date) dans le fuseau de l'app. */
export function tzParts(d: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) if (part.type !== "literal") p[part.type] = part.value;
  const hour = p["hour"] === "24" ? "00" : (p["hour"] ?? "00");
  return {
    year: Number(p["year"]),
    month: Number(p["month"]),
    day: Number(p["day"]),
    hour: Number(hour),
    minute: Number(p["minute"]),
    dateKey: `${p["year"]}-${p["month"]}-${p["day"]}`,
    time: `${hour}:${p["minute"]}`,
  };
}

/** Clé "YYYY-MM-DD" du jour courant à La Réunion. */
export function tzTodayKey(): string {
  return tzParts().dateKey;
}

/** Heure "HH:MM" courante à La Réunion. */
export function tzNowTime(): string {
  return tzParts().time;
}

/** Date locale (getFullYear/getDate…) alignée sur le calendrier de La Réunion. */
export function tzToday(): Date {
  const p = tzParts();
  return new Date(p.year, p.month - 1, p.day);
}

/** Convertit un instant ISO en heure murale "HH:MM" du fuseau de l'app. */
export function isoToTzTime(iso?: string | null): string | null {
  if (!iso) return null;
  const p = tzParts(new Date(iso));
  return p.time;
}

/** Convertit un instant ISO en clé de jour du fuseau de l'app. */
export function isoToTzDay(iso?: string | null): string | null {
  if (!iso) return null;
  return tzParts(new Date(iso)).dateKey;
}

/** "YYYY-MM-DDTHH:MM:00+04:00" pour un jour + heure murale du fuseau. */
export function tzInstantISO(day: string, time: string): string {
  const [h = "00", m = "00"] = time.split(":");
  return `${day}T${pad(Number(h))}:${pad(Number(m))}:00${APP_TZ_OFFSET}`;
}
