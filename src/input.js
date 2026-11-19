// Reward Stairs — keyboard, on-screen pads (touch) and gamepad merged into one sample per frame.
//   sample() -> { left, right, jumpPressed, start, restart, mute }   (jumpPressed/start/restart/mute are one-frame edges)
export class Input {
  constructor() {
    this.keys = new Set(); this.edges = new Set(); this.pad = { left: false, right: false }; this.padPrev = {}; this.touch = false;
    const L = ['ArrowLeft', 'KeyA'], R = ['ArrowRight', 'KeyD'], J = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
    addEventListener('keydown', e => {
      if ([...L, ...R, ...J, 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (J.includes(e.code)) this.edges.add('jump');
        if (e.code === 'KeyR') this.edges.add('restart');
        if (e.code === 'KeyM') this.edges.add('mute');
        if (!e.metaKey && !e.ctrlKey) this.edges.add('start');
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.pad.left = this.pad.right = false; });
    this.L = L; this.R = R;
    // anywhere: a tap/click starts the game
    addEventListener('pointerdown', e => {
      if (e.target.closest?.('.btn, #mute')) return;
      if (e.pointerType !== 'mouse' && !this.touch) { this.touch = true; document.getElementById('pads').classList.add('on'); }
      this.edges.add('start');
    });
    const bind = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } el.classList.add('down'); down(); });
      const off = () => { el.classList.remove('down'); up(); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    };
    bind('padL', () => { this.pad.left = true; }, () => { this.pad.left = false; });
    bind('padR', () => { this.pad.right = true; }, () => { this.pad.right = false; });
    bind('padJ', () => this.edges.add('jump'), () => {});
  }
  sample() {
    const k = this.keys;
    const s = {
      left: this.L.some(c => k.has(c)) || this.pad.left,
      right: this.R.some(c => k.has(c)) || this.pad.right,
      jumpPressed: this.edges.has('jump'), start: this.edges.has('start'), restart: this.edges.has('restart'), mute: this.edges.has('mute'),
    };
    this.edges.clear();
    const gp = navigator.getGamepads?.()[0];
    if (gp) {
      const b = i => !!gp.buttons[i]?.pressed, edge = i => b(i) && !this.padPrev[i], ax = gp.axes[0] || 0;
      s.left ||= ax < -0.35 || b(14); s.right ||= ax > 0.35 || b(15);
      s.jumpPressed ||= edge(0); s.start ||= edge(9) || edge(0);
      for (const i of [0, 9]) this.padPrev[i] = b(i);
    }
    return s;
  }
}
