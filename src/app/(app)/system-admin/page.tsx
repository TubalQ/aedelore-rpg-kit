"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useToastStore } from "@/stores/toast-store";
import { SPECS, EDITABLE_KINDS, labelFields, type KindSpec, type Field } from "./specs";
import { FieldInput, type OptionSources } from "./field-input";

const btn =
  "rounded-md bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:brightness-110 disabled:opacity-50";
const ghost =
  "rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent-gold hover:text-accent-gold";

function blankEntry(fields: Field[]): Record<string, unknown> {
  const e: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "number") e[f.key] = 0;
    else if (f.type === "bonuses" || f.type === "objectlist" || f.type === "stringlist") e[f.key] = [];
    else if (f.type === "object") e[f.key] = blankEntry(f.fields);
    else e[f.key] = "";
  }
  return e;
}

export default function SystemAdminPage() {
  const [kind, setKind] = useState<string>(EDITABLE_KINDS[0]);
  const addToast = useToastStore((s) => s.addToast);

  // Cross-reference option sources (loaded once).
  const attributes = useQuery({ queryKey: ["sa", "attributes"], queryFn: () => api<{ data: unknown }>("/api/system-admin/attributes").catch(() => null) });
  const weapons = useQuery({ queryKey: ["sa", "weapons"], queryFn: () => api<{ data: unknown }>("/api/system-admin/weapons") });
  const armor = useQuery({ queryKey: ["sa", "armor"], queryFn: () => api<{ data: unknown }>("/api/system-admin/armor") });

  const sources: OptionSources = useMemo(() => {
    const a = attributes.data?.data as { attributeNames?: string[]; skillNames?: string[] } | null;
    const w = weapons.data?.data as { weapons?: { name: string }[] } | undefined;
    const ar = armor.data?.data as { bodyParts?: string[] } | undefined;
    return {
      attributes: [...(a?.attributeNames ?? []), ...(a?.skillNames ?? [])],
      weapons: (w?.weapons ?? []).map((x) => x.name),
      bodyparts: ar?.bodyParts ?? [],
    };
  }, [attributes.data, weapons.data, armor.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent-gold">Game system editor</h1>
        <p className="mt-1 text-sm text-text-muted">
          Edit your world&apos;s races, classes, weapons and more. Changes are saved to the database and
          take effect immediately - no rebuild.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {EDITABLE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={k === kind ? `${btn} !py-1.5` : ghost}
          >
            {SPECS[k].label}
          </button>
        ))}
      </div>

      <KindEditor
        key={kind}
        kind={kind}
        spec={SPECS[kind]}
        sources={sources}
        onSaved={(warnings) => {
          addToast(`${SPECS[kind].label} saved`, "success");
          if (warnings.length) addToast(`Saved with notes: ${warnings.join(" · ")}`, "info");
        }}
        onError={(msg) => addToast(msg, "error")}
      />
    </div>
  );
}

