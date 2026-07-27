import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as wikiApi from "../api/wiki.js";
import { safeTool } from "./safe-tool.js";
import { text, asArray, asRecord } from "./helpers.js";

export function registerWikiTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "search_wiki",
    "Search the Aedelore wiki for pages matching a query. Optionally filter by book or tag.",
    {
      query: z.string().describe("Search query"),
      book_id: z.number().optional().describe("Filter by book ID"),
      tag: z.string().optional().describe("Filter by tag"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 10)"),
    },
    async ({ query, book_id, tag, limit }) => {
      const results = asArray(await wikiApi.searchWiki(client, query as string, {
        bookId: book_id as number | undefined,
        tag: tag as string | undefined,
        limit: (limit as number | undefined) || 10,
      }));

      if (!results || results.length === 0) {
        return text(`No wiki results for "${query}".`);
      }

      // Sök returnerar metadata (title, summary, slug, tags) - inte content. Visa summary
      // som utdrag; för full brödtext används read_wiki_page / get_world_lore.
      let output = `# Wiki Search: "${query}" (${results.length} results)\n\n`;
      for (const page of results) {
        output += `**${page.title || page.name || "Untitled"}**`;
        if (page.slug) output += ` [${page.slug}]`;
        output += "\n";

        if (page.tags && Array.isArray(page.tags) && page.tags.length > 0) {
          output += `Tags: ${page.tags.join(", ")}\n`;
        }

        if (page.summary) {
          const s = String(page.summary);
          output += (s.length > 500 ? s.substring(0, 500) + "..." : s) + "\n";
        }
        output += "\n";
      }

      return text(output.trim());
    },
  );

  safeTool(
    server,
    "browse_wiki",
    "Browse the Aedelore wiki. Lists all books, or chapters/pages within a book.",
    {
      book_id: z
        .number()
        .optional()
        .describe("Book ID to browse. Omit to list all books."),
    },
    async ({ book_id }) => {
      const books = asArray(await wikiApi.listBooks(client));

      if (!books || books.length === 0) {
        return text("The wiki has no books.");
      }

      if (book_id === undefined) {
        let output = `# Wiki Books (${books.length})\n\n`;
        for (const book of books) {
          output += `**${book.name || book.title}** (ID: ${book.id})`;
          if (book.slug) output += ` [${book.slug}]`;
          if (book.description) output += `\n  ${book.description}`;
          const chapters = book.chapters as Array<Record<string, unknown>> | undefined;
          if (chapters?.length) {
            output += `\n  Chapters: ${chapters.length}`;
          }
          output += "\n\n";
        }
        return text(output.trim());
      }

      // Drill-down: hämta bokträdet (kapitel + sidor) via slug - listBooks ger ingen
      // nästlad struktur, så vi anropar den nya /api/wiki/books/[slug]-endpointen.
      const bookMeta = books.find((b) => Number(b.id) === book_id);
      if (!bookMeta) {
        return text(
          `Book ID ${book_id} not found. Available books: ${books.map((b) => `${b.title || b.name} (ID: ${b.id})`).join(", ")}`,
        );
      }
      const book = asRecord(await wikiApi.getBook(client, String(bookMeta.slug)));
      const chapters = asArray(book.chapters ?? []);
      const pages = asArray(book.pages ?? []);
      const bookSlug = String(book.slug ?? bookMeta.slug);

      let output = `# ${book.title || book.name || bookMeta.title}\n`;
      if (book.description) output += `${book.description}\n`;
      output += "\n";

      const renderPage = (page: Record<string, unknown>): string => {
        let line = `  - ${page.title || page.name || "Untitled"}`;
        if (page.slug) line += ` [${bookSlug}/${page.slug}]`;
        return line + "\n";
      };

      if (chapters.length === 0) {
        output += pages.length === 0 ? "No pages in this book.\n" : pages.map(renderPage).join("");
      } else {
        for (const chapter of chapters) {
          output += `## ${chapter.title || chapter.name}\n`;
          output += pages
            .filter((p) => Number(p.chapterId) === Number(chapter.id))
            .map(renderPage)
            .join("");
          output += "\n";
        }
        const orphans = pages.filter((p) => p.chapterId == null);
        if (orphans.length) {
          output += `## (Uncategorized)\n` + orphans.map(renderPage).join("");
        }
      }

      return text(output.trim());
    },
  );

  safeTool(
    server,
    "read_wiki_page",
    "Read a specific wiki page by book slug and page slug",
    {
      book_slug: z.string().describe("Book slug (e.g. 'bestiary')"),
      page_slug: z.string().describe("Page slug (e.g. 'grottvaektare')"),
    },
    async ({ book_slug, page_slug }) => {
      const bSlug = book_slug as string;
      const pSlug = page_slug as string;

      // Hämta sidan direkt (med brödtext) via den publika slug-endpointen.
      let page: Record<string, unknown>;
      try {
        page = asRecord(await wikiApi.getPageBySlug(client, bSlug, pSlug));
      } catch {
        return text(`Page "${pSlug}" not found in book "${bSlug}".`);
      }

      let output = `# ${page.title || page.name || "Untitled"}\n`;
      if (page.tags && Array.isArray(page.tags) && page.tags.length > 0) {
        output += `Tags: ${page.tags.join(", ")}\n`;
      }
      output += "\n";
      output += page.content ? String(page.content) : "(No content)";

      return text(output.trim());
    },
  );
}
