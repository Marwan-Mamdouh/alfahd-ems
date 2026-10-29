CREATE TYPE "public"."ip_history_action" AS ENUM('CREATE', 'RESERVE', 'RELEASE', 'ARCHIVE', 'UNARCHIVE', 'UPDATE_METADATA');--> statement-breakpoint
CREATE TYPE "public"."ip_status" AS ENUM('FREE', 'RESERVED');--> statement-breakpoint
CREATE TYPE "public"."router_holder_type" AS ENUM('WAREHOUSE', 'TECHNICIAN', 'CUSTOMER');--> statement-breakpoint
CREATE TYPE "public"."router_physical_condition" AS ENUM('SERVICEABLE', 'DAMAGED', 'UNDER_REPAIR');--> statement-breakpoint
CREATE TYPE "public"."router_status" AS ENUM('AVAILABLE', 'ASSIGNED_TO_TECHNICIAN', 'INSTALLED_AT_CUSTOMER', 'RETURNED', 'DAMAGED', 'UNDER_REPAIR', 'LOST', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TABLE "ip_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" "inet" NOT NULL,
	"status" "ip_status" DEFAULT 'FREE' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"customer_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ip_addresses_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "ip_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_id" uuid NOT NULL,
	"from_status" "ip_status" NOT NULL,
	"to_status" "ip_status" NOT NULL,
	"action" "ip_history_action" NOT NULL,
	"reason" text,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"router_id" uuid NOT NULL,
	"holder_type" "router_holder_type" NOT NULL,
	"warehouse_id" uuid,
	"technician_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"assigned_by" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "router_condition_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"router_id" uuid NOT NULL,
	"from_condition" "router_physical_condition" NOT NULL,
	"to_condition" "router_physical_condition" NOT NULL,
	"from_warehouse_id" uuid,
	"to_warehouse_id" uuid,
	"external_location" varchar(255),
	"reason" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "router_status" DEFAULT 'AVAILABLE' NOT NULL,
	"physical_condition" "router_physical_condition" DEFAULT 'SERVICEABLE' NOT NULL,
	"warehouse_id" uuid,
	"external_location" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routers_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
ALTER TABLE "ip_history" ADD CONSTRAINT "ip_history_ip_id_ip_addresses_id_fk" FOREIGN KEY ("ip_id") REFERENCES "public"."ip_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_history" ADD CONSTRAINT "ip_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_assignments" ADD CONSTRAINT "router_assignments_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_assignments" ADD CONSTRAINT "router_assignments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_assignments" ADD CONSTRAINT "router_assignments_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_assignments" ADD CONSTRAINT "router_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_condition_history" ADD CONSTRAINT "router_condition_history_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_condition_history" ADD CONSTRAINT "router_condition_history_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_condition_history" ADD CONSTRAINT "router_condition_history_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_condition_history" ADD CONSTRAINT "router_condition_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routers" ADD CONSTRAINT "routers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routers" ADD CONSTRAINT "routers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ip_addresses_status" ON "ip_addresses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ip_addresses_is_archived" ON "ip_addresses" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "idx_ip_history_ip" ON "ip_history" USING btree ("ip_id");--> statement-breakpoint
CREATE INDEX "idx_ip_history_actor" ON "ip_history" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_router_assignments_router" ON "router_assignments" USING btree ("router_id");--> statement-breakpoint
CREATE INDEX "idx_router_assignments_technician" ON "router_assignments" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_router_assignments_warehouse" ON "router_assignments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_router_active_assignment" ON "router_assignments" USING btree ("router_id") WHERE "router_assignments"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_router_condition_history_router" ON "router_condition_history" USING btree ("router_id");--> statement-breakpoint
CREATE INDEX "idx_routers_warehouse" ON "routers" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_routers_product" ON "routers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_routers_status" ON "routers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_routers_physical_condition" ON "routers" USING btree ("physical_condition");