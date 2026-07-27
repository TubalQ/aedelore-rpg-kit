import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as wikiApi from "../api/wiki.js";
import { getGameData } from "../game-data/loader.js";
import type { GameDataType } from "../game-data/types.js";
import { safeTool } from "./safe-tool.js";
import { text, asArray, asRecord } from "./helpers.js";

export function registerGameDataTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "get_game_data",
    "Get Aedelore game data: weapons, armor, shields, spells, races, classes, religions, attributes",
    {
      type: z
        .enum([
          "weapons",
          "armor",
          "shields",
          "spells",
          "races",
          "classes",
          "religions",
          "attributes",
        ])
        .describe("Type of game data to retrieve"),
    },
    async ({ type }) => {
      const gameData = getGameData();
      const dataType = type as GameDataType;
      const data = gameData[dataType];

      if (!data) return text(`Unknown game data type: ${dataType}`);

      // Format based on type for readability
      if (dataType === "weapons") {
        const weaponsData = gameData.weapons;
        let output = "# Weapons\n\n";
        for (const w of weaponsData.weapons) {
          output += `**${w.name}** -- Type: ${w.type || "?"} | Ability: ${w.ability || "?"} | ATK: ${w.bonus || "?"} | DMG: ${w.damage || "?"} | RNG: ${w.range || "?"} | BRK: ${w.break || "?"}\n`;
        }
        return text(output.trim());
      }

      if (dataType === "armor") {
        const armorData = gameData.armor;
        let output = "# Armor\n\n";
        for (const a of armorData.armor) {
          output += `**${a.name}** -- ${a.bodypart || "?"} | HP: ${a.hp ?? "?"} | AC: ${a.ac ?? 0}${a.disadvantage ? ` | Disadvantage: ${a.disadvantage}` : ""}\n`;
        }
        return text(output.trim());
      }

      if (dataType === "shields") {
        const shieldsData = gameData.shields;
        let output = "# Shields\n\n";
        for (const s of shieldsData) {
          output += `**${s.name}** -- HP: ${s.hp ?? "?"} | AC: ${s.ac ?? 0} | DMG: ${s.damage || "?"}\n`;
        }
        return text(output.trim());
      }

      if (dataType === "races") {
        const racesData = gameData.races;
        let output = "# Races\n\n";
        for (const [name, r] of Object.entries(racesData.data)) {
          output += `**${name}**\n`;
          if (r.bonuses) output += `  Bonuses: ${(r.bonuses as string[]).join(", ")}\n`;
          if (r.startingEquipment)
            output += `  Starting Equipment: ${JSON.stringify(r.startingEquipment)}\n`;
          output += "\n";
        }
        return text(output.trim());
      }

      if (dataType === "classes") {
        const classesData = gameData.classes;
        let output = "# Classes\n\n";
        for (const [name, c] of Object.entries(classesData.data)) {
          output += `**${name}**\n`;
          if (c.abilityType) output += `  Ability Type: ${c.abilityType}\n`;
          if (c.bonuses) output += `  Bonuses: ${(c.bonuses as string[]).join(", ")}\n`;
          if (c.startingEquipment)
            output += `  Starting Equipment: ${JSON.stringify(c.startingEquipment)}\n`;
          output += "\n";
        }
        return text(output.trim());
      }

      if (dataType === "spells") {
        const spellsData = gameData.spells;
        let output = "# Spells by Class\n\n";
        for (const [className, spells] of Object.entries(spellsData)) {
          output += `## ${className}\n`;
          for (const s of spells) {
            output += `- **${s.name}** -- Arcana: ${s.arcana || "-"} | Weakened: ${s.weakened || "-"}${s.gain ? ` | Gain: ${s.gain}` : ""}\n`;
          }
          output += "\n";
        }
        return text(output.trim());
      }

      if (dataType === "religions") {
        const religionsData = gameData.religions;
        let output = "# Religions\n\n";
        for (const [name, r] of Object.entries(religionsData.data)) {
          output += `**${name}**`;
          if (r.description) output += `: ${r.description}`;
          output += "\n";
        }
        return text(output.trim());
      }

      // attributes or fallback
      return text(JSON.stringify(data, null, 2));
    },
  );

  safeTool(
    server,
    "get_world_lore",
    "Search the wiki for Aedelore world lore. ALWAYS use this to understand the Aedelore setting before creating content.",
    {
      topic: z.string().describe("Lore topic to search for (e.g. bestiary, history, religion, organizations, artifacts, or a specific term)"),
    },
    async ({ topic }) => {
      const topicStr = topic as string;

      // Sök ger bara metadata → hydrera topp-träffarna med faktisk brödtext via getPage(id).
      const results = asArray(await wikiApi.searchWiki(client, topicStr, {
        limit: 6,
      }));

      if (!results || results.length === 0) {
        return text(`No wiki results found for "${topicStr}".`);
      }

      let output = `# Lore: ${topicStr}\n\n`;
      for (const page of results) {
        output += `## ${page.title || page.name || "Untitled"}\n`;
        let content = "";
        if (page.id != null) {
          try {
            const full = asRecord(await wikiApi.getPage(client, Number(page.id)));
            content = String(full.content ?? "");
          } catch {
            /* hydration failed - fall back to summary below */
          }
        }
        if (!content && page.summary) content = String(page.summary);
        if (content) {
          output +=
            content.length > 3000
              ? content.substring(0, 3000) + "\n...(truncated)"
              : content;
        }
        output += "\n\n";
      }

      return text(output.trim());
    },
  );

  safeTool(
    server,
    "get_rules",
    "Get Aedelore game rules: dice system, combat, defense, HP, status effects, healing, resources, character creation. Pass `section` to fetch ONE rules page (cheap, ~1-2k tokens); omit for the full ruleset (~13k). Load on demand when a rules question comes up, not preemptively.",
    {
      section: z
        .string()
        .optional()
        .describe(
          "Optional: fetch a single rules section by name (e.g. 'combat', 'magic', 'character creation'). Omit to get the whole ruleset.",
        ),
    },
    async ({ section }) => {
      // Hämta regelboken direkt (med brödtext) - inte fritextsök på "rules" (som rankar
      // lore-/session-sidor högre och dessutom aldrig får ut content).
      try {
        const books = asArray(await wikiApi.listBooks(client));
        const rulesBook = books.find(
          (b) =>
            b.slug === "rules-and-reference" ||
            /\brules?\b/i.test(String(b.title ?? b.name ?? "")),
        );
        if (rulesBook?.slug) {
          const book = asRecord(
            await wikiApi.getBook(client, String(rulesBook.slug), true),
          );
          const pages = asArray(book.pages ?? []);
          if (pages.length > 0) {
            // Filtrera till en sektion om angiven (substring på titel/slug); annars hela verket.
            const sectionStr = (section as string | undefined)?.trim().toLowerCase();
            let selected = pages;
            if (sectionStr) {
              selected = pages.filter(
                (p) =>
                  String(p.title ?? p.name ?? "").toLowerCase().includes(sectionStr) ||
                  String(p.slug ?? "").toLowerCase().includes(sectionStr),
              );
              if (selected.length === 0) {
                const titles = pages
                  .map((p) => `"${p.title ?? p.name}"`)
                  .join(", ");
                return text(
                  `No rules section matching "${section}". Available sections: ${titles}.`,
                );
              }
            }
            let output = `# ${book.title ?? "Aedelore Game Rules"}${sectionStr ? ` - ${section}` : ""}\n\n`;
            for (const page of selected) {
              output += `## ${page.title ?? page.name ?? "Untitled"}\n`;
              if (page.content) output += String(page.content) + "\n\n";
              else if (page.summary) output += String(page.summary) + "\n\n";
            }
            return text(output.trim());
          }
        }
      } catch {
        /* fall through to game data */
      }

      // Fallback: return attribute data as basic rules reference
      const gameData = getGameData();
      const attrs = gameData.attributes;
      let output = "# Aedelore Rules Reference\n\n";
      output += "## Attributes\n";
      if (attrs.attributeNames?.length) {
        output += `Attributes: ${attrs.attributeNames.join(", ")}\n`;
      }
      if (attrs.skillNames?.length) {
        output += `Skills: ${attrs.skillNames.join(", ")}\n`;
      }
      output +=
        "\nFor full rules, check the wiki using search_wiki or get_world_lore.\n";
      return text(output.trim());
    },
  );
}
