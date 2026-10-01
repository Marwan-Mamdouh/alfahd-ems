import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().positive().optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    EMAIL_PROVIDER: z.enum(['smtp']),
    EMAIL_FROM: z.string().email(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // Comma-separated allowlist for credentialed CORS. Never use '*': browsers
    // reject a wildcard origin on credentialed requests, which silently breaks
    // the refresh cookie.
    CORS_ORIGINS: z.string().optional(),
    // Refresh-cookie attributes. Both default from NODE_ENV so local HTTP dev
    // and production cross-origin deploys each get a valid policy.
    REFRESH_COOKIE_SAME_SITE: z.enum(['lax', 'none']).optional(),
    REFRESH_COOKIE_SECURE: z.coerce.boolean().optional(),
  })
  .refine((data) => data.REDIS_URL || (data.REDIS_HOST && data.REDIS_PORT), {
    message: 'Either REDIS_URL or both REDIS_HOST and REDIS_PORT are required',
  })
  .refine(
    (data) => data.REFRESH_COOKIE_SAME_SITE !== 'none' || data.REFRESH_COOKIE_SECURE !== false,
    {
      message:
        'REFRESH_COOKIE_SAME_SITE=none requires REFRESH_COOKIE_SECURE=true — browsers reject SameSite=None without Secure',
    },
  )
  .superRefine((data, ctx) => {
    if (data.EMAIL_PROVIDER === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when EMAIL_PROVIDER is smtp`,
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;
