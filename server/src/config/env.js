import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  DELAY_THRESHOLD_MIN: z.string().default('5').transform(Number),
  ON_TIME_TOLERANCE_MIN: z.string().default('3').transform(Number),
  AI_AUTO_PUBLISH: z.string().default('false').transform(v => v === 'true'),
  OSRM_URL: z.string().default('https://router.project-osrm.org'),
  REQUIRE_DRIVER_PHOTO: z.string().default('true').transform(v => v === 'true'),
  NODE_ENV: z.string().default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
