import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as argon2 from 'argon2';
// @ts-ignore Node native type stripping requires explicit .ts extension on disk
import { users } from './schema/index.ts';

const { Pool } = pkg;

async function seed() {
  console.log('Starting database seed...');

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://alfahd:alfahd_dev_password@localhost:5432/alfahd_ems',
  });

  const db = drizzle(pool);

  try {
    const passwordHash = await argon2.hash('password123');

    const seedUsers = [
      {
        email: 'admin@alfahd.local',
        passwordHash,
        role: 'ADMIN' as const,
        isActive: true,
      },
      {
        email: 'warehouse@alfahd.local',
        passwordHash,
        role: 'WAREHOUSE_STAFF' as const,
        isActive: true,
      },
      {
        email: 'cs@alfahd.local',
        passwordHash,
        role: 'CS' as const,
        isActive: true,
      },
      {
        email: 'tech@alfahd.local',
        passwordHash,
        role: 'TECHNICIAN' as const,
        isActive: true,
      },
    ];

    console.log('Inserting mock users...');

    await db.insert(users).values(seedUsers).onConflictDoNothing({ target: users.email });

    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

await seed();