function KindEditor({
  kind,
  spec,
  sources,
  onSaved,
  onError,
}: {
  kind: string;
  spec: KindSpec;
  sources: OptionSources;
  onSaved: (warnings: string[]) => void;
  onError: (msg: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["sa", kind],
    queryFn: () => api<{ data: unknown }>(`/api/system-admin/${kind}`),
  });

  // Local editable copy of the raw kind value.
  const [draft, setDraft] = useState<unknown>(null);
  useEffect(() => {
    if (data) setDraft(structuredClone(data.data));
  }, [data]);
  const [saving, setSaving] = useState(false);

  if (isLoading || draft == null) return <p className="text-text-muted">Loading…</p>;

  async function save() {
    setSaving(true);
    try {
      const res = await api<{ warnings?: string[] }>(`/api/system-admin/${kind}`, {
        method: "PUT",
        body: { data: draft },
      });
      onSaved(res.warnings ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiError && Array.isArray(e.data.details)
          ? (e.data.details as string[]).join("\n")
          : e instanceof Error
            ? e.message
            : "Save failed";
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {spec.shape === "record" ? (
        <RecordEditor spec={spec} value={draft as RecordVal} onChange={setDraft} sources={sources} />
      ) : spec.shape === "grouped" ? (
        <GroupedEditor spec={spec} value={draft as Record<string, Record<string, unknown>[]>} onChange={setDraft} sources={sources} />
      ) : spec.shape === "single" ? (
        kind === "attributes" ? (
          <AttributesEditor value={draft as Record<string, unknown>} onChange={setDraft} sources={sources} />
        ) : kind === "palettes" ? (
          <PalettesEditor value={draft as Record<string, unknown>} onChange={setDraft} sources={sources} />
        ) : (
          <SingleEditor spec={spec} value={draft as Record<string, unknown>} onChange={setDraft} sources={sources} />
        )
      ) : (
        <ListEditor spec={spec} value={draft as Record<string, unknown>} onChange={setDraft} sources={sources} />
      )}
      <div className="sticky bottom-0 flex justify-end bg-bg-base/80 py-3 backdrop-blur">
        <button className={btn} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

type RecordVal = { names: string[]; data: Record<string, Record<string, unknown>> };

function RecordEditor({
  spec,
  value,
  onChange,
  sources,
}: {
  spec: Extract<KindSpec, { shape: "record" }>;
  value: RecordVal;
  onChange: (v: RecordVal) => void;
  sources: OptionSources;
}) {
  // Ordered list of entries following `names`.
  const entries = value.names.map((n) => value.data[n] ?? { name: n });

  const commit = (next: Record<string, unknown>[]) => {
    const names = next.map((e) => String(e.name || "").trim()).filter(Boolean);
    const data: Record<string, Record<string, unknown>> = {};
    for (const e of next) {
      const n = String(e.name || "").trim();
      if (n) data[n] = e;
    }
    onChange({ names, data });
  };

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <details key={i} className="rounded-lg border border-border bg-bg-surface p-3" open={entries.length <= 6}>
          <summary className="cursor-pointer font-display text-text-base">
            {String(entry.name) || "(unnamed)"}
          </summary>
          <div className="mt-3 space-y-3">
            {spec.entry.map((f) => (
              <label key={f.key} className="block text-xs text-text-muted">
                {f.label}
                <FieldInput
                  field={f}
                  value={entry[f.key]}
                  onChange={(v) => {
                    const next = [...entries];
                    next[i] = { ...entry, [f.key]: v };
                    commit(next);
                  }}
                  sources={sources}
                />
              </label>
            ))}
            <button
              type="button"
              className="text-xs text-text-muted hover:text-accent-red"
              onClick={() => commit(entries.filter((_, j) => j !== i))}
            >
              Delete {String(entry.name) || "entry"}
            </button>
          </div>
        </details>
      ))}
      <button
        type="button"
        className={ghost}
        onClick={() => commit([...entries, { ...blankEntry(spec.entry), name: "New" }])}
      >
        + Add {spec.label.replace(/s$/, "")}
      </button>
    </div>
  );
}

