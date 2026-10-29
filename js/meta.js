'use strict';
// ---------- accueil, bac, atelier, réglages, cadeau du jour ----------
function loadLast() {
  try {
    const d = JSON.parse(localStorage.getItem('sillon.last') || 'null'); if (!d) return null;
    const img = new Image(); img.src = d.img; d.tex = img; return d;
  } catch (e) { return null; }
}
function canBuySomething() { const n = nextGoal(); return n && S.coins >= n.price; }

Scenes.home = {
  bg: '#F3EADB', step: -1,
  enter() {
    ORDER = makeOrder(S.level); RUN = {};
    Object.assign(this, { rot: 0, vel: 1.1, t: 0, drag: null });
    this.last = loadLast();
    const n = S.records.length, rk = rankOf(n);
    setHead('Sillon', `${rk.name} · ${n} disque${n > 1 ? 's' : ''} pressé${n > 1 ? 's' : ''}`);
    setBottom(orderCard(ORDER) + `<button class="btn" id="play">Presser le n°${ORDER.level} ▶</button>
      <div class="brow"><button class="btn ghost sm" id="crate">Bac <small>${n}</small></button><button class="btn ghost sm" id="shop">Atelier${canBuySomething() ? '<i class="dot"></i>' : ''}</button><button class="btn ghost sm sq" id="set">⚙</button></div>`);
    onTap('#play', () => go('engrave'));
    onTap('#crate', openCrate); onTap('#shop', openShop); onTap('#set', openSettings);
    setCoins(S.coins);
    $('#streak').textContent = S.streak > 1 ? '🔥 ' + S.streak : '';
    if (S.lastDaily !== dayStr()) setTimeout(() => { if (sceneName === 'home' && !$('#sheet').classList.contains('on')) dailyGift(); }, 600);
  },
  exit() { if (this.scr) { this.scr.stop(); this.scr = null; } },
  layout() { this.R = Math.min(W * .4, stage.h * .44); this.cx = W / 2; this.cy = stage.cy; },
  down(x, y, e) {
    if (Math.hypot(x - this.cx, y - this.cy) > this.R) return;
    this.drag = { id: e.pointerId, a: Math.atan2(y - this.cy, x - this.cx), t: performance.now() };
    this.scr = A.loop('scratch'); this.vel = 0;
  },
  move(x, y, e) {
    const d = this.drag; if (!d || d.id !== e.pointerId) return;
    const a = Math.atan2(y - this.cy, x - this.cx), now = performance.now();
    let da = a - d.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    const dt = Math.max(.008, (now - d.t) / 1000);
    this.rot += da; this.vel = lerp(this.vel, da / dt, .5); d.a = a; d.t = now;
    const v = Math.abs(this.vel);
    this.scr && this.scr.set(clamp(v / 18, 0, 1) * .5, clamp(v / 25, 0, 1) * (this.vel > 0 ? 1 : .6));
  },
  up(x, y, e) {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    this.drag = null; if (this.scr) { this.scr.stop(); this.scr = null; }
    if (Math.abs(this.vel) > 8) { A.sfx.whoosh(); Hap.light(); }
  },
  update(dt) {
    this.t += dt;
    if (!this.drag) { this.vel = lerp(this.vel, 1.1, Math.min(1, dt * 1.4)); this.rot += this.vel * dt; }
  },
  draw(g) {
    const L = this.last, ok = L && L.tex.complete && L.tex.naturalWidth;
    g.fillStyle = INK; g.beginPath(); g.arc(this.cx, this.cy + this.R * .05, this.R * 1.06, 0, TAU); g.fill();
    drawDisc(g, this.cx, this.cy, this.R, {
      tex: ok ? L.tex : null, color: '#1c1c1f', rot: this.rot, time: this.t, shadow: false,
      fx: ok ? L.fx : [], holo: ok && L.holo,
      label: ok && L.label ? L.label : { hex: '#ff3b2f', top: 'Sillon', bottom: 'Presse à vinyles' },
    });
  },
};

