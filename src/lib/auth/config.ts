import NextAuth, { customFetch, type NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db/client";
import { users, accounts, authSessions, verificationTokens } from "@/lib/db/schema";
import { isUserActive, logLogin, getUserById, getUserByEmail } from "@/lib/db/queries/users";
import { getSettings } from "@/lib/db/queries/app-settings";
import { verifyPassword } from "@/lib/auth/password";

// Providers are assembled conditionally so the platform runs with just email/
// password (the self-host default) and only adds OIDC when it's configured.
const providers: NextAuthConfig["providers"] = [];

// Email/password sign-in. The provider is always registered; whether it is
// *active* is the DB setting `credentialsEnabled`, checked per attempt in
// authorize() - so an admin can toggle password login live, no restart.
// (Accounts are created via /api/auth/register; first = admin.)
providers.push(
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(creds) {
      if (!(await getSettings()).credentialsEnabled) return null;
      const email = String(creds?.email ?? "").toLowerCase().trim();
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;
      const user = await getUserByEmail(email);
      if (!user?.passwordHash || user.deletedAt) return null;
      if (!(await verifyPassword(password, user.passwordHash))) return null;
      return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
    },
  }),
);

// Optional external OIDC provider (any). Only added when configured. The env var
// names contain KEYCLOAK for historical reasons; any OIDC provider works.
if (process.env.AUTH_KEYCLOAK_ISSUER) {
  providers.push(
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET || "",
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      // Some OIDC servers (e.g. Pocket-ID 2.10) require a `state` param and
      // mis-advertise iss support; force state + neutralise the iss flag.
      checks: ["pkce", "state"],
      [customFetch]: async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const response = await fetch(...args);
        const input = args[0];
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("/.well-known/openid-configuration")) {
          const config = await response.json();
          config.authorization_response_iss_parameter_supported = false;
          return Response.json(config);
        }
        return response;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: authSessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return false;
      return await isUserActive(user.id);
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        const dbUser = await getUserById(user.id!);
        token.isAdmin = dbUser?.isAdmin ?? false;
      }
      if (trigger === "update") {
        const dbUser = await getUserById(token.id as string);
        token.isAdmin = dbUser?.isAdmin ?? false;
      }
      // Revoke the session promptly if the account was deleted/deactivated -
      // a stateless JWT would otherwise stay valid until it expires (24h).
      if (token.id && !(await isUserActive(token.id as string))) {
        return null;
      }
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
    async signIn({ user, account }) {
      if (user.id) {
        await logLogin(user.id, null, null, true, account?.provider ?? "credentials");
      }
    },
  },
});
