'use strict';
// ---------- cœur : canvas, boucle, entrées, effets, interface ----------
const cv = $('#c'), g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const stage = { top: 0, bottom: 0, cx: 0, cy: 0, h: 0 };
let scene = null, sceneName = '', ORDER = null, RUN = {};
const Scenes = {};
const STEP_NAMES = ['Gravure', 'Galette', 'Presse', 'Finition', 'Écoute'];

function resize() {
  DPR = Math.min(2.5, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR | 0; cv.height = H * DPR | 0;
  layout();
}
function layout() {
  const hb = $('#head').getBoundingClientRect(), bb = $('#bottom').getBoundingClientRect();
  stage.top = hb.bottom + 6; stage.bottom = (bb.height > 0 ? bb.top : H) - 10;
  stage.h = Math.max(120, stage.bottom - stage.top); stage.cx = W / 2; stage.cy = stage.top + stage.h / 2;
  if (scene && scene.layout) scene.layout();
}
function relayout() { requestAnimationFrame(() => layout()); }
addEventListener('resize', resize);

function setHead(t, hint) {
  const ti = $('#title'), hi = $('#hint');
  if (ti.textContent !== t) { ti.textContent = t; ti.classList.remove('pop'); void ti.offsetWidth; ti.classList.add('pop'); }
  hi.textContent = hint || '';
}
function setBottom(html) { $('#bottom').innerHTML = html; relayout(); }
function onTap(sel, fn) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return el; }
function renderSteps(step) {
  const el = $('#steps');
  if (step < 0) { el.innerHTML = ''; el.classList.add('off'); return; }
  el.classList.remove('off');
  el.innerHTML = `<button class="quit" id="quit">✕</button>` + STEP_NAMES.map((n, i) => `<i class="${i < step ? 'done' : i === step ? 'cur' : ''}">${i === step ? n : ''}</i>`).join('');
  let armed = 0;
  onTap('#quit', () => {
    if (performance.now() - armed < 2200) { go('home'); return; }
    armed = performance.now(); toast('Tape encore ✕ pour abandonner ce disque');
  });
}
function setCoins(v, anim) {
  const el = $('#coinN');
  if (!anim) { el.textContent = v; return; }
  const from = parseInt(el.textContent) || 0, t0 = performance.now(), d = 900;
  let k = 0;
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / d), val = Math.round(lerp(from, v, E.out(p)));
    el.textContent = val;
    if (p < 1) { if (k++ % 3 === 0) A.sfx.coin(k / 3 | 0); requestAnimationFrame(step); }
    else { $('#coins').classList.remove('bump'); void el.offsetWidth; $('#coins').classList.add('bump'); }
  };
  step();
}
let toastT = 0;
function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
function openSheet(html, cls = '', closable = true) {
  const s = $('#sheet');
  s.className = 'sheet ' + cls;
  s.innerHTML = `<div class="back"></div><div class="sheetc">${html}</div>`;
  void s.offsetWidth; s.classList.add('on');
  if (closable) s.querySelector('.back').addEventListener('click', () => closeSheet());
  return s.querySelector('.sheetc');
}
let sheetClose = null;
function closeSheet() {
  const s = $('#sheet'); s.classList.remove('on');
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  setTimeout(() => { if (!s.classList.contains('on')) { s.innerHTML = ''; s.className = 'sheet hidden'; } }, 320);
}

function go(name) {
  if (scene && scene.exit) scene.exit();
  closeSheet();
  sceneName = name; scene = Scenes[name];
  document.body.style.backgroundColor = scene.bg; window.CURBG = scene.bg;
  document.body.dataset.scene = name;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = scene.bg;
  P.length = 0; TXT.length = 0; fadeT = 1;
  renderSteps(scene.step);
  scene.enter();
  layout(); relayout();
}

