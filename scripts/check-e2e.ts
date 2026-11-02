import './load-env.mjs';
import assert from 'node:assert/strict';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, devices, webkit, type Browser, type Page } from 'playwright';
import { getPrisma } from '../src/lib/database/client';
import { assertIsolatedTestDatabase } from './test-database';
import { login, origin } from './test-http';
import { createPilot } from './test-pilot';
import { contrast } from '../src/lib/appearance';

const rgbToHex = (value: string) => `#${(value.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => Math.round(Number(part)).toString(16).padStart(2, '0')).join('')}`;

/**
 * Parcours navigateur complet du pilote 12 équipes / 3 poules / 3 terrains (lot H).
 * - Organisateur : Chromium bureau, puis téléphone ; navigation au clavier.
 * - Spectateur : WebKit iPhone, fuseau America/New_York, stockage local indisponible, perte et reprise du réseau.
 * Chaque page est contrôlée : aucune erreur console (hydratation comprise), aucun défilement horizontal,
 * aucune violation d’accessibilité grave ou critique (axe-core).
 */
assertIsolatedTestDatabase();
const db = getPrisma();
const browsers: Browser[] = [];
let fixture: string | undefined;
const problems: string[] = [];
const pages = new Map<string, Page>();

function watch(page: Page, label: string) {
  pages.set(label, page);
  page.on('pageerror', (error) => problems.push(`${label} — exception : ${error.message}`));
  page.on('console', (message) => {
    // Les coupures volontaires du réseau produisent des erreurs de chargement attendues.
    if (message.type() === 'error' && !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|EventSource|access control checks|network connection was lost/i.test(message.text())) problems.push(`${label} — console : ${message.text()}`);
  });
  page.on('dialog', (dialog) => void dialog.accept());
}

async function audit(page: Page, label: string) {
  // Next.js diffuse les métadonnées après une navigation client : on attend le <title> avant l’audit.
  await page.waitForFunction(() => document.title.length > 0);
  // Fin des animations en cours (apparition d’une notification…) : un élément en fondu fausserait la mesure du contraste.
  await page.evaluate(`Promise.race([Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null))), new Promise((resolve) => setTimeout(resolve, 2000))])`);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  for (const violation of result.violations) if (!serious.includes(violation)) console.log(`  (info) ${label} — ${violation.id} : ${violation.help}`);
  assert.deepEqual(serious.map((violation) => `${violation.id} : ${violation.help} → ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ')}`), [], `Accessibilité ${label}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${label} : défilement horizontal de ${overflow} px`);
}

/** Contraste texte/fond d’un élément survolé (axe ne teste pas l’état :hover). */
async function hoverContrast(page: Page, label: string, locator: ReturnType<Page['locator']>) {
  await locator.hover();
  await page.waitForTimeout(250); // transitions Mantine
  // Pas de fonction nommée dans le callback : tsx y injecterait un helper `__name` absent de la page.
  const [color, background] = await locator.evaluate((element) => {
    let node: Element | null = element;
    let background = 'rgb(255, 255, 255)';
    while (node) {
      const value = getComputedStyle(node).backgroundColor;
      const alpha = value.startsWith('rgba') ? Number(value.split(',')[3].replace(')', '')) : 1;
      if (alpha > 0.5) { background = value; break; }
      node = node.parentElement;
    }
    return [getComputedStyle(element).color, background];
  });
  const ratio = contrast(rgbToHex(color), rgbToHex(background));
  assert(ratio >= 4.5, `${label} : contraste au survol ${ratio.toFixed(2)}:1`);
  await page.mouse.move(0, 0);
}

async function signedIn(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const cookie = await login('TEST_OWNER');
  const context = await browser.newContext({ locale: 'fr-BE', timezoneId: 'Europe/Brussels', ...options });
  await context.addCookies(cookie.split('; ').map((pair) => {
    const index = pair.indexOf('=');
    return { name: pair.slice(0, index), value: pair.slice(index + 1), url: origin };
  }));
  return context;
}

/** Atteint un contrôle uniquement avec Tab, comme un utilisateur clavier. */
async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    // La coche « ✓ » d’un onglet complété ne fait pas partie de son nom.
    if (await page.evaluate((text) => document.activeElement?.textContent?.replace('✓', '').trim() === text, name)) return;
  }
  throw new Error(`« ${name} » n’est pas atteignable au clavier.`);
}

