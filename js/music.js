'use strict';
// Musique procédurale : chaque commande a son propre morceau.
const GENRES = {
  lofi: { name: 'Lo-fi', bpm: [76, 84], swing: .16, minor: true, lead: 'soft', drum: 'boom', chord: 'keys', bass: 'lofi' },
  hiphop: { name: 'Hip-hop', bpm: [84, 92], swing: .12, minor: true, lead: 'bell', drum: 'boom', chord: 'keys', bass: 'lofi' },
  funk: { name: 'Funk', bpm: [94, 102], swing: .06, minor: false, lead: 'bell', drum: 'funk', chord: 'stab', bass: 'funk' },
  synth: { name: 'Synthwave', bpm: [96, 106], swing: 0, minor: true, lead: 'saw', drum: 'synth', chord: 'pad', bass: 'drive' },
  disco: { name: 'Disco', bpm: [106, 114], swing: 0, minor: false, lead: 'bright', drum: 'disco', chord: 'keys', bass: 'octave' },
  house: { name: 'House', bpm: [116, 122], swing: 0, minor: true, lead: 'bright', drum: 'four', chord: 'stab', bass: 'off' },
};
const DRUMS = {
  boom: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '................' },
  four: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
  disco: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' },
  funk: { k: 'x..x..x...x..x..', s: '....x..x.x..x...', h: 'xxxxxxxxxxxxxxxx', o: '................' },
  synth: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '................' },
};
const BASS = { lofi: 'x.....x...x.....', off: '..x...x...x...x.', octave: 'xoxoxoxoxoxoxoxo', funk: 'x..o..x.x..o.x..', drive: 'x.x.x.x.x.x.x.x.' };
const PROG = { minor: [[0, 8, 3, 10], [0, 5, 8, 7], [0, 10, 8, 10], [0, 3, 8, 7]], major: [[0, 7, 9, 5], [0, 5, 9, 7], [0, 9, 5, 7], [0, 5, 0, 7]] };
function chordTones(root, deg, minor) {
  const q = minor ? ({ 0: 'm', 3: 'M', 5: 'm', 7: 'm', 8: 'M', 10: 'M' })[deg] : ({ 0: 'M', 2: 'm', 4: 'm', 5: 'M', 7: 'M', 9: 'm' })[deg];
  const r = root + deg;
  return q === 'm' ? [r, r + 3, r + 7] : [r, r + 4, r + 7];
}

function makeSong(level, seed) {
  const R = rng(seed);
  const ids = Object.keys(GENRES);
  // les premiers niveaux restent lents, puis on ouvre tout
  const pool = level <= 2 ? ['lofi'] : level <= 5 ? ids.slice(0, 4) : ids;
  const gid = pool[Math.floor(R() * pool.length)];
  const G = GENRES[gid];
  const bpm = Math.round(lerp(G.bpm[0], G.bpm[1], R()) + Math.min(level, 40) * .2);
  const root = 45 + Math.floor(R() * 8);
  const minor = G.minor;
  const prog = PROG[minor ? 'minor' : 'major'][Math.floor(R() * 4)];
  const bars = level <= 3 ? 8 : level <= 12 ? 10 : 12;
  const diff = clamp((level - 1) / 30, 0, 1);
  const pOn = lerp(.5, .9, diff), pOff = level <= 2 ? .04 : lerp(.12, .5, diff);
  const p16 = level >= 10 ? lerp(0, .2, diff) : 0, pHold = level >= 4 ? lerp(.14, .26, diff) : 0;

  let deg = 2 + Math.floor(R() * 3);
  function phrase() {
    let ev = [];
    for (let tries = 0; tries < 6; tries++) {
      ev = []; let i = 0;
      while (i < 16) {
        const on = i % 2 === 0;
        if (R() < (on ? pOn : pOff)) {
          let dur = 0;
          if (pHold && R() < pHold && i < 13) dur = R() < .5 ? 2 : 3;
          deg = clamp(deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)], 0, 9);
          ev.push({ b: i * .5, d: dur * .5, deg, hold: dur > 0 });
          if (!dur && p16 && i < 15 && R() < p16) {
            ev.push({ b: i * .5 + .25, d: 0, deg: clamp(deg + 1, 0, 9), hold: false });
          }
          i += dur ? dur + 1 : 1;
        } else i++;
      }
      if (ev.length >= 3) break;
    }
    return ev;
  }
  const vary = p => p.map((n, i) => i >= p.length - 2 ? { ...n, deg: clamp(n.deg + (R() < .5 ? -1 : 1), 0, 9) } : { ...n });
  const A1 = phrase(), B1 = phrase(), C1 = phrase();
  const form = [A1, vary(A1), B1, A1, C1, vary(B1)].slice(0, bars / 2);
  const scale = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const lead0 = root + 24;
  const notes = [];
  form.forEach((ph, k) => ph.forEach(n => {
    const m = lead0 + scale[n.deg % 5] + 12 * Math.floor(n.deg / 5);
    notes.push({ b: n.b + k * 8, d: n.d, deg: n.deg, m, hold: n.hold });
  }));
  notes.sort((a, b) => a.b - b.b);
  return { gid, bpm, root, minor, prog, bars, notes, swing: G.swing, lead: G.lead, seed };
}

