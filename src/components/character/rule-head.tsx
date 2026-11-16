import type { ReactNode } from "react";

/** Section header for the classic sheet: hairline — CAPITAL LABEL — hairline,
 *  or hairline — LABEL — control when the section carries an action. Mirrors the
 *  CSS-only rule-head that bare <h2> section headers get, so headers with a
 *  right-side control read the same as the plain ones. */
export function RuleHead({ label, right }: { label: ReactNode; right?: ReactNode }) {
  return (
    <div className="cs-rulehead">
      <div className="hr" />
      <div className="lbl">{label}</div>
      {right != null ? <div className="r">{right}</div> : <div className="hr" />}
    </div>
  );
}