function ListEditor({
  spec,
  value,
  onChange,
  sources,
}: {
  spec: Extract<KindSpec, { shape: "list" }>;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sources: OptionSources;
}) {
  const rows = (value[spec.arrayKey] as Record<string, unknown>[]) ?? [];
  const commit = (next: Record<string, unknown>[]) => onChange({ ...value, [spec.arrayKey]: next });

  return (
    <div className="space-y-3">
      {spec.scalars && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-surface p-3">
          {spec.scalars.map((f) => (
            <label key={f.key} className="block text-xs text-text-muted">
              {f.label}
              <FieldInput
                field={f}
                value={value[f.key]}
                onChange={(v) => onChange({ ...value, [f.key]: v })}
                sources={sources}
              />
            </label>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <details key={i} className="rounded-lg border border-border bg-bg-surface p-3" open={rows.length <= 8}>
          <summary className="cursor-pointer font-display text-text-base">
            {String(row.name) || "(unnamed)"}
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {spec.row.map((f) => (
              <label key={f.key} className="block text-xs text-text-muted">
                {f.label}
                <FieldInput
                  field={f}
                  value={row[f.key]}
                  onChange={(v) => {
                    const next = [...rows];
                    next[i] = { ...row, [f.key]: v };
                    commit(next);
                  }}
                  sources={sources}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-text-muted hover:text-accent-red"
            onClick={() => commit(rows.filter((_, j) => j !== i))}
          >
            Delete row
          </button>
        </details>
      ))}
      <button
        type="button"
        className={ghost}
        onClick={() => commit([...rows, { ...blankEntry(spec.row), name: "New" }])}
      >
        + Add {spec.label.replace(/s$/, "")}
      </button>
    </div>
  );
}

function SingleEditor({
  spec,
  value,
  onChange,
  sources,
}: {
  spec: Extract<KindSpec, { shape: "single" }>;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sources: OptionSources;
}) {
  const curAccent = String(value.accentColor ?? "");
  const selected = spec.palette?.find((p) => p.accent.toLowerCase() === curAccent.toLowerCase());

  return (
    <div className="max-w-2xl space-y-3 rounded-lg border border-border bg-bg-surface p-4">
      {spec.palette && (
        <label className="block text-xs text-text-muted">
          Accent colour
          <div className="flex items-center gap-2">
            <span
              className="h-6 w-6 shrink-0 rounded border border-border"
              style={{ backgroundColor: curAccent || "#888" }}
            />
            <select
              className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-accent-gold focus:outline-none"
              value={selected?.label ?? ""}
              onChange={(e) => {
                const p = spec.palette!.find((x) => x.label === e.target.value);
                if (p) onChange({ ...value, accentColor: p.accent, accentColorDim: p.dim });
              }}
            >
              {!selected && <option value="">Custom ({curAccent})</option>}
              {spec.palette.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      )}
      {spec.fields.map((f) => (
        <label key={f.key} className="block text-xs text-text-muted">
          {f.label}
          <FieldInput
            field={f}
            value={value[f.key]}
            onChange={(v) => onChange({ ...value, [f.key]: v })}
            sources={sources}
          />
        </label>
      ))}
    </div>
  );
}

// The attributes kind holds attribute + skill DEFINITIONS (records + parallel
// name arrays) plus rules scalars. Edited as two lists here; the stored shape is
// rebuilt on every change (add/edit supported, rename is not - see the plan).
type AttrDef = { name: string; labelSv?: string; labelEn?: string; description?: string; minValue?: number; maxValue?: number; skills?: string[] };
type SkillDef = { name: string; labelSv?: string; labelEn?: string; attribute?: string; description?: string };

/** Trim label fields off an editor row into an object to spread (omit if blank). */
function pickLabels(d: Record<string, unknown>): { labelSv?: string; labelEn?: string } {
  const out: { labelSv?: string; labelEn?: string } = {};
  const sv = String(d.labelSv ?? "").trim();
  const en = String(d.labelEn ?? "").trim();
  if (sv) out.labelSv = sv;
  if (en) out.labelEn = en;
  return out;
}
type AttrKind = {
  attributeNames?: string[];
  attributes?: Record<string, AttrDef>;
  skillNames?: string[];
  skills?: Record<string, SkillDef>;
  freePointsTotal?: number;
  maxPointsPerField?: number;
  maxThirdEye?: number;
  xpPerPoint?: number;
};

const SCALAR_FIELDS: { key: "freePointsTotal" | "maxPointsPerField" | "maxThirdEye" | "xpPerPoint"; label: string }[] = [
  { key: "freePointsTotal", label: "Free points at creation" },
  { key: "maxPointsPerField", label: "Max points per attribute/skill (creation)" },
  { key: "maxThirdEye", label: "Max Third Eye" },
  { key: "xpPerPoint", label: "XP cost per point (after creation)" },
];

const ATTR_DEF_FIELDS: Field[] = [
  { key: "name", label: "Name", type: "text" },
  ...labelFields,
  { key: "description", label: "Description", type: "textarea" },
  { key: "minValue", label: "Min", type: "number" },
  { key: "maxValue", label: "Max", type: "number" },
];

function AttributesEditor({
  value,
  onChange,
  sources,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sources: OptionSources;
}) {
  const v = value as AttrKind;
  const attrDefs: Record<string, unknown>[] = (v.attributeNames ?? []).map(
    (n) => (v.attributes?.[n] ?? { name: n, description: "", minValue: 0, maxValue: 0 }) as Record<string, unknown>,
  );
  const skillDefs: Record<string, unknown>[] = (v.skillNames ?? []).map(
    (n) => (v.skills?.[n] ?? { name: n, attribute: "", description: "" }) as Record<string, unknown>,
  );
  const attrNames = attrDefs.map((d) => String(d.name ?? "").trim()).filter(Boolean);

  const emit = (
    nextAttrs: Record<string, unknown>[],
    nextSkills: Record<string, unknown>[],
    scalarPatch: Partial<AttrKind> = {},
  ) => {
    const attributes: Record<string, AttrDef> = {};
    const attributeNames: string[] = [];
    for (const d of nextAttrs) {
      const n = String(d.name ?? "").trim();
      if (!n) continue;
      attributeNames.push(n);
      attributes[n] = {
        name: n,
        ...pickLabels(d),
        description: String(d.description ?? ""),
        minValue: Number(d.minValue ?? 0),
        maxValue: Number(d.maxValue ?? 0),
        // skills[] is DERIVED from the skill list (each skill's `attribute` is the
        // source of truth) so the two representations never drift.
        skills: nextSkills
          .filter((s) => String(s.attribute ?? "") === n)
          .map((s) => String(s.name ?? "").trim())
          .filter(Boolean),
      };
    }
    const skills: Record<string, SkillDef> = {};
    const skillNames: string[] = [];
    for (const s of nextSkills) {
      const n = String(s.name ?? "").trim();
      if (!n) continue;
      skillNames.push(n);
      skills[n] = { name: n, ...pickLabels(s), attribute: String(s.attribute ?? ""), description: String(s.description ?? "") };
    }
    onChange({ ...v, ...scalarPatch, attributeNames, attributes, skillNames, skills });
  };

  const skillDefFields: Field[] = [
    { key: "name", label: "Name", type: "text" },
    ...labelFields,
    { key: "attribute", label: "Attribute", type: "select", options: attrNames },
    { key: "description", label: "Description", type: "textarea" },
  ];

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-lg border border-border bg-bg-surface p-4">
        <h3 className="font-display text-accent-gold">Attributes</h3>
        <FieldInput
          field={{ key: "attributes", label: "Attributes", type: "objectlist", itemLabel: "attribute", fields: ATTR_DEF_FIELDS }}
          value={attrDefs}
          sources={sources}
          onChange={(next) => emit(next as Record<string, unknown>[], skillDefs)}
        />
      </section>
      <section className="space-y-2 rounded-lg border border-border bg-bg-surface p-4">
        <h3 className="font-display text-accent-gold">Skills</h3>
        <p className="text-xs text-text-muted">Each skill belongs to one attribute - that link drives the character-sheet grouping.</p>
        <FieldInput
          field={{ key: "skills", label: "Skills", type: "objectlist", itemLabel: "skill", fields: skillDefFields }}
          value={skillDefs}
          sources={sources}
          onChange={(next) => emit(attrDefs, next as Record<string, unknown>[])}
        />
      </section>
      <section className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-surface p-4">
        <h3 className="col-span-2 font-display text-accent-gold">Rules</h3>
        {SCALAR_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs text-text-muted">
            {f.label}
            <input
              type="number"
              className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-accent-gold focus:outline-none"
              value={Number(v[f.key] ?? 0)}
              onChange={(e) => emit(attrDefs, skillDefs, { [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </section>
    </div>
  );
}

// User-selectable colour palettes: a plain Record<id, {label, description,
// colors}>. Edited as a list (add/edit/delete); normalized back to the record.
const PALETTE_COLOR_KEYS = [
  "bg-base",
  "bg-surface",
  "bg-elevated",
  "bg-overlay",
  "text-base",
  "text-muted",
  "text-faint",
  "accent-gold",
  "accent-gold-dim",
  "accent-purple",
  "border",
  "border-hover",
];

const PALETTE_FIELDS: Field[] = [
  { key: "id", label: "ID (stable key)", type: "text" },
  { key: "label", label: "Label", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "colors", label: "Colors", type: "object", fields: PALETTE_COLOR_KEYS.map((k) => ({ key: k, label: k, type: "text" as const })) },
];

type PaletteVal = { label?: string; description?: string; colors?: Record<string, string> };

function PalettesEditor({
  value,
  onChange,
  sources,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sources: OptionSources;
}) {
  const rec = value as Record<string, PaletteVal>;
  const defs: Record<string, unknown>[] = Object.entries(rec).map(([id, p]) => ({
    id,
    label: p.label ?? "",
    description: p.description ?? "",
    colors: p.colors ?? {},
  }));
  const emit = (next: Record<string, unknown>[]) => {
    const out: Record<string, PaletteVal> = {};
    for (const d of next) {
      const id = String(d.id ?? "").trim();
      if (!id) continue;
      out[id] = {
        label: String(d.label ?? ""),
        description: String(d.description ?? ""),
        colors: (d.colors as Record<string, string>) ?? {},
      };
    }
    onChange(out as Record<string, unknown>);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">
        User-selectable colour palettes (Settings → theme picker). Values are hex/CSS colours; keys map to the
        <code className="mx-1">--color-*</code> variables.
      </p>
      <FieldInput
        field={{ key: "palettes", label: "Palettes", type: "objectlist", itemLabel: "palette", fields: PALETTE_FIELDS }}
        value={defs}
        sources={sources}
        onChange={(next) => emit(next as Record<string, unknown>[])}
      />
    </div>
  );
}

function GroupedEditor({
  spec,
  value,
  onChange,
  sources,
}: {
  spec: Extract<KindSpec, { shape: "grouped" }>;
  value: Record<string, Record<string, unknown>[]>;
  onChange: (v: Record<string, Record<string, unknown>[]>) => void;
  sources: OptionSources;
}) {
  // Group keys are class names; offer classes not yet present to add.
  const classesQ = useQuery({
    queryKey: ["sa", "classes"],
    queryFn: () => api<{ data: { names?: string[] } }>("/api/system-admin/classes"),
  });
  const classNames = classesQ.data?.data?.names ?? [];
  const groups = Object.keys(value);
  const missing = classNames.filter((c) => !groups.includes(c));

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const rows = value[group] ?? [];
        const setRows = (next: Record<string, unknown>[]) => onChange({ ...value, [group]: next });
        return (
          <div key={group} className="rounded-lg border border-border bg-bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-accent-gold">{group}</h3>
              <button
                type="button"
                className="text-xs text-text-muted hover:text-accent-red"
                onClick={() => {
                  const next = { ...value };
                  delete next[group];
                  onChange(next);
                }}
              >
                Remove {group}
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <details key={i} className="rounded border border-border/60 p-2">
                  <summary className="cursor-pointer text-sm text-text-base">{String(row.name) || "(unnamed)"}</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {spec.row.map((f) => (
                      <label key={f.key} className="block text-xs text-text-muted">
                        {f.label}
                        <FieldInput
                          field={f}
                          value={row[f.key]}
                          onChange={(v) => {
                            const next = [...rows];
                            next[i] = { ...row, [f.key]: v };
                            setRows(next);
                          }}
                          sources={sources}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-text-muted hover:text-accent-red"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    Delete spell
                  </button>
                </details>
              ))}
              <button
                type="button"
                className="text-xs text-accent-gold hover:underline"
                onClick={() => setRows([...rows, { ...blankEntry(spec.row), name: "New spell" }])}
              >
                + Add spell to {group}
              </button>
            </div>
          </div>
        );
      })}
      {missing.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Add spell list for class:</span>
          <select
            className="rounded border border-border bg-bg-base px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value) onChange({ ...value, [e.target.value]: [] });
            }}
          >
            <option value="">Choose…</option>
            {missing.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
