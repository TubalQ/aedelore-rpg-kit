import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as wikiApi from "../api/wiki.js";
import { getGameData } from "../game-data/loader.js";
import type { GameDataType } from "../game-data/types.js";
import { safeTool } from "./safe-tool.js";
import { text, asArray, asRecord, htmlToText } from "./helpers.js";

// Rough chars-per-token for size hints in the rules contents.
const TOKEN_CHARS = 3.5;
const DM_CHEAT_SHEET_SLUG = "dm-cheat-sheet";
// get_world_lore search: how many pages, and how much of each.
const LORE_RESULTS = 6;
const LORE_EXCERPT = 350;

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
    "Find Aedelore lore: places, creatures, factions, history, religion. A book name (\"bestiary\", \"the world\", \"organizations\", \"nature\", \"religion\", \"artifacts\", \"lore\") returns that book's index; any other topic returns the best-matching pages with a short excerpt. Read a full page with read_wiki_page(book_slug, page_slug).",
    {
      topic: z.string().min(2).describe("A book name for its index, or a search term (e.g. 'wolf', 'harbour town', 'necromancer')"),
    },
    async ({ topic }) => {
      const topicStr = (topic as string).trim();
      const needle = topicStr.toLowerCase();
      const books = asArray(await wikiApi.listBooks(client));
      const bookSlugById = new Map(books.map((b) => [Number(b.id), String(b.slug ?? "")]));

      // A book name gives its index: chapters with page titles and slugs.
      const book = books.find((b) => {
        const slug = String(b.slug ?? "").toLowerCase();
        const title = String(b.title ?? "").toLowerCase();
        if (slug === needle || title === needle) return true;
        // A short term ("art", "the") is a search, not a book name; a longer
        // one may still be a singular or partial name ("artifact").
        return needle.length >= 5 && (slug.startsWith(needle) || title.startsWith(needle));
      });
      if (book) {
        const tree = asRecord(await wikiApi.getBook(client, String(book.slug)));
        const chapters = asArray(tree.chapters ?? []);
        const pages = asArray(tree.pages ?? []);
        let output = `# ${book.title} (book_slug "${book.slug}", ${pages.length} pages)\n`;
        if (book.description) output += `${book.description}\n`;
        const groups = [...chapters.map((c) => ({ id: Number(c.id), title: String(c.title ?? ""), desc: String(c.description ?? "") })), { id: -1, title: "Other", desc: "" }];
        for (const g of groups) {
          const inGroup = pages.filter((p) => (g.id === -1 ? !chapters.some((c) => Number(c.id) === Number(p.chapterId)) : Number(p.chapterId) === g.id));
          if (!inGroup.length) continue;
          output += `\n## ${g.title}${g.desc ? ` -- ${g.desc}` : ""}\n`;
          output += inGroup.map((p) => `${p.title} [${p.slug}]`).join(", ") + "\n";
        }
        output += `\nRead one with read_wiki_page("${book.slug}", page_slug).`;
        return text(output.trim());
      }

      const results = asArray(await wikiApi.searchWiki(client, topicStr, { limit: LORE_RESULTS }));
      if (!results.length) return text(`No wiki results for "${topicStr}". Try a broader term, or a book name such as "bestiary" or "the world".`);

      let output = `# Lore: ${topicStr}\n`;
      for (const page of results) {
        let excerpt = String(page.summary ?? "");
        if (!excerpt && page.id != null) {
          try {
            excerpt = String(asRecord(await wikiApi.getPage(client, Number(page.id))).content ?? "");
          } catch (err) {
            excerpt = `(excerpt unavailable: ${err instanceof Error ? err.message : String(err)})`;
          }
        }
        excerpt = htmlToText(excerpt).replace(/\s+/g, " ").trim();
        if (excerpt.length > LORE_EXCERPT) excerpt = `${excerpt.slice(0, LORE_EXCERPT)}...`;
        output += `\n## ${page.title} -- read_wiki_page("${bookSlugById.get(Number(page.bookId)) ?? "?"}", "${page.slug}")\n${excerpt}\n`;
      }
      return text(output.trim());
    },
  );

  safeTool(
    server,
    "get_rules",
    "Aedelore rules, one section at a time. Without `section` you get the table of contents (with sizes) and the compact DM cheat sheet (~1.5k tokens). Pass a section name (e.g. \"combat\", \"magic\", \"status\", \"resources\") when a ruling comes up. `section: \"all\"` returns the whole rulebook (~26k tokens); avoid it.",
    {
      section: z
        .string()
        .optional()
        .describe(
          "Section name or part of it (e.g. 'combat', 'magic', 'character creation'). Omit for contents + DM cheat sheet; 'all' for the whole book.",
        ),
    },
    async ({ section }) => {
      let unavailable = "";
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
            if (!sectionStr) {
              // Contents with sizes plus the DM cheat sheet: enough to run a
              // scene, and it tells the AI what to fetch next.
              const toc = pages
                .map((p) => `- ${p.title ?? p.name} (~${Math.ceil(htmlToText(String(p.content ?? "")).length / TOKEN_CHARS / 100) * 100} tokens)`)
                .join("\n");
              const cheat = pages.find((p) => String(p.slug ?? "") === DM_CHEAT_SHEET_SLUG);
              let output = `# ${book.title ?? "Aedelore Game Rules"}: contents\n\nFetch one section with get_rules(section).\n\n${toc}\n`;
              if (cheat?.content) output += `\n## ${cheat.title}\n${htmlToText(String(cheat.content))}\n`;
              return text(output.trim());
            }
            let selected = pages;
            if (sectionStr !== "all") {
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
            let output = `# ${book.title ?? "Aedelore Game Rules"}${sectionStr !== "all" ? ` - ${section}` : ""}\n\n`;
            for (const page of selected) {
              output += `## ${page.title ?? page.name ?? "Untitled"}\n`;
              if (page.content) output += htmlToText(String(page.content)) + "\n\n";
              else if (page.summary) output += String(page.summary) + "\n\n";
            }
            return text(output.trim());
          }
        }
      } catch (err) {
        // Falls through to the game data, but says so: this used to read as
        // the rules (only the attribute list) with no sign anything failed.
        unavailable = err instanceof Error ? err.message.slice(0, 120) : String(err);
      }

      // Fallback: return attribute data as basic rules reference
      const gameData = getGameData();
      const attrs = gameData.attributes;
      let output = unavailable
        ? `NOTE: The rules book could not be read (${unavailable}). Only the attribute list below; try get_rules again shortly.\n\n# Aedelore Rules Reference\n\n`
        : "NOTE: No rules book in the wiki. Only the attribute list below.\n\n# Aedelore Rules Reference\n\n";
      output += "## Attributes\n";
      if (attrs.attributeNames?.length) {
        output += `Attributes: ${attrs.attributeNames.join(", ")}\n`;
      }
      if (attrs.skillNames?.length) {
        output += `Skills: ${attrs.skillNames.join(", ")}\n`;
      }
      output +=
        "\nFor full rules, check the wiki with get_world_lore.\n";
      return text(output.trim());
    },
  );
}
