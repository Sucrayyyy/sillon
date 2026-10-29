'use strict';
// ---------- les 5 étapes de fabrication ----------
const WIN_P = .08, WIN_G = .16;
const NOTE_COL = ['#ff3b2f', '#ff8a1f', '#ffc928', '#35d49a', '#2f6bff', '#8b5cff', '#ff7eb6', '#5ec8ff', '#b9ee3a', '#ff6f61'];

function lacquerTex() {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#2a2e36'; g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(128, 128, 20, 128, 128, 128); rg.addColorStop(0, 'rgba(255,255,255,.05)'); rg.addColorStop(1, 'rgba(0,0,0,.12)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#3b414c'; g.beginPath(); g.arc(128, 128, 128 * .34, 0, TAU); g.fill();
  return c;
}
function chromeTex() {
  const c = mkCanvas(256, 256), g = c.getContext('2d'); g.translate(128, 128);
  const cg = conic(g, 0, [[0, '#eef1f4'], [.12, '#a9b0ba'], [.25, '#f6f8fa'], [.38, '#9aa2ad'], [.5, '#eef1f4'], [.62, '#a3aab4'], [.75, '#f6f8fa'], [.88, '#a1a8b2'], [1, '#eef1f4']]);
  g.fillStyle = cg || '#c9ced6'; g.fillRect(-128, -128, 256, 256);
  g.fillStyle = '#e4e8ec'; g.beginPath(); g.arc(0, 0, 128 * .34, 0, TAU); g.fill();
  return c;
}
function blob(g, x, y, r, R, n = 14, jit = .22) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 - jit / 2 + R() * jit); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  g.beginPath();
  const l = pts[n - 1]; g.moveTo((l[0] + pts[0][0]) / 2, (l[1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}
function splatShape(g, u, v, r, col, seed, k = 1) {
  const R = rng(seed); g.fillStyle = col;
  blob(g, u, v, r * k, R, 20, .16); g.fill();
  const m = 2 + (R() * 5 | 0);
  for (let i = 0; i < m; i++) {
    const a = R() * TAU, d = r * (1.15 + R() * 1.2) * k, sr = r * (.1 + R() * .22) * k;
    g.beginPath(); g.arc(u + Math.cos(a) * d, v + Math.sin(a) * d, sr, 0, TAU); g.fill();
  }
}
function pellet(g, u, v, r, col, rot) {
  g.save(); g.translate(u, v); g.rotate(rot);
  g.fillStyle = shade(col, -.28); g.beginPath(); g.ellipse(0, 2, r, r * .78, 0, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, r * .92, r * .7, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath(); g.ellipse(-r * .3, -r * .25, r * .32, r * .16, -.4, 0, TAU); g.fill();
  g.restore();
}
function drawFlash(g, x, y, R, flash, cut, col) {
  const n = flash.length;
  g.save(); g.translate(x, y);
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = Math.max(2, R * .014); g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    if (cut && cut[i]) continue;
    const a0 = i / n * TAU, a1 = (i + 1.05) / n * TAU, f0 = flash[i] * R, f1 = flash[(i + 1) % n] * R;
    g.beginPath(); g.arc(0, 0, R * .98, a0, a1); g.lineTo(Math.cos(a1) * f1, Math.sin(a1) * f1); g.lineTo(Math.cos(a0) * f0, Math.sin(a0) * f0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(Math.cos(a0) * f0, Math.sin(a0) * f0); g.lineTo(Math.cos(a1) * f1, Math.sin(a1) * f1); g.stroke();
  }
  g.restore();
}
function orderCard(o, compact) {
  return `<div class="card order ${compact ? 'compact' : ''}">
    <div class="ohead"><span class="tag">Commande n°${o.level}</span>${o.special ? '<span class="tag gold">Spéciale · ×2</span>' : ''}${o.level % 10 === 0 ? '<span class="tag gold">Disque d\'or</span>' : ''}</div>
    <div class="oart">${o.artist} <span class="otitle">« ${o.title} »</span></div>
    <div class="ometa"><span>♪ ${GENRES[o.song.gid].name} · ${o.song.bpm} BPM</span><span>★ ${STYLE_NAME[o.style]}</span>${o.wantColor ? `<span><i class="cdot" style="--c:${COLOR[o.wantColor].hex}"></i>${COLOR[o.wantColor].name}</span>` : ''}</div>
  </div>`;
}

// =====================================================================
// 1. GRAVURE — le disque laque tourne, on tape quand les notes passent sous le diamant
// =====================================================================
Scenes.engrave = {
  bg: '#E4EAF1', step: 0,
  enter() {
    const s = ORDER.song; this.s = s;
    this.spb = 60 / s.bpm; this.bar = this.spb * 4; this.rev = this.bar * 2; this.om = TAU / this.rev;
    this.T = s.bars * this.bar; this.rOut = .93; this.rIn = .42;
    this.notes = s.notes.map((n, i) => ({ ...n, i, t: n.b * this.spb, te: (n.b + n.d) * this.spb, st: 0, col: NOTE_COL[n.deg % NOTE_COL.length] }));
    this.max = this.notes.reduce((a, n) => a + (n.hold ? 1.5 : 1), 0);
    this.groove = mkCanvas(TEX, TEX); this.gg = this.groove.getContext('2d'); this.gg.lineCap = 'round';
    this.lac = lacquerTex(); this.chrome = chromeTex();
    Object.assign(this, { phase: 'idle', t: -this.bar, lastG: null, prevP: null, hitT: -9, hitCol: '#fff', combo: 0, maxC: 0, score: 0, hold: null, holdId: null, chromeT: 0, perfects: 0, pulse: 0, kicks: [], lastCount: -1, done: false, idle: 0, R: 0 });
    setHead('Gravure', 'Tape quand un point passe sous le diamant · maintiens sur les traits');
    setBottom(orderCard(ORDER, true) + `<button class="btn" id="go">Lancer la gravure ▶</button>`);
    onTap('#go', () => this.start());
  },
  exit() {
    if (this.player) this.player.stop();
    if (this.cut) this.cut.stop();
    if (this.hold && this.hold.h) this.hold.h.release(A.now());
  },
  layout() {
    this.tR = Math.min(W * .43, stage.h * .42); this.tcy = stage.top + stage.h * .5 + this.tR * .1; this.cx = W / 2;
    if (!this.R) { this.R = this.tR; this.cy = this.tcy; }
  },
  start() {
    if (this.phase !== 'idle') return;
    A.unlock();
    setBottom('<div class="spacer"></div>');
    this.t0 = A.now() + this.bar + .25;
    for (let k = 0; k < 4; k++) A.sfx.countAt(this.t0 - this.bar + k * this.spb, k === 3);
    this.kicks = [];
    this.player = new Player(this.s, { t0: this.t0, out: A.music(), onKick: t => this.kicks.push(t) }).start();
    this.cut = A.loop('cut');
    this.phase = 'play'; Hap.light();
  },
  time() { return A.now() - this.t0 - A.lat(); },
  rho(t) {
    if (t < 0) return lerp(.985, this.rOut, clamp((t + this.bar) / this.bar, 0, 1));
    if (t <= this.T) return lerp(this.rOut, this.rIn, t / this.T);
    return lerp(this.rIn, .36, clamp((t - this.T) / .8, 0, 1));
  },
  notePos(n, t) { const a = -Math.PI / 2 - this.om * (n.t - t), r = this.rho(n.t) * this.R; return { x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r }; },
  stylus() { return { x: this.cx, y: this.cy - this.rho(this.t) * this.R }; },
  gp(t) {
    const a = -Math.PI / 2 - this.om * t, since = t - this.hitT;
    let amp = 0;
    if (this.hold) amp = 1; else if (since >= 0 && since < .6) amp = Math.exp(-since * 6);
    const r = (this.rho(t) + amp * .011 * Math.sin(t * TAU * 22)) * 249;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, c: amp > .05 ? this.hitCol : 'rgba(255,255,255,.26)', w: amp > .05 ? 1.4 + amp * 1.9 : 1.2 };
  },
  engraveTo(t) {
    if (this.lastG == null) { this.lastG = Math.max(t, -this.bar); this.prevP = this.gp(this.lastG); return; }
    const g = this.gg, step = .01;
    g.save(); g.translate(256, 256);
    while (this.lastG + step <= t) {
      const tt = this.lastG + step, p = this.gp(tt), q = this.prevP;
      g.strokeStyle = p.c; g.lineWidth = p.w; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(p.x, p.y); g.stroke();
      this.prevP = p; this.lastG = tt;
    }
    g.restore();
  },
  update(dt) {
    if (this.tR) { this.R = lerp(this.R, this.tR, Math.min(1, dt * 7)); this.cy = lerp(this.cy, this.tcy, Math.min(1, dt * 7)); }
    if (this.phase === 'idle') { this.idle += dt; return; }
    const t = this.time(); this.t = t;
    const heard = A.now() - A.lat();
    while (this.kicks.length && this.kicks[0] <= heard) { this.kicks.shift(); this.pulse = 1; }
    this.pulse = Math.max(0, this.pulse - dt * 5);
    if (this.phase === 'play' || this.phase === 'lead') this.engraveTo(t);
    if (this.phase === 'play') {
      for (const n of this.notes) {
        if (n.t > t + 1) break;
        if (n.st === 0 && t - n.t > WIN_G) {
          n.st = 2; n.mt = t; if (this.combo >= 5) popText('combo perdu', this.cx, this.cy + this.R * .16, { size: 16, color: '#9aa0a8', life: .6, vy: 0 });
          this.combo = 0; A.sfx.miss();
        }
      }
      if (this.hold && t >= this.hold.te) this.finishHold(true);
      if (t < 0) {
        const k = Math.floor((t + this.bar) / this.spb);
        if (k !== this.lastCount && k >= 0 && k < 4) { this.lastCount = k; popText(['3', '2', '1', 'GRAVE !'][k], this.cx, this.cy, { size: k === 3 ? 40 : 70, life: this.spb * .9, vy: 0, color: k === 3 ? '#ff3b2f' : '#fff' }); }
      }
      this.cut.set(t > 0 ? .04 + (this.hold || t - this.hitT < .15 ? .05 : 0) : 0, this.hold ? .5 : 0);
      if (t > this.T + .05) { this.phase = 'lead'; A.sfx.whoosh(); }
    } else if (this.phase === 'lead') {
      if (t - this.T > .9) { this.phase = 'chrome'; this.cut.stop(); A.sfx.shimmer(); Hap.med(); }
    } else if (this.phase === 'chrome') {
      this.chromeT += dt;
      if (this.chromeT > 1.2 && !this.done) { this.done = true; this.finish(); }
    }
  },
  down(x, y, e) {
    if (this.phase !== 'play') return;
    const t = this.time(); if (t < -.3) return;
    let best = null, bd = 9;
    for (const n of this.notes) { if (n.t > t + WIN_G) break; if (n.st !== 0) continue; const d = Math.abs(t - n.t); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > WIN_G) { A.sfx.tick(); const s = this.stylus(); ring(s.x, s.y, 'rgba(255,255,255,.6)', 6, 22, .25, 3); return; }
    this.judge(best, bd <= WIN_P, e.pointerId);
  },
  judge(n, perfect, pid) {
    n.st = 1; n.q = perfect ? 1 : .6; this.score += n.q; this.combo++; this.maxC = Math.max(this.maxC, this.combo);
    if (perfect) this.perfects++;
    this.hitT = this.time(); this.hitCol = n.col;
    const f = mtof(n.m);
    if (n.hold) { if (this.hold) this.finishHold(false); this.hold = n; this.holdId = pid; n.h = A.lead(A.now(), f, Math.max(.1, n.te - this.hitT) + .05, A.music(), this.s.lead); }
    else A.lead(A.now(), f, this.spb * .4, A.music(), this.s.lead);
    if (perfect) A.sfx.perfect();
    Hap.light();
    const s = this.stylus();
    popText(perfect ? 'PARFAIT' : 'BIEN', s.x + this.R * .42, s.y + this.R * .08, { color: perfect ? n.col : '#fff', size: perfect ? 28 : 22, life: .55, vy: -40 });
    burst(s.x, s.y, perfect ? 16 : 9, n.col, perfect ? 320 : 220, { g: 300 });
    ring(s.x, s.y, n.col, 8, perfect ? 48 : 32, .4, 5);
    if (this.combo % 10 === 0) {
      popText('COMBO ×' + this.combo, this.cx, this.cy + this.R * .62, { size: 30, color: '#ffc928', life: 1, vy: -30 });
      A.sfx.combo(); Hap.med(); shake(3, .15);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; part({ type: 'spark', x: this.cx + Math.cos(a) * this.R, y: this.cy + Math.sin(a) * this.R, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: .6, size: 9, color: '#ffc928', vr: 6 }); }
    }
  },
  up(x, y, e) { if (this.hold && e.pointerId === this.holdId) this.finishHold(this.time() >= this.hold.te - .12); },
  finishHold(full) {
    const n = this.hold; this.hold = null; this.hitT = this.time();
    if (full) { this.score += .5; const s = this.stylus(); popText('TENU !', s.x + this.R * .42, s.y + this.R * .2, { color: n.col, size: 24, life: .6 }); A.sfx.perfect(); ring(s.x, s.y, n.col, 10, 50, .4, 5); }
    else if (n.h) n.h.release(A.now());
  },
  finish() {
    const acc = this.max ? Math.min(1, this.score / this.max) : 1;
    RUN.engrave = { acc, maxC: this.maxC, hits: this.notes.map(n => n.st === 1 ? '1' : '0').join(''), perfects: this.perfects, n: this.notes.length };
    RUN.groove = this.groove;
    S.stats.bestCombo = Math.max(S.stats.bestCombo, this.maxC); S.stats.perfect += this.perfects; S.stats.notes += this.notes.length;
    const pct = Math.round(acc * 100);
    setHead(pct >= 90 ? 'Gravure parfaite !' : pct >= 70 ? 'Belle gravure !' : 'Matrice prête', `${pct}% de précision · combo max ${this.maxC}`);
    setBottom(`<button class="btn" id="nx">Faire la galette →</button>`);
    onTap('#nx', () => go('galette'));
    A.sfx.win();
    confetti(this.cx, this.cy, pct >= 90 ? 40 : 18, NOTE_COL);
  },
  drawHold(g, n, t, nr) {
    const t1 = Math.max(n.t, this.hold === n ? t : n.t);
    if (n.te <= t1) return;
    const pts = [], steps = Math.max(4, Math.ceil((n.te - t1) / .03));
    for (let k = 0; k <= steps; k++) {
      const tt = lerp(t1, n.te, k / steps), a = -Math.PI / 2 - this.om * (tt - t), r = this.rho(tt) * this.R;
      pts.push([this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r]);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.strokeStyle = INK; g.lineWidth = nr * 1.5; g.stroke();
    g.strokeStyle = n.col; g.lineWidth = nr * .95; g.stroke();
  },
  draw(g) {
    const { cx, cy } = this, R = this.R, t = this.t, rot = this.om * t + (this.phase === 'idle' ? Math.sin(this.idle * .8) * .04 : 0);
    const ch = this.phase === 'chrome' ? E.io(clamp(this.chromeT, 0, 1)) : 0;
    const Rz = R * (1 + this.pulse * .012);
    drawDisc(g, cx, cy, Rz, { tex: this.lac, groove: this.groove, rot });
    if (ch > 0) {
      g.save(); g.translate(cx, cy); g.beginPath(); g.arc(0, 0, Rz - 1.5, 0, TAU); g.clip(); g.rotate(rot);
      g.globalAlpha = ch * .9; g.drawImage(this.chrome, -Rz, -Rz, 2 * Rz, 2 * Rz);
      g.globalAlpha = ch; g.globalCompositeOperation = 'multiply'; g.drawImage(this.groove, -Rz, -Rz, 2 * Rz, 2 * Rz);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.rotate(-rot);
      const cg = conic(g, -2 + this.chromeT * 5, [[0, 'rgba(255,255,255,0)'], [.04, 'rgba(255,255,255,.75)'], [.08, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
      if (cg) { g.fillStyle = cg; g.fillRect(-Rz, -Rz, 2 * Rz, 2 * Rz); }
      g.restore();
      g.lineWidth = Math.max(3, R * .022); g.strokeStyle = INK; g.beginPath(); g.arc(cx, cy, Rz, 0, TAU); g.stroke();
    }
    // notes
    const nr = R * .062;
    if (this.phase === 'idle' || this.phase === 'play') {
      let ap = null;
      for (const n of this.notes) {
        const dtn = n.t - t; if (dtn > this.rev) break;
        if (n.st === 1 && this.hold !== n) continue;
        if (n.st === 2 && t - n.mt > .35) continue;
        if (n.st === 0 && dtn < -WIN_G) continue;
        if (!ap && n.st === 0 && dtn > -.05) ap = n;
        const al = dtn > this.rev * .78 ? clamp((this.rev - dtn) / (this.rev * .22), 0, 1) : 1;
        g.globalAlpha = al * (n.st === 2 ? clamp(1 - (t - n.mt) / .35, 0, 1) * .7 : 1);
        if (n.hold) this.drawHold(g, n, t, nr);
        const p = this.hold === n ? this.stylus() : this.notePos(n, t);
        const sc = n.st === 0 && dtn < .12 && dtn > -.06 ? 1.18 : 1;
        g.beginPath(); g.arc(p.x, p.y, nr * sc, 0, TAU);
        g.fillStyle = n.st === 2 ? '#8a9099' : n.col; g.fill();
        g.lineWidth = Math.max(2.5, nr * .3); g.strokeStyle = INK; g.stroke();
        if (n.st !== 2) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(p.x - nr * .3, p.y - nr * .3, nr * .28, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
      if (ap && this.phase === 'play') {
        const dtn = ap.t - t;
        if (dtn < .7) {
          const s = this.stylus(), k = clamp(dtn / .7, 0, 1);
          g.globalAlpha = 1 - k; g.strokeStyle = ap.col; g.lineWidth = 4;
          g.beginPath(); g.arc(s.x, s.y, nr * (1.1 + k * 3.2), 0, TAU); g.stroke(); g.globalAlpha = 1;
        }
      }
    }
    // combo au centre
    if (this.phase === 'play' && this.combo > 1) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.font = `900 ${R * .17}px ${FONT}`; g.fillText('×' + this.combo, cx, cy - R * .14);
      g.font = `800 ${R * .07}px ${FONT}`; g.globalAlpha = .7; g.fillText('COMBO', cx, cy + R * .13); g.globalAlpha = 1;
    }
    // graveur : rail, bras, tête, diamant
    const sy = cy - this.rho(t) * R, lw = Math.max(3, R * .022), railY = cy - R - R * .17;
    g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = INK; rrect(g, cx - R * .55, railY - R * .05, R * 1.1, R * .1, R * .05); g.fill();
    g.fillStyle = '#d9dee4'; rrect(g, cx - R * .045, railY, R * .09, Math.max(0, sy - railY - R * .2), 4); g.fill(); g.stroke();
    const bounce = this.hold ? Math.sin(performance.now() / 18) * 1.2 : 0;
    g.fillStyle = '#ff3b2f'; rrect(g, cx - R * .14, sy - R * .3 + bounce, R * .28, R * .16, R * .045); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - R * .06, sy - R * .22 + bounce, R * .025, 0, TAU); g.fill();
    g.fillStyle = '#bfe9ff'; g.beginPath(); g.moveTo(cx - R * .055, sy - R * .14 + bounce); g.lineTo(cx + R * .055, sy - R * .14 + bounce); g.lineTo(cx, sy + bounce * .3); g.closePath(); g.fill(); g.stroke();
    if (this.phase === 'play' && t > 0) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx, sy, 2.5 + this.pulse * 2, 0, TAU); g.fill(); }
  },
};

// =====================================================================
// 2. GALETTE — uni (granulés fondus), points (éclaboussures), liquide (versé + mélangé)
// =====================================================================
Scenes.galette = {
  bg: '#F7E3D9', step: 1,
  enter() {
    this.mode = ORDER.style;
    this.color = ORDER.wantColor || (S.colors.includes('rouge') ? 'rouge' : S.colors[1]);
    this.base = 'noir'; this.sub = 'paint'; this.fx = new Set(); this.time = 0;
    this.tmp = mkCanvas(88, 88); this.tmpG = this.tmp.getContext('2d');
    const m = this.tmpG.createRadialGradient(44, 44, 0, 44, 44, 44);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.6, 'rgba(0,0,0,.8)'); m.addColorStop(1, 'rgba(0,0,0,0)'); this.mask = m;
    this.reset(); this.ui();
  },
  exit() { this.endPour(); if (this.swirl) { this.swirl.stop(); this.swirl = null; } },
  reset() {
    this.tex = mkCanvas(TEX, TEX); this.tg = this.tex.getContext('2d');
    this.dots = mkCanvas(TEX, TEX); this.dg = this.dots.getContext('2d');
    Object.assign(this, { count: 0, pending: [], falling: [], used: new Set(), melt: 0, melted: null, melting: false, meltDone: false, amount: 0, pour: null, flood: null, ptr: null, acc: 0, pelletCols: {}, swirlDist: 0, ready: false, pouring: false, baseHex: COLOR[this.base].hex });
    if (this.mode === 'liquide') { this.tg.fillStyle = this.baseHex; this.tg.fillRect(0, 0, TEX, TEX); }
    if (this.mode !== 'uni') this.used.add(this.base);
  },
  ui() {
    const tabs = ['uni', 'points', 'liquide'].map(m => `<button class="tab ${m === this.mode ? 'on' : ''}" data-m="${m}">${STYLE_NAME[m]}${m === ORDER.style ? '<i class="want">★</i>' : ''}</button>`).join('');
    const seg = this.mode !== 'uni' ? `<div class="seg"><button data-s="fond" class="${this.sub === 'fond' ? 'on' : ''}">Fond</button><button data-s="paint" class="${this.sub !== 'fond' ? 'on' : ''}">${this.mode === 'points' ? 'Points' : 'Verser'}</button></div>` : '';
    const chips = S.colors.map(id => `<button class="chip" data-c="${id}" style="--c:${COLOR[id].hex}">${id === ORDER.wantColor ? '<i class="want">★</i>' : ''}</button>`).join('');
    const fx = S.fx.length ? `<div class="fxrow">${S.fx.map(f => { const F = FX.find(x => x.id === f); return `<button class="fxchip ${this.fx.has(f) ? 'on' : ''}" data-f="${f}">${F.icon} ${F.name}</button>`; }).join('')}</div>` : '';
    setBottom(`<div class="tabs">${tabs}</div><div class="crow">${seg}<div class="chips scroll">${chips}</div></div>${fx}<button class="btn" id="press" ${this.ready ? '' : 'disabled'}>Presser →</button>`);
    const bt = $('#bottom');
    bt.querySelectorAll('.tab').forEach(b => onTap(b, () => { const m = b.dataset.m; if (m === this.mode) return; this.endPour(); this.mode = m; this.sub = 'paint'; this.reset(); this.ui(); A.sfx.whoosh(); }));
    bt.querySelectorAll('.seg button').forEach(b => onTap(b, () => { this.sub = b.dataset.s; bt.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); this.chipState(); this.hint(); }));
    bt.querySelectorAll('.chip').forEach(b => onTap(b, () => this.pickColor(b.dataset.c)));
    bt.querySelectorAll('.fxchip').forEach(b => onTap(b, () => { const f = b.dataset.f; if (this.fx.has(f)) this.fx.delete(f); else { this.fx.add(f); A.sfx.shimmer(); } b.classList.toggle('on', this.fx.has(f)); }));
    onTap('#press', () => this.toPress());
    this.chipState(); this.hint();
  },
  chipState() { const cur = this.sub === 'fond' && this.mode !== 'uni' ? this.base : this.color; $('#bottom').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.c === cur)); },
  pickColor(id) {
    A.sfx.tab();
    if (this.sub === 'fond' && this.mode !== 'uni') { this.base = id; this.doFlood(256, 256); }
    else this.color = id;
    this.chipState();
  },
  hint() {
    const h = {
      uni: this.meltDone ? 'Galette fondue, prête à presser !' : 'Choisis une couleur et maintiens pour verser les granulés',
      points: this.sub === 'fond' ? 'Choisis la couleur du fond' : 'Tape ou glisse sur la galette pour poser des points',
      liquide: this.sub === 'fond' ? 'Choisis la couleur du fond' : 'Maintiens pour verser · glisse pour mélanger',
    }[this.mode];
    setHead('La galette', h);
  },
  setReady(v) {
    const was = this.ready; this.ready = v; const b = $('#press'); if (b) b.disabled = !v;
    if (v && !was) { A.sfx.soft(); b && b.classList.add('wiggle'); }
  },
  layout() {
    const k = this.mode === 'uni' ? .38 : .45;
    this.R = Math.min(W * .42, stage.h * k); this.cx = W / 2;
    this.cy = stage.cy + (this.mode === 'uni' ? stage.h * .1 : 0);
    this.hopY = this.cy - this.R - Math.min(this.R * .45, stage.h * .1);
  },
  toTex(x, y) { return [(x - this.cx) / this.R * 256 + 256, (y - this.cy) / this.R * 256 + 256]; },
  toScr(u, v) { return [this.cx + (u - 256) / 256 * this.R, this.cy + (v - 256) / 256 * this.R]; },
  down(x, y, e) {
    if (this.ptr) return;
    if (this.mode === 'uni') { if (this.meltDone || this.melting) return; this.ptr = { id: e.pointerId, x, y }; this.pouring = true; Hap.light(); return; }
    if (Math.hypot(x - this.cx, y - this.cy) > this.R * 1.05) return;
    const [u, v] = this.toTex(x, y);
    this.ptr = { id: e.pointerId, x, y, sx: x, sy: y, moved: false };
    if (this.sub === 'fond') { this.doFlood(u, v); return; }
    if (this.mode === 'points') { this.splat(u, v, false); this.lastSplat = [x, y]; }
    else { this.pour = { u, v, r: 6, col: COLOR[this.color].hex }; this.used.add(this.color); this.pourLoop = A.loop('pour'); Hap.light(); }
  },
  move(x, y, e) {
    const p = this.ptr; if (!p || e.pointerId !== p.id) return;
    if (this.mode === 'points' && this.sub !== 'fond' && this.lastSplat) {
      if (Math.hypot(x - this.lastSplat[0], y - this.lastSplat[1]) > this.R * .15 && Math.hypot(x - this.cx, y - this.cy) < this.R) {
        const [u, v] = this.toTex(x, y); this.splat(u, v, true); this.lastSplat = [x, y];
      }
    }
    if (this.mode === 'liquide' && this.sub !== 'fond') {
      if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 12) { p.moved = true; this.endPour(); this.swirl = A.loop('swirl'); }
      if (p.moved) {
        const sp = Math.hypot(x - p.x, y - p.y);
        this.smudge(p.x, p.y, x, y); this.swirlDist += sp;
        this.swirl && this.swirl.set(clamp(sp / 25, 0, 1) * .38, clamp(sp / 35, 0, 1));
        if (Math.random() < .25) Hap.light();
        this.checkReady();
      }
    }
    p.x = x; p.y = y;
  },
  up(x, y, e) {
    const p = this.ptr; if (!p || e.pointerId !== p.id) return;
    this.ptr = null; this.pouring = false; this.lastSplat = null; this.endPour();
    if (this.swirl) { this.swirl.stop(); this.swirl = null; }
  },
  endPour() {
    this.pour = null;
    if (this.pourLoop) { this.pourLoop.stop(); this.pourLoop = null; }
    this.checkReady();
  },
  checkReady() { if (this.mode === 'liquide' && (this.amount > .8 || (this.swirlDist > this.R * 4 && this.amount > .25))) this.setReady(true); },
  smudge(x0, y0, x1, y1) {
    const [au, av] = this.toTex(x0, y0), [bu, bv] = this.toTex(x1, y1), d = Math.hypot(bu - au, bv - av), n = Math.min(40, Math.ceil(d / 3)), rb = 44;
    const tc = this.tmpG;
    for (let i = 1; i <= n; i++) {
      const pu = clamp(lerp(au, bu, (i - 1) / n), rb, TEX - rb), pv = clamp(lerp(av, bv, (i - 1) / n), rb, TEX - rb);
      const qu = clamp(lerp(au, bu, i / n), rb, TEX - rb), qv = clamp(lerp(av, bv, i / n), rb, TEX - rb);
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, 88, 88);
      tc.drawImage(this.tex, pu - rb, pv - rb, 88, 88, 0, 0, 88, 88);
      tc.globalCompositeOperation = 'destination-in'; tc.fillStyle = this.mask; tc.fillRect(0, 0, 88, 88);
      this.tg.globalAlpha = .92; this.tg.drawImage(this.tmp, qu - rb, qv - rb); this.tg.globalAlpha = 1;
    }
  },
  splat(u, v, small) {
    const seed = Math.random() * 1e9 | 0, r = small ? rand(6, 13) : rand(12, 25), col = COLOR[this.color].hex;
    this.pending.push({ u, v, r, col, seed, t: 0 }); this.count++; this.used.add(this.color);
    A.sfx.pop(this.count); A.sfx.splat(); Hap.light();
    const [x, y] = this.toScr(u, v); burst(x, y, small ? 4 : 8, col, 220, { g: 600, size: [2, 5] });
    if (this.count >= 6) this.setReady(true);
  },
  doFlood(u, v) {
    this.flood = { u, v, r: 0, col: COLOR[this.base].hex }; this.used.add(this.base);
    A.sfx.flood(); Hap.med();
    const [x, y] = this.toScr(u, v); ring(x, y, COLOR[this.base].hex, 10, this.R * 1.2, .5, 8);
  },
  compose() {
    const g = this.tg; g.fillStyle = this.baseHex; g.fillRect(0, 0, TEX, TEX);
    if (this.flood) { g.fillStyle = this.flood.col; g.beginPath(); g.arc(this.flood.u, this.flood.v, this.flood.r, 0, TAU); g.fill(); }
    g.drawImage(this.dots, 0, 0);
  },
  update(dt) {
    this.time += dt;
    if (this.flood) {
      const f = this.flood; f.r += dt * 1500;
      if (this.mode === 'liquide') { this.tg.fillStyle = f.col; this.tg.beginPath(); this.tg.arc(f.u, f.v, f.r, 0, TAU); this.tg.fill(); }
      if (f.r > 740) { this.baseHex = f.col; this.flood = null; if (this.mode === 'liquide') { this.amount = 0; this.swirlDist = 0; this.setReady(false); } }
    }
    for (const s of this.pending) s.t += dt;
    while (this.pending.length && this.pending[0].t >= .16) { const s = this.pending.shift(); splatShape(this.dg, s.u, s.v, s.r, s.col, s.seed); }
    if (this.mode === 'points') this.compose();
    if (this.pour) {
      const p = this.pour; p.r = Math.min(210, p.r + dt * (125 - p.r * .35)); this.amount += dt;
      this.tg.fillStyle = p.col; blob(this.tg, p.u, p.v, p.r, rng(this.time * 1000 | 0), 22, .06); this.tg.fill();
      if (Math.random() < dt * 16) A.sfx.bubble(p.r / 210);
      this.pourLoop && this.pourLoop.set(.24, p.r / 210);
      this.checkReady();
    }
    if (this.mode === 'uni') this.updateUni(dt);
  },
  updateUni(dt) {
    const NEED = 150;
    if (this.pouring && !this.meltDone && !this.melting) {
      this.acc = Math.min(this.acc + dt * 80, 3);
      while (this.acc >= 1 && this.count + this.falling.length < NEED) {
        this.acc--;
        const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * 232, u = 256 + Math.cos(a) * rr, v = 256 + Math.sin(a) * rr;
        const [x1, y1] = this.toScr(u, v), x0 = this.cx + rand(-this.R * .06, this.R * .06), y0 = this.hopY + this.R * .12;
        this.falling.push({ x0, y0, x1, y1, u, v, t: 0, d: .2 + (y1 - y0) / this.R * .12, col: COLOR[this.color].hex, r: rand(12, 16), rot: rand(0, TAU) });
        this.used.add(this.color); this.pelletCols[this.color] = (this.pelletCols[this.color] || 0) + 1;
      }
    }
    const keep = [];
    for (const p of this.falling) { p.t += dt; if (p.t >= p.d) this.land(p); else keep.push(p); }
    this.falling = keep;
    if (this.count >= NEED && !this.melting && !this.meltDone && !this.falling.length) this.startMelt();
    if (this.melting) {
      this.melt = Math.min(1, this.melt + dt / 1.1);
      if (Math.random() < dt * 14) part({ type: 'puff', x: this.cx + rand(-this.R, this.R) * .8, y: this.cy + rand(-this.R, this.R) * .6, vy: -rand(40, 90), life: rand(.6, 1), size: rand(6, 12), color: 'rgba(255,255,255,.8)' });
      if (this.melt >= 1) {
        this.melting = false; this.meltDone = true; this.setReady(true); this.hint();
        A.sfx.ding(); Hap.med(); ring(this.cx, this.cy, '#fff', this.R * .9, this.R * 1.2, .5, 6);
      }
    }
  },
  land(p) {
    pellet(this.tg, p.u, p.v, p.r, p.col, p.rot); this.count++;
    const now = performance.now(); if (now - (this.lastPel || 0) > 16) { A.sfx.pellet(); this.lastPel = now; }
    if (this.count % 8 === 0) Hap.light();
  },
  startMelt() {
    this.melting = true; this.melt = 0; A.sfx.melt(); Hap.med(); this.pouring = false;
    let r = 0, gg = 0, b = 0, n = 0;
    for (const [id, c] of Object.entries(this.pelletCols)) { const [x, y, z] = hexRgb(COLOR[id].hex); r += x * c; gg += y * c; b += z * c; n += c; }
    const avg = rgbHex(r / n, gg / n, b / n);
    const up = (n) => { // flou doux : réduction puis agrandissements successifs
      let c = mkCanvas(n, n), cg = c.getContext('2d'); cg.fillStyle = avg; cg.fillRect(0, 0, n, n); cg.drawImage(this.tex, 0, 0, n, n);
      while (c.width < TEX) { const m = Math.min(TEX, c.width * 2), d = mkCanvas(m, m), dg = d.getContext('2d'); dg.imageSmoothingEnabled = true; dg.imageSmoothingQuality = 'high'; dg.drawImage(c, 0, 0, m, m); c = d; }
      return c;
    };
    const out = up(16), og = out.getContext('2d'); og.globalAlpha = .45; og.drawImage(up(48), 0, 0); og.globalAlpha = 1;
    this.melted = out;
  },
  toPress() {
    if (!this.ready) return;
    let tex;
    if (this.mode === 'uni') tex = this.melted;
    else {
      if (this.mode === 'points') { while (this.pending.length) { const s = this.pending.shift(); splatShape(this.dg, s.u, s.v, s.r, s.col, s.seed); } this.flood = null; this.compose(); }
      tex = copyCanvas(this.tex);
    }
    RUN.mat = { mode: this.mode, tex, used: [...this.used], fx: [...this.fx] };
    go('press');
  },
  draw(g) {
    const { cx, cy, R } = this, lw = Math.max(3, R * .022), fx = [...this.fx];
    if (this.mode === 'uni') {
      // trémie
      const hy = this.hopY, hw = R * .42, col = COLOR[this.color].hex, jig = this.pouring ? Math.sin(this.time * 60) * 1.5 : 0;
      g.save(); g.translate(jig, 0);
      g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round';
      g.fillStyle = PAPER; g.beginPath(); g.moveTo(cx - hw, hy - R * .22); g.lineTo(cx + hw, hy - R * .22); g.lineTo(cx + R * .07, hy + R * .06); g.lineTo(cx - R * .07, hy + R * .06); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(cx - hw * .8, hy - R * .14); g.lineTo(cx + hw * .8, hy - R * .14); g.lineTo(cx + R * .06, hy + R * .03); g.lineTo(cx - R * .06, hy + R * .03); g.closePath(); g.fill();
      g.fillStyle = '#d9dee4'; rrect(g, cx - R * .07, hy + R * .04, R * .14, R * .09, 3); g.fill(); g.stroke();
      g.restore();
      if (this.meltDone) drawDisc(g, cx, cy, R, { tex: this.melted, rings: false, hole: false, fx, time: this.time });
      else {
        g.fillStyle = 'rgba(21,21,21,.07)'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
        g.globalAlpha = this.melting ? 1 - E.io(this.melt) : 1; g.drawImage(this.tex, cx - R, cy - R, 2 * R, 2 * R);
        if (this.melting) { g.globalAlpha = E.io(this.melt); g.drawImage(this.melted, cx - R, cy - R, 2 * R, 2 * R); }
        g.globalAlpha = 1; g.restore();
        g.lineWidth = lw; g.strokeStyle = INK; g.setLineDash(this.count ? [] : [10, 9]); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.setLineDash([]);
        // jauge de remplissage
        const k = Math.min(1, this.count / 150);
        g.lineCap = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(21,21,21,.12)'; g.beginPath(); g.arc(cx, cy, R + 14, 0, TAU); g.stroke();
        if (k > 0) { g.strokeStyle = INK; g.beginPath(); g.arc(cx, cy, R + 14, -Math.PI / 2, -Math.PI / 2 + k * TAU); g.stroke(); }
      }
      for (const p of this.falling) {
        const k = p.t / p.d, x = lerp(p.x0, p.x1, k), y = p.y0 + (p.y1 - p.y0) * k * k, r = p.r * R / 256;
        g.fillStyle = p.col; g.beginPath(); g.ellipse(x, y, r * .9, r * .7, p.rot + k * 6, 0, TAU); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(21,21,21,.5)'; g.stroke();
      }
      if (!this.count && !this.pouring) this.tapHint(g, cx, cy);
      return;
    }
    drawDisc(g, cx, cy, R, { tex: this.tex, rings: false, hole: false, fx, time: this.time });
    if (this.pending.length) {
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      g.translate(cx - R, cy - R); g.scale(R / 256, R / 256);
      for (const s of this.pending) splatShape(g, s.u, s.v, s.r, s.col, s.seed, E.back(clamp(s.t / .16, 0, 1)));
      g.restore();
    }
    if (this.mode === 'liquide') { // reflet mouillé
      g.save(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineCap = 'round'; g.lineWidth = R * .035;
      g.beginPath(); g.arc(cx, cy, R * .82, -Math.PI * .85, -Math.PI * .62); g.stroke();
      g.lineWidth = R * .02; g.beginPath(); g.arc(cx, cy, R * .82, -Math.PI * .56, -Math.PI * .5); g.stroke(); g.restore();
    }
    if (this.mode === 'points' && this.count === 0 && this.sub !== 'fond') this.tapHint(g, cx, cy);
    if (this.mode === 'liquide' && this.amount === 0 && this.sub !== 'fond' && !this.ptr) this.tapHint(g, cx, cy);
  },
  tapHint(g, x, y) {
    const k = (this.time * 1.2) % 1;
    g.strokeStyle = INK; g.globalAlpha = 1 - k; g.lineWidth = 4;
    g.beginPath(); g.arc(x, y, 18 + k * 34, 0, TAU); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = PAPER; g.beginPath(); g.arc(x, y, 14 - Math.sin(k * Math.PI) * 3, 0, TAU); g.fill(); g.lineWidth = 3.5; g.stroke();
  },
};

