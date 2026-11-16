CREATE TABLE "campaign_bans" (
	"campaign_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"banned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_bans_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "password_reset_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "locks_dm_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_bans" ADD CONSTRAINT "campaign_bans_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_bans" ADD CONSTRAINT "campaign_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_bans_user_id" ON "campaign_bans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_characters_campaign_name_live" ON "characters" USING btree ("campaign_id",lower(btrim("name"))) WHERE "characters"."deleted_at" IS NULL AND "characters"."campaign_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_sessions_campaign_number_live" ON "game_sessions" USING btree ("campaign_id","session_number") WHERE "game_sessions"."deleted_at" IS NULL;--> statement-breakpoint
-- Live updates (#82): deploy/sql/20261115-change-notify.sql, not modelled by Drizzle.
CREATE OR REPLACE FUNCTION aedelore_notify_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  col text := TG_ARGV[0];
  old_c text;
  new_c text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_c := to_jsonb(OLD) ->> col; END IF;
  IF TG_OP <> 'DELETE' THEN new_c := to_jsonb(NEW) ->> col; END IF;
  IF new_c IS NOT NULL THEN
    PERFORM pg_notify('aedelore_changes', json_build_object('t', TG_TABLE_NAME, 'c', new_c::int)::text);
  END IF;
  -- A row that moved out of a campaign (a character leaving) tells the old one too.
  IF old_c IS NOT NULL AND old_c IS DISTINCT FROM new_c THEN
    PERFORM pg_notify('aedelore_changes', json_build_object('t', TG_TABLE_NAME, 'c', old_c::int)::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON game_sessions;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('campaign_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON characters;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON characters
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('campaign_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON campaign_players;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON campaign_players
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('campaign_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON campaign_items;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON campaign_items
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('campaign_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON campaign_bans;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON campaign_bans
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('campaign_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS aedelore_notify ON campaigns;
--> statement-breakpoint
CREATE TRIGGER aedelore_notify AFTER INSERT OR UPDATE OR DELETE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION aedelore_notify_change('id');
