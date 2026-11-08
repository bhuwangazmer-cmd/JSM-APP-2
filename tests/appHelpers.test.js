const test = require('node:test');
const assert = require('node:assert/strict');
const { chunkArray, isWithinLastTwoLocalMonths } = require('../utils/appHelpers');

test('chunkArray splits large inputs without losing order', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('chunkArray keeps Firestore write batches below the 500-operation limit', () => {
  const chunks = chunkArray(Array.from({ length: 901 }, (_, index) => index), 450);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [450, 450, 1]);
  assert.deepEqual(chunks.flat(), Array.from({ length: 901 }, (_, index) => index));
});

test('chunkArray handles empty input and rejects invalid sizes', () => {
  assert.deepEqual(chunkArray([], 450), []);
  assert.throws(() => chunkArray([1], 0), RangeError);
});

test('recent-month filter includes current and previous month', () => {
  const now = new Date(2026, 10, 7);
  assert.equal(isWithinLastTwoLocalMonths('2026-11-01', now), true);
  assert.equal(isWithinLastTwoLocalMonths('2026-10-31', now), true);
  assert.equal(isWithinLastTwoLocalMonths('2026-09-30', now), false);
});

test('recent-month filter excludes future, malformed and impossible dates', () => {
  const now = new Date(2026, 10, 7);
  assert.equal(isWithinLastTwoLocalMonths('2026-11-08', now), false);
  assert.equal(isWithinLastTwoLocalMonths('2026-12-01', now), false);
  assert.equal(isWithinLastTwoLocalMonths('2026-02-30', now), false);
  assert.equal(isWithinLastTwoLocalMonths('not-a-date', now), false);
  assert.equal(isWithinLastTwoLocalMonths('', now), false);
});
