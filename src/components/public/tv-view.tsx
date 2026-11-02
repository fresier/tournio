'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Group, Paper, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, UnstyledButton } from '@mantine/core';
import type { PublicMatch, PublicTournament } from '@/lib/public/contracts';
import { courtStates, recentResults, standingPages } from '@/lib/public/tv';
import { themedAppearance } from '@/lib/theme-variables';
import { palette, readableShade } from '@/lib/appearance';
import { formatMatchTime } from '@/lib/tournaments/dates';
import { QrCode, useClientOrigin } from '@/components/qr-code';
import { usePublicTournament } from './use-public-tournament';
import { ConnectionBadge, useNames } from './public-parts';

const ROTATION_MS = 12_000;
/** Lignes de classement par page (en-têtes compris) : tient dans la colonne d’un écran 16:9. */
const STANDING_ROWS = 17;

/* Horloge à la seconde près pour l’affichage ; absente au rendu serveur (HTML identique à l’hydratation). */
let tick: number | undefined;
function subscribeTick(onChange: () => void) {
  const update = () => { tick = Date.now(); onChange(); };
  update();
  const timer = window.setInterval(update, 5_000);
  return () => window.clearInterval(timer);
}
const useTick = () => useSyncExternalStore(subscribeTick, () => tick, () => undefined);

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}
const useFullscreen = () => useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);

/** Garde l’écran allumé tant que la page est visible (si le navigateur le permet). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    const request = async () => {
      try { lock = await (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen'); }
      catch { /* Refusé ou non pris en charge : l’écran suit ses propres réglages. */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void lock?.release().catch(() => {}); };
  }, []);
}

