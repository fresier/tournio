import { slugify, uniqueSlug } from './contracts';

/**
 * Noms d’équipes vraisemblables pour les tests et les démonstrations.
 * D’abord des noms simples (« Les Faucons »), puis des combinaisons avec une couleur (« Les Faucons rouges »),
 * jamais en double avec les équipes existantes. Le hasard est injectable pour les tests.
 */
const ANIMALS = ['Renards', 'Faucons', 'Ours', 'Loups', 'Lynx', 'Aigles', 'Lions', 'Tigres', 'Panthères', 'Dragons', 'Hiboux', 'Requins',
  'Castors', 'Bisons', 'Pumas', 'Cobras', 'Dauphins', 'Gazelles', 'Jaguars', 'Mustangs', 'Phénix', 'Pingouins', 'Sangliers', 'Scorpions',
  'Taureaux', 'Vautours', 'Zèbres', 'Albatros', 'Caribous', 'Coyotes', 'Écureuils', 'Frelons'];
const COLORS = [['rouges', 'rouges'], ['bleus', 'bleues'], ['verts', 'vertes'], ['noirs', 'noires'], ['dorés', 'dorées'], ['blancs', 'blanches']] as const;
const FEMININE = new Set(['Panthères', 'Gazelles']);

function shuffled<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export function demoTeamNames(count: number, taken: readonly string[], random: () => number = Math.random): string[] {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  const candidates = [
    ...shuffled(ANIMALS, random).map((animal) => `Les ${animal}`),
    ...shuffled(COLORS.flatMap(([masculine, feminine]) => ANIMALS.map((animal) => `Les ${animal} ${FEMININE.has(animal) ? feminine : masculine}`)), random),
  ];
  const names: string[] = [];
  for (const name of candidates) {
    if (names.length >= count) break;
    if (!used.has(name.toLowerCase())) { names.push(name); used.add(name.toLowerCase()); }
  }
  for (let n = 1; names.length < count; n++) if (!used.has(`équipe ${n}`)) { names.push(`Équipe ${n}`); used.add(`équipe ${n}`); }
  return names;
}

/** Équipes prêtes à créer : nom et identifiant de lien uniques. */
export function demoTeams(count: number, existing: readonly { name: string; slug: string }[], random?: () => number) {
  const slugs = existing.map((team) => team.slug);
  return demoTeamNames(count, existing.map((team) => team.name), random).map((name) => {
    const slug = uniqueSlug(slugify(name) || 'equipe', slugs);
    slugs.push(slug);
    return { name, slug };
  });
}
