import './load-env.mjs';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { databaseURL } from '../src/lib/database/config';

/**
 * Remise en conformité d’une base modifiée par `prisma db push` au lieu des migrations.
 * `db push` crée les colonnes du schéma Prisma mais ignore ce qui n’existe qu’en SQL (triggers temps réel,
 * contraintes, index partiels, fonctions), et n’enregistre aucune migration : `migrate deploy` échoue ensuite.
 *
 * Par défaut : lecture seule (diagnostic). Avec `--apply` : ajoute, en une transaction, uniquement ce qui manque
 * (instructions idempotentes), puis marque les migrations concernées comme appliquées.
 */
const apply = process.argv.includes('--apply');
const MIGRATIONS = ['202611010001_public_tournament_events', '202611020001_tournament_appearance', '202611020002_tournament_theme', '202611020003_placement_phase', '202611020004_round_break'];
const COLUMNS = ['tournaments.primary_color', 'tournaments.accent_color', 'tournaments.theme', 'tournament_rules.final_format', 'tournament_rules.round_break_minutes', 'matches.phase', 'matches.final_round', 'matches.place_from', 'matches.place_to', 'matches.slot'];

/** Contrainte à ajouter si absente, avec la requête qui compte les lignes qui la violeraient. */
const CONSTRAINTS: { name: string; table: string; sql: string; violations: string }[] = [
  { name: 'tournaments_primary_color_hex', table: 'tournaments', sql: `CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-f]{6}$')`, violations: `SELECT count(*) FROM tournio.tournaments WHERE NOT (primary_color IS NULL OR primary_color ~ '^#[0-9a-f]{6}$')` },
  { name: 'tournaments_accent_color_hex', table: 'tournaments', sql: `CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-f]{6}$')`, violations: `SELECT count(*) FROM tournio.tournaments WHERE NOT (accent_color IS NULL OR accent_color ~ '^#[0-9a-f]{6}$')` },
  { name: 'tournaments_theme_format', table: 'tournaments', sql: `CHECK (theme ~ '^[a-z]{1,20}$')`, violations: `SELECT count(*) FROM tournio.tournaments WHERE NOT (theme ~ '^[a-z]{1,20}$')` },
  { name: 'rules_final_format_valid', table: 'tournament_rules', sql: `CHECK (final_format IN ('none', 'rank', 'cross', 'bracket'))`, violations: `SELECT count(*) FROM tournio.tournament_rules WHERE final_format NOT IN ('none', 'rank', 'cross', 'bracket')` },
  { name: 'rules_round_break_valid', table: 'tournament_rules', sql: `CHECK (round_break_minutes BETWEEN 0 AND 600)`, violations: `SELECT count(*) FROM tournio.tournament_rules WHERE round_break_minutes NOT BETWEEN 0 AND 600` },
  { name: 'match_phase_consistent', table: 'matches', sql: `CHECK ((phase = 'POOL' AND pool_id IS NOT NULL AND final_round IS NULL AND place_from IS NULL AND place_to IS NULL AND slot IS NULL) OR (phase = 'FINAL' AND pool_id IS NULL AND final_round >= 1 AND place_from >= 1 AND place_to > place_from AND slot >= 0))`,
    violations: `SELECT count(*) FROM tournio.matches WHERE NOT ((phase = 'POOL' AND pool_id IS NOT NULL AND final_round IS NULL AND place_from IS NULL AND place_to IS NULL AND slot IS NULL) OR (phase = 'FINAL' AND pool_id IS NULL AND final_round >= 1 AND place_from >= 1 AND place_to > place_from AND slot >= 0))` },
  { name: 'matches_home_team_fkey', table: 'matches', sql: `FOREIGN KEY (tournament_id, home_team_id) REFERENCES tournio.teams(tournament_id, id) ON DELETE RESTRICT ON UPDATE NO ACTION`, violations: `SELECT count(*) FROM tournio.matches m WHERE NOT EXISTS (SELECT 1 FROM tournio.teams t WHERE t.tournament_id = m.tournament_id AND t.id = m.home_team_id)` },
  { name: 'matches_away_team_fkey', table: 'matches', sql: `FOREIGN KEY (tournament_id, away_team_id) REFERENCES tournio.teams(tournament_id, id) ON DELETE RESTRICT ON UPDATE NO ACTION`, violations: `SELECT count(*) FROM tournio.matches m WHERE NOT EXISTS (SELECT 1 FROM tournio.teams t WHERE t.tournament_id = m.tournament_id AND t.id = m.away_team_id)` },
];

