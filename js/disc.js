'use strict';
// Rendu des disques : matière, sillons, reflets, étiquette.
const TEX = 512;
let RINGS = null, GLITTER = null;
function rings() {
  if (RINGS) return RINGS;
  const c = mkCanvas(TEX, TEX), g = c.getContext('2d'); g.translate(256, 256);
  for (let r = 92; r < 251; r += 2.1) {
    if ((r > 140 && r < 145) || (r > 192 && r < 197)) continue;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.strokeStyle = `rgba(0,0,0,${.08 + Math.random() * .1})`; g.lineWidth = 1; g.stroke();
  }
  for (let r = 93; r < 251; r += 4.3) {
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.strokeStyle = `rgba(255,255,255,${.025 + Math.random() * .03})`; g.lineWidth = .8; g.stroke();
  }
  g.beginPath(); g.arc(0, 0, 252, 0, TAU); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.07)'; g.stroke();
  g.beginPath(); g.arc(0, 0, 89, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.16)'; g.stroke();
  return RINGS = c;
}
function glitterPts() {
  if (GLITTER) return GLITTER;
  GLITTER = [];
  for (let i = 0; i < 150; i++) GLITTER.push({ r: Math.sqrt(rand(.13, .96)), a: rand(0, TAU), s: rand(.6, 1.4), p: rand(0, TAU) });
  return GLITTER;
}
function conic(g, a0, stops) {
  if (!g.createConicGradient) return null;
  const cg = g.createConicGradient(a0, 0, 0);
  for (const [o, c] of stops) cg.addColorStop(o, c);
  return cg;
}
function shine(g, R, k = 1) {
  const w = `rgba(255,255,255,${.24 * k})`, w2 = `rgba(255,255,255,${.15 * k})`, z = 'rgba(255,255,255,0)';
  const cg = conic(g, -Math.PI * .75, [[0, z], [.05, w], [.11, z], [.5, z], [.55, w2], [.61, z], [1, z]]);
  if (cg) { g.fillStyle = cg; g.fillRect(-R, -R, 2 * R, 2 * R); return; }
  g.fillStyle = `rgba(255,255,255,${.1 * k})`;
  for (const a of [-Math.PI * .6, Math.PI * .4]) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a - .2, a + .2); g.closePath(); g.fill(); }
}
function rainbow(g, R, a0, alpha, mode) {
  const st = []; const hues = [0, 50, 120, 190, 260, 320, 360];
  hues.forEach((h, i) => st.push([i / (hues.length - 1), `hsla(${h},100%,65%,${alpha})`]));
  const cg = conic(g, a0, st); if (!cg) return;
  g.save(); g.globalCompositeOperation = mode; g.fillStyle = cg; g.fillRect(-R, -R, 2 * R, 2 * R); g.restore();
}

