/**
 * Apparence d’un tournoi : un thème préconfiguré (fond, cartes, texte, couleurs) que l’organisateur peut
 * personnaliser avec sa couleur principale et sa couleur d’accent. Code pur, partagé par le serveur,
 * le dashboard et les pages publiques.
 * Toutes les nuances dérivées sont choisies pour garder un contraste WCAG AA (4,5:1) sur le fond du thème.
 */

export const DEFAULT_PRIMARY = '#12304b';
export const DEFAULT_ACCENT = '#b94817';
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
/** Suggestions proposées dans le sélecteur ; toute autre couleur reste possible. */
export const COLOR_SWATCHES = ['#12304b', '#1d4ed8', '#0f766e', '#15803d', '#7c3aed', '#be123c', '#b94817', '#ca8a04', '#0e7490', '#334155'];

export type ThemePreset = {
  label: string; description: string; scheme: 'light' | 'dark';
  /** Fond de page ; null = teinte très claire de la couleur principale. */
  background: string | null;
  surface: string; text: string; primary: string; accent: string;
};

export const THEME_PRESETS = {
  tournio: { label: 'Tournio', description: 'Clair, bleu encre et orange', scheme: 'light', background: null, surface: '#ffffff', text: '#12304b', primary: '#12304b', accent: '#b94817' },
  sable: { label: 'Sable', description: 'Clair et chaleureux, tons terre', scheme: 'light', background: '#f5efe3', surface: '#fffdf8', text: '#2b2118', primary: '#8a4b14', accent: '#0f766e' },
  foret: { label: 'Forêt', description: 'Clair, vert profond et or', scheme: 'light', background: '#edf5ee', surface: '#ffffff', text: '#13261a', primary: '#166534', accent: '#a16207' },
  ocean: { label: 'Océan', description: 'Clair, bleu marin et corail', scheme: 'light', background: '#eaf5fb', surface: '#ffffff', text: '#0c2a3a', primary: '#0369a1', accent: '#e11d48' },
  contraste: { label: 'Contraste élevé', description: 'Noir sur blanc, lisible au soleil', scheme: 'light', background: '#ffffff', surface: '#ffffff', text: '#000000', primary: '#000000', accent: '#c2410c' },
  nuit: { label: 'Nuit', description: 'Sombre, bleu électrique et jaune', scheme: 'dark', background: '#0b1220', surface: '#151d2e', text: '#e6ebf5', primary: '#3b82f6', accent: '#fbbf24' },
  halloween: { label: 'Halloween', description: 'Violet nuit, noir et orange citrouille', scheme: 'dark', background: '#1c1029', surface: '#0e0a14', text: '#ffffff', primary: '#f7821b', accent: '#ff9a3d' },
  stade: { label: 'Stade', description: 'Sombre, vert pelouse et jaune', scheme: 'dark', background: '#0b1610', surface: '#13231a', text: '#e3f1e7', primary: '#22c55e', accent: '#facc15' },
} as const satisfies Record<string, ThemePreset>;

