import { describe, it, expect } from "vitest";
import { CampaignBoxActionSchema } from "./campaign";

describe("CampaignBoxActionSchema", () => {
  it("godkänner add quest", () => {
    const r = CampaignBoxActionSchema.safeParse({
      action: "add",
      item: { kind: "quest", quest: { name: "Brev", description: "..." } },
    });
    expect(r.success).toBe(true);
  });

  it("godkänner add equipment", () => {
    const r = CampaignBoxActionSchema.safeParse({
      action: "add",
      item: { kind: "equipment", equipment: { name: "Svärd", type: "weapon", damage: "1d8" } },
    });
    expect(r.success).toBe(true);
  });

  it("godkänner remove + handout", () => {
    expect(CampaignBoxActionSchema.safeParse({ action: "remove", id: 3 }).success).toBe(true);
    expect(CampaignBoxActionSchema.safeParse({ action: "handout", id: 3, characterId: 7 }).success).toBe(true);
  });

  it("avvisar trasig input (fel kind, saknad payload, negativa id)", () => {
    expect(CampaignBoxActionSchema.safeParse({ action: "add", item: { kind: "quest" } }).success).toBe(false);
    expect(CampaignBoxActionSchema.safeParse({ action: "handout", id: -1, characterId: 7 }).success).toBe(false);
    expect(CampaignBoxActionSchema.safeParse({ action: "bogus" }).success).toBe(false);
  });
});
