import * as THREE from 'three';

/**
 * Zvuky (fáze 4) – všechno syntetizované přes Web Audio, žádné nahrávky (a tedy žádné licence).
 * Zdroje s polohou jdou přes PannerNode (posluchač = kamera). Všechno míří do sběrnice `bus`,
 * odkud vede suchá cesta na výstup a odbočka do dozvuku (koupelny a toaleta mají hodně, jinde skoro nic).
 * AudioContext lze vytvořit až po gestu uživatele – start() se volá z kliknutí na „Klikni pro vstup“.
 */
export type Surface = 'wood' | 'carpet' | 'tile' | 'kitchen' | 'stone' | 'corridor';

interface BurstOpts {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  dur: number;
  gain: number;
}

/** Bachovo Preludium C dur (BWV 846), takty 1–8 – volné dílo. Každý takt = 8 šestnáctin, hraje se dvakrát. */
const PRELUDE = [
  [60, 64, 67, 72, 76],
  [60, 62, 69, 74, 77],
  [59, 62, 67, 74, 77],
  [60, 64, 67, 72, 76],
  [60, 64, 69, 76, 81],
  [60, 62, 66, 69, 74],
  [59, 62, 67, 74, 79],
  [59, 60, 64, 67, 72],
];

/** Vlastní znělka rádia (K-A-C-L). */
const JINGLE: [number, number][] = [
  [79, 0.22],
  [76, 0.22],
  [72, 0.22],
  [79, 0.7],
];

