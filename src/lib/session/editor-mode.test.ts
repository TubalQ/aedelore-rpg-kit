import { describe, expect, it } from "vitest";
import { SessionDataSchema } from "@/lib/schemas/session";
import { initialEditorMode } from "./editor-mode";

const session = (statuses: Array<"planned" | "started" | "completed">) =>
  SessionDataSchema.parse({ encounters: statuses.map((status, i) => ({ name: `E${i}`, status })) });

describe("initialEditorMode (#89)", () => {
  it("opens in Play while an encounter is in progress", () => {
    expect(initialEditorMode(session(["completed", "started", "planned"]), false)).toBe("play");
  });

  it("opens in Planning when nothing is in progress", () => {
    expect(initialEditorMode(session(["planned", "completed"]), false)).toBe("prep");
    expect(initialEditorMode(session([]), false)).toBe("prep");
  });

  it("opens a locked session in Planning", () => {
    expect(initialEditorMode(session(["started"]), true)).toBe("prep");
  });
});