// =====================================================================
// 3. PRESSE HYDRAULIQUE — maintenir, relâcher dans la zone verte
// =====================================================================
Scenes.press = {
  bg: '#E2EADF', step: 2,
  enter() {
    this.mat = RUN.mat.tex; const L = ORDER.level;
    Object.assign(this, { phase: 'ready', plate: 0, P: 0, Pd: 0, hold: false, t: 0, cureT: 0, riseT: 0, rv: 0, overload: false, lastTick: 0, shown: false });
    this.tc = rand(.56, .74); this.tw = Math.max(.04, .1 - L * .0025); this.rate = .3 + Math.min(L, 40) * .006;
    this.hydro = A.loop('hydro');
    setHead('La presse', 'Maintiens pour presser · relâche dans le vert');
    setBottom(`<button class="btn hold" id="hold">Maintenir</button>`);
    const b = $('#hold');
    b.addEventListener('pointerdown', e => { e.preventDefault(); A.unlock(); try { b.setPointerCapture(e.pointerId); } catch (_) { } b.classList.add('down'); this.holdOn(); });
    ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { b.classList.remove('down'); this.holdOff(); }));
  },
  exit() { this.hydro.stop(); },
  layout() {
    const R = Math.min(W * .4, stage.h / 2.3); this.R = R; this.cx = W / 2;
    this.yTop = stage.top + Math.max(0, (stage.h - R * 2.2) / 2); this.yL = this.yTop + R * 1.75;
    this.Rf = Math.min(W * .4, stage.h * .42); this.cyf = stage.cy;
  },
  down() { this.holdOn(); }, up() { this.holdOff(); },
  holdOn() {
    if (!['ready', 'descend', 'pressure'].includes(this.phase)) return;
    this.hold = true; if (this.phase === 'ready') this.phase = 'descend'; Hap.light();
  },
  holdOff() { this.hold = false; if (this.phase === 'pressure' && this.P > .06) this.release(); },
  update(dt) {
    this.t += dt;
    if (this.phase === 'descend') {
      if (this.hold) {
        this.plate = Math.min(1, this.plate + dt * 1.5); this.hydro.set(.22, .15);
        if (this.plate >= 1) { this.phase = 'pressure'; A.sfx.clank(); A.sfx.thump(.6); shake(5, .2); Hap.heavy(); }
      } else this.hydro.set(.04, 0);
    } else if (this.phase === 'pressure') {
      if (this.hold) {
        this.P = Math.min(1, this.P + dt * this.rate * (.45 + this.P * 1.35));
        this.hydro.set(.3 + this.P * .35, this.P);
        if (Math.random() < dt * (1 + this.P * 6)) A.sfx.creak();
        const tk = Math.floor(this.P * 25); if (tk !== this.lastTick) { this.lastTick = tk; A.sfx.gauge(); if (tk % 2 === 0) Hap.light(); }
        if (this.P >= 1) { this.overload = true; A.sfx.alarm(); this.release(); }
      } else { this.P = Math.max(0, this.P - dt * .25); this.hydro.set(.05 + this.P * .2, this.P * .5); }
    } else if (this.phase === 'cure') {
      this.cureT += dt; this.hydro.set(Math.max(0, .2 - this.cureT * .25), .1);
      if (this.cureT < .8 && Math.random() < dt * 34) this.puff();
      if (this.cureT > 1.0) { this.phase = 'rise'; this.riseT = 0; this.hydro.set(.2, .3); A.sfx.whoosh(); this.prepareDisc(); }
    } else if (this.phase === 'rise') {
      this.riseT += dt;
      if (this.riseT > .55) { this.hydro.set(0, 0); this.phase = 'reveal'; this.rv = 0; A.sfx.shimmer(); }
    } else if (this.phase === 'reveal') {
      this.rv = Math.min(1, this.rv + dt / .85);
      if (this.rv >= 1 && !this.shown) { this.shown = true; this.result(); }
    }
    this.Pd = lerp(this.Pd, this.P, Math.min(1, dt * 18));
  },
  release() {
    this.phase = 'cure'; this.cureT = 0; this.hold = false;
    const d = Math.abs(this.P - this.tc), tw = this.tw; let q, lab;
    if (this.overload) { q = .35; lab = 'TROP FORT !'; }
    else if (d <= tw * .35) { q = 1; lab = 'PARFAIT !'; }
    else if (d <= tw) { q = .92 - (d - tw * .35) / (tw * .65) * .17; lab = 'BIEN PRESSÉ'; }
    else { q = Math.max(.3, .72 - (d - tw) * 3); lab = this.P < this.tc ? 'UN PEU LÉGER' : 'UN PEU FORT'; }
    RUN.press = { q, lab };
    this.flashAmt = clamp(this.P / this.tc, .5, 1.5);
    A.sfx.thump(1.2); A.sfx.hiss(1.1); shake(q >= 1 ? 12 : 8, .35); Hap.heavy();
    popText(lab, this.cx, this.yTop + this.R * .95, { size: 34, color: q >= 1 ? '#20c27a' : q > .7 ? '#ffc928' : '#ff3b2f', life: 1.3, vy: -15 });
    if (q >= 1) { A.sfx.star(2); for (let i = 0; i < 12; i++) part({ type: 'spark', x: this.cx, y: this.yTop + this.R * .47, vx: rand(-260, 260), vy: rand(-260, 40), g: 400, life: .8, size: rand(7, 12), color: '#20c27a', vr: 8 }); }
    setBottom('<div class="spacer"></div>');
  },
  puff() {
    const G = this.geo(), side = Math.random() < .5 ? -1 : 1;
    part({ type: 'puff', x: this.cx + side * (G.rx + rand(-4, 10)), y: this.yL - G.th / 2, vx: side * rand(60, 200), vy: -rand(40, 140), life: rand(.6, 1.1), size: rand(9, 18) * this.R / 170, color: '#fff', drag: 1.2 });
  },
  prepareDisc() {
    const k = { liquide: 1.3, uni: .9, points: .35 }[RUN.mat.mode];
    RUN.disc = swirlTex(this.mat, k);
    const R = rng(Math.random() * 1e9 | 0), ph = [R() * TAU, R() * TAU, R() * TAU], amt = this.flashAmt || 1;
    RUN.flash = [];
    for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; RUN.flash.push(1.03 + (.05 + .025 * Math.sin(a * 3 + ph[0]) + .02 * Math.sin(a * 7 + ph[1]) + .012 * Math.sin(a * 13 + ph[2])) * amt); }
    RUN.edge = shade(avgColor(RUN.disc), -.1);
  },
  geo() {
    const R = this.R, th0 = R * .26, th1 = R * .045, yL = this.yL, rest = yL - th0 - R * .5;
    if (this.phase === 'ready' || this.phase === 'descend') return { th: th0, rx: R * .5, yU: lerp(rest, yL - th0, E.io(this.plate)), contact: this.plate >= 1 };
    if (this.phase === 'pressure' || this.phase === 'cure') {
      const s = clamp(this.P / this.tc, 0, 1.4), s1 = Math.min(1, s), th = lerp(th0, th1, E.out(s1));
      return { th, rx: lerp(R * .5, R, E.out(s1)) + Math.max(0, s - 1) * R * .2, yU: yL - th, contact: true };
    }
    const k = this.phase === 'rise' ? E.io(clamp(this.riseT / .55, 0, 1)) : 1;
    return { th: th1, rx: R, yU: lerp(yL - th1, rest, k), contact: false, open: true };
  },
  drawPuck(g, G) {
    const { cx, yL } = this, rx = G.rx, ry = rx * .22, th = G.th, top = yL - th, lw = Math.max(3, this.R * .022);
    g.save(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round';
    if (G.contact) {
      rrect(g, cx - rx - th * .25, top, 2 * rx + th * .5, th, th / 2);
      g.save(); g.clip(); g.drawImage(this.mat, 0, 236, 512, 40, cx - rx - th, top, 2 * rx + 2 * th, th); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - rx - th, top, 2 * rx + 2 * th, th); g.restore();
      g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx - rx, top); g.lineTo(cx - rx, yL); g.ellipse(cx, yL, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, top); g.closePath();
      g.save(); g.clip(); g.drawImage(this.mat, 0, 236, 512, 40, cx - rx, top - ry, 2 * rx, th + 2 * ry); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - rx, top - ry, 2 * rx, th + 2 * ry); g.restore();
      g.stroke();
      g.save(); g.translate(cx, top); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.clip();
      g.drawImage(this.mat, -rx, -rx, 2 * rx, 2 * rx); shine(g, rx, .8); g.restore();
      g.beginPath(); g.ellipse(cx, top, rx, ry, 0, 0, TAU); g.stroke();
    }
    g.restore();
  },
  drawDial(g) {
    const R = this.R, x = this.cx, y = this.yTop + R * .47, r = R * .36, lw = Math.max(3, R * .022);
    const ang = p => Math.PI + p * Math.PI;
    g.lineWidth = lw; g.strokeStyle = INK;
    g.fillStyle = PAPER; g.beginPath(); g.arc(x, y, r + R * .06, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.lineCap = 'butt'; g.lineWidth = R * .075;
    g.strokeStyle = '#dfe3e8'; g.beginPath(); g.arc(x, y, r * .78, ang(0), ang(1)); g.stroke();
    const inBand = Math.abs(this.Pd - this.tc) <= this.tw && this.phase === 'pressure';
    g.strokeStyle = inBand ? '#2ee08e' : '#20c27a'; g.beginPath(); g.arc(x, y, r * .78, ang(this.tc - this.tw), ang(this.tc + this.tw)); g.stroke();
    g.strokeStyle = '#0d8f53'; g.beginPath(); g.arc(x, y, r * .78, ang(this.tc - this.tw * .35), ang(this.tc + this.tw * .35)); g.stroke();
    g.strokeStyle = '#ff3b2f'; g.beginPath(); g.arc(x, y, r * .78, ang(.92), ang(1)); g.stroke();
    g.lineWidth = 2; g.strokeStyle = INK;
    for (let i = 0; i <= 10; i++) { const a = ang(i / 10); g.beginPath(); g.moveTo(x + Math.cos(a) * r * .97, y + Math.sin(a) * r * .97); g.lineTo(x + Math.cos(a) * r * (i % 5 ? .9 : .84), y + Math.sin(a) * r * (i % 5 ? .9 : .84)); g.stroke(); }
    const jit = this.phase === 'pressure' && this.hold ? Math.sin(this.t * 37) * .005 * (1 + this.P * 2) : 0;
    const a = ang(clamp(this.Pd + jit, 0, 1));
    g.lineCap = 'round'; g.lineWidth = R * .035; g.strokeStyle = INK;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * .9, y + Math.sin(a) * r * .9); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, r * .14, 0, TAU); g.fill();
    g.fillStyle = '#ff3b2f'; g.beginPath(); g.arc(x, y, r * .06, 0, TAU); g.fill();
    if (inBand) { g.globalAlpha = .5 + Math.sin(this.t * 30) * .3; g.strokeStyle = '#2ee08e'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + R * .1, Math.PI, 0); g.stroke(); g.globalAlpha = 1; }
  },
  draw(g) {
    const { cx, R, yL, yTop } = this, G = this.geo(), lw = Math.max(3, R * .022);
    const fade = this.phase === 'reveal' ? 1 - E.io(Math.min(1, this.rv * 1.6)) : 1;
    if (fade > 0) {
      g.save(); g.globalAlpha = fade; g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round';
      g.fillStyle = '#dfe4ea';
      for (const s of [-1, 1]) { rrect(g, cx + s * R * 1.02 - R * .07, yTop + R * .3, R * .14, yL - yTop, R * .03); g.fill(); g.stroke(); }
      g.fillStyle = '#ff3b2f'; rrect(g, cx - R * 1.2, yL + R * .17, R * 2.4, R * .26, R * .06); g.fill(); g.stroke();
      g.fillStyle = '#e8ecf0'; rrect(g, cx - R * .95, yL - R * .06, R * 1.9, R * .08, R * .02); g.fill(); g.stroke();
      if (!G.open) this.drawPuck(g, G);
      g.fillStyle = '#aeb7c2'; rrect(g, cx - R * .95, yL, R * 1.9, R * .18, R * .03); g.fill(); g.stroke();
      g.fillStyle = '#e6eaef'; g.fillRect(cx - R * .11, yTop + R * .5, R * .22, Math.max(0, G.yU - R * .2 - (yTop + R * .5)));
      g.strokeRect(cx - R * .11, yTop + R * .5, R * .22, Math.max(0, G.yU - R * .2 - (yTop + R * .5)));
      g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(cx - R * .06, yTop + R * .52, R * .035, Math.max(0, G.yU - R * .24 - (yTop + R * .5)));
      g.fillStyle = '#aeb7c2'; rrect(g, cx - R * .9, G.yU - R * .2, R * 1.8, R * .2, R * .03); g.fill(); g.stroke();
      g.fillStyle = '#e6eaef'; g.fillRect(cx - R * .86, G.yU - R * .05, R * 1.72, R * .035);
      g.fillStyle = '#ff3b2f'; rrect(g, cx - R * 1.2, yTop, R * 2.4, R * .55, R * .08); g.fill(); g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = INK; g.beginPath(); g.arc(cx + s * R * 1.02, yTop + R * .14, R * .045, 0, TAU); g.fill(); }
      this.drawDial(g);
      g.restore();
    }
    if (G.open) {
      const k = this.phase === 'reveal' ? E.back(this.rv) : 0, kk = this.phase === 'reveal' ? E.io(this.rv) : 0;
      const r = lerp(R, this.Rf, kk), y = lerp(yL - G.th, this.cyf, kk), sy = lerp(.22, 1, k);
      g.save(); g.translate(cx, y); g.scale(1, sy);
      drawFlash(g, 0, 0, r, RUN.flash, null, RUN.edge);
      drawDisc(g, 0, 0, r, { tex: RUN.disc, groove: RUN.groove, grooveAlpha: .5, fx: RUN.mat.fx, shadow: false, time: this.t, rot: kk * .6 });
      g.restore();
    }
  },
  result() {
    const q = RUN.press.q;
    setHead(RUN.press.lab, `Pressage ${Math.round(q * 100)}% · ton disque est né`);
    setBottom(`<button class="btn" id="nx">Finition →</button>`);
    onTap('#nx', () => go('finish'));
    confetti(this.cx, this.cyf, 30, RUN.mat.used.map(id => COLOR[id].hex).concat(['#fff']));
    A.sfx.win(); Hap.med();
  },
};

