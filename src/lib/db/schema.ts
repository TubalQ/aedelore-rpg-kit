import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  varchar,
  uniqueIndex,
  index,
  primaryKey,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Postgres full-text search vector. Drizzle has no native tsvector type, so we
// declare a minimal custom type; the actual value is always computed by the DB
// (a GENERATED column - see wikiPages.searchVector), never written from JS.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ─── Users (NextAuth-compatible + custom fields) ─────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  username: text("username").unique(),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"),
  oidcSub: text("oidc_sub").unique(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_users_email").on(t.email),
  index("idx_users_oidc_sub").on(t.oidcSub),
]);

// ─── NextAuth Tables ─────────────────────────────────────

export const accounts = pgTable("accounts", {
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [
  primaryKey({ columns: [t.provider, t.providerAccountId] }),
]);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

// ─── Custom Auth Tables ──────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
});

export const loginHistory = pgTable("login_history", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  success: boolean("success").default(true).notNull(),
  method: varchar("method", { length: 20 }).default("oidc"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_login_history_user_id").on(t.userId),
  index("idx_login_history_created").on(t.createdAt),
]);

// ─── Campaigns ───────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  shareCode: varchar("share_code", { length: 8 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_campaigns_user_id").on(t.userId),
]);

// Förråd: DM-författade föremål (quest/equipment) per kampanj, skapade i förväg och
// utdelade till spelare vid behov. En rad per föremål (mall som stannar vid utdelning).
export const campaignItems = pgTable("campaign_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "quest" | "equipment"
  data: jsonb("data").notNull().default({}).$type<Record<string, unknown>>(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_campaign_items_campaign_id").on(t.campaignId),
]);

export const campaignPlayers = pgTable("campaign_players", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_campaign_players_unique").on(t.campaignId, t.userId),
  index("idx_campaign_players_campaign_id").on(t.campaignId),
  index("idx_campaign_players_user_id").on(t.userId),
]);

// ─── Characters ──────────────────────────────────────────

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  xp: integer("xp").default(0).notNull(),
  xpSpent: integer("xp_spent").default(0).notNull(),
  raceClassLocked: boolean("race_class_locked").default(false).notNull(),
  attributesLocked: boolean("attributes_locked").default(false).notNull(),
  abilitiesLocked: boolean("abilities_locked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_characters_user_id").on(t.userId),
  index("idx_characters_campaign_id").on(t.campaignId),
]);

// ─── Game Sessions ───────────────────────────────────────

export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  title: text("title").default(""),
  date: text("date"),
  location: text("location"),
  gameLocation: text("game_location"),
  status: text("status").default("active").notNull(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_game_sessions_campaign_id").on(t.campaignId),
  index("idx_game_sessions_user_id").on(t.userId),
]);

// ─── Wiki ────────────────────────────────────────────────

export const wikiBooks = pgTable("wiki_books", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  authorNote: text("author_note"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_wiki_books_deleted").on(t.deletedAt),
]);

export const wikiChapters = pgTable("wiki_chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => wikiBooks.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  authorNote: text("author_note"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  uniqueIndex("idx_wiki_chapters_book_slug").on(t.bookId, t.slug),
  index("idx_wiki_chapters_book").on(t.bookId),
  index("idx_wiki_chapters_deleted").on(t.deletedAt),
]);

export const wikiPages = pgTable("wiki_pages", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => wikiBooks.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => wikiChapters.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  summary: text("summary"),
  authorNote: text("author_note"),
  tags: text("tags").array(),
  sortOrder: integer("sort_order").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  // Full-text search vector, computed by the DB from title (weight A), summary
  // (B) and de-HTML'd content (C). A GENERATED column replaces the old
  // BEFORE-trigger (wiki_pages_search_trigger): it can never drift, is created
  // by `drizzle-kit push`/`migrate` on fresh installs (fixes #5), and needs no
  // trigger to maintain. `searchPages` (queries/wiki.ts) reads it directly.
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B') || setweight(to_tsvector('english', coalesce(regexp_replace(content, '<[^>]+>', ' ', 'g'), '')), 'C')`,
  ),
}, (t) => [
  uniqueIndex("idx_wiki_pages_book_slug").on(t.bookId, t.slug),
  index("idx_wiki_pages_book").on(t.bookId),
  index("idx_wiki_pages_chapter").on(t.chapterId),
  index("idx_wiki_pages_deleted").on(t.deletedAt),
  index("idx_wiki_pages_search").using("gin", t.searchVector),
]);

// ─── Config-driven game system data (editable in the admin UI) ──
// One row per (system, kind). `data` holds the same JSON shape that
// src/systems/<system>/<kind>.json ships - seeded on first run, then
// editable live in /system-admin. The domain layer reads the active
// system from here (falling back to the bundled JSON when a row is
// missing), so editing races/classes/weapons/... needs no rebuild.
export const systemData = pgTable("system_data", {
  id: serial("id").primaryKey(),
  system: text("system").notNull(),
  // races|classes|religions|weapons|armor|spells|transforms|attributes|theme
  kind: text("kind").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_system_data_system_kind").on(t.system, t.kind),
]);

// ─── Instance settings (app-wide, admin-editable) ──────────
// Singleton row (id = 1). `data` holds { registrationOpen, credentialsEnabled,
// analyticsId }. Moved out of env so a new instance is configured in the browser
// (SSoT = DB). Secrets stay in env; these are non-secret operational toggles.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── UI text overrides (admin-editable, per-locale) ────────
// Singleton row (id = 1). `data` holds { sv: {key: text}, en: {key: text} }:
// per-key overrides layered OVER the code translation dictionaries. Lets an
// operator re-word specific UI strings from the browser without a rebuild. The
// code dictionaries stay authoritative (fallback + key typing); DB overrides
// values only. SSoT: the override value, when present, is the single source.
export const uiText = pgTable("ui_text", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Error Logging ───────────────────────────────────────

export const frontendErrors = pgTable("frontend_errors", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  errorType: varchar("error_type", { length: 50 }),
  message: text("message"),
  stack: text("stack"),
  url: text("url"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_frontend_errors_created").on(t.createdAt),
]);
