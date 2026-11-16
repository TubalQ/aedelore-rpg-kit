import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    isAdmin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
    /** Keycloak refresh token from sign-in; used only to end the SSO session at sign-out (#80). */
    keycloakRefreshToken?: string;
    /** Fingerprint of the password the session was opened with (credentials only). */
    pw?: string;
  }
}
