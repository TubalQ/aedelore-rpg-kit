#!/usr/bin/env node
/**
 * Seed a system's game data (races, classes, weapons, ...) into the database.
 *
 * Reads src/systems/<system>/<kind>.json for each kind and inserts one row per
 * (system, kind) into system_data. Intended for a NEW deployment on a fresh DB.
 * Idempotent: a (system, kind) that already exists is left untouched, so edits
 * made in the admin UI are never overwritten.
 *
 * Usage: NEXT_PUBLIC_ACTIVE_SYSTEM=<system> DATABASE_URL=... node scripts/seed-game-data.mjs
 *
 * Plain ESM (no TypeScript runtime needed) so it runs with `node` inside the
 * app image, which is what `npm run db:seed-system` does.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const system = process.env.NEXT_PUBLIC_ACTIVE_SYSTEM ?? "example";
const dir = resolve(here, `../src/systems/${system}`);

// The kinds that live as top-level <kind>.json files in a system folder.
const KINDS = [
  "races",
  "classes",
  "religions",
  "weapons",
  "armor",
  "spells",
  "transforms",
  "attributes",
  "theme",
  "landing",
  "palettes",
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function main() {
  for (const kind of KINDS) {
    const file = resolve(dir, `${kind}.json`);
    if (!existsSync(file)) {
      console.log(`  - ${kind}: no ${kind}.json, skipped`);
      continue;
    }
    const existing = await sql`
      SELECT id FROM system_data WHERE system = ${system} AND kind = ${kind}`;
    if (existing.length > 0) {
      console.log(`  = ${kind} (exists, skipped)`);
      continue;
    }
    const data = JSON.parse(readFileSync(file, "utf8"));
    await sql`
      INSERT INTO system_data (system, kind, data)
      VALUES (${system}, ${kind}, ${sql.json(data)})`;
    console.log(`  + ${kind}`);
  }
  console.log("Game data seed complete.");
}

main()
  .then(() => sql.end())
  .catch((err) => {
    console.error(err);
    sql.end();
    process.exit(1);
  });