function openCrate() {
  const recs = S.records.slice().reverse();
  const html = `<div class="shead"><h2>Mon bac</h2><button class="x" id="sx">✕</button></div>
    <div class="sstats"><span><b>${S.records.length}</b> disque${S.records.length > 1 ? "s" : ""}</span><span><b>${S.stats.stars}</b> ★</span><span><b>${S.records.filter(r => r.rare).length}</b> rares</span><span>combo <b>${S.stats.bestCombo}</b></span></div>
    <div class="scroll body">${recs.length ? `<div class="grid">${recs.map(r => `<button class="rec ${r.rare ? 'rare' : ''}" data-id="${r.id}">${r.img ? `<img src="${r.img}" alt="">` : '<div class="noimg"></div>'}<span>n°${r.n}</span><em>${'★'.repeat(r.stars)}</em></button>`).join('')}</div>` : '<p class="empty">Ton bac est vide.<br>Presse ton premier disque !</p>'}</div>`;
  const c = openSheet(html, 'full');
  onTap('#sx', closeSheet);
  c.querySelectorAll('.rec').forEach(b => onTap(b, () => openRecord(S.records.find(r => r.id == b.dataset.id))));
}
function openRecord(r) {
  let player = null;
  const stop = () => { if (player) { player.stop(); player = null; } A.crackle(false); const i = $('.big img'); i && i.classList.remove('spin'); const b = $('#rp'); if (b) b.textContent = '▶ Écouter'; };
  const html = `<div class="shead"><button class="x" id="bk">←</button><h2>n°${r.n}</h2><button class="x" id="sx">✕</button></div>
    <div class="scroll body"><div class="big ${r.rare ? 'rare' : ''}">${r.img ? `<img src="${r.img}" alt="">` : '<div class="noimg"></div>'}</div>
    <div class="rinfo"><b>« ${r.title} »</b><span>${r.artist}</span><span>${GENRES[r.gid].name} · ${r.bpm} BPM · ${STYLE_NAME[r.style]} · ${'★'.repeat(r.stars)}${r.rare ? ' · HOLO' : ''}</span></div>
    <button class="btn" id="rp">▶ Écouter</button></div>`;
  openSheet(html, 'full');
  sheetClose = stop;
  onTap('#sx', closeSheet); onTap('#bk', () => { stop(); sheetClose = null; openCrate(); });
  onTap('#rp', () => {
    if (player) { stop(); return; }
    A.unlock();
    const song = makeSong(r.lvl, r.seed), mel = song.notes.filter((n, i) => r.hits[i] === '1');
    A.crackle(true); A.sfx.needle();
    player = new Player(song, { t0: A.now() + .3, out: A.vinyl(), melody: mel, onEnd: stop }).start();
    $('.big img') && $('.big img').classList.add('spin'); $('#rp').textContent = '■ Stop';
  });
}

function openShop() {
  const owned = (k, id) => (k === 'color' ? S.colors : k === 'label' ? S.labels : S.fx).includes(id);
  const sec = (title, items, k) => `<h3>${title}</h3><div class="shop">${items.map(it => {
    const own = owned(k, it.id), poor = !own && S.coins < it.price;
    return `<button class="item ${own ? 'own' : ''} ${poor ? 'poor' : ''}" data-k="${k}" data-id="${it.id}">
      <i class="sw ${k}" style="--c:${it.hex || '#fff'}">${k === 'fx' ? it.icon : ''}</i><span>${it.name}</span><b>${own ? '✓' : `<i class="coin s"></i>${it.price}`}</b></button>`;
  }).join('')}</div>`;
  const render = () => {
    const html = `<div class="shead"><h2>Atelier</h2><span class="pill"><i class="coin"></i><b>${S.coins}</b></span><button class="x" id="sx">✕</button></div>
      <div class="scroll body">${sec('Couleurs de vinyle', COLORS, 'color')}${sec('Étiquettes', LABELS, 'label')}${sec('Effets', FX, 'fx')}<p class="note">Gagne des pièces en pressant des disques. 3★, commandes spéciales et variantes rares rapportent plus.</p></div>`;
    const prev = $('#sheet .body'), sc = prev ? prev.scrollTop : 0;
    const c = openSheet(html, 'full');
    c.querySelector('.body').scrollTop = sc;
    onTap('#sx', () => { closeSheet(); if (sceneName === 'home') go('home'); });
    c.querySelectorAll('.item').forEach(b => onTap(b, () => {
      const k = b.dataset.k, id = b.dataset.id;
      if (owned(k, id)) return;
      const it = (k === 'color' ? COLORS : k === 'label' ? LABELS : FX).find(x => x.id === id);
      if (S.coins < it.price) { A.sfx.no(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); toast(`Il te manque ${it.price - S.coins} pièces`); return; }
      S.coins -= it.price; (k === 'color' ? S.colors : k === 'label' ? S.labels : S.fx).push(id); save();
      A.sfx.buy(); Hap.med(); setCoins(S.coins); toast('Débloqué : ' + it.name + ' !');
      render();
    }));
  };
  render();
}

