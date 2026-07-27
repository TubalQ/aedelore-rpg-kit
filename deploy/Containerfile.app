# Aedelore v2 – Next.js 16 webbapp. Non-standalone: bygg + kör `next start`.
FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Installera ALLA deps (inkl devDeps: tailwind/typescript krävs för bygget).
# NODE_ENV sätts INTE till production här – det skulle hoppa över devDeps.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# DATABASE_URL krävs vid bygget: db/client.ts kräver den vid modulladdning OCH den
# statiska genereringen av /wiki gör riktiga DB-anrop. Levereras som build-secret
# (mount på /run/secrets) → hamnar ALDRIG i image-lager eller `podman history`.
# Bygg via /opt/aedelore/build.sh (podman-compose skickar ingen secret → fail-closed).
RUN --mount=type=secret,id=dburl \
    DATABASE_URL="$(cat /run/secrets/dburl)" npm run build

EXPOSE 3002
# Överstyr package.json:s start (som binder 127.0.0.1) → 0.0.0.0 för publicerad port.
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3002"]
