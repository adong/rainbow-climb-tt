/* TT Rainbow Climb: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   RC.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  const RAINBOW = [523, 587, 659, 784, 880, 988, 1175];
  RC.sfx = {
    log,
    jump: note('jump', () => S.tone({ type: 'square', f: 330, to: 700, dur: 0.12, vol: 0.06, lp: 2000 })),
    land: note('land', () => S.tone({ f: 170, to: 90, dur: 0.07, vol: 0.1 })),
    // a rising sparkle up the 7 colours (shorter when the second rainbow of a double follows)
    rainbow: note('rainbow', (n) => RAINBOW.forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.07, vol: 0.05, at: i * 0.025 + (n > 1 ? 0 : 0) }))),
    fizzle: note('fizzle', () => S.hiss({ filter: 'bandpass', f: 1400, to: 500, q: 1.2, dur: 0.18, vol: 0.08 })),
    breakIt: note('breakIt', () => { S.hiss({ filter: 'bandpass', f: 3200, to: 900, q: 1, dur: 0.3, vol: 0.12 }); RAINBOW.slice().reverse().forEach((f, i) => S.tone({ type: 'triangle', f: f * 1.5, dur: 0.06, vol: 0.05, at: i * 0.03 })); }),
    bonk: note('bonk', (chain) => { S.tone({ type: 'sine', f: 520, to: 1040, dur: 0.1, vol: 0.12 }); S.hiss({ filter: 'bandpass', f: 2200, q: 0.8, dur: 0.12, vol: 0.08 }); S.coin(Math.min(6, chain || 1)); }),
    gemBonk: note('gemBonk', () => { S.tone({ type: 'sine', f: 400, to: 900, dur: 0.12, vol: 0.12 }); [1319, 1568, 2093].forEach((f, i) => S.tone({ type: 'sine', f, dur: 0.12, vol: 0.06, at: 0.08 + i * 0.06 })); }),
    fruit: note('fruit', (n) => S.coin(n || 3)),
    gem: note('gem', (c) => [784, 988, 1175].forEach((f, i) => S.tone({ type: 'triangle', f: f * (1 + (c || 0) * 0.06), dur: 0.12, vol: 0.08, at: i * 0.06 }))),
    rainbowBonus: note('rainbowBonus', () => RAINBOW.concat([1319, 1568, 2093]).forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.2, vol: 0.1, at: i * 0.09 }))),
    oops: note('oops', () => { S.tone({ f: 600, to: 220, dur: 0.3, vol: 0.14, type: 'triangle' }); for (let i = 0; i < 3; i++) S.tone({ f: 1000 - i * 140, to: 1100 - i * 140, dur: 0.1, vol: 0.05, at: 0.3 + i * 0.12, type: 'sine' }); }),
    splash: note('splash', () => { S.hiss({ filter: 'lowpass', f: 2400, to: 400, dur: 0.6, vol: 0.2 }); S.tone({ type: 'sine', f: 300, to: 900, dur: 0.25, vol: 0.08, at: 0.2 }); }),
    bubble: note('bubble', () => { S.tone({ type: 'sine', f: 300, to: 700, dur: 0.18, vol: 0.1 }); S.tone({ type: 'sine', f: 450, to: 900, dur: 0.16, vol: 0.07, at: 0.16 }); }),
    pop: note('pop', () => { S.tone({ type: 'sine', f: 900, to: 300, dur: 0.08, vol: 0.12 }); S.hiss({ f: 4000, dur: 0.05, vol: 0.06 }); }),
    soaked: note('soaked', () => S.tone({ type: 'sine', f: 500, to: 1200, dur: 0.3, vol: 0.05 })),
    hurry: note('hurry', () => [880, 660, 880, 660].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.09, vol: 0.05, at: i * 0.12, lp: 2400 }))),
    clear: note('clear', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, at: i * 0.12 }))),
    island: note('island', () => [392, 523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.12, vol: 0.06, at: i * 0.1 }))),
    won: note('won', () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.3, vol: 0.13, at: i * 0.13 }))),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    stairs: note('stairs', () => { for (let k = 0; k < 4; k++) RAINBOW.forEach((f, i) => S.tone({ type: 'triangle', f: f * (1 + k * 0.25), dur: 0.06, vol: 0.045, at: k * 0.2 + i * 0.02 })); }),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    go: note('go', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.07 }); S.tone({ type: 'square', f: 990, dur: 0.18, vol: 0.07, at: 0.12 }); }),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();