const FUNCTIONS_AND_TRIGGERS = `
CREATE OR REPLACE FUNCTION tournio.notify_tournament_change() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME = 'tournaments' THEN target := COALESCE(NEW.id, OLD.id);
  ELSE target := COALESCE(NEW.tournament_id, OLD.tournament_id);
  END IF;
  PERFORM pg_catalog.pg_notify('tournio_tournaments', json_build_object('id', target)::text);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tournament_changed ON tournio.tournaments;
CREATE TRIGGER tournament_changed AFTER UPDATE ON tournio.tournaments FOR EACH ROW EXECUTE FUNCTION tournio.notify_tournament_change();
DROP TRIGGER IF EXISTS match_changed ON tournio.matches;
CREATE TRIGGER match_changed AFTER INSERT OR UPDATE OR DELETE ON tournio.matches FOR EACH ROW EXECUTE FUNCTION tournio.notify_tournament_change();
CREATE OR REPLACE FUNCTION tournio.validate_match_result() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.home_score = NEW.away_score AND (NEW.phase = 'FINAL' OR EXISTS (SELECT 1 FROM tournio.tournament_rules r WHERE r.tournament_id = NEW.tournament_id AND NOT r.allow_draw)) THEN RAISE EXCEPTION 'DRAW_NOT_ALLOWED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
ALTER TABLE tournio.matches ALTER COLUMN pool_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS match_final_slot_unique ON tournio.matches (tournament_id, final_round, place_from, slot) WHERE phase = 'FINAL';
`;

const client = new pg.Client({ connectionString: databaseURL(), connectionTimeoutMillis: 10000 });
await client.connect();
try {
  const one = async (sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows[0];
  const applied = new Set((await client.query(`SELECT migration_name FROM tournio._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map((row) => row.migration_name as string));
  const pending = MIGRATIONS.filter((name) => !applied.has(name));
  console.log(`Migrations enregistrées : ${applied.size}. À régulariser : ${pending.join(', ') || 'aucune'}.`);

  const columns = (await client.query(`SELECT table_name || '.' || column_name AS name FROM information_schema.columns WHERE table_schema = 'tournio'`)).rows.map((row) => row.name as string);
  const missingColumns = COLUMNS.filter((column) => !columns.includes(column));
  if (missingColumns.length) {
    console.log(`Colonnes absentes : ${missingColumns.join(', ')}. Cette base n’a pas été modifiée par db push : utilisez simplement npm run db:migrate.`);
    process.exit(missingColumns.length === COLUMNS.length ? 0 : 1);
  }

  const triggers = (await client.query(`SELECT tgname FROM pg_trigger WHERE tgname IN ('tournament_changed', 'match_changed') AND NOT tgisinternal`)).rows.map((row) => row.tgname as string);
  console.log(`Triggers temps réel : ${triggers.length === 2 ? 'présents' : `ABSENTS (${['tournament_changed', 'match_changed'].filter((name) => !triggers.includes(name)).join(', ')}) : les pages publiques ne reçoivent aucune mise à jour`}.`);
  const index = await one(`SELECT to_regclass('tournio.match_final_slot_unique') IS NOT NULL AS present`);
  console.log(`Index des tours de classement : ${index.present ? 'présent' : 'absent'}.`);
  const nullable = await one(`SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'tournio' AND table_name = 'matches' AND column_name = 'pool_id'`);
  console.log(`matches.pool_id nullable : ${nullable.is_nullable}.`);

  let blocked = false;
  const toAdd: typeof CONSTRAINTS = [];
  for (const constraint of CONSTRAINTS) {
    const exists = await one(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = $1 AND connamespace = 'tournio'::regnamespace`, [constraint.name]);
    if (exists.n) continue;
    const { count } = await one(constraint.violations);
    console.log(`Contrainte absente : ${constraint.name}${Number(count) ? ` — ${count} ligne(s) la violent : correction des données nécessaire` : ''}.`);
    if (Number(count)) blocked = true; else toAdd.push(constraint);
  }
  // Objets plus anciens que db push aurait pu supprimer : signalés seulement.
  for (const name of ['match_unique_pair', 'match_distinct_teams', 'match_result_valid', 'match_assignment_complete']) {
    const present = await one(`SELECT (to_regclass('tournio.' || $1) IS NOT NULL OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1 AND connamespace = 'tournio'::regnamespace)) AS present`, [name]);
    if (!present.present) { console.log(`Objet de la migration d’intégrité absent : ${name} — à recréer avant toute régularisation.`); blocked = true; }
  }

  if (!apply) {
    console.log(blocked ? '\nRégularisation bloquée : voir ci-dessus.' : `\nDiagnostic terminé, rien n’a été modifié. Relancez avec --apply pour ajouter ${toAdd.length} contrainte(s), les triggers, l’index et la fonction de résultat, puis enregistrer ${pending.length} migration(s).`);
    process.exit(blocked ? 1 : 0);
  }
  if (blocked) { console.log('\nRégularisation refusée : voir ci-dessus.'); process.exit(1); }

  await client.query('BEGIN');
  try {
    await client.query(FUNCTIONS_AND_TRIGGERS);
    for (const constraint of toAdd) await client.query(`ALTER TABLE tournio.${constraint.table} ADD CONSTRAINT ${constraint.name} ${constraint.sql}`);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  console.log(`Ajouté : triggers temps réel, fonction de résultat, index, ${toAdd.length} contrainte(s).`);
} finally { await client.end(); }

if (apply) {
  for (const name of MIGRATIONS) {
    const result = spawnSync(process.execPath, ['scripts/prisma.mjs', 'migrate', 'resolve', '--applied', name], { encoding: 'utf8' });
    const already = /already recorded|P3008/.test(`${result.stdout}${result.stderr}`);
    console.log(`Migration ${name} : ${result.status === 0 ? 'enregistrée comme appliquée' : already ? 'déjà enregistrée' : `échec (${(result.stderr || result.stdout).trim().split('\n').at(-1)})`}.`);
  }
}
