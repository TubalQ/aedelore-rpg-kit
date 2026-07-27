import { describe, it, expect } from "vitest";
import { CharacterDataSchema } from "./character";

// Regressionsvakt för "ett trasigt fält blankade HELA bladet"-buggen (issue #28 / 528a512).
// Kravet: CharacterDataSchema får ALDRIG hård-faila på ett enskilt oväntat fält - då
// faller character-sheet tillbaka till tomma defaults och allt "försvinner" i UI:t.
describe("CharacterDataSchema - robusthet mot trasig/migrerad data", () => {
  it("parsar alltid till ett användbart objekt även med förgiftade fält", () => {
    const poisoned = {
      race: "NotARealRace",        // config-driven: race = z.string(), okänd/editor-tillagd ras ska BEVARAS (R2-skydd)
      class: "Mage",               // giltig - ska bevaras
      religion: null,
      hp: null,                    // null där tal väntas (kraschade förr)
      maxHp: "24",                 // sträng-tal → ska coerce:as
      worthiness: "bad",           // ej tal
      avatarImage: null,           // null där sträng väntas (.default fångar ej null)
      attributes: { Strength: 3, Intelligence: 2 },
      skills: { Insight: 3 },
      spells: [{ name: "Fireball", selected: null }], // trasigt element-fält
      equippedWeapons: [
        { name: "Staff", damage: "1d6", bonus: "+2", range: "3", break: null }, // break:null = originalbuggen
      ],
      relationships: "notanarray", // ej array
      dmEquipment: [{ name: "Ring", type: "misc", bonuses: [{ stat: "Luck", value: "1" }] }],
    };

    const res = CharacterDataSchema.safeParse(poisoned);
    expect(res.success).toBe(true);
    const d = res.data!;

    // Giltiga fält bevaras
    expect(d.class).toBe("Mage");
    expect(d.attributes.Strength).toBe(3);
    expect(d.attributes.Intelligence).toBe(2);
    expect(d.skills.Insight).toBe(3);

    // Trasiga fält självläker till default/coerce i stället för att fälla parsningen
    expect(d.race).toBe("NotARealRace");       // R2-fix: race = z.string() → okänd/editor-tillagd ras bevaras (blankar aldrig bladet)
    expect(d.hp).toBe(0);                       // null → 0
    expect(d.maxHp).toBe(24);                   // "24" → 24
    expect(d.worthiness).toBe(0);               // ej tal → 0
    expect(d.avatarImage).toBe("");             // null → ""
    expect(d.spells[0].selected).toBe(false);   // null → false, elementet överlever
    expect(d.equippedWeapons[0].break).toBe(0); // null → 0 (originalbuggen)
    expect(d.relationships).toEqual([]);        // ej array → []
    expect(d.dmEquipment[0].bonuses?.[0].value).toBe(1); // "1" → 1
  });

  it("lämnar en fullt giltig karaktär oförändrad i sina värden", () => {
    const valid = {
      race: null,
      class: "Mage",
      hp: 24,
      maxHp: 30,
      attributes: { Strength: 3 },
      equippedWeapons: [{ name: "Staff", damage: "1d6", bonus: "+2", range: "3", break: 2 }],
    };
    const res = CharacterDataSchema.safeParse(valid);
    expect(res.success).toBe(true);
    expect(res.data!.hp).toBe(24);
    expect(res.data!.maxHp).toBe(30);
    expect(res.data!.equippedWeapons[0].break).toBe(2);
  });

  it("tomt objekt ger fulla defaults (aldrig undefined-fält)", () => {
    const res = CharacterDataSchema.safeParse({});
    expect(res.success).toBe(true);
    expect(res.data!.hp).toBe(0);
    expect(res.data!.spells).toEqual([]);
    expect(res.data!.equippedWeapons).toEqual([]);
    expect(res.data!.race).toBe(null);
  });
});
