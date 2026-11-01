import test from 'node:test';
import assert from 'node:assert/strict';
import { gaps, normalize, remap, restore, subtract } from '../src/lib/domain/availability';

const h = (hour: number) => hour * 60;
const period = { start: h(8), end: h(17) };

test('indisponibilité : découpe la plage, se cumule, déborde sans erreur', () => {
  let windows = [period];
  windows = subtract(windows, { start: h(12), end: h(13) });
  assert.deepEqual(windows, [{ start: h(8), end: h(12) }, { start: h(13), end: h(17) }]);
  windows = subtract(windows, { start: h(12.5), end: h(14) }); // chevauche la précédente
  assert.deepEqual(gaps(period, windows), [{ start: h(12), end: h(14) }]);
  windows = subtract(windows, { start: h(16), end: h(18) }); // déborde de la période
  assert.deepEqual(gaps(period, windows), [{ start: h(12), end: h(14) }, { start: h(16), end: h(17) }]);
});

test('rendre disponible : comble le trou et fusionne les plages voisines', () => {
  const windows = [{ start: h(8), end: h(12) }, { start: h(14), end: h(17) }];
  assert.deepEqual(restore(windows, { start: h(12), end: h(14) }, period), [period]);
  assert.deepEqual(restore([], { start: h(7), end: h(9) }, period), [{ start: h(8), end: h(9) }], 'borné à la période');
  assert.deepEqual(gaps(period, []), [period], 'sans plage : indisponible tout le tournoi');
  assert.deepEqual(normalize([{ start: 3, end: 5 }, { start: 1, end: 3 }, { start: 9, end: 9 }]), [{ start: 1, end: 5 }]);
});

test('nouvelles dates : indisponibilités conservées, le reste suit la période', () => {
  const windows = [{ start: h(8), end: h(12) }, { start: h(13), end: h(17) }];
  assert.deepEqual(remap(windows, period, { start: h(9), end: h(20) }), [{ start: h(9), end: h(12) }, { start: h(13), end: h(20) }]);
  assert.deepEqual(remap(windows, period, { start: h(8), end: h(10) }), [{ start: h(8), end: h(10) }]);
});
