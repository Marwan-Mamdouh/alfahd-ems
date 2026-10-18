CREATE TYPE "public"."attendance_status" AS ENUM('ON_TIME', 'LATE');--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('TECHNICAL', 'CUSTOMER_SERVICE', 'WAREHOUSE', 'MANAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'ON_LEAVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_in_lat" double precision NOT NULL,
	"check_in_lng" double precision NOT NULL,
	"check_in_distance_m" double precision NOT NULL,
	"check_out_at" timestamp with time zone,
	"status" "attendance_status" NOT NULL,
	"override_reason" text,
	"overridden_by" uuid,
	"overridden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_user_id_work_date_unique" UNIQUE("user_id","work_date"),
	CONSTRAINT "check_in_lat_range" CHECK ("attendance_records"."check_in_lat" >= -90 AND "attendance_records"."check_in_lat" <= 90),
	CONSTRAINT "check_in_lng_range" CHECK ("attendance_records"."check_in_lng" >= -180 AND "attendance_records"."check_in_lng" <= 180)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" "department";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_id" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hire_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_photo_key" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assigned_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "address" varchar(255);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "gps_lat" double precision;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "gps_lng" double precision;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_warehouse_id_warehouses_id_fk" FOREIGN KEY ("assigned_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;