import { z } from 'zod';
import { HEX_COLOR, resolveAppearance, THEME_IDS, type Appearance } from '@/lib/appearance';
import { appearanceInputSchema } from './contracts';

const color = z.string().trim().toLowerCase().regex(HEX_COLOR, 'Chaque couleur doit être au format #rrggbb.');
export const themeFileSchema = z.strictObject({
  format: z.literal('tournio-theme'),
  version: z.literal(1),
  base: z.enum(THEME_IDS, 'Thème de départ inconnu.'),
  couleurs: z.strictObject({ principale: color, accent: color, fond: color, cartes: color, texte: color }),
});

/** Le fichier contient des couleurs explicites, même quand elles viennent du thème de départ. */
export function exportThemeFile(appearance: Appearance) {
  const resolved = resolveAppearance(appearance);
  return themeFileSchema.parse({ format: 'tournio-theme', version: 1, base: appearance.theme ?? 'tournio',
    couleurs: { principale: resolved.primary, accent: resolved.accent, fond: resolved.background, cartes: resolved.surface, texte: resolved.text } });
}

/** Applique la même validation des couleurs et du contraste que l’API. */
export function importThemeFile(value: unknown) {
  const file = themeFileSchema.parse(value);
  return appearanceInputSchema.parse({ theme: file.base, primary_color: file.couleurs.principale, accent_color: file.couleurs.accent,
    background_color: file.couleurs.fond, surface_color: file.couleurs.cartes, text_color: file.couleurs.texte });
}
