// AssetLoader — loads and caches all game images
// Call preload() at startup, then use get() to draw images in scenes

export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private loaded = false;
  private loadCount = 0;
  private totalCount = 0;
  private onProgress: ((loaded: number, total: number) => void) | null = null;
  private onComplete: (() => void) | null = null;

  // Asset registry — path -> key
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
    // Backgrounds
    'hub_bg': 'backgrounds/hub_bg.png',
    'hub_bg_wide': 'backgrounds/hub_bg_wide.png',
    'greenhouse_bg': 'backgrounds/greenhouse_bg.png',
    'stub_potion_kitchen': 'backgrounds/stub_potion_kitchen.png',
    'stub_observatory': 'backgrounds/stub_observatory.png',
    'stub_story_library': 'backgrounds/stub_story_library.png',
    'stub_music_garden': 'backgrounds/stub_music_garden.png',
    'stub_forest_trail': 'backgrounds/stub_forest_trail.png',
    'stub_bedroom': 'backgrounds/stub_bedroom.png',
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

  preload(onProgress?: (loaded: number, total: number) => void, onComplete?: () => void): Promise<void> {
    this.onProgress = onProgress ?? null;
    this.onComplete = onComplete ?? null;
    this.totalCount = Object.keys(AssetLoader.ASSET_LIST).length;
    this.loadCount = 0;

    return new Promise((resolve) => {
      const entries = Object.entries(AssetLoader.ASSET_LIST);
      for (const [key, path] of entries) {
        const img = new Image();
        img.onload = () => {
          this.loadCount++;
          if (this.onProgress) this.onProgress(this.loadCount, this.totalCount);
          if (this.loadCount >= this.totalCount) {
            this.loaded = true;
            if (this.onComplete) this.onComplete();
            resolve();
          }
        };
        img.onerror = () => {
          console.warn(`Failed to load asset: ${path}`);
          this.loadCount++;
          if (this.onProgress) this.onProgress(this.loadCount, this.totalCount);
          if (this.loadCount >= this.totalCount) {
            this.loaded = true;
            if (this.onComplete) this.onComplete();
            resolve();
          }
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
    return this.loaded;
  }

  getLoadProgress(): { loaded: number; total: number } {
    return { loaded: this.loadCount, total: this.totalCount };
  }

  // Draw helper — draws image centered at (x, y) with optional scale
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

  // Draw helper — draws image at (x, y) top-left with optional scale
  drawAt(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, scale: number = 1, alpha: number = 1): boolean {
    const img = this.get(key);
    if (!img) return false;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return true;
  }

  // Draw background covering the full canvas
  drawBackground(ctx: CanvasRenderingContext2D, key: string, width: number, height: number, alpha: number = 1): boolean {
    const img = this.get(key);
    if (!img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Cover the canvas, maintaining aspect ratio
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    ctx.restore();
    return true;
  }
}