// =====================================================================
// 4. FINITION — ébavurer au doigt puis coller l'étiquette
// =====================================================================
Scenes.finish = {
  bg: '#EEE6F4', step: 3,
  enter() {
    this.n = RUN.flash.length; this.cut = new Array(this.n).fill(0);
    Object.assign(this, { nc: 0, lastA: null, phase: 'trim', t: 0, rot: 0, ptr: null, st: 0, landed: false, blade: null });
    this.labelCol = S.labels.includes('blanc') ? 'blanc' : S.labels[0];
    setHead('Ébavurage', 'Trace le tour du disque avec ton doigt');
    setBottom(`<div class="prog"><i id="pg"></i></div><div class="spacer"></div>`);
  },
  layout() { this.R = Math.min(W * .38, stage.h * .38); this.cx = W / 2; this.cy = stage.cy; },
  down(x, y, e) {
    if (this.phase === 'trim') { this.ptr = e.pointerId; this.lastA = null; this.move(x, y, e); }
    else if (this.phase === 'label' && Math.hypot(x - this.cx, y - this.cy) < this.R * .7) this.slap();
  },
  move(x, y, e) {
    if (this.phase !== 'trim' || this.ptr !== e.pointerId) return;
    this.blade = [x, y];
    const d = Math.hypot(x - this.cx, y - this.cy) / this.R;
    if (d < .7 || d > 1.8) { this.lastA = null; return; }
    const a = Math.atan2(y - this.cy, x - this.cx);
    if (this.lastA != null) {
      let da = a - this.lastA; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (Math.abs(da) < 1.3) { const steps = Math.max(1, Math.ceil(Math.abs(da) / (TAU / this.n) * 2)); for (let k = 0; k <= steps; k++) this.cutAt(this.lastA + da * k / steps); }
    } else this.cutAt(a);
    this.lastA = a;
  },
  up(x, y, e) { if (e.pointerId === this.ptr) { this.ptr = null; this.lastA = null; this.blade = null; } },
  strip(i) {
    const am = (i + .5) / this.n * TAU, fr = RUN.flash[i] * this.R, c = Math.cos(am), s = Math.sin(am);
    part({ type: 'strip', x: this.cx + c * fr, y: this.cy + s * fr, vx: c * rand(120, 280) + rand(-40, 40), vy: s * rand(120, 280) - rand(80, 220), g: 1300, life: rand(.6, 1), rot: am, vr: rand(-12, 12), size: this.R * .055, color: RUN.edge, drag: .5 });
  },
  cutAt(a) {
    if (this.phase !== 'trim') return;
    const i = Math.floor((((a % TAU) + TAU) % TAU) / TAU * this.n) % this.n;
    if (this.cut[i]) return;
    this.cut[i] = 1; this.nc++; this.strip(i);
    const now = performance.now(); if (now - (this.lastS || 0) > 22) { A.sfx.scrape(this.nc / this.n); this.lastS = now; }
    if (this.nc % 3 === 0) Hap.light();
    const pg = $('#pg'); if (pg) pg.style.width = (this.nc / this.n * 100) + '%';
    if (this.nc >= this.n * .94) this.trimmed();
  },
  trimmed() {
    for (let i = 0; i < this.n; i++) if (!this.cut[i]) { this.cut[i] = 1; this.strip(i); }
    const pg = $('#pg'); if (pg) pg.style.width = '100%';
    this.phase = 'label'; this.ptr = null; this.blade = null;
    A.sfx.ding(); A.sfx.shimmer(); Hap.med(); shake(4, .15);
    ring(this.cx, this.cy, '#fff', this.R, this.R * 1.3, .5, 7);
    setTimeout(() => { if (this.phase !== 'label') return; setHead('Étiquette', 'Choisis sa couleur, puis tape au centre'); this.labelUI(); }, 350);
  },
  labelUI() {
    const chips = S.labels.map(id => `<button class="chip" data-c="${id}" style="--c:${COLOR[id].hex}"></button>`).join('');
    setBottom(`<div class="chips scroll center">${chips}</div><div class="spacer"></div>`);
    const st = () => $('#bottom').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.c === this.labelCol));
    $('#bottom').querySelectorAll('.chip').forEach(b => onTap(b, () => { this.labelCol = b.dataset.c; A.sfx.tab(); st(); }));
    st();
  },
  labelObj() { return { hex: COLOR[this.labelCol].hex, top: ORDER.artist, bottom: ORDER.title }; },
  slap() { this.phase = 'slap'; this.st = 0; A.sfx.whoosh(); },
  update(dt) {
    this.t += dt;
    if (this.phase === 'slap' || this.phase === 'done') {
      this.st += dt;
      if (this.st >= .2 && !this.landed) {
        this.landed = true; A.sfx.slap(); shake(9, .25); Hap.heavy();
        ring(this.cx, this.cy, INK, this.R * .33, this.R * .6, .35, 5);
        burst(this.cx, this.cy, 16, ['#fff', COLOR[this.labelCol].hex], 300, { g: 200 });
      }
      if (this.st > .7 && this.phase === 'slap') {
        this.phase = 'done'; RUN.label = this.labelObj();
        setHead('Joli disque !', `${ORDER.artist} — « ${ORDER.title} »`);
        setBottom(`<button class="btn" id="nx">Écouter ▶</button>`);
        onTap('#nx', () => go('listen'));
        A.sfx.win();
      }
    }
    if (this.phase === 'done') this.rot += dt * .7;
  },
  draw(g) {
    const { cx, cy, R } = this;
    drawFlash(g, cx, cy, R, RUN.flash, this.cut, RUN.edge);
    let lbl = null, ls = 1;
    if (this.phase === 'slap' || this.phase === 'done') {
      const k = clamp(this.st / .2, 0, 1);
      ls = this.st < .2 ? lerp(2.6, 1, E.in(k)) : 1 - Math.sin(clamp((this.st - .2) / .18, 0, 1) * Math.PI) * .08;
      lbl = this.labelObj();
    }
    drawDisc(g, cx, cy, R, { tex: RUN.disc, groove: RUN.groove, grooveAlpha: .5, fx: RUN.mat.fx, rot: this.rot, label: lbl, labelScale: ls, time: this.t });
    if (this.phase === 'trim') {
      g.save(); g.setLineDash([8, 10]); g.lineDashOffset = -this.t * 40; g.lineWidth = 3; g.strokeStyle = 'rgba(21,21,21,.45)';
      g.beginPath(); g.arc(cx, cy, R * 1.22, 0, TAU); g.stroke(); g.restore();
      const a = this.blade ? Math.atan2(this.blade[1] - cy, this.blade[0] - cx) : -Math.PI / 2 + Math.sin(this.t * 2) * .4;
      const bx = cx + Math.cos(a) * R * 1.12, by = cy + Math.sin(a) * R * 1.12;
      g.save(); g.translate(bx, by); g.rotate(this.t * (this.blade ? 20 : 3));
      g.fillStyle = '#e6eaef'; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? R * .085 : R * .11, aa = i / 16 * TAU; g.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff3b2f'; g.beginPath(); g.arc(0, 0, R * .035, 0, TAU); g.fill(); g.stroke();
      g.restore();
    }
    if (this.phase === 'label') {
      const k = (this.t * 1.3) % 1;
      g.save(); g.globalAlpha = .55; g.fillStyle = COLOR[this.labelCol].hex; g.beginPath(); g.arc(cx, cy, R * .33, 0, TAU); g.fill(); g.restore();
      g.setLineDash([7, 7]); g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.arc(cx, cy, R * .33, 0, TAU); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1 - k; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R * (.33 + k * .2), 0, TAU); g.stroke(); g.globalAlpha = 1;
    }
  },
};

