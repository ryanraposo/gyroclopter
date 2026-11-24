(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GyroInteractionField = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_PROFILE = Object.freeze({
    version: 1,
    gain: 1,
    magnetism: 0.24,
    radius: 150,
    categoryWeights: {
      button: 1.1,
      link: 1,
      input: 0.9,
      media: 1.15,
      menu: 1,
      generic: 0.85
    },
    accepted: 0,
    rejected: 0
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function normalizeProfile(profile) {
    const p = profile || {};
    const weights = Object.assign({}, DEFAULT_PROFILE.categoryWeights, p.categoryWeights || {});
    for (const key of Object.keys(weights)) weights[key] = clamp(finite(weights[key], 1), 0.35, 2.5);
    return {
      version: 1,
      gain: clamp(finite(p.gain, DEFAULT_PROFILE.gain), 0.45, 2.2),
      magnetism: clamp(finite(p.magnetism, DEFAULT_PROFILE.magnetism), 0, 0.7),
      radius: clamp(finite(p.radius, DEFAULT_PROFILE.radius), 70, 260),
      categoryWeights: weights,
      accepted: Math.max(0, Math.trunc(finite(p.accepted, 0))),
      rejected: Math.max(0, Math.trunc(finite(p.rejected, 0)))
    };
  }

  function classifyElement(el) {
    if (!el || !el.tagName) return 'generic';
    const tag = String(el.tagName).toLowerCase();
    const role = String(el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    const type = String(el.getAttribute && el.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return 'blocked';
    if (tag === 'button' || role === 'button' || type === 'button' || type === 'submit') return 'button';
    if (tag === 'a' || role === 'link') return 'link';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'textbox' || role === 'combobox') return 'input';
    if (tag === 'video' || tag === 'audio' || role === 'slider') return 'media';
    if (role === 'menuitem' || role === 'option' || role === 'tab') return 'menu';
    return 'generic';
  }

  function scoreTarget(position, target, profile) {
    const p = normalizeProfile(profile);
    const weight = p.categoryWeights[target.category] || p.categoryWeights.generic || 1;
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const distance = Math.hypot(dx, dy);
    const effectiveRadius = p.radius * clamp(weight, 0.5, 2);
    if (distance > effectiveRadius) return null;
    const proximity = 1 - (distance / effectiveRadius);
    const areaBoost = clamp(Math.sqrt(Math.max(1, target.area || 1)) / 180, 0.75, 1.35);
    return {
      target,
      distance,
      score: proximity * weight * areaBoost,
      dx,
      dy
    };
  }

  function apply(position, rawDelta, targets, profile, viewport) {
    const p = normalizeProfile(profile);
    const width = Math.max(1, finite(viewport && viewport.width, 1));
    const height = Math.max(1, finite(viewport && viewport.height, 1));
    const dx = clamp(finite(rawDelta && rawDelta.dx) * p.gain, -120, 120);
    const dy = clamp(finite(rawDelta && rawDelta.dy) * p.gain, -120, 120);
    let next = {
      x: clamp(finite(position && position.x, width / 2) + dx, 0, width - 1),
      y: clamp(finite(position && position.y, height / 2) + dy, 0, height - 1)
    };

    let best = null;
    for (const target of targets || []) {
      const scored = scoreTarget(next, target, p);
      if (scored && (!best || scored.score > best.score)) best = scored;
    }

    if (!best || p.magnetism <= 0) return { position: next, attraction: null };

    const pull = clamp(p.magnetism * best.score, 0, 0.42);
    const ax = best.dx * pull;
    const ay = best.dy * pull;
    next = {
      x: clamp(next.x + ax, 0, width - 1),
      y: clamp(next.y + ay, 0, height - 1)
    };

    return {
      position: next,
      attraction: {
        category: best.target.category,
        targetId: best.target.id,
        x: best.target.x,
        y: best.target.y,
        vector: { x: ax, y: ay },
        strength: pull
      }
    };
  }

  function accepted(profile, category) {
    const p = normalizeProfile(profile);
    const key = category && p.categoryWeights[category] != null ? category : 'generic';
    p.categoryWeights[key] = clamp(p.categoryWeights[key] + 0.025, 0.35, 2.5);
    p.magnetism = clamp(p.magnetism + 0.004, 0, 0.7);
    p.accepted += 1;
    return p;
  }

  function rejected(profile, category) {
    const p = normalizeProfile(profile);
    const key = category && p.categoryWeights[category] != null ? category : 'generic';
    p.categoryWeights[key] = clamp(p.categoryWeights[key] - 0.04, 0.35, 2.5);
    p.magnetism = clamp(p.magnetism - 0.008, 0, 0.7);
    p.rejected += 1;
    return p;
  }

  function isCorrection(rawDelta, attraction) {
    if (!attraction || !attraction.vector) return false;
    const rx = finite(rawDelta && rawDelta.dx);
    const ry = finite(rawDelta && rawDelta.dy);
    const ax = finite(attraction.vector.x);
    const ay = finite(attraction.vector.y);
    const rMag = Math.hypot(rx, ry);
    const aMag = Math.hypot(ax, ay);
    if (rMag < 1.5 || aMag < 0.5) return false;
    const cosine = (rx * ax + ry * ay) / (rMag * aMag);
    return cosine < -0.72;
  }

  return {
    DEFAULT_PROFILE,
    clamp,
    normalizeProfile,
    classifyElement,
    scoreTarget,
    apply,
    accepted,
    rejected,
    isCorrection
  };
});
