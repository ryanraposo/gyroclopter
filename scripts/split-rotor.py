#!/usr/bin/env python3
"""Split gyroclopter-shell.png into a static body and a spinning rotor layer."""
import math
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'app/assets/gyroclopter-shell.png'
BODY = ROOT / 'app/assets/gyroclopter-body.png'
ROTOR = ROOT / 'app/assets/gyroclopter-rotor.png'

# Hub centre in the 1254x1254 source image; matches CSS transform-origin
# 33.85% 14.03% on the 720x720 displayed layer.
CX, CY = 424.5, 176.0
MIN_RADIUS, MAX_RADIUS = 40, 400
BLADE_SECTORS = ((-35.0, -5.0), (145.0, 175.0))  # degrees, y grows downward


def blade_pixel(x, y):
    dx, dy = x - CX, y - CY
    radius = math.hypot(dx, dy)
    if not MIN_RADIUS <= radius <= MAX_RADIUS:
        return False
    angle = math.degrees(math.atan2(dy, dx))
    return any(lo <= angle <= hi for lo, hi in BLADE_SECTORS)


def split():
    src = Image.open(SOURCE).convert('RGBA')
    body, rotor = src.copy(), Image.new('RGBA', src.size, (0, 0, 0, 0))
    src_px, body_px, rotor_px = src.load(), body.load(), rotor.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src_px[x, y]
            if a == 0 or (r > 245 and g > 245 and b > 245):
                continue
            if blade_pixel(x, y):
                rotor_px[x, y] = (r, g, b, a)
                body_px[x, y] = (0, 0, 0, 0)
    body.save(BODY)
    rotor.save(ROTOR)
    print(f'Wrote {BODY.relative_to(ROOT)} and {ROTOR.relative_to(ROOT)}')


def check():
    for path in (BODY, ROTOR):
        if not path.exists():
            raise SystemExit(
                f'MISSING {path.relative_to(ROOT)} (run: python3 scripts/split-rotor.py)'
            )
    src = Image.open(SOURCE).convert('RGBA')
    body = Image.open(BODY).convert('RGBA')
    rotor = Image.open(ROTOR).convert('RGBA')
    if body.size != src.size or rotor.size != src.size:
        raise SystemExit('SIZE_MISMATCH')
    if sum(rotor.getchannel('A').histogram()[1:]) < 10000:
        raise SystemExit('ROTOR_LAYER_EMPTY')
    if Image.alpha_composite(body, rotor).tobytes() != src.tobytes():
        raise SystemExit('RECOMPOSITE_MISMATCH')
    print('ROTOR_SPLIT_OK')


if __name__ == '__main__':
    (check if '--check' in sys.argv else split)()