// =====================================================================
// 5. ÉCOUTE — on pose le diamant, ta musique joue, résultats
// =====================================================================
Scenes.listen = {
  bg: '#F3EADB', step: 4,
  enter() {
    Object.assign(this, { rot: 0, spin: 0, armT: 0, phase: 'arm', sheetK: 0, sheetOn: false, rip: [], kicks: [], pulse: 0, t: 0, prog: 0, player: null, timers: [], revealedRare: false, sheetTop: 0 });
    this.res = finalizeRecord();
    setHead('« ' + ORDER.title + ' »', ORDER.artist + ' · ' + GENRES[ORDER.song.gid].name);
    setBottom(`<button class="btn ghost" id="skip">Voir le résultat</button>`);
    onTap('#skip', () => this.showResults());
  },
  exit() { if (this.player) this.player.stop(); A.crackle(false); this.timers.forEach(clearTimeout); },
  layout() { this.R0 = Math.min(W * .38, stage.h * .4); this.cy0 = stage.cy; this.place(); },
  place() {
    const k = E.io(this.sheetK), top = stage.top, st = this.sheetTop || H * .55;
    const R1 = Math.max(50, Math.min(W * .3, (st - top) * .36)), cy1 = top + (st - top) * .5;
    this.R = lerp(this.R0, R1, k); this.cy = lerp(this.cy0, cy1, k); this.cx = W / 2 - this.R * .12;
  },
  armGeo() { const R = this.R; return { px: this.cx + R * 1.02, py: this.cy - R * .98, L: R * 1.25 }; },
  angFor(rho) {
    const { px, py, L } = this.armGeo(); let lo = Math.PI * .5, hi = Math.PI * .75;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2, d = Math.hypot(px + Math.cos(m) * L - this.cx, py + Math.sin(m) * L - this.cy) / this.R; if (d > rho) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  armAngle() {
    const rest = Math.PI * .38;
    if (this.phase === 'arm') return lerp(rest, this.angFor(.95), E.io(clamp(this.armT, 0, 1)));
    return this.angFor(lerp(.94, .42, this.prog));
  },
  needlePos() { const { px, py, L } = this.armGeo(), a = this.armAngle(); return { x: px + Math.cos(a) * L, y: py + Math.sin(a) * L }; },
  startSong() {
    const s = ORDER.song; this.bar = 240 / s.bpm; this.t0 = A.now() + .35; this.dur = s.bars * this.bar;
    const hits = RUN.engrave.hits, mel = s.notes.filter((n, i) => hits[i] === '1');
    this.player = new Player(s, { t0: this.t0, out: A.vinyl(), melody: mel, onKick: t => this.kicks.push(t), onNote: (t, n) => this.rip.push({ t, deg: n.deg }) }).start();
  },
  update(dt) {
    this.t += dt;
    if (this.sheetOn && this.sheetK < 1) this.sheetK = Math.min(1, this.sheetK + dt * 2.5);
    this.place();
    this.spin = Math.min(1, this.spin + dt * .9);
    this.rot += dt * this.spin * TAU * .55;
    if (this.phase === 'arm') {
      this.armT += dt;
      if (this.armT >= 1) { this.phase = 'play'; A.sfx.needle(); A.crackle(true); Hap.med(); this.startSong(); }
    }
    if (this.player) {
      const heard = A.now() - A.lat();
      while (this.kicks.length && this.kicks[0] <= heard) { this.kicks.shift(); this.pulse = 1; }
      while (this.rip.length && this.rip[0].t <= heard) {
        const n = this.rip.shift(), p = this.needlePos(), c = NOTE_COL[n.deg % NOTE_COL.length];
        ring(p.x, p.y, c, 4, this.R * .3, .6, 5); burst(p.x, p.y, 4, c, 140, { g: 100, size: [2, 4] });
      }
      this.prog = clamp((A.now() - this.t0) / this.dur, 0, 1);
      if (!this.sheetOn && A.now() - this.t0 > Math.min(this.dur * .5, this.bar * 2.2)) this.showResults();
    }
    this.pulse = Math.max(0, this.pulse - dt * 5);
  },
  draw(g) {
    const R = this.R, z = 1 + this.pulse * .015, lw = Math.max(3, R * .022);
    g.fillStyle = INK; g.beginPath(); g.arc(this.cx, this.cy + R * .04, R * 1.07, 0, TAU); g.fill();
    drawDisc(g, this.cx, this.cy, R * z, { tex: RUN.disc, groove: RUN.groove, grooveAlpha: .5, fx: RUN.mat.fx, holo: this.revealedRare, rot: this.rot, label: RUN.label, time: this.t, shadow: false });
    const { px, py, L } = this.armGeo(), a = this.armAngle(), nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
    g.lineWidth = lw; g.strokeStyle = INK; g.lineCap = 'round';
    g.fillStyle = '#d6dbe1'; g.beginPath(); g.arc(px, py, R * .17, 0, TAU); g.fill(); g.stroke();
    g.lineWidth = R * .12; g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * R * .22, py - Math.sin(a) * R * .22); g.stroke();
    g.lineWidth = R * .07; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    g.lineWidth = R * .035; g.strokeStyle = '#eef1f4'; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    g.save(); g.translate(nx, ny); g.rotate(a);
    g.fillStyle = '#ff3b2f'; g.strokeStyle = INK; g.lineWidth = lw; rrect(g, -R * .16, -R * .065, R * .2, R * .13, R * .025); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = INK; g.beginPath(); g.arc(px, py, R * .07, 0, TAU); g.fill();
  },
  showResults() {
    if (this.sheetOn) return; this.sheetOn = true;
    setBottom('');
    const r = this.res, L = ORDER.level, pct = v => Math.round(v * 100) + '%';
    const ordTxt = `${r.styleOk ? '✓' : '✗'} ${STYLE_NAME[ORDER.style]}` + (ORDER.wantColor ? ` · ${r.colorOk ? '✓' : '✗'} ${COLOR[ORDER.wantColor].name}` : '');
    const card = openSheet(`<div class="res">
      <div class="stars">${[0, 1, 2].map(i => `<i class="star">${STAR}</i>`).join('')}</div>
      <div class="rows">
        <div class="row"><span>Gravure</span><b>${pct(r.e)}</b></div>
        <div class="row"><span>Presse</span><b>${RUN.press.lab.replace(' !', '')} · ${pct(r.p)}</b></div>
        <div class="row"><span>Commande</span><b>${ordTxt}</b></div>
      </div>
      ${r.rare ? '<div class="rarebn">✦ Variante rare : HOLO ✦</div>' : ''}
      ${ORDER.special ? '<div class="spec">Commande spéciale · pièces ×2</div>' : ''}
      <div class="gain"><i class="coin"></i><b id="gain">+0</b></div>
      <div class="goal" id="goal">${goalHTML()}</div>
      <div class="brow"><button class="btn ghost sq" id="hm">⌂</button><button class="btn" id="nx">Suivant · n°${L + 1}</button></div>
    </div>`, 'results', false);
    onTap('#hm', () => go('home'));
    onTap('#nx', () => { ORDER = makeOrder(S.level); RUN = {}; go('engrave'); });
    requestAnimationFrame(() => { this.sheetTop = H - card.offsetHeight; });
    const stars = card.querySelectorAll('.star'), T = (ms, f) => this.timers.push(setTimeout(f, ms));
    stars.forEach((s, i) => T(350 + i * 380, () => {
      s.classList.add('in'); if (i < r.stars) { s.classList.add('on'); A.sfx.star(i); Hap.med(); } else A.sfx.tick();
    }));
    const t1 = 350 + 3 * 380 + 100;
    T(t1, () => {
      const el = $('#gain'), t0 = performance.now(); let k = 0;
      const f = () => { const p = Math.min(1, (performance.now() - t0) / 900); el.textContent = '+' + Math.round(r.coins * E.out(p)); if (k++ % 3 === 0) A.sfx.coin(k / 3 | 0); if (p < 1) requestAnimationFrame(f); else { el.parentNode.classList.add('bump'); } };
      f(); setCoins(S.coins, true);
    });
    if (r.rare) T(t1 + 1100, () => { this.revealedRare = true; A.sfx.shimmer(); A.sfx.win(); Hap.heavy(); confetti(this.cx, this.cy, 40, ['#ff7eb6', '#5ec8ff', '#ffc928', '#b9ee3a', '#8b5cff']); card.querySelector('.rarebn').classList.add('on'); });
    if (r.stars === 3) T(t1 - 200, () => confetti(W / 2, H * .55, 36, ['#ffc928', '#ff3b2f', '#2f6bff', '#35d49a']));
    if (r.milestone) T(t1 + 1600, () => { toast(`Disque d'or n°${ORDER.level} ! +${r.milestone} pièces`, 2600); A.sfx.win(); confetti(W / 2, H * .3, 60, ['#e0aa2a', '#ffc928', '#fff']); });
    T(t1 + 1300, () => { const b = card.querySelector('.goal .bar i'); if (b) b.style.width = b.dataset.w; });
    if (rankOf(S.records.length).name !== rankOf(S.records.length - 1).name) T(t1 + 2100, () => { toast('Nouveau rang : ' + rankOf(S.records.length).name + ' !', 2600); A.sfx.win(); });
  },
};
const STAR = '<svg viewBox="0 0 48 48"><path d="M24 3l6.2 13.1 14.3 1.7-10.6 9.8 2.9 14.1L24 34.6l-12.8 7.1 2.9-14.1L3.5 17.8l14.3-1.7z"/></svg>';

