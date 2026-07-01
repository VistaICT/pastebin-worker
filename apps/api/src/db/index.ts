import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../env.js';
import * as schema from '@lockbox/db/schema';

export { schema };
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export function createDB(env: Env) {
  return drizzle(env.DB, { schema });
}

export type DB = ReturnType<typeof createDB>;
