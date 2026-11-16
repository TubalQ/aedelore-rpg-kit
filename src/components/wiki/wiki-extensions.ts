import { Extension, Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableKit } from "@tiptap/extension-table";

// The wiki editor's schema. Tiptap keeps only what its schema knows: anything
// else is dropped when the page is edited and saved. The wiki's pages carry
// tables, styled boxes (div with inline CSS), styled headings and quotes, and
// GM spoiler blocks, so the schema must know all of them (W1/W2, 2026-11-11).
// The editor still checks every page before it can be edited (round-trip.ts).

/** Node types that carry their own inline CSS in the wiki's pages. */
const STYLED_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
];

/** Keeps `style` on block nodes: the wiki's boxes, tables and headings are styled inline. */
const InlineStyle = Extension.create({
  name: "wikiInlineStyle",
  addGlobalAttributes() {
    return [
      {
        types: STYLED_TYPES,
        attributes: {
          style: {
            default: null,
            parseHTML: (el) => el.getAttribute("style"),
            renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
          },
        },
      },
    ];
  },
});

export const SPOILER_CLASS = "spoiler";
export const SPOILER_LABEL = "GM Only";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiBlock: {
      /** Wraps the selected blocks in a GM spoiler block, or unwraps them when already in one. */
      toggleSpoiler: () => ReturnType;
    };
  }
}

// Attributes a wiki box or quote keeps. Only these: the editor renders the
// node into the admin's page, so an event handler (onmouseover=...) pasted or
// stored in a page would run there. The public view sanitizes separately.
const KEPT_ATTRIBUTES = new Set(["class", "style", "id", "title", "lang", "dir"]);

/** The element's attributes that are safe and meaningful to keep (see KEPT_ATTRIBUTES, data-*). */
export function keptAttributes(el: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    Array.from(el.attributes)
      .filter((a) => KEPT_ATTRIBUTES.has(a.name) || /^data-[a-z0-9-]+$/.test(a.name))
      .map((a) => [a.name, a.value]),
  );
}

/**
 * A <div> with its attributes (KEPT_ATTRIBUTES, data-*): the wiki's styled boxes, the
 * translator blocks and the GM spoiler blocks (`class="spoiler"`).
 */
export const WikiBlock = Node.create({
  name: "wikiBlock",
  group: "block",
  content: "block*",
  defining: true,

  addAttributes() {
    return {
      htmlAttrs: {
        default: {},
        parseHTML: (el) => keptAttributes(el),
        renderHTML: (attrs) => attrs.htmlAttrs as Record<string, string>,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ editor, commands }) => {
          if (isInSpoiler(editor.state.selection.$from)) return commands.lift(this.name);
          return commands.wrapIn(this.name, { htmlAttrs: { class: SPOILER_CLASS, "data-label": SPOILER_LABEL } });
        },
    };
  },
});

/** Tags that make a <div> a container of blocks (otherwise it holds text directly). */
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DETAILS", "DIV", "DL", "FIELDSET", "FIGURE", "FOOTER", "FORM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "UL",
]);

function holdsOnlyInline(el: HTMLElement): boolean {
  return !Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));
}

/**
 * A block element that holds text directly, kept that way: in the editor's
 * block node the text would be wrapped in a paragraph, whose margin would
 * show inside the box or quote. Used for <div> (`<div style="..."><strong>Note:</strong>
 * text</div>`) and <blockquote> (the wiki's styled read-aloud quotes).
 */
function inlineBlock(name: string, tag: "div" | "blockquote") {
  return Node.create({
    name,
    group: "block",
    content: "inline*",
    defining: true,

    addAttributes() {
      return {
        htmlAttrs: {
          default: {},
          parseHTML: (el) => keptAttributes(el),
          renderHTML: (attrs) => attrs.htmlAttrs as Record<string, string>,
        },
      };
    },

    parseHTML() {
      // Ahead of the block-holding rule for the same tag (priority 50).
      return [{ tag, priority: 60, getAttrs: (el) => (holdsOnlyInline(el) ? null : false) }];
    },

    renderHTML({ HTMLAttributes }) {
      return [tag, HTMLAttributes, 0];
    },
  });
}

export const WikiInlineBlock = inlineBlock("wikiInlineBlock", "div");
const WikiInlineQuote = inlineBlock("wikiInlineQuote", "blockquote");

/**
 * A table written as it was: no <colgroup> and no min-width added. Column
 * widths are not set anywhere in the wiki (resizing is off).
 */
const WikiTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["tbody", 0]];
  },
});

// Bold and italic come from <strong>/<b> and <em>/<i> only. Tiptap would also
// make them out of `font-weight`/`font-style` in a block's style, which the
// schema keeps anyway (InlineStyle, WikiBlock): the page would gain <strong>
// or <em> it never had. Bold is the outer mark, as in most of the wiki's
// pages (`<strong><a>`); globals.css makes both orders look the same.
const WikiBold = Bold.extend({
  priority: 1001,
  parseHTML() {
    return [{ tag: "strong" }, { tag: "b", getAttrs: (node) => (node as HTMLElement).style.fontWeight !== "normal" && null }];
  },
});

const WikiItalic = Italic.extend({
  parseHTML() {
    return [{ tag: "em" }, { tag: "i", getAttrs: (node) => (node as HTMLElement).style.fontStyle !== "normal" && null }];
  },
});

type ResolvedPos = { depth: number; node: (depth: number) => { type: { name: string }; attrs: Record<string, unknown> } };

/** Whether the position is inside a GM spoiler block. */
export function isInSpoiler($pos: ResolvedPos): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name !== "wikiBlock" && node.type.name !== "wikiInlineBlock") continue;
    const cls = (node.attrs.htmlAttrs as Record<string, string> | undefined)?.class ?? "";
    if (cls.split(/\s+/).includes(SPOILER_CLASS)) return true;
  }
  return false;
}

export function wikiExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      bold: false,
      italic: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      // A link keeps its own target/rel; the default would open every
      // internal wiki link in a new tab (W14).
      link: { openOnClick: false, HTMLAttributes: { target: null, rel: null } },
    }),
    WikiBold,
    WikiItalic,
    // Inline: an image stays in its paragraph, and inside its link.
    Image.configure({ inline: true }),
    TableKit.configure({ table: false }),
    WikiTable.configure({ resizable: false }),
    InlineStyle,
    WikiBlock,
    WikiInlineBlock,
    WikiInlineQuote,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
