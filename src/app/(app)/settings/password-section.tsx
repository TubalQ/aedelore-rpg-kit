"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { useT } from "@/lib/i18n";

// Change password, shown only for email/password accounts (self-hosted kit).
// The change ends every session, this one too, so it signs in again with the
// new password.
export function PasswordSection() {
  const { t } = useT();
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ["account-password"],
    queryFn: () => api<{ hasPassword: boolean }>("/api/account/password"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data?.hasPassword) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = String(form.get("next") ?? "");
    if (next !== String(form.get("confirm") ?? "")) {
      setError(t("settings.passwordMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/password", { method: "PUT", body: { current: String(form.get("current") ?? ""), next } });
      await signIn("credentials", { email: session?.user?.email ?? "", password: next, callbackUrl: "/settings" });
    } catch (err) {
      setError(err instanceof ApiError ? errorMessage(err) : t("error.requestFailed"));
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-base";
  return (
    <section>
      <h2 className="font-display text-lg text-text-base mb-4 flex items-center gap-2">
        <KeyRound size={18} />
        {t("settings.password")}
      </h2>
      <form onSubmit={onSubmit} className="max-w-sm space-y-3">
        <label className="block text-sm text-text-muted">
          {t("settings.passwordCurrent")}
          <input name="current" type="password" autoComplete="current-password" required className={input} />
        </label>
        <label className="block text-sm text-text-muted">
          {t("settings.passwordNew")}
          <input name="next" type="password" autoComplete="new-password" required minLength={12} className={input} />
        </label>
        <label className="block text-sm text-text-muted">
          {t("settings.passwordRepeat")}
          <input name="confirm" type="password" autoComplete="new-password" required minLength={12} className={input} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-accent-red">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base hover:brightness-110 disabled:opacity-60"
        >
          {t("settings.passwordChange")}
        </button>
        <p className="text-xs text-text-faint">{t("settings.passwordHint")}</p>
      </form>
    </section>
  );
}
