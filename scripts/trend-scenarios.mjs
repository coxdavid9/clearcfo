const scenarios = [
  { name: 'Persistent revenue decline', values: [240,238,236,233,230,226], expect: 'downward' },
  { name: 'Persistent margin expansion', values: [30,30.4,30.8,31.2,31.5,31.9], expect: 'upward' },
  { name: 'Volatile revenue', values: [200,240,205,250,210,245], expect: 'volatile' },
];
function classify(values) {
  const recent = values.slice(-Math.min(6, values.length));
  const first = recent[0], last = recent.at(-1);
  const diffs = recent.slice(1).map((v,i)=>v-recent[i]);
  const rising = diffs.filter(v=>v>0).length;
  const falling = diffs.filter(v=>v<0).length;
  if (rising >= Math.max(2,diffs.length-1)) return 'upward';
  if (falling >= Math.max(2,diffs.length-1)) return 'downward';
  return Math.abs(((last-first)/Math.abs(first))*100) >= 5 ? 'volatile' : 'flat';
}
let failed=0;
for (const s of scenarios) {
  const actual=classify(s.values);
  if(actual!==s.expect){failed++;console.error(`FAIL: ${s.name}: expected ${s.expect}, got ${actual}`)}
  else console.log(`PASS: ${s.name} -> ${actual}`)
}
if(failed) process.exit(1);
console.log(`\n${scenarios.length}/${scenarios.length} trend scenarios passed.`)
