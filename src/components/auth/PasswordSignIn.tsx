"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

// Email/password sign-in (self-hosted kit). A failed attempt comes back as
// ?error=CredentialsSignin on the login page, which explains it.
export function PasswordSignIn({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    await signIn("credentials", { email: form.get("email"), password: form.get("password"), callbackUrl });
    setBusy(false);
  }

  const input = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-base";
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <label className="block text-sm text-text-muted">
        Email
        <input name="email" type="email" autoComplete="email" required className={`mt-1 ${input}`} />
      </label>
      <label className="block text-sm text-text-muted">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={`mt-1 ${input}`} />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="block w-full rounded-md bg-accent-gold px-4 py-3 text-sm font-semibold text-bg-base transition-all hover:brightness-110 disabled:opacity-60"
      >
        Sign in
      </button>
      <Link href="/register" className="block text-center text-sm text-accent-gold hover:underline">
        Create account
      </Link>
    </form>
  );
}
