import DOMPurify from "isomorphic-dompurify";

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

// Tar bort innehållet i .spoiler-block server-side så att GM-only-text aldrig
// når obehöriga klienter. Kvar blir ett tomt block med data-locked="1" som
// WikiContent renderar som en låst, icke-klickbar platshållare.
export function stripSpoilerContent(html: string): string {
  DOMPurify.addHook("uponSanitizeElement", (node) => {
    if (isElement(node) && node.classList.contains("spoiler")) {
      node.innerHTML = "";
      node.setAttribute("data-locked", "1");
    }
  });
  try {
    return DOMPurify.sanitize(html);
  } finally {
    DOMPurify.removeHook("uponSanitizeElement");
  }
}
