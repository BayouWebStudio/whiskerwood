// Interactive smoke test — drives the real game in headless Chrome.
// Usage: node tools/smoke_test.mjs [baseUrl]
// Verifies: hub renders, kitten pets/walks, doors change scenes, planting
// works and persists, music garden hotspots + echo song work, HUD updates.

import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => check('no page errors', false, String(e)));

// Helper: tap at a background-image anchor through the real input stack
async function tapAnchor(bg, u, v) {
  const p = await page.evaluate(([bg, u, v]) => {
    const g = window.__ww;
    return g.getAssets().anchor(bg, u, v, g.getWidth(), g.getHeight());
  }, [bg, u, v]);
  await page.mouse.click(p.x, p.y);
  return p;
}
const ev = (fn) => page.evaluate(fn);
async function waitSettled(scene) {
  await page.waitForFunction(
    (scene) => window.__ww && window.__ww.getCurrentSceneName() === scene && !window.__ww.isBusy(),
    scene, { timeout: 20000 }
  );
}

// --- Hub flow ---
await page.goto(`${BASE}/?test`);
await waitSettled('hub');
await page.waitForTimeout(400);
check('hub loads', true);

const stars0 = await ev(() => window.__ww.getState().totalStars);

// Pet the kitten (spawns at 0.40, 0.745)
await tapAnchor('hub_bg', 0.40, 0.72);
await page.waitForTimeout(400);
const happy = await ev(() => window.__ww.getHubKitten().happy > 0.5);
check('petting the kitten makes it happy', happy);

// Walk to the right platform (lower level, across the bridge)
const before = await ev(() => ({ x: window.__ww.getHubKitten().x, y: window.__ww.getHubKitten().y }));
await tapAnchor('hub_bg', 0.92, 0.885);
await page.waitForTimeout(600);
const walking = await ev(() => window.__ww.getHubKitten().walking);
check('tap ground → kitten walks', walking);
await page.waitForTimeout(6000);
const after = await ev(() => ({ x: window.__ww.getHubKitten().x, y: window.__ww.getHubKitten().y }));
check('kitten crossed to the other platform', Math.abs(after.x - before.x) > 200, `moved ${Math.round(after.x - before.x)}px`);

// Enter the greenhouse via its door
await tapAnchor('hub_bg', 0.505, 0.545);
await waitSettled('greenhouse');
check('greenhouse door → greenhouse scene', true);
await page.waitForTimeout(300);

// --- Greenhouse flow: select seed → plant → water ---
await ev(() => {
  const g = window.__ww;
  const w = g.getWidth(), h = g.getHeight();
  window.__pts = {
    seed: { x: Math.max(52, w * 0.055), y: h * 0.30 },
    water: { x: w - Math.max(52, w * 0.055), y: h * 0.78 },
  };
});
const pts = await ev(() => window.__pts);
await page.mouse.click(pts.seed.x, pts.seed.y);
await page.waitForTimeout(300);
await tapAnchor('greenhouse_bg', 0.40, 0.70);
await page.waitForTimeout(300);
let plants = await ev(() => window.__ww.getState().greenhousePlants.length);
check('planting a seed persists a plant', plants === 1, `plants=${plants}`);

await page.mouse.click(pts.water.x, pts.water.y);
await page.waitForTimeout(200);
await tapAnchor('greenhouse_bg', 0.40, 0.70);
await page.waitForTimeout(300);
const watered = await ev(() => window.__ww.getState().greenhousePlants[0]?.watered === true);
check('watering marks the plant watered', watered);

// Growth happens over time when watered
await page.waitForTimeout(4000);
const grown = await ev(() => window.__ww.getState().greenhousePlants[0]?.growthStage > 0.1);
check('watered plant grows over time', grown);

await page.screenshot({ path: '/tmp/smoke_greenhouse.png' });

// Home button back to hub
const home = await ev(() => ({ x: Math.max(44, window.__ww.getWidth() * 0.05), y: Math.max(46, window.__ww.getHeight() * 0.075) }));
await page.mouse.click(home.x, home.y);
await waitSettled('hub');
check('home button returns to hub', true);
await page.waitForTimeout(300);

// --- Music garden flow ---
await tapAnchor('hub_bg', 0.725, 0.30);
await waitSettled('music-garden');
check('music garden door → music garden scene', true);
await page.waitForTimeout(300);

// Play 3 instruments
await tapAnchor('stub_music_garden', 0.185, 0.60); // cello
await page.waitForTimeout(250);
await tapAnchor('stub_music_garden', 0.72, 0.55);  // harp
await page.waitForTimeout(250);
await tapAnchor('stub_music_garden', 0.045, 0.20); // bell
await page.waitForTimeout(250);
check('instruments tappable (no errors)', true);

// Bunny teaches a song, then any 3 notes celebrate (+1 dream seed)
const starsBefore = await ev(() => window.__ww.getState().totalStars);
await tapAnchor('stub_music_garden', 0.455, 0.60); // bunny
await page.waitForTimeout(3200); // teaching 3 notes
const echo = await ev(() => window.__ww.getMusicMode());
check('bunny song reaches echo mode', echo === 'echo', `mode=${echo}`);
await tapAnchor('stub_music_garden', 0.185, 0.60);
await page.waitForTimeout(200);
await tapAnchor('stub_music_garden', 0.575, 0.485);
await page.waitForTimeout(200);
await tapAnchor('stub_music_garden', 0.855, 0.60);
await page.waitForTimeout(500);
const starsAfter = await ev(() => window.__ww.getState().totalStars);
check('echo song celebration awards a dream seed', starsAfter > starsBefore, `${starsBefore} → ${starsAfter}`);
await page.screenshot({ path: '/tmp/smoke_music.png' });

// --- Persistence across reload ---
await page.goto(`${BASE}/?test&scene=greenhouse`);
await waitSettled('greenhouse');
await page.waitForTimeout(300);
const persisted = await ev(() => window.__ww.getState().greenhousePlants.length === 1 && window.__ww.getState().totalStars > 0);
check('plants + dream seeds persist across reload', persisted);

// Mute button toggles + persists
const mute = await ev(() => ({ x: window.__ww.getWidth() - 40, y: 42 }));
await page.mouse.click(mute.x, mute.y);
await page.waitForTimeout(600);
const muted = await ev(() => window.__ww.getState().muted);
check('mute button toggles', muted === true);

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
