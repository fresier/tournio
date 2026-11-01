import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedMatchCount, poolMatches, roundRobin } from '../src/lib/domain/round-robin';
import { impossibilities, placeMatches, validateSchedule, type CourtInput, type ScheduleRules } from '../src/lib/domain/schedule';
import { standings, type ResultInput } from '../src/lib/domain/standings';
import { canTransition, regenerationBlockers, transitionError } from '../src/lib/domain/match-status';

const at = (hhmm: string) => Date.parse(`2026-11-14T${hhmm}:00Z`);
const teams = (n: number, prefix = 'T') => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
const rules: ScheduleRules = { matchMinutes: 20, transitionMinutes: 5, restMinutes: 10 };
const day = (ids: string[], from = '08:00', to = '17:00'): CourtInput[] => ids.map((id) => ({ id, availabilities: [{ start: at(from), end: at(to) }] }));
const pilotPools = [0, 1, 2].map((p) => ({ id: `P${p + 1}`, teams: teams(4, `P${p + 1}-`) }));

test('round-robin : chaque paire une seule fois, effectifs pairs et impairs', () => {
  for (let n = 2; n <= 11; n++) {
    const list = teams(n);
    const { pairings, byes, rounds } = roundRobin(list);
    assert.equal(pairings.length, expectedMatchCount(n), `n=${n}`);
    const pairs = new Set(pairings.map((p) => [p.home, p.away].sort().join('|')));
    assert.equal(pairs.size, pairings.length, `aucune paire répétée ni inversée (n=${n})`);
    assert(pairings.every((p) => p.home !== p.away));
    assert.equal(rounds, n % 2 ? n : n - 1);
    for (let round = 1; round <= rounds; round++) {
      const playing = pairings.filter((p) => p.round === round).flatMap((p) => [p.home, p.away]);
      assert.equal(new Set(playing).size, playing.length, 'une équipe joue au plus une fois par tour');
      const resting = byes.filter((b) => b.round === round).map((b) => b.team);
      assert.equal(playing.length + resting.length, n, 'chaque équipe joue ou se repose');
    }
    if (n % 2) assert.deepEqual([...byes.map((b) => b.team)].sort(), [...list].sort(), 'chaque équipe se repose exactement une fois');
    else assert.equal(byes.length, 0);
    for (const team of list) {
      const home = pairings.filter((p) => p.home === team).length;
      const away = pairings.filter((p) => p.away === team).length;
      assert(Math.abs(home - away) <= 2, `domicile équilibré pour ${team} (n=${n}) : ${home}/${away}`);
    }
  }
});

test('round-robin : déterministe et refuse les doublons', () => {
  assert.deepEqual(roundRobin(teams(6)), roundRobin(teams(6)));
  assert.throws(() => roundRobin(['A', 'B', 'A']));
  assert.deepEqual(roundRobin([]).pairings, []);
  assert.deepEqual(roundRobin(['A']).pairings, []);
});

test('pilote 3 poules de 4 sur 3 terrains : 18 matchs acceptés par le validateur', () => {
  const matches = poolMatches(pilotPools);
  assert.equal(matches.length, 18);
  const courts = day(['C1', 'C2', 'C3']);
  const result = placeMatches({ matches, courts, rules });
  assert.equal(result.status, 'scheduled');
  if (result.status !== 'scheduled') return;
  assert.equal(result.matches.length, 18);
  assert.deepEqual(validateSchedule(result.matches.map((m) => ({ ...m })), courts, rules), []);
  // Déterminisme : mêmes entrées, même calendrier.
  assert.deepEqual(placeMatches({ matches, courts, rules }), result);
  // Le calendrier tient dans la matinée : 6 créneaux de 25 minutes sur 3 terrains.
  assert(Math.max(...result.matches.map((m) => m.end)) <= at('10:30'));
});

test('placement : respecte disponibilités fractionnées, transition et repos', () => {
  const matches = poolMatches([{ id: 'P', teams: teams(5) }]);
  const courts: CourtInput[] = [
    { id: 'A', availabilities: [{ start: at('09:00'), end: at('10:00') }, { start: at('13:00'), end: at('17:00') }] },
    { id: 'B', availabilities: [{ start: at('09:30'), end: at('11:00') }] },
  ];
  const strict: ScheduleRules = { matchMinutes: 25, transitionMinutes: 10, restMinutes: 40 };
  const result = placeMatches({ matches, courts, rules: strict });
  assert.equal(result.status, 'scheduled');
  if (result.status === 'scheduled') assert.deepEqual(validateSchedule(result.matches, courts, strict), []);
});

