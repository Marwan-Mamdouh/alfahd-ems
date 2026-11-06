CREATE TABLE "ip_import_row_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"row_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ip_import_row_outcomes_job_row" ON "ip_import_row_outcomes" USING btree ("job_id","row_number");