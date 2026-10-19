// Hairline shared by the head painter (scalp tint) and the hair cards (root placement).
// theta: angle around the head, 0 = front, +/-PI = back. Returns the lowest y (head space, m)
// where hair grows at that angle.
export function hairlineY(theta, opts = {}) {
  const a = Math.abs(theta), fem = opts.fem || 0, old = opts.old || 0, masc = opts.masc ?? (1 - fem);
  const recede = (old * 0.014 + (masc > 0.5 ? 0.004 : 0)) * (opts.recede ?? 1);
  let y;
  if (a < 0.62) y = 0.163 - recede * Math.exp(-(((a - 0.42) / 0.12) ** 2)) * 1.6 - (0.003 * fem) + 0.0015 * Math.cos(theta * 9);
  else if (a < 1.25) y = 0.163 - (a - 0.62) / 0.63 * (0.163 - 0.104) + 0.0015 * Math.sin(theta * 13);
  else if (a < 1.62) y = 0.104 - (a - 1.25) / 0.37 * 0.075 * (fem > 0.5 ? 0.5 : 1); // sideburn in front of the ear
  else if (a < 2.0) y = 0.07 + (a - 1.62) / 0.38 * 0.02 - (fem > 0.5 ? 0.01 : 0); // over the ear
  else y = 0.06 - (a - 2.0) / 1.14 * 0.05; // nape
  return y + (opts.offset || 0);
}
