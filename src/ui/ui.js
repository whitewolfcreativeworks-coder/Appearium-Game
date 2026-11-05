// DOM HUD helpers: toasts, prompts, compass, panels, cards, fades.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = { hud: $('hud'), prompt: $('prompt'), promptText: $('prompt-text'), toasts: $('toasts'), region: $('region-name'), regionSub: $('region-sub'),
      strip: $('compass-strip'), panelWrap: $('panel-wrap'), panel: $('panel'), card: $('card'), fade: $('fade'), home: $('btn-home'), interact: $('btn-interact'),
      packCount: $('pack-count'), packCap: $('pack-cap'), packMeter: $('packmeter'), observe: $('observe'), observeRing: $('observe-ring'), observeText: $('observe-text') };
    this.panelOpen = false; this.lastPrompt = null;
    this.el.panelWrap.addEventListener('pointerdown', (e) => { if (e.target === this.el.panelWrap) this.closePanel(); });
  }
  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  toast(html, big = false) {
    const d = document.createElement('div'); d.className = 'toast' + (big ? ' big' : ''); d.innerHTML = html;
    this.el.toasts.appendChild(d); setTimeout(() => d.remove(), 3500);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }
  prompt(text) {
    if (text === this.lastPrompt) return; this.lastPrompt = text;
    if (!text) { this.el.prompt.classList.add('hidden'); this.el.interact.classList.add('hidden'); return; }
    this.el.promptText.textContent = text; this.el.prompt.classList.remove('hidden'); this.el.interact.classList.remove('hidden');
  }
  region(name, sub) { this.el.region.textContent = name; this.el.regionSub.textContent = sub || ''; }
  flash() {
    let el = document.getElementById('hurt'); if (!el) { el = document.createElement('div'); el.id = 'hurt'; document.body.appendChild(el); }
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  pack(n) { this.el.packCount.textContent = n; }
  observe(p, text) {
    if (p === null) { this.el.observe.classList.add('hidden'); return; }
    this.el.observe.classList.remove('hidden'); this.el.observeRing.style.strokeDashoffset = String(100.5 * (1 - p)); this.el.observeText.textContent = text;
  }

  compass(heading, marks) {
    const W = this.el.strip.clientWidth || 400, span = Math.PI * 1.1;
    const xOf = (bearing) => { let d = bearing - heading; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > span / 2 ? null : W / 2 + (d / span) * W; };
    let html = '';
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < 8; i++) { const x = xOf(i * Math.PI / 4); if (x !== null) html += `<div class="tick${i % 2 ? ' minor' : ''}" style="left:${x.toFixed(1)}px">${names[i]}</div>`; }
    for (const m of marks) { const x = xOf(m.bearing); if (x !== null) html += `<div class="mark ${m.cls || ''}" style="left:${x.toFixed(1)}px">${this.esc(m.label)}${m.dist !== undefined ? ` · ${m.dist}m` : ''}</div>`; }
    this.el.strip.innerHTML = html;
  }

  showPanel(html, onClick) {
    this.el.panel.innerHTML = html; this.el.panelWrap.classList.remove('hidden'); this.panelOpen = true;
    this.el.panel.onclick = (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      this.game.audio.click();
      if (b.dataset.act === 'close') { this.closePanel(); return; }
      onClick && onClick(b.dataset.act, b.dataset, b);
    };
    this.el.panel.oninput = (e) => { const t = e.target; if (t.dataset.set) onClick && onClick('set', t.dataset, t); };
    this.el.panel.onchange = this.el.panel.oninput;
    this.game.input.releaseAll(); this.game.input.enabled = false;
  }
  closePanel() {
    if (!this.panelOpen) return;
    this.el.panelWrap.classList.add('hidden'); this.panelOpen = false; this.el.panel.innerHTML = '';
    this.game.input.enabled = true; this.game.onPanelClosed && this.game.onPanelClosed();
  }
  card(html, ms = 2600) {
    const c = this.el.card; c.innerHTML = html; c.classList.remove('hidden');
    clearTimeout(this.cardT); this.cardT = setTimeout(() => c.classList.add('hidden'), ms);
  }

  async fade(toBlack, info = null) {
    const f = this.el.fade;
    $('fade-kicker').textContent = info?.kicker || ''; $('fade-title').textContent = info?.title || '';
    $('fade-sub').textContent = info?.sub || ''; $('fade-rumor').textContent = info?.rumor || '';
    f.classList.toggle('out', !toBlack);
    await new Promise((r) => setTimeout(r, 950));
  }
}
