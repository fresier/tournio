'use client';
import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { Box, Paper, Text, UnstyledButton } from '@mantine/core';

/**
 * Glisser-déposer des équipes vers une poule (ou « Sans poule »), avec @dnd-kit/core :
 * souris, appui long sur téléphone, et clavier (Espace pour saisir, flèches, Espace pour déposer) avec annonces en français.
 * Les identifiants des éléments déplaçables portent leur origine (liste ou poule) : une même équipe apparaît aux deux endroits.
 */

const NONE = 'none';
type DragData = { teamId: string };

/** D’abord la zone sous le pointeur ; au clavier (sans pointeur), la zone recouverte par l’élément déplacé. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function TeamsDnd({ enabled, teams, pools, onMove, children }: {
  enabled: boolean;
  teams: { id: string; name: string }[];
  pools: { id: string; name: string }[];
  onMove: (teamId: string, poolId: string | null) => void;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Téléphone : appui long, pour ne pas gêner le défilement de la page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const teamName = (id: unknown) => teams.find((team) => team.id === (id as DragData | undefined)?.teamId)?.name ?? 'L’équipe';
  const zoneName = (id: unknown) => {
    const pool = String(id ?? '').replace(/^pool:/, '');
    return pool === NONE ? 'Sans poule' : pools.find((row) => row.id === pool)?.name ?? 'cette zone';
  };
  const announcements: Announcements = {
    onDragStart: ({ active: item }) => `${teamName(item.data.current)} saisie.`,
    onDragOver: ({ active: item, over }) => over ? `${teamName(item.data.current)} au-dessus de ${zoneName(over.id)}.` : `${teamName(item.data.current)} hors d’une poule.`,
    onDragEnd: ({ active: item, over }) => over ? `${teamName(item.data.current)} déposée dans ${zoneName(over.id)}.` : `${teamName(item.data.current)} reposée à sa place.`,
    onDragCancel: ({ active: item }) => `Déplacement de ${teamName(item.data.current)} annulé.`,
  };
  const end = (event: DragEndEvent) => {
    setActive(null);
    const teamId = (event.active.data.current as DragData | undefined)?.teamId;
    if (!teamId || !event.over) return;
    const pool = String(event.over.id).replace(/^pool:/, '');
    onMove(teamId, pool === NONE ? null : pool);
  };
  if (!enabled) return <>{children}</>;
  return <DndContext id="equipes-poules" sensors={sensors} collisionDetection={collision}
    onDragStart={(event: DragStartEvent) => setActive((event.active.data.current as DragData | undefined)?.teamId ?? null)}
    onDragEnd={end} onDragCancel={() => setActive(null)}
    accessibility={{ announcements, screenReaderInstructions: { draggable: 'Pour déplacer une équipe vers une poule : Espace ou Entrée pour la saisir, flèches pour la déplacer, Espace ou Entrée pour la déposer, Échap pour annuler.' } }}>
    {children}
    <DragOverlay dropAnimation={null}>{active ? <Paper shadow="md" px="md" py={6} radius="md" withBorder className="drag-chip"><Text fw={700}>{teams.find((team) => team.id === active)?.name}</Text></Paper> : null}</DragOverlay>
  </DndContext>;
}

/** Poignée de déplacement d’une équipe (⠿). `origin` distingue les exemplaires d’une même équipe. */
export function DragHandle({ teamId, name, origin, disabled }: { teamId: string; name: string; origin: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `team:${teamId}:${origin}`, data: { teamId } satisfies DragData, disabled });
  if (disabled) return null;
  return <UnstyledButton ref={setNodeRef} {...attributes} {...listeners} className="drag-handle" data-dragging={isDragging || undefined} aria-label={`Déplacer ${name}`}>
    <span aria-hidden="true">⠿</span>
  </UnstyledButton>;
}

/** Zone de dépôt : une poule, ou « Sans poule » (`poolId` null). */
export function DropZone({ poolId, disabled, children }: { poolId: string | null; disabled?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `pool:${poolId ?? NONE}`, disabled });
  return <Box ref={setNodeRef} className="drop-zone" data-over={isOver || undefined} data-dragging={active ? true : undefined}>{children}</Box>;
}
