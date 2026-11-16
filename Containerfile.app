# Next.js 16 web app, built in one stage and run from another: the image that
# runs holds only what `next start` needs. No devDependencies (typescript,
# eslint, vitest, drizzle-kit ...) and no source, docs or scripts.
# Non-standalone on purpose: `next start` keeps its graceful shutdown (see CMD),
# and nothing depends on output file tracing (jsdom loads files dynamically).

# --- Build -------------------------------------------------------------------
FROM docker.io/library/node:24-bookworm-slim AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Which game system to bundle/default to (a dir under src/systems/). NEXT_PUBLIC_*
# is inlined at build time, so it must be set here; runtime env can still override
# the server-side default. The shell defaults to the generic `example` system.
ARG NEXT_PUBLIC_ACTIVE_SYSTEM=example
ENV NEXT_PUBLIC_ACTIVE_SYSTEM=$NEXT_PUBLIC_ACTIVE_SYSTEM

# Installera ALLA deps (inkl devDeps: tailwind/typescript krävs för bygget).
# NODE_ENV sätts INTE till production här – det skulle hoppa över devDeps.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The build no longer needs a database: the db client connects lazily and the
# DB-backed pages (wiki) render dynamically at request time. So a plain build
# works with `docker compose build` / `podman build` - no build secret, no DB.
RUN npm run build

# The build stage keeps every dependency: the kit's compose runs migrations,
# seeds and the password reset from it (target: build).

# --- Runtime dependencies ----------------------------------------------------
# Only the dependencies `next start` runs with go on to the final stage.
FROM build AS prod-deps
RUN npm prune --omit=dev

# --- Run ---------------------------------------------------------------------
FROM docker.io/library/node:24-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_ACTIVE_SYSTEM=example
ENV NEXT_PUBLIC_ACTIVE_SYSTEM=$NEXT_PUBLIC_ACTIVE_SYSTEM

COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.ts ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next

EXPOSE 3002
# Överstyr package.json:s start (som binder 127.0.0.1) → 0.0.0.0 för publicerad port.
# node direkt som PID 1 (inte npx): npm gör om Nexts exit 143 till 1. Next gör
# själv en graceful shutdown (stänger servern, väntar ut pågående requests) och
# avslutar medvetet med 143 = 128+SIGTERM. Quadleten har SuccessExitStatus=143.
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3002"]
