import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const loaded = {};
for (const file of ['.env', '.env.local']) if (existsSync(file)) Object.assign(loaded, parseEnv(readFileSync(file, 'utf8')));
for (const [key, value] of Object.entries(loaded)) process.env[key] ??= value;
