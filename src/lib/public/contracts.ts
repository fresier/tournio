import { z } from 'zod';

/**
 * Instantané public d’un tournoi publié. Liste blanche stricte : ni propriétaire, ni dates internes,
 * ni disponibilités, ni données d’authentification. C’est la seule forme envoyée aux visiteurs.
 */
const id = z.uuid();
export const publicMatchSchema = z.strictObject({
  id, pool_id: id.nullable(), home_team_id: id, away_team_id: id, court_id: id.nullable(),
  phase: z.enum(['POOL', 'FINAL']), final_round: z.number().int().nullable(), place_from: z.number().int().nullable(), place_to: z.number().int().nullable(),
  starts_at: z.string().nullable(), ends_at: z.string().nullable(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED']),
  home_score: z.number().int().nullable(), away_score: z.number().int().nullable(),
});
export const publicStandingSchema = z.strictObject({
  position: z.number().int(), team_id: id, played: z.number().int(), won: z.number().int(), drawn: z.number().int(), lost: z.number().int(),
  scores_for: z.number().int(), scores_against: z.number().int(), score_difference: z.number().int(), points: z.number().int(),
});
export const publicTournamentSchema = z.strictObject({
  tournament: z.strictObject({
    name: z.string(), slug: z.string(), sport: z.string(), location: z.string(), timezone: z.string(),
    starts_at: z.string(), ends_at: z.string(), status: z.enum(['PUBLISHED', 'COMPLETED', 'ARCHIVED']), version: z.number().int(),
    theme: z.string(), primary_color: z.string().nullable(), accent_color: z.string().nullable(),
  }),
  pools: z.array(z.strictObject({ id, name: z.string() })),
  teams: z.array(z.strictObject({ id, name: z.string(), slug: z.string(), pool_id: id.nullable() })),
  courts: z.array(z.strictObject({ id, name: z.string() })),
  matches: z.array(publicMatchSchema),
  standings: z.array(z.strictObject({ pool_id: id, rows: z.array(publicStandingSchema) })),
  /** Phase de classement : format, nombre de tours, classement final une fois toutes les places jouées. */
  placement: z.strictObject({
    format: z.enum(['none', 'rank', 'cross', 'bracket']), rounds: z.number().int(), ranking: z.array(id).nullable(),
    /** Classement du tournoi pendant la phase de classement : plage de places encore disputée par chaque équipe. */
    standing: z.array(z.strictObject({ team_id: id, place_from: z.number().int(), place_to: z.number().int() })).nullable(),
  }),
});
export type PublicTournament = z.infer<typeof publicTournamentSchema>;
export type PublicMatch = z.infer<typeof publicMatchSchema>;
