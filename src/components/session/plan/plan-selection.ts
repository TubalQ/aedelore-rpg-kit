/** What the planning view's side panel shows. */
export type PlanSelection =
  | { kind: "scene"; index: number }
  | { kind: "loose"; tab?: LooseTab }
  | { kind: "session" }
  | null;

export type LooseTab = "loose" | "places";
