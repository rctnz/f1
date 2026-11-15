// The film: every 3D shot of the page rendered ahead of time, for browsers where the live stage cannot run.
//   node capture.mjs <dev url, e.g. http://localhost:3100/> <out dir, e.g. ../../public/film>
// Needs `npm run dev` running (the dev build exposes window.__stage, __stageHooks and __anchors), Chrome with a
// graphics card, and puppeteer-core + sharp installed where this is run. It sets the stage's numbers directly,
// photographs the canvas with the page hidden, crops each reel to what it uses, and writes WebP frames plus
// manifest.json, which components/stage/film.ts plays back from the same numbers.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';

const [url, out] = process.argv.slice(2);
const W = 1920, H = 945, SCALE = 0.6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', `--window-size=${W},${H}`],
});
const reels = {};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.stage === 'on' && window.__stage && window.__stageHooks.groundOpacity, { timeout: 60000 });
  await sleep(5000); // the steering wheel loads after the car
  // where the page's own layout leaves the car at the end of the calendar
  const cal = await page.evaluate(async () => {
    const el = document.querySelector('#machine');
    const top = (el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el).getBoundingClientRect().top + scrollY;
    window.__lenis.scrollTo(top, { immediate: true, force: true });
    await new Promise((r) => setTimeout(r, 1500));
    const s = window.__stage;
    const v = { calX: s.calX, calY: s.calY, calRun: s.calRun };
    window.__lenis.scrollTo(0, { immediate: true, force: true });
    await new Promise((r) => setTimeout(r, 1500));
    return v;
  });
  console.log('calendar ends at', JSON.stringify(cal));
  await page.addStyleTag({ content: 'body > *:not([class*=stage]) { visibility: hidden !important; } nextjs-portal { display: none !important; } html, body { background: transparent !important; }' });

  const BASE = { act: 'car', arrive: 1, launch: 1, chase: 1, orbit: 0, away: 0, toCal: 0, calX: 0, calY: cal.calY, calRun: 0, pit: 0, explode: 0, focus: -1, focusK: 0, wheelIn: 1, wheelBeat: 0, wheelOut: 0 };
  const shot = async (state, ground = 1) => {
    await page.evaluate((state, ground) => { Object.assign(window.__stage, state); window.__stageHooks.groundOpacity(ground); }, { ...BASE, ...state }, ground);
    await sleep(140); // two draws: the second one has no motion blur left in it
    const png = await page.screenshot({ omitBackground: true });
    const anchors = await page.evaluate(() => window.__anchors.car.map((p) => [Math.round(p.x), Math.round(p.y)]));
    return { png, anchors };
  };

  // lap: the chase from where the side shot takes over, one lap of the camera, the car pulling away
  reels.lap = [];
  for (let i = 0; i <= 8; i++) reels.lap.push(await shot({ chase: 0.4 + i * 0.075 }));
  for (let j = 1; j <= 36; j++) reels.lap.push(await shot({ orbit: j / 36 }));
  for (let k = 1; k <= 8; k++) reels.lap.push(await shot({ orbit: 1, away: k / 8 }));
  // calendar: the road on its own, and the car on its own at the middle of the screen
  const run = { orbit: 1, away: 1, toCal: 1 };
  reels.road = [await shot({ ...run, calX: -6000 })];
  reels.car = [await shot({ ...run, calX: W / 2 }, 0)];
  // exploded view: the camera coming round from where the calendar left the car, then the car coming apart
  const end = { ...run, ...cal };
  reels.pit = [];
  for (let i = 1; i <= 12; i++) reels.pit.push(await shot({ ...end, pit: i / 12 }));
  for (let j = 1; j <= 24; j++) reels.pit.push(await shot({ ...end, pit: 1, explode: j / 24 }));
  // steering wheel: ten frames to a beat, the team and then each driver
  reels.wheel = [];
  for (let i = 0; i <= 50; i++) reels.wheel.push(await shot({ ...end, pit: 1, act: 'wheel', wheelBeat: i / 10 }));
  reels.calY = cal.calY;
} finally {
  await browser.close();
}

// crop each reel to the pixels it ever uses, scale down, write
fs.rmSync(out, { recursive: true, force: true });
const manifest = { ref: [W, H], scale: SCALE };
let bytes = 0;
for (const name of ['lap', 'road', 'car', 'pit', 'wheel']) {
  const frames = reels[name];
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const f of frames) {
    const { data } = await sharp(f.png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[y * W + x] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(W, x1 + 6); y1 = Math.min(H, y1 + 6);
  const box = [x0, y0, x1 - x0, y1 - y0];
  const many = frames.length > 1;
  if (many) fs.mkdirSync(`${out}/${name}`, { recursive: true }); else fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < frames.length; i++) {
    const file = many ? `${out}/${name}/${String(i).padStart(2, '0')}.webp` : `${out}/${name}.webp`;
    const buf = await sharp(frames[i].png).extract({ left: box[0], top: box[1], width: box[2], height: box[3] }).resize({ width: Math.round(box[2] * SCALE) }).webp({ quality: 72, alphaQuality: 82, effort: 5 }).toBuffer();
    fs.writeFileSync(file, buf);
    bytes += buf.length;
  }
  manifest[name] = { box, n: frames.length };
  console.log(name, frames.length, 'frames, box', box.join(','));
}
manifest.lap.parts = [9, 36, 8]; // chase from 0.4, orbit, away
manifest.pit.parts = [12, 24]; // camera move, coming apart
manifest.pit.anchors = reels.pit.map((f) => f.anchors);
manifest.car.at = [W / 2, Math.round(reels.calY)]; // where the car's own point sat when car.webp was taken
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest));
console.log('wrote', out, (bytes / 1e6).toFixed(1) + ' MB');
