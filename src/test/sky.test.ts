import { describe, it, expect } from "vitest";
import { tasksToRemind, streak, type Task } from "@/lib/sky";

const base = { id: "1", user_id: "u", list_id: null, title: "t", description: null, status: "todo", priority: "medium", due_at: null, completed_at: null, created_at: "" } as Task;
const now = Date.UTC(2026, 9, 26, 12, 0);

describe("reminders", () => {
  it("reminds a task due in 20 minutes", () => {
    expect(tasksToRemind([{ ...base, due_at: new Date(now + 20 * 60000).toISOString() }], now)).toHaveLength(1);
  });
  it("does not remind a task due in 40 minutes", () => {
    expect(tasksToRemind([{ ...base, due_at: new Date(now + 40 * 60000).toISOString() }], now)).toHaveLength(0);
  });
  it("does not remind a finished task", () => {
    expect(tasksToRemind([{ ...base, status: "done", due_at: new Date(now + 10 * 60000).toISOString() }], now)).toHaveLength(0);
  });
});

describe("streak", () => {
  it("counts consecutive days", () => {
    const d = (i: number) => ({ ...base, status: "done", completed_at: new Date(now - i * 86400000).toISOString() });
    expect(streak([d(0), d(1), d(2), d(4)], now)).toBe(3);
  });
});
