"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

interface DiceResult {
  rolls: number[];
  total: number;
  modifier: number;
  dc: number | null;
  success: boolean | null;
  crit: boolean;
  nat1: boolean;
  label: string;
}

function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

function parseRollExpr(expr: string): { count: number; sides: number } | null {
  const match = expr.match(/^(\d+)?[dD](\d+)$/);
  if (!match) return null;
  return { count: parseInt(match[1] ?? "1"), sides: parseInt(match[2]) };
}

type RollMode = "check" | "attack" | "damage" | "custom";

const MODE_KEYS: Record<RollMode, TranslationKey> = {
  check: "dice.check",
  attack: "dice.attack",
  damage: "dice.damage",
  custom: "dice.custom",
};

export function DiceRoller() {
  const { t } = useT();
  const [mode, setMode] = useState<RollMode>("check");
  const [modifier, setModifier] = useState(0);
  const [dc, setDc] = useState(10);
  const [customExpr, setCustomExpr] = useState("1d6");
  const [result, setResult] = useState<DiceResult | null>(null);
  const [parseError, setParseError] = useState(false);

  function rollD20(label: string, mod: number, targetDc: number | null) {
    const rolls = rollDice(1, 20);
    const roll = rolls[0];
    const total = roll + mod;
    const crit = roll === 20;
    const nat1 = roll === 1;
    const success = targetDc !== null ? (crit || (!nat1 && total >= targetDc)) : null;
    setResult({ rolls, total, modifier: mod, dc: targetDc, success, crit, nat1, label });
  }

  function rollCustom(expr: string) {
    const parsed = parseRollExpr(expr);
    if (!parsed) {
      setParseError(true);
      return;
    }
    setParseError(false);
    const rolls = rollDice(parsed.count, parsed.sides);
    const total = rolls.reduce((a, b) => a + b, 0);
    setResult({ rolls, total, modifier: 0, dc: null, success: null, crit: false, nat1: false, label: expr });
  }

  function handleRoll() {
    switch (mode) {
      case "check":
        rollD20(t("dice.check"), modifier, dc);
        break;
      case "attack":
        rollD20(t("dice.attack"), modifier, dc);
        break;
      case "damage":
        rollCustom(customExpr);
        break;
      case "custom":
        rollCustom(customExpr);
        break;
    }
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <h2 className="text-lg font-semibold text-text-base">{t("dice.title")}</h2>

      <div className="flex gap-1">
        {(Object.keys(MODE_KEYS) as RollMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-2 py-1 text-xs ${
              mode === m ? "bg-accent-gold/20 text-accent-gold" : "bg-bg-base text-text-faint hover:text-text-muted"
            }`}
          >
            {t(MODE_KEYS[m])}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(mode === "check" || mode === "attack") && (
          <>
            <div className="flex items-center gap-1">
              <label className="text-xs text-text-faint">Mod</label>
              <input
                type="number"
                value={modifier}
                onChange={(e) => setModifier(Number(e.target.value))}
                className="w-14 rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base text-center focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-text-faint">DC</label>
              <input
                type="number"
                value={dc}
                onChange={(e) => setDc(Number(e.target.value))}
                className="w-14 rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base text-center focus:outline-none"
              />
            </div>
          </>
        )}
        {(mode === "damage" || mode === "custom") && (
          <div className="flex items-center gap-1">
            <label className="text-xs text-text-faint">{t("dice.diceLabel")}</label>
            <input
              type="text"
              value={customExpr}
              onChange={(e) => setCustomExpr(e.target.value)}
              className="w-20 rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base text-center focus:outline-none"
              placeholder="2d6"
            />
          </div>
        )}
        <button
          onClick={handleRoll}
          className="rounded bg-accent-gold/20 px-4 py-1.5 text-sm font-semibold text-accent-gold hover:bg-accent-gold/30"
        >
          {t("dice.roll")}
        </button>
      </div>

      {parseError && (
        <p className="text-xs text-red-400">{t("dice.invalidFormat")}</p>
      )}

      {result && (
        <div className={`rounded border p-3 text-center ${
          result.crit ? "border-green-500/50 bg-green-950/20" :
          result.nat1 ? "border-red-500/50 bg-red-950/20" :
          result.success === true ? "border-green-900/50 bg-green-950/10" :
          result.success === false ? "border-red-900/50 bg-red-950/10" :
          "border-border bg-bg-base"
        }`}>
          <p className="text-xs text-text-faint mb-1">{result.label}</p>
          <p className={`text-3xl font-bold font-mono ${
            result.crit ? "text-green-400" :
            result.nat1 ? "text-red-400" :
            result.success === true ? "text-green-300" :
            result.success === false ? "text-red-300" :
            "text-text-base"
          }`}>
            {result.total}
          </p>
          {result.rolls.length > 0 && (
            <p className="text-xs text-text-faint mt-1">
              [{result.rolls.join(", ")}]
              {result.modifier !== 0 && ` + ${result.modifier}`}
              {result.dc !== null && ` vs DC ${result.dc}`}
            </p>
          )}
          {result.crit && <p className="text-xs text-green-400 mt-1 font-bold">{t("dice.criticalHit")}</p>}
          {result.nat1 && <p className="text-xs text-red-400 mt-1 font-bold">{t("dice.natural1")}</p>}
        </div>
      )}
    </section>
  );
}
