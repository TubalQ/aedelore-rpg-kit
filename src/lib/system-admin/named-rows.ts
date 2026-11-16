// The game system editor edits name-keyed records (races, classes, attributes,
// skills, palettes) as lists of rows. The stored shape is keyed by name, so it
// is rebuilt from the rows. The rows themselves stay the editor's state (Y2):
// rebuilding the editor from the keyed shape on every keystroke meant that
// typing through an existing name overwrote that entry, and clearing a name
// deleted its entry. Empty and duplicate names are reported as problems that
// block saving instead.

export interface KeyedRows<T> {
  names: string[];
  byName: Record<string, T>;
  problems: string[];
}

/**
 * Keys rows by `keyOf(row)`. Rows with an empty or repeated key are left out and reported.
 * `keyWord` names the key in the report: palettes are keyed by their ID, not a name (#83).
 */
export function keyRows<T>(rows: readonly T[], keyOf: (row: T) => string, label: string, keyWord: "name" | "ID" = "name"): KeyedRows<T> {
  const names: string[] = [];
  const byName: Record<string, T> = {};
  const problems: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const key = keyOf(row).trim();
    if (!key) {
      problems.push(`${label} ${i + 1} needs ${keyWord === "ID" ? "an ID" : "a name"}.`);
      return;
    }
    if (seen.has(key)) {
      problems.push(`${label} "${key}" appears more than once.`);
      return;
    }
    seen.add(key);
    names.push(key);
    byName[key] = row;
  });
  return { names, byName, problems };
}

/**
 * The editor's label for a row without a name, the same in every list. The
 * number is the one the "needs a name" report uses (#83).
 */
export function unnamedLabel(index: number): string {
  return `(unnamed #${index + 1})`;
}
