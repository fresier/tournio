'use client';
import { useState } from 'react';
import { ActionIcon, Button, Group, Popover, PopoverDropdown, PopoverTarget, Text } from '@mantine/core';

/** Corbeille discrète ; la suppression se confirme dans une bulle accrochée au bouton. */
export function DeleteButton({ name, message, onConfirm }: { name: string; message: string; onConfirm: () => Promise<unknown> | void }) {
  const [opened, setOpened] = useState(false);
  return <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" trapFocus returnFocus>
    <PopoverTarget>
      <ActionIcon variant="subtle" color="red" size="md" aria-label={`Supprimer ${name}`} onClick={() => setOpened((value) => !value)} style={{ flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
        </svg>
      </ActionIcon>
    </PopoverTarget>
    <PopoverDropdown maw={280}>
      <Text fz="sm" mb="sm">{message}</Text>
      <Group justify="flex-end" gap="xs">
        <Button size="xs" variant="default" onClick={() => setOpened(false)}>Annuler</Button>
        <Button size="xs" color="red" onClick={() => { setOpened(false); void onConfirm(); }}>Supprimer</Button>
      </Group>
    </PopoverDropdown>
  </Popover>;
}
