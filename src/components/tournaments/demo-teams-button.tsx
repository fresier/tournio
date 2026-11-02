'use client';
import { useState } from 'react';
import { Button, Group, NumberInput, Popover, PopoverDropdown, PopoverTarget, Text } from '@mantine/core';

/** Génère des équipes aux noms aléatoires, pour tester ou présenter un tournoi rapidement. */
export function DemoTeamsButton({ disabled, onGenerate }: { disabled: boolean; onGenerate: (count: number) => Promise<boolean> }) {
  const [opened, setOpened] = useState(false);
  const [count, setCount] = useState<number>(8);
  const valid = Number.isInteger(count) && count >= 1 && count <= 64;
  return <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" trapFocus returnFocus>
    <PopoverTarget>
      <Button variant="subtle" size="compact-sm" disabled={disabled} onClick={() => setOpened((value) => !value)}>Équipes de test</Button>
    </PopoverTarget>
    <PopoverDropdown maw={300}>
      <form onSubmit={(event) => { event.preventDefault(); if (valid) void onGenerate(count).then((done) => { if (done) setOpened(false); }); }}>
        <Text fz="sm" mb="xs">Ajoute des équipes aux noms aléatoires (Les Faucons, Les Ours bleus…), pratique pour un essai ou une démonstration.</Text>
        <Group align="flex-end" gap="xs">
          <NumberInput label="Nombre d’équipes" value={count} onChange={(value) => setCount(typeof value === 'number' ? value : Number(value) || 0)}
            min={1} max={64} step={1} allowDecimal={false} allowNegative={false} clampBehavior="strict" size="sm" w={150} error={valid ? undefined : 'Entre 1 et 64.'} />
          <Button type="submit" size="sm" disabled={!valid}>Générer</Button>
        </Group>
      </form>
    </PopoverDropdown>
  </Popover>;
}
