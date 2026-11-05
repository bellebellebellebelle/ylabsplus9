import { describe, expect, it } from "vitest";
import { resolveBreadcrumb, type Project } from "./projects";

const p = (id: string, parent: string | null): Project => ({
  id, parent_board_id: parent, user_id: "u", title: id, board_type: "postit", ref_id: null, created_at: "",
});

describe("resolveBreadcrumb", () => {
  it("remonte les parents jusqu'à la racine", () => {
    const all = [p("a", null), p("b", "a"), p("c", "b"), p("x", null)];
    expect(resolveBreadcrumb(all, "c").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
