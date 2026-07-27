import './style.css';
import { GameEngine } from './engine/GameEngine';

const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

const game = new GameEngine(canvas);
game.start();

// --- Automated smoke tests (?test&auto=tour / ?auto=plant) ---
// Dispatches real pointer events through the whole input stack so headless
// screenshots can verify tap-driven flows. Inert unless the params are set.
const params = new URLSearchParams(window.location.search);

// Debug facade for the smoke test (tools/smoke_test.mjs) — test mode only
if (params.has('test')) {
  (window as any).__ww = {
    getAssets: () => game.getAssets(),
    getWidth: () => game.getWidth(),
    getHeight: () => game.getHeight(),
    getState: () => game.getState(),
    getCurrentSceneName: () => game.getCurrentSceneName(),
    getHubKitten: () => (game.getSceneInstance('hub') as any)?.kitten,
    getMusicMode: () => (game.getSceneInstance('music-garden') as any)?.getMode(),
    isBusy: () => game.isTransitioning() || game.getStoryboard().isActive(),
  };
}

const auto = params.get('auto');
if (auto) {
  const tap = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    const opts = { clientX: rect.left + x, clientY: rect.top + y, bubbles: true, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    setTimeout(() => canvas.dispatchEvent(new PointerEvent('pointerup', opts)), 70);
  };
  // Tap a point anchored on a background image (u, v in 0..1)
  const tapAnchor = (bg: string, u: number, v: number) => {
    const p = game.getAssets().anchor(bg, u, v, game.getWidth(), game.getHeight());
    tap(p.x, p.y);
  };

  if (auto === 'tour') {
    // Hub: pet the kitten → walk to the right platform → enter Music Garden → play the cello
    setTimeout(() => tapAnchor('hub_bg', 0.40, 0.72), 1500);   // pet kitten
    setTimeout(() => tapAnchor('hub_bg', 0.88, 0.85), 3000);   // walk across the bridge
    setTimeout(() => tapAnchor('hub_bg', 0.725, 0.30), 6000);  // Music Garden door
    setTimeout(() => tapAnchor('stub_music_garden', 0.185, 0.60), 9500); // cello
    setTimeout(() => tapAnchor('stub_music_garden', 0.455, 0.60), 10500); // bunny song
  } else if (auto === 'plant') {
    // Greenhouse (use with ?scene=greenhouse): pick seed → plant → water
    const w = () => game.getWidth();
    const h = () => game.getHeight();
    setTimeout(() => tap(Math.max(52, w() * 0.055), h() * 0.30), 1500);  // flower seed packet
    setTimeout(() => tapAnchor('greenhouse_bg', 0.40, 0.70), 2500);      // plant it
    setTimeout(() => tap(w() - Math.max(52, w() * 0.055), h() * 0.78), 3500); // water mode
    setTimeout(() => tapAnchor('greenhouse_bg', 0.40, 0.70), 4300);      // water the plant
  }
}
