# Deploying the Aedelore RPG Kit

The supported deploy path is **`compose.yaml` in the repository root**: a bundled
PostgreSQL, the app, a one-shot `init` that applies the migrations and seeds the wiki, and
an optional MCP server. This directory holds the templates you adapt for a production host.

| File | Purpose |
|------|---------|
| `../Containerfile.app` | Builds the Next.js app image (multi-stage, no dev dependencies in the final image) |
| `../mcp/Dockerfile` | Builds the MCP server image |
| `env/app.env.example`, `env/mcp.env.example` | Environment templates for a host that runs the containers without Compose (copy, `chmod 600`) |
| `traefik/routers.yml` | Reverse-proxy router reference (Traefik file provider) |

## Prerequisites

- Docker or Podman with Compose, or any container runtime you prefer.
- **Sign-in:** email and password works out of the box. An OIDC provider is optional for
  the app (redirect URI `https://<your-domain>/api/auth/callback/keycloak`) and required for
  the MCP server (`https://<your-domain>/mcp/oauth/oidc-callback`).
- A reverse proxy terminating TLS (Caddy, Traefik, nginx).

## Steps

1. **Configure.** `cp .env.example .env` in the repository root and set
   `POSTGRES_PASSWORD`, `AUTH_SECRET` (`openssl rand -base64 32`) and your public URL in
   `AUTH_URL`/`NEXTAUTH_URL`. For single sign-on, also the OIDC client in
   `AUTH_KEYCLOAK_ISSUER`, `AUTH_KEYCLOAK_ID` and `AUTH_KEYCLOAK_SECRET` (the names say
   KEYCLOAK for historical reasons; any OIDC provider works).

2. **Start.**
   ```bash
   docker compose up -d                  # db + init + app
   docker compose --profile mcp up -d    # also the MCP server
   ```
   The image build needs no database or secret; pages that read the database render per
   request.

3. **Create the admin.** Register at `/register`; the first account becomes the admin. With
   OIDC only (`AUTH_PASSWORD_ENABLED=false`), sign in once and run:
   ```bash
   docker compose exec db psql -U rpgkit -d rpgkit \
     -c "update users set is_admin = true where email = 'you@example.com';"
   ```

4. **Wire the proxy.** Forward your domain to the app (`:3002`). If you run the MCP server,
   route `/mcp` and the OAuth metadata paths to it (`:3100`) with a **higher priority** than
   the app catch-all, otherwise the app answers them. See `traefik/routers.yml`.

## Notes

- Uploaded images live in the `uploads` volume. Without it they vanish when the container
  is recreated.
- Schema changes ship as versioned migrations in `drizzle/`; `init` applies them on every
  start and skips what is already applied.
- The app ships no telemetry and no analytics unless you configure them.
