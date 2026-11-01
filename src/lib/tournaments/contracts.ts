import { z } from 'zod';

const name = z.string().trim().min(2, 'Deux caractères minimum.').max(80, '80 caractères maximum.');
const id = z.uuid('Identifiant invalide.');
const integer = z.number().int('Un nombre entier est requis.').min(0, 'Valeur positive ou nulle requise.').max(2147483647);
export const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Utilisez des lettres minuscules, chiffres et tirets.');
export const timezoneSchema = z.string().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat('fr', { timeZone: value }); return !/^[+-]/.test(value); } catch { return false; }
}, 'Fuseau horaire IANA invalide.');
const instant = z.iso.datetime({ offset: true, error: 'Date avec fuseau ou décalage UTC requise.' });
const dateRange = { starts_at: instant, ends_at: instant };

export const tournamentInputSchema = z.strictObject({
  name: z.string().trim().min(2, 'Deux caractères minimum.').max(120),
  slug: slugSchema, sport: name, location: z.string().trim().max(240), timezone: timezoneSchema, ...dateRange,
}).refine((value) => Date.parse(value.ends_at) > Date.parse(value.starts_at), { path: ['ends_at'], message: 'La fin doit être après le début.' });

export const rulesInputSchema = z.strictObject({
  match_duration_minutes: integer.min(1, 'La durée doit être supérieure à zéro.'),
  transition_minutes: integer, minimum_rest_minutes: integer, allow_draw: z.boolean(),
  points_win: z.number().int().min(-999).max(999),
  points_draw: z.number().int().min(-999).max(999), points_loss: z.number().int().min(-999).max(999),
});
const teamInput = z.strictObject({ name, slug: slugSchema });
const namedInput = z.strictObject({ name });
const resourceId = z.strictObject({ id });
const availabilityInput = z.strictObject({ court_id: id, ...dateRange })
  .refine((value) => Date.parse(value.ends_at) > Date.parse(value.starts_at), { path: ['ends_at'], message: 'La fin doit être après le début.' });
const command = <T extends string, P extends z.ZodType>(operation: T, payload: P) => z.strictObject({
  operation: z.literal(operation), expected_version: z.number().int().positive(), payload,
});
export const configurationCommandSchema = z.discriminatedUnion('operation', [
  command('update_tournament', tournamentInputSchema), command('save_rules', rulesInputSchema),
  command('create_team', teamInput), command('update_team', teamInput.extend({ id })), command('delete_team', resourceId),
  command('create_pool', namedInput), command('update_pool', namedInput.extend({ id })), command('delete_pool', resourceId),
  command('assign_team', z.strictObject({ team_id: id, pool_id: id.nullable() })),
  command('create_court', namedInput), command('update_court', namedInput.extend({ id })), command('delete_court', resourceId),
  command('create_availability', availabilityInput), command('delete_availability', resourceId),
]);
export type ConfigurationCommand = z.infer<typeof configurationCommandSchema>;

export const tournamentSchema = z.object({
  id, name: z.string(), slug: z.string(), sport: z.string(), location: z.string(), timezone: z.string(),
  starts_at: z.string(), ends_at: z.string(), status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED']),
  published_at: z.string().nullable(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});
const teamSchema = z.object({ id, tournament_id: id, name: z.string(), slug: z.string(), created_at: z.string(), updated_at: z.string() });
const namedSchema = z.object({ id, tournament_id: id, name: z.string(), sort_order: z.number().int() });
export const tournamentSummarySchema = tournamentSchema.extend({ team_count: z.number(), pool_count: z.number(), court_count: z.number() });
export const configurationSchema = z.object({
  tournament: tournamentSchema,
  rules: rulesInputSchema.extend({ tournament_id: id, tie_break_order: z.array(z.string()) }),
  teams: z.array(teamSchema), pools: z.array(namedSchema), courts: z.array(namedSchema),
  pool_teams: z.array(z.object({ tournament_id: id, pool_id: id, team_id: id })),
  availabilities: z.array(z.object({ id, tournament_id: id, court_id: id, starts_at: z.string(), ends_at: z.string() })),
  match_count: z.number().int(),
});
export type TournamentConfiguration = z.infer<typeof configurationSchema>;
export type TournamentInput = z.infer<typeof tournamentInputSchema>;

export function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
}
