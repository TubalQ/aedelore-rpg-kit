"use client";

import { signIn } from "next-auth/react";

// Client-side sign-in initiation. Using next-auth/react's signIn (a single clean
// window.location navigation to the provider) instead of a server action: the
// server-action external redirect was not followed reliably in Next 16 and, on a
// forced refresh, duplicated the query params so Keycloak rejected the authorize
// request with "client_id present multiple times".
// ssoOnly: email/password is offered too (self-hosted kit), so this is the
// single-sign-on alternative and registration happens on /register.
export function SignInButtons({ keycloak, callbackUrl = "/dashboard", ssoOnly = false }: { keycloak: boolean; callbackUrl?: string; ssoOnly?: boolean }) {
  if (!keycloak) {
    return (
      <p className="text-sm text-text-muted">
        Sign-in is currently unavailable. Please check back later.
      </p>
    );
  }

  if (ssoOnly) {
    return (
      <button
        type="button"
        onClick={() => signIn("keycloak", { callbackUrl })}
        className="block w-full rounded-md border border-accent-gold/40 px-4 py-3 text-sm font-semibold text-accent-gold transition-colors hover:bg-accent-gold/10"
      >
        Sign in with single sign-on
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => signIn("keycloak", { callbackUrl })}
        className="block w-full rounded-md bg-accent-gold px-4 py-3 text-sm font-semibold text-bg-base transition-all hover:brightness-110"
        style={{ boxShadow: "0 8px 30px rgba(201,168,76,.22)" }}
      >
        Sign in
      </button>
      {/* New players go straight to Keycloak's registration form (M1):
          prompt=create is OIDC's "make an account" request. */}
      <button
        type="button"
        onClick={() => signIn("keycloak", { callbackUrl }, { prompt: "create" })}
        className="block w-full rounded-md border border-accent-gold/40 px-4 py-3 text-sm font-semibold text-accent-gold transition-colors hover:bg-accent-gold/10"
      >
        Create account
      </button>
    </div>
  );
}
