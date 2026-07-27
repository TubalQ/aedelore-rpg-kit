# Aedelore v2 – Next.js 16 webbapp. Non-standalone: bygg + kör `next start`.
FROM docker.io/library/node:22-bookworm-slim

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

EXPOSE 3002
# Överstyr package.json:s start (som binder 127.0.0.1) → 0.0.0.0 för publicerad port.
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3002"]