function openSettings() {
  const render = () => {
    const c = openSheet(`<div class="shead"><h2>Réglages</h2><button class="x" id="sx">✕</button></div>
      <div class="body"><button class="btn ghost tog" id="snd">Son : <b>${S.sound ? 'oui' : 'non'}</b></button>
      <button class="btn ghost tog" id="hap">Vibrations : <b>${S.haptic ? 'oui' : 'non'}</b></button>
      <p class="note">Astuce : dans Safari, Partager → « Sur l'écran d'accueil » pour jouer en plein écran.</p>
      <button class="btn ghost tog danger" id="rst">Tout recommencer</button></div>`);
    onTap('#sx', closeSheet);
    onTap('#snd', () => { S.sound = !S.sound; A.setOn(S.sound); save(); render(); });
    onTap('#hap', () => { S.haptic = !S.haptic; save(); Hap.med(); render(); });
    let armed = 0;
    onTap('#rst', () => {
      if (performance.now() - armed > 2500) { armed = performance.now(); toast('Tape encore pour tout effacer'); return; }
      localStorage.removeItem(SAVE); localStorage.removeItem('sillon.last'); location.reload();
    });
  };
  render();
}

function dailyGift() {
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streak = S.lastDaily === dayStr(y) ? S.streak + 1 : 1, reward = 40 + Math.min(streak, 10) * 20;
  const days = Array.from({ length: 7 }, (_, i) => `<i class="${i < ((streak - 1) % 7) + 1 ? 'on' : ''}">${i + 1}</i>`).join('');
  const c = openSheet(`<div class="gift"><h2>Cadeau du jour</h2><p>Série : <b>${streak} jour${streak > 1 ? 's' : ''}</b> 🔥 Reviens demain pour plus !</p>
    <button class="box" id="box"><i class="lid"></i><i class="bx"></i><i class="rib"></i></button>
    <p class="tapme" id="tm">Tape 3 fois pour ouvrir</p><div class="days">${days}</div>
    <button class="btn hidden" id="ok">Super !</button></div>`, 'mid', false);
  let taps = 0;
  onTap('#box', () => {
    const b = $('#box'); if (b.classList.contains('open')) return;
    taps++;
    if (taps < 3) { A.sfx.shake(); Hap.light(); b.classList.remove('wob'); void b.offsetWidth; b.classList.add('wob'); return; }
    b.classList.add('open'); A.sfx.gift(); Hap.heavy();
    const r = b.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 50, ['#ffc928', '#ff3b2f', '#2f6bff', '#35d49a', '#ff7eb6']);
    S.coins += reward; S.streak = streak; S.lastDaily = dayStr(); save();
    $('#tm').innerHTML = `<b class="big">+${reward}</b> pièces`; setCoins(S.coins, true);
    $('#ok').classList.remove('hidden');
    onTap('#ok', () => { closeSheet(); go('home'); });
  });
}

// ---------- démarrage ----------
resize();
go('home');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
