#!/usr/bin/env python3
"""Optimize game assets in place.

- Sprites/UI/doors/plants: mass-aware trim (ignores stray debris pixels far
  from the subject that inflate a naive alpha bbox), then downscale so the
  largest dimension fits a per-category cap, re-save as PNG.
- Backgrounds: convert to JPEG q82 (no alpha needed) and remove the old PNGs.

Originals are preserved in git history. Code draws everything with
size-targeted helpers (drawFit), so changing intrinsic resolution is safe.
"""
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')

# largest-dimension caps
CAPS = {
    'kitten_': 512,   # the star of the show gets the most pixels
    'door_': 448,
}
DEFAULT_CAP = 384

# fraction of alpha mass allowed outside the crop on each side
MASS_TAIL = 0.004


def cap_for(name: str) -> int:
    for prefix, cap in CAPS.items():
        if name.startswith(prefix):
            return cap
    return DEFAULT_CAP


def mass_bounds(vals, tail_frac):
    total = sum(vals)
    if total <= 0:
        return 0, len(vals) - 1
    tail = total * tail_frac
    acc = 0
    lo = 0
    for i, v in enumerate(vals):
        acc += v
        if acc > tail:
            lo = i
            break
    acc = 0
    hi = len(vals) - 1
    for i in range(len(vals) - 1, -1, -1):
        acc += vals[i]
        if acc > tail:
            hi = i
            break
    return lo, hi


def trim_and_scale(path: str) -> None:
    name = os.path.basename(path).replace('.png', '')
    im = Image.open(path).convert('RGBA')
    before = os.path.getsize(path)

    # Mass-aware trim: project thresholded alpha onto each axis (BOX resize
    # averages = density), then keep the 99.2% central mass. Stray specks and
    # distant sparkle debris contribute almost no mass, so they get cropped.
    a = im.getchannel('A').point(lambda v: 255 if v > 100 else 0)
    cols = list(a.resize((im.width, 1), Image.BOX).getdata())
    rows = list(a.resize((1, im.height), Image.BOX).getdata())
    x0, x1 = mass_bounds(cols, MASS_TAIL)
    y0, y1 = mass_bounds(rows, MASS_TAIL)
    if x1 > x0 and y1 > y0:
        pad = 10
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad),
                      min(im.width, x1 + pad + 1), min(im.height, y1 + pad + 1)))

    cap = cap_for(name)
    if max(im.size) > cap:
        scale = cap / max(im.size)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)

    im.save(path, optimize=True)
    after = os.path.getsize(path)
    print(f"  {name}: {before//1024}KB -> {after//1024}KB ({im.width}x{im.height})")


def convert_background(path: str) -> None:
    name = os.path.basename(path)
    im = Image.open(path).convert('RGB')
    before = os.path.getsize(path)
    out = path[:-4] + '.jpg'
    im.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    os.remove(path)
    after = os.path.getsize(out)
    print(f"  {name}: {before//1024}KB png -> {after//1024}KB jpg")


def main() -> None:
    print("Backgrounds -> JPEG:")
    bg_dir = os.path.join(ROOT, 'backgrounds')
    for f in sorted(os.listdir(bg_dir)):
        if f.endswith('.png'):
            convert_background(os.path.join(bg_dir, f))

    print("Sprites/UI/doors/plants -> trimmed + downscaled PNG:")
    for sub in ('sprites', 'ui', 'doors', 'plants'):
        d = os.path.join(ROOT, sub)
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                trim_and_scale(os.path.join(d, f))


if __name__ == '__main__':
    sys.exit(main())
