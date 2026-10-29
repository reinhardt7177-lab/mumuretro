// Keep the existing seed's RNG stream and crate identities. Only repair a
// monotonic three-crate starting row; a mixed prefix also mixes rows of 4/5.
export function mixedHomeRanks(ranks) {
  if (!Array.isArray(ranks) || ranks.length !== 5 || new Set(ranks).size !== 5
    || !ranks.every(v => Number.isInteger(v) && v >= 0 && v < 5)) throw new TypeError('Five home ranks required');
  const result = ranks.slice();
  const [a,b,c] = result;
  if ((a < b && b < c) || (a > b && b > c)) [result[0],result[1],result[2]] = [c,a,b];
  return result;
}
