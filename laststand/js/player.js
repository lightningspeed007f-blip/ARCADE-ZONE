// Player controller: walking, sprinting, crouching, stairs, falls,
// gentle head-bob and footsteps that change with the surface underfoot.
// The eye (this.cam) is where the game looks from; the picture is drawn from a third-person
// camera behind the body (placeThirdPerson), and the body itself is this.body.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

// third-person camera: distance behind the eye, shoulder offset to the right, and how far ahead
// the view converges on (the crosshair aims at that point, so shots still land where it points)
const TP_DIST = 2.6, TP_SHOULDER = 0.42, TP_RISE = 0.2, TP_AIM = 14;
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(), _aim = new THREE.Vector3();

export class Player {
  constructor(camera, physics, audio) {
    this.cam = camera; this.P = physics; this.audio = audio;
    this.pos = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector2();
    this.state = { vy: 0, peak: 0, fall: 0 };
    this.onGround = true;
    this.health = 100; this.maxHealth = 100;
    this.stamina = 100;
    this.eye = 1.62; this.eyeTarget = 1.62;
    this.radius = 0.32;
    this.bobT = 0; this.bobAmt = 0; this.stepAcc = 0;
    this.recoil = { x: 0, y: 0 };
    this.shake = 0;
    this.distance = 0;
    this.noise = 0;      // how loud the player is right now (metres of hearing radius)
    this.crouched = false;
    this.speedNow = 0;
    this.dead = false;
    this.hurtT = 0;
    this.smoothY = 0;
    this.body = null;    // the player's own model, set once it has loaded
  }