class Player {
  constructor(song, o) {
    this.s = song; this.o = o; this.out = o.out; this.t0 = o.t0;
    this.spb = 60 / song.bpm; this.s16 = this.spb / 4; this.total = song.bars * 16; this.step = 0;
    this.G = GENRES[song.gid]; this.D = DRUMS[this.G.drum]; this.B = BASS[this.G.bass];
    this.mel = new Map();
    for (const n of (o.melody || [])) { const st = Math.round(n.b * 4); if (!this.mel.has(st)) this.mel.set(st, []); this.mel.get(st).push(n); }
  }
  start() { this.timer = setInterval(() => this.tick(), 25); this.tick(); return this; }
  stop() { clearInterval(this.timer); this.timer = null; this.dead = true; }
  tick() {
    if (this.dead) return;
    const lim = A.now() + .16;
    while (this.step < this.total) {
      const t = this.t0 + this.step * this.s16;
      if (t > lim) break;
      this.play(this.step, t); this.step++;
    }
    if (this.step >= this.total && !this.ended) {
      this.ended = true;
      const tend = this.t0 + this.total * this.s16;
      this.outro(tend);
      setTimeout(() => { clearInterval(this.timer); if (!this.dead && this.o.onEnd) this.o.onEnd(); }, Math.max(0, (tend - A.now()) * 1000) + 900);
    }
  }
  play(step, t) {
    const i = step % 16, bar = step / 16 | 0, out = this.out, ins = A.ins, s = this.s, G = this.G, D = this.D;
    const tt = t + ((i % 2) ? s.swing * this.s16 : 0);
    if (D.k[i] === 'x') { ins.kick(tt, out); this.o.onKick && this.o.onKick(tt); }
    if (D.s[i] === 'x') (G.drum === 'four' ? ins.clap : ins.snare)(tt, out);
    if (D.h[i] === 'x') ins.hat(tt, out, false);
    if (D.o[i] === 'x') ins.hat(tt, out, true);
    if (bar % 4 === 3 && i >= 13 && G.drum !== 'four') ins.snare(tt, out);
    if (step === 0) ins.crash(tt, out);
    const deg = s.prog[bar % 4];
    const ch = chordTones(s.root + 12, deg, s.minor).map(mtof);
    const bc = this.B[i];
    if (bc === 'x' || bc === 'o') ins.bass(tt, mtof(s.root + deg - 12 + (bc === 'o' ? 12 : 0)), this.s16 * (G.bass === 'lofi' ? 5 : 1.6), out);
    if (G.chord === 'keys' && (i === 0 || (G.drum === 'disco' && i === 8))) ins.keys(tt, ch, this.spb * (i === 0 && G.drum !== 'disco' ? 3.6 : 1.8), out);
    if (G.chord === 'stab' && (G.drum === 'four' ? [2, 6, 10, 14] : [0, 6, 10]).includes(i)) ins.stab(tt, ch, .2, out);
    if (G.chord === 'pad' && i === 0) ins.pad(tt, ch, this.spb * 4, out);
    const ms = this.mel.get(step);
    if (ms) for (const n of ms) {
      A.lead(tt, mtof(n.m), n.d ? n.d * this.spb : this.spb * .4, out, s.lead);
      this.o.onNote && this.o.onNote(tt, n);
    }
  }
  outro(t) {
    const s = this.s;
    A.ins.kick(t, this.out); A.ins.crash(t, this.out);
    A.ins.keys(t, chordTones(s.root + 12, s.prog[0], s.minor).concat([s.root + 24]).map(mtof), 2.2, this.out);
    A.ins.bass(t, mtof(s.root - 12), 1.2, this.out);
  }
}

// ---------- noms d'artistes & titres ----------
const NAME_A = ['Les', 'Club', 'Duo', 'Orchestre', 'Collectif', 'Madame', 'Monsieur', 'DJ', 'Studio', 'Néon', 'Velours', 'Capitaine', 'Docteur', 'Petit', 'Grand'];
const NAME_B = ['Comètes', 'Chats Bleus', 'Lunes Molles', 'Kiwi', 'Bruits Doux', 'Cassette', 'Pamplemousse', 'Satellites', 'Miel Noir', 'Ronds de Fumée', 'Sardines', 'Flamants', 'Cerise', 'Boréal', 'Panache', 'Mirabelle', 'Saphir', 'Chewing-gum', 'Tempête', 'Babouche'];
const TITLES = ['Sillon Rouge', 'Face B', 'Minuit Pile', 'Vague à l\'Âme', 'Plage Arrière', 'Disque Rayé', 'Chaleur Douce', 'Avenue 33', 'Tour de Platine', 'Microsillon', 'Rond-Point', 'Velours Côtelé', 'Néon Rose', 'Café Crème', 'Été Indien', 'Dernier Métro', 'Lune de Miel', 'Coup de Foudre', 'Grand Huit', 'Soleil Vert', 'Bleu Nuit', 'Poids Plume', 'Bain de Minuit', 'Super 45', 'Fièvre Douce', 'Haute Fidélité', 'Rose des Vents', 'Coeur d\'Artichaut', 'Ciel de Lit', 'Bonbon Acidulé'];

function makeOrder(level) {
  const seed = (Math.imul(level, 2654435761) ^ 0x5f3759df) >>> 0;
  const R = rng(seed + 7);
  const song = makeSong(level, seed);
  const styles = ['points', 'liquide', 'uni'];
  const style = level <= 3 ? styles[level - 1] : styles[Math.floor(R() * 3)];
  const a = NAME_A[Math.floor(R() * NAME_A.length)], b = NAME_B[Math.floor(R() * NAME_B.length)];
  const artist = (a === 'Les' && !/s$/.test(b)) ? 'Club ' + b : a + ' ' + b;
  const title = TITLES[Math.floor(R() * TITLES.length)];
  const owned = S.colors.filter(c => c !== 'noir');
  const wantColor = level >= 3 && R() < .65 ? owned[Math.floor(R() * owned.length)] : null;
  return { level, seed, song, style, artist, title, wantColor, special: level % 5 === 0 };
}
const STYLE_NAME = { uni: 'Uni', points: 'Points', liquide: 'Liquide' };
