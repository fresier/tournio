import assert from 'node:assert/strict';
import test from 'node:test';
import { contrast, palette, readableShade, resolveAppearance, textOn, THEME_IDS, THEME_PRESETS } from '../src/lib/appearance';
import { appearanceInputSchema } from '../src/lib/tournaments/contracts';
import { publicSnapshot } from '../src/lib/public/snapshot';

test('palette : 10 nuances, couleur choisie en nuance 6, du clair au foncé', () => {
  const shades = palette('#1d4ed8');
  assert.equal(shades.length, 10);
  assert.equal(shades[6], '#1d4ed8');
  for (let i = 1; i < 10; i++) assert(contrast(shades[i], '#ffffff') >= contrast(shades[i - 1], '#ffffff'));
  assert.equal(readableShade(palette('#12304b')), 6);
  assert.equal(textOn('#ffeb3b'), '#0b1b2b');
});

test('chaque thème, avec n’importe quelle couleur choisie, reste lisible (WCAG AA)', () => {
  const colors = [null, '#ffeb3b', '#7dd3fc', '#fde68a', '#12304b', '#be123c', '#ffffff', '#000000', '#22c55e'];
  for (const theme of THEME_IDS) for (const color of colors) {
    const { vars, surface, text } = resolveAppearance({ theme, primary_color: color, accent_color: color });
    const label = `${theme} / ${color}`;
    assert(contrast(text, surface) >= 7, `texte ${label}`);
    for (const ground of [surface, vars['--tournio-page'], vars['--tournio-sidebar']]) assert(contrast(vars['--mantine-color-dimmed'], ground) >= 4.5, `texte secondaire ${label} sur ${ground}`);
    assert(contrast(vars['--mantine-primary-color-filled'], vars['--tournio-on-primary']) >= 4.5, `bouton ${label}`);
    assert(contrast(vars['--mantine-primary-color-filled-hover'], vars['--tournio-on-primary']) >= 4.5, `bouton survolé ${label}`);
    for (const ground of [surface, vars['--tournio-page'], vars['--tournio-sidebar']]) assert(contrast(vars['--mantine-color-anchor'], ground) >= 4.5, `lien ${label} sur ${ground}`);
    assert(contrast(vars['--mantine-color-ink-light-color'], vars['--mantine-color-ink-light']) >= 4.5, `badge ${label}`);
    assert(contrast(vars['--tournio-accent'], surface) >= 4.5, `accent ${label}`);
    assert(contrast(vars['--tournio-banner'], vars['--tournio-banner-text']) >= 4.5, `bandeau ${label}`);
  }
});

test('thèmes : couleurs du préréglage par défaut, schéma sombre et gamme dark recalculée', () => {
  const nuit = resolveAppearance({ theme: 'nuit', primary_color: null, accent_color: null });
  assert.equal(nuit.scheme, 'dark');
  assert.equal(nuit.primary, THEME_PRESETS.nuit.primary);
  assert.equal(nuit.vars['--mantine-color-dark-7'], THEME_PRESETS.nuit.surface);
  const tournio = resolveAppearance({ theme: null, primary_color: '#0f766e', accent_color: null });
  assert.equal(tournio.scheme, 'light');
  assert.equal(tournio.vars['--tournio-banner'], '#0f766e');
  assert.equal(tournio.vars['--mantine-color-dark-7'], undefined);
  const halloween = resolveAppearance({ theme: 'halloween', primary_color: null, accent_color: null }).vars;
  assert.deepEqual([halloween['--mantine-primary-color-filled'], halloween['--tournio-on-primary']], ['#f7821b', '#111111'], 'orange vif, texte noir');
  assert.equal(resolveAppearance({ theme: 'inconnu', primary_color: null, accent_color: null }).primary, THEME_PRESETS.tournio.primary);
});

test('validation : thème connu et couleurs au format #rrggbb', () => {
  assert.deepEqual(appearanceInputSchema.parse({ theme: 'nuit', primary_color: ' #1D4ED8 ', accent_color: null }), { theme: 'nuit', primary_color: '#1d4ed8', accent_color: null });
  assert(!appearanceInputSchema.safeParse({ theme: 'disco', primary_color: null, accent_color: null }).success);
  for (const bad of ['red', '#fff', '#12345g', 'url(x)', '#1d4ed8;color:red']) assert(!appearanceInputSchema.safeParse({ theme: 'tournio', primary_color: bad, accent_color: null }).success, bad);
});

test('instantané public : thème et couleurs transmis, valeurs par défaut', () => {
  const base = { name: 'T', slug: 't', sport: 'Volley', location: '', timezone: 'Europe/Brussels', starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z', status: 'PUBLISHED', version: 1, rules: null, pools: [], teams: [], pool_teams: [], courts: [], matches: [] };
  assert.equal(publicSnapshot(base).tournament.theme, 'tournio');
  assert.equal(publicSnapshot(base).tournament.primary_color, null);
  const custom = publicSnapshot({ ...base, theme: 'stade', primary_color: '#0f766e', accent_color: '#ca8a04' }).tournament;
  assert.deepEqual([custom.theme, custom.accent_color], ['stade', '#ca8a04']);
});

test('thèmes sombres : badges et alertes colorés deviennent sombres, texte lisible', async () => {
  const { variantVariables } = await import('../src/lib/theme-variables');
  for (const theme of THEME_IDS) {
    const { scheme, surface } = resolveAppearance({ theme, primary_color: null, accent_color: null });
    const vars = variantVariables(scheme, surface);
    if (scheme === 'light') { assert.deepEqual(vars, {}); continue; }
    for (const color of ['gray', 'teal', 'red', 'orange', 'green', 'blue', 'yellow']) {
      assert(contrast(vars[`--tv-${color}-bg`], '#ffffff') > 7, `${theme} ${color} : fond sombre`);
      assert(contrast(vars[`--tv-${color}-text`], vars[`--tv-${color}-bg`]) >= 4.5, `${theme} ${color} : texte sur fond`);
      assert(contrast(vars[`--tv-${color}-text`], surface) >= 4.5, `${theme} ${color} : texte sur carte`);
    }
  }
});
