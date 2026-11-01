'use client';
import { Badge } from '@mantine/core';

const tournament = { DRAFT: ['Brouillon', 'gray'], PUBLISHED: ['Publié', 'teal'], COMPLETED: ['Terminé', 'ink'], ARCHIVED: ['Archivé', 'gray'] } as const;
const match = { SCHEDULED: ['Prévu', 'gray'], IN_PROGRESS: ['En cours', 'teal'], COMPLETED: ['Terminé', 'ink'], POSTPONED: ['Reporté', 'orange'], CANCELLED: ['Annulé', 'red'] } as const;

export function TournamentStatus({ status }: { status: keyof typeof tournament }) {
  const [label, color] = tournament[status];
  return <Badge color={color}>{label}</Badge>;
}

export function MatchStatus({ status }: { status: keyof typeof match }) {
  const [label, color] = match[status];
  return <Badge color={color}>{label}</Badge>;
}
