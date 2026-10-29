'use strict';
// Tout le son est synthétisé en direct (Web Audio), aucun fichier.
const A = (() => {
  let ctx = null, master, comp, sfxBus, musBus, vinylIn, verbIn, noiseBuf, crackBuf, unlocked = false;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = .002; comp.release.value = .12;
    master = ctx.createGain(); master.gain.value = S.sound ? 1 : 0;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .9; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = .72; musBus.connect(master);
    // chaîne « vinyle » : un peu plus chaude et étroite
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 50;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200; lp.Q.value = .4;
    vinylIn = ctx.createGain(); vinylIn.connect(hp); hp.connect(lp); lp.connect(musBus);
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.2, 2.8);
    const wet = ctx.createGain(); wet.gain.value = .3; conv.connect(wet); wet.connect(master);
    verbIn = ctx.createGain(); verbIn.connect(conv);
    noiseBuf = mkNoise(2.5); crackBuf = mkCrackle(5);
    return ctx;
  }
  function mkNoise(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec | 0, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function impulse(sec, decay) {
    const n = ctx.sampleRate * sec | 0, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function mkCrackle(sec) {
    const sr = ctx.sampleRate, n = sr * sec | 0, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < n; i++) { l = l * .985 + (Math.random() * 2 - 1) * .015; d[i] = l * .6; }
    const pops = sec * 22;
    for (let k = 0; k < pops; k++) {
      const p = Math.random() * n | 0, amp = Math.pow(Math.random(), 3) * .8 + .04, len = (Math.random() * 40 + 4) | 0;
      for (let j = 0; j < len && p + j < n; j++) d[p + j] += amp * (Math.random() * 2 - 1) * (1 - j / len);
    }
    return b;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => { });
    if (!unlocked) {
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
      unlocked = true;
    }
  }
  const now = () => ctx ? ctx.currentTime : 0;
  const lat = () => ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) : 0;

  function route(node, out, pan, verb) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(out || sfxBus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; n.connect(s); s.connect(verbIn); }
  }
  function tone({ f = 440, f2 = 0, type = 'sine', t = 0, a = .004, d = .2, v = .3, out = null, lp = 0, lp2 = 0, q = .7, verb = 0, pan = 0, detune = 0 }) {
    if (!ctx) return;
    t = Math.max(t || 0, ctx.currentTime);
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, .0002), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    let n = o;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(lp, t); if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t + a + d); fl.Q.value = q; n.connect(fl); n = fl; }
    n.connect(g); route(g, out, pan, verb);
    o.start(t); o.stop(t + a + d + .05);
  }
  function noise({ t = 0, a = .002, d = .2, v = .3, type = 'bandpass', f = 1000, f2 = 0, q = 1, out = null, verb = 0, pan = 0 }) {
    if (!ctx) return;
    t = Math.max(t || 0, ctx.currentTime);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, .0002), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    s.connect(fl); fl.connect(g); route(g, out, pan, verb);
    s.start(t, Math.random() * 1.8); s.stop(t + a + d + .05);
  }

  // Note mélodique avec relâchement possible (notes tenues)
  function lead(t, f, dur, out, kind = 'soft') {
    if (!ctx) return { release() { } };
    t = Math.max(t, ctx.currentTime);
    const types = kind === 'saw' ? ['sawtooth', 'sawtooth'] : kind === 'bright' ? ['square', 'sawtooth'] : kind === 'bell' ? ['sine', 'sine'] : ['triangle', 'sine'];
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = types[0]; o2.type = types[1]; o1.frequency.value = f;
    o2.frequency.value = kind === 'bell' ? f * 3.0 : f * 2; o2.detune.value = kind === 'bell' ? 4 : 6;
    const g2 = ctx.createGain(); g2.gain.value = kind === 'bell' ? .22 : kind === 'soft' ? .35 : .18;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.5;
    const hi = kind === 'soft' ? 2600 : kind === 'bell' ? 5200 : 3800, lo = kind === 'soft' ? 800 : 1200;
    const end = t + Math.max(.12, dur);
    fl.frequency.setValueAtTime(hi, t); fl.frequency.exponentialRampToValueAtTime(lo, end + .3);
    const pk = kind === 'saw' || kind === 'bright' ? .085 : .16;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + .005);
    g.gain.exponentialRampToValueAtTime(pk * .5, t + .09); g.gain.exponentialRampToValueAtTime(pk * .3, end);
    g.gain.exponentialRampToValueAtTime(.0001, end + .35);
    o1.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); route(g, out || musBus, 0, .22);
    o1.start(t); o2.start(t); o1.stop(end + .4); o2.stop(end + .4);
    return {
      release(rt) {
        rt = Math.max(rt, ctx.currentTime);
        try {
          if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(rt); else { g.gain.cancelScheduledValues(rt); g.gain.setValueAtTime(pk * .3, rt); }
          g.gain.setTargetAtTime(.0001, rt, .04); o1.stop(rt + .3); o2.stop(rt + .3);
        } catch (e) { }
      }
    };
  }

  // Boucles continues (presse, versage, mélange, gravure…)
  function loop(kind) {
    if (!ctx) return { set() { }, stop() { } };
    const out = ctx.createGain(); out.gain.value = 0; out.connect(sfxBus);
    const srcs = []; let filt, base = 500, oscs = [];
    const nsrc = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random()); srcs.push(s); return s; };
    if (kind === 'hydro') {
      filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 5; base = 160; filt.frequency.value = base;
      [[48, 'sawtooth'], [48.7, 'sawtooth'], [24, 'square']].forEach(([f, ty]) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f; o.connect(filt); o.start(); srcs.push(o); oscs.push([o, f]); });
      filt.connect(out);
      const n = nsrc(); const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3200; hf.Q.value = .8;
      const hg = ctx.createGain(); hg.gain.value = .12; n.connect(hf); hf.connect(hg); hg.connect(out);
    } else {
      const n = nsrc(); filt = ctx.createBiquadFilter();
      const cfg = { pour: ['lowpass', 520, 1.2], swirl: ['bandpass', 650, 2.2], cut: ['bandpass', 4200, 3], scratch: ['bandpass', 1100, 2.5] }[kind] || ['lowpass', 800, 1];
      filt.type = cfg[0]; base = cfg[1]; filt.frequency.value = base; filt.Q.value = cfg[2];
      n.connect(filt); filt.connect(out);
    }
    let dead = false;
    return {
      set(v, p = 0) {
        if (dead) return; const t = ctx.currentTime;
        out.gain.setTargetAtTime(Math.max(0, v), t, .04);
        filt.frequency.setTargetAtTime(base * (1 + p * (kind === 'hydro' ? 3.5 : 1.6)), t, .05);
        for (const [o, f] of oscs) o.frequency.setTargetAtTime(f * (1 + p * .45), t, .08);
      },
      stop() {
        if (dead) return; dead = true; const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, .05);
        setTimeout(() => { srcs.forEach(s => { try { s.stop(); } catch (e) { } }); out.disconnect(); }, 400);
      }
    };
  }
  let crackSrc = null, crackG = null;
  function crackle(on) {
    if (!ctx) return;
    if (on && !crackSrc) {
      crackSrc = ctx.createBufferSource(); crackSrc.buffer = crackBuf; crackSrc.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .35;
      crackG = ctx.createGain(); crackG.gain.value = 0; crackG.gain.setTargetAtTime(.5, ctx.currentTime, .2);
      crackSrc.connect(bp); bp.connect(crackG); crackG.connect(musBus); crackSrc.start();
    } else if (!on && crackSrc) {
      const s = crackSrc; crackG.gain.setTargetAtTime(0, ctx.currentTime, .1); setTimeout(() => { try { s.stop(); } catch (e) { } }, 500);
      crackSrc = null;
    }
  }

  const SC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
  const T = () => now();
  const sfx = {
    click() { tone({ type: 'triangle', f: 1500, f2: 700, d: .045, v: .16 }); noise({ type: 'highpass', f: 5000, d: .015, v: .06 }); },
    soft() { tone({ type: 'sine', f: 620, f2: 930, d: .07, v: .14 }); },
    tab() { tone({ type: 'sine', f: 880, f2: 1320, d: .06, v: .12 }); tone({ type: 'triangle', f: 2640, d: .02, v: .04 }); },
    pop(i = 0) {
      const f = mtof(72 + SC[i % SC.length]);
      tone({ type: 'sine', f: f * .65, f2: f * 1.4, a: .002, d: .11, v: .42, verb: .12, pan: rand(-.3, .3) });
      tone({ type: 'triangle', f: f * 2, d: .035, v: .05 });
      noise({ type: 'lowpass', f: 1600, d: .04, v: .12 });
    },
    splat() { noise({ type: 'bandpass', f: rand(450, 900), q: 1.6, d: .08, v: .2 }); },
    pellet() { const f = rand(2200, 4600); tone({ type: 'triangle', f, f2: f * .8, d: .016, v: rand(.025, .06), pan: rand(-.5, .5) }); },
    bubble(p = 0) { const f = rand(240, 480) * (1 + p * .8); tone({ type: 'sine', f, f2: f * 2.3, a: .003, d: .055, v: .09, pan: rand(-.4, .4) }); },
    melt() {
      noise({ type: 'highpass', f: 2800, f2: 6500, a: .15, d: 1.0, v: .14 });
      for (let k = 0; k < 10; k++) { const f = rand(300, 700); tone({ t: T() + k * .09 + rand(0, .05), type: 'sine', f, f2: f * 2, d: .05, v: .06 }); }
      tone({ type: 'sine', f: 220, f2: 330, a: .2, d: .8, v: .06, verb: .3 });
    },
    flood() { tone({ type: 'sine', f: 200, f2: 85, a: .01, d: .35, v: .35 }); noise({ type: 'lowpass', f: 900, f2: 200, a: .02, d: .38, v: .22 }); },
    clank() {
      const t = T();
      [1, 2.76, 5.4, 8.93].forEach((k, i) => tone({ t, type: 'sine', f: 290 * k, d: .7 / (i + 1) + .08, v: .13 / (i + 1), verb: .35 }));
      noise({ t, type: 'highpass', f: 2600, d: .05, v: .22 });
    },
    thump(k = 1) {
      tone({ type: 'sine', f: 120, f2: 36, a: .003, d: .42 * k, v: .95 });
      noise({ type: 'lowpass', f: 600, f2: 110, d: .2 * k, v: .55 });
    },
    hiss(d = 1.1) {
      noise({ type: 'highpass', f: 2400, f2: 7500, a: .03, d, v: .34 });
      noise({ type: 'bandpass', f: 5200, q: .6, a: .06, d: d * .8, v: .14, pan: -.4 });
      noise({ type: 'bandpass', f: 4300, q: .6, a: .1, d: d * .7, v: .12, pan: .4 });
    },
    creak() { const f = rand(150, 260); tone({ type: 'sawtooth', f, f2: f * rand(.85, 1.15), a: .05, d: .25, v: .035, lp: 900 }); },
    gauge() { tone({ type: 'square', f: 3200, d: .01, v: .03, lp: 7000 }); },
    alarm() { const t = T(); for (let k = 0; k < 3; k++) tone({ t: t + k * .12, type: 'square', f: 880, d: .07, v: .08, lp: 2500 }); noise({ type: 'bandpass', f: 1800, q: 2, d: .2, v: .4 }); },
    scrape(p = 0) {
      const f = 900 + p * 2800;
      noise({ type: 'bandpass', f, f2: f * 1.25, q: 7, d: .055, v: .26 });
      tone({ type: 'sawtooth', f: f / 8, d: .035, v: .03, lp: f });
    },
    slap() { noise({ type: 'lowpass', f: 1800, f2: 280, d: .1, v: .7 }); tone({ type: 'sine', f: 180, f2: 60, d: .14, v: .7 }); },
    coin(i = 0) { const f = mtof(84 + SC[i % 9]); tone({ type: 'square', f, d: .05, v: .045, lp: 5000 }); tone({ t: T() + .045, type: 'sine', f: f * 1.5, d: .14, v: .07, verb: .2 }); },
    star(i = 0) {
      const f = mtof(76 + [0, 4, 7, 12][i]);
      tone({ type: 'triangle', f, d: .6, v: .16, verb: .5 }); tone({ type: 'sine', f: f * 2, d: .4, v: .07, verb: .5 }); tone({ type: 'sine', f: f * 3.01, d: .25, v: .03 });
      noise({ type: 'highpass', f: 6000, d: .12, v: .05 });
    },
    win() { const t = T(); [0, 4, 7, 12, 16].forEach((s, i) => lead(t + i * .07, mtof(72 + s), .25, sfxBus, 'bell')); },
    ding() { tone({ type: 'sine', f: 1568, d: .7, v: .14, verb: .5 }); tone({ type: 'sine', f: 3136, d: .4, v: .05, verb: .4 }); },
    whoosh() { noise({ type: 'bandpass', f: 280, f2: 2600, q: 1.2, a: .12, d: .2, v: .22 }); },
    shimmer() {
      const t = T();
      for (let k = 0; k < 16; k++) tone({ t: t + k * .045, type: 'sine', f: rand(1800, 5200), d: .25, v: .035, verb: .6, pan: rand(-.6, .6) });
      noise({ type: 'highpass', f: 5000, f2: 9000, a: .25, d: .6, v: .07 });
    },
    miss() { tone({ type: 'square', f: 130, f2: 90, d: .08, v: .05, lp: 500 }); },
    tick() { tone({ type: 'triangle', f: 1900, f2: 1500, d: .02, v: .05 }); },
    perfect() { tone({ type: 'sine', f: 2637, d: .14, v: .045, verb: .35 }); },
    combo(n) { const t = T(); [0, 7, 12].forEach((s, i) => tone({ t: t + i * .05, type: 'triangle', f: mtof(79 + s), d: .2, v: .07, verb: .4 })); },
    needle() { tone({ type: 'sine', f: 95, f2: 50, d: .14, v: .55 }); noise({ type: 'lowpass', f: 2200, d: .05, v: .3 }); },
    countAt(t, hi) { tone({ t, type: 'triangle', f: hi ? 1760 : 1175, d: .07, v: .12 }); noise({ t, type: 'highpass', f: 6000, d: .02, v: .06 }); },
    gift() { const t = T(); noise({ type: 'bandpass', f: 600, f2: 3000, a: .01, d: .3, v: .3 }); [0, 4, 7, 11, 14, 19].forEach((s, i) => tone({ t: t + i * .05, type: 'triangle', f: mtof(76 + s), d: .3, v: .09, verb: .5 })); },
    shake() { noise({ type: 'bandpass', f: 1400, q: 2, d: .07, v: .25 }); tone({ type: 'sine', f: 220, f2: 160, d: .08, v: .2 }); },
    buy() { sfx.coin(0); setTimeout(() => sfx.coin(4), 70); setTimeout(() => sfx.shimmer(), 120); },
    no() { tone({ type: 'square', f: 220, f2: 160, d: .12, v: .06, lp: 900 }); },
  };

  // Instruments de la musique
  const ins = {
    kick(t, o) { tone({ t, type: 'sine', f: 165, f2: 42, a: .002, d: .3, v: .9, out: o }); tone({ t, type: 'triangle', f: 1000, f2: 220, d: .012, v: .12, out: o }); },
    snare(t, o) { noise({ t, type: 'bandpass', f: 1900, q: .7, d: .16, v: .42, out: o, verb: .12 }); tone({ t, type: 'triangle', f: 210, f2: 150, d: .08, v: .28, out: o }); },
    clap(t, o) { [0, .011, .022].forEach(k => noise({ t: t + k, type: 'bandpass', f: 1250, q: 1.4, d: k > .02 ? .14 : .02, v: .36, out: o, verb: .18 })); },
    hat(t, o, open) { noise({ t, type: 'highpass', f: 7600, d: open ? .17 : .032, v: open ? .1 : .085, out: o }); },
    crash(t, o) { noise({ t, type: 'highpass', f: 4500, a: .002, d: 1.6, v: .16, out: o, verb: .3 }); },
    bass(t, f, d, o) { tone({ t, type: 'sawtooth', f, a: .005, d: Math.max(.08, d), v: .2, lp: 520, lp2: 140, q: 3, out: o }); tone({ t, type: 'sine', f, a: .005, d: Math.max(.1, d), v: .34, out: o }); },
    keys(t, fs, d, o) { fs.forEach((f, i) => { tone({ t: t + i * .008, type: 'sine', f, a: .008, d, v: .065, out: o, verb: .22 }); tone({ t, type: 'sine', f: f * 2, a: .004, d: d * .35, v: .022, out: o }); }); },
    stab(t, fs, d, o) { fs.forEach(f => tone({ t, type: 'sawtooth', f, a: .004, d: .17, v: .045, lp: 2600, lp2: 420, out: o, verb: .3 })); },
    pad(t, fs, d, o) { fs.forEach(f => { tone({ t, type: 'triangle', f, a: .3, d, v: .045, lp: 1500, out: o, verb: .35 }); tone({ t, type: 'sawtooth', f, a: .4, d, v: .012, lp: 900, out: o, detune: 9 }); }); },
  };

  function setOn(on) { if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, .03); }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });

  return { init, unlock, now, lat, tone, noise, lead, loop, crackle, sfx, ins, setOn, music: () => musBus, vinyl: () => vinylIn, get ctx() { return ctx; } };
})();
