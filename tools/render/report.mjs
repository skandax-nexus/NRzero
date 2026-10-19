// Markdown table of reference-view measurements written by tools/render/refviews.mjs.
//   node tools/render/report.mjs <dir> [<baseline dir>]
// <dir> holds <mission>_<gfx>[_mobile].json files (any number). With a baseline dir, each row also shows the
// change in calls / triangles / frame time against the same view and tier there (later stages vs. the audit).
import fs from 'fs'; import path from 'path';

const [dir, base] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/render/report.mjs <dir> [<baseline dir>]'); process.exit(2); }
const load = d => {
  const rows = [];
  for (const f of fs.readdirSync(d).filter(f => /^m\d+_(high|medium|low)(_mobile)?\.json$/.test(f)).sort()) {
    for (const r of JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) rows.push({ ...r, key: r.view + '|' + r.tier + '|' + (r.mobile ? 'm' : 'd') });
  }
  return rows;
};
const rows = load(dir), ref = base ? new Map(load(base).map(r => [r.key, r])) : null;
const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%` : '');
const head = ['view', 'tier', 'size', 'calls', 'tris', 'frame min ms', 'frame med ms', 'scene pass ms', 'lights p/s/d', 'transp.', 'programs'];
if (ref) head.push('Δ calls', 'Δ tris', 'Δ frame min');
console.log('| ' + head.join(' | ') + ' |');
console.log('|' + head.map(() => '---').join('|') + '|');
for (const r of rows) {
  const L = r.lights || {};
  const cells = [r.view, r.tier + (r.mobile ? ' (mobile)' : ''), `${r.size}@${r.pr}`, r.calls, Math.round(r.tris / 1000) + 'k',
    r.frameMinMs, r.frameMs, r.sceneMinMs ?? r.sceneOnlyMs ?? '', `${L.point}/${L.spot}/${L.dir}`, r.transparent, r.programs];
  if (ref) { const b = ref.get(r.key); cells.push(b ? pct(r.calls, b.calls) : 'n/a', b ? pct(r.tris, b.tris) : 'n/a', b ? pct(r.frameMinMs, b.frameMinMs) : 'n/a'); }
  console.log('| ' + cells.join(' | ') + ' |');
}
