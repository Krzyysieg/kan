CREATE TYPE "public"."card_link_type" AS ENUM('blocks', 'relates_to', 'duplicates');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_link" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"sourceCardId" bigint NOT NULL,
	"targetCardId" bigint NOT NULL,
	"type" "card_link_type" NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_link_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "card_link" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_link" ADD CONSTRAINT "card_link_sourceCardId_card_id_fk" FOREIGN KEY ("sourceCardId") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_link" ADD CONSTRAINT "card_link_targetCardId_card_id_fk" FOREIGN KEY ("targetCardId") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_link" ADD CONSTRAINT "card_link_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_link_unique_idx" ON "card_link" USING btree ("sourceCardId","targetCardId","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_link_source_idx" ON "card_link" USING btree ("sourceCardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_link_target_idx" ON "card_link" USING btree ("targetCardId");