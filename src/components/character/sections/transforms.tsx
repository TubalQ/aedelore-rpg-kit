"use client";

import type { CharacterData } from "@/lib/schemas/character";
import { getTransformsForClass } from "@/lib/domain/transforms";
import { RuleHead } from "../rule-head";
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
    <section className="rounded-lg border border-accent-green/35 bg-accent-green/5 p-4 space-y-3">
      <RuleHead
        label={transformDef.name}
        right={
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">
            {t("transforms.charges")}: {state.charges}/{state.maxCharges}
          </span>
          {!isTransformed && state.charges < state.maxCharges && (
            <button
              onClick={resetCharges}
              className="rounded bg-accent-green/10 px-2 py-0.5 text-xs text-accent-green hover:bg-accent-green/20"
            >
              {t("transforms.rest")}
            </button>
          )}
        </div>
        }
      />

      {isTransformed && activeForm && (
        <div className="rounded border border-accent-green/40 bg-accent-green/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-accent-green">
              {activeForm.icon} {activeForm.name}
            </span>
            <button
              onClick={revert}
              className="rounded bg-accent-red/10 px-3 py-1 text-xs text-accent-red hover:bg-accent-red/20"
            >
              {t("transforms.revert")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(activeForm.attributes).map(([key, val]) => (
              <div key={key} className="text-text-faint">
                <span className="text-text-muted">{key.replace("_value", "")}: </span>
                <span className="text-accent-green">{val}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-text-faint">
            HP: {data.hp}/{activeForm.hp} | Attack: {activeForm.attack.name} ({activeForm.attack.damage})
            {activeForm.block > 0 && ` | Block: ${activeForm.block}`}
          </div>
          {transformDef.disableArcana && (
            <p className="text-[10px] text-accent-gold">{t("transforms.arcanaDisabled")}</p>
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
              className="rounded border border-accent-green/30 bg-bg-base p-2 text-left hover:bg-accent-green/5 disabled:opacity-30"
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
