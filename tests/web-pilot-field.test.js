const Field = require('../web-pilot/interaction-field');

describe('Web Pilot interaction field', () => {
  test('attracts gently toward a nearby useful target', () => {
    const profile = Field.normalizeProfile();
    const result = Field.apply(
      { x: 100, y: 100 },
      { dx: 8, dy: 0 },
      [{ id: 'b', category: 'button', x: 130, y: 100, area: 2400 }],
      profile,
      { width: 800, height: 600 }
    );
    expect(result.position.x).toBeGreaterThan(108);
    expect(result.attraction).not.toBeNull();
  });

  test('learning stays bounded and reversible', () => {
    let p = Field.normalizeProfile();
    for (let i=0;i<200;i++) p = Field.accepted(p, 'button');
    expect(p.magnetism).toBeLessThanOrEqual(0.7);
    for (let i=0;i<200;i++) p = Field.rejected(p, 'button');
    expect(p.magnetism).toBeGreaterThanOrEqual(0);
    expect(p.categoryWeights.button).toBeGreaterThanOrEqual(0.35);
  });

  test('detects a correction against attraction', () => {
    expect(Field.isCorrection(
      { dx: -8, dy: 0 },
      { vector: { x: 4, y: 0 } }
    )).toBe(true);
  });
});
