// Character look audit (docs/CHARACTER_LOOK.md): triangles by body region of cast templates (the bone that dominates
// each triangle's first vertex; head = head, neck, hair, eyes, head gadgets).  node tools/feel/look_meshstats.mjs kai,mira,...
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const ids = process.argv[2].split(',');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 200, height: 200 } })).newPage();
await p.goto('http://localhost:8765/tools/cast.html?ids=' + ids[0] + '&cols=1');
await p.waitForFunction('window.LAB_DONE === true', null, { timeout: 300000, polling: 500 });
const res = await p.evaluate(async (ids) => {
  const C = await import('/src/human/cast3d.js');
  const out = {};
  for (const id of ids) {
    const P = C.makePerson(id, { seed: 1 }); const reg = {}; let maskStats = { skin: 0, gloss: 0, hair: 0 };
    P.root.traverse(o => {
      if (!o.isSkinnedMesh || o.userData.lod || !o.visible) return;
      const g = o.geometry, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight, idx = g.index, M = g.attributes.azMask;
      const bones = o.skeleton.bones.map(b => b.name.replace(/_\d+$/, ''));
      const dom = i => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = Wt.getComponent(i, k); if (w > bw) { bw = w; best = J.getComponent(i, k); } } return bones[best]; };
      const n = idx ? idx.count / 3 : g.attributes.position.count / 3;
      for (let t = 0; t < n; t++) {
        const a = idx ? idx.getX(t * 3) : t * 3; const bn = dom(a);
        const r = /head|neck/.test(bn) ? 'head' : /hand/.test(bn) ? 'hands' : /foot|toe/.test(bn) ? 'feet' : 'body';
        reg[r] = (reg[r] || 0) + 1;
        if (M) { const s = M.getX(a), gl = M.getY(a), h = M.getZ(a); if (s > 0.5) maskStats.skin++; if (gl > 0.5) maskStats.gloss++; if (h > 0.5) maskStats.hair++; }
      }
    });
    out[id] = { ...reg, maskTris: maskStats };
  }
  return out;
}, ids);
for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v));
await b.close();
