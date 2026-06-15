ALTER TABLE "card" ADD COLUMN "parentCardId" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card" ADD CONSTRAINT "card_parentCardId_card_id_fk" FOREIGN KEY ("parentCardId") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_parent_idx" ON "card" USING btree ("parentCardId");