async function enterScore(page: Page, home: number, away: number) {
  const row = page.locator('.result-row').first();
  const [homeName, awayName] = await row.locator('.result-final strong').allTextContents();
  await row.locator('input[name=home_score]').fill(String(home));
  await row.locator('input[name=away_score]').fill(String(away));
  await row.locator('input[name=away_score]').press('Enter');
  await page.getByText(`Résultat enregistré : ${homeName} ${home} – ${away} ${awayName}.`).waitFor();
  return { homeName, awayName };
}

const publicScore = (page: Page, home: string, away: string) =>
  page.locator('.public-match').filter({ hasText: home }).filter({ hasText: away }).locator('.public-match-score');

try {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200, 'Sonde de santé');
  const home = await fetch(`${origin}/`);
  for (const header of ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'content-security-policy']) assert(home.headers.get(header), `En-tête ${header}`);
  assert.equal(home.headers.get('x-powered-by'), null);
  console.log('OK — Sonde de santé et en-têtes de sécurité.');

  const cookie = await login('TEST_OWNER');
  const data = await createPilot(cookie, 'Pilote navigateur');
  fixture = data.tournament.id;
  const t = data.tournament;
  const desktop = await chromium.launch(); browsers.push(desktop);
  const phone = await webkit.launch(); browsers.push(phone);

  // Pages d’accueil et de connexion, sans session.
  const anonymous = await desktop.newContext({ locale: 'fr-BE' });
  const landing = await anonymous.newPage(); watch(landing, 'accueil');
  await landing.goto(`${origin}/`); await audit(landing, 'accueil');
  await landing.goto(`${origin}/login`); await landing.getByRole('button', { name: /Google/ }).waitFor(); await audit(landing, 'connexion');
  assert.equal(await landing.locator('input[type=password]').count(), 0, 'Aucun champ mot de passe : connexion Google uniquement');
  await anonymous.close();
  console.log('OK — Accueil et connexion Google uniquement, accessibles.');

  // Organisateur : calendrier au clavier, prévisualisation, enregistrement et publication.
  const organizer = await signedIn(desktop, { viewport: { width: 1280, height: 900 } });
  const admin = await organizer.newPage(); watch(admin, 'dashboard');
  await admin.goto(`${origin}/dashboard`); await admin.getByText('Pilote navigateur').first().waitFor(); await audit(admin, 'dashboard');
  await admin.goto(`${origin}/dashboard/tournaments/${t.id}`);
  await admin.getByRole('heading', { level: 1, name: 'Pilote navigateur' }).waitFor(); await audit(admin, 'configuration');
  // Partage de la gestion avant publication, depuis l’interface du propriétaire.
  await admin.getByRole('tab', { name: 'Partage', exact: true }).click();
  const managerEmail = process.env.TEST_OTHER_EMAIL!;
  await admin.getByRole('textbox', { name: 'Adresse e-mail du gestionnaire' }).fill(managerEmail);
  await admin.getByRole('button', { name: 'Ajouter l’accès' }).click();
  await admin.getByRole('button', { name: `Retirer l’accès à ${managerEmail}` }).waitFor();
  await audit(admin, 'partage de la gestion');
  const otherCookie = await login('TEST_OTHER');
  const otherContext = await desktop.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
  await otherContext.addCookies(otherCookie.split('; ').map((pair) => {
    const index = pair.indexOf('=');
    return { name: pair.slice(0, index), value: pair.slice(index + 1), url: origin };
  }));
  const otherPage = await otherContext.newPage(); watch(otherPage, 'gestionnaire invité');
  await otherPage.goto(`${origin}/dashboard`);
  const sharedCard = otherPage.getByRole('article').filter({ hasText: 'Pilote navigateur' });
  await sharedCard.getByText('Partagé avec vous').waitFor();
  await sharedCard.getByRole('link', { name: /Configurer/ }).click();
  await otherPage.getByRole('tab', { name: 'Partage', exact: true }).click();
  await otherPage.getByText(/Seul son propriétaire peut ajouter ou retirer/).waitFor();
  assert.equal(await otherPage.getByRole('textbox', { name: 'Adresse e-mail du gestionnaire' }).count(), 0);
  await audit(otherPage, 'partage vu par le gestionnaire');
  await admin.getByRole('button', { name: `Retirer l’accès à ${managerEmail}` }).click();
  await admin.getByText('Accès retiré.').waitFor();
  await otherPage.goto(`${origin}/dashboard`);
  assert.equal(await otherPage.getByRole('article').filter({ hasText: 'Pilote navigateur' }).count(), 0);
  await otherContext.close();
  console.log('OK — Partage d’un brouillon, accès du gestionnaire et révocation depuis le navigateur.');
  // Glisser-déposer (brouillon) : une équipe de la liste vers la Poule B, puis retour en Poule A depuis la carte de poule.
  // Fenêtre haute : la poule cible doit être visible (sinon le défilement automatique déplace la cible pendant le test).
  await admin.setViewportSize({ width: 1280, height: 1600 });
  await admin.getByRole('tab', { name: 'Équipes et poules', exact: true }).click();
  const poolOf = async (name: string) => (await db.poolTeam.findFirstOrThrow({ where: { tournament_id: t.id, team: { name } }, include: { pool: true } })).pool.name;
  const drag = async (handle: ReturnType<Page['locator']>, target: ReturnType<Page['locator']>) => {
    const from = (await handle.boundingBox())!; const to = (await target.boundingBox())!;
    await admin.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await admin.mouse.down();
    await admin.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await admin.mouse.up();
  };
  const poolCard = (name: string) => admin.locator('.drop-zone').filter({ has: admin.getByRole('button', { name: `${name} — renommer (Entrée)` }) });
  await drag(admin.getByRole('listitem', { name: 'Équipe Les Renards' }).getByRole('button', { name: 'Déplacer Les Renards' }), poolCard('Poule B'));
  for (let i = 0; i < 20 && await poolOf('Les Renards') !== 'Poule B'; i++) await admin.waitForTimeout(250);
  assert.equal(await poolOf('Les Renards'), 'Poule B', 'déposée dans la Poule B');
  await drag(poolCard('Poule B').getByRole('button', { name: 'Déplacer Les Renards' }), poolCard('Poule A'));
  for (let i = 0; i < 20 && await poolOf('Les Renards') !== 'Poule A'; i++) await admin.waitForTimeout(250);
  assert.equal(await poolOf('Les Renards'), 'Poule A', 'revenue en Poule A');
  // Clavier : Espace saisit l’équipe, Échap annule sans rien changer.
  await admin.getByRole('listitem', { name: 'Équipe Les Éclairs' }).getByRole('button', { name: 'Déplacer Les Éclairs' }).focus();
  await admin.keyboard.press('Space');
  await admin.getByText('Les Éclairs saisie.').waitFor({ state: 'attached' });
  // dnd-kit n’écoute Échap qu’au tick suivant la saisie (pour ignorer la touche qui l’a lancée).
  await admin.waitForTimeout(200);
  await admin.keyboard.press('Escape');
  await admin.getByText('Déplacement de Les Éclairs annulé.').waitFor({ state: 'attached' });
  assert.equal(await poolOf('Les Éclairs'), 'Poule A');
  await audit(admin, 'glisser-déposer des équipes');
  await admin.setViewportSize({ width: 1280, height: 900 });
  console.log('OK — Équipes glissées-déposées entre poules (souris), saisie et annulation au clavier annoncées.');

  // Renommer une équipe et une poule d’un clic (brouillon) : le nom change, l’identifiant du lien reste.
  await admin.getByRole('tab', { name: 'Équipes et poules', exact: true }).click();
  await admin.getByRole('button', { name: 'Les Renards — renommer (Entrée)' }).click();
  await admin.getByRole('textbox', { name: 'Nouveau nom de Les Renards' }).fill('Les Renards du Nord');
  await admin.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await admin.getByRole('button', { name: 'Les Renards du Nord — renommer (Entrée)' }).waitFor();
  assert.equal((await db.team.findFirstOrThrow({ where: { tournament_id: t.id, name: 'Les Renards du Nord' } })).slug, 'equipe-1', 'identifiant du lien inchangé');
  await audit(admin, 'équipes et poules (brouillon)');
  await admin.getByRole('button', { name: 'Les Renards du Nord — renommer (Entrée)' }).click();
  await admin.getByRole('textbox', { name: 'Nouveau nom de Les Renards du Nord' }).fill('Les Renards');
  await admin.getByRole('textbox', { name: 'Nouveau nom de Les Renards du Nord' }).press('Enter');
  await admin.getByRole('button', { name: 'Les Renards — renommer (Entrée)' }).waitFor();
  // Au clavier : Entrée sur le nom de la poule ouvre l’édition, Échap annule, clic puis Entrée enregistre.
  await admin.getByRole('button', { name: 'Poule A — renommer (Entrée)' }).focus();
  await admin.keyboard.press('Enter');
  await admin.getByRole('textbox', { name: 'Nouveau nom de Poule A' }).press('Escape');
  await admin.getByRole('button', { name: 'Poule A — renommer (Entrée)' }).click();
  await admin.getByRole('textbox', { name: 'Nouveau nom de Poule A' }).fill('Poule Alpha');
  await admin.getByRole('textbox', { name: 'Nouveau nom de Poule A' }).press('Enter');
  await admin.getByRole('button', { name: 'Poule Alpha — renommer (Entrée)' }).waitFor();
  await admin.getByRole('button', { name: 'Poule Alpha — renommer (Entrée)' }).click();
  await admin.getByRole('textbox', { name: 'Nouveau nom de Poule Alpha' }).fill('Poule A');
  await admin.getByRole('textbox', { name: 'Nouveau nom de Poule Alpha' }).press('Enter');
  await admin.getByRole('button', { name: 'Poule A — renommer (Entrée)' }).waitFor();
  await admin.getByRole('tab', { name: 'Paramètres', exact: true }).click();
  await admin.getByRole('heading', { level: 1, name: 'Pilote navigateur' }).click(); // repart du haut pour la navigation clavier

  // Onglets ARIA : Tab atteint l’onglet actif, les flèches passent aux suivants.
  await tabTo(admin, 'Paramètres');
  for (let i = 0; i < 12 && !await admin.evaluate(() => document.activeElement?.textContent?.replace('✓', '').trim() === 'Calendrier'); i++) await admin.keyboard.press('ArrowRight');
  await admin.getByRole('tab', { name: 'Calendrier', selected: true }).waitFor();
  await tabTo(admin, 'Prévisualiser le calendrier'); await admin.keyboard.press('Enter');
  await admin.getByText(/^18 matchs de /).waitFor();
  await audit(admin, 'prévisualisation');
  await admin.getByRole('button', { name: 'Enregistrer ce calendrier' }).click();
  await admin.getByText('Calendrier enregistré. Vérifiez-le').waitFor();
  await admin.getByRole('button', { name: 'Publier le tournoi' }).click();
  await admin.getByText('Tournoi publié.', { exact: true }).waitFor();
  assert.equal(await db.match.count({ where: { tournament_id: t.id } }), 18);
  // Onglets complétés : tout ce qui précède la publication est coché (Résultats et Partage non).
  await admin.waitForFunction(() => document.querySelectorAll('.tab-done').length === 5);
  for (const [label, locator] of [
    ['Lien « Liens et QR codes »', admin.getByRole('button', { name: 'Liens et QR codes' })],
    ['Bouton « Recharger »', admin.getByRole('button', { name: 'Recharger' })],
    ['Bouton « Archiver »', admin.getByRole('button', { name: 'Archiver le tournoi' })],
    ['Onglet « Équipes »', admin.getByRole('tab', { name: 'Équipes' })],
    ['Lien de navigation', admin.getByRole('link', { name: 'Créer un tournoi' })],
  ] as const) await hoverContrast(admin, label, locator);
  console.log('OK — Calendrier du pilote 12/3/3 prévisualisé, enregistré et publié depuis le navigateur, au clavier.');

  // Spectateur : iPhone, autre fuseau, stockage indisponible.
  const spectator = await phone.newContext({ ...devices['iPhone 13'], locale: 'en-US', timezoneId: 'America/New_York' });
  // Script en texte : transpilé par tsx, une fonction recevrait des helpers absents de la page.
  await spectator.addInitScript(`Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Stockage bloqué', 'SecurityError'); } });`);
  const viewer = await spectator.newPage(); watch(viewer, 'page publique');
  await viewer.goto(`${origin}/t/${t.slug}`);
  await viewer.getByText('En direct').waitFor();
  assert.equal(await viewer.evaluate(() => { try { return typeof window.localStorage.getItem('x'); } catch { return 'bloqué'; } }), 'bloqué');
  const firstTime = await viewer.locator('.public-match-time').first().textContent();
  assert.equal(firstTime, '09:00', 'Horaires affichés dans le fuseau du tournoi, pas celui du téléphone');
  await audit(viewer, 'page publique mobile');
  await viewer.getByRole('combobox').selectOption({ label: 'Les Renards' });
  await viewer.getByRole('button', { name: 'Suivre cette équipe' }).click();
  await viewer.waitForURL(/\/teams\/equipe-1$/);
  await viewer.getByText('Prochain match').waitFor();
  await audit(viewer, 'page équipe mobile');
  await viewer.goto(`${origin}/t/${t.slug}`);
  await viewer.getByText('Quelle est votre équipe ?').waitFor(); // préférence non mémorisée, sans erreur
  // Poule choisie gardée dans l’URL, puis retour à toutes les poules.
  await viewer.getByRole('tab', { name: 'Poule B' }).click();
  await viewer.waitForURL(/[?&]poule=poule-b/);
  await viewer.reload();
  await viewer.getByRole('tab', { name: 'Poule B', selected: true }).waitFor();
  await viewer.getByRole('tab', { name: 'Toutes les poules' }).click();
  await viewer.waitForURL((url) => !url.searchParams.has('poule'));
  // Déploiement pendant que la page est ouverte : un instantané illisible par l’ancien code fait recharger la page.
  const snapshotUrl = `**/api/v1/tournaments/${t.slug}`;
  await viewer.route(snapshotUrl, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.tournament.champ_futur = true;
    await route.fulfill({ response, json: body });
  });
  const reloaded = viewer.waitForEvent('load', { timeout: 15_000 });
  await viewer.evaluate(() => window.dispatchEvent(new Event('online')));
  await reloaded;
  await viewer.unroute(snapshotUrl);
  await viewer.getByText('En direct').waitFor();
  console.log('OK — Spectateur iPhone (WebKit) : fuseau du tournoi, page équipe, stockage local indisponible.');

  // Résultat saisi au clavier → visible sans rechargement.
  await admin.getByRole('tab', { name: 'Résultats', exact: true }).click();
  // Onglet gardé dans l’URL : il survit au rechargement.
  await admin.waitForURL(/[?&]onglet=resultats/);
  await admin.reload();
  await admin.getByRole('tab', { name: 'Résultats', selected: true }).waitFor();
  await audit(admin, 'résultats');
  // Lancement groupé du premier créneau : tous ses matchs passent « en cours », aussi sur le téléphone.
  await admin.getByRole('button', { name: /^Lancer les \d+ matchs$/ }).first().click();
  await admin.getByText(/matchs lancés/).waitFor();
  await viewer.locator('.public-match[data-tone="live"]').nth(1).waitFor({ timeout: 10_000 });
  const first = await enterScore(admin, 3, 1);
  await publicScore(viewer, first.homeName, first.awayName).filter({ hasText: '3 – 1' }).waitFor({ timeout: 10_000 });
  console.log('OK — Score saisi au clavier, affiché en direct sur le téléphone.');

  // Thème et couleurs choisis dans l’onglet Apparence → appliqués en direct sur le téléphone.
  await admin.getByRole('tab', { name: 'Paramètres', exact: true }).click();
  await admin.getByRole('heading', { name: 'Apparence du tournoi' }).scrollIntoViewIfNeeded();
  await audit(admin, 'apparence');
  const primary = admin.getByRole('textbox', { name: 'Couleur principale' });
  await primary.fill('#0f766e');
  await admin.getByRole('heading', { name: 'Apparence du tournoi' }).click(); // ferme la palette
  await admin.getByRole('button', { name: 'Enregistrer l’apparence' }).click();
  await admin.getByText('Modification enregistrée.').waitFor();
  await viewer.waitForFunction(() => getComputedStyle(document.querySelector('.public-banner')!).backgroundColor === 'rgb(15, 118, 110)', undefined, { timeout: 10_000 });
  await audit(viewer, 'page publique colorée');
  // Thème sombre « Halloween » : fond, cartes et texte changent, toujours accessibles.
  await admin.getByRole('radio', { name: /Halloween/ }).check();
  await audit(admin, 'aperçu Halloween');
  await admin.getByRole('button', { name: 'Enregistrer l’apparence' }).click();
  await admin.getByText('Modification enregistrée.').waitFor();
  await viewer.waitForFunction(() => document.querySelector('.public-root')?.getAttribute('data-mantine-color-scheme') === 'dark'
    && getComputedStyle(document.querySelector('.public-banner')!).backgroundColor === 'rgb(247, 130, 27)', undefined, { timeout: 10_000 });
  await audit(viewer, 'page publique Halloween');
  // Le dashboard du tournoi ouvert adopte son thème (schéma sombre compris).
  await admin.waitForFunction(() => document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark');
  await audit(admin, 'dashboard Halloween');
  for (const [label, locator] of [
    ['Halloween — lien « Liens et QR codes »', admin.getByRole('button', { name: 'Liens et QR codes' })],
    ['Halloween — onglet « Équipes »', admin.getByRole('tab', { name: 'Équipes' })],
    ['Halloween — bouton « Enregistrer »', admin.getByRole('button', { name: 'Enregistrer l’apparence' })],
    ['Halloween — navigation', admin.getByRole('link', { name: 'Créer un tournoi' })],
  ] as const) await hoverContrast(admin, label, locator);
  await admin.getByRole('tab', { name: 'Résultats', exact: true }).click();
  console.log('OK — Thème et couleurs du tournoi appliqués en direct sur la page publique (thème sombre compris), et au dashboard du tournoi, accessibles.');

  // Équipes et poules : deux colonnes égales, équipes à gauche, poules (et tirage au sort) à droite.
  await admin.getByRole('tab', { name: 'Équipes et poules', exact: true }).click();
  await admin.getByRole('heading', { name: 'Ajouter une poule' }).waitFor();
  const [teamsBox, poolsBox] = await Promise.all(['Ajouter une équipe', 'Ajouter une poule'].map((name) => admin.getByRole('heading', { name }).boundingBox()));
  assert(teamsBox && poolsBox && poolsBox.x > teamsBox.x + 300 && Math.abs(poolsBox.y - teamsBox.y) < 5, 'deux colonnes côte à côte sur ordinateur');
  await audit(admin, 'équipes et poules');
  if (process.env.E2E_SCREENSHOTS) await admin.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/equipes-poules.png` });

  // Terrains : disponibles pendant tout le tournoi, seules les indisponibilités sont saisies.
  await admin.getByRole('tab', { name: 'Terrains', exact: true }).click();
  assert.equal(await admin.getByText('Disponible pendant tout le tournoi', { exact: true }).count(), 3);
  await audit(admin, 'terrains');

  // Format du tournoi expliqué dans l’onglet Format et règles, choisi après publication ; la section Résultats guide la suite.
  await admin.getByRole('tab', { name: 'Format et règles', exact: true }).click();
  await admin.waitForURL(/[?&]onglet=format-et-regles/);
  await admin.getByRole('heading', { name: 'Format du tournoi' }).waitFor();
  await audit(admin, 'règles et formats');
  assert(await admin.getByRole('radio', { name: /Tableau complet/ }).isDisabled(), 'tableau complet indisponible avec 12 équipes');
  await admin.locator('.format-context').getByText('12 équipes', { exact: true }).waitFor();
  assert.equal(await admin.locator('.format-duration').count(), 3, 'durée estimée pour chaque format possible');
  await admin.getByRole('radio', { name: /Croisé en deux tours/ }).check();
  await admin.getByRole('button', { name: 'Enregistrer le format' }).click();
  await admin.getByText('Modification enregistrée.').waitFor();
  if (process.env.E2E_SCREENSHOTS) await admin.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/regles-formats.png`, fullPage: true });
  await admin.getByRole('tab', { name: 'Résultats', exact: true }).click();
  await admin.getByText('Étape suivante : lancer la phase de classement').waitFor();
  await admin.getByText(/matchs de poule restent à jouer/).waitFor();
  // Le calendrier enregistré montre la phase de classement prévisionnelle du format choisi.
  await admin.getByRole('tab', { name: 'Calendrier', exact: true }).click();
  await admin.getByRole('heading', { name: 'Phase de classement · prévisionnel' }).waitFor();
  assert((await admin.getByText(/^Vainqueur du match \d+ – Vainqueur du match \d+$/).count()) > 0, 'tour 2 prévisionnel');
  await audit(admin, 'calendrier prévisionnel');
  await admin.getByRole('tab', { name: 'Résultats', exact: true }).click();
  console.log('OK — Formats expliqués dans l’onglet Format et règles, « Croisé en deux tours » choisi après publication, étape suivante indiquée.');

  // Écran TV 1920×1080 : sans défilement, accessible, mis à jour en direct (thème sombre du tournoi).
  // Mouvement réduit : le fondu de rotation des classements fausserait la mesure du contraste.
  const screen = await desktop.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'fr-BE', timezoneId: 'Europe/Brussels', reducedMotion: 'reduce' });
  const tv = await screen.newPage(); watch(tv, 'écran TV');
  await tv.goto(`${origin}/t/${t.slug}/tv`);
  await tv.getByText('En direct').waitFor();
  await tv.locator('.tv-score').filter({ hasText: '3 – 1' }).waitFor();
  await audit(tv, 'écran TV');
  const fits = async () => tv.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth);
  assert(await fits(), 'Écran TV 1080p sans défilement');
  await tv.setViewportSize({ width: 1280, height: 720 });
  assert(await fits(), 'Écran TV 720p sans défilement');
  await tv.setViewportSize({ width: 1920, height: 1080 });
  console.log('OK — Écran TV 1080p (et 720p) : sans défilement, accessible, aux couleurs du tournoi.');

  // Perte de réseau puis reprise.
  await spectator.setOffline(true);
  await viewer.getByText(/Hors ligne/).waitFor({ timeout: 20_000 });
  const second = await enterScore(admin, 2, 0);
  await viewer.waitForTimeout(1000);
  assert.equal(await publicScore(viewer, second.homeName, second.awayName).textContent(), '', 'Hors ligne : pas encore à jour');
  await spectator.setOffline(false);
  await publicScore(viewer, second.homeName, second.awayName).filter({ hasText: '2 – 0' }).waitFor({ timeout: 25_000 });
  await viewer.getByText('En direct').waitFor({ timeout: 20_000 });
  await tv.locator('.tv-score').filter({ hasText: '2 – 0' }).waitFor({ timeout: 10_000 });
  console.log('OK — Écran TV mis à jour en direct.');
  console.log('OK — Perte de réseau signalée, rattrapage du score et du direct à la reprise.');

  // Organisateur sur téléphone : saisie au bord du terrain.
  const pocket = await signedIn(desktop, { ...devices['Pixel 7'] });
  const mobileAdmin = await pocket.newPage(); watch(mobileAdmin, 'résultats mobile');
  await mobileAdmin.goto(`${origin}/dashboard/tournaments/${t.id}`);
  await mobileAdmin.getByRole('tab', { name: 'Résultats', exact: true }).click();
  await audit(mobileAdmin, 'résultats mobile');
  const third = await enterScore(mobileAdmin, 1, 4);
  await publicScore(viewer, third.homeName, third.awayName).filter({ hasText: '1 – 4' }).waitFor({ timeout: 10_000 });
  console.log('OK — Saisie depuis un téléphone, sans défilement horizontal.');

  assert.deepEqual(problems, [], 'Erreurs navigateur');
  console.log('OK — Aucune erreur console ni d’hydratation sur l’ensemble du parcours.');
} finally {
  // Captures d’écran pour la revue visuelle ou le diagnostic d’un échec (E2E_SCREENSHOTS=dossier).
  if (process.env.E2E_SCREENSHOTS) for (const [label, page] of pages) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/${label.replaceAll(' ', '-')}.png`, fullPage: true }).catch(() => {});
  for (const browser of browsers) await browser.close().catch(() => {});
  if (fixture) await db.tournament.delete({ where: { id: fixture } }).catch(() => {});
  await db.$disconnect();
}
