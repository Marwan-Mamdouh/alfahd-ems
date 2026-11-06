-- Synthetic fixture for a disposable database migrated through 0005 only.
INSERT INTO warehouses (id, name, is_active) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Active synthetic hub', true),
  ('20000000-0000-4000-8000-000000000002', 'Inactive synthetic hub', false);
INSERT INTO users (id, name, email, password_hash, role, assigned_warehouse_id) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Synthetic admin', 'migration-admin@example.invalid', 'synthetic', 'ADMIN', NULL),
  ('30000000-0000-4000-8000-000000000002', 'Synthetic technician', 'migration-tech@example.invalid', 'synthetic', 'TECHNICIAN', '20000000-0000-4000-8000-000000000001');
INSERT INTO products (id, name, sku, model, category) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Serialized synthetic device', 'MIG-SERIAL', 'M1', 'Hardware'),
  ('10000000-0000-4000-8000-000000000002', 'Ordinary synthetic stock', 'MIG-ORDINARY', 'M2', 'Cable');
INSERT INTO warehouse_inventory (product_id, warehouse_id, quantity) VALUES
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 12);
INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, responsible_user_id, notes) VALUES
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'INBOUND_SUPPLIER', 1, '30000000-0000-4000-8000-000000000001', 'synthetic receipt'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'INBOUND_SUPPLIER', 12, '30000000-0000-4000-8000-000000000001', 'synthetic cable');
INSERT INTO routers (id, product_id, warehouse_id, serial_number, status, physical_condition) VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MIG-ROUTER-1', 'AVAILABLE', 'SERVICEABLE'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MIG-ROUTER-2', 'AVAILABLE', 'DAMAGED');
INSERT INTO router_assignments (router_id, holder_type, warehouse_id, assigned_by, notes) VALUES
  ('40000000-0000-4000-8000-000000000001', 'WAREHOUSE', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'synthetic custody');
INSERT INTO router_condition_history (router_id, from_condition, to_condition, from_warehouse_id, to_warehouse_id, reason, changed_by) VALUES
  ('40000000-0000-4000-8000-000000000002', 'SERVICEABLE', 'DAMAGED', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'synthetic damage', '30000000-0000-4000-8000-000000000001');
INSERT INTO ip_addresses (id, address, status, is_archived, notes) VALUES
  ('50000000-0000-4000-8000-000000000001', '192.0.2.10', 'RESERVED', false, 'synthetic reserved'),
  ('50000000-0000-4000-8000-000000000002', '192.0.2.11', 'FREE', true, 'synthetic archived');
INSERT INTO ip_history (ip_id, from_status, to_status, action, actor_id, reason) VALUES
  ('50000000-0000-4000-8000-000000000001', 'FREE', 'RESERVED', 'RESERVE', '30000000-0000-4000-8000-000000000001', 'synthetic reservation');
