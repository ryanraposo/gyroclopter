class FocusTranslator {
  constructor({ threshold = 36, interval = 120, idle = 300, now = Date.now } = {}) {
    if (![threshold, interval, idle].every(x => Number.isFinite(x) && x > 0)) throw Error('Invalid focus settings');
    Object.assign(this, { threshold, interval, idle, now }); this.reset();
  }
  reset() { this.x = this.y = 0; this.sample = this.step = -Infinity; }
  move(dx, dy) {
    if (![dx, dy].every(x => Number.isFinite(x) && Math.abs(x) <= 4096) || (!dx && !dy)) return null;
    const t = this.now();
    if (t - this.sample > this.idle) this.x = this.y = 0;
    this.sample = t;
    if (t - this.step < this.interval) return null;
    const clamp = x => Math.max(-2*this.threshold, Math.min(2*this.threshold, x));
    this.x = clamp(this.x + dx); this.y = clamp(this.y + dy);
    if (Math.max(Math.abs(this.x), Math.abs(this.y)) < this.threshold) return null;
    const direction = Math.abs(this.x) >= Math.abs(this.y) ? (this.x > 0 ? 'right' : 'left') : (this.y > 0 ? 'down' : 'up');
    this.x = this.y = 0; this.step = t;
    return { type: 'focus', direction };
  }
}
module.exports = { FocusTranslator };
