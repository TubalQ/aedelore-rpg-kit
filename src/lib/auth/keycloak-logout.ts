// Ends the user's Keycloak session when they sign out of Aedelore (#80).
//
// Without this, Sign out only clears the app's own cookie. The Keycloak SSO
// session lives on, so the next Sign in goes straight through without asking for
// the password, which is wrong on a shared computer.
//
// Back-channel logout: the server posts the refresh token from sign-in to the
// realm's logout endpoint with the client credentials, and Keycloak ends that
// user session. Done server-side from NextAuth's signOut event, so every sign-out
// path (header, settings, auto-logout) is covered without a redirect to Keycloak
// and without exposing any token to the browser.

export type KeycloakLogoutResult =
  | "ended"
  | "already-ended"
  | "skipped"
  | "failed";

interface KeycloakLogoutConfig {
  issuer: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
}

/** Ends the Keycloak session behind `refreshToken`. Never throws. */
export async function endKeycloakSession(
  refreshToken: string | undefined,
  config: KeycloakLogoutConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<KeycloakLogoutResult> {
  const { issuer, clientId, clientSecret } = config;
  if (!refreshToken) {
    // Sessions from before this change carry no refresh token.
    console.warn("[auth] sign-out without refresh token, Keycloak session not ended");
    return "skipped";
  }
  if (!issuer || !clientId || !clientSecret) {
    console.error("[auth] Keycloak logout not configured, session not ended");
    return "skipped";
  }

  try {
    const res = await fetchImpl(`${issuer}/protocol/openid-connect/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204 || res.ok) return "ended";
    if (res.status === 400) {
      // invalid_grant: the session already timed out or was ended elsewhere.
      console.info("[auth] Keycloak session already ended at sign-out");
      return "already-ended";
    }
    console.error("[auth] Keycloak logout failed", res.status);
    return "failed";
  } catch (e) {
    console.error("[auth] Keycloak logout request failed", (e as Error).message);
    return "failed";
  }
}
