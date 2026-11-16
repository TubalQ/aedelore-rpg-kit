# Aedelore RPG Kit - BETA STAGE, STILL UNDER CONSTRUCTION

**A config-driven, self-hostable platform for running tabletop role-playing games as
*digital paper*.**

This is the engine behind the tabletop RPG *Aedelore* - now open for you to build your own
game on. Character sheets, campaigns, live sessions, DM tools, a searchable world wiki, and
an MCP server for AI-assisted play - all self-hosted, mobile-friendly, and defined by data
instead of hardcoded rules.

> The kit ships with a generic sample system (`example`) - **not** the Aedelore game content.
> Copy `example`, drop in your own races, classes, spells, and lore, and you have your own
> RPG app. See **[docs/BUILD-YOUR-OWN-SYSTEM.md](docs/BUILD-YOUR-OWN-SYSTEM.md)**.

---

## Quick start

You need Docker (or Podman) with Compose. Then:

```bash
git clone https://github.com/TubalQ/aedelore-rpg-kit.git
cd aedelore-rpg-kit
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD (also in DATABASE_URL) and AUTH_SECRET
# (openssl rand -base64 32)
docker compose up -d
```

Open **http://localhost:3002**, choose **Create account**, and register with an email and a
password. The **first account becomes the admin** (game system editor, wiki editor).

Compose runs a bundled PostgreSQL, the app, and a one-shot `init` that applies the database
migrations and seeds the sample `example` wiki on first start. No external database or login
provider needed.

## Why

Most tabletop tools are either a virtual tabletop (VTT) that wants to run the game *for* you,
or a static PDF you print. The Aedelore RPG Kit sits deliberately in between: it assumes the
game is played **at the table, in person**, and it just replaces the paper - reliably, on the
phone you already have in your hand.

**Design principle.** The table comes first. Priorities, in order:

1. **Never lose or corrupt a sheet.** The character model self-heals - one malformed field
   can never blank a sheet.
2. **Fast, glanceable reference** with low friction on mobile (HP, spells, items in a tap or
   two).
3. **Network resilience** - table Wi-Fi is flaky; the app tolerates it.

Real-time / VTT features (shared dice, live battle maps) are intentionally *not* the point.

## Features

**For players**
- Rich character sheets with a resilient, versioned data model and lock/unlock for play.
- Local avatar generation (any [DiceBear](https://dicebear.com) style) plus portrait upload.
- Inventory, equipment with stat bonuses, quest items, and spells - all data-driven.

**For game masters**
- Campaigns with a session runner (prep and play), places, NPCs, encounters with enemy
  status, read-aloud texts and a session log; players see changes live.
- A per-campaign item box: stage hand-outs and equipment, deal them to players on demand.
- Open any player's sheet and edit it as the DM.

**World & rules**
- A full wiki you build in the browser: books → chapters → pages, rich-text editor, image
  uploads, full-text search, i18n.
- An **MCP server** so an AI assistant can read your rules and lore and help run the table.

**For builders**
- **Config-driven game systems.** Races, classes, spells, items, attributes, theme, and a
  starter wiki all live in `src/systems/<name>/`. Switch games with one env var - no engine
  code changes.

## Build your wiki and your game

- **Wiki:** sign in as the admin and open the **Wiki editor** in the sidebar. Create books,
  chapters, and pages with a rich-text editor and image uploads - no files, no redeploy.
- **Your own game system:**
  1. `cp -r src/systems/example src/systems/mygame`
  2. Register it in `src/systems/index.ts` and edit the JSON (races, classes, spells, items…).
  3. Brand it in `theme.json` (name, colours, fonts, avatar style, landing hero).
  4. Set `NEXT_PUBLIC_ACTIVE_SYSTEM=mygame` in `.env` and `docker compose up -d --build`.

  Every screen adapts automatically - the domain layer exposes the same API regardless of the
  active system. Full walkthrough: **[docs/BUILD-YOUR-OWN-SYSTEM.md](docs/BUILD-YOUR-OWN-SYSTEM.md)**.

## Accounts and sign-in

**Email and password** is on by default (`AUTH_PASSWORD_ENABLED=true` in `.env`). Passwords
are at least 12 characters, screened against common choices, and stored as scrypt hashes;
repeated failures lock the account for a while. Players change their password under
Settings. There is no email delivery, so a forgotten password is reset by the operator:

```bash
echo -n 'a new password' | docker compose run --rm -T --entrypoint node init scripts/set-password.mjs player@example.com
```

**Single sign-on** through any OIDC provider (Keycloak, Authentik, Zitadel, Pocket ID, ...)
can be added or used instead: set `AUTH_KEYCLOAK_ISSUER` / `AUTH_KEYCLOAK_ID` /
`AUTH_KEYCLOAK_SECRET` (the names are historical) and the login page offers both. To use SSO
only, set `AUTH_PASSWORD_ENABLED=false`. Accounts are never linked by email: an address that
already has a password account cannot also sign in through SSO.

The optional **MCP server** (AI assistants) signs users in through OIDC, so it needs a
provider even when players use passwords.

## Local development

```bash
npm install
cp .env.example .env        # point DATABASE_URL at a Postgres you run
npm run db:migrate          # create the schema
npm run db:seed             # seed the active system's wiki (optional)
npm run dev                 # http://localhost:3002
```

## Going to production

`docker compose up -d` is production-ready for a single host. Put a reverse proxy
(Caddy, Traefik, nginx) in front for TLS on your domain - an example Traefik router and env
templates are in **[`deploy/`](deploy/)**. Enable the optional MCP server with
`docker compose --profile mcp up -d`.

## Project layout

```
src/                 Next.js app (engine)
  systems/<name>/    a game system: races, classes, spells, theme, starter wiki
  lib/domain/        the generic domain layer (reads the active system)
mcp/                 the MCP server
compose.yaml         one-command self-host (bundled Postgres + app + init)
Containerfile.app    the app image (mcp/Dockerfile for the MCP server)
drizzle/             versioned database migrations
deploy/              reverse-proxy + env templates
scripts/             seed-wiki, seed-game-data
docs/                guides
```

## License

Licensed under the **Apache License 2.0** - see [LICENSE](LICENSE) and [NOTICE](NOTICE).
You may use, modify, and redistribute it (including commercially), provided you retain the
attribution notice. The `example` system is a starting point, not a published game - bring
your own content.