test('impossibilité démontrée vs recherche infructueuse', () => {
  const matches = poolMatches(pilotPools);
  const tooShort = placeMatches({ matches, courts: day(['C1'], '08:00', '08:15'), rules });
  assert.equal(tooShort.status, 'impossible');
  const capacity = placeMatches({ matches, courts: day(['C1'], '08:00', '10:00'), rules });
  assert.equal(capacity.status, 'impossible');
  if (capacity.status === 'impossible') assert.match(capacity.reasons.join(' '), /au plus 5 matchs/);
  const resting = impossibilities({ matches, courts: day(['C1', 'C2', 'C3'], '08:00', '09:30'), rules: { ...rules, restMinutes: 60 } });
  assert.match(resting.join(' '), /repos/);
  assert.deepEqual(placeMatches({ matches, courts: [], rules }), { status: 'impossible', reasons: ['Aucun terrain n’est configuré.'] });

  // Capacité suffisante sur le papier, mais les fenêtres trop courtes et dispersées empêchent les repos : pas de preuve, échec de recherche.
  const fragmented: CourtInput[] = [{ id: 'C1', availabilities: [{ start: at('08:00'), end: at('08:45') }, { start: at('09:00'), end: at('09:45') }] }];
  const tight = placeMatches({ matches: poolMatches([{ id: 'P', teams: teams(3) }]), courts: fragmented, rules: { matchMinutes: 20, transitionMinutes: 5, restMinutes: 50 } });
  assert.equal(tight.status, 'not_found');
  if (tight.status === 'not_found') assert(tight.unplaced.length > 0);
});

test('validateur : détecte chaque type de violation', () => {
  const courts = day(['C1', 'C2'], '09:00', '12:00');
  const m = (key: string, home: string, away: string, courtId: string | null, start: string | null, minutes = 20) => ({
    key, home, away, courtId, start: start ? at(start) : null, end: start ? at(start) + minutes * 60_000 : null,
  });
  const codes = (list: ReturnType<typeof m>[]) => validateSchedule(list, courts, rules).map((v) => v.code).sort();
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00'), m('2', 'C', 'D', 'C1', '09:20')]), ['court_overlap'], 'transition de 5 min non respectée');
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00'), m('2', 'C', 'D', 'C1', '09:25')]), [], 'intervalle semi-ouvert : fin + transition = début suivant');
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00'), m('2', 'A', 'C', 'C2', '09:25')]), ['team_rest']);
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00'), m('2', 'A', 'C', 'C2', '09:30')]), []);
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '11:50')]), ['outside_availability']);
  assert.deepEqual(codes([m('1', 'A', 'B', 'C9', '09:00')]), ['unknown_court']);
  assert.deepEqual(codes([m('1', 'A', 'B', null, null)]), ['unplaced']);
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00', 30)]), ['duration']);
  assert.deepEqual(codes([m('1', 'A', 'B', 'C1', '09:00'), m('2', 'B', 'A', 'C2', '10:00')]), ['duplicate_pair']);
  assert.deepEqual(codes([m('1', 'A', 'A', 'C1', '09:00')]), ['same_team']);
  // Un match annulé ne bloque ni le terrain ni les équipes.
  assert.deepEqual(validateSchedule([{ ...m('1', 'A', 'B', 'C1', '09:00'), cancelled: true }, m('2', 'A', 'C', 'C1', '09:05')], courts, rules), []);
});