// ---------- particules & textes ----------
const P = [], TXT = [];
let shakeA = 0, shakeT = 0, fadeT = 0;
function shake(a = 6, t = .25) { shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, t); }
function part(o) { P.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: .6, t: 0, size: 4, color: INK, type: 'dot', rot: 0, vr: 0, drag: 0 }, o)); }
function burst(x, y, n, col, sp = 260, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(.3, 1) * sp, sz = o.size ? rand(o.size[0], o.size[1]) : rand(3, 7);
    part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: o.g ?? 500, life: rand(.35, .75), size: sz, color: Array.isArray(col) ? pick(col) : col, drag: o.drag || 1.5, type: o.type || 'dot' });
  }
}
function ring(x, y, col, r0 = 8, r1 = 40, life = .4, w = 4) { part({ type: 'ring', x, y, r0, r1, life, color: col, w }); }
function confetti(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * .9, -Math.PI * .1), s = rand(300, 700);
    part({ type: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, drag: 2.2, life: rand(1, 1.8), size: rand(6, 11), color: pick(cols), rot: rand(0, TAU), vr: rand(-14, 14) });
  }
}
function popText(s, x, y, o = {}) { TXT.push({ s, x, y, t: 0, life: o.life || .8, size: o.size || 28, color: o.color || INK, vy: o.vy ?? -60 }); }
function updFx(dt) {
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt;
    if (p.t >= p.life) { P.splice(i, 1); continue; }
    const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vy *= dr; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  for (let i = TXT.length - 1; i >= 0; i--) { const t = TXT[i]; t.t += dt; t.y += t.vy * dt; if (t.t >= t.life) TXT.splice(i, 1); }
}
function drawFx(g) {
  for (const p of P) {
    const k = p.t / p.life;
    g.globalAlpha = 1 - k * k;
    if (p.type === 'dot') { g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * (1 - k * .5), 0, TAU); g.fill(); }
    else if (p.type === 'ring') { g.strokeStyle = p.color; g.lineWidth = Math.max(.5, p.w * (1 - k)); g.beginPath(); g.arc(p.x, p.y, lerp(p.r0, p.r1, E.out(k)), 0, TAU); g.stroke(); }
    else if (p.type === 'puff') { g.globalAlpha = (1 - k) * .9; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + k * 1.8), 0, TAU); g.fill(); }
    else if (p.type === 'conf') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.t * 9 + p.size)); g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66); g.restore(); }
    else if (p.type === 'strip') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 1.3);
      g.strokeStyle = INK; g.lineWidth = p.size * .55; g.stroke(); g.strokeStyle = p.color; g.lineWidth = p.size * .3; g.stroke();
      g.restore();
    } else if (p.type === 'spark') {
      const s = p.size * (1 - k); g.fillStyle = p.color; g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .35 : s; const a = i / 8 * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore();
    }
  }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const t of TXT) {
    const sc = t.t < .14 ? E.back(t.t / .14) : 1, a = 1 - Math.max(0, (t.t - t.life * .6) / (t.life * .4));
    g.globalAlpha = clamp(a, 0, 1);
    g.save(); g.translate(t.x, t.y); g.scale(sc, sc);
    g.font = `900 ${t.size}px ${FONT}`;
    g.lineWidth = Math.max(4, t.size * .2); g.strokeStyle = t.color === INK ? PAPER : INK; g.strokeText(t.s, 0, 0);
    g.fillStyle = t.color; g.fillText(t.s, 0, 0);
    g.restore();
  }
  g.globalAlpha = 1;
}

// ---------- boucle ----------
let lastF = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - lastF) / 1000); lastF = now;
  try {
    if (scene && scene.update) scene.update(dt);
    updFx(dt);
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    if (shakeT > 0) { shakeT -= dt; const k = shakeA * Math.min(1, shakeT * 6); g.translate(rand(-k, k), rand(-k, k)); if (shakeT <= 0) shakeA = 0; }
    if (scene && scene.draw) scene.draw(g);
    drawFx(g);
    if (fadeT > 0) { fadeT = Math.max(0, fadeT - dt * 4); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = fadeT; g.fillStyle = window.CURBG; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

// ---------- entrées ----------
cv.addEventListener('pointerdown', e => { A.unlock(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { } scene && scene.down && scene.down(e.clientX, e.clientY, e); });
cv.addEventListener('pointermove', e => { e.preventDefault(); scene && scene.move && scene.move(e.clientX, e.clientY, e); });
const upH = e => { scene && scene.up && scene.up(e.clientX, e.clientY, e); };
cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', upH);
document.addEventListener('pointerdown', e => {
  A.unlock();
  const b = e.target.closest && e.target.closest('button');
  if (b && !b.disabled && !b.classList.contains('hold')) { A.sfx.click(); Hap.light(); }
}, true);
document.addEventListener('touchend', () => A.unlock(), { passive: true });
document.addEventListener('touchstart', () => { }, { passive: true });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.scroll, .chips')) e.preventDefault(); }, { passive: false });
