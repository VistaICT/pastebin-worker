import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/db/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config;
