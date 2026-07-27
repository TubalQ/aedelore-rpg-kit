# Build Your Own Game System

This platform is **config-driven**: the engine (character sheets, campaigns, sessions,
DM tools, the wiki, the MCP server, the d20 mechanics) is generic, and each *game* is a
self-contained package under `src/systems/<name>/`. Swapping systems needs **no engine
code changes** - only data files and one environment variable.

The repo ships one sample system:

- **`example`** - a minimal, generic fantasy system. Copy it to start your own.

## The pieces of a system

A system is a directory `src/systems/<name>/` containing:

| File | What it defines |
|------|-----------------|
| `races.json` | Playable races/ancestries (name, HP, worthiness, starting weapon, stat bonuses) |
| `classes.json` | Character classes (resources, spell slots, abilities) |
| `religions.json` | Faiths/creeds (stat effects, restrictions) |
| `weapons.json` | Weapon catalogue + ammunition |
| `armor.json` | Armor, shields, base AC, body-part slots |
| `spells.json` | Spells grouped by class |
| `transforms.json` | Shapeshift/wildshape forms |
| `attributes.json` | Attributes + skills (field ids are **derived** from names - see below) |
| `theme.json` | Branding: name, tagline, accent colour, display font, avatar style, hero |
| `content/wiki.json` | Optional seed wiki (books → chapters → pages) |
| `index.ts` | Wires the JSON into a typed `GameSystem` object |

### The one subtle file: `attributes.json`

Character data is stored keyed on attribute/skill **names**, not on field ids. The field
ids (`strength_athletics`, …) are **derived** from the names via a slug convention, so you
only list attributes and their skills - the engine builds the rest. If you rename an
attribute or skill in an existing deployment, that is a data migration; adding new ones is
free.

## Creating a new system

1. **Copy the example:**
   ```bash
   cp -r src/systems/example src/systems/mygame
   ```
2. **Register it** in `src/systems/index.ts`:
   ```ts
   import { mygame } from "@/systems/mygame";
   export const SYSTEMS = { example, mygame };
   ```
   (and update `src/systems/mygame/index.ts` so its `id` / `name` read `"mygame"`).
3. **Edit the JSON** - races, classes, weapons, spells, etc. Keep the shapes; the types in
   `src/systems/types.ts` document every field.
4. **Brand it** in `theme.json` - name, tagline, `accentColor`, `displayFont`,
   `avatarStyle` (any [DiceBear](https://dicebear.com) collection: `adventurer`, `bottts`,
   `lorelei`, `micah`, …), and an optional `hero` block for the landing page.
5. **Pick it as active** with an env var:
   ```
   NEXT_PUBLIC_ACTIVE_SYSTEM=mygame
   ```
## Your wiki - manage it in the browser

You do **not** need to touch any files to build your wiki. The first account you register
becomes the **admin**; sign in and a **Wiki editor** appears in the sidebar (`/wiki-admin`).
There you create books, chapters, and pages with a rich-text editor and image uploads - it
all saves to the database and shows up on `/wiki` immediately. This is the normal way to run
a wiki.

The JSON seed below is **optional** - it's only for shipping *starter* content with your
system so a fresh install isn't empty:

```bash
npm run db:seed        # reads src/systems/<active>/content/wiki.json, idempotent
```

The seeder skips slugs that already exist and never overwrites content you've edited in the
UI, so it's safe to keep `content/wiki.json` as your "initial pages" and edit freely
afterwards in the browser.

## Verifying

```bash
NEXT_PUBLIC_ACTIVE_SYSTEM=mygame npm run build     # typechecks + bundles your data
```

If the build is green, your system loads. The domain layer (`src/lib/domain/*.ts`) exposes
the same public API (`RACES`, `CLASSES`, `getRace`, …) regardless of which system is
active, so every screen just works.

## What stays generic (the engine)

You never need to touch these to make a new game: authentication (OIDC), the database
layer, character sheets, campaigns/sessions, DM tools, the wiki system, the MCP server, and
the d20 mechanics (rolls, HP, AC, slots, bonuses). `src/lib/domain/time.ts` (session time
phases) is engine, not content, and is deliberately shared across systems.
