# Deploying RPG Tools

Production deployment with Podman/Quadlet behind a reverse proxy. Adapt the templates in
this directory to your own host, database, and domain.

## Components

The app and MCP server run as a Quadlet **pod** (they share a network namespace, so the MCP
server reaches the app over pod loopback). An external PostgreSQL database and an OIDC
provider are required.

| File | Purpose |
|------|---------|
| `Containerfile.app` | Builds the Next.js app image |
| `build.sh` | Builds the app + MCP images (passes `DATABASE_URL` as a build secret) |
| `quadlet/*.pod`, `quadlet/*.container` | systemd/Quadlet units for the pod |
| `env/app.env.example`, `env/mcp.env.example` | Environment templates (copy to your host, chmod 600) |
| `traefik/routers.yml` | Reverse-proxy router reference (Traefik file provider) |

## Prerequisites

- A host with rootful Podman (5.x+) and systemd/Quadlet.
- An external PostgreSQL instance reachable from the host.
- An OIDC provider (any) with two confidential clients: one for the app, one for the MCP
  server. Set their redirect URIs to `https://<your-domain>/api/auth/callback/keycloak` and
  `https://<your-domain>/mcp/oauth/oidc-callback` respectively.
- A reverse proxy terminating TLS and forwarding to the pod's published ports (app `:3002`,
  MCP `:3100`).

## Steps

1. **Configure env.** Copy `env/app.env.example` and `env/mcp.env.example` to your host,
   fill in the database URL, auth issuer/clients, your domain, and
   `NEXT_PUBLIC_ACTIVE_SYSTEM`. Keep them `chmod 600` - real values never go in git.

2. **Build the images.**
   ```bash
   ./build.sh
   ```
   The app build runs real database queries (it statically generates the wiki), so the
   database must be reachable at build time. `DATABASE_URL` is passed as a file-based build
   secret, so it never lands in an image layer.

3. **Install the units.** Copy `quadlet/*` to `/etc/containers/systemd/`, then:
   ```bash
   systemctl daemon-reload
   systemctl start app mcp     # the pod is pulled in automatically
   ```

4. **Wire the proxy.** Point your reverse proxy at the pod. The MCP router **must** have a
   higher priority than the app catch-all (see `traefik/routers.yml`), otherwise the app
   swallows `/mcp` and the OAuth metadata.

5. **Seed a starter wiki (optional, fresh DB only).**
   ```bash
   npx tsx scripts/seed-wiki.ts     # reads systems/<active>/content/wiki.json, idempotent
   ```

## Notes

- The app binds `0.0.0.0` inside the container so the pod's published port can reach it.
- Persistent wiki media lives in a bind-mounted `uploads/` directory - without it, uploads
  live in the container's ephemeral layer and vanish on recreate.
- Auth env var names contain `KEYCLOAK` for historical reasons; the values point at whatever
  OIDC provider you configure.
