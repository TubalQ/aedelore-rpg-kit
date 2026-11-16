// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { canonicalHtml, editorHtml, editorKeepsPage, editorRoundTrip } from "./round-trip";
import { wikiExtensions } from "@/components/wiki/wiki-extensions";
import { stripSpoilerContent } from "./spoilers";

// Every construct the wiki's pages use (counted 2026-11-11) must survive the
// editor: W1 was a single keystroke rewriting a page without its tables,
// styled boxes and linked images.

const KEPT: [string, string][] = [
  ["table with head, styles and rowspan", '<table style="width: 100%; border-collapse: collapse"><thead><tr style="border-bottom: 2px solid #444"><th style="text-align: left; padding: 8px">Portal</th><th>Seal</th></tr></thead><tbody><tr><td rowspan="2" style="padding: 8px">Amber</td><td>Blood</td></tr><tr><td>Bone</td></tr></tbody></table>'],
  ["styled box holding text", '<div style="background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 12px 16px; margin: 16px 0; border-radius: 4px"><strong>DM Note:</strong> In combat <em>only</em>.</div>'],
  ["box holding blocks, with class and data attributes", '<div class="wiki-translator" data-script="runic"><p>One</p><p>Two</p></div>'],
  ["styled quote holding text", '<blockquote style="background: rgba(180, 140, 60, 0.1); font-style: italic">The dreams come every night now.<br>A city of white stone.</blockquote>'],
  ["quote holding paragraphs", "<blockquote><p>We were not born, we were made.</p><p>Shaped by silence.</p></blockquote>"],
  ["linked image in a paragraph", '<p><a href="/uploads/a.webp" rel="noopener" target="_blank"><img alt="A" src="/uploads/a.webp"></a></p>'],
  ["bold link, both nestings", '<p><strong><a href="/wiki#x">X</a></strong> and <a href="/wiki#y"><strong>Y</strong></a></p>'],
  ["internal link stays in the same tab", '<p><a href="/wiki/lore/page">Page</a></p>'],
  ["all heading levels, styled", '<h1>One</h1><h3 style="margin-top: 0">Three</h3><h5>Five</h5>'],
  ["list item text before its sub-list", "<ul><li><strong>The south</strong> is shared: <ul><li>Arfalia</li></ul></li></ul>"],
  ["styled list", '<ul style="margin: 4px 0"><li>One</li><li>Two</li></ul>'],
  ["spaces around line breaks", "<p>Line one<br> line two</p>"],
  ["GM spoiler block", '<div class="spoiler" data-label="GM Only"><p>The duke is the traitor.</p></div>'],
  ["rule and plain paragraphs", "<p>Before</p><hr><p>After</p>"],
];

describe("the editor keeps the wiki's pages", () => {
  it.each(KEPT)("%s", (_name, html) => {
    expect(canonicalHtml(editorRoundTrip(html))).toBe(canonicalHtml(html));
    expect(editorKeepsPage(html)).toBe(true);
  });

  it("an empty page is kept", () => {
    expect(editorKeepsPage("")).toBe(true);
  });

  it("finds a page it cannot keep: text and blocks mixed in one box", () => {
    expect(editorKeepsPage("<div><h3>The Void</h3>Beings older than the Black Sun.</div>")).toBe(false);
  });
});

describe("the comparison still sees real changes", () => {
  const differs = (a: string, b: string) => expect(canonicalHtml(a)).not.toBe(canonicalHtml(b));

  it("a lost style, class, attribute or element", () => {
    differs('<p style="color: red">a</p>', "<p>a</p>");
    differs('<div class="spoiler"><p>a</p></div>', "<div><p>a</p></div>");
    differs('<table><tr><td rowspan="2">a</td></tr></table>', "<table><tr><td>a</td></tr></table>");
    differs("<table><tr><td>a</td></tr></table>", "<p>a</p>");
    differs('<p><a href="/x"><img src="/i.webp"></a></p>', '<p><img src="/i.webp"></p>');
  });

  it("an added paragraph where it would show", () => {
    differs('<div style="padding: 8px">text</div>', '<div style="padding: 8px"><p>text</p></div>');
    differs("<table><tr><td>a<br>b</td></tr></table>", "<table><tr><td><p>a</p><p>b</p></td></tr></table>");
  });

  it("changed text", () => {
    differs("<p>The duke</p>", "<p>The duchess</p>");
  });
});

describe("saving after an edit", () => {
  it("adds nothing after a closing table or box", () => {
    const editor = new Editor({ extensions: wikiExtensions(), content: '<p>a</p><div style="padding: 8px">box</div>' });
    // The first edit lets the editor add its empty paragraph to type in.
    editor.commands.setTextSelection(2);
    editor.commands.insertContent("b");
    const html = editorHtml(editor);
    editor.destroy();
    expect(canonicalHtml(html)).toBe(canonicalHtml('<p>ab</p><div style="padding: 8px">box</div>'));
  });
});

describe("attributes the editor keeps", () => {
  it("drops event handlers and other attributes from boxes and quotes, keeps class, style and data-*", () => {
    const out = editorRoundTrip(
      '<div class="spoiler" data-label="GM Only" style="padding: 8px" onmouseover="alert(1)" onclick="alert(2)"><p>a</p></div>' +
        '<blockquote style="color: red" onfocus="alert(3)" formaction="/x">b</blockquote>' +
        '<div data-script="runic" ONLOAD="alert(4)">c</div>',
    );
    expect(out).not.toMatch(/on(mouseover|click|focus|load)|alert|formaction/i);
    expect(out).toContain('class="spoiler"');
    expect(out).toContain('data-label="GM Only"');
    expect(out).toContain('data-script="runic"');
    expect(out).toMatch(/<blockquote style="color: red;?">/);
  });
});

describe("the spoiler button", () => {
  function editorWith(html: string): Editor {
    return new Editor({ extensions: wikiExtensions(), content: html });
  }

  it("wraps the selected blocks in a GM spoiler block, and the public view empties it", () => {
    const editor = editorWith("<p>Open.</p><p>The duke is the traitor.</p>");
    // Select inside the second paragraph.
    editor.commands.setTextSelection(10);
    editor.commands.toggleSpoiler();
    const html = editorHtml(editor);
    editor.destroy();
    expect(html).toContain('<div class="spoiler" data-label="GM Only"><p>The duke is the traitor.</p></div>');
    expect(html).toContain("<p>Open.</p>");
    const publicHtml = stripSpoilerContent(html);
    expect(publicHtml).not.toContain("traitor");
    expect(publicHtml).toContain("Open.");
  });

  it("unwraps when used inside a spoiler block", () => {
    const editor = editorWith('<div class="spoiler" data-label="GM Only"><p>Secret.</p></div>');
    editor.commands.setTextSelection(3);
    editor.commands.toggleSpoiler();
    const html = editorHtml(editor);
    editor.destroy();
    expect(html).toBe("<p>Secret.</p>");
  });
});
