/* TT Rainbow Climb: the 3D things, chunky toy style. The sky, the sea and far islands; the tall island's sides and its
   ledges (merged into a few meshes a round); the goal at the top (a treasure chest under a rainbow flag); the rainbow
   arches (7 coloured bands, grown from the start to the tip); eight silly critters, two for each island; fruit, gems,
   the water, the rescue bubble and rubber ring, sparkles, confetti and dizzy stars. js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx;
  const A = (RC.art = {});
  const S = RC.sim, IS = RC.islands;
  const PI = Math.PI;
  const BANDS = ['#ff4d4d', '#ff9a1f', '#ffe14a', '#5ee06a', '#3bb4ff', '#5b6cff', '#b45bff'];
  A.BANDS = BANDS;
  const GEM_COL = BANDS;
  A.GEM_COL = GEM_COL;

  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    parts.forEach((g) => g.dispose());
    return new T.Mesh(geo, material);
  }
  const at = (geo, x, y, z, rx, ry, rz, sx, sy, sz) => { const m = new T.Mesh(geo); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); if (sx) m.scale.set(sx, sy || sx, sz || sx); return m; };

  // ---------- sky, sea, far islands, clouds (recoloured for each island) ----------
  A.backdrop = function (scene) {
    const [c, g] = G.makeCanvas(4, 256);
    const tex = G.toTexture(c);
    const sky = new T.Mesh(new T.PlaneGeometry(260, 120), new T.MeshBasicMaterial({ map: tex, depthWrite: false }));
    sky.position.set(0, 20, -60);
    scene.add(sky);
    const sun = new T.Sprite(new T.SpriteMaterial({ map: G.radialTexture(128, [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,240,170,0.95)'], [1, 'rgba(255,230,150,0)']]), depthWrite: false }));
    sun.scale.set(16, 16, 1);
    sun.position.set(-22, 30, -55);
    scene.add(sun);
    const sea = new T.Mesh(new T.PlaneGeometry(400, 60), mat('#2bb8e8', { roughness: 0.4 }));
    sea.rotation.x = -PI / 2;
    sea.position.set(0, -3.2, -30);
    scene.add(sea);
    const far = new T.Group();
    const hillGeo = new T.SphereGeometry(1, 16, 10, 0, PI * 2, 0, PI / 2);
    [[-30, 6, 7, -48], [-14, 3.5, 4, -44], [20, 5, 6, -50], [34, 3, 4, -42], [6, 2.5, 3, -40]].forEach(([x, h, r, z]) => {
      const m = new T.Mesh(hillGeo, mat('#7fd28a', { roughness: 0.9 }));
      m.scale.set(r * 1.6, h, r);
      m.position.set(x, -3.2, z);
      far.add(m);
    });
    scene.add(far);
    const clouds = [];
    const puff = new T.SphereGeometry(1, 14, 10);
    for (let i = 0; i < 9; i++) {
      const cl = new T.Group();
      for (let j = 0; j < 4; j++) { const m = new T.Mesh(puff, mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 })); m.position.set(j * 1.2 - 1.8, Math.sin(j * 2) * 0.3, 0); m.scale.setScalar(0.9 + (j % 2) * 0.5); cl.add(m); }
      cl.position.set(-50 + i * 12 + Math.random() * 5, 4 + (i % 4) * 7, -36 - (i % 3) * 4);
      cl.userData.v = 0.4 + Math.random() * 0.6;
      cl.userData.y = cl.position.y;
      scene.add(cl);
      clouds.push(cl);
    }
    function paint(I) {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, I.sky[0]);
      gr.addColorStop(1, I.sky[1]);
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
      tex.needsUpdate = true;
      sea.material = mat(I.sea, { roughness: 0.4 });
      scene.background = new T.Color(I.sky[1]);
    }
    return { sky, sun, sea, far, clouds, paint };
  };

  // ---------- the island for a round: sides, ledges, flowers/toys/candy/stars, the goal ----------
  A.island = function (D) {
    const I = D.island, root = new T.Group();
    const XW = IS.XW, top = D.goalY + 14;
    // the island's sides: tall chunky walls just outside the play area, with a stripe every row
    const sideGeo = new T.BoxGeometry(1.4, 1, 3);
    const sides = [], rims = [];
    for (const sx of [-1, 1]) {
      sides.push(at(sideGeo, sx * (XW + 0.7), (top - 30) / 2, -0.2, 0, 0, 0, 1, top + 30, 1));
      for (let y = 0; y < top; y += IS.ROW) rims.push(at(new T.BoxGeometry(1.5, 0.22, 3.1), sx * (XW + 0.7), y - 0.1, -0.2));
    }
    root.add(merge(sides, mat(I.side, { roughness: 0.85 })));
    root.add(merge(rims, mat(I.rim, { roughness: 0.6 })));
    // ledges: a thick block (the island's earth) with a soft top (grass, bricks, icing, cloud)
    const body = [], tops = [], lips = [];
    for (const pl of D.plats) {
      const wd = pl.x1 - pl.x0, cx = (pl.x0 + pl.x1) / 2;
      if (pl.floor) {
        body.push(at(new T.BoxGeometry(wd + 2.8, 6, 3.2), cx, -3.2, -1.45));
        tops.push(at(new T.BoxGeometry(wd, 0.3, 3.0), cx, -0.15, -1.45));
        continue;
      }
      // ledges sit just behind the climbers (z < 0.2), so a climber jumping up through one is never hidden by it
      const th = pl.goal ? 0.9 : pl.step ? 0.4 : 0.55;
      body.push(at(new T.BoxGeometry(wd, th, 2.0), cx, pl.y - th / 2 - 0.12, -1.05));
      tops.push(at(new T.BoxGeometry(wd + 0.12, 0.24, 2.1), cx, pl.y - 0.12, -1.05));
      // little drips of icing / grass tufts along the front edge
      for (let x = pl.x0 + 0.3; x < pl.x1 - 0.2; x += 0.7) lips.push(at(new T.SphereGeometry(0.16, 8, 6), x, pl.y - 0.26, -0.02, 0, 0, 0, 1, 0.8, 0.6));
    }
    root.add(merge(body, mat(I.side, { roughness: 0.8 })));
    root.add(merge(tops, mat(I.top, { roughness: 0.7 })));
    root.add(merge(lips, mat(I.top, { roughness: 0.7 })));
    // decorations: an emoji or two standing at the back of some ledges
    const R = IS.rng(77 + D.n);
    for (const pl of D.plats) {
      if (pl.goal || pl.floor || R() < 0.45) continue;
      const s = A.emoji(I.deco[Math.floor(R() * I.deco.length)], 0.62);
      s.material.depthTest = true;
      s.position.set(pl.x0 + 0.4 + R() * (pl.x1 - pl.x0 - 0.8), pl.y + 0.28, -1.6);
      root.add(s);
    }
    for (let x = -XW + 0.8; x < XW; x += 2.3) {
      const s = A.emoji(I.deco[Math.floor(R() * I.deco.length)], 0.7);
      s.material.depthTest = true;
      s.position.set(x, 0.32, -1.1);
      root.add(s);
    }
    const goal = A.goal(D);
    root.add(goal);
    root.userData.goal = goal;
    return root;
  };

  // the goal: a treasure chest under a big rainbow flag; GOAL! on the flag (canvas text, redrawn in 中文)
  A.goal = function (D) {
    const g = new T.Group();
    g.position.set(0, D.goalY, -1.1);
    const chest = new T.Group();
    chest.add(at(new T.BoxGeometry(1.5, 0.8, 1), 0, 0.4, 0));
    chest.children[0].material = mat('#b86a2e', { roughness: 0.6 });
    const lid = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.5, 16, 1, false, 0, PI), mat('#c97a34', { roughness: 0.6 }));
    lid.rotation.z = PI / 2;
    lid.position.set(0, 0.8, 0);
    const hinge = new T.Group();
    hinge.position.set(0, 0.8, -0.5);
    lid.position.set(0, 0, 0.5);
    hinge.add(lid);
    chest.add(hinge);
    for (const x of [-0.55, 0, 0.55]) { const b = new T.Mesh(new T.BoxGeometry(0.12, 0.84, 1.04), mat('#ffd400', { metalness: 0.4, roughness: 0.35 })); b.position.set(x, 0.4, 0); chest.add(b); }
    const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#ffe680', transparent: true, depthWrite: false, opacity: 0 }));
    glow.scale.set(3.4, 3.4, 1);
    glow.position.set(0, 1.1, 0.4);
    chest.add(glow);
    chest.position.set(2.6, 0, 0);
    g.add(chest);
    const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 4.2, 8), mat('#ffffff'));
    pole.position.set(-2.4, 2.1, 0);
    g.add(pole);
    const ball = new T.Mesh(new T.SphereGeometry(0.2, 12, 8), mat('#ffd400', { metalness: 0.3, roughness: 0.3 }));
    ball.position.set(-2.4, 4.3, 0);
    g.add(ball);
    const [cv, cx] = G.makeCanvas(256, 128);
    const ftex = G.toTexture(cv);
    const flag = new T.Mesh(new T.PlaneGeometry(2.2, 1.1, 10, 1), new T.MeshBasicMaterial({ map: ftex, side: T.DoubleSide }));
    flag.position.set(-2.4 + 1.12, 3.6, 0);
    g.add(flag);
    const draw = () => {
      BANDS.forEach((c, i) => { cx.fillStyle = c; cx.fillRect(0, (i * 128) / 7, 256, 128 / 7 + 1); });
      cx.font = `56px ${G.FONT}`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.lineWidth = 10;
      cx.strokeStyle = '#14121f';
      const s = Kit.lang.t('GOAL!');
      cx.strokeText(s, 128, 68);
      cx.fillStyle = '#ffffff';
      cx.fillText(s, 128, 68);
      ftex.needsUpdate = true;
    };
    draw();
    g.userData = { chest, hinge, glow, flag, draw };
    return g;
  };

  // ---------- a rainbow arch: 7 bands across, built along the curve so it can grow from its start ----------
  const SEG = 28;
  const geoCache = new Map();
  A.rainbowGeo = function (span, h, thick) {
    const key = `${span.toFixed(2)}|${h.toFixed(2)}|${thick}`;
    if (geoCache.has(key)) return geoCache.get(key);
    const D = 0.42, pos = [], col = [], nor = [];
    const c = BANDS.map((b) => new T.Color(b));
    const pt = (u) => [span * u, h * Math.sin(PI * u)];
    const nrm = (u) => { const dx = span, dy = h * PI * Math.cos(PI * u); const l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
    const quad = (a, b, cc, d, color, n) => {
      for (const v of [a, b, cc, a, cc, d]) { pos.push(v[0], v[1], v[2]); col.push(color.r, color.g, color.b); nor.push(n[0], n[1], n[2]); }
    };
    const stripe = thick / 7;
    for (let s = 0; s < SEG; s++) {
      const u0 = s / SEG, u1 = (s + 1) / SEG;
      const p0 = pt(u0), p1 = pt(u1), n0 = nrm(u0), n1 = nrm(u1);
      const off = (p, n, t) => [p[0] - n[0] * t, p[1] - n[1] * t];
      for (let b = 0; b < 7; b++) {
        const a0 = off(p0, n0, b * stripe), a1 = off(p1, n1, b * stripe), b0 = off(p0, n0, (b + 1) * stripe), b1 = off(p1, n1, (b + 1) * stripe);
        quad([a0[0], a0[1], D], [b0[0], b0[1], D], [b1[0], b1[1], D], [a1[0], a1[1], D], c[b], [0, 0, 1]);
        quad([a1[0], a1[1], -D], [b1[0], b1[1], -D], [b0[0], b0[1], -D], [a0[0], a0[1], -D], c[b], [0, 0, -1]);
      }
      quad([p0[0], p0[1], -D], [p0[0], p0[1], D], [p1[0], p1[1], D], [p1[0], p1[1], -D], c[0], [n0[0], n0[1], 0]);
      const q0 = off(p0, n0, thick), q1 = off(p1, n1, thick);
      quad([q0[0], q0[1], D], [q0[0], q0[1], -D], [q1[0], q1[1], -D], [q1[0], q1[1], D], c[6], [-n0[0], -n0[1], 0]);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.userData.perSeg = pos.length / 3 / SEG;
    geoCache.set(key, geo);
    return geo;
  };
  const rbMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: '#ffffff', emissiveIntensity: 0.12, side: T.DoubleSide, transparent: true });
  A.rainbow = function (r) {
    const m = new T.Mesh(A.rainbowGeo(r.span, r.h, r.giant ? S.THICK * 1.35 : S.THICK), rbMat.clone());
    m.scale.x = r.dir;
    m.renderOrder = 2;
    return m;
  };
  A.growRainbow = function (m, g) {
    const geo = m.geometry;
    geo.setDrawRange(0, Math.ceil(g * SEG) * geo.userData.perSeg);
  };

  // ---------- critters: two for each island, all goofy, with big eyes; they face +x (scale.x flips them) ----------
  const eyeGeo = new T.SphereGeometry(0.12, 12, 10), pupilGeo = new T.SphereGeometry(0.06, 10, 8);
  function eyes(g, x, y, z, s) {
    for (const dz of [-0.13, 0.13]) {
      const e = new T.Mesh(eyeGeo, mat('#ffffff', { roughness: 0.3 }));
      e.position.set(x, y, z + dz);
      e.scale.setScalar(s || 1);
      g.add(e);
      const p = new T.Mesh(pupilGeo, mat('#14121f', { roughness: 0.3 }));
      p.position.set(x + 0.08 * (s || 1), y, z + dz + 0.06 * (s || 1));
      g.add(p);
    }
  }
  function smile(g, x, y, z, color) {
    const m = new T.Mesh(new T.TorusGeometry(0.07, 0.022, 6, 12, PI), mat(color || '#14121f'));
    m.position.set(x, y, z);
    m.rotation.set(0, PI / 2, PI);
    g.add(m);
  }
  const sph = (r, color, o) => new T.Mesh(new T.SphereGeometry(r, 16, 12), mat(color, o));
  const box = (x, y, z, color, o) => new T.Mesh(new T.BoxGeometry(x, y, z), mat(color, o));
  A.critter = function (kind) {
    const g = new T.Group(), body = new T.Group();
    g.add(body);
    const parts = { wings: [], spin: [], legs: [] };
    if (kind === 'ladybug') {
      const shell = new T.Mesh(new T.SphereGeometry(0.42, 18, 12, 0, PI * 2, 0, PI / 2), mat('#ff3b3b', { roughness: 0.35 }));
      shell.scale.set(1.1, 0.95, 1);
      shell.position.y = 0.12;
      body.add(shell);
      for (const [x, z] of [[0.1, 0.25], [-0.2, 0.18], [0.15, -0.25], [-0.15, -0.2], [0, 0]]) { const s = sph(0.08, '#14121f'); s.position.set(x, 0.42 - Math.abs(x) * 0.3, z * 1.2); s.scale.y = 0.4; body.add(s); }
      const head = sph(0.22, '#14121f');
      head.position.set(0.42, 0.22, 0);
      body.add(head);
      eyes(body, 0.55, 0.3, 0.06, 0.9);
      smile(body, 0.62, 0.17, 0, '#ffffff');
      for (const x of [-0.2, 0.05, 0.3]) for (const z of [-0.3, 0.3]) { const l = box(0.05, 0.16, 0.05, '#14121f'); l.position.set(x, 0.06, z); body.add(l); parts.legs.push(l); }
    } else if (kind === 'bee') {
      const b = sph(0.36, '#ffd23f', { roughness: 0.4 });
      b.scale.set(1.2, 1, 1);
      body.add(b);
      for (const x of [-0.12, 0.12]) { const r = new T.Mesh(new T.TorusGeometry(0.33, 0.05, 6, 20), mat('#2a2233')); r.rotation.y = PI / 2; r.position.x = x - 0.05; r.scale.set(1, 1, 1); body.add(r); }
      eyes(body, 0.36, 0.08, 0.05, 1.1);
      smile(body, 0.42, -0.08, 0);
      for (const z of [-1, 1]) { const wg = new T.Mesh(new T.CircleGeometry(0.26, 14), new T.MeshStandardMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.75, side: T.DoubleSide })); wg.position.set(-0.05, 0.36, z * 0.16); wg.rotation.x = -PI / 2; wg.userData.z = z; body.add(wg); parts.wings.push(wg); }
      const ant = box(0.03, 0.22, 0.03, '#2a2233');
      ant.position.set(0.3, 0.4, 0);
      ant.rotation.z = -0.5;
      body.add(ant);
    } else if (kind === 'mouse') {
      const b = sph(0.36, '#a9b3c9', { roughness: 0.5 });
      b.scale.set(1.25, 0.9, 0.95);
      b.position.y = 0.33;
      body.add(b);
      for (const z of [-0.2, 0.2]) { const e = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.04, 16), mat('#a9b3c9')); e.rotation.x = PI / 2; e.rotation.z = 0.3; e.position.set(0.22, 0.68, z); body.add(e); const ei = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.05, 16), mat('#ffb3c7')); ei.rotation.copy(e.rotation); ei.position.set(0.23, 0.68, z + Math.sign(z) * 0.01); body.add(ei); }
      eyes(body, 0.43, 0.42, 0.05, 0.9);
      const nose = sph(0.06, '#ff6f9a');
      nose.position.set(0.62, 0.32, 0);
      body.add(nose);
      const key = new T.Group();
      key.add(box(0.04, 0.2, 0.04, '#ffd400', { metalness: 0.4 }));
      const loop = new T.Mesh(new T.TorusGeometry(0.1, 0.03, 6, 14), mat('#ffd400', { metalness: 0.4 }));
      loop.position.y = 0.16;
      key.add(loop);
      key.position.set(-0.12, 0.72, 0);
      body.add(key);
      parts.spin.push(key);
      const tail = new T.Mesh(new T.TorusGeometry(0.18, 0.025, 6, 12, PI * 1.3), mat('#ff9ab8'));
      tail.position.set(-0.5, 0.3, 0);
      body.add(tail);
      for (const x of [-0.18, 0.2]) { const wh = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.7, 12), mat('#3d6ad6')); wh.rotation.x = PI / 2; wh.position.set(x, 0.09, 0); body.add(wh); parts.legs.push(wh); }
    } else if (kind === 'plane') {
      const fus = new T.Mesh(new T.CylinderGeometry(0.2, 0.14, 0.9, 14), mat('#ff5a5f', { roughness: 0.4 }));
      fus.rotation.z = PI / 2;
      body.add(fus);
      const wing = box(0.32, 0.06, 1.3, '#ffd23f');
      wing.position.set(0.05, 0, 0);
      body.add(wing);
      const tailw = box(0.18, 0.28, 0.06, '#3d6ad6');
      tailw.position.set(-0.42, 0.16, 0);
      body.add(tailw);
      const prop = new T.Group();
      prop.add(box(0.04, 0.6, 0.08, '#ffffff'));
      prop.position.set(0.48, 0, 0);
      body.add(prop);
      parts.spin.push(prop);
      eyes(body, 0.32, 0.16, 0.07, 0.85);
      smile(body, 0.4, -0.04, 0);
    } else if (kind === 'gummy') {
      const gm = { roughness: 0.15, transparent: true, opacity: 0.85, emissive: '#ff2d55', emissiveIntensity: 0.25 };
      const b = sph(0.3, '#ff4d6d', gm);
      b.scale.set(0.95, 1.1, 0.9);
      b.position.y = 0.32;
      body.add(b);
      const head = sph(0.24, '#ff4d6d', gm);
      head.position.set(0.05, 0.75, 0);
      body.add(head);
      for (const z of [-0.16, 0.16]) { const e = sph(0.09, '#ff4d6d', gm); e.position.set(0.02, 0.96, z); body.add(e); }
      for (const z of [-0.26, 0.26]) { const a = sph(0.1, '#ff4d6d', gm); a.position.set(0.12, 0.42, z); body.add(a); parts.legs.push(a); }
      eyes(body, 0.24, 0.8, 0.06, 0.8);
      smile(body, 0.3, 0.66, 0);
    } else if (kind === 'bonbon') {
      const b = sph(0.3, '#ff8fc8', { roughness: 0.3 });
      body.add(b);
      for (const s of [-1, 1]) { const w = new T.Mesh(new T.ConeGeometry(0.2, 0.34, 10), mat('#7fe3ff', { roughness: 0.4 })); w.rotation.z = (s * PI) / 2; w.position.set(-s * 0.42, 0, 0); body.add(w); }
      const st = new T.Mesh(new T.TorusGeometry(0.3, 0.04, 6, 20), mat('#ffffff'));
      st.rotation.x = PI / 2;
      body.add(st);
      eyes(body, 0.25, 0.08, 0.05, 0.9);
      smile(body, 0.29, -0.07, 0);
      for (const z of [-1, 1]) { const wg = new T.Mesh(new T.CircleGeometry(0.2, 12), new T.MeshStandardMaterial({ color: '#fff6c8', transparent: true, opacity: 0.8, side: T.DoubleSide })); wg.position.set(0, 0.3, z * 0.12); wg.rotation.x = -PI / 2; wg.userData.z = z; body.add(wg); parts.wings.push(wg); }
    } else if (kind === 'sheep') {
      for (const [x, y, z, r] of [[0, 0.4, 0, 0.3], [-0.22, 0.38, 0.12, 0.24], [0.2, 0.42, -0.12, 0.24], [-0.15, 0.55, -0.12, 0.22], [0.15, 0.56, 0.12, 0.22], [-0.3, 0.33, -0.1, 0.2]]) { const p = sph(r, '#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 }); p.position.set(x, y, z); body.add(p); }
      const face = sph(0.2, '#3a3346');
      face.scale.set(1, 1.1, 0.9);
      face.position.set(0.38, 0.5, 0);
      body.add(face);
      eyes(body, 0.5, 0.55, 0.05, 0.75);
      smile(body, 0.56, 0.42, 0, '#ffb3c7');
      for (const x of [-0.18, 0.18]) for (const z of [-0.14, 0.14]) { const l = box(0.08, 0.22, 0.08, '#3a3346'); l.position.set(x, 0.11, z); body.add(l); parts.legs.push(l); }
    } else {
      // puff: a cheeky little cloud with rosy cheeks
      for (const [x, y, r] of [[0, 0, 0.32], [-0.28, -0.05, 0.22], [0.28, -0.04, 0.22], [0.1, 0.2, 0.2], [-0.12, 0.18, 0.18]]) { const p = sph(r, '#f4f8ff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.2 }); p.position.set(x, y, 0); body.add(p); }
      eyes(body, 0.22, 0.06, 0.18, 0.9);
      smile(body, 0.3, -0.06, 0.18);
      for (const z of [0.1, 0.38]) { const c = sph(0.05, '#ff9ab8'); c.position.set(0.28, -0.04, z - 0.1); body.add(c); }
    }
    body.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    g.userData = { kind, body, parts, fly: kind === 'bee' || kind === 'plane' || kind === 'bonbon' || kind === 'puff' };
    return g;
  };
  A.animCritter = function (g, t, moving) {
    const { parts, body, fly } = g.userData;
    for (const wg of parts.wings) wg.rotation.x = -PI / 2 + Math.sin(t * 30) * 0.6 * wg.userData.z;
    for (const s of parts.spin) s.rotation.x += 0.3;
    if (!fly) {
      body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.06 : 0;
      parts.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(t * 12 + i * 1.7) * 0.4 : 0));
    } else body.rotation.z = Math.sin(t * 3) * 0.12;
  };

  // ---------- the water: a see-through sea in front, with a wavy top and a foam line ----------
  A.water = function (scene) {
    const geo = new T.PlaneGeometry(40, 1, 64, 1);
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: '#2bb8e8', transparent: true, opacity: 0.58, roughness: 0.2, emissive: '#1a7fb8', emissiveIntensity: 0.25, depthWrite: false }));
    m.position.z = 1.5;
    m.renderOrder = 6;
    scene.add(m);
    const foam = new T.Mesh(new T.PlaneGeometry(40, 0.16, 64, 1), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
    foam.position.z = 1.52;
    foam.renderOrder = 7;
    scene.add(foam);
    const pos = geo.attributes.position, fpos = foam.geometry.attributes.position;
    const n = pos.count / 2;
    return {
      mesh: m,
      update(level, t, color) {
        if (color && m.userData.c !== color) { m.material.color.set(color); m.userData.c = color; }
        // top row of the plane is the surface; the bottom row hangs far below the screen
        for (let i = 0; i < n; i++) {
          const x = pos.getX(i);
          const y = level + Math.sin(x * 0.9 + t * 2.2) * 0.12 + Math.sin(x * 2.1 - t * 3.1) * 0.05;
          pos.setY(i, y);
          pos.setY(i + n, level - 40);
          fpos.setY(i, y + 0.06);
          fpos.setY(i + n, y - 0.08);
        }
        pos.needsUpdate = true;
        fpos.needsUpdate = true;
        geo.computeBoundingSphere();
        foam.geometry.computeBoundingSphere();
      },
    };
  };

  // ---------- the rescue bubble and the rubber ring ----------
  A.bubble = function () {
    const g = new T.Group();
    const s = new T.Mesh(new T.SphereGeometry(0.72, 20, 14), new T.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, emissive: '#7fdcff', emissiveIntensity: 0.25, depthWrite: false }));
    g.add(s);
    const shine = new T.Sprite(new T.SpriteMaterial({ map: G.radialTexture(64, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]), depthWrite: false }));
    shine.scale.set(0.36, 0.36, 1);
    shine.position.set(-0.3, 0.3, 0.65);
    g.add(shine);
    g.renderOrder = 4;
    return g;
  };
  A.ring = function () {
    const g = new T.Group();
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(new T.TorusGeometry(0.42, 0.14, 8, 6, PI / 4 + 0.01), mat(i % 2 ? '#ffffff' : '#ff4d6d', { roughness: 0.5 }));
      m.rotation.z = (i * PI) / 4;
      g.add(m);
    }
    g.rotation.x = PI / 2 - 0.25;
    return g;
  };
  // a gem: a chunky faceted jewel that spins
  const gemGeo = new T.OctahedronGeometry(0.24, 0);
  A.gem = function (c) {
    const m = new T.Mesh(gemGeo, new T.MeshStandardMaterial({ color: GEM_COL[c], roughness: 0.2, metalness: 0.3, emissive: GEM_COL[c], emissiveIntensity: 0.35 }));
    m.scale.set(1, 1.3, 1);
    return m;
  };

  // ---------- sparkles: one instanced mesh of little tumbling cubes in rainbow colours ----------
  A.sparkles = function (scene, max) {
    max = max || 240;
    const im = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.14, 0.14), new T.MeshBasicMaterial(), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [], col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), v = new T.Vector3();
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set('#ffffff')); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, n, colors, spread) {
        for (let i = 0; i < (n || 8); i++) {
          const k = next++ % max;
          const sp = spread || 0.6;
          ps[k] = { x: x + (Math.random() - 0.5) * sp, y: y + (Math.random() - 0.5) * sp * 0.5, z: 0.6 + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 4, vz: (Math.random() - 0.2) * 2, r: Math.random() * 6, s: 0.6 + Math.random() * 0.9, life: 0.7 + Math.random() * 0.5 };
          im.setColorAt(k, col.set((colors || BANDS)[i % (colors || BANDS).length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 12 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.r += dt * 9;
          q.setFromEuler(e.set(p.r, p.r * 0.7, 0));
          s.setScalar(p.s * Math.min(1, p.life * 3));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };

  // ---------- confetti: one instanced mesh of little paper squares (from TT Ice Climb, from TT Barrel Climb) ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    im.renderOrder = 8;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 6 * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };

  // ---------- spinning stars over a head after an oops ----------
  A.stars = function () {
    const g = new T.Group();
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < 5; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(0.24, 0.24, 1);
      g.add(s);
    }
    g.userData.spin = (t) => g.children.forEach((s, i) => { const a = t * 5 + (i / 5) * PI * 2; s.position.set(Math.cos(a) * 0.34, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.34); });
    return g;
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    s.userData.e = e;
    return s;
  };
  A.setEmoji = function (s, e) { if (s.userData.e !== e) { s.material.map = G.emojiTexture(e); s.material.needsUpdate = true; s.userData.e = e; } };
  A.dispose = function (o) { o.traverse((x) => { if (x.geometry && !x.isSprite && !x.geometry.userData.perSeg) x.geometry.dispose(); }); };
})();
