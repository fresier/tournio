import './scripts/load-env.mjs';
import { defineConfig } from 'prisma/config';
import { databaseURL } from './src/lib/database/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ? databaseURL() : '' },
});
