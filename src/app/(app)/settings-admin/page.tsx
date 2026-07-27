"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useToastStore } from "@/stores/toast-store";

interface Settings {
  registrationOpen: boolean;
  credentialsEnabled: boolean;
  analyticsId: string | null;
}

const inputCls =
  "w-full rounded border border-border bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-gold focus:outline-none";

export default function SettingsAdminPage() {
  const addToast = useToastStore((s) => s.addToast);
  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => api<Settings>("/api/app-settings"),
  });
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);
  const [saving, setSaving] = useState(false);

  if (isLoading || !draft) return <p className="text-text-muted">Loading…</p>;

  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  async function save() {
    setSaving(true);
    try {
      await api("/api/app-settings", { method: "PUT", body: draft });
      addToast("Instance settings saved", "success");
    } catch (e) {
      addToast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent-gold">Instance settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Site-wide toggles, stored in the database (no env editing needed). Secrets stay in
          the server environment.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-surface p-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.credentialsEnabled}
          onChange={(e) => set({ credentialsEnabled: e.target.checked })}
        />
        <span className="text-sm">
          <span className="font-medium text-text-base">Email/password sign-in</span>
          <span className="block text-text-muted">
            When off, only external (OIDC) login works. Applies immediately.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-surface p-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.registrationOpen}
          onChange={(e) => set({ registrationOpen: e.target.checked })}
        />
        <span className="text-sm">
          <span className="font-medium text-text-base">Open self-registration</span>
          <span className="block text-text-muted">
            The first account always becomes admin; this controls whether others may register
            after that (requires email/password on).
          </span>
        </span>
      </label>

      <label className="block rounded-lg border border-border bg-bg-surface p-3 text-sm">
        <span className="font-medium text-text-base">Umami analytics website id</span>
        <span className="mb-2 block text-text-muted">Blank disables analytics.</span>
        <input
          className={inputCls}
          value={draft.analyticsId ?? ""}
          placeholder="e.g. 83b0724f-…"
          onChange={(e) => set({ analyticsId: e.target.value })}
        />
      </label>

      <div className="flex justify-end">
        <button
          className="rounded-md bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:brightness-110 disabled:opacity-50"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
