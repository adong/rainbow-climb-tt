/* TT Rainbow Climb: the play check with real keys and taps, in the page: game.playCheck().
   Everything here presses keys with real keydown/keyup events on window and taps the touch pads with pointer events,
   so it goes through the same input code a kid's fingers do (never the autopilot). Time moves with game.step, which
   runs the same frame code as the browser's own frames. Positions are read on the screen, from the drawn meshes.
   - direction: on every round, → moves right and ← moves left on screen, on a ledge and up a rainbow, for Teddy, Tommy
     and both brothers in 2 players (A D and ← →), with keys and with the touch pads; the rainbow flies out the way he
     faces on screen; the jump goes up the screen and lands.
   - nothing leaves him stuck: an oops with a critter, a splash in the water, the bubble after dropping off the screen,
     a rainbow fading or breaking under him, both walls, jumping up through a ledge, his brother's visit, a key held
     through pause or a lost focus, the next round, 2 players each on his own keys, and a "keyboard kid" mashing keys on
     every round with the critters about.
   game.playCheck('mirror') and game.playCheck('stuck') prove the check fails when the controls are wrong. */
(function () {
  'use strict';
  const S = RC.sim, IS = RC.islands;
  const NAMES = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', Enter: 'Enter', KeyT: 't', KeyP: 'p', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', KeyX: 'x' };
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const step = (s) => game.step(s, { draw: false });
  const st = () => game.state();
  function press(code, secs) {
    key(code, true);
    step(secs);
    key(code, false);
    step(1 / 60);
  }
  function tap(p, k, secs) {
    const el = k === 'call' ? document.querySelector('#touch [data-k="call"]') : document.querySelector(`#touch [data-p="${p}"][data-k="${k}"]`);
    const o = { pointerId: 11 + p, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    step(secs);
    el.dispatchEvent(new PointerEvent('pointerup', o));
    step(1 / 60);
  }
  function fresh(n, o) {
    game.start(Object.assign({ round: n, go: true, level: 'easy', players: 1, who: 'teddy' }, o || {}));
    game.quiet();
    return st();
  }
  // the middle of a wide low ledge (not the floor, on the first screen), away from x = skip
  function roomy(skip) {
    const w = game.world();
    for (const pl of w.plats) {
      if (pl.floor || pl.goal || pl.step || pl.x1 - pl.x0 < 4.2 || pl.y > 7) continue;
      const x = (pl.x0 + pl.x1) / 2;
      if (skip != null && Math.abs(x - skip) < 4) continue;
      return { x, y: pl.y };
    }
    return { x: skip != null && skip < 0 ? 3 : -3, y: 0 };
  }
  const keysFor = (players, i) => (players === 2 ? (i ? { r: 'ArrowRight', l: 'ArrowLeft', jump: 'ArrowUp', rb: 'Enter', stomp: 'ArrowDown' } : { r: 'KeyD', l: 'KeyA', jump: 'KeyW', rb: 'Space', stomp: 'KeyS' }) : { r: 'ArrowRight', l: 'ArrowLeft', jump: 'ArrowUp', rb: 'Space', stomp: 'ArrowDown' });
  const act = (how, i, K, k, secs) => (how === 'keys' ? press(K[k], secs) : tap(i, k, secs));
  const newest = (i) => { const w = game.world(); return w.rainbows.filter((r) => r.owner === i && !r.pair).slice(-1)[0] || null; }; // the first of a double
  const ALL = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyX', 'KeyF'];

  function run(sab) {
    const results = [];
    const ok = (name, pass, info) => results.push({ name, ok: !!pass, info });
    const wasHold = game.G.hold;
    game.hold(true);
    const hadTouch = document.body.classList.contains('touch');
    game.sabotage(sab || null);
    try {
      // ---------- direction on every round: walking on a ledge, the rainbow's way, up a rainbow, the jump; keys and touch ----------
      const setups = [['teddy', 1], ['tommy', 1], ['teddy', 2]];
      for (let n = 0; n < IS.total; n++) {
        for (const [who, players] of setups) {
          for (const how of ['keys', 'touch']) {
            if (how === 'touch' && who === 'tommy' && n % 4) continue; // Tommy's touch pad is Teddy's: every island's first round is plenty
            document.body.classList.toggle('touch', how === 'touch');
            fresh(n, { who, players });
            const w = game.world();
            const tag = `${n + 1} ${players === 2 ? '2P' : who} ${how}`;
            for (let i = 0; i < players; i++) {
              const K = keysFor(players, i);
              const spot = roomy();
              // the other brother waits on the same ledge (no bumping in this game), so the screen stays put for both
              if (players === 2) game.put(1 - i, spot.x + (i ? -1.5 : 1.5), spot.y);
              // walking on a ledge
              const go = (dir) => {
                game.put(i, spot.x, spot.y);
                step(0.05);
                const a = st().players[i], other = players === 2 ? st().players[1 - i] : null;
                act(how, i, K, dir, 0.4);
                const b = st().players[i], ob = players === 2 ? st().players[1 - i] : null;
                return { moved: b.sx - a.sx, x: b.x - a.x, alone: !other || Math.abs(ob.sx - other.sx) < 2 };
              };
              const r = go('r'), l = go('l');
              const right = r.moved > 25 && r.x > 0 && r.alone, left = l.moved < -25 && l.x < 0 && l.alone;
              ok(`walk ${tag}${players === 2 ? ' ' + (i ? 'tommy' : 'teddy') : ''}`, right && left, `→ ${right ? 'right' : 'WRONG'} (${r.moved} px), ← ${left ? 'left' : 'WRONG'} (${l.moved} px)${r.alone && l.alone ? '' : ', moved the other brother too'}`);
              // the rainbow goes the way he faces on screen (→ then ←), and he walks up it: right and up the screen
              const tips = [];
              for (const dir of ['r', 'l']) {
                game.put(i, spot.x, spot.y);
                act(how, i, K, dir, 0.02);
                game.put(i, spot.x, spot.y);
                step(0.35); // the throw cool-down
                act(how, i, K, 'rb', 0.05);
                step(0.3);
                const rb = newest(i), tip = rb && game.rbTip(rb.id), me = st().players[i];
                tips.push(tip ? Math.round(tip[0] - me.sx) : null);
                if (dir === 'l' && rb) {
                  // walk up the one just thrown to the left
                  // (up the screen measured against the island, as the screen may scroll up with him)
                  const a = st().players[i], g0 = game.toScreen(0, 0)[1];
                  act(how, i, K, 'l', 0.45);
                  const b = st().players[i], g1 = game.toScreen(0, 0)[1];
                  tips.push(Math.round(b.sx - a.sx), Math.round(b.sy - a.sy - (g1 - g0)), b.sup);
                }
              }
              const [tr, tl, wx, wy, sup] = tips;
              ok(`rainbow ${tag}${players === 2 ? ' ' + (i ? 'tommy' : 'teddy') : ''}`, tr > 60 && tl < -60 && wx < -25 && wy < -15 && sup === 'r', `thrown facing →: tip ${tr} px, facing ←: ${tl} px; walked up it ${wx} px across, ${wy} px up, on ${sup}`);
              // the jump: up the screen, then back down onto the ledge
              game.put(i, spot.x, spot.y);
              step(0.05);
              const j0 = st().players[i];
              act(how, i, K, 'jump', 0.05);
              step(0.2);
              const j1 = st().players[i];
              step(1.2);
              const j2 = st().players[i];
              ok(`jump ${tag}${players === 2 ? ' ' + (i ? 'tommy' : 'teddy') : ''}`, j1.sy < j0.sy - 20 && j2.mode === 'ground', `${j0.sy}→${j1.sy}→${j2.sy} px (${j2.mode})`);
            }
            if (w !== game.world()) ok(`round ${tag}`, false, 'the world changed under the test');
          }
        }
      }
      document.body.classList.toggle('touch', hadTouch);

      // ---------- nothing leaves him stuck ----------
      const canMove = (label) => {
        const a = st().players[0];
        press('ArrowRight', 0.35);
        const b = st().players[0];
        press('ArrowLeft', 0.35);
        const c = st().players[0];
        press('ArrowUp', 0.05);
        step(0.15);
        const d = st().players[0];
        step(1.3);
        const right = b.sx > a.sx + 15 || (a.x > S.XW - 0.5 && c.sx < b.sx - 15), left = c.sx < b.sx - 15 || (b.x < -S.XW + 0.5 && b.sx > a.sx + 15);
        return { ok: right && left && d.sy < c.sy - 10, info: `${label}: → ${b.sx - a.sx} px, ← ${c.sx - b.sx} px, jump ${d.sy - c.sy} px` };
      };
      // an oops with a critter: blinking, stars, then the keys work
      fresh(0);
      let w = game.world();
      game.put(0, -3, 0);
      w.critters.push({ id: 901, k: 'walk', x: -2.4, y: 0, hy: 0, dir: -1, ph: 0, st: 'go', t: 0, wait: 0 });
      step(0.3);
      const o0 = st();
      step(1);
      game.quiet();
      let m = canMove('after an oops');
      ok('after an oops', o0.players[0].inv > 0 && o0.lives === 4 && m.ok, `inv ${o0.players[0].inv}, lives ${o0.lives}; ${m.info}`);

      // a splash: the rubber ring floats him up out of the water, then the keys work
      fresh(1);
      w = game.world();
      game.put(0, 0, 0);
      w.water = 0.7;
      step(0.1);
      const s0 = st();
      for (let n = 0; n < 30 && st().players[0].mode !== 'ground'; n++) step(0.1);
      const s1 = st();
      m = canMove('after a splash');
      ok('after a splash', s0.players[0].mode === 'bubble' && s1.players[0].mode === 'ground' && s1.players[0].y > s1.water + 2 && m.ok, `ring ${s0.players[0].mode}, landed ${s1.players[0].mode} ${(s1.players[0].y - s1.water).toFixed(1)} m above the water; ${m.info}`);

      // off the bottom of the screen: the bubble brings him back, then the keys work
      fresh(2);
      w = game.world();
      const hi = w.plats.find((q) => q.row === 4 && !q.step);
      game.put(0, (hi.x0 + hi.x1) / 2, hi.y);
      step(2.5);
      const cam0 = st().camY;
      game.put(0, 0, 0);
      let popped = false;
      for (let n = 0; n < 40 && !(popped && st().players[0].mode === 'ground'); n++) { step(0.1); if (st().players[0].mode === 'bubble') popped = true; }
      const b1 = st();
      m = canMove('after the bubble');
      ok('after the bubble', popped && b1.players[0].mode === 'ground' && b1.camY >= cam0 && b1.players[0].y >= b1.camY && m.ok, `bubbled ${popped}, ${b1.players[0].mode} at y ${b1.players[0].y} (screen ${b1.camY}, was ${cam0}); ${m.info}`);

      // a rainbow fading under him, and one he breaks with ↓: he drops onto what's below and can move
      for (const how of ['fade', 'break']) {
        fresh(0);
        w = game.world();
        game.put(0, -5, 0);
        press('Space', 0.05);
        step(0.3);
        const r = newest(0);
        key('ArrowRight', true);
        for (let n = 0; n < 60 && S.arcU(r, w.players[0].x) < 0.45; n++) step(1 / 60);
        key('ArrowRight', false);
        step(0.05);
        const up = st().players[0];
        if (how === 'fade') { r.t = r.life - 0.05; step(0.2); } else press('ArrowDown', 0.05);
        const gone = how === 'fade' ? !w.rainbows.includes(r) : r.st === 'fall';
        step(1.5);
        const down = st().players[0];
        m = canMove(`rainbow ${how}`);
        ok(`rainbow ${how}s under him`, up.sup === 'r' && gone && down.mode === 'ground' && down.y < up.y - 1 && m.ok, `on it ${up.sup} at ${up.y} m, ${how} ${gone}, then ${down.mode} at ${down.y} m; ${m.info}`);
      }

      // both walls: push in, then walk away, jump, throw both ways (into the wall it just fizzles)
      fresh(0);
      w = game.world();
      for (const [into, away] of [['ArrowRight', 'ArrowLeft'], ['ArrowLeft', 'ArrowRight']]) {
        game.put(0, 0, 0);
        press(into, 2.2);
        const a = st().players[0];
        press('Space', 0.05);
        step(0.4);
        const fizz = st().sfx.fizzle || 0;
        press(away, 0.4);
        const b = st().players[0];
        press('Space', 0.05);
        step(0.4);
        const r = newest(0);
        const tip = r && game.rbTip(r.id), me = st().players[0];
        press('ArrowUp', 0.05);
        step(0.2);
        const c = st().players[0];
        step(1.2);
        const sign = into === 'ArrowRight' ? 1 : -1;
        ok(`wall ${into === 'ArrowRight' ? 'right' : 'left'}`, Math.abs(a.x) > S.XW - 0.4 && (b.sx - a.sx) * -sign > 15 && tip && (tip[0] - me.sx) * -sign > 60 && c.sy < b.sy - 10 && fizz > 0, `at x ${a.x}, walked away ${b.sx - a.sx} px, rainbow away ${tip ? Math.round(tip[0] - me.sx) : '-'} px, jump ${c.sy - b.sy} px, fizzles ${fizz}`);
      }

      // up through a ledge: from a rainbow's top under a ledge, jump with → held: he lands on top, never stuck inside
      let hops = 0, bad = 0;
      for (let n = 0; n < IS.total; n += 3) {
        fresh(n);
        w = game.world();
        const pl = w.plats.find((q) => q.row === 1 && q.x1 - q.x0 > 3 && q.x0 > -4.3);
        if (!pl) continue;
        game.put(0, pl.x0 + 0.6, 0);
        key('ArrowRight', true);
        step(0.03);
        key('ArrowRight', false);
        game.put(0, pl.x0 + 0.6 - S.SPAN / 2, 0);
        step(0.35);
        press('Space', 0.05);
        step(0.3);
        key('ArrowRight', true);
        for (let k = 0; k < 40 && !(st().players[0].sup === 'r' && st().players[0].y > S.RH - 0.2); k++) step(1 / 60);
        press('ArrowUp', 0.05);
        step(0.3);
        key('ArrowRight', false);
        step(1.4);
        const q = st().players[0];
        hops++;
        if (q.mode !== 'ground' || q.y < pl.y - 0.01) bad++;
      }
      ok('up through a ledge', hops >= 4 && !bad, `${hops} hops, ${bad} did not end up on top`);

      // his brother's visit: the keys work while he's here, the touch face calls him, and he comes again and again
      fresh(3);
      game.put(0, -5, 0);
      const st0 = st().sfx.stairs || 0;
      press('KeyT', 0.05);
      step(0.6);
      let a = st();
      press('ArrowRight', 0.35);
      let b = st();
      step(2.2);
      press('KeyT', 0.05);
      step(2.4);
      press('KeyT', 0.05);
      step(2.4);
      const st1 = st().sfx.stairs || 0;
      document.body.classList.add('touch');
      fresh(3);
      tap(0, 'call', 0.05);
      const tc = st().buddy;
      document.body.classList.toggle('touch', hadTouch);
      ok('brother visiting', a.buddy && b.players[0].sx > a.players[0].sx + 15 && st1 - st0 >= 3 && tc, `buddy ${a.buddy && a.buddy.who}, → ${b.players[0].sx - a.players[0].sx} px, 3 calls → ${st1 - st0} staircases, touch call ${tc && tc.who}`);

      // a key held through pause, or when the window loses focus: no runaway walking afterwards
      for (const how of ['pause', 'blur']) {
        fresh(0);
        game.put(0, 0, 0);
        key('ArrowRight', true);
        step(0.2);
        if (how === 'pause') { press('KeyP', 0.05); key('ArrowRight', false); press('KeyP', 0.05); } else dispatchEvent(new Event('blur'));
        a = st().players[0];
        step(0.5);
        b = st().players[0];
        if (how === 'blur') key('ArrowRight', false);
        ok(`key held through ${how}`, !st().paused && Math.abs(b.sx - a.sx) < 2, `afterwards it moved ${b.sx - a.sx} px with no key held`);
      }

      // the next round: after ROUND CLEAR and READY, the keys work
      fresh(4);
      w = game.world();
      game.put(0, 0, w.goalY);
      step(3.6);
      const nr = st();
      step(1.4);
      m = canMove('next round');
      ok('next round', nr.n === 5 && m.ok, `round ${nr.n + 1} (${nr.phase}); ${m.info}`);

      // 2 players: each brother on his own keys, and T is a high five
      fresh(2, { players: 2 });
      game.put(0, -4.5, 0);
      game.put(1, 4.5, 0);
      step(0.05);
      a = st();
      press('KeyD', 0.35);
      b = st();
      press('ArrowLeft', 0.35);
      const c3 = st();
      press('KeyT', 0.05);
      step(0.6);
      const h = st();
      ok('2 players own keys', b.players[0].sx > a.players[0].sx + 15 && Math.abs(b.players[1].sx - a.players[1].sx) < 2 && c3.players[1].sx < b.players[1].sx - 15 && Math.abs(c3.players[0].sx - b.players[0].sx) < 2 && h.players[0].score >= 50 && h.players[1].score >= 50,
        `D: Teddy ${b.players[0].sx - a.players[0].sx} px, Tommy ${b.players[1].sx - a.players[1].sx} px; ←: Tommy ${c3.players[1].sx - b.players[1].sx} px; high five ${h.players[0].score}/${h.players[1].score}`);

      // the keyboard kid: random mashing on every round, with the critters about; afterwards → and ← still move him
      let rnd = 7;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      for (let n = 0; n < IS.total; n++) {
        game.start({ round: n, go: true, level: n % 2 ? 'normal' : 'easy', players: 1, who: n % 3 ? 'teddy' : 'tommy' });
        w = game.world();
        const down = new Set();
        let errors = 0;
        try {
          for (let k = 0; k < 260; k++) {
            const kk = ALL[Math.floor(r() * ALL.length)];
            if (down.has(kk)) { key(kk, false); down.delete(kk); } else { key(kk, true); down.add(kk); }
            if (r() < 0.03) press('KeyT', 0.02);
            step(0.05 + r() * 0.1);
          }
        } catch (e) { errors++; }
        down.forEach((kk) => key(kk, false));
        game.quiet();
        for (let k = 0; k < 40 && st().players[0].mode !== 'ground'; k++) step(0.2);
        const ph = st().phase;
        if (ph !== 'play') { ok(`keyboard kid ${n + 1}`, !errors && ph !== 'won', `${errors} errors, ended in ${ph}`); continue; }
        step(1);
        const s1 = st().players[0];
        press('ArrowRight', 0.4);
        const s2 = st().players[0];
        press('ArrowLeft', 0.4);
        const s3 = st().players[0];
        const moved = s2.x !== s1.x || s3.x !== s2.x;
        ok(`keyboard kid ${n + 1}`, !errors && s1.mode === 'ground' && moved, `${errors} errors, ${s1.mode} on ${s1.sup}, keys move him ${moved}`);
      }
    } finally {
      ALL.forEach((k) => key(k, false));
      game.sabotage(null);
      document.body.classList.toggle('touch', hadTouch);
      game.hold(wasHold);
    }
    const failed = results.filter((x) => !x.ok);
    return { ok: !failed.length, total: results.length, failed: failed.map((x) => `${x.name}: ${x.info}`), results };
  }
  run.prove = () => ['mirror', 'stuck'].map((s) => { const r = run(s); return { sabotage: s, caught: !r.ok, failed: r.failed.length, first: r.failed.slice(0, 2) }; });
  game.playCheck = run;
})();
// layout: the kit's left-edge buttons, the HUD and the touch pads never cover the play area (the island's width, from
// the bottom of the screen to the top of the view) or each other; the smallest tap target is reported
(function () {
  'use strict';
  game.layoutCheck = function () {
    const S = RC.sim, w = game.world();
    const r = (el) => el && el.getBoundingClientRect();
    const hit = (a, b) => a && b && a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const shown = (e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const kit = ['kit-help-btn', 'kit-lang-btn', 'kit-sound-btn'].map((id) => document.getElementById(id)).filter(shown);
    const touch = [...document.querySelectorAll('#touch .dk, #touch .tb')].filter(shown);
    const hud = [...document.querySelectorAll('#hud .box, #hud .ibtn, #hud .bud, #hud .gems')].filter(shown);
    const [x0, y0] = game.toScreen(-S.XW, w.camY + S.VIEW_H), [x1, y1] = game.toScreen(S.XW, w.camY - 0.05);
    const area = { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
    const name = (e) => e.id || (e.dataset && e.dataset.k ? `${e.dataset.k}${e.dataset.p || ''}` : e.className);
    const bad = [];
    for (const k of kit) {
      for (const c of touch.concat(hud)) if (hit(r(k), r(c))) bad.push(`${k.id} x ${name(c)}`);
      if (hit(r(k), area)) bad.push(`${k.id} x play area`);
    }
    for (const c of touch) {
      if (hit(r(c), area)) bad.push(`${name(c)} x play area`);
      for (const d of touch) if (c !== d && name(c) < name(d) && hit(r(c), r(d))) bad.push(`${name(c)} x ${name(d)}`);
    }
    const sizes = touch.map((e) => Math.round(Math.min(r(e).width, r(e).height)));
    return { touch: document.body.classList.contains('touch'), two: w.two, area: [x0, y0, x1, y1].map(Math.round), k: +(game.G.k || 0).toFixed(1), bad, smallestTap: sizes.length ? Math.min(...sizes) : null, scroll: document.documentElement.scrollHeight > innerHeight + 2 };
  };
  window.layoutCheck = game.layoutCheck;
})();
