import { z } from 'zod';
import { customThemeProblem, HEX_COLOR, THEME_IDS } from '@/lib/appearance';
import { FINAL_FORMATS } from '@/lib/domain/placement';

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
  /** Horaires alignés sur une grille commune à tous les terrains. */
  aligned_slots: z.boolean().default(false),
  points_win: z.number().int().min(-999).max(999),
  points_draw: z.number().int().min(-999).max(999), points_loss: z.number().int().min(-999).max(999),
  /** Départage en poule après les points : la différence d’abord, ou les points marqués d’abord. */
  tie_break_order: z.union([
    z.tuple([z.literal('points'), z.literal('score_difference'), z.literal('scores_for'), z.literal('team_id')]),
    z.tuple([z.literal('points'), z.literal('scores_for'), z.literal('score_difference'), z.literal('team_id')]),
  ], 'Départage inconnu.'),
});
export const finalFormatSchema = z.enum(FINAL_FORMATS, 'Format inconnu.');
const teamInput = z.strictObject({ name, slug: slugSchema });
const namedInput = z.strictObject({ name });
const resourceId = z.strictObject({ id });
const availabilityInput = z.strictObject({ court_id: id, ...dateRange })
  .refine((value) => Date.parse(value.ends_at) > Date.parse(value.starts_at), { path: ['ends_at'], message: 'La fin doit être après le début.' });
const color = z.string().trim().toLowerCase().regex(HEX_COLOR, 'Couleur au format #rrggbb attendue.').nullable();
export const appearanceInputSchema = z.strictObject({ theme: z.enum(THEME_IDS, 'Thème inconnu.'), primary_color: color, accent_color: color,
  background_color: color.optional(), surface_color: color.optional(), text_color: color.optional(),
}).superRefine((value, context) => {
  const problem = customThemeProblem(value);
  if (problem) context.addIssue({ code: 'custom', path: ['background_color'], message: problem });
});
const unavailabilityInput = z.strictObject({ court_id: id, ...dateRange })
  .refine((value) => Date.parse(value.ends_at) > Date.parse(value.starts_at), { path: ['ends_at'], message: 'La fin doit être après le début.' });
const command = <T extends string, P extends z.ZodType>(operation: T, payload: P) => z.strictObject({
  operation: z.literal(operation), expected_version: z.number().int().positive(), payload,
});
export const configurationCommandSchema = z.discriminatedUnion('operation', [
  command('update_tournament', tournamentInputSchema), command('save_rules', rulesInputSchema),
  command('create_team', teamInput), command('create_teams', z.strictObject({ teams: z.array(teamInput).min(1).max(64, '64 équipes au plus à la fois.') })), command('update_team', teamInput.extend({ id })), command('delete_team', resourceId),
  command('create_pool', namedInput), command('update_pool', namedInput.extend({ id })), command('delete_pool', resourceId),
  command('assign_team', z.strictObject({ team_id: id, pool_id: id.nullable() })),
  command('draw_pools', z.strictObject({ mode: z.enum(['all', 'unassigned']) })),
  command('create_court', namedInput), command('update_court', namedInput.extend({ id })), command('delete_court', resourceId),
  command('create_availability', availabilityInput), command('delete_availability', resourceId),
  command('add_unavailability', unavailabilityInput), command('remove_unavailability', unavailabilityInput),
  command('update_appearance', appearanceInputSchema),
  command('set_final_format', z.strictObject({ final_format: finalFormatSchema, allow_incomplete: z.boolean().default(false), round_break_minutes: z.number().int('Un nombre entier de minutes est requis.').min(0, 'Valeur positive ou nulle requise.').max(600, '10 heures maximum.') })),
]);
export type ConfigurationCommand = z.infer<typeof configurationCommandSchema>;

export const tournamentSchema = z.object({
  id, name: z.string(), slug: z.string(), sport: z.string(), location: z.string(), timezone: z.string(),
  starts_at: z.string(), ends_at: z.string(), status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED']),
  published_at: z.string().nullable(), theme: z.string(), primary_color: z.string().nullable(), accent_color: z.string().nullable(),
  background_color: color.optional(), surface_color: color.optional(), text_color: color.optional(),
  version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});
