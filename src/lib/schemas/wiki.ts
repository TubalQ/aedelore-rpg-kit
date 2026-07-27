import { z } from "zod";

export const WikiBookSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverImage: z.string().nullable(),
  sortOrder: z.number(),
});

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

export const WikiSearchParamsSchema = z.object({
  q: z.string().min(1).max(200),
  bookId: z.coerce.number().int().positive().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type WikiBook = z.infer<typeof WikiBookSchema>;
export type WikiChapter = z.infer<typeof WikiChapterSchema>;
export type WikiPageSummary = z.infer<typeof WikiPageSummarySchema>;
export type WikiPage = z.infer<typeof WikiPageSchema>;
export type WikiSearchParams = z.infer<typeof WikiSearchParamsSchema>;

// --- Admin CRUD schemas ---

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  authorNote: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateBookSchema = CreateBookSchema.partial().omit({ slug: true });

export const CreateChapterSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).nullable().optional(),
  authorNote: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateChapterSchema = CreateChapterSchema.partial().omit({ slug: true, bookId: true });

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

export const UpdatePageSchema = CreatePageSchema.partial().omit({ slug: true, bookId: true });

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
