# Tileable asphalt grain for the track: python asphalt.py <out.webp>
# Three scales of noise (aggregate, patches, a trace of long wear) plus a scatter of pale stones; every layer wraps.
import random, sys
from PIL import Image, ImageChops, ImageFilter

N = 512
rnd = random.Random(10)

def noise(n):
    im = Image.new("L", (n, n))
    im.putdata([rnd.randrange(256) for _ in range(n * n)])
    return im

def wrap(im, size, blur):
    """scale a small tile up to size x size and blur it, wrapping at the edges so the result still tiles"""
    n = im.width
    big = Image.new("L", (n * 3, n * 3))
    for x in range(3):
        for y in range(3):
            big.paste(im, (x * n, y * n))
    big = big.resize((size * 3, size * 3), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))
    return big.crop((size, size, size * 2, size * 2))

fine = wrap(noise(N), N, 0.6)
mid = wrap(noise(N // 6), N, 2.0)
coarse = wrap(noise(N // 40), N, 10.0)

out = Image.new("L", (N, N))
f, m, c = fine.load(), mid.load(), coarse.load()
px = out.load()
for y in range(N):
    for x in range(N):
        v = 0.62 * f[x, y] + 0.30 * m[x, y] + 0.08 * c[x, y]
        px[x, y] = max(0, min(255, int((v - 128) * 2.0 + 120)))

# pale stones in the mix
stones = noise(N).point(lambda v: 255 if v > 250 else 0)
stones = wrap(stones, N, 0.7).point(lambda v: min(255, v * 3))
out = ImageChops.add(out, stones.point(lambda v: int(v * 0.55)))

out.save(sys.argv[1], "WEBP", quality=72, method=6)
print(sys.argv[1], out.size, out.getextrema())
