(() => {
  if (globalThis.__gyroclopterWebPilotInstalled) return;
  globalThis.__gyroclopterWebPilotInstalled = true;

  const Field = globalThis.GyroInteractionField;
  if (!Field) throw new Error('GyroInteractionField must be injected before content.js');

  const state = {
    armed: false,
    fullMode: false,
    leftDown: false,
    cursor: { x: Math.max(0, innerWidth / 2), y: Math.max(0, innerHeight / 2) },
    targets: [],
    targetElements: new Map(),
    profile: Field.normalizeProfile(),
    profileKey: `webPilotProfile:${location.origin}`,
    lastAttraction: null,
    lastAttractionAt: 0,
    lastTargetScanAt: 0,
    profileSaveTimer: null,
    dragTarget: null
  };

  const cursorEl = document.createElement('div');
  cursorEl.id = 'gyroclopter-web-cursor';
  cursorEl.hidden = true;
  const statusEl = document.createElement('div');
  statusEl.id = 'gyroclopter-web-status';
  statusEl.textContent = 'GYRO · ARMED';
  statusEl.hidden = true;
  document.documentElement.append(cursorEl, statusEl);

  function renderCursor() {
    cursorEl.style.transform = `translate3d(${state.cursor.x}px, ${state.cursor.y}px, 0)`;
    cursorEl.dataset.attracted = state.lastAttraction ? 'true' : 'false';
  }

  function isVisible(el, rect) {
    if (!rect || rect.width < 2 || rect.height < 2) return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0.02;
  }

  function interactiveCandidates() {
    return document.querySelectorAll([
      'button', 'a[href]', 'input:not([type="hidden"]):not([type="password"])', 'textarea', 'select',
      'video', 'audio', '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="option"]',
      '[role="tab"]', '[role="slider"]', '[role="textbox"]', '[role="combobox"]', '[tabindex]:not([tabindex="-1"])'
    ].join(','));
  }

  function scanTargets(force = false) {
    const now = performance.now();
    if (!force && now - state.lastTargetScanAt < 450) return;
    state.lastTargetScanAt = now;
    const targets = [];
    const elements = new Map();
    let id = 0;
    for (const el of interactiveCandidates()) {
      if (!(el instanceof Element)) continue;
      const category = Field.classifyElement(el);
      if (category === 'blocked') continue;
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, rect)) continue;
      const targetId = `t${id++}`;
      targets.push({
        id: targetId,
        category,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        area: Math.min(rect.width * rect.height, 240000)
      });
      elements.set(targetId, el);
      if (targets.length >= 350) break;
    }
    state.targets = targets;
    state.targetElements = elements;
  }

  async function loadProfile() {
    try {
      const stored = await chrome.storage.local.get(state.profileKey);
      state.profile = Field.normalizeProfile(stored[state.profileKey]);
    } catch (_) {
      state.profile = Field.normalizeProfile();
    }
  }

  function saveProfileSoon() {
    clearTimeout(state.profileSaveTimer);
    state.profileSaveTimer = setTimeout(() => {
      chrome.storage.local.set({ [state.profileKey]: state.profile }).catch(() => {});
    }, 250);
  }

  function learnRejectedIfCorrected(rawDelta) {
    if (!state.lastAttraction || performance.now() - state.lastAttractionAt > 220) return;
    if (!Field.isCorrection(rawDelta, state.lastAttraction)) return;
    state.profile = Field.rejected(state.profile, state.lastAttraction.category);
    state.lastAttraction = null;
    saveProfileSoon();
  }

  function learnAccepted() {
    const a = state.lastAttraction;
    if (!a || performance.now() - state.lastAttractionAt > 800) return;
    const distance = Math.hypot(state.cursor.x - a.x, state.cursor.y - a.y);
    if (distance > 70) return;
    state.profile = Field.accepted(state.profile, a.category);
    saveProfileSoon();
  }

  function targetAtCursor() {
    const el = document.elementFromPoint(state.cursor.x, state.cursor.y);
    if (!el || el === cursorEl || el === statusEl) return null;
    if (el.matches && el.matches('input[type="password"]')) return null;
    return el;
  }

  function emitMouse(target, type, button = 0, buttons = 0) {
    if (!target) return false;
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: state.cursor.x,
      clientY: state.cursor.y,
      screenX: state.cursor.x,
      screenY: state.cursor.y,
      button,
      buttons,
      view: window
    };
    try { target.dispatchEvent(new PointerEvent(type.replace('mouse', 'pointer'), Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, common))); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent(type, common)); } catch (_) {}
    return true;
  }

  function scrollAtCursor(delta) {
    let el = targetAtCursor();
    while (el && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const canScroll = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2;
      if (canScroll) {
        el.scrollBy({ top: -delta, left: 0, behavior: 'auto' });
        return;
      }
      el = el.parentElement;
    }
    window.scrollBy({ top: -delta, left: 0, behavior: 'auto' });
  }

  function standardInput(input) {
    if (input.type === 'down') {
      state.leftDown = true;
      state.dragTarget = targetAtCursor();
      emitMouse(state.dragTarget, 'mousedown', 0, 1);
      return;
    }
    if (input.type === 'up') {
      const under = targetAtCursor();
      const target = state.dragTarget || under;
      emitMouse(target, 'mouseup', 0, 0);
      if (under && target === under) {
        emitMouse(under, 'click', 0, 0);
        if (typeof under.click === 'function' && !['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(under.tagName)) {
          try { under.click(); } catch (_) {}
        }
      }
      state.leftDown = false;
      state.dragTarget = null;
      learnAccepted();
      return;
    }
    if (input.type === 'right') {
      const target = targetAtCursor();
      emitMouse(target, 'contextmenu', 2, 0);
      return;
    }
    if (input.type === 'scroll') {
      scrollAtCursor(input.delta);
    }
  }

  function handleInput(input) {
    if (!state.armed || !input || typeof input.type !== 'string') return { ok: false };

    if (input.type === 'move') {
      scanTargets();
      const rawDelta = { dx: Number(input.dx) || 0, dy: Number(input.dy) || 0 };
      learnRejectedIfCorrected(rawDelta);
      const result = Field.apply(state.cursor, rawDelta, state.targets, state.profile, {
        width: innerWidth,
        height: innerHeight
      });
      state.cursor = result.position;
      state.lastAttraction = result.attraction;
      state.lastAttractionAt = performance.now();
      renderCursor();
      if (!state.fullMode && state.leftDown) {
        const drag = state.dragTarget || targetAtCursor();
        emitMouse(drag, 'mousemove', 0, 1);
      }
    } else if (state.fullMode) {
      if (input.type === 'down') state.leftDown = true;
      if (input.type === 'up') { state.leftDown = false; learnAccepted(); }
    } else {
      standardInput(input);
    }

    return {
      ok: true,
      x: Math.round(state.cursor.x),
      y: Math.round(state.cursor.y),
      buttons: state.leftDown ? 1 : 0,
      attracted: Boolean(state.lastAttraction)
    };
  }

  function disarm() {
    state.armed = false;
    state.leftDown = false;
    state.dragTarget = null;
    state.lastAttraction = null;
    cursorEl.hidden = true;
    statusEl.hidden = true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'GYRO_ARM') {
      state.fullMode = Boolean(message.fullMode);
      state.armed = true;
      state.leftDown = false;
      cursorEl.hidden = false;
      statusEl.hidden = false;
      statusEl.textContent = state.fullMode ? 'GYRO · FULL CONTROL' : 'GYRO · WEB PILOT';
      scanTargets(true);
      renderCursor();
      sendResponse({ ok: true, x: state.cursor.x, y: state.cursor.y });
      return;
    }
    if (message.type === 'GYRO_DISARM') {
      disarm();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'GYRO_INPUT') {
      sendResponse(handleInput(message.input));
      return;
    }
    if (message.type === 'GYRO_RESET_PROFILE') {
      state.profile = Field.normalizeProfile();
      chrome.storage.local.remove(state.profileKey).catch(() => {});
      sendResponse({ ok: true });
    }
  });

  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.armed) return;
    disarm();
    chrome.runtime.sendMessage({ type: 'GYRO_ESCAPE_DISARM' }).catch(() => {});
  }, true);

  addEventListener('resize', () => {
    state.cursor.x = Field.clamp(state.cursor.x, 0, Math.max(0, innerWidth - 1));
    state.cursor.y = Field.clamp(state.cursor.y, 0, Math.max(0, innerHeight - 1));
    state.lastTargetScanAt = 0;
    renderCursor();
  });

  const observer = new MutationObserver(() => { state.lastTargetScanAt = 0; });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['role', 'tabindex', 'disabled', 'hidden'] });

  loadProfile();
})();
