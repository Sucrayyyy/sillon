'use strict';
// ---------- maths & helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.random() * a.length | 0];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  elastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * TAU / 3) + 1,
};
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(h, k) {
  const [r, g, b] = hexRgb(h);
  return k < 0 ? rgbHex(r * (1 + k), g * (1 + k), b * (1 + k)) : rgbHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
}
function lum(h) { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function dayStr(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
const $ = s => document.querySelector(s);
function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const INK = '#151515', PAPER = '#fffaf2';
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ---------- catalogue ----------
const COLORS = [
  ['noir', 'Noir', '#1c1c1f', 0], ['blanc', 'Blanc', '#f6f2ea', 0], ['rouge', 'Rouge', '#ff3b2f', 0],
  ['jaune', 'Jaune', '#ffc928', 0], ['bleu', 'Bleu', '#2f6bff', 0],
  ['rose', 'Rose', '#ff7eb6', 100], ['menthe', 'Menthe', '#35d49a', 150], ['orange', 'Orange', '#ff8a1f', 200],
  ['violet', 'Violet', '#8b5cff', 260], ['ciel', 'Ciel', '#5ec8ff', 320], ['lime', 'Lime', '#b9ee3a', 380],
  ['bordeaux', 'Bordeaux', '#8e1b3a', 450], ['creme', 'Crème', '#f1d9a7', 520], ['corail', 'Corail', '#ff6f61', 600],
  ['sapin', 'Sapin', '#1f7a4d', 680], ['nuit', 'Nuit', '#1b2a5c', 760], ['or', 'Or', '#e0aa2a', 900], ['argent', 'Argent', '#c7ccd4', 1000],
].map(([id, name, hex, price]) => ({ id, name, hex, price }));
const COLOR = Object.fromEntries(COLORS.map(c => [c.id, c]));
const LABELS = [['blanc', 0], ['rouge', 0], ['jaune', 0], ['bleu', 0], ['noir', 0], ['rose', 120], ['menthe', 160], ['orange', 200], ['violet', 260], ['ciel', 320], ['or', 500]]
  .map(([id, price]) => ({ id, price, hex: COLOR[id].hex, name: COLOR[id].name }));
const FX = [
  { id: 'paillettes', name: 'Paillettes', icon: '✦', price: 700 },
  { id: 'nacre', name: 'Nacré', icon: '◐', price: 1200 },
];
const RANKS = [[0, 'Apprenti·e'], [3, 'Presseur·se'], [10, 'Graveur·se'], [25, 'Artisan·e du sillon'], [50, 'Maître presseur'], [100, 'Légende du vinyle'], [200, 'Mythe analogique']];
function rankOf(n) { let r = RANKS[0], nx = null; for (let i = 0; i < RANKS.length; i++) { if (n >= RANKS[i][0]) { r = RANKS[i]; nx = RANKS[i + 1] || null; } } return { name: r[1], next: nx }; }

// ---------- sauvegarde ----------
const SAVE = 'sillon.v1';
const DEF = {
  level: 1, coins: 0, records: [], colors: ['noir', 'blanc', 'rouge', 'jaune', 'bleu'], labels: ['blanc', 'rouge', 'jaune', 'bleu', 'noir'], fx: [],
  streak: 0, lastDaily: '', sound: true, haptic: true, stats: { perfect: 0, notes: 0, bestCombo: 0, stars: 0 },
};
let S;
try { S = Object.assign(JSON.parse(JSON.stringify(DEF)), JSON.parse(localStorage.getItem(SAVE) || '{}')); }
catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
function save() {
  for (let i = 0; i < 4; i++) {
    try { localStorage.setItem(SAVE, JSON.stringify(S)); return; }
    catch (e) { // quota : on allège les plus vieilles vignettes
      let n = 0; for (const r of S.records) { if (r.img && n < 25) { r.img = null; n++; } }
      if (!n) return;
    }
  }
}

// ---------- vibrations ----------
const Hap = (() => {
  let lbl = null, last = 0;
  function ios() {
    if (!lbl) {
      lbl = document.createElement('label');
      lbl.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', '');
      lbl.appendChild(i); document.body.appendChild(lbl);
    }
    lbl.click();
  }
  function buzz(ms, gap = 40) {
    if (!S.haptic) return;
    const now = performance.now(); if (now - last < gap) return; last = now;
    try { if (navigator.vibrate) navigator.vibrate(ms); else ios(); } catch (e) { }
  }
  return { light: () => buzz(8, 45), med: () => buzz(18, 60), heavy: () => buzz(35, 80) };
})();
