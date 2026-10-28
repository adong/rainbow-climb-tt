/* TT Rainbow Climb: the autopilot (the title screen's demo, and the headless check's "climbs every round"). It plays
   with the same inputs a kid has: ← →, jump, rainbow. Its plan: bonk any critter close in front with a rainbow; jump
   up to a ledge it can reach; otherwise throw a rainbow toward the open side (or the next ledge), walk up it, and at
   the top jump or throw the next one. RC.bot.decide(w, i) returns this frame's input for player i. */
(function (root) {
  'use strict';
  const RC = (root.RC = root.RC || {});
  const S = RC.sim;
  const REACH = 1.9; // a jump lifts the feet 2.28 m; keep a little spare

  // the ledge to go for: the lowest one above, the nearest across
  function target(w, p) {
    let best = null;
    for (const pl of w.plats) {
      const dy = pl.y - p.y;
      if (dy < 0.6) continue;
      const x = Math.max(pl.x0 + 0.6, Math.min(pl.x1 - 0.6, p.x));
      const cost = dy * 3 + Math.abs(x - p.x);
      if (!best || cost < best.cost) best = { pl, x, dy, cost };
    }
    return best;
  }
  function decide(w, i) {
    const p = w.players[i];
    const out = { lr: 0, jump: false, rainbow: false, stomp: false };
    if (!p || w.phase !== 'play' || p.mode === 'bubble' || (w.sab && w.sab.lazyBot)) return out;
    const m = p.bot || (p.bot = { tx: null, t: 0, turn: 0 });
    m.t += S.DT;
    if (p.mode === 'air') {
      if (m.tx != null && Math.abs(m.tx - p.x) > 0.12) out.lr = Math.sign(m.tx - p.x);
      return out;
    }
    m.tx = null;
    // a critter close in front (or about to be): bonk it
    for (const c of w.critters) {
      if (c.st !== 'go') continue;
      const dx = c.x - p.x, dy = c.y - p.y;
      if (Math.abs(dy) < 1.7 && Math.abs(dx) > 0.2 && Math.abs(dx) < 4.6 && S.roomAhead(p.x, Math.sign(dx)) > 1.5) {
        if (p.cd > 0) break;
        if (p.face !== Math.sign(dx)) { out.lr = Math.sign(dx); return out; }
        out.rainbow = true;
        return out;
      }
    }
    // walking up a rainbow toward a critter on the ledge above: wait a moment for it to wander off
    const r0 = p.sup && p.sup.k === 'r' ? S.rbById(w, p.sup.id) : null;
    const ahead = r0 ? r0.dir : p.face;
    if (r0 && r0.st !== 'fall' && S.arcU(r0, p.x) < 0.47 && r0.life - r0.t > 1.5) {
      for (const c of w.critters) {
        if (c.st !== 'go') continue;
        const dy = c.y - p.y;
        if (dy > 0.3 && dy < 3.4 && Math.abs(c.x - (p.x + ahead * 1.2)) < 2) { m.wait = (m.wait || 0) + S.DT; if (m.wait < 2.5) return out; }
      }
    }
    m.wait = 0;
    const tg = target(w, p);
    // a ledge in jumping reach: go under it and jump
    if (tg && tg.dy <= REACH) {
      const dx = tg.x - p.x;
      if (Math.abs(dx) < 2) { out.jump = true; m.tx = tg.x; out.lr = Math.abs(dx) > 0.12 ? Math.sign(dx) : 0; return out; }
      // walk nearer, but never off the end of this ledge
      const pl = onFlat(w, p) ? w.plats[p.sup.i] : null;
      if (pl && Math.abs(dx) < 5 && p.x + Math.sign(dx) * 0.4 > pl.x0 && p.x + Math.sign(dx) * 0.4 < pl.x1) { out.lr = Math.sign(dx); return out; }
    }
    // on a rainbow and not at its top yet: keep walking up
    const r = p.sup && p.sup.k === 'r' ? S.rbById(w, p.sup.id) : null;
    if (r && r.st !== 'fall' && S.arcU(r, p.x) < 0.47 && r.life - r.t > 0.8) { out.lr = r.dir; return out; }
    // a fresh rainbow starting at the feet: walk onto it
    for (const q of w.rainbows) {
      if (q.st === 'fall' || q === r || q.life - q.t < 2) continue;
      if (Math.abs(q.x0 - p.x) < 0.6 && Math.abs(q.y0 - p.y) < 0.12) { out.lr = q.dir; return out; }
    }
    // throw one: toward the next ledge if there's room that way, else toward the open side
    let d = tg && Math.abs(tg.x - p.x) > 0.5 ? Math.sign(tg.x - p.x) : r ? r.dir : p.face;
    if (S.roomAhead(p.x, d) < 3) d = -d;
    if (S.roomAhead(p.x, d) < 3) d = S.roomAhead(p.x, 1) > S.roomAhead(p.x, -1) ? 1 : -1;
    if (p.cd > 0) return out;
    if (p.face !== d) { out.lr = d; return out; }
    out.rainbow = true;
    return out;
  }
  const onFlat = (w, p) => p.sup && p.sup.k === 'p' && w.plats[p.sup.i];

  RC.bot = { decide, target };
})(typeof window !== 'undefined' ? window : globalThis);
