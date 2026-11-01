import { getPrisma } from '@/lib/database/client';
import { matchSchema } from '@/lib/contracts';
import { DomainError } from '@/lib/tournaments/store';

const publicFields = { id: true, home_team: true, away_team: true, home_score: true, away_score: true, version: true, published: true, updated_at: true } as const;
const dto = (row: unknown) => matchSchema.parse(JSON.parse(JSON.stringify(row)));

export async function publicDemoMatches(id?: string) {
  const rows = await getPrisma().demoMatch.findMany({ where: { published: true, ...(id ? { id } : {}) }, orderBy: [{ updated_at: 'desc' }, { id: 'asc' }], take: 12, select: publicFields });
  return rows.map(dto);
}

export async function createDemoMatch(userId: string) {
  return dto(await getPrisma().demoMatch.create({ data: { owner_id: userId }, select: publicFields }));
}

export async function updateDemoScore(userId: string, id: string, input: { home_score: number; away_score: number; expected_version: number }) {
  return getPrisma().$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<{ id: string; version: number }[]>`SELECT id, version FROM tournio.demo_matches WHERE id = ${id}::uuid AND owner_id = ${userId}::uuid FOR UPDATE`;
    if (!current) throw new DomainError('NOT_FOUND', 'Match introuvable ou accès refusé.', 404);
    if (current.version !== input.expected_version) throw new DomainError('STALE_VERSION', 'Le score a changé. Rechargez sa dernière version.', 409);
    return dto(await tx.demoMatch.update({ where: { id }, data: { home_score: input.home_score, away_score: input.away_score, version: { increment: 1 } }, select: publicFields }));
  });
}
