-- Run after applying the remaining migrations to pre-0006-representative.sql.
DO $$
BEGIN
  IF (SELECT count(*) FROM warehouses WHERE name LIKE '%synthetic hub') <> 2
    OR (SELECT count(*) FROM users WHERE email LIKE 'migration-%@example.invalid') <> 2
    OR (SELECT count(*) FROM products WHERE sku IN ('MIG-SERIAL', 'MIG-ORDINARY')) <> 2
    OR (SELECT quantity FROM warehouse_inventory WHERE product_id = '10000000-0000-4000-8000-000000000001') IS DISTINCT FROM 1
    OR (SELECT quantity FROM warehouse_inventory WHERE product_id = '10000000-0000-4000-8000-000000000002') IS DISTINCT FROM 12
    OR (SELECT count(*) FROM stock_movements WHERE notes IN ('synthetic receipt', 'synthetic cable')) <> 2
    OR (SELECT count(*) FROM routers WHERE serial_number IN ('MIG-ROUTER-1', 'MIG-ROUTER-2')) <> 2
    OR (SELECT count(*) FROM router_assignments WHERE notes = 'synthetic custody' AND released_at IS NULL) <> 1
    OR (SELECT count(*) FROM router_condition_history WHERE reason = 'synthetic damage') <> 1
    OR (SELECT count(*) FROM ip_addresses WHERE notes IN ('synthetic reserved', 'synthetic archived')) <> 2
    OR (SELECT count(*) FROM ip_history WHERE reason = 'synthetic reservation') <> 1
    OR (SELECT is_serialized FROM products WHERE sku = 'MIG-SERIAL') IS DISTINCT FROM true
    OR (SELECT is_serialized FROM products WHERE sku = 'MIG-ORDINARY') IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'Synthetic pre-migration data or classification was not preserved';
  END IF;
END $$;
