'use client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { cssVariablesResolver, theme } from '@/lib/theme';

/** Fournisseur Mantine côté client : le thème contient des fonctions, non transmissibles depuis un composant serveur. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light"><Notifications position="top-right" limit={1} zIndex={1000} />{children}</MantineProvider>;
}
