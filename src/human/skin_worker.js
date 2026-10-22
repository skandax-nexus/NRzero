// Worker for the look's template analysis (src/human/skin_analyse.js): keeps the 0.1-1 s per new template off the
// main thread, so a person spawned during play never stalls a frame. Message in: { id, D }; out: { id, r }.
import { analyseData } from './skin_analyse.js';
globalThis.onmessage = e => {
  const { id, D } = e.data;
  let r;
  try { r = analyseData(D); } catch (err) { r = { failed: true, error: String(err && err.message) }; }
  globalThis.postMessage({ id, r }, r.attrs ? Object.values(r.attrs).map(a => a.buffer) : []);
};
