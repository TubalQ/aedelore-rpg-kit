/**
 * W3: 24 wiki pages carry about 392 links from v1, href="/wiki#book/page",
 * which v2 serves at /wiki/book/page; they all landed on the wiki index. The
 * slugs are the same, so the link is rewritten when the page is rendered and
 * the stored content stays as written (a link to a whole book, "/wiki#book",
 * becomes "/wiki/book").
 */
const LEGACY_WIKI_HREF = /href=(["'])\/wiki#([a-z0-9-]+(?:\/[a-z0-9-]+)?)\1/gi;

export function rewriteLegacyWikiLinks(html: string): string {
  return html.replace(LEGACY_WIKI_HREF, (_m, quote: string, path: string) => `href=${quote}/wiki/${path}${quote}`);
}
