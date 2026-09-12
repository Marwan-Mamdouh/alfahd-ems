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
    EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'mailgun', 'postmark', 'ses']),
    EMAIL_FROM: z.string().email(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .refine((data) => data.REDIS_URL || (data.REDIS_HOST && data.REDIS_PORT), {
    message: 'Either REDIS_URL or both REDIS_HOST and REDIS_PORT are required',
  });

export type EnvConfig = z.infer<typeof envSchema>;