  spawn(x, y, z, yaw) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z; this.yaw = yaw; this.pitch = 0;
    this.smoothY = y; this.state.peak = y; this.state.vy = 0;
  }

  surfaceAt(world) {
    if (this.pos.y > 0.6) return world.indoorFloor(this.pos) || 'tile';
    return world.surface(this.pos.x, this.pos.z);
  }

  update(dt, input, world, weapon) {
    // look
    const ads = weapon && weapon.adsT > 0.5;
    const lookK = ads ? 0.6 : 1;
    this.yaw -= input.look.x * lookK; this.pitch -= input.look.y * lookK;
    input.look.x = 0; input.look.y = 0;
    // recoil recovers smoothly
    this.pitch += this.recoil.y * dt * 10; this.yaw += this.recoil.x * dt * 10;
    this.recoil.y *= Math.pow(0.0005, dt); this.recoil.x *= Math.pow(0.0005, dt);
    this.pitch = clamp(this.pitch, -1.45, 1.45);

    // crouch
    this.crouched = input.crouch;
    if (!this.crouched && this.eyeTarget < 1.6) {
      // only stand if there is headroom
      const clear = !this.P.raycast(this.pos.x, this.pos.y + 1.0, this.pos.z, 0, 1, 0, 0.85);
      if (!clear) this.crouched = true;
    }
    this.eyeTarget = this.crouched ? 1.05 : 1.62;
    this.eye = lerp(this.eye, this.eyeTarget, 1 - Math.exp(-dt * 12));

    // move
    let mx = input.move.x, my = input.move.y;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const wantSprint = (input.sprint || input.joySprint) && my > 0.3 && !this.crouched && !ads;
    const sprinting = wantSprint && this.stamina > 2;
    if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 16);
    else this.stamina = Math.min(100, this.stamina + dt * (ml > 0.1 ? 9 : 16));
    let speed = this.crouched ? 1.7 : sprinting ? 5.8 : 3.4;
    if (ads) speed *= 0.6;
    if (this.health < 25) speed *= 0.85;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // forward = -Z rotated by yaw
    const tx = (-s * my + c * mx) * speed, tz = (-c * my - s * mx) * speed;
    const accel = this.onGround ? 14 : 3;
    this.vel.x = lerp(this.vel.x, tx, 1 - Math.exp(-dt * accel));
    this.vel.y = lerp(this.vel.y, tz, 1 - Math.exp(-dt * accel));
    const ox = this.pos.x, oz = this.pos.z, oy = this.pos.y;
    const h = this.crouched ? 1.2 : 1.75;
    this.onGround = this.P.moveCharacter(this.pos, this.vel.x * dt, this.vel.y * dt, this.state.vy, dt, this.radius, h, 0.45, this.state);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.distance += moved;
    this.speedNow = moved / Math.max(dt, 1e-4);
    // fall damage
    if (this.onGround && this.state.fall > 3.6) {
      const dmg = (this.state.fall - 3.6) * 16;
      this.state.fall = 0;
      if (dmg > 1) { this.damage(dmg, null, 'fall'); this.audio.play('slam', { vol: 0.7 }); this.shake = 0.6; }
    }
    this.state.fall = 0;

    // smooth stair stepping
    const dy = this.pos.y - oy;
    if (dy > 0 && dy < 0.5 && this.onGround) this.smoothY = lerp(this.smoothY, this.pos.y, 1 - Math.exp(-dt * 18));
    else this.smoothY = this.pos.y;
    if (Math.abs(this.smoothY - this.pos.y) > 0.6) this.smoothY = this.pos.y;

    // bob + footsteps
    const moving = this.onGround && this.speedNow > 0.6;
    this.bobAmt = lerp(this.bobAmt, moving ? Math.min(1, this.speedNow / 5) : 0, 1 - Math.exp(-dt * 8));
    // recorded walk / run loop (falls back to the generated steps below if the files are missing)
    const footRec = moving && !(world.stepsMuted && world.stepsMuted()) &&
      this.audio.footLoop(sprinting ? 'run' : 'walk', this.crouched ? 0.35 : sprinting ? 0.8 : 0.6);
    if (moving) {
      const freq = sprinting ? 2.25 : this.crouched ? 1.25 : 1.8;
      this.bobT += dt * freq * Math.PI * 2;
      this.stepAcc += dt * freq * 2;
      if (this.stepAcc >= 1) {
        this.stepAcc = 0;
        // no footstep sounds while a tunnel's music is playing (Shivdham, Kalidham)
        if (!footRec && !(world.stepsMuted && world.stepsMuted())) {
          const surf = this.surfaceAt(world);
          this.audio.play('step_' + surf, { vol: this.crouched ? 0.25 : sprinting ? 0.75 : 0.5, verb: false });
        }
      }
    }
    this.noise = !moving ? 0 : this.crouched ? 1.5 : sprinting ? 11 : 5;

    // camera
    const bob = input.settings.bob ? 1 : 0.3;
    const by = Math.sin(this.bobT * 2) * 0.028 * this.bobAmt * bob;
    const bx = Math.cos(this.bobT) * 0.018 * this.bobAmt * bob;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.04;
    this.cam.position.set(this.pos.x + bx * c + (Math.random() - 0.5) * sh, this.smoothY + this.eye + by + (Math.random() - 0.5) * sh, this.pos.z - bx * s);
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bobT) * 0.004 * this.bobAmt * bob);
    if (this.body) { this.body.position.set(this.pos.x, this.smoothY, this.pos.z); this.body.rotation.y = this.yaw + Math.PI; this.animate(dt, moving, sprinting, my, weapon); }
    this.hurtT = Math.max(0, this.hurtT - dt);
    return { sprinting, moving };
  }

  // the body's clips (models/player.glb). A new pose must be wanted for 0.15 s before it takes over,
  // so sprint / step flickering on and off for a frame no longer makes the body twitch between clips.
  animate(dt, moving, sprinting, my, weapon) {
    const B = this.body; if (!B.acts) return;
    this.throwT = Math.max(0, (this.throwT || 0) - dt);
    const armed = weapon && !weapon.w.melee;
    const k = this.throwT > 0 ? 'throw' : this.crouched ? 'crouch' : !moving ? (armed ? 'aim' : 'idle') : my < -0.3 ? 'back' : sprinting ? 'run' : 'pistol';
    if (k !== B.want) { B.want = k; B.wantT = 0; } else B.wantT += dt;
    const a = B.acts[k];
    if (B.cur !== a && (k === 'throw' || B.wantT > 0.15)) {
      if (B.cur) B.cur.fadeOut(0.25);
      a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(0.25).play();
      if (k === 'throw') a.time = 1.1;   // wind-up starts here; the hand is at the top (release) at 2.0 s
      B.cur = a;
    }
    const c = B.cur;
    if (c) c.timeScale = c === B.acts.throw ? 1.5 : moving || c === B.acts.idle || c === B.acts.aim ? 1 : 0;
    B.mixer.update(dt);
    // the bomb sits in the right hand until it is let go
    if (!B.nade) { B.nade = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8a6a3a })); B.parent.add(B.nade); }
    B.nade.visible = !!(B.hand && weapon && weapon.throwT > 0 && weapon.releaseT > 0);
    if (B.nade.visible) B.hand.getWorldPosition(B.nade.position);
  }

  // Third person: the picture comes from a camera over the right shoulder, behind the eye. It looks
  // at a point ahead along the aim, so the crosshair still marks where the shots go. Walls pull it in.
  placeThirdPerson(tp) {
    const cam = this.cam, e = cam.position;
    cam.getWorldDirection(_fwd);
    _right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    let d = TP_DIST;
    const hit = this.P.raycast(e.x, e.y, e.z, -_fwd.x, -_fwd.y, -_fwd.z, d + 0.25);
    if (hit) d = Math.max(0.6, hit.t - 0.25);
    tp.position.copy(e).addScaledVector(_fwd, -d).addScaledVector(_right, TP_SHOULDER).addScaledVector(_up, TP_RISE);
    tp.updateMatrixWorld();
    tp.lookAt(_aim.copy(e).addScaledVector(_fwd, TP_AIM));
    if (tp.fov !== cam.fov || tp.far !== cam.far) { tp.fov = cam.fov; tp.far = cam.far; tp.updateProjectionMatrix(); }
  }

  // where the gun is held: the body's right hand, a little in front of the chest
  handAt(out) {
    if (this.body && this.body.hand && this.body.visible) return this.body.hand.getWorldPosition(out);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return out.set(this.pos.x + c * 0.22 - s * 0.2, this.smoothY + 1.3, this.pos.z - s * 0.22 - c * 0.2);
  }

  damage(n, from, kind) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - n);
    this.hurtT = 0.5;
    this.lastHit = { from, kind, t: performance.now() };
    if (this.health <= 0) this.dead = true;
  }

  heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }

  forward(out) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
}
