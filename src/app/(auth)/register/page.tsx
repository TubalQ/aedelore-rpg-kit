import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { passwordAuthEnabled } from "@/lib/auth/credentials";
import { safeCallback } from "@/lib/auth/safe-callback";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

// Registration with email and password (self-hosted kit). Where sign-in is
// OIDC only, accounts are made at the provider and this path goes to /login
// (it was a 404 after an OIDC registration that returned here).
export default async function RegisterPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const next = safeCallback(callbackUrl);
  if (!passwordAuthEnabled()) redirect("/login");
  if (await auth()) redirect(next);

  return (
    <div className="rounded-md border border-border bg-gradient-to-b from-bg-surface/75 to-bg-base/85 p-10 shadow-2xl backdrop-blur-md">
      <h1 className="text-center font-display text-3xl font-semibold text-accent-gold">Create account</h1>
      <p className="mt-2 text-center text-sm text-text-muted">The first account on a new install becomes the admin.</p>
      <div className="mt-8">
        <RegisterForm callbackUrl={next} />
      </div>
    </div>
  );
}
