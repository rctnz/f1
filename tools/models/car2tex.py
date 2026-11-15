# Livery clean-up for the second car model: every real brand mark comes off, the team's own A10 goes on.
# usage: python -I car2tex.py <textures dir (from tex.mjs)> <out dir> <tools dir>
import sys, os
sys.path.insert(0, sys.argv[3])
from cc import components
from PIL import Image, ImageDraw, ImageFont

src, out, tools = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
FONT = os.path.join(tools, "kanit-black-italic.woff2")   # the site's own poster face
YELLOW = (255, 214, 10)
WHITE = (236, 240, 244)

def a10(box_w, box_h, fill):
    """'A10' in Kanit Black Italic, as large as fits the box."""
    size = int(box_h * 1.6)
    while size > 8:
        f = ImageFont.truetype(FONT, size)
        l, t, r, b = f.getbbox("A10")
        if (r - l) <= box_w and (b - t) <= box_h: break
        size -= 2
    im = Image.new("RGBA", (r - l + 8, b - t + 8), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4 - l, 4 - t), "A10", font=f, fill=fill)
    return im.crop(im.getbbox())

def mask_where(im, f, box=None):
    W, H = im.size; px = im.load(); m = Image.new("L", (W, H), 0); mp = m.load()
    x0, y0, x1, y1 = box or (0, 0, W, H)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if f(*px[x, y][:3]): mp[x, y] = 255
    return m

# ---- body paint: the anniversary badge and the tricolore come off, A10 goes on the black band
ch = Image.open(os.path.join(src, "36.png")).convert("RGB"); px = ch.load()
grey = lambda r, g, b: (min(r, g, b) > 34 and max(r, g, b) - min(r, g, b) < 70) or (g > 60 and g > r * 0.8)
for (x0, y0, x1, y1) in [(1530, 8, 1700, 106), (1030, 478, 1160, 574)]:
    for y in range(y0, y1):
        for x in range(x0, x1):
            if grey(*px[x, y]): px[x, y] = (9, 9, 10)
stripe = lambda r, g, b: (g > 60 and g > r * 0.8) or min(r, g, b) > 120 or (r > 165 and g < 80 and b < 80)
for (x0, y0, x1, y1) in [(1480, 102, 1800, 130), (940, 572, 1220, 602)]:
    for y in range(y0, y1):
        for x in range(x0, x1):
            if stripe(*px[x, y]): px[x, y] = WHITE
for (cx, cy) in [(1606, 62), (1086, 528)]:
    g = a10(150, 60, WHITE + (255,))
    ch.paste(g, (cx - g.width // 2, cy - g.height // 2), g)
ch.save(os.path.join(out, "chassis.png"))

# ---- tyres: maker lettering and barcodes come off; the compound bands stay and turn A10 yellow
ty = Image.open(os.path.join(src, "06.png")).convert("RGB"); px = ty.load()
white = mask_where(ty, lambda r, g, b: r > 95 and g > 95 and b > 95)
bands = Image.new("L", ty.size, 0)
for n, (x0, y0, x1, y1) in components(white, 4, 4, 2):
    if x1 - x0 >= 420 and y1 - y0 <= 56: ImageDraw.Draw(bands).rectangle((x0 - 4, y0 - 4, x1 + 4, y1 + 4), fill=255)
bp = bands.load(); wp = white.load()
W, H = ty.size
# anything light outside a band is lettering: grow it a little and paint it rubber
grow = white.filter(__import__("PIL.ImageFilter", fromlist=["x"]).MaxFilter(13)); gp = grow.load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if bp[x, y]:
            if r > 60: l = (r + g + b) / 765; px[x, y] = tuple(int(c * l) for c in YELLOW)
        elif gp[x, y]: px[x, y] = px[6, y]   # column 6 is clean rubber on every row
ty.save(os.path.join(out, "tyre.png"))

# ---- rim covers and wheel nuts: the lime becomes A10 yellow, the blue ring goes graphite
for name, outname in [("05.png", "rim.png"), ("04.png", "nut.png")]:
    im = Image.open(os.path.join(src, name)).convert("RGB"); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            if g > 120 and r > 90 and b < g * 0.6: l = min(1, (r + g) / 400); px[x, y] = tuple(int(c * l) for c in YELLOW)
            elif b > r + 25 and b > g + 10: v = int(b * 0.42); px[x, y] = (v, v, int(v * 1.08))
    im.save(os.path.join(out, outname))

# ---- seat belt: maker name off the webbing
bl = Image.open(os.path.join(src, "16.png")).convert("RGB"); px = bl.load()
ys = [px[x, y] for y in range(10, 150, 7) for x in range(10, 500, 11) if px[x, y][0] > 150 and px[x, y][1] > 130 and px[x, y][2] < 110]
yel = tuple(sorted(c[i] for c in ys)[len(ys) // 2] for i in range(3)) if ys else (220, 200, 30)
for y in range(0, 168):
    for x in range(bl.width):
        r, g, b = px[x, y]
        if y < 160 and (r + g + b < 520 or abs(r - yel[0]) > 26): px[x, y] = yel
bl.save(os.path.join(out, "belt.png"))

# ---- steering wheel in the cockpit: the two horse badges become plain yellow
sw = Image.open(os.path.join(src, "32.png")).convert("RGB"); d = ImageDraw.Draw(sw)
for (cx, cy, r) in [(107, 545, 97), (200, 850, 93)]:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(250, 208, 12))
    g = a10(int(r * 1.25), int(r * 0.5), (16, 16, 18, 255)); sw.paste(g, (cx - g.width // 2, cy - g.height // 2), g)
sw.save(os.path.join(out, "swdecals.png"))

# ---- cockpit plates: maker plate and the scrutineering plate go blank
ck = Image.open(os.path.join(src, "20.png")).convert("RGB"); d = ImageDraw.Draw(ck)
d.rectangle((0, 858, 508, 1023), fill=(46, 46, 48))
d.rectangle((606, 538, 996, 744), fill=(0, 0, 0))
ck.save(os.path.join(out, "cockpitdecals.png"))

# ---- decal sheet: everything transparent except A10 where the race number was
dc = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
for (x0, y0, x1, y1) in [(44, 284, 448, 532), (780, 1220, 1016, 1364)]:
    g = a10(x1 - x0 - 8, y1 - y0 - 8, WHITE + (255,))
    dc.alpha_composite(g, (x0 + (x1 - x0 - g.width) // 2, y0 + (y1 - y0 - g.height) // 2))
dc.save(os.path.join(out, "decals_a10.png"))
print("ok")
