const { ClickStabilityGate } = require('../app/click-stability');

describe('ClickStabilityGate', () => {
  test('passes normal pointing motion through untouched', () => {
    const gate = new ClickStabilityGate(8);
    expect(gate.filter(3, -2)).toEqual({ dx: 3, dy: -2 });
  });

  test('discards click wobble that stays inside the threshold', () => {
    const gate = new ClickStabilityGate(8);
    gate.press();

    expect(gate.filter(2, 1)).toBeNull();
    expect(gate.filter(-1, 2)).toBeNull();
    expect(gate.filter(1, -1)).toBeNull();
    expect(gate.release()).toEqual({ dragged: false });

    expect(gate.filter(2, 0)).toEqual({ dx: 2, dy: 0 });
  });

  test('commits buffered movement once a deliberate drag crosses the threshold', () => {
    const gate = new ClickStabilityGate(8);
    gate.press();

    expect(gate.filter(3, 2)).toBeNull();
    expect(gate.filter(4, 4)).toEqual({ dx: 7, dy: 6 });
    expect(gate.filter(2, -1)).toEqual({ dx: 2, dy: -1 });
    expect(gate.release()).toEqual({ dragged: true });
  });

  test('zero disables click stability', () => {
    const gate = new ClickStabilityGate(0);
    gate.press();

    expect(gate.filter(1, 0)).toEqual({ dx: 1, dy: 0 });
    expect(gate.filter(0, 1)).toEqual({ dx: 0, dy: 1 });
  });
});
