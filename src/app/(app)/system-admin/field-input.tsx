"use client";

import type { Field, OptionSource } from "./specs";

export type OptionSources = Record<OptionSource, string[]>;

const inputCls =
  "w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-accent-gold focus:outline-none";

function optionsFor(
  field: Extract<Field, { type: "select" }>,
  sources: OptionSources,
): string[] {
  return Array.isArray(field.options) ? field.options : sources[field.options];
}

/** Renders one field's editor. `value`/`onChange` operate on the field's value. */
export function FieldInput({
  field,
  value,
  onChange,
  sources,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  sources: OptionSources;
}) {
  if (field.type === "text") {
    return (
      <input
        className={inputCls}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        className={inputCls}
        value={Number(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  if (field.type === "select") {
    const opts = optionsFor(field, sources);
    const cur = (value as string) ?? "";
    return (
      <select className={inputCls} value={cur} onChange={(e) => onChange(e.target.value)}>
        <option value="">-</option>
        {/* keep a value that is no longer a valid option visible */}
        {cur && !opts.includes(cur) && <option value={cur}>{cur} (unknown)</option>}
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "bonuses") {
    return <BonusesInput value={(value as string[]) ?? []} onChange={onChange} stats={sources.attributes} />;
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${inputCls} min-h-[4rem]`}
        rows={3}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "stringlist") {
    const items = (value as string[]) ?? [];
    const commit = (next: string[]) => onChange(next);
    return (
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <input
              className={inputCls}
              value={item ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                commit(next);
              }}
            />
            <button
              type="button"
              className="px-2 text-text-muted hover:text-accent-red"
              onClick={() => commit(items.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-accent-gold hover:underline"
          onClick={() => commit([...items, ""])}
        >
          + Add {field.itemLabel ?? "item"}
        </button>
      </div>
    );
  }

  if (field.type === "objectlist") {
    const items = (value as Record<string, unknown>[]) ?? [];
    const fields = field.fields;
    const blank = (): Record<string, unknown> =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.type === "number"
            ? 0
            : f.type === "objectlist" || f.type === "stringlist"
              ? []
              : f.type === "object"
                ? {}
                : "",
        ]),
      );
    const commit = (next: Record<string, unknown>[]) => onChange(next);
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <details key={i} className="rounded border border-border/60 p-2" open={items.length <= 8}>
            <summary className="cursor-pointer text-xs text-text-base">
              {String(item[fields[0].key] ?? "") || `#${i + 1}`}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <label key={f.key} className="text-xs text-text-muted">
                  {f.label}
                  <FieldInput
                    field={f}
                    value={item[f.key]}
                    sources={sources}
                    onChange={(v) => {
                      const next = [...items];
                      next[i] = { ...item, [f.key]: v };
                      commit(next);
                    }}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-text-muted hover:text-accent-red"
              onClick={() => commit(items.filter((_, j) => j !== i))}
            >
              Delete
            </button>
          </details>
        ))}
        <button
          type="button"
          className="text-xs text-accent-gold hover:underline"
          onClick={() => commit([...items, blank()])}
        >
          + Add {field.itemLabel ?? "item"}
        </button>
      </div>
    );
  }

  // object: render sub-fields
  const obj = (value as Record<string, unknown>) ?? {};
  return (
    <div className="grid grid-cols-2 gap-2 rounded border border-border/60 p-2">
      {field.fields.map((f) => (
        <label key={f.key} className="text-xs text-text-muted">
          {f.label}
          <FieldInput
            field={f}
            value={obj[f.key]}
            onChange={(v) => onChange({ ...obj, [f.key]: v })}
            sources={sources}
          />
        </label>
      ))}
    </div>
  );
}

/** A bonus like "+1 Strength": a signed number + a stat picked from a dropdown. */
function BonusesInput({
  value,
  onChange,
  stats,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  stats: string[];
}) {
  const parse = (b: string) => {
    const m = b.match(/^([+-]?\d+)\s+(.+)$/);
    return m ? { amount: Number(m[1]), stat: m[2] } : { amount: 1, stat: b };
  };
  const rows = value.map(parse);
  const write = (next: { amount: number; stat: string }[]) =>
    onChange(next.map((r) => `${r.amount >= 0 ? "+" : ""}${r.amount} ${r.stat}`.trim()));

  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1">
          <input
            type="number"
            className={`${inputCls} w-16`}
            value={r.amount}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...r, amount: Number(e.target.value) };
              write(next);
            }}
          />
          <select
            className={inputCls}
            value={r.stat}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...r, stat: e.target.value };
              write(next);
            }}
          >
            <option value="">-</option>
            {r.stat && !stats.includes(r.stat) && <option value={r.stat}>{r.stat} (unknown)</option>}
            {stats.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="px-2 text-text-muted hover:text-accent-red"
            onClick={() => write(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-accent-gold hover:underline"
        onClick={() => write([...rows, { amount: 1, stat: stats[0] ?? "" }])}
      >
        + add bonus
      </button>
    </div>
  );
}