/** Akordy pro „hudbu z rádia“ (C dur: I – vi – IV – V a I – IV – ii – V). */
const RADIO_CHORDS = [
  [48, 60, 64, 67],
  [45, 57, 60, 64],
  [41, 57, 60, 65],
  [43, 55, 59, 62],
  [48, 60, 64, 67],
  [41, 53, 57, 60],
  [38, 53, 57, 62],
  [43, 55, 59, 65],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private bus!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private city!: GainNode;
  private fwd = new THREE.Vector3();
  private up = new THREE.Vector3();

  /** Vytvoří AudioContext (volat z gesta uživatele); opakované volání jen obnoví pozastavený kontext. */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.connect(master).connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(comp);
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 1.4, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.05;
    this.bus.connect(this.reverbSend).connect(conv).connect(comp);
    this.noise = noiseBuffer(ctx, 3);
    this.startCity();
  }

  /** Poloha a natočení posluchače podle kamery (volat každý snímek). */
  updateListener(cam: THREE.Camera) {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const p = cam.position;
    this.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(this.fwd.x, t);
      l.forwardY.setValueAtTime(this.fwd.y, t);
      l.forwardZ.setValueAtTime(this.fwd.z, t);
      l.upX.setValueAtTime(this.up.x, t);
      l.upY.setValueAtTime(this.up.y, t);
      l.upZ.setValueAtTime(this.up.z, t);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(this.fwd.x, this.fwd.y, this.fwd.z, this.up.x, this.up.y, this.up.z);
    }
  }

  /** Množství dozvuku (0 = suchý obývák, ~0,5 = koupelna s dlažbou). */
  setReverb(wet: number) {
    if (this.ctx) this.reverbSend.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.25);
  }

  /** Hlasitost šumu města (0 = zavřená okna, 1 = na balkoně). */
  setCity(level: number) {
    if (this.ctx) this.city.gain.setTargetAtTime(level * 0.16, this.ctx.currentTime, 0.4);
  }

  /** Výstupní uzel; s polohou přes panner (zvuk z místa ve scéně). */
  private out(pos?: THREE.Vector3, ref = 1.2): AudioNode {
    if (!pos) return this.bus;
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.3;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    p.connect(this.bus);
    return p;
  }

  /** Krátký filtrovaný šum s rychlým náběhem a exponenciálním dozněním (kroky, cvaknutí, rány). */
  private burst(out: AudioNode, t: number, o: BurstOpts) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.value = o.freq;
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 2);
    src.stop(t + o.dur + 0.05);
  }

  /** Tlumené „bum“ – sinus s klesající frekvencí (dopad paty, zavření dveří). */
  private thump(out: AudioNode, t: number, freq: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Krok hráče podle povrchu pod ním. */
  step(surface: Surface) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = 0.85 + Math.random() * 0.3;
    const out = this.bus;
    switch (surface) {
      case 'wood':
        this.burst(out, t, { type: 'bandpass', freq: 1300 * v, q: 1.1, dur: 0.07, gain: 0.2 * v });
        this.thump(out, t, 95 * v, 0.09, 0.32);
        break;
      case 'tile':
      case 'kitchen':
        this.burst(out, t, { type: 'bandpass', freq: 3200 * v, q: 1.6, dur: 0.045, gain: 0.24 * v });
        this.thump(out, t, 150 * v, 0.05, 0.22);
        break;
      case 'stone':
        this.burst(out, t, { type: 'bandpass', freq: 2300 * v, q: 0.8, dur: 0.06, gain: 0.2 * v });
        this.burst(out, t + 0.018, { type: 'highpass', freq: 4500, dur: 0.05, gain: 0.07 });
        this.thump(out, t, 120 * v, 0.06, 0.2);
        break;
      default: // koberec
        this.burst(out, t, { type: 'lowpass', freq: 520 * v, q: 0.7, dur: 0.11, gain: 0.26 * v });
        this.thump(out, t, 80 * v, 0.08, 0.14);
    }
  }

  /** Otevření / zavření otočných dveří. */
  door(pos: THREE.Vector3, opening: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(pos);
    if (opening) {
      this.burst(out, t, { type: 'highpass', freq: 2600, dur: 0.03, gain: 0.3 }); // západka
      this.burst(out, t + 0.05, { type: 'lowpass', freq: 380, dur: 0.45, gain: 0.06 }); // průvan
      // tiché zavrzání pantu
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(240, t + 0.08);
      o.frequency.exponentialRampToValueAtTime(170, t + 0.5);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(f).connect(g).connect(out);
      o.start(t + 0.08);
      o.stop(t + 0.55);
    } else {
      // křídlo dojede za ~0,35 s, pak rána a západka
      this.thump(out, t + 0.33, 70, 0.16, 0.6);
      this.burst(out, t + 0.33, { type: 'bandpass', freq: 1800, q: 1.4, dur: 0.06, gain: 0.25 });
      this.burst(out, t + 0.36, { type: 'highpass', freq: 3000, dur: 0.025, gain: 0.25 });
    }
  }

  /** Posuvné balkonové dveře – hučení kolejnice. */
  slide(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(pos);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 260;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + 0.85);
    this.thump(out, t + 0.7, 110, 0.08, 0.2);
  }

  /** Cvaknutí vypínače. */
  click(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(pos, 0.8);
    this.burst(out, t, { type: 'highpass', freq: 3500, dur: 0.018, gain: 0.35 });
    this.burst(out, t + 0.012, { type: 'bandpass', freq: 1500, q: 2, dur: 0.03, gain: 0.12 });
  }

  /** Tón klavíru: pár harmonických s lehkou inharmonicitou, tlumicí filtr a exponenciální doznění. */
  pianoNote(out: AudioNode, t: number, midi: number, vel = 0.4) {
    const ctx = this.ctx!;
    const f0 = midiHz(midi);
    const dur = THREE.MathUtils.clamp(3.4 - (midi - 48) * 0.06, 0.9, 3.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f0 * 9, 12000), t);
    lp.frequency.exponentialRampToValueAtTime(f0 * 2.5, t + dur * 0.6);
    lp.connect(g).connect(out);
    const partials = [1, 0.5, 0.28, 0.14, 0.08, 0.04];
    partials.forEach((amp, i) => {
      const n = i + 1;
      const o = ctx.createOscillator();
      o.frequency.value = f0 * n * Math.sqrt(1 + 0.0004 * n * n);
      const pg = ctx.createGain();
      pg.gain.value = amp / 2.2;
      o.connect(pg).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  /** Zahraje začátek Bachova preludia; vrací funkci, která hraní utlumí. */
  playPrelude(pos: THREE.Vector3, onEnd: () => void): () => void {
    if (!this.ctx) {
      onEnd();
      return () => {};
    }
    const ctx = this.ctx;
    const phrase = ctx.createGain();
    phrase.connect(this.out(pos, 2));
    const t0 = ctx.currentTime + 0.05;
    const s = 0.16; // šestnáctina
    let t = t0;
    for (const [a, b, c, d, e] of PRELUDE) {
      for (let rep = 0; rep < 2; rep++) {
        [a, b, c, d, e, c, d, e].forEach((m, i) => this.pianoNote(phrase, t + i * s, m, i < 2 ? 0.45 : 0.32));
        t += 8 * s;
      }
    }
    for (const m of [36, 48, 60, 64, 67, 72]) this.pianoNote(phrase, t, m, 0.4); // závěrečný akord
    const total = (t - t0 + 3.5) * 1000;
    const timer = window.setTimeout(onEnd, total);
    return () => {
      window.clearTimeout(timer);
      phrase.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      window.setTimeout(() => phrase.disconnect(), 1500);
      onEnd();
    };
  }

  /** Rádio KACL: šum ladění, znělka, hlas a pak tichá „vážná hudba“ přes filtr malého reproduktoru. */
  radioOn(pos: THREE.Vector3): () => void {
    if (!this.ctx) return () => {};
    const ctx = this.ctx;
    const vol = ctx.createGain();
    vol.connect(this.out(pos, 1.5));
    // malý reproduktor: horní a dolní propust, lehké zkreslení
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip(1.6);
    hp.connect(lp).connect(shaper).connect(vol);

    const t0 = ctx.currentTime;
    this.burst(hp, t0, { type: 'bandpass', freq: 1800, q: 0.5, dur: 0.6, gain: 0.18 });
    let t = t0 + 0.6;
    for (const [m, d] of JINGLE) {
      this.pianoNote(hp, t, m, 0.5);
      this.pianoNote(hp, t, m + 12, 0.2);
      t += d;
    }
    const speak = window.setTimeout(() => {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance("This is KACL 780. Hello Seattle, I'm listening.");
      u.lang = 'en-US';
      u.rate = 0.95;
      speechSynthesis.speak(u);
    }, (t - t0 + 0.2) * 1000);

    // hudba: arpeggia podle akordů, plánovaná s předstihem
    let next = t + 4.5;
    let bar = 0;
    const tick = window.setInterval(() => {
      while (next < ctx.currentTime + 1.5) {
        const [bass, ...chord] = RADIO_CHORDS[bar % RADIO_CHORDS.length];
        this.pianoNote(hp, next, bass, 0.28);
        const pattern = [0, 1, 2, 1, 0, 1, 2, 1];
        pattern.forEach((k, i) => this.pianoNote(hp, next + i * 0.3, chord[k] + (i === 4 ? 12 : 0), 0.18));
        next += 2.4;
        bar++;
      }
    }, 250);

    return () => {
      window.clearTimeout(speak);
      window.clearInterval(tick);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      vol.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      window.setTimeout(() => vol.disconnect(), 800);
    };
  }

  /** Šum města: hluboké hučení dopravy + tichý vítr, hlasitost řídí setCity(). */
  private startCity() {
    const ctx = this.ctx!;
    this.city = ctx.createGain();
    this.city.gain.value = 0;
    this.city.connect(this.bus);
    const layer = (type: BiquadFilterType, freq: number, gain: number, rate: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.city);
      src.start();
      return g;
    };
    layer('lowpass', 320, 1, 0.5);
    const wind = layer('bandpass', 1200, 0.12, 1);
    // pomalé „vlnění“ dopravy a větru
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 0.08;
    lfo.connect(depth).connect(wind.gain);
    lfo.start();
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Impulzní odezva dozvuku: stereo šum s exponenciálním útlumem. */
function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function softClip(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

export const audio = new AudioEngine();
