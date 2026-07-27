// AssetLoader — loads and caches all game images
// Two-phase preload: CRITICAL assets (hub + kitten + UI) gate the loading
// screen so the game starts fast; everything else streams in the background.
// Scenes null-check get(), so late assets simply pop in.

export interface CoverTransform {
  ox: number; // x offset of the drawn image
  oy: number;
  dw: number; // drawn width
  dh: number; // drawn height
}

// All generated backgrounds share this aspect — used as a fallback for
// anchor math before an image finishes loading.
const BG_ASPECT = 1408 / 768;

export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private criticalLoaded = false;
  private loadCount = 0;
  private totalCount = 0;

  // Assets needed before the hub can appear
  private static CRITICAL: string[] = [
    'hub_bg',
    'kitten_sitting', 'kitten_walking1', 'kitten_walking2', 'kitten_happy', 'kitten_sleeping',
    'door_greenhouse', 'door_potion_kitchen', 'door_observatory', 'door_story_library',
    'door_music_garden', 'door_forest_trail', 'door_bedroom',
    'lantern', 'biolum_flower_purple', 'biolum_flower_blue', 'biolum_flower_pink',
    'animal_bunny', 'animal_bird', 'animal_squirrel', 'animal_owl',
    'cloud_1', 'cloud_2', 'star_tiny', 'shooting_star',
    'star_counter', 'btn_home',
  ];

  // Asset registry — key -> path
  private static ASSET_LIST: Record<string, string> = {
    // Kitten
    'kitten_sitting': 'sprites/kitten_sitting.png',
    'kitten_walking1': 'sprites/kitten_walking1.png',
    'kitten_walking2': 'sprites/kitten_walking2.png',
    'kitten_happy': 'sprites/kitten_happy.png',
    'kitten_sleeping': 'sprites/kitten_sleeping.png',
    // Accessories
    'cape_purple': 'sprites/cape_purple.png',
    'scarf_red': 'sprites/scarf_red.png',
    'glasses_round': 'sprites/glasses_round.png',
    'flower_hair': 'sprites/flower_hair.png',
    // Backgrounds (JPEG — no alpha needed, much smaller)
    'hub_bg': 'backgrounds/hub_bg.jpg',
    'greenhouse_bg': 'backgrounds/greenhouse_bg.jpg',
    'stub_potion_kitchen': 'backgrounds/stub_potion_kitchen.jpg',
    'stub_observatory': 'backgrounds/stub_observatory.jpg',
    'stub_story_library': 'backgrounds/stub_story_library.jpg',
    'stub_music_garden': 'backgrounds/stub_music_garden.jpg',
    'stub_forest_trail': 'backgrounds/stub_forest_trail.jpg',
    'stub_bedroom': 'backgrounds/stub_bedroom.jpg',
    // Doors
    'door_greenhouse': 'doors/door_greenhouse.png',
    'door_potion_kitchen': 'doors/door_potion_kitchen.png',
    'door_observatory': 'doors/door_observatory.png',
    'door_story_library': 'doors/door_story_library.png',
    'door_music_garden': 'doors/door_music_garden.png',
    'door_forest_trail': 'doors/door_forest_trail.png',
    'door_bedroom': 'doors/door_bedroom.png',
    // Seeds
    'seed_flower': 'ui/seed_flower.png',
    'seed_mushroom': 'ui/seed_mushroom.png',
    'seed_vine': 'ui/seed_vine.png',
    // Plants — flower stages
    'flower_stage1': 'plants/flower_stage1.png',
    'flower_stage2': 'plants/flower_stage2.png',
    'flower_stage3': 'plants/flower_stage3.png',
    'flower_stage4': 'plants/flower_stage4.png',
    // Plants — mushroom stages
    'mushroom_stage1': 'plants/mushroom_stage1.png',
    'mushroom_stage2': 'plants/mushroom_stage2.png',
    'mushroom_stage3': 'plants/mushroom_stage3.png',
    'mushroom_stage4': 'plants/mushroom_stage4.png',
    // Plants — vine stages
    'vine_stage1': 'plants/vine_stage1.png',
    'vine_stage2': 'plants/vine_stage2.png',
    'vine_stage3': 'plants/vine_stage3.png',
    'vine_stage4': 'plants/vine_stage4.png',
    // Decorative
    'lantern': 'sprites/lantern.png',
    'biolum_flower_purple': 'sprites/biolum_flower_purple.png',
    'biolum_flower_blue': 'sprites/biolum_flower_blue.png',
    'biolum_flower_pink': 'sprites/biolum_flower_pink.png',
    'bridge': 'sprites/bridge.png',
    'tree_trunk': 'sprites/tree_trunk.png',
    'tree_canopy': 'sprites/tree_canopy.png',
    'island_base': 'sprites/island_base.png',
    'cloud_1': 'sprites/cloud_1.png',
    'cloud_2': 'sprites/cloud_2.png',
    'moon_crescent': 'sprites/moon_crescent.png',
    'star_tiny': 'sprites/star_tiny.png',
    // Ambient / floating
    'firefly': 'sprites/firefly.png',
    'sparkle_gold': 'sprites/sparkle_gold.png',
    'sparkle_pink': 'sprites/sparkle_pink.png',
    'floating_leaf': 'sprites/floating_leaf.png',
    'floating_seed': 'sprites/floating_seed.png',
    'petal_pink': 'sprites/petal_pink.png',
    'petal_white': 'sprites/petal_white.png',
    'dream_bubble': 'sprites/dream_bubble.png',
    'shooting_star': 'sprites/shooting_star.png',
    'dust_mote': 'sprites/dust_mote.png',
    'floating_rock_small': 'sprites/floating_rock_small.png',
    'floating_rock_large': 'sprites/floating_rock_large.png',
    // Greenhouse extras
    'watering_can': 'sprites/watering_can.png',
    'soil_plot': 'sprites/soil_plot.png',
    'water_drop': 'sprites/water_drop.png',
    'greenhouse_shelf': 'sprites/greenhouse_shelf.png',
    // Animals
    'animal_bunny': 'sprites/animal_bunny.png',
    'animal_bird': 'sprites/animal_bird.png',
    'animal_squirrel': 'sprites/animal_squirrel.png',
    'animal_fox': 'sprites/animal_fox.png',
    'animal_owl': 'sprites/animal_owl.png',
    // UI
    'btn_home': 'ui/btn_home.png',
    'btn_water': 'ui/btn_water.png',
    'btn_exit': 'ui/btn_exit.png',
    'btn_back': 'ui/btn_back.png',
    'dream_seed': 'ui/dream_seed.png',
    'star_counter': 'ui/star_counter.png',
    'coming_soon': 'ui/coming_soon.png',
    // Storyboard
    'storybook_corner': 'sprites/storybook_corner.png',
    'star_border': 'sprites/star_border.png',
  };

  // Loads critical assets, resolving when the game can start. The remaining
  // assets keep loading in the background.
  preload(onProgress?: (loaded: number, total: number) => void, onComplete?: () => void): Promise<void> {
    const critical = new Set(AssetLoader.CRITICAL);
    this.totalCount = critical.size;
    this.loadCount = 0;

    return new Promise((resolve) => {
      let criticalDone = 0;
      const finishCritical = () => {
        criticalDone++;
        this.loadCount = criticalDone;
        if (onProgress) onProgress(criticalDone, this.totalCount);
        if (criticalDone >= this.totalCount && !this.criticalLoaded) {
          this.criticalLoaded = true;
          if (onComplete) onComplete();
          resolve();
        }
      };

      for (const [key, path] of Object.entries(AssetLoader.ASSET_LIST)) {
        const img = new Image();
        const isCritical = critical.has(key);
        img.onload = () => { if (isCritical) finishCritical(); };
        img.onerror = () => {
          console.warn(`Failed to load asset: ${path}`);
          if (isCritical) finishCritical();
        };
        img.src = `/assets/${path}`;
        this.images.set(key, img);
      }
    });
  }

  get(key: string): HTMLImageElement | null {
    const img = this.images.get(key);
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    return img;
  }

  isLoaded(): boolean {
    return this.criticalLoaded;
  }

  getLoadProgress(): { loaded: number; total: number } {
    return { loaded: this.loadCount, total: this.totalCount };
  }

  // Draw image centered at (x, y) scaled by a raw multiplier
  draw(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, scale: number = 1, alpha: number = 1): boolean {
    const img = this.get(key);
    if (!img) return false;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    ctx.restore();
    return true;
  }

  // Draw image centered at (x, y) fitted so its LARGEST dimension equals
  // `size` CSS px. Safe against source images changing resolution.
  drawFit(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size: number, alpha: number = 1, rotation: number = 0, flipX: boolean = false): boolean {
    const img = this.get(key);
    if (!img) return false;
    const s = size / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  // Fitted size of an image for hit-testing (matches drawFit)
  fitSize(key: string, size: number): { w: number; h: number } {
    const img = this.get(key);
    if (!img) return { w: size, h: size };
    const s = size / Math.max(img.naturalWidth, img.naturalHeight);
    return { w: img.naturalWidth * s, h: img.naturalHeight * s };
  }

  // Draw background covering the full canvas
  drawBackground(ctx: CanvasRenderingContext2D, key: string, width: number, height: number, alpha: number = 1): boolean {
    const img = this.get(key);
    if (!img) return false;
    const t = this.coverTransform(key, width, height)!;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, t.ox, t.oy, t.dw, t.dh);
    ctx.restore();
    return true;
  }

  // The cover-fit transform used by drawBackground. Falls back to the shared
  // generated-background aspect if the image hasn't loaded yet, so anchor
  // positions are stable from the first frame.
  coverTransform(key: string, width: number, height: number): CoverTransform {
    const img = this.get(key);
    const aspect = img ? img.naturalWidth / img.naturalHeight : BG_ASPECT;
    // cover-fit: fill the canvas, cropping whichever axis overflows
    const dw = aspect >= width / height ? height * aspect : width;
    const dh = aspect >= width / height ? height : width / aspect;
    return { ox: (width - dw) / 2, oy: (height - dh) / 2, dw, dh };
  }

  // Map a normalized point (u, v) on a cover-fit background image to screen px
  anchor(key: string, u: number, v: number, width: number, height: number): { x: number; y: number } {
    const t = this.coverTransform(key, width, height);
    return { x: t.ox + u * t.dw, y: t.oy + v * t.dh };
  }

  // Inverse of anchor(): screen px -> normalized image coords
  toImage(key: string, x: number, y: number, width: number, height: number): { u: number; v: number } {
    const t = this.coverTransform(key, width, height);
    return { u: (x - t.ox) / t.dw, v: (y - t.oy) / t.dh };
  }
}
