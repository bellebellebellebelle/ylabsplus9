import { describe, it, expect } from "vitest";
import { findConflicts, nextFreeSlot, type Appt } from "./scheduling";

const a = (id: string, s: string, e: string, extra: Partial<Appt> = {}): Appt => ({
  id, title: id, start_at: s, end_at: e, status: "prevu", buffer_min: 0, category: "travail", ...extra,
});
const list = [a("A", "2026-10-27T10:00:00", "2026-10-27T11:00:00")];

describe("scheduling", () => {
  it("détecte un chevauchement", () => {
    expect(findConflicts(list, new Date("2026-10-27T10:30:00"), new Date("2026-10-27T11:30:00"))).toHaveLength(1);
  });
  it("accepte un créneau adjacent", () => {
    expect(findConflicts(list, new Date("2026-10-27T11:00:00"), new Date("2026-10-27T12:00:00"))).toHaveLength(0);
  });
  it("respecte le temps tampon", () => {
    const l = [a("B", "2026-10-27T10:00:00", "2026-10-27T11:00:00", { buffer_min: 15 })];
    expect(findConflicts(l, new Date("2026-10-27T11:10:00"), new Date("2026-10-27T12:00:00"))).toHaveLength(1);
  });
  it("ignore les rendez-vous annulés", () => {
    const l = [a("C", "2026-10-27T10:00:00", "2026-10-27T11:00:00", { status: "annule" })];
    expect(findConflicts(l, new Date("2026-10-27T10:00:00"), new Date("2026-10-27T11:00:00"))).toHaveLength(0);
  });
  it("propose le prochain créneau libre", () => {
    expect(nextFreeSlot(list, new Date("2026-10-27T10:00:00"), 60)?.getHours()).toBe(11);
  });
});
