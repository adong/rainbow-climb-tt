/* TT Rainbow Climb: the rules, in fixed 1/60 s steps, with no THREE and no page (the headless check runs this in node).
   The island is a side view: x across (walls at ±XW), y up (feet). Ledges are one-way: jump up through them, land on
   top. A rainbow is an arch y = y0 + h·sin(πu) from x0 to x0 + dir·span: you can walk on it and stand on it, it bonks
   the critters it sweeps over while it grows (they turn into fruit) and the ones where it lands. Land on one from a
   jump (or press ↓ on it) and it breaks and falls, bonking every critter below (they drop a gem). The water rises from
   the bottom on a timer; the screen only ever scrolls up. */
(function (root) {
  'use strict';
  const RC = (root.RC = root.RC || {});
  const IS = RC.islands;
  const PI = Math.PI;
  const DT = 1 / 60, GRAV = 26, VJ = 10.9, WALK = 4.2, XW = IS.XW, PW = 0.3, STEP_UP = 0.32, DROP = 0.5;
  const VIEW_H = 12, FOLLOW = 4.4;
  const SPAN = 4.4, RH = 2.4, GROW = 0.22, THICK = 0.42, CR = 0.42;
  const LV = {
    easy: { lives: 5, water: 0.15, waterIsland: 0.01, waterDelay: 6, double: true, life: 10, max: 6, breakV: 9, crawl: 0.9, fly: 0.8, inv: 3, pushBack: 5 },
    normal: { lives: 3, water: 0.25, waterIsland: 0.03, waterDelay: 3, double: false, life: 7, max: 3, breakV: 6, crawl: 1.5, fly: 1.25, inv: 2.2, pushBack: 3 },
  };
  const FRUIT = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍉', '🍑', '🍍'];
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const GEMS = 7;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function create(o) {
    const level = o.level === 'normal' ? 'normal' : 'easy';
    const seed = (o.seed >>> 0) || 1;
    const w = {
      level, L: LV[level], seed, rng: IS.rng(seed), t: 0, n: 0, phase: 'ready', phaseT: 0, roundT: 0, events: [],
      lives: LV[level].lives, players: [], two: o.players.length === 2, rainbows: [], critters: [], items: [],
      gems: new Array(GEMS).fill(false), camY: 0, water: -2.5, buddy: null, hi5: null, nid: 1, sab: o.sab || {},
      buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')), hurry: false, stats: { thrown: 0, broken: 0, fruit: 0, gems: 0, oops: 0, splash: 0, bubble: 0 },
    };
    w.players = o.players.map((who, i) => ({ i, who, x: 0, y: 0, vx: 0, vy: 0, face: 1, mode: 'ground', sup: null, inv: 0, cd: 0, score: 0, best: 0, bub: null, stomp: 0, walkT: 0, land: 0 }));
    loadRound(w, o.round || 0);
    return w;
  }

  function loadRound(w, n) {
    const D = IS.layout(n, w.level);
    const newIsland = !w.D || D.ii !== w.D.ii;
    w.D = D;
    w.n = n;
    w.plats = D.plats;
    w.goalY = D.goalY;
    w.rainbows = [];
    w.items = [];
    w.buddy = null;
    w.hi5 = null;
    w.hurry = false;
    w.critters = D.critters.map((c) => ({ id: w.nid++, k: c.k, x: c.x, y: c.y, hy: c.y, dir: c.dir, ph: w.rng() * 6, st: 'go', t: 0, wait: 0 }));
    w.camY = 0;
    w.water = -2.5;
    w.roundT = 0;
    w.phase = 'ready';
    w.phaseT = 0;
    if (newIsland) w.gems = new Array(GEMS).fill(false);
    w.players.forEach((p, i) => {
      const x = w.two ? (i ? 2 : -2) : 0;
      Object.assign(p, { x, y: 0, vx: 0, vy: 0, face: w.two && i ? -1 : 1, mode: 'ground', sup: { k: 'p', i: 0, top: 0 }, inv: 0, cd: 0, best: 0, bub: null, stomp: 0 });
    });
    w.events.push({ type: 'round', n, island: newIsland });
  }

  // ---------- surfaces ----------
  function arcU(r, x) { return ((x - r.x0) * r.dir) / r.span; }
  function arcY(r, u, y0) { return (y0 == null ? r.y0 : y0) + r.h * Math.sin(PI * u); }
  // how much of the rainbow is there yet (0..1): it grows from its start to its tip
  const grown = (r) => clamp(r.t / GROW, 0, 1);
  function rbTop(w, r, x) {
    if (r.st === 'fall' || r.t < 0 || w.sab.notSolid) return null;
    const u = arcU(r, x);
    if (u < 0 || u > 1 || u > grown(r) + 1e-6) return null;
    return arcY(r, u);
  }
  function platAt(pl, x) { return x >= pl.x0 - 0.2 && x <= pl.x1 + 0.2; }
  // the highest surface under x with its top in [feet - down, feet + up]
  function support(w, x, feet, up, down) {
    let best = null;
    for (let i = 0; i < w.plats.length; i++) {
      const pl = w.plats[i];
      if (!platAt(pl, x)) continue;
      if (pl.y <= feet + up && pl.y >= feet - down && (!best || pl.y > best.top)) best = { k: 'p', i, top: pl.y };
    }
    for (const r of w.rainbows) {
      const t = rbTop(w, r, x);
      if (t != null && t <= feet + up && t >= feet - down && (!best || t > best.top)) best = { k: 'r', id: r.id, top: t };
    }
    return best;
  }
  // falling from y0 to y1 at x: the highest surface crossed (ledges strictly from above; rainbows forgive a little)
  function landing(w, x, y0, y1) {
    let best = null;
    for (let i = 0; i < w.plats.length; i++) {
      const pl = w.plats[i];
      if (!platAt(pl, x)) continue;
      if (pl.y <= y0 + 0.05 && pl.y >= y1 && (!best || pl.y > best.top)) best = { k: 'p', i, top: pl.y };
    }
    for (const r of w.rainbows) {
      const t = rbTop(w, r, x);
      if (t != null && t <= y0 + 0.35 && t >= y1 && (!best || t > best.top)) best = { k: 'r', id: r.id, top: t };
    }
    return best;
  }
  const rbById = (w, id) => w.rainbows.find((r) => r.id === id) || null;
  const roomAhead = (x, d) => (d > 0 ? XW - 0.1 - x : x + XW - 0.1);

  // ---------- rainbows ----------
  function addRainbow(w, o) {
    const r = Object.assign({ id: w.nid++, t: 0, st: 'grow', vy: 0, fallT: 0, chain: 0, hit: [], giant: false, owner: -1, life: w.L.life }, o);
    w.rainbows.push(r);
    return r;
  }
  function throwRainbow(w, p) {
    const d = w.sab.mirrorThrow ? -p.face : p.face;
    const x0 = p.x + d * 0.15;
    const room = roomAhead(x0, d);
    p.cd = 0.3;
    if (room < 1.3) { w.events.push({ type: 'fizzle', who: p.i, x: p.x, y: p.y }); return null; }
    const span = Math.min(SPAN, room);
    const h = RH * Math.max(0.6, span / SPAN);
    const made = [addRainbow(w, { owner: p.i, x0, dir: d, span, h, y0: p.y })];
    if (w.L.double && room - span >= 1.3) {
      const s2 = Math.min(SPAN, room - span);
      made.push(addRainbow(w, { owner: p.i, x0: x0 + d * span, dir: d, span: s2, h: RH * Math.max(0.6, s2 / SPAN), y0: p.y, t: -GROW * 0.8, pair: made[0].id }));
    }
    w.stats.thrown++;
    // only so many each: the oldest that nobody stands on fades away
    const mine = w.rainbows.filter((r) => r.owner === p.i && r.st !== 'fall');
    let extra = mine.length - w.L.max;
    for (const r of mine) {
      if (extra <= 0) break;
      if (made.includes(r) || standingOn(w, r)) continue;
      removeRainbow(w, r, 'fade');
      extra--;
    }
    w.events.push({ type: 'throw', who: p.i, x: x0, y: p.y, dir: d, n: made.length });
    return made;
  }
  const standingOn = (w, r) => w.players.some((p) => p.mode === 'ground' && p.sup && p.sup.k === 'r' && p.sup.id === r.id);
  function removeRainbow(w, r, why) {
    const i = w.rainbows.indexOf(r);
    if (i >= 0) w.rainbows.splice(i, 1);
    for (const p of w.players) if (p.mode === 'ground' && p.sup && p.sup.k === 'r' && p.sup.id === r.id) { p.mode = 'air'; p.vy = 0; p.sup = null; }
    if (why) w.events.push({ type: why, id: r.id, x: r.x0 + (r.dir * r.span) / 2, y: r.y0 + r.h });
  }
  function breakRainbow(w, r, who, why) {
    if (!r || r.st === 'fall') return false;
    r.st = 'fall';
    r.t = Math.max(r.t, GROW);
    r.vy = 0;
    r.fallT = 0;
    r.chain = 0;
    r.breaker = who;
    for (const p of w.players) if (p.mode === 'ground' && p.sup && p.sup.k === 'r' && p.sup.id === r.id) { p.mode = 'air'; p.vy = 0; p.sup = null; }
    w.stats.broken++;
    w.events.push({ type: 'break', id: r.id, who, why, x: r.x0 + (r.dir * r.span) / 2, y: r.y0 + r.h });
    return true;
  }
  // does the band of rainbow r (its part from u = 0 to g) touch critter c? yTop: extra height swept this step (falling)
  function arcHits(r, c, g, sweep) {
    const xa = Math.min(r.x0, r.x0 + r.dir * r.span * g), xb = Math.max(r.x0, r.x0 + r.dir * r.span * g);
    if (c.x < xa - CR || c.x > xb + CR) return false;
    const cx = clamp(c.x, xa, xb);
    const top = arcY(r, clamp(arcU(r, cx), 0, 1));
    const cy = c.y + 0.4;
    return cy >= top - THICK - CR && cy <= top + CR + (sweep || 0);
  }
  function stepRainbows(w) {
    for (const r of w.rainbows.slice()) {
      const g0 = grown(r);
      r.t += DT;
      if (r.st === 'grow') {
        const g = grown(r);
        if (g > 0) for (const c of w.critters) if (c.st === 'go' && arcHits(r, c, g)) bonk(w, c, r, 'fruit');
        // where it lands: critters near its tip when it touches down
        if (g >= 1 && g0 < 1) {
          const tx = r.x0 + r.dir * r.span;
          for (const c of w.critters) if (c.st === 'go' && Math.abs(c.x - tx) < 1.1 && Math.abs(c.y + 0.4 - r.y0) < 1.1) bonk(w, c, r, 'fruit');
        }
        if (r.t >= GROW) { r.st = 'ok'; w.events.push({ type: 'arc', id: r.id }); }
      } else if (r.st === 'ok') {
        if (r.t > r.life) removeRainbow(w, r, 'fade');
      } else if (r.st === 'fall') {
        r.fallT += DT;
        r.vy = Math.max(-16, r.vy - GRAV * 0.8 * DT);
        const dy = r.vy * DT;
        r.y0 += dy;
        if (!w.sab.noFallBonk) for (const c of w.critters) if (c.st === 'go' && arcHits(r, c, 1, -dy)) bonk(w, c, r, 'gem');
        if (r.y0 + r.h < w.camY - 3 || r.y0 < w.water - 4 || r.fallT > 3) removeRainbow(w, r, null);
      }
    }
  }

  // ---------- critters, fruit and gems ----------
  function bonk(w, c, r, how) {
    c.st = 'bonked';
    c.t = 0;
    const who = r.st === 'fall' ? (r.breaker != null ? r.breaker : r.owner) : r.owner;
    const p = w.players[who] || w.players[0];
    r.chain++;
    p.score += 100;
    if (how === 'gem') {
      let col = clamp(Math.floor(((c.x + XW) / (2 * XW)) * GEMS), 0, GEMS - 1);
      if (w.level === 'easy' && w.gems[col]) { for (let k = 1; k < GEMS; k++) if (!w.gems[(col + k) % GEMS]) { col = (col + k) % GEMS; break; } }
      w.items.push({ id: w.nid++, k: 'gem', c: col, x: c.x, y: c.y + 0.4, vy: 5, t: 0, life: 12, value: 1000, still: false });
    } else {
      const value = Math.min(4000, 500 * Math.pow(2, r.chain - 1));
      w.items.push({ id: w.nid++, k: 'fruit', e: FRUIT[Math.floor(w.rng() * FRUIT.length)], x: c.x, y: c.y + 0.4, vy: 5, t: 0, life: 10, value, still: false });
    }
    w.events.push({ type: 'bonk', id: c.id, k: c.k, how, x: c.x, y: c.y + 0.4, who: p.i, chain: r.chain });
  }
  function stepCritters(w) {
    const L = w.L;
    for (const c of w.critters) {
      c.t += DT;
      if (c.st === 'bonked' || c.st === 'soak') continue;
      if (w.water > c.y + 0.25) { c.st = 'soak'; c.t = 0; w.events.push({ type: 'soaked', id: c.id, x: c.x, y: c.y + 0.4 }); continue; }
      if (c.wait > 0) { c.wait -= DT; continue; }
      if (w.phase !== 'play') continue;
      if (c.k === 'walk') {
        const pl = w.plats.find((q) => q.y === c.y && c.x >= q.x0 - 0.01 && c.x <= q.x1 + 0.01);
        c.x += c.dir * L.crawl * DT;
        if (pl && (c.x > pl.x1 - 0.4 || c.x < pl.x0 + 0.4)) { c.x = clamp(c.x, pl.x0 + 0.4, pl.x1 - 0.4); c.dir = -c.dir; }
        if (c.x > XW - 0.45 || c.x < -XW + 0.45) { c.x = clamp(c.x, -XW + 0.45, XW - 0.45); c.dir = -c.dir; }
        // a rainbow standing on its ledge is a wall to a critter: it turns round
        for (const r of w.rainbows) {
          if (r.st === 'fall' || Math.abs(r.y0 - c.y) > 0.3) continue;
          for (const ex of [r.x0, r.x0 + r.dir * r.span]) if ((ex - c.x) * c.dir > 0 && Math.abs(ex - c.x) < 0.5) c.dir = -c.dir;
        }
      } else {
        c.ph += DT * 1.3;
        c.x += c.dir * L.fly * DT;
        if (c.x > XW - 0.6 || c.x < -XW + 0.6) { c.x = clamp(c.x, -XW + 0.6, XW - 0.6); c.dir = -c.dir; }
        c.y = c.hy + Math.sin(c.ph) * 0.9;
      }
      for (const p of w.players) {
        if (p.inv > 0 || (p.mode !== 'ground' && p.mode !== 'air')) continue;
        if (Math.hypot(p.x - c.x, p.y + 0.5 - (c.y + 0.4)) < 0.8) oops(w, p, c);
      }
    }
    w.critters = w.critters.filter((c) => !((c.st === 'bonked' && c.t > 0.6) || (c.st === 'soak' && c.t > 2.5)));
    for (const c of w.critters) if (c.st === 'soak') c.y += DT * 1.6;
  }
  function stepItems(w) {
    for (const it of w.items.slice()) {
      it.t += DT;
      if (!it.still) {
        const y0 = it.y;
        it.vy = Math.max(-12, it.vy - GRAV * 0.6 * DT);
        it.y += it.vy * DT;
        if (it.vy <= 0) {
          let land = null;
          for (const pl of w.plats) if (it.x >= pl.x0 && it.x <= pl.x1 && pl.y <= y0 + 0.01 && pl.y >= it.y - 0.01 && (land == null || pl.y > land)) land = pl.y;
          if (land != null) { it.y = land + 0.01; it.vy = 0; it.still = true; }
        }
      }
      if (it.y < w.water) { it.y = w.water; it.vy = 0; it.still = false; }
      const p = w.players.find((q) => (q.mode === 'ground' || q.mode === 'air') && Math.abs(q.x - it.x) < 0.7 && it.y + 0.2 > q.y - 0.2 && it.y < q.y + 1.3);
      if (p && it.t > 0.25) {
        w.items.splice(w.items.indexOf(it), 1);
        p.score += it.value;
        if (it.k === 'gem') {
          w.stats.gems++;
          w.gems[it.c] = true;
          w.events.push({ type: 'gem', who: p.i, c: it.c, x: it.x, y: it.y });
          if (w.gems.every(Boolean)) {
            p.score += 10000;
            w.lives = Math.min(9, w.lives + 1);
            w.gems = new Array(GEMS).fill(false);
            w.events.push({ type: 'rainbowBonus', who: p.i, x: p.x, y: p.y });
          }
        } else {
          w.stats.fruit++;
          w.events.push({ type: 'fruit', who: p.i, e: it.e, value: it.value, x: it.x, y: it.y });
        }
      } else if (it.t > it.life) w.items.splice(w.items.indexOf(it), 1);
    }
  }

  // ---------- oops, splash, bubble ----------
  function oops(w, p, c) {
    w.stats.oops++;
    p.inv = w.L.inv;
    if (p.mode === 'ground') { p.mode = 'air'; p.sup = null; }
    p.vy = Math.max(p.vy, 5);
    c.dir = -c.dir;
    c.wait = 0.8;
    w.events.push({ type: 'oops', who: p.i, x: p.x, y: p.y, k: c.k });
    loseLife(w);
  }
  function loseLife(w) {
    w.lives--;
    if (w.lives <= 0) { w.lives = 0; w.phase = 'over'; w.phaseT = 0; w.events.push({ type: 'over' }); }
  }
  function safeSpot(w, px) {
    const minY = Math.max(w.water + 2.6, w.camY + 0.8);
    let best = null;
    for (const pl of w.plats) {
      if (pl.y < minY || pl.y > w.camY + VIEW_H - 1.5) continue;
      const x = clamp(px, pl.x0 + 0.6, pl.x1 - 0.6);
      let score = (pl.y - minY) * 2 + Math.abs(x - px);
      for (const c of w.critters) if (c.st === 'go' && Math.abs(c.y - pl.y) < 1.2 && Math.abs(c.x - x) < 2) score += 8;
      if (!best || score < best.score) best = { x, y: pl.y, score };
    }
    if (!best) {
      const pl = w.plats.find((q) => q.y >= minY) || w.plats[w.plats.length - 1];
      best = { x: clamp(px, pl.x0 + 0.6, pl.x1 - 0.6), y: pl.y };
    }
    return best;
  }
  function floatUp(w, p, kind) {
    const s = safeSpot(w, p.x);
    p.mode = 'bubble';
    p.sup = null;
    p.vx = p.vy = 0;
    p.bub = { kind, t: 0, dur: 1.4, x0: p.x, y0: p.y, x1: s.x, y1: s.y };
    if (kind === 'ring') w.water = Math.min(w.water, s.y - w.L.pushBack);
  }

  // ---------- the brother: a giant rainbow staircase; in 2 players T is a high five ----------
  function call(w) {
    if (w.phase !== 'play' && w.phase !== 'ready') return false;
    if (w.two) {
      w.hi5 = { t: 0 };
      w.players.forEach((p) => (p.score += 50));
      w.events.push({ type: 'hi5' });
      return true;
    }
    const p = w.players[0];
    if (w.buddy && w.buddy.t < 2.0) return true; // already on his way: the same visit
    const face = p.face;
    w.buddy = { who: w.buddyFor(p.who), t: 0, x: clamp(p.x - face * 1.1, -XW + 0.5, XW - 0.5), y: p.y, face, treat: TREATS[Math.floor(w.rng() * TREATS.length)], tossed: false, thrown: false };
    w.events.push({ type: 'buddyIn', who: w.buddy.who });
    return true;
  }
  function stairs(w, p) {
    const K = 4, H = 2.8;
    // up the open side (the way he faces unless the wall is too near)
    let d = roomAhead(p.x, p.face) >= roomAhead(p.x, -p.face) * 0.8 ? p.face : -p.face;
    const room = roomAhead(p.x + d * 0.15, d);
    const span = Math.min(5, (2 * room) / (K + 1));
    let bx = p.x + d * 0.15, by = p.y;
    const made = [];
    for (let j = 0; j < K && by < w.goalY + 1; j++) {
      made.push(addRainbow(w, { owner: -1, giant: true, x0: bx, dir: d, span, h: H, y0: by, t: -j * 0.2, life: 14 }));
      bx += (d * span) / 2;
      by += H;
    }
    const buddyArcs = w.rainbows.filter((r) => r.owner === -1 && r.st !== 'fall');
    for (const r of buddyArcs.slice(0, Math.max(0, buddyArcs.length - 12))) if (!standingOn(w, r)) removeRainbow(w, r, 'fade');
    w.events.push({ type: 'stairs', who: w.buddy ? w.buddy.who : 'tommy', dir: d, n: made.length });
    return made;
  }
  function stepBuddy(w) {
    if (w.hi5) { w.hi5.t += DT; if (w.hi5.t > 1) w.hi5 = null; }
    const b = w.buddy;
    if (!b) return;
    b.t += DT;
    const p = w.players[0];
    if (!b.tossed && b.t >= 1.4) {
      b.tossed = true;
      p.score += 500;
      w.events.push({ type: 'treat', e: b.treat, who: b.who });
    }
    if (!b.thrown && b.t >= 1.9) { b.thrown = true; stairs(w, p); }
    if (b.t >= 3.6) { w.buddy = null; w.events.push({ type: 'buddyOut' }); }
  }

  // ---------- a step ----------
  function stepPlayer(w, p, inp) {
    const L = w.L;
    p.inv = Math.max(0, p.inv - DT);
    p.cd = Math.max(0, p.cd - DT);
    p.land = Math.max(0, p.land - DT);
    if (p.mode === 'bubble') {
      const b = p.bub;
      b.t += DT;
      const k = Math.min(1, b.t / b.dur), e = k * k * (3 - 2 * k);
      p.x = b.x0 + (b.x1 - b.x0) * e;
      p.y = b.y0 + (b.y1 - b.y0) * e + Math.sin(k * PI) * 0.8;
      if (k >= 1) {
        p.mode = 'ground';
        p.y = b.y1;
        p.sup = support(w, p.x, p.y, 0.05, 0.05) || { k: 'p', i: -1, top: p.y };
        p.bub = null;
        p.inv = Math.max(p.inv, 1.6);
        w.events.push({ type: 'pop', who: p.i, x: p.x, y: p.y });
      }
      return;
    }
    if (w.phase !== 'play') { p.vx = 0; if (p.mode === 'air') airStep(w, p); return; }
    const lr = inp && inp.lr ? Math.sign(inp.lr) : 0;
    if (lr) p.face = lr;
    p.vx = lr * WALK;
    if (inp && inp.rainbow && p.cd <= 0) throwRainbow(w, p);
    if (inp && inp.stomp && p.mode === 'ground' && p.sup && p.sup.k === 'r') { breakRainbow(w, rbById(w, p.sup.id), p.i, 'stomp'); }
    if (inp && inp.jump && p.mode === 'ground') { p.vy = VJ; p.mode = 'air'; p.sup = null; w.events.push({ type: 'jump', who: p.i }); }
    p.x = clamp(p.x + p.vx * DT, -XW + PW, XW - PW);
    if (lr && p.mode === 'ground') p.walkT += DT;
    if (p.mode === 'ground') {
      const s = support(w, p.x, p.y, STEP_UP, DROP);
      if (s) { p.y = s.top; p.sup = s; } else { p.mode = 'air'; p.vy = 0; p.sup = null; }
    } else airStep(w, p);
    if (p.mode === 'ground') p.best = Math.max(p.best, p.y);
    // the water and the bottom of the screen
    if (w.water > p.y + 0.6) {
      w.stats.splash++;
      w.events.push({ type: 'splash', who: p.i, x: p.x, y: w.water });
      floatUp(w, p, 'ring');
      loseLife(w);
    } else if (p.y < w.camY - 1.5) {
      w.stats.bubble++;
      w.events.push({ type: 'bubble', who: p.i, x: p.x, y: w.camY });
      floatUp(w, p, 'bubble');
    }
  }
  function airStep(w, p) {
    const y0 = p.y;
    p.vy = Math.max(-18, p.vy - GRAV * DT);
    p.y += p.vy * DT;
    if (p.vy > 0) return;
    let s = landing(w, p.x, y0, p.y);
    while (s && s.k === 'r' && -p.vy > w.L.breakV) {
      // a jump onto a rainbow breaks it, and he keeps falling (maybe onto the next thing down)
      breakRainbow(w, rbById(w, s.id), p.i, 'jump');
      s = landing(w, p.x, y0, p.y);
    }
    if (s) {
      p.y = s.top;
      p.mode = 'ground';
      p.sup = s;
      if (p.vy < -4) { w.events.push({ type: 'land', who: p.i }); p.land = 0.15; }
      p.vy = 0;
    }
  }
  function camera(w) {
    // it follows the highest anyone has stood (not a jump), so it never bobs
    let top = 0;
    for (const p of w.players) top = Math.max(top, w.sab.camDown ? p.y : p.best);
    const camMax = w.goalY - 6.5;
    const want = clamp(top - FOLLOW, 0, Math.max(0, camMax));
    if (w.sab.camDown) { w.camY += clamp(want - w.camY, -7 * DT, 7 * DT); return; }
    if (want > w.camY) w.camY += Math.min(want - w.camY, 7 * DT);
  }

  function step(w, ins) {
    w.events = [];
    w.t += DT;
    w.phaseT += DT;
    if (w.phase === 'ready') {
      if (w.phaseT >= 1.2) { w.phase = 'play'; w.phaseT = 0; w.events.push({ type: 'go' }); }
    } else if (w.phase === 'play') {
      w.roundT += DT;
      const rate = w.L.water + w.L.waterIsland * w.D.ii;
      if (w.roundT > w.L.waterDelay && !w.sab.frozenWater) w.water += rate * DT;
      const low = Math.min(...w.players.map((p) => p.y));
      if (!w.hurry && low - w.water < 3.2 && w.roundT > w.L.waterDelay) { w.hurry = true; w.events.push({ type: 'hurry' }); }
      if (low - w.water > 6) w.hurry = false;
    } else if (w.phase === 'clear') {
      if (w.phaseT >= 3.4) {
        if (w.n >= IS.total - 1) { w.phase = 'won'; w.phaseT = 0; w.events.push({ type: 'won' }); } else loadRound(w, w.n + 1);
      }
    }
    if (w.phase === 'play' || w.phase === 'ready' || w.phase === 'clear') {
      w.players.forEach((p, i) => stepPlayer(w, p, ins && ins[i]));
      stepRainbows(w);
      stepItems(w);
      stepBuddy(w);
    }
    camera(w);
    stepCritters(w);
    if (w.phase === 'play') {
      const g = w.players.find((p) => p.mode === 'ground' && p.y >= w.goalY - 0.05);
      if (g) {
        w.phase = 'clear';
        w.phaseT = 0;
        const bonus = 1000 * (w.D.ri + 1);
        w.players.forEach((p) => (p.score += bonus));
        w.events.push({ type: 'clear', who: g.i, bonus, last: w.n >= IS.total - 1, islandEnd: w.D.ri === 3 });
      }
    }
  }

  RC.sim = {
    DT, GRAV, VJ, WALK, XW, PW, VIEW_H, SPAN, RH, GROW, THICK, LV, FRUIT, TREATS, GEMS,
    create, loadRound, step, call, support, landing, rbTop, arcU, arcY, grown, rbById, throwRainbow, breakRainbow, addRainbow, safeSpot, roomAhead, stairs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
