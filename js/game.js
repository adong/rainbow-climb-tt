/* TT Rainbow Climb: the page. The Three.js scene with a fixed arcade camera that only scrolls up, the HUD and screens,
   keys and touch (one pad each in 2 players), the brother who pops in with a giant rainbow staircase, the celebrations,
   and the window.game test hooks. The rules are js/sim.js (fixed 1/60 s steps); the 3D things js/art.js; sounds js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = RC.sim, A = RC.art, SFX = RC.sfx, IS = RC.islands;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT;
  const KEY = 'rainbowClimbTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: String(id).toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.52; // the kit's people are 2 m tall; climbers here are about 1 m
  const FRIENDS = { easy: [['foxy', 15000], ['froggy', 9000]], normal: [['foxy', 25000], ['froggy', 15000]] };
  const FACE_R = -2.02, FACE_L = 2.02;

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.top = this.d.top || {};
      this.d.open = this.d.open || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
    table(level) {
      const t = (this.d.top[level] || []).slice();
      for (const [who, score] of FRIENDS[level]) if (!t.some((r) => r.who === who && r.cpu)) t.push({ who, score, cpu: true });
      return t.sort((a, b) => b.score - a.score).slice(0, 6);
    },
    add(level, who, score) {
      if (!score) return null;
      const row = { who, score, at: Date.now() };
      const mine = (this.d.top[level] || []).concat([row]).sort((a, b) => b.score - a.score).slice(0, 5);
      this.d.top[level] = mine;
      this.save();
      return mine.includes(row) ? row : null;
    },
    opened(level) { return Math.max(1, Math.min(IS.count, this.d.open[level] || 1)); },
    open(level, n) { if (n > this.opened(level)) { this.d.open[level] = Math.min(IS.count, n); this.save(); } },
  };

  const G = {
    screen: 'loading', w: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, taps: [{}, {}], touch: [{ l: 0, r: 0 }, { l: 0, r: 0 }], buf: [{}, {}], acc: 0, time: 0,
    players: 1, who: 'teddy', level: 'easy', ii: 0, sab: null, oopsOnce: [false, false],
    scene2: null, overT: 0, newRows: [], frame: 0, islandFor: null, throwT: [0, 0], oopsT: [0, 0],
  };
  let renderer, scene, cam, back, water, sparkles, confetti, islandMesh = null, treat, ball, peace, budCloud, last = 0;
  const people = {}, bubbles = [], rings = [], stars = [];
  let portraits = {};
  const rbMeshes = new Map(), critMeshes = new Map(), critPool = {}, itemMeshes = new Map();
  const v3 = new T.Vector3();

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(30, 1, 1, 400);
    scene.add(new T.HemisphereLight('#ffffff', '#b6a6d6', 0.95));
    const sun = new T.DirectionalLight('#fff4dd', 0.7);
    sun.position.set(-8, 20, 30);
    scene.add(sun);
    back = A.backdrop(scene);
    water = A.water(scene);
    sparkles = A.sparkles(scene, 260);
    confetti = A.confetti(scene, 700);
    for (const id of ['teddy', 'tommy']) {
      const p = Kit.people.build(Kit.roster.get(id).look);
      p.root.scale.setScalar(SCALE);
      p.root.visible = false;
      scene.add(p.root);
      people[id] = p;
    }
    for (let i = 0; i < 2; i++) {
      const b = A.bubble();
      b.visible = false;
      scene.add(b);
      bubbles.push(b);
      const rg = A.ring();
      rg.visible = false;
      scene.add(rg);
      rings.push(rg);
      const st = A.stars();
      st.visible = false;
      scene.add(st);
      stars.push(st);
    }
    treat = A.emoji('🍦', 0.45);
    treat.visible = false;
    scene.add(treat);
    ball = A.emoji('🏀', 0.36);
    ball.visible = false;
    scene.add(ball);
    peace = A.emoji('✌️', 0.4);
    peace.visible = false;
    scene.add(peace);
    budCloud = A.emoji('☁️', 1.1);
    budCloud.visible = false;
    scene.add(budCloud);
    portraits = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.level === 'normal') G.level = 'normal';
    G.ii = Math.max(0, Math.min(store.opened(G.level) - 1, o.ii || 0));
    $('gems').innerHTML = A.GEM_COL.map((c) => `<i style="background:${c};color:${c}"></i>`).join('');
    setupUI();
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------- the fixed arcade camera: the island's width fits the free part of the screen; it scrolls up with the sim ----------
  const BOX = { x0: -7.9, x1: 7.9, y0: -0.3, h: S.VIEW_H + 0.3 };
  const CAM = { x: 0, rel: 6, D: 40 };
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const short = H <= 460, narrow = W <= 520;
    let top = short ? 48 : narrow ? 56 : 66, bottom = 6, left = 58, right = 10;
    if (document.body.classList.contains('touch') && (G.screen === 'play' || G.screen === 'pause')) {
      const two = G.w && G.w.two;
      if (H > W) bottom = W <= 520 ? (two ? 170 : 290) : two ? 290 : 222;
      else {
        left = short ? 196 : 226;
        right = two ? (short ? 154 : 184) : short ? 180 : 214;
      }
    }
    const sw = Math.max(50, W - left - right), sh = Math.max(50, H - top - bottom);
    const k = Math.min(sw / (BOX.x1 - BOX.x0), sh / BOX.h);
    const viewH = H / k;
    CAM.D = viewH / 2 / Math.tan((cam.fov * PI) / 360);
    CAM.x = (BOX.x0 + BOX.x1) / 2 - (left + sw / 2 - W / 2) / k;
    CAM.rel = BOX.y0 + (H / 2 - bottom) / k; // the box's bottom sits on the free area's bottom; a tall screen shows more above
    cam.aspect = W / H;
    cam.near = Math.max(1, CAM.D * 0.4);
    cam.far = CAM.D + 200;
    cam.updateProjectionMatrix();
    G.k = k;
    G.margins = { top, bottom, left, right };
    placeCamera();
  }
  function placeCamera() {
    const y = (G.w ? G.w.camY : 0) + CAM.rel;
    cam.position.set(CAM.x, y, CAM.D);
    cam.lookAt(CAM.x, y, 0);
    cam.updateMatrixWorld();
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z || 0).project(cam);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newWorld(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    return S.create({ level: demo ? 'easy' : G.level, players: who, round: demo ? 0 : G.ii * IS.rounds, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
  }
  function resetInput() {
    G.keys = {};
    G.taps = [{}, {}];
    G.touch = [{ l: 0, r: 0 }, { l: 0, r: 0 }];
    G.buf = [{}, {}];
    document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
  }
  function clearWorldView() {
    for (const m of rbMeshes.values()) { scene.remove(m); m.material.dispose(); }
    rbMeshes.clear();
    for (const [, m] of critMeshes) { scene.remove(m); (critPool[m.userData.kind] = critPool[m.userData.kind] || []).push(m); }
    critMeshes.clear();
    for (const m of itemMeshes.values()) scene.remove(m);
    itemMeshes.clear();
    confetti.clear();
    sparkles.clear();
    clearPops();
  }
  function play() {
    Kit.sound.init();
    store.d.opts = { players: G.players, who: G.who, level: G.level, ii: G.ii };
    store.save();
    clearWorldView();
    G.w = newWorld(false);
    G.demo = false;
    G.paused = false;
    G.overT = 0;
    G.scene2 = null;
    G.oopsOnce = [false, false];
    G.acc = 0;
    resetInput();
    document.body.classList.toggle('two', G.w.two);
    showScreen('play');
    setupBud();
    big('READY?', stageLine());
    Kit.sound.music('play');
  }
  function setupBud() {
    const w = G.w;
    const who = w.two ? null : Kit.roster.buddyFor(w.players[0].who);
    const img = w.two ? '' : portraits[who] || '';
    $('budBtn').querySelector('img').src = img || portraits.tommy;
    $('budBtn').querySelector('img').style.display = w.two ? 'none' : '';
    document.querySelector('.tb.call img').src = img;
    setText($('budLbl'), w.two ? '✋ HIGH FIVE' : `CALL ${NAME(who)}`);
    setText(document.querySelector('.tb.call small'), w.two ? 'HIGH 5' : 'CALL');
    document.querySelectorAll('.tag2').forEach((t) => setText(t, NAME(w.players[+t.dataset.name] ? w.players[+t.dataset.name].who : 'tommy')));
  }
  function call() {
    if (!G.w || G.demo || G.screen !== 'play' || G.paused) return false;
    const ok = S.call(G.w);
    if (ok) handleEvents(G.w.events.splice(0));
    return ok;
  }

  // ---------- screens ----------
  function showScreen(id) {
    G.screen = id;
    for (const s of ['title', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title' || id === 'results');
    $('touch').classList.toggle('hidden', id !== 'play');
    $('menuMute').classList.toggle('hidden', id === 'play' || id === 'pause');
    document.body.classList.toggle('title', id === 'title');
    if (id !== 'play' && id !== 'pause') { $('bigmsg').classList.remove('show'); $('toast').classList.remove('show'); clearPops(); }
    fit();
  }
  function showTitle() {
    clearWorldView();
    G.w = newWorld(true);
    G.demo = true;
    G.paused = false;
    G.scene2 = null;
    document.body.classList.remove('two');
    showScreen('title');
    refreshTitle();
    Kit.sound.music('title');
  }
  function refreshTitle() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    const open = store.opened(G.level);
    G.ii = Math.max(0, Math.min(open - 1, G.ii));
    setText($('mName'), `${G.ii + 1} · ${IS.list[G.ii].name}`);
    setText($('mSub'), open > 1 ? `${open} OF ${IS.count} OPEN` : 'CLIMB IT TO OPEN THE NEXT');
    $('mPrev').disabled = G.ii <= 0;
    $('mNext').disabled = G.ii >= open - 1;
    const top = store.table(G.level)[0];
    setText($('titleHi'), `HI-SCORE ${fmt(top.score)} · ${NAME(top.who)}`);
  }
  function setOpt(k, v) {
    G[k] = v;
    SFX.click();
    refreshTitle();
  }
  function pickIsland(d) {
    const n = Math.max(0, Math.min(store.opened(G.level) - 1, G.ii + d));
    if (n !== G.ii) setOpt('ii', n);
  }
  function pause() {
    if (G.screen !== 'play' || G.paused) return;
    G.paused = true;
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    resetInput();
    showScreen('play');
    Kit.sound.music('play');
  }
  function showResults() {
    const w = G.w;
    const ps = w.players;
    G.newRows = ps.map((p) => store.add(w.level, p.who, p.score)).filter(Boolean);
    const won = w.phase === 'won';
    setText($('resTitle'), won ? 'ALL ISLANDS CLIMBED!' : ps.length === 2 ? 'TEAM CLIMB!' : 'GREAT CLIMBING!');
    const reached = `island ${w.D.ii + 1} round ${w.D.ri + 1}`;
    setText($('resSub'), ps.length === 2 ? `${NAME(ps[0].who)} ${fmt(ps[0].score)} · ${NAME(ps[1].who)} ${fmt(ps[1].score)}` : won ? `${fmt(ps[0].score)} points · all ${IS.total} rounds!` : `${fmt(ps[0].score)} points · ${reached}`);
    const rows = store.table(w.level);
    const tb = $('resTable');
    tb.innerHTML = '';
    const cap = document.createElement('caption');
    cap.textContent = w.level === 'easy' ? '🐣 TOP CLIMBERS' : '🔥 TOP CLIMBERS';
    tb.appendChild(cap);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (G.newRows.some((n) => n.at === r.at && n.who === r.who && n.score === r.score)) tr.className = 'me';
      tr.innerHTML = `<td class="rk">${i + 1}</td><td class="who"><img alt="" src="${portraits[r.who] || ''}"><span>${NAME(r.who)}</span></td><td class="pts">${fmt(r.score)}</td>`;
      tb.appendChild(tr);
    });
    const best = $('resBest');
    const isTop = G.newRows.some((n) => rows[0] && n.score === rows[0].score && n.who === rows[0].who && n.at === rows[0].at);
    setText(best, isTop ? '⭐ NEW HI-SCORE!' : G.newRows.length ? '⭐ ON THE BOARD!' : '');
    best.classList.toggle('new', G.newRows.length > 0);
    // the climber (both brothers in 2 players: they climbed together) does his signature move
    G.scene2 = { kind: 'win', who: ps.map((p) => p.who), t: 0 };
    showScreen('results');
    Kit.sound.music('over');
  }

  // ---------- keys and touch ----------
  const ONE = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
    ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyJ: 'jump',
    Space: 'rb', KeyX: 'rb', KeyF: 'rb', KeyK: 'rb', Enter: 'rb', NumpadEnter: 'rb', ShiftRight: 'rb',
    ArrowDown: 'stomp', KeyS: 'stomp',
  };
  const TWO = {
    KeyA: [0, 'l'], KeyD: [0, 'r'], KeyW: [0, 'jump'], Space: [0, 'rb'], KeyF: [0, 'rb'], ShiftLeft: [0, 'rb'], KeyS: [0, 'stomp'],
    ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'], ArrowUp: [1, 'jump'], Enter: [1, 'rb'], NumpadEnter: [1, 'rb'], ShiftRight: [1, 'rb'], KeyL: [1, 'rb'], Numpad0: [1, 'rb'], ArrowDown: [1, 'stomp'],
  };
  function role(c) {
    if (G.w && G.w.two) return TWO[c] || null;
    return ONE[c] ? [0, ONE[c]] : null;
  }
  function held(i, d) {
    for (const c in G.keys) { if (!G.keys[c]) continue; const r = role(c); if (r && r[0] === i && r[1] === d) return true; }
    return !!(G.touch[i][d] || G.taps[i][d]);
  }
  function readInput() {
    const out = G.w.players.map((p, i) => {
      let lr = (held(i, 'r') ? 1 : 0) - (held(i, 'l') ? 1 : 0);
      if (G.sab === 'mirror') lr = -lr; // the play check's own sabotage
      const b = G.buf[i];
      const inp = { lr, jump: b.jump > 0, rainbow: b.rb > 0, stomp: b.stomp > 0 };
      if (G.sab === 'stuck' && G.oopsOnce[i]) { inp.lr = 0; inp.jump = false; inp.rainbow = false; }
      return inp;
    });
    G.taps = [{}, {}];
    return out;
  }
  function press(i, k) { G.buf[i][k] = k === 'jump' ? 0.15 : 0.12; }
  function setupUI() {
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? RC.ZH : RC.TITLE;
      $('logoSub').textContent = zh ? RC.TITLE : '';
    };
    logo();
    Kit.lang.onChange(() => { logo(); if (islandMesh) islandMesh.userData.goal.userData.draw(); });
    $('tagline').textContent = RC.TAGLINE;
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('mPrev').addEventListener('click', () => pickIsland(-1));
    $('mNext').addEventListener('click', () => pickIsland(1));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if (c === 'KeyC' && G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy');
        else if (c === 'ArrowLeft') pickIsland(-1);
        else if (c === 'ArrowRight') pickIsland(1);
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') resume();
        else if (c === 'KeyQ') showTitle();
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if (c === 'KeyT' && !e.repeat) { call(); return; }
        const r = role(c);
        if (!r) return;
        if (r[1] === 'jump' || r[1] === 'rb' || r[1] === 'stomp') { if (!e.repeat) press(r[0], r[1]); return; }
        G.keys[c] = true;
        G.taps[r[0]][r[1]] = true; // a tap shorter than a frame still moves
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => resetInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: a pad for each player, and the brother's face (the high five in 2 players)
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k, i = +(b.dataset.p || 0);
      const on = (v) => {
        b.classList.toggle('down', v);
        if (k === 'call') { if (v) call(); return; }
        if (k === 'jump' || k === 'rb') { if (v) press(i, k); return; }
        G.touch[i][k] = v ? 1 : 0;
        if (v) G.taps[i][k] = true;
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if (!G.hold) advance(dt);
    draw();
  }
  function advance(dt) {
    G.time += dt;
    G.frame++;
    if (!G.w) return;
    if (!(G.paused || G.screen === 'pause')) {
      G.acc = Math.min(G.acc + dt, 0.25);
      while (G.acc >= DT - 1e-9) {
        G.acc -= DT;
        tick();
      }
      visuals(dt);
    }
  }
  function tick() {
    const w = G.w;
    let ins;
    if (G.demo) ins = w.players.map((p, i) => RC.bot.decide(w, i));
    else if (G.screen === 'play') ins = readInput();
    else ins = [];
    S.step(w, ins);
    for (let i = 0; i < 2; i++) {
      const b = G.buf[i];
      for (const k of ['jump', 'rb', 'stomp']) {
        const used = (k === 'jump' && w.events.some((e) => e.type === 'jump' && e.who === i)) || (k === 'rb' && w.events.some((e) => (e.type === 'throw' || e.type === 'fizzle') && e.who === i));
        b[k] = used ? 0 : Math.max(0, (b[k] || 0) - DT);
      }
    }
    handleEvents(w.events);
    if (G.demo) {
      if (w.phase === 'over' || w.phase === 'won' || w.t > 300 || w.n > 1) { clearWorldView(); G.w = newWorld(true); }
    } else if ((w.phase === 'over' || w.phase === 'won') && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > (w.phase === 'won' ? 1.2 : 2.2)) showResults();
    }
  }

  // ---------- what the rules said happened ----------
  function handleEvents(evs) {
    const w = G.w;
    const loud = !G.demo;
    const snd = (f, ...a) => { if (loud) f(...a); };
    const P = (i) => w.players[i] || w.players[0];
    for (const e of evs) {
      switch (e.type) {
        case 'go': snd(SFX.go); big('GO!'); break;
        case 'round':
          G.scene2 = null;
          if (e.island) snd(SFX.island);
          if (w.t > 0.1) big(e.island ? w.D.name : `ROUND ${w.D.ri + 1}`, stageLine());
          break;
        case 'jump': snd(SFX.jump); break;
        case 'land': snd(SFX.land); break;
        case 'throw': snd(SFX.rainbow, e.n); G.throwT[e.who] = 0.3; break;
        case 'fizzle': snd(SFX.fizzle); pop(e.x, e.y + 1.6, 'NO ROOM!', 'ouch'); break;
        case 'break': snd(SFX.breakIt); sparkles.burst(e.x, e.y, 16, A.BANDS, 2.5); pop(e.x, e.y + 0.4, 'CRACK!', 'big'); break;
        case 'bonk':
          if (e.how === 'gem') { snd(SFX.gemBonk); pop(e.x, e.y + 0.4, 'BOINK!', 'gem'); }
          else { snd(SFX.bonk, e.chain); pop(e.x, e.y + 0.4, e.chain > 1 ? `BONK ×${e.chain}!` : 'BONK!', 'big'); }
          confetti.burst(e.x, e.y, 0.6, 22, 3);
          sparkles.burst(e.x, e.y, 8);
          break;
        case 'fruit': snd(SFX.fruit, Math.min(6, Math.log2(e.value / 250))); pop(e.x, e.y + 0.6, `${e.e} +${fmt(e.value)}`, 'fruit'); break;
        case 'gem': snd(SFX.gem, e.c); pop(e.x, e.y + 0.6, 'GEM! +1,000', 'gem'); sparkles.burst(e.x, e.y + 0.3, 10, [A.GEM_COL[e.c], '#ffffff']); break;
        case 'rainbowBonus': snd(SFX.rainbowBonus); big('RAINBOW BONUS!', '+10,000 · EXTRA LIFE!'); confetti.burst(e.x, e.y + 1, 0.6, 80, 6); break;
        case 'oops': snd(SFX.oops); G.oopsOnce[e.who] = true; G.oopsT[e.who] = 1.2; pop(e.x, e.y + 1.5, 'OOPS!', 'ouch'); break;
        case 'splash': snd(SFX.splash); sparkles.burst(e.x, e.y, 18, ['#ffffff', '#bff3ff', w.D.island.sea], 1.4); pop(e.x, e.y + 1, 'SPLASH!', 'ouch'); break;
        case 'bubble': snd(SFX.bubble); pop(P(e.who).x, Math.max(w.camY + 1, P(e.who).y + 1), 'BUBBLE UP!', 'gem'); break;
        case 'pop': snd(SFX.pop); confetti.burst(e.x, e.y + 0.5, 0.5, 12, 2.5, ['#bff3ff', '#ffffff']); break;
        case 'soaked': snd(SFX.soaked); pop(e.x, e.y + 0.6, 'SOAKED!', 'gem'); break;
        case 'hurry': snd(SFX.hurry); toast('HURRY! THE WATER IS RISING!'); break;
        case 'clear':
          snd(SFX.clear);
          G.scene2 = { kind: 'clear', t: 0 };
          big(e.last ? 'ALL ISLANDS CLIMBED!' : e.islandEnd ? `${w.D.name} CLEAR!` : 'ROUND CLEAR!', `+${fmt(e.bonus)}`);
          if (loud && e.islandEnd) store.open(w.level, w.D.ii + 2);
          break;
        case 'won': snd(SFX.won); break;
        case 'over': snd(SFX.gameOver); big('GAME OVER'); break;
        case 'buddyIn': snd(SFX.buddy); { const p = w.players[0]; confetti.burst(p.x - p.face, p.y + 1, 0.6, 16, 2.5, ['#ffffff', '#bff3ff']); } break;
        case 'treat': snd(SFX.treat); pop(w.players[0].x, w.players[0].y + 1.5, `${e.e} +500`); break;
        case 'stairs': snd(SFX.stairs); toast(`${NAME(e.who)} SAYS: CLIMB MY RAINBOW STAIRS!`); break;
        case 'hi5': {
          snd(SFX.hi5);
          const a = w.players[0], b = w.players[1] || a;
          pop((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.7, 'HIGH FIVE! ✋ +50', 'big');
          confetti.burst((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.2, 0.6, 30, 3.5);
          break;
        }
      }
    }
  }
  const stageLine = () => (G.w ? `${G.w.D.name} · ROUND ${G.w.D.ri + 1}` : '');

  // ---------- pops, toasts, big words (page text, so 中文 works by itself) ----------
  function pop(x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(x, y, 0.5);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    if (G.demo) return;
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1600);
  }
  function setText(el, s) {
    if (!el || el._t === s) return;
    el._t = s;
    el.textContent = s;
  }

  // ---------- drawing the world ----------
  const turn = (cur, want, k) => cur + (((want - cur + PI * 3) % (PI * 2)) - PI) * k;
  function signature(who, n) {
    const sig = (Kit.roster.get(who) || {}).signature || ['wave'];
    return sig[(n || 0) % sig.length];
  }
  function islandView() {
    const w = G.w;
    if (G.islandFor === w.D) return;
    G.islandFor = w.D;
    if (islandMesh) { scene.remove(islandMesh); A.dispose(islandMesh); }
    islandMesh = A.island(w.D);
    scene.add(islandMesh);
    back.paint(w.D.island);
  }
  function visuals(dt) {
    const w = G.w, t = G.time;
    const k = 1 - Math.exp(-16 * dt);
    islandView();
    // the background slides at its own pace (far things move less)
    back.sky.position.y = w.camY + 20;
    back.sun.position.y = 30 + w.camY * 0.9;
    back.sea.position.y = -3.2 + w.camY * 0.85;
    back.far.position.y = w.camY * 0.85;
    for (const c of back.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; c.position.y = c.userData.y + w.camY * 0.7; }
    water.update(w.water, t, w.D.island.sea);
    const sc = G.scene2;
    if (sc) sc.t += dt;
    rainbows(t);
    critters(t);
    items(t);
    goal(dt);
    climbers(dt, k);
    buddy(dt, k);
    sparkles.update(dt);
    confetti.update(dt);
    if (sc && (sc.kind === 'win' || sc.kind === 'clear') && Math.floor(sc.t * 2) !== Math.floor((sc.t - dt) * 2)) confetti.rain(-7, 7, w.camY + S.VIEW_H, sc.kind === 'win' ? 30 : 14);
    hud();
  }
  function rainbows(t) {
    const w = G.w, seen = new Set();
    for (const r of w.rainbows) {
      seen.add(r.id);
      let m = rbMeshes.get(r.id);
      if (!m) { m = A.rainbow(r); scene.add(m); rbMeshes.set(r.id, m); }
      m.position.set(r.x0, r.y0, r.giant ? -0.05 : 0.05);
      A.growRainbow(m, S.grown(r));
      m.visible = r.t >= 0;
      const left = r.life - r.t;
      // about to fade: it blinks; falling: it wobbles and goes see-through
      m.material.opacity = r.st === 'fall' ? Math.max(0.2, 1 - r.fallT * 0.6) : left < 1.5 ? (Math.floor(t * 10) % 2 ? 0.35 : 1) : 1;
      m.rotation.z = r.st === 'fall' ? Math.sin(r.fallT * 14) * 0.05 * r.dir : 0;
    }
    for (const [id, m] of rbMeshes) if (!seen.has(id)) { scene.remove(m); m.material.dispose(); rbMeshes.delete(id); }
  }
  function critters(t) {
    const w = G.w, seen = new Set();
    for (const c of w.critters) {
      seen.add(c.id);
      let m = critMeshes.get(c.id);
      const kind = c.k === 'walk' ? w.D.island.walker : w.D.island.flyer;
      if (!m || m.userData.kind !== kind) {
        if (m) { scene.remove(m); (critPool[m.userData.kind] = critPool[m.userData.kind] || []).push(m); }
        m = (critPool[kind] && critPool[kind].pop()) || A.critter(kind);
        m.userData.bub = m.userData.bub || A.bubble();
        m.add(m.userData.bub);
        scene.add(m);
        critMeshes.set(c.id, m);
      }
      const fly = c.k === 'fly';
      m.position.set(c.x, c.y + (fly ? 0.4 : 0), 0.15);
      m.rotation.set(0, c.dir > 0 ? -0.6 : -PI + 0.6, 0);
      m.scale.setScalar(1);
      m.userData.bub.visible = c.st === 'soak';
      m.userData.bub.position.set(0, fly ? 0 : 0.4, 0);
      if (c.st === 'bonked') {
        // spins, puffs up and pops into confetti (the fruit is already there)
        m.rotation.y += c.t * 30;
        m.scale.setScalar(Math.max(0.05, 1 + c.t * 1.2 - c.t * c.t * 4));
        m.position.y += c.t * 1.5;
      } else if (c.st === 'soak') {
        m.rotation.z = Math.sin(t * 3) * 0.3;
        m.scale.setScalar(Math.max(0.05, 1 - c.t * 0.25));
      }
      A.animCritter(m, t + c.id, c.st === 'go' && w.phase === 'play' && !(c.wait > 0));
    }
    for (const [id, m] of critMeshes) if (!seen.has(id)) { scene.remove(m); (critPool[m.userData.kind] = critPool[m.userData.kind] || []).push(m); critMeshes.delete(id); }
  }
  function items(t) {
    const w = G.w, seen = new Set();
    for (const it of w.items) {
      seen.add(it.id);
      let m = itemMeshes.get(it.id);
      if (!m) { m = it.k === 'gem' ? A.gem(it.c) : A.emoji(it.e, 0.62); scene.add(m); itemMeshes.set(it.id, m); }
      const bob = it.still ? Math.sin(t * 4 + it.id) * 0.05 : 0;
      m.position.set(it.x, it.y + (it.k === 'gem' ? 0.35 : 0.32) + bob, 0.5);
      if (it.k === 'gem') m.rotation.y = t * 3;
      m.visible = it.life - it.t > 2 || Math.floor(t * 8) % 2 === 0;
    }
    for (const [id, m] of itemMeshes) if (!seen.has(id)) { scene.remove(m); if (m.isMesh) m.material.dispose(); itemMeshes.delete(id); }
  }
  function goal(dt) {
    if (!islandMesh) return;
    const g = islandMesh.userData.goal.userData;
    const open = G.w.phase === 'clear' || G.w.phase === 'won' || (G.scene2 && G.scene2.kind === 'win' && G.w.phase === 'won');
    g.hinge.rotation.x = turn(g.hinge.rotation.x, open ? -1.9 : 0, Math.min(1, dt * 6));
    g.glow.material.opacity = open ? 0.85 : 0.25 + Math.sin(G.time * 3) * 0.1;
    g.flag.rotation.y = Math.sin(G.time * 3) * 0.2;
  }
  function pose(P, p, i) {
    let mode = 'stand', ph = 0;
    const w = G.w;
    if (p.mode === 'ground') { if (Math.abs(p.vx) > 0.1 && w.phase === 'play') { mode = 'run'; ph = p.walkT * 11; } }
    else if (p.mode === 'air') mode = 'jump';
    else if (p.mode === 'bubble') mode = p.bub && p.bub.kind === 'ring' ? 'peace' : 'fall';
    return [mode, ph];
  }
  function climbers(dt, k) {
    const w = G.w, sc = G.scene2;
    const inPlay = new Set(w.players.map((p) => p.who));
    for (const id of ['teddy', 'tommy']) if (!inPlay.has(id) && !(w.buddy && w.buddy.who === id)) people[id].root.visible = false;
    ball.visible = false;
    peace.visible = false;
    bubbles.forEach((b) => (b.visible = false));
    rings.forEach((b) => (b.visible = false));
    stars.forEach((s) => (s.visible = false));
    if (sc && sc.kind === 'win') return winPose(sc, k);
    w.players.forEach((p, i) => {
      const P = people[p.who];
      G.throwT[i] = Math.max(0, G.throwT[i] - dt);
      const blink = p.inv > 0 && p.mode !== 'bubble' && Math.floor(G.time * 10) % 2 === 0;
      P.root.visible = !blink;
      P.root.scale.setScalar(SCALE);
      let want = p.face > 0 ? FACE_R : FACE_L;
      const cheer = w.phase === 'clear' && p.mode === 'ground';
      const hi5 = w.hi5 && w.two;
      if (cheer) want = PI;
      if (hi5) want = w.players[1 - i].x > p.x ? FACE_R : FACE_L;
      if (p.mode === 'bubble') want = PI;
      P.root.position.set(p.x, p.y, 0.15);
      P.root.rotation.y = turn(P.root.rotation.y, want, Math.min(1, k * 1.4));
      if (hi5) {
        Kit.people.pose(P, 0, 'give', k);
        P.armR.rotation.x = 2.4;
      } else if (cheer) {
        const mode = signature(p.who, w.n);
        Kit.people.pose(P, G.time * 8, mode, k);
        P.rig.position.y = 0;
        props(P, mode);
      } else {
        const [mode, ph] = pose(P, p, i);
        Kit.people.pose(P, ph, mode, k);
        P.rig.position.y = 0;
        // throwing: the arm swings out the way he faces
        if (G.throwT[i] > 0) { P.armR.rotation.x = 1.4 + G.throwT[i] * 3; P.armR.rotation.z = 0; }
        if (mode === 'peace') props(P, mode);
      }
      if (p.mode === 'bubble') {
        if (p.bub.kind === 'ring') {
          const rg = rings[i];
          rg.visible = true;
          rg.position.set(p.x, p.y + 0.35, 0.2);
        } else {
          const b = bubbles[i];
          b.visible = true;
          b.position.set(p.x, p.y + 0.55, 0.3);
          b.scale.setScalar(1 + Math.sin(G.time * 5) * 0.04);
        }
      }
      G.oopsT[i] = Math.max(0, G.oopsT[i] - dt);
      if (G.oopsT[i] > 0 && p.mode !== 'bubble') {
        P.rig.rotation.z = Math.sin(G.time * 9) * 0.15;
        const s = stars[i];
        s.visible = true;
        P.head.getWorldPosition(v3);
        s.position.set(v3.x, v3.y + 0.3, v3.z);
        s.userData.spin(G.time);
      } else P.rig.rotation.z = 0;
    });
  }
  function props(P, mode) {
    if (mode === 'jumpshot') {
      P.root.position.y += Math.abs(Math.sin(G.time * 4)) * 0.35;
      ball.visible = true;
      Kit.people.handWorld(P, 1, v3);
      ball.position.set(v3.x, v3.y + 0.22 + Math.max(0, Math.sin(G.time * 4)) * 0.7, v3.z + 0.2);
    } else if (mode === 'peace') {
      peace.visible = true;
      P.head.getWorldPosition(v3);
      peace.position.set(v3.x + 0.4, v3.y + 0.28 + Math.sin(G.time * 5) * 0.05, v3.z + 0.3);
    }
  }
  function winPose(sc, k) {
    // the climbers in front of the island doing their signature moves
    const w = G.w, ids = sc.who;
    const y = w.phase === 'won' ? w.goalY : w.camY + 3;
    ids.forEach((id, i) => {
      const P = people[id];
      P.root.visible = true;
      P.root.scale.setScalar(SCALE * 1.25);
      P.root.position.set(ids.length === 2 ? (i ? 1.4 : -1.4) : 0, y, 1.2);
      P.root.rotation.y = PI;
      const mode = signature(id, id === 'teddy' ? Math.floor(sc.t / 3) : 0);
      Kit.people.pose(P, G.time * 8, mode, k);
      P.rig.position.y = 0;
      P.rig.rotation.z = 0;
      props(P, mode);
    });
    for (const id of ['teddy', 'tommy']) if (!ids.includes(id)) people[id].root.visible = false;
  }
  function buddy(dt, k) {
    const w = G.w, bd = w.buddy;
    treat.visible = false;
    budCloud.visible = false;
    if (!bd || (G.scene2 && G.scene2.kind === 'win')) return;
    const p = w.players[0];
    const B = people[bd.who];
    const r = Kit.roster.get(bd.who) || {};
    const grow = Math.min(1, bd.t * 5) * (bd.t > 3.35 ? Math.max(0.01, (3.6 - bd.t) / 0.25) : 1);
    B.root.visible = true;
    B.root.scale.setScalar(Math.max(0.01, SCALE * (r.buddyScale || 0.8) * grow));
    const bx = bd.x, by = bd.y + 0.35 + Math.sin(G.time * 3) * 0.06;
    let mode, want = PI;
    if (bd.t < 1.4) mode = signature(bd.who, w.n);
    else if (bd.t < 1.9) mode = 'give';
    else if (bd.t < 2.8) { mode = 'give'; want = bd.face > 0 ? FACE_R : FACE_L; }
    else mode = 'wave';
    B.root.position.set(bx, by, 0.55);
    B.root.rotation.y = turn(B.root.rotation.y, want, 0.5);
    Kit.people.pose(B, G.time * 8, mode, k);
    B.rig.position.y = 0;
    B.rig.rotation.z = 0;
    if (bd.t < 1.4) props(B, mode);
    budCloud.visible = true;
    budCloud.position.set(bx, by - 0.05, 0.4);
    budCloud.scale.setScalar(Math.max(0.01, 1.1 * grow));
    if (bd.t >= 1.4 && bd.t < 1.8) {
      const u = (bd.t - 1.4) / 0.4;
      treat.visible = true;
      A.setEmoji(treat, bd.treat);
      treat.position.set(bx + (p.x - bx) * u, by + 1 + Math.sin(u * PI) * 0.7 + (p.y + 0.9 - by - 1) * u, 0.8);
    }
  }

  // ---------- HUD ----------
  function hud() {
    const w = G.w;
    if (!w || G.demo) return;
    const top = store.table(w.level)[0].score;
    for (let i = 0; i < 2; i++) {
      const box = $('hudP' + i);
      const pl = w.players[i];
      box.style.display = pl ? '' : 'none';
      if (!pl) continue;
      setText(box.querySelector('.lbl'), NAME(pl.who));
      setText(box.querySelector('.sc'), fmt(pl.score));
    }
    setText($('hudHi'), fmt(Math.max(top, ...w.players.map((p) => p.score))));
    setText($('hudStage'), `${w.D.ii + 1}-${w.D.ri + 1} · ${w.D.name}`);
    setText($('hudLives'), w.lives > 6 ? `❤️ ×${w.lives}` : '❤️'.repeat(Math.max(0, w.lives)));
    const low = Math.min(...w.players.map((p) => p.y));
    const d = Math.max(0, low - w.water);
    setText($('hudWater'), `🌊 ${d < 10 ? d.toFixed(1) : Math.round(d)} m`);
    $('hudWater').classList.toggle('low', d < 3 && w.phase === 'play');
    $('gems').querySelectorAll('i').forEach((el, c) => el.classList.toggle('on', !!w.gems[c]));
    const on = !!w.buddy;
    $('budBtn').classList.toggle('on', on);
    document.querySelector('.tb.call').classList.toggle('on', on);
  }

  function draw() {
    if (G.w) islandView();
    placeCamera();
    renderer.render(scene, cam);
  }

  // ---------- test hooks ----------
  function drawn(i) {
    const p = G.w.players[i];
    const P = people[p.who];
    return toScreen(P.root.position.x, P.root.position.y + 0.5, 0.15);
  }
  function state() {
    const w = G.w;
    if (!w) return { screen: G.screen };
    placeCamera();
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w.phase, n: w.n, island: w.D.ii, round: w.D.ri, level: w.level, two: w.two, camY: +w.camY.toFixed(3), water: +w.water.toFixed(3), lives: w.lives,
      players: w.players.map((p, i) => {
        const [sx, sy] = drawn(i);
        return { who: p.who, x: +p.x.toFixed(3), y: +p.y.toFixed(3), mode: p.mode, sup: p.sup ? p.sup.k : '', face: p.face, inv: +p.inv.toFixed(2), score: p.score, sx: Math.round(sx), sy: Math.round(sy) };
      }),
      rainbows: w.rainbows.length, critters: w.critters.length, items: w.items.length, gems: w.gems.filter(Boolean).length, buddy: w.buddy && { who: w.buddy.who, t: +w.buddy.t.toFixed(2) },
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.level) G.level = o.level;
      if (o.island != null) G.ii = o.island;
      play();
      if (o.round != null && G.w.n !== o.round) { S.loadRound(G.w, o.round); G.w.events = []; }
      if (o.go) { G.w.phase = 'play'; G.w.phaseT = 0; }
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call,
    pause, resume, showTitle, showResults,
    check: (only) => RC.check.run(only),
    checkFail: () => RC.check.fail(),
    // put climber i standing at (x, y): the rules stay the real ones
    put(i, x, y) {
      const w = G.w, p = w.players[i || 0];
      Object.assign(p, { x, y, vx: 0, vy: 0, mode: 'ground', sup: S.support(w, x, y, 0.05, 0.05) || { k: 'p', i: -1, top: y }, inv: 0, bub: null, cd: 0 });
      p.best = Math.max(p.best, y);
      return state();
    },
    // no critters (tests that only look at moving) and no rising water
    quiet() { const w = G.w; w.critters = []; w.L = Object.assign({}, w.L, { waterDelay: 1e9 }); return state(); },
    sabotage(s) { G.sab = s || null; return G.sab; },
    toScreen,
    drawn,
    // where rainbow id's drawn tip is on the screen (its mesh, so a mirrored drawing would show)
    rbTip(id) {
      const m = rbMeshes.get(id), r = G.w.rainbows.find((q) => q.id === id);
      if (!m || !r) return null;
      m.updateMatrixWorld(true);
      const p = new T.Vector3(r.span, 0, 0).applyMatrix4(m.matrixWorld);
      return toScreen(p.x, p.y, p.z);
    },
    world: () => G.w,
    G,
    calm() { document.body.classList.add('calm'); },
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
