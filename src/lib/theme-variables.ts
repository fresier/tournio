import { DEFAULT_THEME } from '@mantine/core';
import { contrast, mix, resolveAppearance, type Appearance } from './appearance';

/** Couleurs Mantine utilisables en variantes (badges, alertes, boutons légers…), hors couleurs de Tournio. */
const VARIANT_COLORS = Object.keys(DEFAULT_THEME.colors).filter((name) => name !== 'dark');

/**
 * En thème sombre, les variantes « light », « subtle » et « outline » ne doivent pas rester des pavés clairs :
 * leur fond devient une teinte sombre de la couleur, et leur texte la nuance claire la plus proche lisible (AA).
 * Le résolveur de variantes du thème Mantine lit ces variables (--tv-<couleur>-bg|hover|text).
 */
export function variantVariables(scheme: 'light' | 'dark', surface: string): Record<string, string> {
  if (scheme !== 'dark') return {};
  const vars: Record<string, string> = {};
  for (const name of VARIANT_COLORS) {
    const shades = DEFAULT_THEME.colors[name];
    const background = mix(shades[8], surface, 0.72);
    const text = [4, 3, 2, 1, 0].map((index) => shades[index]).find((value) => contrast(value, background) >= 4.5 && contrast(value, surface) >= 4.5) ?? '#ffffff';
    Object.assign(vars, { [`--tv-${name}-bg`]: background, [`--tv-${name}-hover`]: mix(shades[8], surface, 0.6), [`--tv-${name}-text`]: text });
  }
  return vars;
}

/** Toutes les variables d’apparence d’un tournoi : couleurs du thème et variantes adaptées au schéma. */
export function themedAppearance(appearance: Appearance) {
  const resolved = resolveAppearance(appearance);
  return { ...resolved, vars: { ...resolved.vars, ...variantVariables(resolved.scheme, resolved.surface) } };
}

/** Feuille de style qui applique l’apparence à toute la page (dashboard d’un tournoi ouvert). */
export function appearanceStylesheet(appearance: Appearance) {
  const { vars } = themedAppearance(appearance);
  // Sélecteur renforcé : passe devant les variables de schéma que Mantine pose sur :root[data-mantine-color-scheme].
  const declarations = Object.entries(vars).filter(([, value]) => /^#[0-9a-f]{6}$/.test(value)).map(([key, value]) => `${key}:${value}`).join(';');
  return `:root:root[data-mantine-color-scheme]{${declarations}}body{background:var(--tournio-page)}`;
}
