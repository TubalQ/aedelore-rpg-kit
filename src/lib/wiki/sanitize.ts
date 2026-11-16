import DOMPurify from "isomorphic-dompurify";

// W6: wiki HTML went through DOMPurify's defaults, which keep <style> (rules
// for the whole page), form controls (a fake sign-in form) and any inline
// style, including position:fixed (a layer over the whole page). Only admins
// write the wiki, but its pages are public. The wiki content uses none of the
// forbidden tags; it does use position:relative/absolute for its timelines,
// so only fixed and sticky are taken out.
const FORBID_TAGS = ["style", "form", "input", "button", "textarea", "select", "option"];
const PAGE_LEVEL_POSITION = /position\s*:\s*(fixed|sticky)\s*(!important)?\s*;?/gi;

export function sanitizeWikiHtml(html: string): string {
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") data.attrValue = data.attrValue.replace(PAGE_LEVEL_POSITION, "");
  });
  try {
    return DOMPurify.sanitize(html, { FORBID_TAGS });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}
