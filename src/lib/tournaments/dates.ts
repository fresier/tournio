import { Temporal } from '@js-temporal/polyfill';

export function localToInstant(local: string, timezone: string, offset = '') {
  if (!local) throw new Error('Date et heure requises.');
  return Temporal.ZonedDateTime.from(`${local}${offset}[${timezone}]`, { disambiguation: 'reject', offset: 'reject' }).toInstant().toString();
}

export function instantToLocal(instant: string, timezone: string) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}

/*
 * Formatage écrit à la main plutôt qu’avec Intl : le texte d’Intl dépend des données ICU
 * (Node et chaque navigateur diffèrent, par ex. « 1 nov. 2026 à 18:00 » vs « 1 nov. 2026, 18:00 »),
 * ce qui casse l’hydratation React. Ici, le serveur et le client produisent exactement le même texte.
 */
const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const weekdays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const two = (value: number) => String(value).padStart(2, '0');
const zoned = (instant: string, timezone: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(timezone);

/** « 1 nov. 2026 à 18:00 » dans le fuseau du tournoi. */
export function formatTournamentDate(instant: string, timezone: string) {
  const d = zoned(instant, timezone);
  return `${d.day} ${months[d.month - 1]} ${d.year} à ${two(d.hour)}:${two(d.minute)}`;
}

/** « 18:00 », ou « dim. 1 · 18:00 » si le tournoi dure plusieurs jours. */
export function formatMatchTime(instant: string, timezone: string, withDay = false) {
  const d = zoned(instant, timezone);
  const time = `${two(d.hour)}:${two(d.minute)}`;
  return withDay ? `${weekdays[d.dayOfWeek - 1]} ${d.day} · ${time}` : time;
}

/** Vrai si les deux instants tombent sur des jours différents dans le fuseau du tournoi. */
export function spansSeveralDays(start: string, end: string, timezone: string) {
  return !zoned(start, timezone).toPlainDate().equals(zoned(end, timezone).toPlainDate());
}
