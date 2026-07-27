"use client";

import type { CharacterData } from "@/lib/schemas/character";
import { getTransformsForClass } from "@/lib/domain/transforms";
import { useT } from "@/lib/i18n";

interface TransformsProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

export function TransformsSection({ data, onChange }: TransformsProps) {
  const { t } = useT();
  if (!data.class) return null;

  const transformDef = getTransformsForClass(data.class);
  if (!transformDef) return null;

  const state = data.transformState;
  const isTransformed = state.active !== null;
  const activeForm = isTransformed ? transformDef.forms[state.active!] : null;

  function transform(formKey: string) {
    if (state.charges <= 0) return;
    const form = transformDef!.forms[formKey];
    if (!form) return;

    onChange({
      transformState: {
        active: formKey,
        charges: state.charges - 1,
        maxCharges: state.maxCharges,
        // Only hp/maxHp/equippedWeapons are mutated by the shift; attributes
        // and skills are overridden live via the form (computeBonusSources),
        // so they need no save/restore.
        originalData: {
          hp: data.hp,
          maxHp: data.maxHp,
          equippedWeapons: data.equippedWeapons,
        },
      },
      hp: form.hp,
      maxHp: form.hp,
      equippedWeapons: [
        {
          name: form.attack.name,
          damage: form.attack.damage,
          bonus: form.attack.atk,
          range: form.attack.range,
          break: 0,
        },
      ],
    });
  }

  function revert() {
    const orig = state.originalData as Record<string, unknown>;
    onChange({
      transformState: {
        ...state,
        active: null,
        originalData: {},
      },
      hp: (orig.hp as number) ?? data.hp,
      maxHp: (orig.maxHp as number) ?? data.maxHp,
      equippedWeapons: (orig.equippedWeapons as CharacterData["equippedWeapons"]) ?? [],
    });
  }

  function resetCharges() {
    onChange({
      transformState: {
        ...state,
        charges: state.maxCharges,
      },
    });
  }

  return (
    <section className="rounded-lg border border-green-900/50 bg-green-950/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-green-400">{transformDef.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">
            {t("transforms.charges")}: {state.charges}/{state.maxCharges}
          </span>
          {!isTransformed && state.charges < state.maxCharges && (
            <button
              onClick={resetCharges}
              className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400 hover:bg-green-900/50"
            >
              {t("transforms.rest")}
            </button>
          )}
        </div>
      </div>

      {isTransformed && activeForm && (
        <div className="rounded border border-green-800/50 bg-green-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-green-300">
              {activeForm.icon} {activeForm.name}
            </span>
            <button
              onClick={revert}
              className="rounded bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50"
            >
              {t("transforms.revert")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(activeForm.attributes).map(([key, val]) => (
              <div key={key} className="text-text-faint">
                <span className="text-text-muted">{key.replace("_value", "")}: </span>
                <span className="text-green-300">{val}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-text-faint">
            HP: {data.hp}/{activeForm.hp} | Attack: {activeForm.attack.name} ({activeForm.attack.damage})
            {activeForm.block > 0 && ` | Block: ${activeForm.block}`}
          </div>
          {transformDef.disableArcana && (
            <p className="text-[10px] text-orange-400">{t("transforms.arcanaDisabled")}</p>
          )}
        </div>
      )}

      {!isTransformed && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(transformDef.forms).map(([key, form]) => (
            <button
              key={key}
              onClick={() => transform(key)}
              disabled={state.charges <= 0}
              className="rounded border border-green-900/40 bg-bg-base p-2 text-left hover:bg-green-950/20 disabled:opacity-30"
            >
              <div className="flex items-center gap-1">
                <span className="text-lg">{form.icon}</span>
                <span className="text-sm font-medium text-text-base">{form.name}</span>
              </div>
              <div className="text-[10px] text-text-faint mt-1">
                HP {form.hp} | ATK {form.attack.damage} | STR {form.attributes.strength_value ?? 0} DEX {form.attributes.dexterity_value ?? 0}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