// o : tex, groove, grooveAlpha, rot, label {hex, top, bottom}, labelScale, fx [], holo, shine, rings, shadow, time
function drawDisc(g, x, y, R, o = {}) {
  const rot = o.rot || 0, time = o.time || 0;
  g.save(); g.translate(x, y);
  if (o.shadow !== false) { g.fillStyle = 'rgba(21,21,21,.14)'; g.beginPath(); g.arc(0, R * .07, R, 0, TAU); g.fill(); }
  g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
  g.rotate(rot);
  if (o.tex) g.drawImage(o.tex, -R, -R, 2 * R, 2 * R); else { g.fillStyle = o.color || '#1c1c1f'; g.fillRect(-R, -R, 2 * R, 2 * R); }
  if (o.rings !== false) g.drawImage(rings(), -R, -R, 2 * R, 2 * R);
  if (o.groove) { g.globalAlpha = o.grooveAlpha ?? 1; g.drawImage(o.groove, -R, -R, 2 * R, 2 * R); g.globalAlpha = 1; }
  const fx = o.fx || [];
  if (fx.includes('paillettes')) {
    g.globalCompositeOperation = 'lighter';
    for (const p of glitterPts()) {
      const sa = p.a + rot; // angle écran
      const tw = Math.pow(Math.max(0, Math.sin(time * 3 + p.p)), 6) * .7 + Math.pow(Math.max(0, Math.cos(sa + Math.PI * .75)), 24) * .9;
      if (tw < .05) continue;
      const px = Math.cos(p.a) * p.r * R, py = Math.sin(p.a) * p.r * R, s = R * .012 * p.s * (0.6 + tw);
      g.fillStyle = `rgba(255,255,240,${Math.min(1, tw)})`;
      g.beginPath(); g.moveTo(px, py - s * 2); g.lineTo(px + s * .5, py); g.lineTo(px, py + s * 2); g.lineTo(px - s * .5, py); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(px - s * 2, py); g.lineTo(px, py + s * .5); g.lineTo(px + s * 2, py); g.lineTo(px, py - s * .5); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.rotate(-rot);
  if (fx.includes('nacre')) rainbow(g, R, -rot * .4 + time * .2, .38, 'soft-light');
  if (o.holo) { rainbow(g, R, time * .9, .42, 'screen'); rainbow(g, R, -time * .6 + 1, .25, 'overlay'); }
  if (o.shine !== false) shine(g, R, o.holo ? 1.4 : 1);
  g.restore();
  g.lineWidth = Math.max(3, R * .022); g.strokeStyle = INK;
  g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  if (o.label) drawLabel(g, R * .33 * (o.labelScale || 1), o.label, rot);
  if (o.hole !== false) {
    g.fillStyle = o.holeColor || window.CURBG || '#F3EADB';
    g.beginPath(); g.arc(0, 0, Math.max(3, R * .035), 0, TAU); g.fill();
    g.lineWidth = Math.max(2, R * .012); g.strokeStyle = INK; g.stroke();
  }
  g.restore();
}
function drawLabel(g, lr, L, rot) {
  g.save(); g.rotate(rot);
  g.fillStyle = L.hex; g.beginPath(); g.arc(0, 0, lr, 0, TAU); g.fill();
  g.lineWidth = Math.max(2, lr * .05); g.strokeStyle = INK; g.stroke();
  const tc = lum(L.hex) > .55 ? INK : '#fff';
  g.strokeStyle = tc; g.globalAlpha = .35; g.lineWidth = Math.max(1, lr * .02);
  g.beginPath(); g.arc(0, 0, lr * .82, 0, TAU); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = tc; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (txt, size, w, y, wt) => {
    g.font = `${wt} ${size}px ${FONT}`;
    const m = g.measureText(txt).width; if (m > w) g.font = `${wt} ${size * w / m}px ${FONT}`;
    g.fillText(txt, 0, y);
  };
  if (L.top) fit(L.top.toUpperCase(), lr * .2, lr * 1.35, -lr * .4, 900);
  if (L.bottom) fit(L.bottom, lr * .16, lr * 1.3, lr * .42, 800);
  g.font = `800 ${lr * .12}px ${FONT}`; g.globalAlpha = .7;
  g.fillText('33⅓', -lr * .62, 0); g.fillText(L.side || 'A', lr * .62, 0); g.globalAlpha = 1;
  g.restore();
}

// Pressage : la matière tourbillonne un peu vers l'extérieur
function swirlTex(src, k) {
  const n = TEX, c = n / 2;
  const sd = src.getContext('2d').getImageData(0, 0, n, n).data;
  const out = mkCanvas(n, n), og = out.getContext('2d'), img = og.createImageData(n, n), od = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - c + .5, dy = y - c + .5, r = Math.sqrt(dx * dx + dy * dy) / c;
    const o = (y * n + x) * 4;
    if (r > 1.02) continue;
    const a = Math.atan2(dy, dx) + k * Math.sin(Math.min(r, 1) * Math.PI) * .9;
    const rs = Math.pow(Math.min(r, 1), 1.12) * c;
    const sx = clamp((c + Math.cos(a) * rs) | 0, 0, n - 1), sy = clamp((c + Math.sin(a) * rs) | 0, 0, n - 1);
    const i = (sy * n + sx) * 4;
    od[o] = sd[i]; od[o + 1] = sd[i + 1]; od[o + 2] = sd[i + 2]; od[o + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}
function avgColor(src) {
  const s = mkCanvas(16, 16), g = s.getContext('2d'); g.drawImage(src, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0, n = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (Math.hypot(x - 7.5, y - 7.5) > 7) continue;
    const i = (y * 16 + x) * 4; if (d[i + 3] < 128) continue;
    r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
  }
  return n ? rgbHex(r / n, gg / n, b / n) : '#1c1c1f';
}
function copyCanvas(src, w = src.width, h = src.height) { const c = mkCanvas(w, h); c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }
// Vignette JPEG pour le bac (fond crème)
function thumb(d, size = 120, bg = '#F3EADB') {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  drawDisc(g, size / 2, size / 2, size * .46, { ...d, shadow: false, holeColor: bg, rot: .3 });
  return c.toDataURL('image/jpeg', .82);
}