function finalizeRecord() {
  const e = RUN.engrave.acc, p = RUN.press.q, styleOk = RUN.mat.mode === ORDER.style;
  const colorOk = !ORDER.wantColor || RUN.mat.used.includes(ORDER.wantColor);
  const ord = ORDER.wantColor ? (styleOk ? .6 : 0) + (colorOk ? .4 : 0) : (styleOk ? 1 : .3);
  const total = e * .5 + p * .3 + ord * .2, stars = total >= .86 ? 3 : total >= .66 ? 2 : 1;
  const rare = Math.random() < (stars === 3 ? .15 : .07);
  let coins = Math.round((30 + ORDER.level * 5) * [1, 1.6, 2.4][stars - 1] * (ORDER.special ? 2 : 1));
  if (rare) coins *= 2;
  const disc = { tex: RUN.disc, groove: RUN.groove, grooveAlpha: .5, fx: RUN.mat.fx, label: RUN.label, holo: rare, time: 1 };
  const rec = { id: Date.now(), n: S.records.length + 1, lvl: ORDER.level, seed: ORDER.seed, hits: RUN.engrave.hits, artist: ORDER.artist, title: ORDER.title, gid: ORDER.song.gid, bpm: ORDER.song.bpm, stars, style: RUN.mat.mode, rare, img: thumb(disc, 132) };
  S.records.push(rec);
  S.coins += coins; S.level = ORDER.level + 1; S.stats.stars += stars;
  let milestone = 0;
  if (ORDER.level % 10 === 0) { milestone = 250 + ORDER.level * 10; S.coins += milestone; }
  save(); saveLast(disc);
  return { e, p, styleOk, colorOk, stars, coins, rare, milestone, rec };
}
function saveLast(d) {
  try {
    const c = mkCanvas(256, 256), g = c.getContext('2d');
    g.drawImage(d.tex, 0, 0, 256, 256); g.globalAlpha = .5; g.drawImage(d.groove, 0, 0, 256, 256);
    localStorage.setItem('sillon.last', JSON.stringify({ img: c.toDataURL('image/jpeg', .85), label: d.label, fx: d.fx, holo: d.holo }));
  } catch (e) { }
}
function nextGoal() {
  const items = [
    ...COLORS.filter(c => !S.colors.includes(c.id)).map(c => ({ name: 'Vinyle ' + c.name, price: c.price })),
    ...LABELS.filter(c => !S.labels.includes(c.id)).map(c => ({ name: 'Étiquette ' + c.name, price: c.price })),
    ...FX.filter(f => !S.fx.includes(f.id)).map(f => ({ name: f.name, price: f.price })),
  ].sort((a, b) => a.price - b.price);
  return items[0] || null;
}
function goalHTML() {
  const n = nextGoal(); if (!n) return '<span>Tout l\'atelier est débloqué !</span>';
  const k = Math.min(1, S.coins / n.price);
  return `<span>${k >= 1 ? '<b>Disponible à l\'atelier :</b> ' : 'Prochain : '}${n.name}</span><div class="bar"><i data-w="${k * 100}%" style="width:0"></i></div><span class="gp">${Math.min(S.coins, n.price)}/${n.price}</span>`;
}
