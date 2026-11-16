import { z } from "zod";

export const WikiBookSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverImage: z.string().nullable(),
  sortOrder: z.number(),
});

// The admin view of a book also carries the private author note.
export const AdminWikiBookSchema = WikiBookSchema.extend({ authorNote: z.string().nullable() });
export type AdminWikiBook = z.infer<typeof AdminWikiBookSchema>;

export const WikiChapterSchema = z.object({
  id: z.number(),
  bookId: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
});

export const WikiPageSummarySchema = z.object({
  id: z.number(),
  bookId: z.number(),
  chapterId: z.number().nullable(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  sortOrder: z.number(),
});

export const WikiPageSchema = WikiPageSummarySchema.extend({
  content: z.string().nullable(),
  authorNote: z.string().nullable(),
  viewCount: z.number(),
});

// W10: a NUL byte made Postgres fail (22021) and a bookId past int4 overflowed,
// both as a 500. Refused here, so the search answers 400 / no results.
const NUL = String.fromCharCode(0);
const searchText = (max: number) => z.string().max(max).refine((s) => !s.includes(NUL), "Invalid character");
const PG_INT_MAX = 2_147_483_647;

export const WikiSearchParamsSchema = z.object({
  q: searchText(200).pipe(z.string().min(1)),
  bookId: z.coerce.number().int().positive().max(PG_INT_MAX).optional(),
  tag: searchText(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type WikiBook = z.infer<typeof WikiBookSchema>;
export type WikiChapter = z.infer<typeof WikiChapterSchema>;
export type WikiPageSummary = z.infer<typeof WikiPageSummarySchema>;
export type WikiPage = z.infer<typeof WikiPageSchema>;
export type WikiSearchParams = z.infer<typeof WikiSearchParamsSchema>;

// --- Admin CRUD schemas ---

// /wiki/search is the search page, so a book there could never be reached (W15).
const RESERVED_BOOK_SLUGS = ["search"];

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .refine((s) => !RESERVED_BOOK_SLUGS.includes(s), { message: "This address is reserved for the wiki search" }),
  description: z.string().max(2000).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  authorNote: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

// `.partial()` re-applies the `.default(0)` from sortOrder, so a PATCH that omits
// it would reset the row to 0 (Rule 11). Override to a no-default optional so an
// absent sortOrder stays `undefined` and Drizzle leaves the column untouched.
export const UpdateBookSchema = CreateBookSchema.partial()
  .omit({ slug: true })
  .extend({ sortOrder: z.number().int().min(0).optional() });

export const CreateChapterSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).nullable().optional(),
  authorNote: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateChapterSchema = CreateChapterSchema.partial()
  .omit({ slug: true, bookId: true })
  .extend({ sortOrder: z.number().int().min(0).optional() });

export const CreatePageSchema = z.object({
  bookId: z.number().int().positive(),
  chapterId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
  authorNote: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdatePageSchema = CreatePageSchema.partial()
  .omit({ slug: true, bookId: true })
  .extend({ sortOrder: z.number().int().min(0).optional() });

export const BulkImportPageSchema = z.object({
  bookId: z.number().int().positive(),
  chapterId: z.number().int().positive().nullable().optional(),
  pages: z.array(z.object({
    title: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
    content: z.string().nullable().optional(),
    summary: z.string().max(1000).nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })).min(1).max(100),
});

export type CreateBook = z.infer<typeof CreateBookSchema>;
export type UpdateBook = z.infer<typeof UpdateBookSchema>;
export type CreateChapter = z.infer<typeof CreateChapterSchema>;
export type UpdateChapter = z.infer<typeof UpdateChapterSchema>;
export type CreatePage = z.infer<typeof CreatePageSchema>;
export type UpdatePage = z.infer<typeof UpdatePageSchema>;
export type BulkImportPage = z.infer<typeof BulkImportPageSchema>;
