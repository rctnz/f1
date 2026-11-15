# connected components of a boolean mask (given as PIL "L" image, >0 = on); returns [(count, (x0,y0,x1,y1))] in source px
from PIL import Image
def components(mask, scale=4, minpix=6, join=1):
    W, H = mask.size
    small = mask.resize((max(1, W // scale), max(1, H // scale)), Image.BOX).point(lambda v: 255 if v > 0 else 0)
    w, h = small.size; px = small.load(); seen = bytearray(w * h); out = []
    nb = [(dx, dy) for dx in range(-join, join + 1) for dy in range(-join, join + 1) if dx or dy]
    for y in range(h):
        for x in range(w):
            if px[x, y] and not seen[y * w + x]:
                st = [(x, y)]; seen[y * w + x] = 1; bb = [x, y, x, y]; n = 0
                while st:
                    cx, cy = st.pop(); n += 1
                    if cx < bb[0]: bb[0] = cx
                    if cy < bb[1]: bb[1] = cy
                    if cx > bb[2]: bb[2] = cx
                    if cy > bb[3]: bb[3] = cy
                    for dx, dy in nb:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1; st.append((nx, ny))
                if n >= minpix: out.append((n, (bb[0] * scale, bb[1] * scale, (bb[2] + 1) * scale, (bb[3] + 1) * scale)))
    return sorted(out, key=lambda c: -c[0])
