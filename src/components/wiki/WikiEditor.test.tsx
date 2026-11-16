// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WikiEditor from "./WikiEditor";

// A page the editor cannot keep opens read-only, so saving the page never
// rewrites it without its formatting (W1). Other pages are edited as before.

let container: HTMLDivElement;
let root: Root;
let changes: string[];

async function render(content: string): Promise<void> {
  await act(async () => root.render(<WikiEditor content={content} onChange={(html) => changes.push(html)} />));
  // The editor is created after the first render (immediatelyRender: false).
  for (let i = 0; i < 5; i++) await act(() => new Promise((r) => setTimeout(r, 10)));
}

const editable = (): string | null | undefined => container.querySelector(".ProseMirror")?.getAttribute("contenteditable");

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  changes = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("WikiEditor", () => {
  it("opens a page it cannot keep read-only, saying why", async () => {
    await render("<div><h3>The Void</h3>Beings older than the Black Sun.</div>");
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/cannot keep|kan inte bevara/);
    expect(editable()).toBe("false");
    expect(container.textContent).toContain("Beings older than the Black Sun.");
  });

  it("edits a page with tables and styled boxes, with the spoiler button there", async () => {
    await render('<table><tr><th style="padding: 8px">A</th></tr></table><div style="padding: 8px">Box</div>');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(editable()).toBe("true");
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "Spoiler")).toBe(true);
    expect(container.querySelector("table th")?.getAttribute("style")).toContain("padding");
  });
});
