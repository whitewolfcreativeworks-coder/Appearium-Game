// The player's body: stamina, satiety and conditions brought on by what you eat.
// Gentle by design — you never starve — but food matters: being well fed lets you run further;
// a wrong mushroom slows you down, makes you sick, or worse.
import { clamp } from '../core/rng.js';

export const CONDITIONS = {
  fed: { label: 'Well fed', color: '#9fc27a' },
  hungry: { label: 'Hungry', color: '#d8b46a' },
  queasy: { label: 'Queasy', color: '#c8c46a' },
  sick: { label: 'Poisoned', color: '#d88a5a' },
  trip: { label: 'Altered senses', color: '#b98ad8' },
  stung: { label: 'Stung', color: '#d8b46a' },
  amatoxin: { label: '', color: '#e05a4a' }, // hidden until symptoms appear
  envenomed: { label: 'Snakebite — get home', color: '#e05a4a' },
  bitten: { label: 'Bitten', color: '#d8b46a' },
  bruised: { label: 'Bruised', color: '#d8a06a' },
};

export class Body {
  constructor(game) {
    this.game = game;
    this.stamina = 100; this.satiety = 70;
    this.conds = []; // {type, sev, onset, dur, t, msg}
    this.fx = { sick: 0, trip: 0, collapse: 0 };
    this.retch = 0; this.sway = 0;
  }

  get maxStamina() { return this.has('fed') ? 160 : 100; }
  has(type) { return this.conds.some((c) => c.type === type && c.onset <= 0); }
  active(type) { return this.conds.find((c) => c.type === type && c.onset <= 0); }

  add(type, { sev = 1, onset = 0, dur = 60, msg = null } = {}) {
    // stacking the same condition extends it
    const ex = this.conds.find((c) => c.type === type);
    if (ex && type !== 'amatoxin') { ex.dur = Math.max(ex.dur - ex.t, dur) + ex.t * 0; ex.t = 0; ex.sev = Math.max(ex.sev, sev); return ex; }
    const c = { type, sev, onset, dur, t: 0, msg, started: false };
    this.conds.push(c);
    return c;
  }

  eat(food) { this.satiety = clamp(this.satiety + food * 9, 0, 100); if (this.satiety > 75 && food >= 3) this.add('fed', { dur: 300 + food * 30 }); }

  canRun() { return !this.has('sick') && !this.has('amatoxin') && !this.has('envenomed') && this.stamina > 2; }
  speedMul() {
    let m = 1;
    const s = this.active('sick'); if (s) m *= 1 - 0.18 * s.sev;
    const a = this.active('amatoxin'); if (a) m *= 0.45;
    const v = this.active('envenomed'); if (v) m *= 0.7 - 0.25 * Math.min(1, v.t / v.dur);
    if (this.has('queasy')) m *= 0.9;
    if (this.has('bruised')) m *= 0.85;
    if (this.retch > 0) m *= 0.2;
    return m;
  }

  update(dt, running, moving) {
    const g = this.game;
    // stamina
    if (running && moving) this.stamina -= 7 * dt;
    else this.stamina += (this.satiety < 20 ? 6 : 13) * (this.has('fed') ? 1.4 : 1) * dt;
    this.stamina = clamp(this.stamina, 0, this.maxStamina);
    // satiety falls slowly while exploring (about 15 minutes from full to hungry)
    if (g.expedition) this.satiety = Math.max(0, this.satiety - dt * 0.09);
    // conditions
    let sick = 0, trip = 0, collapse = 0;
    for (const c of [...this.conds]) {
      if (c.onset > 0) { c.onset -= dt; continue; }
      if (!c.started) { c.started = true; this.onStart(c); }
      c.t += dt;
      const k = Math.min(1, c.t / 6) * Math.min(1, (c.dur - c.t) / 8 + 0.0001);
      if (c.type === 'sick' || c.type === 'queasy') sick = Math.max(sick, (c.type === 'queasy' ? 0.3 : 0.35 + c.sev * 0.22) * k);
      if (c.type === 'trip') trip = Math.max(trip, c.sev * k);
      if (c.type === 'amatoxin') { sick = Math.max(sick, 0.95 * Math.min(1, c.t / 8)); collapse = Math.max(0, (c.t - c.dur * 0.6) / (c.dur * 0.4)); }
      if (c.type === 'envenomed') { sick = Math.max(sick, 0.25 + 0.6 * c.t / c.dur); collapse = Math.max(0, (c.t - c.dur * 0.8) / (c.dur * 0.2)); }
      if (c.t >= c.dur) {
        this.conds.splice(this.conds.indexOf(c), 1);
        if (c.type === 'amatoxin') { this.fx.collapse = 1; g.onCollapse(); return; }
        if (c.type === 'envenomed') { this.fx.collapse = 1; g.onCollapse('snake'); return; }
        this.onEnd(c);
      }
    }
    // random retching while sick
    if (sick > 0.4 && this.retch <= 0 && Math.random() < dt * 0.05 * sick) { this.retch = 2.2; g.audio.retch?.(); g.ui.toast(['You double over, retching.', 'A wave of nausea stops you in your tracks.', 'Cold sweat. Your stomach heaves.'][Math.floor(Math.random() * 3)]); }
    this.retch = Math.max(0, this.retch - dt);
    const lerp = (a, b) => a + (b - a) * Math.min(1, dt * 1.5);
    this.fx.sick = lerp(this.fx.sick, sick); this.fx.trip = lerp(this.fx.trip, trip); this.fx.collapse = lerp(this.fx.collapse, collapse);
    if (this.satiety < 20 && !this.hungryWarned && g.expedition) { this.hungryWarned = true; g.ui.toast('You are getting hungry — your strength returns more slowly. Eat something.'); }
    if (this.satiety > 30) this.hungryWarned = false;
  }

