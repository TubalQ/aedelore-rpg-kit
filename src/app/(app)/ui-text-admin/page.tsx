"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useToastStore } from "@/stores/toast-store";
import type { UiTextOverrides } from "@/lib/i18n";

interface Payload {
  overrides: UiTextOverrides;
  keys: string[];
}

type Row = { key: string; sv: string; en: string };

const inputCls =
  "w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-accent-gold focus:outline-none";

function rowsFromOverrides(o: UiTextOverrides): Row[] {
  const keys = new Set<string>([...Object.keys(o.sv ?? {}), ...Object.keys(o.en ?? {})]);
  return [...keys].sort().map((key) => ({ key, sv: o.sv?.[key] ?? "", en: o.en?.[key] ?? "" }));
}

export default function UiTextAdminPage() {
  const addToast = useToastStore((s) => s.addToast);
  const { data, isLoading } = useQuery({
    queryKey: ["ui-text"],
    queryFn: () => api<Payload>("/api/ui-text"),
  });

  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (data) setRows(rowsFromOverrides(data.overrides));
  }, [data]);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);

  const allKeys = data?.keys ?? [];
  const availableKeys = useMemo(
    () => allKeys.filter((k) => !rows?.some((r) => r.key === k)),
    [allKeys, rows],
  );

  if (isLoading || !rows) return <p className="text-text-muted">Loading…</p>;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));

  function addRow() {
    const key = newKey.trim();
    if (!key) return;
    if (!allKeys.includes(key)) {
      addToast(`"${key}" is not a known translation key`, "error");
      return;
    }
    if (rows!.some((r) => r.key === key)) {
      addToast("That key is already listed", "info");
      return;
    }
    setRows([...rows!, { key, sv: "", en: "" }]);
    setNewKey("");
  }

  async function save() {
    setSaving(true);
    try {
      const sv: Record<string, string> = {};
      const en: Record<string, string> = {};
      for (const r of rows!) {
        if (r.sv.trim()) sv[r.key] = r.sv.trim();
        if (r.en.trim()) en[r.key] = r.en.trim();
      }
      await api("/api/ui-text", { method: "PUT", body: { sv, en } });
      addToast("UI text overrides saved", "success");
    } catch (e) {
      addToast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent-gold">UI text</h1>
        <p className="mt-1 text-sm text-text-muted">
          Override specific interface strings per language, stored in the database. Leave a field
          blank to keep the built-in text. Changes apply immediately - no rebuild.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg-surface p-3">
        <label className="flex-1 text-xs text-text-muted">
          Add a key to override
          <input
            className={inputCls}
            list="ui-text-keys"
            value={newKey}
            placeholder="e.g. sidebar.home"
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRow();
              }
            }}
          />
          <datalist id="ui-text-keys">
            {availableKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted hover:border-accent-gold hover:text-accent-gold"
          onClick={addRow}
        >
          + Add
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No overrides yet. Add a key above to get started.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="rounded-lg border border-border bg-bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <code className="text-xs text-accent-gold">{r.key}</code>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-accent-red"
                  onClick={() => removeRow(i)}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-text-muted">
                  Svenska
                  <input className={inputCls} value={r.sv} onChange={(e) => setRow(i, { sv: e.target.value })} />
                </label>
                <label className="text-xs text-text-muted">
                  English
                  <input className={inputCls} value={r.en} onChange={(e) => setRow(i, { en: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 flex justify-end bg-bg-base/80 py-3 backdrop-blur">
        <button
          className="rounded-md bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:brightness-110 disabled:opacity-50"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save overrides"}
        </button>
      </div>
    </div>
  );
}
