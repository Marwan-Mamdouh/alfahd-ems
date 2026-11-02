import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ipAddresses, routerStatusHistory } from './index.js';

describe('routerStatusHistory schema and database constraints', () => {
  it('defines the routerStatusHistory table with required audit columns', () => {
    const config = getTableConfig(routerStatusHistory);

    expect(config.name).toBe('router_status_history');
    const columnNames = config.columns.map((c) => c.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('router_id');
    expect(columnNames).toContain('from_status');
    expect(columnNames).toContain('to_status');
    expect(columnNames).toContain('reason');
    expect(columnNames).toContain('changed_by');
    expect(columnNames).toContain('created_at');
  });

  it('declares router_status_history in migration 0005_m2b_supply_routers_ip.sql', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../drizzle/0005_m2b_supply_routers_ip.sql',
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    expect(sqlContent).toContain('CREATE TABLE "router_status_history"');
    expect(sqlContent).toContain('"from_status" "router_status" NOT NULL');
    expect(sqlContent).toContain('"to_status" "router_status" NOT NULL');
    expect(sqlContent).toContain('"reason" text NOT NULL');
    expect(sqlContent).toContain('"changed_by" uuid NOT NULL');
  });

  it('records router_status_history in 0005_snapshot.json', () => {
    const snapshotPath = path.resolve(__dirname, '../../../drizzle/meta/0005_snapshot.json');
    const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const statusTable = snapshotJson.tables['public.router_status_history'];

    expect(statusTable).toBeDefined();
    expect(statusTable.columns.from_status).toBeDefined();
    expect(statusTable.columns.to_status).toBeDefined();
    expect(statusTable.columns.reason).toBeDefined();
    expect(statusTable.columns.changed_by).toBeDefined();
  });
});

describe('ipAddresses schema and database constraints', () => {
  it('defines the ip_addresses_ipv4_host_check and ip_addresses_not_archived_reserved_check constraints on ipAddresses table', () => {
    const config = getTableConfig(ipAddresses);

    expect(config.checks).toBeDefined();
    const hostCheck = config.checks.find((c) => c.name === 'ip_addresses_ipv4_host_check');
    expect(hostCheck).toBeDefined();

    const notArchivedReservedCheck = config.checks.find(
      (c) => c.name === 'ip_addresses_not_archived_reserved_check',
    );
    expect(notArchivedReservedCheck).toBeDefined();
  });

  it('enforces IPv4 host-only INET values and no archived RESERVED in migration 0005_m2b_supply_routers_ip.sql', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../drizzle/0005_m2b_supply_routers_ip.sql',
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    expect(sqlContent).toContain(
      'CONSTRAINT "ip_addresses_ipv4_host_check" CHECK (family("ip_addresses"."address") = 4 AND masklen("ip_addresses"."address") = 32)',
    );
    expect(sqlContent).toContain('CONSTRAINT "ip_addresses_address_unique" UNIQUE("address")');
    expect(sqlContent).toContain(
      'CONSTRAINT "ip_addresses_not_archived_reserved_check" CHECK (NOT ("ip_addresses"."is_archived" = true AND "ip_addresses"."status" = \'RESERVED\'))',
    );
  });

  it('records ip_addresses_ipv4_host_check and ip_addresses_not_archived_reserved_check in 0005_snapshot.json', () => {
    const snapshotPath = path.resolve(__dirname, '../../../drizzle/meta/0005_snapshot.json');
    const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const ipTable = snapshotJson.tables['public.ip_addresses'];

    expect(ipTable).toBeDefined();
    expect(ipTable.checkConstraints).toBeDefined();
    expect(ipTable.checkConstraints.ip_addresses_ipv4_host_check).toBeDefined();
    expect(ipTable.checkConstraints.ip_addresses_ipv4_host_check.value).toBe(
      'family("ip_addresses"."address") = 4 AND masklen("ip_addresses"."address") = 32',
    );
    expect(ipTable.checkConstraints.ip_addresses_not_archived_reserved_check).toBeDefined();
    expect(ipTable.checkConstraints.ip_addresses_not_archived_reserved_check.value).toBe(
      'NOT ("ip_addresses"."is_archived" = true AND "ip_addresses"."status" = \'RESERVED\')',
    );
  });
});
