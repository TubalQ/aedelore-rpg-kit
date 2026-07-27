# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's **"Report a vulnerability"**
(Security → Advisories) on this repository, rather than opening a public issue.

## No telemetry

This software contains **no analytics, telemetry, or phone-home code**. A self-hosted
instance never contacts the project or any third party. Nothing about your deployment,
your users, or their data leaves your server.

## Dependency advisories

The runtime-exposed dependencies are kept patched:

| Package | Status |
|---------|--------|
| `next` | tracked to the latest 16.2.x patch (SSRF / DoS / cache / middleware fixes) |
| `@auth/core` | pinned to a patched release via `overrides` |
| `sharp` | pinned `>= 0.35.x` via `overrides` (libvips fixes) |
| `dompurify` | pinned to a patched release via `overrides` (wiki HTML sanitization) |

`npm audit` will still report findings. They fall into two buckets that do **not**
affect a deployed instance's attack surface:

- **Build / dev-only tooling** - `esbuild` (via `drizzle-kit`), `@babel/core`,
  `postcss`, `js-yaml`, `brace-expansion`. These run at build or `db:push` time on a
  trusted machine and are never reachable from the running server. Forcing their
  "fixes" downgrades the toolchain to broken, ancient versions, so we don't.
- **Transitive, not safely overridable** - `undici` is pinned by `jsdom` (used
  server-side for wiki sanitization); overriding it breaks `jsdom`. Tracked upstream.
- **Framework beta** - `next-auth` v5 is still a beta; the advisory flags every v5
  build with no patched release available yet. Downgrading to v4 would mean rewriting
  authentication. Tracked upstream; will update when a stable v5 ships.

Run `npm audit` yourself before deploying and make your own risk decision. When
`jsdom`, `next-auth`, and the dev toolchain publish fixes, bump them.
