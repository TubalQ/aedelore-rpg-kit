import { describe, expect, it } from "vitest";
import { SessionDataSchema, newItem, newSessionEquipment } from "@/lib/schemas/session";
import { adoptStashIds } from "./stash-sync";

const data = (items: ReturnType<typeof newItem>[], equipment: ReturnType<typeof newSessionEquipment>[] = []) =>
  SessionDataSchema.parse({ items, equipment });

describe("adoptStashIds", () => {
  it("takes the id the server linked a new item to, also while its name was typed on", () => {
    const local = data([newItem({ name: "Flodkarta" })]);
    const out = adoptStashIds(local, data([newItem({ name: "Flod", stashId: 7 })]));
    expect(out.items[0].stashId).toBe(7);
  });

  it("leaves a different item at that index alone, and returns the same object when nothing changes", () => {
    const local = data([newItem({ name: "Nyckel" })]);
    expect(adoptStashIds(local, data([newItem({ name: "Flodkarta", stashId: 7 })]))).toBe(local);
  });

  it("does not take an id another local card already carries (S2)", () => {
    // "Svärd" (stash 3) is placed; a new card typed as "Svärdet av Kael" sits
    // where the saved list has "Svärd" after a change made elsewhere.
    const local = data([newItem({ name: "Svärdet av Kael" }), newItem({ name: "Svärd", stashId: 3 })]);
    const saved = data([newItem({ name: "Svärd", stashId: 3 }), newItem({ name: "Svärdet av Kael", stashId: 9 })]);
    expect(adoptStashIds(local, saved)).toBe(local);
  });

  it("gives one new id to one card only", () => {
    const local = data([newItem({ name: "Rep" }), newItem({ name: "Rep" })]);
    const saved = data([newItem({ name: "Rep", stashId: 5 }), newItem({ name: "Rep", stashId: 5 })]);
    expect(adoptStashIds(local, saved).items.map((i) => i.stashId)).toEqual([5, null]);
  });
});
