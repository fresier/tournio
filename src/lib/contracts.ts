import { z } from 'zod';

export const matchSchema = z.object({
  id: z.uuid(), home_team: z.string(), away_team: z.string(),
  home_score: z.number().int().min(0).max(999),
  away_score: z.number().int().min(0).max(999),
  version: z.number().int().positive(), published: z.boolean(), updated_at: z.string(),
});
export type DemoMatch = z.infer<typeof matchSchema>;
export const scoreSchema = z.strictObject({
  home_score: z.number().int().min(0).max(999),
  away_score: z.number().int().min(0).max(999),
  expected_version: z.number().int().positive(),
});
export const loginSchema = z.strictObject({
  email: z.email().max(254), password: z.string().min(1).max(1024),
});
