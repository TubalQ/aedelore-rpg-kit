/**
 * JSON for embedding in an inline <script> (W7). JSON.stringify leaves "<",
 * ">" and "&" alone, so a value such as `</script><script>...` closes the tag
 * and runs as code; the line and paragraph separators (U+2028, U+2029) end a
 * line in older parsers. All are escaped as a JSON unicode escape, which JSON
 * and JavaScript read back unchanged.
 */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${LINE_SEP}${PARA_SEP}]`, "g");

export function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
