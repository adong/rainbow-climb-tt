/* TT Rainbow Climb: the headless check of the rules. The page runs it as game.check(); node runs it as
   node tools/check.js. The brief's rules: a rainbow is solid and walkable; a broken rainbow falls and bonks; the water
   rises on a timer; an autopilot climbs every round on EASY; the screen scrolls up only. And a few more: thrown the way
   you face, bonks where it lands, one-way ledges, walls, EASY vs NORMAL, the gems, the goal, the brother's staircase.
   RC.check.fail() turns on one sabotage at a time in the rules and proves the check catches each. */
(function (root) {
  'use strict';
  const RC = (root.RC = root.RC || {});
  const S = RC.sim, B = RC.bot, IS = RC.islands;
  let SAB = {};
  const near = (a, b, e) => Math.abs(a - b) <= e;

  function mk(o) {
    const w = S.create(Object.assign({ level: 'easy', players: ['teddy'], round: 0, seed: 11, sab: SAB }, o || {}));
    w.phase = 'play';
    w.phaseT = 0;
    return w;
  }
  const run = (w, secs, inp) => { for (let i = 0, n = Math.round(secs / S.DT); i < n; i++) S.step(w, typeof inp === 'function' ? inp(w, i) : inp || []); };
  const quiet = (w) => { w.critters = []; return w; };
  const put = (w, i, x, y, face) => Object.assign(w.players[i], { x, y, vx: 0, vy: 0, mode: 'ground', sup: S.support(w, x, y, 0.05, 0.05), face: face || 1, inv: 0, cd: 0, bub: null });
  const once = (o) => (w, i) => (i === 0 ? [o] : [{}]);
  const evs = (w, secs, inp) => { const out = []; for (let i = 0, n = Math.round(secs / S.DT); i < n; i++) { S.step(w, typeof inp === 'function' ? inp(w, i) : inp || []); out.push(...w.events); } return out; };

  const CHECKS = {
    // a rainbow is solid and walkable: walk up it on its curve, stand on its top, land on it softly
    rainbowWalk() {
      const w = quiet(mk({ level: 'normal' }));
      put(w, 0, -5, 0, 1);
      run(w, S.DT, [{ rainbow: true }]);
      const r = w.rainbows[0];
      if (!r) return [false, 'no rainbow was thrown'];
      run(w, 0.3);
      let worst = 0, air = 0, top = 0, samples = 0;
      for (let i = 0; i < 120 && S.arcU(r, w.players[0].x) < 0.5; i++) {
        run(w, S.DT, [{ lr: 1 }]);
        const p = w.players[0], u = S.arcU(r, p.x);
        if (u > 0.05 && u < 0.95) { worst = Math.max(worst, Math.abs(p.y - S.arcY(r, u))); samples++; }
        if (p.mode !== 'ground') air++;
        top = Math.max(top, p.y);
      }
      const yTop = w.players[0].y;
      run(w, 3);
      const p = w.players[0];
      const stands = p.mode === 'ground' && p.sup && p.sup.k === 'r' && near(p.y, yTop, 0.01);
      // a soft landing from a little hop onto a rainbow in the air holds him
      const w2 = quiet(mk({ level: 'normal' }));
      w2.plats = [w2.plats[0], w2.plats[w2.plats.length - 1]];
      const r2 = S.addRainbow(w2, { owner: 0, x0: -2, dir: 1, span: S.SPAN, h: S.RH, y0: 4, t: 1 });
      r2.st = 'ok';
      Object.assign(w2.players[0], { x: 0.2, y: S.arcY(r2, S.arcU(r2, 0.2)) + 0.4, vy: 0, mode: 'air', sup: null });
      run(w2, 0.5);
      const p2 = w2.players[0];
      const lands = p2.mode === 'ground' && p2.sup && p2.sup.k === 'r';
      const ok = samples > 20 && worst < 0.06 && air === 0 && top > S.RH - 0.1 && stands && lands;
      return [ok, `${samples} steps on the curve, off by ≤ ${worst.toFixed(3)} m, ${air} steps in the air, top ${top.toFixed(2)} m; stands 3 s: ${stands}; soft landing holds: ${lands}`];
    },
    // the rainbow goes the way he faces, and bonks a critter where it lands (it turns into fruit)
    throwFacing() {
      const out = [];
      let ok = true;
      for (const face of [1, -1]) {
        const w = mk({ level: 'normal' });
        put(w, 0, 0, 0, face);
        w.critters = [{ id: 900, k: 'walk', x: face * 4.2, y: 0, hy: 0, dir: face, ph: 0, st: 'go', t: 0, wait: 5 }];
        const e = evs(w, 0.4, (w, i) => [i === 0 ? { rainbow: true } : {}]);
        const r = w.rainbows[0];
        const bonked = e.some((x) => x.type === 'bonk' && x.how === 'fruit');
        const fruit = w.items.some((x) => x.k === 'fruit');
        const good = r && r.dir === face && (r.x0 + r.dir * r.span) * face > 3 && bonked && fruit;
        ok = ok && good;
        out.push(`face ${face}: arc ${r ? r.dir : '-'} to x ${r ? (r.x0 + r.dir * r.span).toFixed(1) : '-'}, critter bonked ${bonked}, fruit ${fruit}`);
      }
      return [ok, out.join('; ')];
    },
    // a broken rainbow falls and bonks: stomp it (↓) or land on it from a jump; critters below drop gems
    brokenFalls() {
      const out = [];
      let ok = true;
      for (const how of ['stomp', 'jump']) {
        const w = mk({ level: 'normal' });
        w.plats = [{ x0: -7, x1: 7, y: 0, floor: true }, { x0: -7, x1: -1, y: 6.4 }, { x0: -7, x1: 7, y: 40, goal: true }];
        w.goalY = 40;
        w.critters = [{ id: 901, k: 'walk', x: 0.9, y: 0, hy: 0, dir: 1, ph: 0, st: 'go', t: 0, wait: 99 }];
        put(w, 0, -1.4, 6.4, 1);
        run(w, S.DT, [{ rainbow: true }]);
        run(w, 0.3);
        const r = w.rainbows[0];
        let e = [];
        if (how === 'stomp') {
          for (let i = 0; i < 90 && S.arcU(r, w.players[0].x) < 0.45; i++) run(w, S.DT, [{ lr: 1 }]);
          e = evs(w, S.DT, [{ stomp: true }]);
        } else {
          Object.assign(w.players[0], { x: 0.9, y: r.y0 + r.h + 2.6, vy: 0, mode: 'air', sup: null });
          for (let i = 0; i < 60 && r.st !== 'fall'; i++) e.push(...evs(w, S.DT));
        }
        const y0 = r.y0;
        e.push(...evs(w, 0.25));
        const fell = r.st === 'fall' && r.y0 < y0 - 0.2;
        e.push(...evs(w, 1.5));
        const brk = e.find((x) => x.type === 'break');
        const bonk = e.some((x) => x.type === 'bonk' && x.how === 'gem');
        const gem = w.items.some((x) => x.k === 'gem') || e.some((x) => x.type === 'gem');
        const gone = !w.rainbows.includes(r);
        const good = brk && brk.why === how && fell && bonk && gem && gone;
        ok = ok && good;
        out.push(`${how}: breaks ${!!brk}${brk ? ' (' + brk.why + ')' : ''}, falls ${fell}, bonks the critter below ${bonk}, gem ${gem}, gone ${gone}`);
      }
      return [ok, out.join('; ')];
    },
    // the water rises on a timer, the same every second, faster on NORMAL; it splashes a climber who stays put
    waterRises() {
      const rates = {};
      let ok = true;
      const out = [];
      for (const level of ['easy', 'normal']) {
        const w = quiet(mk({ level }));
        const L = S.LV[level];
        run(w, L.waterDelay - 0.5);
        const still = w.water;
        run(w, 0.5 + 10);
        const a = w.water;
        run(w, 10);
        const b = w.water;
        run(w, 10);
        const c = w.water;
        rates[level] = (c - a) / 20;
        const good = still === -2.5 && near(b - a, c - b, 1e-6) && near(b - a, 10 * L.water, 0.02);
        ok = ok && good;
        out.push(`${level}: waits ${L.waterDelay} s, then ${(b - a).toFixed(2)} and ${(c - b).toFixed(2)} m per 10 s`);
      }
      const w = quiet(mk({ level: 'normal' }));
      const lives = w.lives;
      let splash = false;
      for (let i = 0; i < 60 * 40 && !splash; i++) { S.step(w, []); splash = w.events.some((x) => x.type === 'splash'); }
      const p = w.players[0];
      run(w, 2);
      const safe = p.mode === 'ground' && p.y > w.water + 2;
      ok = ok && rates.normal > rates.easy && splash && w.lives === lives - 1 && safe;
      out.push(`standing still: splash ${splash}, lives ${lives}→${w.lives}, floats up above the water ${safe}`);
      return [ok, out.join('; ')];
    },
    // the autopilot climbs every round on EASY (1 player and 2 players), and the screen never scrolls down
    autopilot() {
      const out = [];
      let ok = true, slow = 0;
      for (const players of [['teddy'], ['tommy', 'teddy']]) {
        const done = [];
        for (let n = 0; n < IS.total; n++) {
          const w = mk({ level: 'easy', players, round: n, seed: 21 + n });
          let t = 0;
          while (t < 240 && w.phase === 'play') { S.step(w, w.players.map((p, i) => B.decide(w, i))); t += S.DT; }
          const good = w.phase === 'clear' && w.lives > 0;
          if (!good) ok = false;
          slow = Math.max(slow, t);
          done.push(good ? `${n + 1}:${Math.round(t)}s` : `${n + 1}:${w.phase.toUpperCase()}`);
        }
        out.push(`${players.length}P ${done.join(' ')}`);
      }
      return [ok, out.join(' | ') + ` (slowest ${Math.round(slow)} s)`];
    },
    autopilotNormal() {
      const done = [];
      let ok = true;
      for (let n = 0; n < IS.total; n++) {
        const w = mk({ level: 'normal', round: n, seed: 31 + n });
        let t = 0;
        while (t < 240 && w.phase === 'play') { S.step(w, [B.decide(w, 0)]); t += S.DT; }
        if (w.phase !== 'clear') ok = false;
        done.push(w.phase === 'clear' ? `${n + 1}:${Math.round(t)}s` : `${n + 1}:${w.phase.toUpperCase()}`);
      }
      return [ok, `1P ${done.join(' ')}`];
    },
    // the screen scrolls up only: never down while the autopilot climbs, nor when a climber drops down a long way
    scrollsUpOnly() {
      let down = 0, rounds = 0, reachedTop = true;
      for (const n of [0, 5, 10, 15]) {
        const w = mk({ level: 'easy', round: n, seed: 41 + n });
        let last = w.camY, t = 0;
        while (t < 240 && w.phase === 'play') { S.step(w, [B.decide(w, 0)]); t += S.DT; down = Math.max(down, last - w.camY); last = w.camY; }
        rounds++;
        if (w.camY < w.goalY - 6.5 - 0.5) reachedTop = false;
      }
      // climb high, then drop to the floor: the screen stays put and he bubbles back up onto it
      const w = quiet(mk({ level: 'easy', round: 3 }));
      const hi = w.plats.find((q) => q.row === 5 && !q.step);
      put(w, 0, (hi.x0 + hi.x1) / 2, hi.y, 1);
      run(w, 3);
      const up = w.camY;
      put(w, 0, 0, 0, 1);
      const e = evs(w, 3);
      const p = w.players[0];
      const stayed = w.camY >= up - 1e-9, bubbled = e.some((x) => x.type === 'bubble') && p.mode === 'ground' && p.y >= w.camY;
      const ok = down <= 1e-9 && reachedTop && up > 8 && stayed && bubbled;
      return [ok, `autopilot ${rounds} rounds: biggest step down ${down.toFixed(3)} m, reaches the top ${reachedTop}; up to ${up.toFixed(1)} m then dropped to the floor: screen stays ${stayed}, bubbles back up ${bubbled}`];
    },
    // → moves right and ← moves left, on a ledge and on a rainbow; the walls never trap him; ledges are one-way
    walkWallsLedges() {
      const w = quiet(mk({ level: 'normal' }));
      put(w, 0, 0, 0, 1);
      const x0 = w.players[0].x;
      run(w, 0.5, [{ lr: 1 }]);
      const x1 = w.players[0].x;
      run(w, 0.5, [{ lr: -1 }]);
      const x2 = w.players[0].x;
      const dir = x1 > x0 + 1.5 && x2 < x1 - 1.5 && w.players[0].face === -1;
      let walls = true;
      for (const d of [1, -1]) {
        run(w, 4, [{ lr: d }]);
        const at = w.players[0].x;
        run(w, 0.4, [{ lr: -d }]);
        if ((w.players[0].x - at) * -d < 1) walls = false;
        run(w, S.DT, [{ jump: true }]);
        if (w.players[0].mode !== 'air') walls = false;
        run(w, 1.2);
      }
      const w2 = quiet(mk({ level: 'normal' }));
      const pl = w2.plats.find((q) => q.row === 1);
      put(w2, 0, (pl.x0 + pl.x1) / 2, 0, 1);
      // from the floor a jump can't reach a row: stand on a rainbow's top under a ledge, then jump up through it
      const r = S.addRainbow(w2, { owner: 0, x0: (pl.x0 + pl.x1) / 2 - S.SPAN / 2, dir: 1, span: S.SPAN, h: S.RH, y0: 0, t: 1 });
      r.st = 'ok';
      put(w2, 0, (pl.x0 + pl.x1) / 2, S.RH, 1);
      run(w2, S.DT, [{ jump: true }]);
      run(w2, 1.5);
      const p2 = w2.players[0];
      const oneWay = p2.mode === 'ground' && near(p2.y, pl.y, 0.01);
      return [dir && walls && oneWay, `→ ${x0.toFixed(1)}→${x1.toFixed(1)}, ← →${x2.toFixed(1)}; walls let go both ways ${walls}; jumped up through a ledge onto it ${oneWay}`];
    },
    // EASY: 5 lives, double rainbows, slower water, softer rainbows; NORMAL: 3 lives, one rainbow a throw
    easyNormal() {
      const e = quiet(mk({ level: 'easy' })), n = quiet(mk({ level: 'normal' }));
      put(e, 0, -5, 0, 1);
      put(n, 0, -5, 0, 1);
      run(e, S.DT, [{ rainbow: true }]);
      run(n, S.DT, [{ rainbow: true }]);
      const ok = e.lives === 5 && n.lives === 3 && e.rainbows.length === 2 && n.rainbows.length === 1 && S.LV.easy.water < S.LV.normal.water && S.LV.easy.breakV > S.LV.normal.breakV;
      return [ok, `EASY ${e.lives} lives, ${e.rainbows.length} rainbows a throw; NORMAL ${n.lives} lives, ${n.rainbows.length} a throw; water ${S.LV.easy.water} vs ${S.LV.normal.water} m/s`];
    },
    // collect the 7 coloured gems for the bonus (and an extra life); reach the goal to clear the round
    gemsAndGoal() {
      const w = quiet(mk({ level: 'normal' }));
      put(w, 0, 0, 0, 1);
      const lives = w.lives;
      let bonus = false;
      for (let c = 0; c < S.GEMS; c++) {
        w.items.push({ id: 800 + c, k: 'gem', c, x: 0, y: 0.3, vy: 0, t: 1, life: 9, value: 1000, still: true });
        const e = evs(w, 0.1);
        if (e.some((x) => x.type === 'rainbowBonus')) bonus = c === S.GEMS - 1;
      }
      const life = w.lives === lives + 1;
      const n0 = w.n;
      const top = w.plats.find((q) => q.goal);
      put(w, 0, 0, top.y, 1);
      const e = evs(w, 4);
      const clear = e.some((x) => x.type === 'clear') && w.n === n0 + 1 && w.phase === 'ready';
      const last = mk({ level: 'normal', round: IS.total - 1 });
      quiet(last);
      put(last, 0, 0, last.goalY, 1);
      run(last, 4);
      return [bonus && life && clear && last.phase === 'won', `7 gems → bonus ${bonus}, extra life ${life}; goal → round ${n0 + 1}→${w.n + 1} ${clear}; the last goal → ${last.phase}`];
    },
    // the brother pops in, tosses a treat and throws a giant rainbow staircase you can walk up; call him as often as you like
    buddyStairs() {
      const w = quiet(mk({ level: 'normal', round: 3 }));
      put(w, 0, -5, 0, 1);
      const okCall = S.call(w);
      let e = evs(w, 2.2);
      const treat = e.some((x) => x.type === 'treat'), stairs = e.find((x) => x.type === 'stairs');
      const arcs = w.rainbows.filter((r) => r.giant);
      const rising = arcs.length >= 3 && arcs.every((r, i) => i === 0 || r.y0 > arcs[i - 1].y0 + 2);
      const d = stairs ? stairs.dir : 1;
      run(w, 0.8);
      let hi = 0;
      for (let i = 0; i < 60 * 8; i++) { run(w, S.DT, [{ lr: d }]); hi = Math.max(hi, w.players[0].y); }
      run(w, 2);
      const again = S.call(w);
      e = evs(w, 2.4);
      const twice = e.some((x) => x.type === 'stairs');
      const t2 = mk({ level: 'normal', players: ['teddy', 'tommy'] });
      const hi5 = S.call(t2) && t2.events.some((x) => x.type === 'hi5') && !t2.buddy;
      const ok = okCall && treat && rising && hi > 8 && again && twice && hi5;
      return [ok, `call → treat ${treat}, ${arcs.length} giant arcs rising ${rising}, walked up to ${hi.toFixed(1)} m; called again → more stairs ${twice}; 2 players: high five ${hi5}`];
    },
  };

  function runChecks(only) {
    const results = [];
    for (const name of Object.keys(CHECKS)) {
      if (only && !only.includes(name)) continue;
      let ok = false, info = '';
      try { [ok, info] = CHECKS[name](); } catch (e) { ok = false; info = 'threw ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); }
      results.push({ name, ok: !!ok, info });
    }
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    return { ok: failed.length === 0, results, failed };
  }
  // each sabotage breaks one rule; the check named must then fail
  const SABOTAGE = [
    ['notSolid', 'rainbows are not solid', 'rainbowWalk'],
    ['mirrorThrow', 'the rainbow goes the other way', 'throwFacing'],
    ['noFallBonk', 'a falling rainbow bonks nothing', 'brokenFalls'],
    ['frozenWater', 'the water never rises', 'waterRises'],
    ['lazyBot', 'the autopilot never throws a rainbow', 'autopilot'],
    ['camDown', 'the screen follows him down', 'scrollsUpOnly'],
  ];
  function fail() {
    const caught = [];
    for (const [sab, what, check] of SABOTAGE) {
      SAB = { [sab]: true };
      let r;
      try { r = runChecks([check]); } finally { SAB = {}; }
      caught.push({ sabotage: sab, what, check, caught: !r.ok, failed: r.results.map((x) => (x.ok ? 'passed?! ' : '') + x.info.slice(0, 140)) });
    }
    return { ok: caught.every((c) => c.caught), caught };
  }

  RC.check = { run: runChecks, fail, CHECKS: Object.keys(CHECKS) };
})(typeof window !== 'undefined' ? window : globalThis);