test('classement : seuls les résultats validés de matchs terminés comptent', () => {
  const r = { allowDraw: true, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };
  const res = (id: string, home: string, away: string, homeScore: number | null, awayScore: number | null, status = 'COMPLETED', validatedAt: string | null = '2026-11-14T10:00:00Z'): ResultInput => ({ id, home, away, homeScore, awayScore, status, validatedAt });
  const { table, ignored } = standings(['A', 'B', 'C', 'D'], [
    res('1', 'A', 'B', 3, 1),
    res('2', 'C', 'D', 2, 2),
    res('3', 'A', 'C', 0, 1),
    res('4', 'B', 'D', 5, 0, 'IN_PROGRESS'),
    res('5', 'B', 'C', 9, 0, 'COMPLETED', null),
    res('6', 'D', 'A', 4, 0, 'CANCELLED'),
  ], r);
  assert.deepEqual(ignored, []);
  assert.deepEqual(table.map((row) => [row.position, row.team, row.points, row.played]), [[1, 'C', 4, 2], [2, 'A', 3, 2], [3, 'D', 1, 1], [4, 'B', 0, 1]]);
  const a = table.find((row) => row.team === 'A')!;
  assert.deepEqual([a.won, a.drawn, a.lost, a.scoresFor, a.scoresAgainst, a.scoreDifference], [1, 0, 1, 3, 2, 1]);
});

test('classement : départages et ordre stable', () => {
  const r = { allowDraw: true, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };
  const res = (id: string, home: string, away: string, homeScore: number, awayScore: number): ResultInput => ({ id, home, away, homeScore, awayScore, status: 'COMPLETED', validatedAt: '2026-11-14T10:00:00Z' });
  // A et B : 3 points chacun ; B a une meilleure différence.
  assert.deepEqual(standings(['A', 'B', 'C'], [res('1', 'A', 'C', 1, 0), res('2', 'B', 'C', 3, 0)], r).table.map((t) => t.team), ['B', 'A', 'C']);
  // Même différence ; B a marqué plus.
  assert.deepEqual(standings(['A', 'B', 'C'], [res('1', 'A', 'C', 1, 0), res('2', 'B', 'C', 2, 1)], r).table.map((t) => t.team), ['B', 'A', 'C']);
  // Égalité parfaite : ordre stable par identifiant.
  assert.deepEqual(standings(['B', 'A'], [], r).table.map((t) => t.team), ['A', 'B']);
  // Points configurables : 2 points la victoire.
  assert.equal(standings(['A', 'B'], [res('1', 'A', 'B', 1, 0)], { ...r, pointsWin: 2 }).table[0].points, 2);
  // Nul non autorisé : signalé, pas compté.
  const noDraw = standings(['A', 'B'], [res('1', 'A', 'B', 1, 1)], { ...r, allowDraw: false });
  assert.equal(noDraw.table[0].played, 0);
  assert.equal(noDraw.ignored.length, 1);
  // Équipe hors poule : signalée.
  assert.equal(standings(['A', 'B'], [res('1', 'A', 'X', 1, 0)], r).ignored.length, 1);
});

test('états des matchs : transitions et contrôles du résultat', () => {
  assert(canTransition('SCHEDULED', 'COMPLETED'));
  assert(canTransition('POSTPONED', 'SCHEDULED'));
  assert(!canTransition('COMPLETED', 'IN_PROGRESS'));
  assert(!canTransition('POSTPONED', 'IN_PROGRESS'));
  assert(!canTransition('CANCELLED', 'COMPLETED'));
  const score = (homeScore: number | null, awayScore: number | null) => ({ homeScore, awayScore });
  assert.equal(transitionError('IN_PROGRESS', 'COMPLETED', score(2, 1), true), null);
  assert.match(transitionError('IN_PROGRESS', 'COMPLETED', score(null, 1), true)!, /score/);
  assert.match(transitionError('IN_PROGRESS', 'COMPLETED', score(1, 1), false)!, /nuls/);
  assert.match(transitionError('IN_PROGRESS', 'COMPLETED', score(-1, 1), true)!, /positifs/);
  assert.equal(transitionError('COMPLETED', 'COMPLETED', score(3, 1), true), null, 'correction d’un score');
  assert.match(transitionError('COMPLETED', 'SCHEDULED', score(3, 1), true)!, /terminé/);
});

test('régénération : refusée dès qu’un match a commencé ou reçu un score', () => {
  const m = (status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED', homeScore: number | null = null, awayScore: number | null = null) => ({ status, homeScore, awayScore });
  assert.deepEqual(regenerationBlockers([m('SCHEDULED'), m('SCHEDULED')]), []);
  assert.equal(regenerationBlockers([m('IN_PROGRESS')]).length, 1);
  assert.equal(regenerationBlockers([m('COMPLETED', 2, 0), m('COMPLETED', 1, 1)]).length, 2);
  assert.equal(regenerationBlockers([m('SCHEDULED', 0, 0)]).length, 1);
});
