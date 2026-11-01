import { Temporal } from '@js-temporal/polyfill';

export function localToInstant(local: string, timezone: string, offset = '') {
  if (!local) throw new Error('Date et heure requises.');
  return Temporal.ZonedDateTime.from(`${local}${offset}[${timezone}]`, { disambiguation: 'reject', offset: 'reject' }).toInstant().toString();
}

export function instantToLocal(instant: string, timezone: string) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}

export function formatTournamentDate(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
}
