/* TT Rainbow Climb: the 4 islands of 4 rounds. Each round is a tall island: a sandy floor, rows of one-way ledges
   (jump up through them, land on top) every ROW metres, and the goal at the top. The rows are too far apart to jump,
   so rainbows are the way up. Layouts are seeded from the round number, so a round is the same every time you play
   it; EASY adds little step ledges between some rows. No THREE here: the rules (js/sim.js) and the check use it too. */
(function (root) {
  'use strict';
  const RC = (root.RC = root.RC || {});
  const XW = 7, ROW = 3.2;
  const LIST = [
    { id: 'flower', name: 'FLOWER ISLAND', walker: 'ladybug', flyer: 'bee', sky: ['#7fd0ff', '#d6f3ff'], sea: '#2bb8e8', top: '#6fd64a', side: '#c98a4b', rim: '#4caa2e', deco: ['🌼', '🌷', '🍄', '🌻'] },
    { id: 'toy', name: 'TOY ISLAND', walker: 'mouse', flyer: 'plane', sky: ['#9fb6ff', '#ffe0f2'], sea: '#3aa0f0', top: '#ff5a5f', side: '#ffd23f', rim: '#3d6ad6', deco: ['🧸', '🪀', '🎈', '🚂'] },
    { id: 'candy', name: 'CANDY ISLAND', walker: 'gummy', flyer: 'bonbon', sky: ['#ffb3d9', '#fff0d6'], sea: '#5ad6e0', top: '#ff8fc8', side: '#b87a4b', rim: '#ffffff', deco: ['🍭', '🧁', '🍬', '🍩'] },
    { id: 'cloud', name: 'CLOUD ISLAND', walker: 'sheep', flyer: 'puff', sky: ['#ffd08a', '#c7b8ff'], sea: '#4c8df0', top: '#ffffff', side: '#bfe3ff', rim: '#ffe27a', deco: ['⭐', '🌙', '🪁', '☁️'] },
  ];
  const ROUND_NAMES = ['ROUND 1', 'ROUND 2', 'ROUND 3', 'ROUND 4'];

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // round n (0..15) on level ('easy' | 'normal'): ledges, the goal height and where the critters start
  function layout(n, level) {
    const ii = Math.floor(n / 4), ri = n % 4;
    const R = rng(1013 + n * 7919);
    const rows = 7 + ri + ii;
    const plats = [{ x0: -XW, x1: XW, y: 0, floor: true }];
    for (let k = 1; k <= rows; k++) {
      const y = k * ROW;
      const c = 1 + Math.floor(R() * 3);
      const slot = (2 * XW) / c;
      for (let s = 0; s < c; s++) {
        const wd = Math.min(slot - 0.9, 2.6 + R() * 3.4);
        const x0 = -XW + s * slot + R() * (slot - wd);
        plats.push({ x0: +x0.toFixed(2), x1: +(x0 + wd).toFixed(2), y, row: k });
      }
      const stepChance = level === 'easy' ? 0.5 : 0.22;
      if (k > 1 && R() < stepChance) {
        const x0 = -XW + 0.6 + R() * (2 * XW - 3.4);
        plats.push({ x0: +x0.toFixed(2), x1: +(x0 + 2.2).toFixed(2), y: y - ROW / 2, row: k - 0.5, step: true });
      }
    }
    const goalY = (rows + 1) * ROW;
    plats.push({ x0: -XW, x1: XW, y: goalY, goal: true });
    const critters = [];
    const nw = Math.max(1, 2 + ri + ii - (level === 'easy' ? 2 : 0));
    const ledges = plats.filter((p) => p.row >= 2 && !p.step && p.x1 - p.x0 >= 3);
    for (let j = 0; j < nw && ledges.length; j++) {
      const p = ledges.splice(Math.floor(R() * ledges.length), 1)[0];
      critters.push({ k: 'walk', x: (p.x0 + p.x1) / 2, y: p.y, dir: R() < 0.5 ? -1 : 1 });
    }
    const nf = Math.max(0, Math.floor((ii + ri + 1) / 2) - (level === 'easy' ? 1 : 0));
    for (let j = 0; j < nf; j++) {
      const k = 2 + Math.floor(R() * (rows - 1));
      critters.push({ k: 'fly', x: -XW + 1.5 + R() * (2 * XW - 3), y: k * ROW + 1.4, dir: R() < 0.5 ? -1 : 1 });
    }
    const I = LIST[ii];
    return { n, ii, ri, rows, plats, goalY, critters, island: I, name: I.name, round: ROUND_NAMES[ri] };
  }

  RC.islands = { XW, ROW, list: LIST, count: LIST.length, rounds: 4, total: LIST.length * 4, layout, rng };
})(typeof window !== 'undefined' ? window : globalThis);
