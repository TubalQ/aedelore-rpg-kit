import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { safeCallback } from "@/lib/auth/safe-callback";
import { PasswordSignIn } from "@/components/auth/PasswordSignIn";
import { passwordAuthEnabled } from "@/lib/auth/credentials";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};


// NextAuth redirects here with ?error=<code> when a sign-in fails. Codes we can
// actually explain get a real sentence; the rest fall back to something honest
// rather than a bare code.
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "That email is already registered by another sign-in method. Use the method you signed up with.";
    case "AccessDenied":
      return "That account is not allowed to sign in (it may have been deactivated).";
    case "CredentialsSignin":
      return "Wrong email or password. After several failed attempts the account is locked for a while.";
    case "Verification":
      return "That sign-in link has expired. Please try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, callbackUrl } = await searchParams;
  const next = safeCallback(callbackUrl);
  const session = await auth();
  if (session) redirect(next);

  const keycloakEnabled = !!process.env.AUTH_KEYCLOAK_ISSUER;
  const passwordEnabled = passwordAuthEnabled();
  const problem = errorMessage(error);

  return (
    <div className="rounded-md border border-border bg-gradient-to-b from-bg-surface/75 to-bg-base/85 p-10 text-center shadow-2xl backdrop-blur-md">
      <svg
        viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"
        className="mx-auto mb-5 h-14 w-14 text-accent-gold drop-shadow-[0_0_14px_rgba(201,168,76,.35)]"
      >
        <circle cx="32" cy="32" r="27" opacity=".55" />
        <circle cx="32" cy="32" r="21" opacity=".3" />
        <path d="M32 12 L45 46 H19 Z" />
        <path d="M24 38 H40" />
        <path d="M32 6 V12 M32 52 V58 M6 32 H12 M52 32 H58" opacity=".7" />
      </svg>

      <h1 className="font-display text-3xl font-semibold text-accent-gold">
        Welcome, traveler
      </h1>
      <p className="mt-2 font-display text-base italic text-text-muted">
        The seams grow thin. Your story waits beyond the threshold.
      </p>

      {problem && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-left text-sm text-accent-red"
        >
          {problem}
        </p>
      )}

      <div className="mt-8 space-y-6">
        {passwordEnabled && <PasswordSignIn callbackUrl={next} />}
        {passwordEnabled && keycloakEnabled && (
          <p className="text-xs uppercase tracking-widest text-text-faint">or</p>
        )}
        {(keycloakEnabled || !passwordEnabled) && (
          <SignInButtons keycloak={keycloakEnabled} callbackUrl={next} ssoOnly={passwordEnabled} />
        )}
      </div>
    </div>
  );
}