  onStart(c) {
    const g = this.game;
    const msgs = {
      sick: ['Your stomach cramps painfully. Something you ate was poisonous.', 'Nausea washes over you. You feel terrible.', 'You break out in a cold sweat — you have been poisoned.'],
      queasy: ['Your stomach feels unsettled. Raw wild mushrooms are hard to digest.'],
      trip: ['The colours around you begin to breathe…', 'The forest seems to ripple and shimmer…'],
      amatoxin: ['Violent cramps seize you. This is serious.'],
      stung: ['Ouch! The stinging hairs burn your fingers.'],
      envenomed: ['Two puncture marks, burning pain and swelling. You have been bitten by a venomous snake. Stay calm, move steadily — and get home to Maren.'],
      bitten: ['A sharp nip — but this snake is not venomous. Just a scratch.'],
      bruised: ['Bruised and shaken. You will be stiff for a while.'],
    };
    if (c.msg !== false) g.ui.toast(c.msg || (msgs[c.type] || [''])[Math.floor(Math.random() * (msgs[c.type] || ['']).length)], c.type !== 'queasy');
    if (c.type === 'trip') g.audio.tripStart?.();
  }
  onEnd(c) {
    const g = this.game;
    const msgs = { sick: 'The sickness finally passes. You feel weak but better.', queasy: 'Your stomach settles.', trip: 'The world slowly settles back into itself.', fed: 'The good meal has worn off.' };
    if (msgs[c.type]) g.ui.toast(msgs[c.type]);
    if (c.type === 'trip') g.audio.tripEnd?.();
  }

  clearAll() { this.conds = []; this.fx = { sick: 0, trip: 0, collapse: 0 }; this.retch = 0; }

  chips() {
    const out = [];
    for (const c of this.conds) if (c.onset <= 0 && CONDITIONS[c.type]?.label) out.push(c.type);
    if (this.satiety < 20 && this.game.expedition) out.push('hungry');
    return [...new Set(out)];
  }

  serialize() { return { stamina: this.stamina, satiety: this.satiety, conds: this.conds }; }
  restore(o) { if (!o) return; this.satiety = o.satiety ?? 70; this.conds = (o.conds || []).filter((c) => c.type !== 'amatoxin'); }
}

// Apply the true effect of eating a species (or a dish). Returns a description of what will happen.
export function applyEffect(body, sp, { raw = false, cooked = false } = {}) {
  const eff = raw && sp.raw ? sp.raw : sp.effect;
  if (!eff) return null;
  if (eff.deadly) {
    // death cap / nightshade: symptoms are DELAYED — in reality 6–24 hours for amatoxins
    body.add('amatoxin', { onset: 75, dur: 45, msg: false });
    return 'deadly';
  }
  if (eff.sting) { body.add('stung', { dur: 20 }); return 'stung'; }
  if (eff.sick) body.add(eff.sick === 1 && raw ? 'queasy' : 'sick', { sev: eff.sick, onset: 12 + Math.random() * 10, dur: 45 + eff.sick * 40 });
  if (eff.trip) body.add('trip', { sev: eff.trip, onset: 20 + Math.random() * 10, dur: 140 });
  if (eff.bitter) return 'bitter';
  return eff.trip ? 'trip' : 'sick';
}
