import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ipAddresses } from './index.js';

describe('ipAddresses schema and database constraints', () => {
  it('defines the ip_addresses_ipv4_host_check constraint on ipAddresses table', () => {
    const config = getTableConfig(ipAddresses);

    expect(config.checks).toBeDefined();
    const hostCheck = config.checks.find((c) => c.name === 'ip_addresses_ipv4_host_check');
    expect(hostCheck).toBeDefined();
  });

  it('enforces IPv4 host-only INET values in migration 0005_m2b_supply_routers_ip.sql', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../drizzle/0005_m2b_supply_routers_ip.sql',
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    expect(sqlContent).toContain(
      'CONSTRAINT "ip_addresses_ipv4_host_check" CHECK (family("ip_addresses"."address") = 4 AND masklen("ip_addresses"."address") = 32)',
    );
    expect(sqlContent).toContain('CONSTRAINT "ip_addresses_address_unique" UNIQUE("address")');
  });

  it('records ip_addresses_ipv4_host_check in 0005_snapshot.json', () => {
    const snapshotPath = path.resolve(__dirname, '../../../drizzle/meta/0005_snapshot.json');
    const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const ipTable = snapshotJson.tables['public.ip_addresses'];

    expect(ipTable).toBeDefined();
    expect(ipTable.checkConstraints).toBeDefined();
    expect(ipTable.checkConstraints.ip_addresses_ipv4_host_check).toBeDefined();
    expect(ipTable.checkConstraints.ip_addresses_ipv4_host_check.value).toBe(
      'family("ip_addresses"."address") = 4 AND masklen("ip_addresses"."address") = 32',
    );
  });
});
