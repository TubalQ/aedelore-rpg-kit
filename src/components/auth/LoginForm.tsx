"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-md border border-border bg-bg-base/60 px-3 py-2.5 text-sm text-text-muted outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-3 text-left" onSubmit={onSubmit}>
      <div>
        <label htmlFor="email" className="mb-1 block text-xs text-text-muted">Email</label>
        <input
          id="email" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs text-text-muted">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="block w-full rounded-md bg-accent-gold px-4 py-3 text-sm font-semibold text-bg-base transition-all hover:brightness-110 disabled:opacity-60"
        style={{ boxShadow: "0 8px 30px rgba(201,168,76,.22)" }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
