import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText } from "./helpers.js";

test("wiki HTML becomes plain text with headings, bold, lists and table rows", () => {
  const html =
    '<h3>Combat</h3><p><strong>Roll:</strong> 1D20 &amp; <a href="/wiki#x">bonus</a></p><ul><li>one</li><li>two</li></ul><table><tr><td>1-2</td><td>+1</td></tr></table>';
  const out = htmlToText(html);
  assert.match(out, /^#### Combat/);
  assert.match(out, /\*\*Roll:\*\* 1D20 & bonus/);
  assert.match(out, /- one\n- two/);
  assert.match(out, /1-2 \| \+1/);
  assert.doesNotMatch(out, /<|href/);
});

test("paragraphs inside table cells keep the row on one line", () => {
  const out = htmlToText("<table><tr><td><p>1-2</p></td><td><p>+1</p></td></tr><tr><td><p>3-4</p></td><td><p>+2</p></td></tr></table>");
  assert.equal(out, "1-2 | +1\n3-4 | +2");
});

test("plain text passes through unchanged", () => {
  assert.equal(htmlToText("  Just words.  "), "Just words.");
});


// M11: a name saved with a stray space is still found.
test("findByKey matches names with leading or trailing spaces", async () => {
  const { findByKey } = await import("./helpers.js");
  const { i } = findByKey([{ name: "Kvarnen " }, { name: "Bron" }], " Kvarnen", { kind: "place" });
  assert.equal(i, 0);
});
