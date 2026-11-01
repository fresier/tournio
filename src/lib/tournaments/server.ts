import 'server-only';
import { cache } from 'react';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { configurationForUser, DomainError, tournamentsForUser } from './store';
import { z } from 'zod';

export const requireOrganizer = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return { user: session.user };
});

export async function listTournaments() {
  const { user } = await requireOrganizer();
  return tournamentsForUser(user.id);
}

export async function getConfiguration(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { user } = await requireOrganizer();
  try { return await configurationForUser(user.id, id); }
  catch (error) { if (error instanceof DomainError && error.status === 404) notFound(); throw error; }
}
