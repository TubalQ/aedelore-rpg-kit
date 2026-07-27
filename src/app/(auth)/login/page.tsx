import { auth, signIn } from "@/lib/auth/config";
import { getSettings } from "@/lib/db/queries/app-settings";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const credentialsEnabled = (await getSettings()).credentialsEnabled;
  const oidcEnabled = !!process.env.AUTH_KEYCLOAK_ISSUER;

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
        Welcome back, traveler
      </h1>
      <p className="mt-2 font-display text-base italic text-text-muted">
        The seams grow thin. Your story waits beyond the threshold.
      </p>

      {credentialsEnabled && <LoginForm />}

      {oidcEnabled && (
        <form
          className={credentialsEnabled ? "mt-3" : "mt-7"}
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="block w-full rounded-md border border-border px-4 py-3 text-sm font-semibold text-text-muted transition-all hover:border-accent-gold hover:text-accent-gold"
          >
            Sign in with SSO
          </button>
        </form>
      )}

      {credentialsEnabled && (
        <p className="mt-5 text-sm text-text-muted">
          New here?{" "}
          <Link href="/register" className="text-accent-gold hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </div>
  );
}
