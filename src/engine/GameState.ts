// Persistent game state — stored in localStorage

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

export class GameState {
  private state = {
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
      'music-garden': { unlocked: false, decorations: [], starsCollected: 0 },
      'forest-trail': { unlocked: false, decorations: [], starsCollected: 0 },
      'bedroom': { unlocked: false, decorations: [], starsCollected: 0 },
    } as Record<string, RoomState>,
    greenhousePlants: [] as PlantData[],
    firstVisit: true,
  };

  private storageKey = 'whiskerwood_save';

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {
      // Ignore
    }
  }

  save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      // Ignore quota errors
    }
  }

  get totalStars(): number { return this.state.totalStars; }
  get kitten(): KittenCustomization { return this.state.kitten; }
  get firstVisit(): boolean { return this.state.firstVisit; }
  get greenhousePlants(): PlantData[] { return this.state.greenhousePlants; }

  setKitten(custom: Partial<KittenCustomization>): void {
    this.state.kitten = { ...this.state.kitten, ...custom };
    this.save();
  }

  addStars(n: number): void {
    this.state.totalStars += n;
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

export interface PlantData {
  id: string;
  type: 'sprout' | 'flower' | 'mushroom' | 'vine';
  growthStage: number; // 0-4
  x: number;
  y: number;
  color: string;
  glowing: boolean;
  watered: boolean;
  lastWatered: number; // timestamp
}