const teamSchema = z.object({ id, tournament_id: id, name: z.string(), slug: z.string(), created_at: z.string(), updated_at: z.string() });
const namedSchema = z.object({ id, tournament_id: id, name: z.string(), sort_order: z.number().int() });
export const matchStatusSchema = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED']);
export const storedMatchSchema = z.object({
  id, pool_id: id.nullable(), home_team_id: id, away_team_id: id, court_id: id.nullable(),
  phase: z.enum(['POOL', 'FINAL']), final_round: z.number().int().nullable(), place_from: z.number().int().nullable(), place_to: z.number().int().nullable(), slot: z.number().int().nullable(),
  starts_at: z.string().nullable(), ends_at: z.string().nullable(), status: matchStatusSchema,
  home_score: z.number().int().nullable(), away_score: z.number().int().nullable(), version: z.number().int(),
});
export const tournamentSummarySchema = tournamentSchema.extend({ team_count: z.number(), pool_count: z.number(), court_count: z.number(), access_role: z.enum(['owner', 'manager']) });
export const managerEmailSchema = z.string().trim().toLowerCase().max(254, '254 caractères maximum.').pipe(z.email('Adresse e-mail invalide.'));
export const managerCommandSchema = z.strictObject({ email: managerEmailSchema });
export const managersResponseSchema = z.object({ role: z.enum(['owner', 'manager']), managers: z.array(z.object({ id, email: z.string() })) });
export const configurationSchema = z.object({
  tournament: tournamentSchema,
  rules: rulesInputSchema.extend({ tournament_id: id, tie_break_order: z.array(z.string()), final_format: finalFormatSchema.nullable(), round_break_minutes: z.number().int(), allow_incomplete: z.boolean() }),
  teams: z.array(teamSchema), pools: z.array(namedSchema), courts: z.array(namedSchema),
  pool_teams: z.array(z.object({ tournament_id: id, pool_id: id, team_id: id })),
  availabilities: z.array(z.object({ id, tournament_id: id, court_id: id, starts_at: z.string(), ends_at: z.string() })),
  matches: z.array(storedMatchSchema),
  match_count: z.number().int(),
});
export type TournamentConfiguration = z.infer<typeof configurationSchema>;
export type TournamentInput = z.infer<typeof tournamentInputSchema>;

export function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
}

/** Commandes du calendrier : même verrou et même contrôle de version que la configuration. */
const scheduleCommand = <T extends string, P extends z.ZodType>(operation: T, payload: P) => z.strictObject({
  operation: z.literal(operation), expected_version: z.number().int().positive(), payload,
});
const empty = z.strictObject({});
export const scheduleCommandSchema = z.discriminatedUnion('operation', [
  scheduleCommand('generate', z.strictObject({ replace: z.boolean() })),
  scheduleCommand('clear', empty),
  scheduleCommand('move_match', z.strictObject({ match_id: id, court_id: id, starts_at: instant })),
  scheduleCommand('publish', empty),
  scheduleCommand('generate_final_round', empty),
  scheduleCommand('cancel_final_round', empty),
  scheduleCommand('complete', empty),
  scheduleCommand('archive', empty),
]);
export type ScheduleCommand = z.infer<typeof scheduleCommandSchema>;

const plannedMatchSchema = z.object({ pool_id: id, round: z.number().int(), home_team_id: id, away_team_id: id, court_id: id, starts_at: z.string(), ends_at: z.string() });
export const schedulePreviewSchema = z.object({
  version: z.number().int(),
  status: z.enum(['ready', 'blocked', 'impossible', 'not_found']),
  reasons: z.array(z.string()),
  matches: z.array(plannedMatchSchema),
  /** Raisons qui empêchent d’enregistrer ce calendrier (régénération refusée, tournoi publié…). */
  save_blockers: z.array(z.string()),
});
export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;

/**
 * Commandes d’un match. `expected_version` est la version du match (et non du tournoi) :
 * deux matchs différents peuvent être saisis en parallèle, mais une double soumission
 * ou une correction concurrente du même match est refusée (409).
 */
const score = z.number().int('Un nombre entier est requis.').min(0, 'Score positif ou nul requis.').max(999, '999 maximum.');
const matchCommand = <T extends string, P extends z.ZodType>(operation: T, payload: P) => z.strictObject({
  operation: z.literal(operation), expected_version: z.number().int().positive(), payload,
});
export const matchCommandSchema = z.discriminatedUnion('operation', [
  matchCommand('start', empty),
  matchCommand('reset', empty),
  matchCommand('record_result', z.strictObject({ home_score: score, away_score: score })),
  matchCommand('postpone', empty),
  matchCommand('cancel', empty),
  matchCommand('reinstate', empty),
]);
export type MatchCommand = z.infer<typeof matchCommandSchema>;

/** Lancement simultané de plusieurs matchs (même créneau) : tout ou rien, version de chaque match vérifiée. */
export const startMatchesSchema = z.strictObject({
  matches: z.array(z.strictObject({ id, expected_version: z.number().int().positive() })).min(1, 'Aucun match à lancer.').max(32, '32 matchs au plus à la fois.')
    .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'Un même match est envoyé deux fois.'),
});
export type StartMatches = z.infer<typeof startMatchesSchema>;

/** Identifiant libre : `base`, sinon `base-2`, `base-3`… (100 caractères au plus). */
export function uniqueSlug(base: string, taken: readonly string[]) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 100 - suffix.length).replace(/-$/, '')}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

const letters = (n: number): string => n < 26 ? String.fromCharCode(65 + n) : letters(Math.floor(n / 26) - 1) + letters(n % 26);
/** Premier nom libre de la suite « Poule A », « Poule B »… (puis « Poule AA » au-delà de Z). */
export function nextPoolName(taken: readonly string[]) {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  for (let n = 0; ; n++) { const name = `Poule ${letters(n)}`; if (!used.has(name.toLowerCase())) return name; }
}
/** Premier nom libre de la suite « Terrain 1 », « Terrain 2 »… */
export function nextCourtName(taken: readonly string[]) {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  for (let n = 1; ; n++) { const name = `Terrain ${n}`; if (!used.has(name.toLowerCase())) return name; }
}
