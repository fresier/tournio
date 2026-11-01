'use client';
import { useEffect } from 'react';
import { resolveAppearance, type Appearance } from '@/lib/appearance';
import { appearanceStylesheet } from '@/lib/theme-variables';

/**
 * Applique le thème du tournoi ouvert à tout le dashboard (barre latérale, menus déroulants compris).
 * Les couleurs sont posées par une feuille de style rendue côté serveur (pas de flash) ; le schéma
 * clair/sombre de Mantine est basculé sur <html> puis rétabli en quittant le tournoi.
 * Seules des couleurs #rrggbb validées entrent dans la feuille de style.
 */
export function TournamentTheme({ appearance }: { appearance: Appearance }) {
  const { scheme } = resolveAppearance(appearance);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-mantine-color-scheme', scheme);
    return () => root.setAttribute('data-mantine-color-scheme', 'light');
  }, [scheme]);
  return <style>{appearanceStylesheet(appearance)}</style>;
}
