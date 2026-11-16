import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { users, accounts, authSessions, verificationTokens } from "@/lib/db/schema";
import {
  logLogin,
  getUserById,
  getUserByEmail,
} from "@/lib/db/queries/users";
import { endKeycloakSession } from "@/lib/auth/keycloak-logout";
import { authorizeCredentials, passwordAuthEnabled, passwordFingerprint } from "@/lib/auth/credentials";
import { findUserByEmailInsensitive, updatePasswordHash } from "@/lib/db/queries/local-accounts";

/** Client IP and user agent for the login audit trail; null when unavailable. */
async function requestContext(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, ua: h.get("user-agent") };
  } catch {
    // headers() throws outside a request scope - never break sign-in over it.
    return { ip: null, ua: null };
  }
}

// ─── Adapter ─────────────────────────────────────────────
//
// The stock Drizzle adapter is wrapped to enforce one rule: an OIDC sign-in may
// be linked to an existing account by email ONLY when that account has no
// password.
//
// Why the rule is needed. Registration is open to the public, and a
// self-registered address is unverified - nobody proves they own it. If OIDC
// identities were linked to any address match, an attacker could register
// locally as someone@example.com, wait for the real owner to sign in through
// an email-linking OIDC provider, and end up holding a password on the victim's account. That is the
// well-known hazard NextAuth names in `allowDangerousEmailAccountLinking`.
//
// Why the rule lives here and not in the signIn callback. NextAuth resolves the
// account-linking question inside the adapter, before any callback runs; by the
// time signIn() is reached the link has already been made or already thrown.
// Hiding unsafe candidates from getUserByEmail is therefore the only place the
// policy can actually take effect.
//
// Keycloak itself never email-links (no allowDangerousEmailAccountLinking), so
// in practice this guard only matters if a linking provider is added again.
const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: authSessions,
  verificationTokensTable: verificationTokens,
});

/** Thrown when an OIDC identity collides with an existing password account. */
export const EMAIL_CLAIMED_BY_PASSWORD_ACCOUNT = "EmailClaimedByPasswordAccount";

const adapter: Adapter = {
  ...baseAdapter,

  async getUserByEmail(email) {
    const candidate = await baseAdapter.getUserByEmail!(email);
    if (!candidate) return null;

    const full = await getUserByEmail(email);
    if (full?.passwordHash) {
      // Withhold the account: linking it here would be the takeover above.
      // The user is told to sign in with their password and link SSO from
      // settings, which is a decision made from an authenticated session.
      return null;
    }
    return candidate;
  },

  async createUser(data) {
    // getUserByEmail withheld the colliding account, so NextAuth's next move is
    // to create a fresh user with the same address. Stop that here: it would
    // otherwise surface as a raw unique-constraint error.
    if (data.email) {
      const existing = await getUserByEmail(data.email);
      if (existing) throw new Error(EMAIL_CLAIMED_BY_PASSWORD_ACCOUNT);
    }
    return baseAdapter.createUser!(data);
  },
};

// ─── Providers ───────────────────────────────────────────
//
// One OIDC provider: the self-hosted Keycloak at aedelore.nu/auth, where
// registration happens. No email-linking: a fresh identity always creates a
// fresh user, and a colliding email surfaces OAuthAccountNotLinked rather than
// silently merging two unverified identities.
//
// Email/password sign-in was removed 2026-08-22; the Pocket-ID beta provider was
// removed 2026-09-24 (the issuer is gone). Accounts still linked to `pocketid`
// are moved to Keycloak by mapping their `accounts` row to the Keycloak subject.
const providers: NextAuthConfig["providers"] = [];

// Primary: self-hosted Keycloak for all new/general users.
if (process.env.AUTH_KEYCLOAK_ISSUER) {
  providers.push(
    Keycloak({
      id: "keycloak",
      name: "Keycloak",
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET || "",
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      // Send state (CSRF) alongside PKCE, so the authorization request is
      // well-formed and correlated on the callback.
      checks: ["pkce", "state"],
    }),
  );
}

// Email/password, only where the operator turns it on (the self-hosted kit,
// AUTH_PASSWORD_ENABLED=true). Aedelore itself stays OIDC only.
if (passwordAuthEnabled()) {
  providers.push(
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const { ip, ua } = await requestContext();
        return authorizeCredentials(creds?.email, creds?.password, {
          findUser: findUserByEmailInsensitive,
          saveHash: updatePasswordHash,
          log: (userId, success, method) => logLogin(userId, ip, ua, success, method),
        });
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // An existing linked account arrives with its DB id; a brand-new identity
      // arrives with only the provider's subject (no matching DB row). signIn
      // runs before the adapter creates the user, so this decides whether a new
      // account may be created at all (returning false leaves no orphan row).
      const existing = user.id ? await getUserById(user.id) : null;

      if (existing) {
        // Known account: allow unless it was deactivated / soft-deleted.
        return existing.deletedAt === null;
      }

      // Brand-new identity: Keycloak may create new users freely.
      return account?.provider === "keycloak";
    },
    async jwt({ token, user, account }) {
      if (user) token.id = user.id;
      // Kept (encrypted, server-only cookie) so sign-out can end the Keycloak
      // session too (#80). Never copied into the client-visible session.
      if (account?.provider === "keycloak" && account.refresh_token) {
        token.keycloakRefreshToken = account.refresh_token;
      }
      if (!token.id) return token;
      // Read the account on every request: a deleted/deactivated user loses the
      // session at once (a stateless JWT would otherwise live for 24h), and a
      // revoked admin loses admin rights at once instead of at the next sign-in.
      const dbUser = await getUserById(token.id as string);
      if (!dbUser || dbUser.deletedAt !== null) return null;
      // A password session remembers which password it was opened with; a
      // changed or reset password ends it here.
      if (account?.provider === "credentials" && dbUser.passwordHash) {
        token.pw = passwordFingerprint(dbUser.passwordHash);
      } else if (typeof token.pw === "string" && (!dbUser.passwordHash || passwordFingerprint(dbUser.passwordHash) !== token.pw)) {
        return null;
      }
      token.isAdmin = dbUser.isAdmin ?? false;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      // JWT strategy: the decoded token arrives here (the cookie is cleared
      // afterwards regardless of the outcome).
      const token = "token" in message ? message.token : null;
      await endKeycloakSession(token?.keycloakRefreshToken, {
        issuer: process.env.AUTH_KEYCLOAK_ISSUER,
        clientId: process.env.AUTH_KEYCLOAK_ID,
        clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      });
    },
    async signIn({ user, account }) {
      if (user.id) {
        const { ip, ua } = await requestContext();
        await logLogin(user.id, ip, ua, true, account?.provider ?? "oidc");
      }
    },
  },
});
