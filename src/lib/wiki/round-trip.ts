import { Editor } from "@tiptap/core";
import { wikiExtensions } from "@/components/wiki/wiki-extensions";

// Before a wiki page can be edited, it is run through the editor once: what
// the editor would save must be the page as it is. A page the editor cannot
// keep (formatting its schema does not know) opens read-only instead of
// being silently rewritten on the first keystroke (W1, 2026-11-11).
//
// Runs in the browser (and jsdom in tests): it needs a DOM.

/**
 * The editor's HTML as it is saved. The editor keeps an empty paragraph after
 * a closing table or box, so there is somewhere to type; it is not content.
 */
export function editorHtml(editor: Editor): string {
  return editor.getHTML().replace(/(<p><\/p>)+$/, "");
}

/** The HTML the editor would save for this page, untouched. */
export function editorRoundTrip(html: string): string {
  const editor = new Editor({ extensions: wikiExtensions(), content: html });
  try {
    return editorHtml(editor);
  } finally {
    editor.destroy();
  }
}

// What the comparison counts as the same, because it renders the same:
// - a lone paragraph in a table cell or list item, or a list item's text
//   paragraph before its sub-list, which the editor always adds: globals.css
//   removes its margin there;
// - <strong> and <a> nested either way: globals.css colours them the same;
// - <thead>/<tbody>: the editor's table has rows only; the wiki's CSS styles
//   th/td, never thead/tbody;
// - CSS written differently (#8b5cf6 / rgb(139, 92, 246), 0 / 0px, order):
//   compared as the browser reads it;
// - spaces right after or before a <br> or a block element, which never show.
const WRAPS_IN_PARAGRAPH = new Set(["td", "th", "li"]);
const TRANSPARENT = new Set(["thead", "tbody"]);
const LISTS = new Set(["UL", "OL"]);
const BLOCKS = new Set(["BR", "UL", "OL", "P", "DIV", "TABLE", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "LI"]);

function canonicalStyle(style: string): string {
  const probe = document.createElement("div");
  probe.style.cssText = style;
  const declarations: string[] = [];
  for (let i = 0; i < probe.style.length; i++) {
    const name = probe.style.item(i);
    declarations.push(`${name}: ${probe.style.getPropertyValue(name)}`);
  }
  return declarations.sort().join("; ");
}

function canonicalNode(node: Node): string {
  if (node.nodeType === 3) {
    let text = (node.textContent ?? "").replace(/\s+/g, " ");
    if (BLOCKS.has(node.previousSibling?.nodeName ?? "")) text = text.trimStart();
    if (BLOCKS.has(node.nextSibling?.nodeName ?? "")) text = text.trimEnd();
    return text.trim() === "" ? "" : text;
  }
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const attrs = Array.from(el.attributes)
    .map((a) => [a.name, a.name === "style" ? canonicalStyle(a.value) : a.value] as const)
    .filter(([name, value]) => !(name === "style" && value === ""))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  let children = Array.from(el.childNodes);
  const elements = children.filter((c) => c.nodeType === 1);
  const onlyParagraph = elements.length === 1 && (elements[0] as Element).tagName === "P" && (elements[0] as Element).attributes.length === 0;
  const loneText = children.every((c) => c.nodeType !== 3 || (c.textContent ?? "").trim() === "" || c === elements[0]);
  if (WRAPS_IN_PARAGRAPH.has(tag) && onlyParagraph && loneText) children = Array.from(elements[0].childNodes);
  // A list item's text in a paragraph, then its sub-lists.
  const first = elements[0] as Element | undefined;
  if (
    tag === "li" && first?.tagName === "P" && first.attributes.length === 0 && elements.length > 1 &&
    elements.slice(1).every((e) => LISTS.has((e as Element).tagName)) && loneText
  ) {
    children = [...Array.from(first.childNodes), ...elements.slice(1)];
  }
  // <a><strong>x</strong></a> is <strong><a>x</a></strong>.
  if (tag === "a" && elements.length === 1 && (elements[0] as Element).tagName === "STRONG" && (elements[0] as Element).attributes.length === 0 && loneText) {
    return `<strong><a${attrs}>${Array.from(elements[0].childNodes).map(canonicalNode).join("").trim()}</a></strong>`;
  }
  const inner = children.map(canonicalNode).join("").trim();
  if (TRANSPARENT.has(tag)) return inner;
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/** The page's HTML in a form where differences that do not show are gone. */
export function canonicalHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(doc.body.childNodes).map(canonicalNode).join("").trim();
}

/** Whether editing this page in the editor would keep it as it is. */
export function editorKeepsPage(html: string): boolean {
  if (!html.trim()) return true;
  return canonicalHtml(editorRoundTrip(html)) === canonicalHtml(html);
}
