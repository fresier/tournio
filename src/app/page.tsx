import { z } from 'zod';
import type { DemoMatch } from '@/lib/contracts';
import { publicDemoMatches } from '@/lib/demo-store';
import { RealtimeDemo } from '@/components/realtime-demo';

export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const { match } = await searchParams;
  let matches: DemoMatch[] = [];
  let error = '';
  try { matches = await publicDemoMatches(match && z.uuid().safeParse(match).success ? match : undefined); }
  catch { error = 'PostgreSQL est indisponible. Vérifiez la connexion puis appliquez les migrations et le seed.'; }
  return <RealtimeDemo key={matches[0]?.id ?? 'empty'} initialMatch={matches[0] ?? null} initialError={error} />;
}
