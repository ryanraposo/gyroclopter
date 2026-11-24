/**
 * Stable input command protocol.
 *
 * Transport messages from client.html are validated here and translated into
 * the platform-neutral command vocabulary consumed by input backends.
 */

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function dispatchInputMessage(data, controller, sensitivity = 1) {
  if (!data || typeof data.type !== 'string') return false;
  if (!controller || typeof controller.sendCommand !== 'function') return false;

  switch (data.type) {
    case 'move': {
      if (!isFiniteNumber(data.dx) || !isFiniteNumber(data.dy)) return false;
      const dx = Math.round(data.dx * sensitivity);
      const dy = Math.round(data.dy * sensitivity);
      controller.sendCommand(`MOVE ${dx} ${dy}`);
      return true;
    }
    case 'down':
      controller.sendCommand('LEFT_DOWN');
      return true;
    case 'up':
      controller.sendCommand('LEFT_UP');
      return true;
    case 'right':
      controller.sendCommand('CLICK_RIGHT');
      return true;
    case 'scroll':
      if (!isFiniteNumber(data.delta)) return false;
      controller.sendCommand(`SCROLL ${Math.trunc(data.delta)}`);
      return true;
    default:
      return false;
  }
}

module.exports = {
  dispatchInputMessage,
  isFiniteNumber
};