export type ThemeId = keyof typeof THEME_PRESETS;
export const THEME_IDS = Object.keys(THEME_PRESETS) as [ThemeId, ...ThemeId[]];
export const DEFAULT_THEME: ThemeId = 'tournio';
export const themePreset = (id: string | null | undefined): ThemePreset => THEME_PRESETS[(id ?? DEFAULT_THEME) as ThemeId] ?? THEME_PRESETS.tournio;

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as Rgb;
const toHex = (rgb: Rgb) => `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;
/** Mélange `hex` vers `target` (0 = hex, 1 = target). */
export const mix = (hex: string, target: string, ratio: number) => { const from = toRgb(hex); const to = toRgb(target); return toHex(from.map((value, index) => value + (to[index] - value) * ratio) as Rgb); };

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Nuances 0 (très claire) à 9 (très foncée) ; la couleur choisie est la nuance 6. */
export function palette(hex: string): string[] {
  return [0.92, 0.82, 0.64, 0.46, 0.3, 0.14].map((ratio) => mix(hex, '#ffffff', ratio))
    .concat(hex, mix(hex, '#000000', 0.22), mix(hex, '#000000', 0.42), mix(hex, '#000000', 0.6));
}

/** Première nuance, à partir de la couleur choisie, qui porte du texte blanc lisible (boutons pleins). */
export function readableShade(shades: string[]) {
  for (let index = 6; index < shades.length; index++) if (contrast(shades[index], '#ffffff') >= 4.5) return index;
  return shades.length - 1;
}

/** Nuance la plus proche de la couleur choisie qui reste lisible comme texte sur `background`. */
export function textShade(shades: string[], background: string) {
  const dark = luminance(background) < 0.18;
  const order = dark ? [6, 5, 4, 3, 2, 1, 0] : [6, 7, 8, 9];
  for (const index of order) if (contrast(shades[index], background) >= 4.5) return shades[index];
  return dark ? '#ffffff' : '#000000';
}

/** Texte lisible (blanc ou encre) sur un fond de la couleur donnée. */
export function textOn(hex: string) {
  return contrast(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#0b1b2b';
}

/** Mélange le texte vers le fond tant que le contraste reste au-dessus du seuil (texte secondaire). */
function softened(text: string, surface: string, minimum: number) {
  for (let ratio = 0.5; ratio > 0; ratio -= 0.05) { const value = mix(text, surface, ratio); if (contrast(value, surface) >= minimum) return value; }
  return text;
}

export type Appearance = { theme?: string | null; primary_color: string | null; accent_color: string | null; background_color?: string | null; surface_color?: string | null; text_color?: string | null };
export type ResolvedAppearance = { scheme: 'light' | 'dark'; vars: Record<string, string>; primary: string; accent: string; background: string; surface: string; text: string };

/**
 * Variables CSS à poser sur la racine d’une page publique (avec `data-mantine-color-scheme = scheme`) :
 * elles remplacent la couleur principale Mantine (« ink »), les couleurs de surface et de texte du schéma,
 * et l’accent de Tournio pour tout ce qui est rendu à l’intérieur.
 */
export function resolveAppearance({ theme, primary_color, accent_color, background_color, surface_color, text_color }: Appearance): ResolvedAppearance {
  const preset = themePreset(theme);
  const primary = primary_color ?? preset.primary;
  const accent = accent_color ?? preset.accent;
  const { scheme } = preset;
  const surface = surface_color ?? preset.surface;
  const text = text_color ?? preset.text;
  const shades = palette(primary);
  // Bouton plein : couleur exacte avec texte blanc si possible ; sinon couleur exacte avec texte noir
  // (une couleur vive comme l’orange) ; à défaut, nuance assombrie avec texte blanc.
  const darkInk = '#111111';
  const whiteOk = contrast(primary, '#ffffff') >= 4.5;
  const blackOk = !whiteOk && contrast(primary, darkInk) >= 4.5 && contrast(shades[5], darkInk) >= 4.5;
  const filled = whiteOk || blackOk ? primary : shades[readableShade(shades)];
  const hover = blackOk ? shades[5] : shades[Math.min(readableShade(shades) + 1, 9)];
  const onPrimary = blackOk ? darkInk : '#ffffff';
  // Fond des variantes « light » : très clair en thème clair, à peine teinté en thème sombre.
  const lightBg = scheme === 'dark' ? mix(primary, surface, 0.82) : shades[0];
  const lightHover = scheme === 'dark' ? mix(primary, surface, 0.74) : shades[1];
  const background = background_color ?? preset.background ?? shades[0];
  const sidebar = scheme === 'dark' ? mix(surface, primary, 0.08) : mix(background, primary, 0.04);
  // Les textes sont choisis pour le fond le plus défavorable : cartes, page, barre latérale, fond « light ».
  const grounds = [surface, background, sidebar, lightBg];
  const hardest = grounds.reduce((worstGround, ground) => contrast(text, ground) < contrast(text, worstGround) ? ground : worstGround);
  const primaryText = textShade(shades, hardest);
  const accentText = textShade(palette(accent), hardest);
  const dimmed = softened(text, hardest, 4.6);
  const border = mix(text, surface, scheme === 'dark' ? 0.7 : 0.78);

  const vars: Record<string, string> = {};
  shades.forEach((value, index) => { vars[`--mantine-color-ink-${index}`] = value; vars[`--mantine-primary-color-${index}`] = value; });
  Object.assign(vars, {
    '--mantine-color-ink-filled': filled, '--mantine-color-ink-filled-hover': hover,
    '--mantine-color-ink-light': lightBg, '--mantine-color-ink-light-hover': lightHover, '--mantine-color-ink-light-color': primaryText,
    '--mantine-color-ink-outline': primaryText, '--mantine-color-ink-outline-hover': lightBg, '--mantine-color-ink-text': primaryText,
    '--mantine-primary-color-filled': filled, '--mantine-primary-color-filled-hover': hover,
    '--mantine-primary-color-light': lightBg, '--mantine-primary-color-light-hover': lightHover, '--mantine-primary-color-light-color': primaryText,
    '--mantine-primary-color-contrast': onPrimary, '--tournio-on-primary': onPrimary, '--mantine-color-anchor': primaryText,
    // Couleurs du schéma (cartes, texte, bordures, champs).
    '--mantine-color-body': surface, '--mantine-color-text': text, '--mantine-color-bright': text, '--mantine-color-dimmed': dimmed,
    '--mantine-color-placeholder': dimmed, '--mantine-color-default': scheme === 'dark' ? mix(surface, text, 0.06) : surface,
    '--mantine-color-default-hover': mix(surface, text, scheme === 'dark' ? 0.12 : 0.05), '--mantine-color-default-color': text,
    '--mantine-color-default-border': border, '--mantine-color-gray-3': border,
    '--tournio-accent': accentText, '--tournio-page': background, '--tournio-tint': lightBg,
    '--tournio-sidebar': sidebar,
    '--tournio-banner': primary, '--tournio-banner-text': textOn(primary),
  });
  if (scheme === 'dark') {
    // Les styles sombres des composants Mantine utilisent la gamme dark-0…9 : on la recalcule depuis le thème.
    [text, mix(text, surface, 0.15), dimmed, mix(text, surface, 0.55), border, mix(surface, text, 0.16), mix(surface, text, 0.06), surface, background, mix(background, '#000000', 0.3)]
      .forEach((value, index) => { vars[`--mantine-color-dark-${index}`] = value; });
  }
  return { scheme, vars, primary, accent, background, surface, text };
}

/** Contrôle les couleurs personnalisées sur les surfaces réellement utilisées par l’interface. */
export function customThemeProblem(appearance: Appearance): string | null {
  const custom = [appearance.background_color, appearance.surface_color, appearance.text_color];
  if (custom.every((color) => color == null)) return null;
  if (custom.some((color) => color == null)) return 'Le fond, les cartes et le texte doivent être définis ensemble.';
  const { scheme, text, surface, background, vars } = resolveAppearance(appearance);
  const light = (color: string) => contrast(color, '#000000') >= contrast(color, '#ffffff');
  if ([surface, background].some((color) => light(color) !== (scheme === 'light'))) return 'Le fond et les cartes doivent être clairs pour un thème clair, ou sombres pour un thème sombre.';
  const grounds = [surface, background, vars['--tournio-sidebar'], vars['--mantine-color-ink-light']];
  if (grounds.some((ground) => contrast(text, ground) < 4.5)) return 'Le texte doit être suffisamment contrasté avec le fond et les cartes.';
  for (const foreground of [vars['--mantine-color-dimmed'], vars['--mantine-color-anchor'], vars['--tournio-accent']]) {
    if (grounds.some((ground) => contrast(foreground, ground) < 4.5)) return 'Ces couleurs ne permettent pas de garder les liens, les scores ou le texte secondaire lisibles sur toutes les surfaces.';
  }
  return null;
}

/** Compatibilité : variables seules. */
export const appearanceVariables = (appearance: Appearance) => resolveAppearance(appearance).vars;
