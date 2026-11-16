CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"share_code" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "campaigns_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" integer,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_spent" integer DEFAULT 0 NOT NULL,
	"race_class_locked" boolean DEFAULT false NOT NULL,
	"attributes_locked" boolean DEFAULT false NOT NULL,
	"abilities_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "frontend_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"error_type" varchar(50),
	"message" text,
	"stack" text,
	"url" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"session_number" integer NOT NULL,
	"title" text DEFAULT '',
	"date" text,
	"location" text,
	"game_location" text,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "login_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"method" varchar(20) DEFAULT 'oidc',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"system" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ui_text" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"username" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"oidc_sub" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "wiki_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image" text,
	"author_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "wiki_books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "wiki_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"author_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"chapter_id" integer,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"summary" text,
	"author_note" text,
	"tags" text[],
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B') || setweight(to_tsvector('english', coalesce(regexp_replace(content, '<[^>]+>', ' ', 'g'), '')), 'C')) STORED
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frontend_errors" ADD CONSTRAINT "frontend_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_chapters" ADD CONSTRAINT "wiki_chapters_book_id_wiki_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."wiki_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_book_id_wiki_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."wiki_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_chapter_id_wiki_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."wiki_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_items_campaign_id" ON "campaign_items" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_players_unique" ON "campaign_players" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_players_campaign_id" ON "campaign_players" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_players_user_id" ON "campaign_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_user_id" ON "campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_characters_user_id" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_characters_campaign_id" ON "characters" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_frontend_errors_created" ON "frontend_errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_game_sessions_campaign_id" ON "game_sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_game_sessions_user_id" ON "game_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_history_user_id" ON "login_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_history_created" ON "login_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_system_data_system_kind" ON "system_data" USING btree ("system","kind");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_oidc_sub" ON "users" USING btree ("oidc_sub");--> statement-breakpoint
CREATE INDEX "idx_wiki_books_deleted" ON "wiki_books" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_chapters_book_slug" ON "wiki_chapters" USING btree ("book_id","slug");--> statement-breakpoint
CREATE INDEX "idx_wiki_chapters_book" ON "wiki_chapters" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_wiki_chapters_deleted" ON "wiki_chapters" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_pages_book_slug" ON "wiki_pages" USING btree ("book_id","slug");--> statement-breakpoint
CREATE INDEX "idx_wiki_pages_book" ON "wiki_pages" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_wiki_pages_chapter" ON "wiki_pages" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "idx_wiki_pages_deleted" ON "wiki_pages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_wiki_pages_search" ON "wiki_pages" USING gin ("search_vector");