ALTER TABLE "products" ADD COLUMN "is_serialized" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "products" SET "is_serialized" = true WHERE EXISTS (SELECT 1 FROM "routers" WHERE "routers"."product_id" = "products"."id");
