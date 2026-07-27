// Persistent game state — stored in localStorage
// Saves are debounced (gameplay code may call save-triggering methods every
// frame) and flushed when the page is hidden.

export interface RoomState {
  unlocked: boolean;
  decorations: string[];
  starsCollected: number;
}

export interface KittenCustomization {
  bodyColor: string;
  accessory: string; // 'none' | 'cape' | 'scarf' | 'glasses' | 'flower'
  accessoryColor: string;
}

export interface PlantData {
  id: string;
  type: 'sprout' | 'flower' | 'mushroom' | 'vine';
  growthStage: number; // 0-4
  plotIndex: number; // which soil plot (stable across screen sizes)
  x: number; // legacy — kept for migrating old saves
  y: number;
  color: string;
  glowing: boolean;
  watered: boolean;
  lastWatered: number; // timestamp
}

export class GameState {
  private state = {
    version: 2,
    totalStars: 0,
    kitten: {
      bodyColor: '#f5d4a0',
      accessory: 'cape',
      accessoryColor: '#7b5fc7',
    } as KittenCustomization,
    rooms: {
      'greenhouse': { unlocked: true, decorations: [], starsCollected: 0 },
      'potion-kitchen': { unlocked: false, decorations: [], starsCollected: 0 },
      'observatory': { unlocked: false, decorations: [], starsCollected: 0 },
      'story-library': { unlocked: false, decorations: [], starsCollected: 0 },
      'music-garden': { unlocked: true, decorations: [], starsCollected: 0 },
      'forest-trail': { unlocked: false, decorations: [], starsCollected: 0 },
      'bedroom': { unlocked: false, decorations: [], starsCollected: 0 },
    } as Record<string, RoomState>,
    greenhousePlants: [] as PlantData[],
    greenhouseLastVisit: 0,
    visitedRooms: {} as Record<string, boolean>,
    muted: false,
    firstVisit: true,
  };

  private storageKey = 'whiskerwood_save';
  private saveTimer: number | null = null;
  private dirty = false;

  constructor() {
    this.load();
    // Never lose progress when the tab closes or the iPad app backgrounds
    const flush = () => this.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed, version: 2 };
        this.migrate(parsed);
      }
    } catch (e) {
      // Ignore — start fresh
    }
  }

  // v1 → v2: plants were matched to plots by exact float x/y equality, which
  // broke on any resize or different device. Assign stable plot indices.
  private migrate(parsed: any): void {
    if ((parsed.version ?? 1) >= 2) return;
    const plants: PlantData[] = this.state.greenhousePlants ?? [];
    // Old plots were laid out row-major 2×3 from normalized offsets — recover
    // an index by sorting the saved coordinates in reading order.
    const sorted = [...plants].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    sorted.forEach((p, i) => { if (p.plotIndex === undefined) p.plotIndex = i % 6; });
    this.saveNow();
  }

  // Debounced save — safe to call at any frequency
  save(): void {
    this.dirty = true;
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) this.saveNow();
    }, 400);
  }

  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) this.saveNow();
  }

  private saveNow(): void {
    try {
      this.dirty = false;
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      // Ignore quota errors
    }
  }

  get totalStars(): number { return this.state.totalStars; }
  get kitten(): KittenCustomization { return this.state.kitten; }
  get firstVisit(): boolean { return this.state.firstVisit; }
  get greenhousePlants(): PlantData[] { return this.state.greenhousePlants; }
  get greenhouseLastVisit(): number { return this.state.greenhouseLastVisit; }
  get muted(): boolean { return this.state.muted; }

  setKitten(custom: Partial<KittenCustomization>): void {
    this.state.kitten = { ...this.state.kitten, ...custom };
    this.save();
  }

  addStars(n: number): void {
    this.state.totalStars += n;
    this.save();
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    this.save();
  }

  hasVisited(room: string): boolean {
    return !!this.state.visitedRooms[room];
  }

  markVisited(room: string): void {
    this.state.visitedRooms[room] = true;
    this.save();
  }

  setGreenhouseLastVisit(t: number): void {
    this.state.greenhouseLastVisit = t;
    this.save();
  }

  addGreenhousePlant(plant: PlantData): void {
    this.state.greenhousePlants.push(plant);
    this.save();
  }

  updateGreenhousePlant(id: string, updates: Partial<PlantData>): void {
    const plant = this.state.greenhousePlants.find(p => p.id === id);
    if (plant) {
      Object.assign(plant, updates);
      this.save();
    }
  }

  setFirstVisitDone(): void {
    this.state.firstVisit = false;
    this.save();
  }

  getRoomState(name: string): RoomState | undefined {
    return this.state.rooms[name];
  }
}