export function TvView({ initial }: { initial: PublicTournament }) {
  const { snapshot, connection } = usePublicTournament(initial);
  const { name, group } = useNames(snapshot);
  const t = snapshot.tournament;
  const appearance = themedAppearance(t);
  const now = useTick();
  const fullscreen = useFullscreen();
  const origin = useClientOrigin();
  const [page, setPage] = useState(0);
  useWakeLock();

  const pages = standingPages(snapshot, STANDING_ROWS);
  const pageCount = pages.length;
  useEffect(() => {
    if (pageCount < 2) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pageCount), ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [pageCount]);
  const shownPools = pages[page % Math.max(pageCount, 1)] ?? [];

  const courts = courtStates(snapshot);
  const results = recentResults(snapshot, 7);
  // Phase de classement : le dernier tour généré (avec ses résultats), dans l’ordre des places.
  const lastRound = snapshot.matches.reduce((max, match) => Math.max(max, match.final_round ?? 0), 0);
  const finals = snapshot.matches.filter((match) => match.phase === 'FINAL' && match.final_round === lastRound)
    .sort((a, b) => (a.place_from ?? 0) - (b.place_from ?? 0) || Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? '')).slice(0, 9);
  const time = (instant: string | null) => instant ? formatMatchTime(instant, t.timezone, false) : '—';
  const shades = palette(appearance.primary);
  const qrColor = shades[Math.max(readableShade(shades), 7)];
  const publicUrl = origin ? `${origin}/t/${t.slug}` : null;

  const teams = (match: PublicMatch) => <span className="tv-teams"><strong>{name(match.home_team_id)}</strong><span className="tv-dim"> – </span><strong>{name(match.away_team_id)}</strong></span>;
  const courtMatch = (match: PublicMatch | undefined, current: boolean) => <div className="tv-court-match" data-kind={current ? 'current' : 'next'}>
    <span className="tv-chip" data-state={current && match ? 'live' : undefined}>{current ? 'En cours' : 'À suivre'}</span>
    {match ? <>
      <span className="tv-time">{time(match.starts_at)}</span>
      {teams(match)}
      <span className="tv-dim tv-pool">{group(match)}</span>
    </> : <span className="tv-dim tv-court-empty">{current ? 'Libre' : 'Aucun match prévu'}</span>}
  </div>;

  return <Box component="main" className="tv-root" data-mantine-color-scheme={appearance.scheme} style={appearance.vars}>
    <Group component="header" className="tv-header" justify="space-between" wrap="nowrap" gap="2em">
      <Box style={{ minWidth: 0 }}>
        <h1 className="tv-title">{t.name}</h1>
        <p className="tv-dim tv-subtitle">{t.sport}{t.location ? ` · ${t.location}` : ''}</p>
      </Box>
      <Group gap="1.4em" wrap="nowrap">
        <ConnectionBadge connection={connection} />
        <time className="tv-clock" aria-label="Heure locale du tournoi">{now !== undefined ? formatMatchTime(new Date(now).toISOString(), t.timezone, false) : ''}</time>
        {!fullscreen ? <UnstyledButton className="tv-fullscreen" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>Plein écran</UnstyledButton> : null}
      </Group>
    </Group>

    <Box className="tv-grid">
      <Stack component="section" aria-labelledby="tv-courts" gap="0.8em" className="tv-column">
        <h2 id="tv-courts" className="tv-heading">Sur les terrains</h2>
        <Stack gap="0.5em" className="tv-courts-list" style={{ fontSize: `${Math.min(1, 5 / Math.max(1, courts.length))}em` }}>{courts.map((row) => <Paper key={row.courtId} component="section" aria-label={name(row.courtId)} withBorder className="tv-court" data-state={row.current ? 'live' : row.next ? 'next' : 'idle'}>
          <h3 className="tv-court-name">{name(row.courtId)}</h3>
          {courtMatch(row.current, true)}
          {courtMatch(row.next, false)}
        </Paper>)}</Stack>
      </Stack>

      {snapshot.placement.ranking ? <Stack component="section" aria-labelledby="tv-final" gap="0.8em" className="tv-column">
        <h2 id="tv-final" className="tv-heading">Classement final</h2>
        <Paper withBorder className="tv-table-wrap"><ol className="tv-ranking">{snapshot.placement.ranking.map((team, index) => <li key={team} data-podium={index < 3 || undefined}>
          <span className="tv-rank">{index + 1}</span><span className="tv-rank-team">{name(team)}</span>
        </li>)}</ol></Paper>
      </Stack> : finals.length ? <Stack component="section" aria-labelledby="tv-placement" gap="0.8em" className="tv-column">
        <h2 id="tv-placement" className="tv-heading">Phase de classement</h2>
        <Stack gap="0.5em">{finals.map((match) => <Paper key={match.id} withBorder className="tv-final" data-state={match.status === 'IN_PROGRESS' ? 'live' : undefined}>
          <span className="tv-final-label">{group(match)}</span>
          <span className="tv-teams">{teams(match)}</span>
          <span className="tv-score">{match.home_score !== null ? `${match.home_score} – ${match.away_score}` : match.status === 'IN_PROGRESS' ? 'En cours' : time(match.starts_at)}</span>
        </Paper>)}</Stack>
      </Stack> : <Stack component="section" aria-labelledby="tv-standings" gap="0.8em" className="tv-column">
        <Group justify="space-between" wrap="nowrap"><h2 id="tv-standings" className="tv-heading">Classements</h2>
          {pageCount > 1 ? <Group gap="0.4em" wrap="nowrap"><span className="tv-dim tv-page">{page % pageCount + 1} / {pageCount}</span>{pages.map((_, index) => <span key={index} aria-hidden="true" className="tv-dot" data-active={index === page % pageCount || undefined} />)}</Group> : null}
        </Group>
        <Stack gap="1em" key={page} className="tv-fade">{shownPools.map((poolId) => {
          const rows = snapshot.standings.find((row) => row.pool_id === poolId)?.rows ?? [];
          return <Box key={poolId}>
            <h3 className="tv-pool-title">{name(poolId)}</h3>
            <Paper withBorder className="tv-table-wrap"><Table className="tv-table" tabularNums withRowBorders>
              <TableThead><TableTr><TableTh scope="col">#</TableTh><TableTh scope="col">Équipe</TableTh><TableTh scope="col" title="Joués">J</TableTh><TableTh scope="col" title="Victoires">V</TableTh><TableTh scope="col" title="Différence">Diff.</TableTh><TableTh scope="col">Pts</TableTh></TableTr></TableThead>
              <TableTbody>{rows.map((row) => <TableTr key={row.team_id}><TableTd>{row.position}</TableTd><TableTh scope="row">{name(row.team_id)}</TableTh><TableTd>{row.played}</TableTd><TableTd>{row.won}</TableTd><TableTd>{row.score_difference > 0 ? `+${row.score_difference}` : row.score_difference}</TableTd><TableTd className="tv-points">{row.points}</TableTd></TableTr>)}</TableTbody>
            </Table></Paper>
          </Box>;
        })}</Stack>
      </Stack>}

      <Stack component="section" aria-labelledby="tv-results" gap="0.8em" className="tv-column">
        <h2 id="tv-results" className="tv-heading">Derniers résultats</h2>
        {results.length ? <Stack gap="0.5em" className="tv-results">{results.map((match) => <Paper key={match.id} withBorder className="tv-result">
          <span className={`tv-result-team${match.home_score! > match.away_score! ? ' tv-winner' : ''}`}>{name(match.home_team_id)}</span>
          <span className="tv-score">{match.home_score} – {match.away_score}</span>
          <span className={`tv-result-team tv-right${match.away_score! > match.home_score! ? ' tv-winner' : ''}`}>{name(match.away_team_id)}</span>
        </Paper>)}</Stack> : <p className="tv-dim">Les premiers résultats s’afficheront ici.</p>}
        {publicUrl ? <Paper withBorder className="tv-qr">
          <QrCode url={publicUrl} size={150} color={qrColor} />
          <Box><p className="tv-qr-title">Suivez le tournoi sur votre téléphone</p><p className="tv-dim tv-qr-url">{publicUrl.replace(/^https?:\/\//, '')}</p></Box>
        </Paper> : null}
        <Group className="tv-signature" gap="0.5em" justify="center" wrap="nowrap">
          <span className="brand tv-brand">tournio<span>.</span></span>
          <span className="tv-dim tv-by">by <strong>rfonline</strong></span>
        </Group>
      </Stack>
    </Box>
  </Box>;
}
