import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api/client.js";
import { safeTool } from "../safe-tool.js";
import { text, textError, withCharacter } from "../helpers.js";
import type { Relationship } from "../../types.js";

// Mirrors the app's CharacterDataSchema bounds (ints, non-negative except worthiness),
// so a value the app would read back as 0 is rejected here instead of silently wiped.
const count = z.number().int().min(0);
const MAX_BACKGROUND = 10_000;

export function registerCharacterGameplayTools(server: McpServer, client: ApiClient, token: string): void {
  safeTool(
    server,
    "update_hp",
    "Set HP, arcana, willpower, worthiness, bleed or weakened for a character. Log what caused the change in the session log.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      hp: count.max(999).optional().describe("Current HP"),
      arcana: count.max(99).optional().describe("Current arcana"),
      willpower: count.max(3).optional().describe("Willpower (0-3)"),
      worthiness: z.number().int().min(-10).max(10).optional().describe("Worthiness (-10 to 10)"),
      bleed: count.max(6).optional().describe("Bleed level (0-6)"),
      weakened: count.max(6).optional().describe("Weakened level (0-6)"),
    },
    async ({ character_id, ...values }) => {
      const changes = Object.entries(values).filter(([, v]) => v !== undefined) as Array<[string, number]>;
      if (changes.length === 0) return textError("No changes specified.");
      return withCharacter(client, token, character_id, (data) => {
        for (const [key, value] of changes) data[key] = value;
        const maxHp = data.maxHp as number | undefined;
        const warn = values.hp !== undefined && maxHp && values.hp > maxHp ? ` (above max HP ${maxHp})` : "";
        return text(
          `Updated: ${changes.map(([k, v]) => `${k} ${v}`).join(", ")}${warn}.\nLog what caused it in the session log. If unsure about defense or healing rules, call get_rules.`,
        );
      });
    },
    { role: "player" },
  );

  safeTool(
    server,
    "update_inventory",
    "Set gold and/or food for a character (whole, non-negative numbers)",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      gold: count.optional().describe("Gold amount"),
      food: count.optional().describe("Food amount"),
    },
    async ({ character_id, gold, food }) => {
      if (gold === undefined && food === undefined) return textError("No changes specified.");
      return withCharacter(client, token, character_id, (data) => {
        const changes: string[] = [];
        if (gold !== undefined) {
          data.gold = gold;
          changes.push(`Gold ${gold}`);
        }
        if (food !== undefined) {
          data.food = food;
          changes.push(`Food ${food}`);
        }
        return text(`Updated: ${changes.join(", ")}`);
      });
    },
    { role: "player" },
  );

  safeTool(
    server,
    "add_notes",
    "Append a note to the character's background/notes (shown on the character sheet, Lore tab).",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      text: z.string().min(1).max(2000).describe("Text to append"),
    },
    async ({ character_id, text: note }) =>
      withCharacter(client, token, character_id, (data) => {
        const current = typeof data.background === "string" ? data.background.trim() : "";
        const next = current ? `${current}\n\n${note.trim()}` : note.trim();
        if (next.length > MAX_BACKGROUND) {
          return textError(
            `ERROR: Background/notes would be ${next.length} characters (max ${MAX_BACKGROUND}). Summarise older notes first. Nothing was saved.`,
          );
        }
        data.background = next;
        return text("Note added to the character's background/notes.");
      }),
    { role: "player" },
  );

  safeTool(
    server,
    "update_relationships",
    "Set the character's active NPC relationships. Replaces the active list; archived relationships are kept.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      relationships: z
        .array(
          z.object({
            name: z.string().min(1).describe("NPC name"),
            relation: z.string().optional().describe("Relation type (e.g. Ally, Rival, Mentor, Enemy)"),
            notes: z.string().optional().describe("Notes about this relationship"),
          }),
        )
        .describe("Active relationships"),
    },
    async ({ character_id, relationships }) =>
      withCharacter(client, token, character_id, (data) => {
        const existing = (data.relationships ?? []) as Relationship[];
        const names = new Set(relationships.map((r) => r.name.trim()));
        const archived = existing.filter((r) => r.archived && !names.has(r.name));
        data.relationships = [
          ...relationships.map((r) => ({
            name: r.name.trim(),
            relation: r.relation ?? "",
            notes: r.notes ?? "",
            archived: false,
          })),
          ...archived,
        ];
        return text(
          `Relationships updated (${relationships.length} active${archived.length ? `, ${archived.length} archived kept` : ""}).`,
        );
      }),
    { role: "player" },
  );
}
