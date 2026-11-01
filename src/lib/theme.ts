import { createTheme, darken, defaultVariantColorsResolver, parseThemeColor, type CSSVariablesResolver, type MantineColorsTuple, type VariantColorsResolver } from '@mantine/core';

/** Bleu encre de Tournio (#12304b, nuance 8) et orange d’accent de la marque. */
const ink: MantineColorsTuple = ['#edf2f8', '#d9e3ef', '#b1c4dc', '#87a3c7', '#6587b5', '#4f76aa', '#3d6599', '#2a4d75', '#12304b', '#0a1f33'];
const accent: MantineColorsTuple = ['#fdf0e9', '#f8dccd', '#f0b799', '#e88f62', '#e06e36', '#d65a1f', '#c75119', '#b94817', '#9c3c12', '#7e300d'];

/**
 * Contraste AA garanti pour les variantes colorées (badges, boutons légers…) : les nuances Mantine
 * par défaut (teal, orange…) sont trop claires pour du texte. La couleur « ink » garde ses variables CSS,
 * que les pages publiques redéfinissent avec les couleurs du tournoi.
 */
const variantColorResolver: VariantColorsResolver = (input) => {
  const base = defaultVariantColorsResolver(input);
  const parsed = parseThemeColor({ color: input.color || input.theme.primaryColor, theme: input.theme });
  // Texte des boutons pleins de la couleur principale : blanc, ou noir sur une couleur vive (thème du tournoi).
  if (parsed.isThemeColor && parsed.color === 'ink' && input.variant === 'filled' && parsed.shade === undefined) return { ...base, color: 'var(--tournio-on-primary, #fff)' };
  if (!parsed.isThemeColor || parsed.color === 'ink' || parsed.color === 'accent') return base;
  const strong = darken(input.theme.colors[parsed.color][9], 0.3);
  // var(--tv-…) : redéfinies par les thèmes sombres de tournoi (src/lib/theme-variables.ts) ; sinon paire claire.
  const tone = (key: 'bg' | 'hover' | 'text', fallback: string) => `var(--tv-${parsed.color}-${key}, ${fallback})`;
  if (input.variant === 'light') return { ...base, background: tone('bg', input.theme.colors[parsed.color][0]), hover: tone('hover', input.theme.colors[parsed.color][1]), color: tone('text', strong) };
  if (input.variant === 'subtle') return { ...base, color: tone('text', strong) };
  if (input.variant === 'outline') return { ...base, color: tone('text', strong), border: `1px solid ${tone('text', strong)}` };
  if (input.variant === 'filled') return { ...base, background: darken(input.theme.colors[parsed.color][9], 0.15), hover: darken(input.theme.colors[parsed.color][9], 0.3), color: '#fff' };
  if (input.variant === 'white') return { ...base, color: strong };
  return base;
};

export const theme = createTheme({
  variantColorResolver,
  primaryColor: 'ink',
  primaryShade: 8,
  colors: { ink, accent },
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: { fontWeight: '750' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  black: '#12304b',
  // Cibles tactiles confortables au bord du terrain : boutons et champs en taille md (42 px).
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    NativeSelect: { defaultProps: { size: 'md' } },
    Checkbox: { defaultProps: { size: 'md' } },
    Badge: { defaultProps: { variant: 'light', radius: 'xl' } },
    Card: { defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    // Le message suit la couleur de la variante (contrastée avec son fond), pas la couleur du texte du thème.
    Alert: { styles: { message: { color: 'var(--alert-color)' } } },
  },
});

/** Texte secondaire plus foncé que le gris Mantine par défaut, pour un contraste WCAG AA (≥ 4,5:1). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: { '--tournio-accent': '#b94817' },
  light: { '--mantine-color-dimmed': '#52677b', '--mantine-color-body': '#f3f7fc' },
  dark: {},
});
