'use client';
import { useId, useState } from 'react';
import { Box, Collapse, UnstyledButton } from '@mantine/core';

/** Section repliable accessible (bouton aria-expanded + zone contrôlée), à la place de <details>. */
export function Disclosure({ label, children, danger = false }: { label: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Box className="disclosure">
    <UnstyledButton className="disclosure-toggle" data-danger={danger || undefined} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true" className="disclosure-chevron">{open ? '▾' : '▸'}</span>{label}
    </UnstyledButton>
    <Collapse expanded={open} id={id}><Box pt="sm">{children}</Box></Collapse>
  </Box>;
}
