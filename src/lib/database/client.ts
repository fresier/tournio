import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { databaseURL } from './config';

const globalDatabase = globalThis as unknown as { tournioPrisma?: PrismaClient };

export function getPrisma() {
  if (!globalDatabase.tournioPrisma) {
    globalDatabase.tournioPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseURL(), connectionTimeoutMillis: 10000, query_timeout: 15000 }, { schema: 'tournio' }), log: [] });
  }
  return globalDatabase.tournioPrisma;
}
