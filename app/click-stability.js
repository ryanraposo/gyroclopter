/**
 * Converts tiny movement during a left-button press into a stable click without
 * taking deliberate drag-and-drop away.
 *
 * Motion is accumulated while pressed. If the cursor never leaves the threshold,
 * the buffered motion is discarded on release. Once the threshold is crossed,
 * the complete buffered displacement is emitted and subsequent motion passes
 * through normally until release.
 */
class ClickStabilityGate {
  constructor(threshold = 8) {
    this.threshold = 0;
    this.pressed = false;
    this.dragCommitted = false;
    this.pendingX = 0;
    this.pendingY = 0;
    this.setThreshold(threshold);
  }

  setThreshold(value) {
    const numeric = Number(value);
    this.threshold = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
    if (this.threshold === 0) {
      this.pendingX = 0;
      this.pendingY = 0;
    }
    return this.threshold;
  }

  press() {
    this.pressed = true;
    this.dragCommitted = false;
    this.pendingX = 0;
    this.pendingY = 0;
  }

  filter(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;

    if (!this.pressed || this.threshold === 0 || this.dragCommitted) {
      return { dx, dy };
    }

    this.pendingX += dx;
    this.pendingY += dy;

    if (Math.hypot(this.pendingX, this.pendingY) < this.threshold) {
      return null;
    }

    this.dragCommitted = true;
    const movement = {
      dx: this.pendingX,
      dy: this.pendingY
    };
    this.pendingX = 0;
    this.pendingY = 0;
    return movement;
  }

  release() {
    const dragged = this.dragCommitted;
    this.pressed = false;
    this.dragCommitted = false;
    this.pendingX = 0;
    this.pendingY = 0;
    return { dragged };
  }
}

if (typeof window !== 'undefined') {
  window.ClickStabilityGate = ClickStabilityGate;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClickStabilityGate };
}
