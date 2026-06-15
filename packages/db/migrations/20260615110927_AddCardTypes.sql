CREATE TABLE IF NOT EXISTS "card_type" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"name" varchar(255) NOT NULL,
	"colourCode" varchar(12),
	"icon" varchar(50),
	"workspaceId" bigint NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"deletedAt" timestamp,
	"deletedBy" uuid,
	CONSTRAINT "card_type_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "card_type" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "cardTypeId" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_type" ADD CONSTRAINT "card_type_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_type" ADD CONSTRAINT "card_type_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_type" ADD CONSTRAINT "card_type_deletedBy_user_id_fk" FOREIGN KEY ("deletedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_type_workspace_idx" ON "card_type" USING btree ("workspaceId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card" ADD CONSTRAINT "card_cardTypeId_card_type_id_fk" FOREIGN KEY ("cardTypeId") REFERENCES "public"."card_type"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
