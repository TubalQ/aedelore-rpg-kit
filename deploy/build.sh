#!/usr/bin/env bash
# Bygger aedelore-images. Appen kräver DATABASE_URL vid bygget (statisk /wiki-generering
# gör DB-anrop) - den matas som en FIL-baserad build-secret så den aldrig hamnar i
# image-historik/lager. Kör detta i stället för `podman-compose build` för app-imagen.
set -euo pipefail
cd /opt/aedelore

# DB-URL ur runtime-env; skrivs till en temporär secret-fil (0600), raderas alltid.
DBURL=$(grep -E '^DATABASE_URL=' env/app.env | cut -d= -f2-)
SECF=$(mktemp); chmod 600 "$SECF"
printf '%s' "$DBURL" > "$SECF"
trap 'rm -f "$SECF"' EXIT

echo ">> bygger app (med build-secret)…"
podman build --secret id=dburl,src="$SECF" \
  -t localhost/aedelore-app:latest \
  -f src/Containerfile.app src

echo ">> bygger mcp…"
podman build -t localhost/aedelore-mcp:latest src/mcp

echo ">> klart."
