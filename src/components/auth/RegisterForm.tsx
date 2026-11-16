"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { api, ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";

export function RegisterForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", { method: "POST", body: { email, password, name: String(form.get("name") ?? "") || undefined } });
      await signIn("credentials", { email, password, callbackUrl });
    } catch (err) {
      setError(err instanceof ApiError ? errorMessage(err) : "Registration failed. Please try again.");
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-base";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm text-text-muted">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="block text-sm text-text-muted">
        Name (optional)
        <input name="name" type="text" autoComplete="nickname" maxLength={80} className={input} />
      </label>
      <label className="block text-sm text-text-muted">
        Password (at least 12 characters)
        <input name="password" type="password" autoComplete="new-password" required minLength={12} className={input} />
      </label>
      <label className="block text-sm text-text-muted">
        Repeat password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} className={input} />
      </label>
      {error && (
        <p role="alert" className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="block w-full rounded-md bg-accent-gold px-4 py-3 text-sm font-semibold text-bg-base transition-all hover:brightness-110 disabled:opacity-60"
      >
        Create account
      </button>
      <Link href="/login" className="block text-center text-sm text-accent-gold hover:underline">
        I already have an account
      </Link>
    </form>
  );
}
