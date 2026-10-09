// Keyboard + mouse (pointer lock) and touch controls (joystick, look pad, buttons).
import { store } from './util.js';

// touch buttons that act while held down (the jeep's pedals and steering)
const HOLD = new Set(['gas', 'brake', 'steerL', 'steerR']);

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.ui = ui;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.keys = {};
    this.fire = false; this.aim = false; this.sprint = false; this.crouch = false;
    this.pressed = new Set();
    this.hold = {};
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.settings = Object.assign({ sens: 1, touchSens: 1, invertY: false, btnScale: 1, leftHanded: false, bob: true, minimap: true, quality: 'auto' }, store('jls_settings') || {});
    this.enabled = false;
    this.editMode = false;
    this._joy = null; this._lookTouch = null; this._fireTouch = null;
    this._bindKeys(); this._bindMouse(); this._bindTouch();
  }

  saveSettings() { store('jls_settings', this.settings); }
  tap(a) { this.pressed.add(a); }
  consume(a) { const h = this.pressed.has(a); this.pressed.delete(a); return h; }

  _bindKeys() {
    const map = { KeyR: 'reload', KeyE: 'use', KeyF: 'torch', KeyQ: 'swap', KeyH: 'eat', KeyM: 'map', Escape: 'pause', KeyP: 'pause', Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4', Digit5: 'w5', Digit6: 'w6', Digit7: 'w7', KeyV: 'melee', KeyG: 'drive' };
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys[e.code] = true;
      if (map[e.code] && !e.repeat) this.tap(map[e.code]);
      if (e.code === 'KeyC' && !e.repeat) this.crouch = !this.crouch;
      if (e.code === 'ControlLeft') this.crouch = true;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; if (e.code === 'ControlLeft') this.crouch = false; });
  }

  _bindMouse() {
    const c = this.canvas;
    c.addEventListener('click', () => { if (this.enabled && !this.touch && document.pointerLockElement !== c) c.requestPointerLock?.(); });
    addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== c) return;
      const k = 0.0022 * this.settings.sens;
      this.look.x += e.movementX * k; this.look.y += e.movementY * k * (this.settings.invertY ? -1 : 1);
    });
    addEventListener('mousedown', (e) => {
      if (!this.enabled || document.pointerLockElement !== c) return;
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.aim = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; if (e.button === 2) this.aim = false; });
    addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    addEventListener('wheel', (e) => { if (this.enabled && document.pointerLockElement === c) this.tap('swap'); }, { passive: true });
  }

  pollKeys() {
    if (this.touch && !Object.values(this.keys).some(Boolean)) return;
    const k = this.keys;
    this.move.x = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    this.move.y = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    if (!this.touch) this.sprint = !!(k.ShiftLeft || k.ShiftRight);
  }

  // ---------- touch ----------
  _bindTouch() {
    const ui = this.ui;
    const joyBase = ui.querySelector('#joy'), joyKnob = ui.querySelector('#joyKnob');
    const zone = ui.querySelector('#touchZone');
    this.joyBase = joyBase; this.joyKnob = joyKnob;
    const R = 56;
    const btnOf = (t) => t.target.closest && t.target.closest('[data-act]');

    zone.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const leftSide = this.settings.leftHanded ? t.clientX > innerWidth * 0.55 : t.clientX < innerWidth * 0.45;
        if (leftSide && !this._joy) {
          this._joy = { id: t.identifier, x: t.clientX, y: t.clientY };
          joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px'; joyBase.classList.add('on');
          joyKnob.style.transform = 'translate(-50%,-50%)';
        } else if (!this._lookTouch) {
          this._lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });

    const moveH = (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (this._joy && t.identifier === this._joy.id) {
          let dx = t.clientX - this._joy.x, dy = t.clientY - this._joy.y;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          this.move.x = dx / R; this.move.y = -dy / R;
          // push far forward = sprint
          this.joySprint = -dy / R > 0.95 && d >= R;
          joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
        for (const L of [this._lookTouch, this._fireTouch]) {
          if (L && t.identifier === L.id) {
            const k = 0.0052 * this.settings.touchSens;
            this.look.x += (t.clientX - L.x) * k; this.look.y += (t.clientY - L.y) * k * (this.settings.invertY ? -1 : 1);
            L.x = t.clientX; L.y = t.clientY;
          }
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    const endH = (e) => {
      for (const t of e.changedTouches) {
        if (this._joy && t.identifier === this._joy.id) {
          this._joy = null; this.move.x = 0; this.move.y = 0; this.joySprint = false;
          joyBase.classList.remove('on');
        }
        if (this._lookTouch && t.identifier === this._lookTouch.id) this._lookTouch = null;
        if (this._fireTouch && t.identifier === this._fireTouch.id) { this._fireTouch = null; this.fire = false; }
      }
    };
    addEventListener('touchmove', moveH, { passive: false });
    addEventListener('touchend', endH); addEventListener('touchcancel', endH);

    // buttons
    ui.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (this.editMode) return this._dragStart(b, e.changedTouches[0]);
        if (!this.enabled) return;
        const a = b.dataset.act;
        b.classList.add('down');
        if (HOLD.has(a)) this.hold[a] = true;
        else if (a === 'fire') { this.fire = true; const t = e.changedTouches[0]; this._fireTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }
        else if (a === 'aim') this.aim = !this.aim;
        else if (a === 'sprint') this.sprint = !this.sprint;
        else if (a === 'crouch') this.crouch = !this.crouch;
        else this.tap(a);
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('down');
        if (this.editMode) return this._dragEnd();
        if (b.dataset.act === 'fire') { this.fire = false; this._fireTouch = null; }
        if (HOLD.has(b.dataset.act)) this.hold[b.dataset.act] = false;
      };
      b.addEventListener('touchend', up, { passive: false });
      if (HOLD.has(b.dataset.act)) b.addEventListener('touchcancel', up, { passive: false });
    });
    this.applyLayout();
  }

  // ---------- layout editing ----------
  _dragStart(b, t) {
    this._drag = { b, id: t.identifier };
    const mv = (e) => {
      for (const tt of e.changedTouches) if (tt.identifier === this._drag?.id) {
        const r = b.getBoundingClientRect();
        const right = Math.max(0, innerWidth - tt.clientX - r.width / 2), bottom = Math.max(0, innerHeight - tt.clientY - r.height / 2);
        b.style.right = (right / innerWidth * 100) + '%'; b.style.bottom = (bottom / innerHeight * 100) + '%';
        b.style.left = 'auto'; b.style.top = 'auto';
      }
    };
    this._mv = mv;
    addEventListener('touchmove', mv, { passive: false });
  }
  _dragEnd() {
    if (!this._drag) return;
    removeEventListener('touchmove', this._mv);
    const L = store('jls_layout') || {};
    const b = this._drag.b;
    L[b.dataset.act] = { right: b.style.right, bottom: b.style.bottom };
    store('jls_layout', L);
    this._drag = null;
  }
  resetLayout() { store('jls_layout', {}); this.ui.querySelectorAll('[data-act]').forEach((b) => { b.style.right = ''; b.style.bottom = ''; b.style.left = ''; b.style.top = ''; }); this.applyLayout(); }
  applyLayout() {
    const L = store('jls_layout') || {};
    this.ui.style.setProperty('--btn', this.settings.btnScale);
    this.ui.classList.toggle('lefty', !!this.settings.leftHanded);
    this.ui.querySelectorAll('[data-act]').forEach((b) => {
      const p = L[b.dataset.act];
      if (p) { b.style.right = p.right; b.style.bottom = p.bottom; b.style.left = 'auto'; b.style.top = 'auto'; }
    });
  }

  resetState() {
    this.move.x = this.move.y = 0; this.look.x = this.look.y = 0;
    this.fire = this.aim = this.sprint = this.crouch = false; this.pressed.clear(); this.keys = {}; this.hold = {};
    this._joy = this._lookTouch = this._fireTouch = null;
    this.joyBase?.classList.remove('on');
  }
}
