import { hash, verify } from 'argon2';
import { describe, expect, it } from 'vitest';
import { ARGON2_OPTIONS } from './mappers.js';

describe('ARGON2_OPTIONS', () => {
  it('uses the OWASP-recommended argon2id parameters', () => {
    expect(ARGON2_OPTIONS).toEqual({
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  });
});

describe('password hashing contract', () => {
  it('produces an argon2id PHC string that fits the password_hash column', async () => {
    const stored = await hash('Verify!Pass123', ARGON2_OPTIONS);

    expect(stored.startsWith('$argon2id$')).toBe(true);
    expect(stored).toContain('m=65536');
    expect(stored).toContain('t=3');
    expect(stored).toContain('p=1');
    // users.password_hash is varchar(255)
    expect(stored.length).toBeLessThanOrEqual(255);
  });

  it('verifies with the (hash, plaintext) argument order used by the services', async () => {
    const stored = await hash('Verify!Pass123', ARGON2_OPTIONS);

    await expect(verify(stored, 'Verify!Pass123')).resolves.toBe(true);
    await expect(verify(stored, 'wrong-password')).resolves.toBe(false);
  });

  it('salts each hash so identical passwords do not collide', async () => {
    const first = await hash('SamePassword1!', ARGON2_OPTIONS);
    const second = await hash('SamePassword1!', ARGON2_OPTIONS);

    expect(first).not.toBe(second);
    await expect(verify(first, 'SamePassword1!')).resolves.toBe(true);
    await expect(verify(second, 'SamePassword1!')).resolves.toBe(true);
  });

  it('keeps hashes verifiable after parameters are tuned (PHC embeds them)', async () => {
    const stored = await hash('Verify!Pass123', ARGON2_OPTIONS);
    const retuned = await hash('Verify!Pass123', { ...ARGON2_OPTIONS, timeCost: 4 });

    expect(retuned).toContain('t=4');
    await expect(verify(stored, 'Verify!Pass123')).resolves.toBe(true);
  });
});
