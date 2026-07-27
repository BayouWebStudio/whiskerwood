# Whiskerwood

A cozy, magical exploration game for ages 4-5. No fail states, no timers, no ads. Just curiosity, creativity, and kindness.

**Live**: https://whiskerwood.vercel.app

## Playable rooms

- **Hub** — a tree castle on a floating island. Your kitten roams both levels freely (main island + side platforms over the rope bridges), naps when you're away, and purrs when you pet it. Bunny, squirrel, owl and bird friends wander around; lanterns swing, glow-flowers play notes, and shooting stars can be caught for dream seeds.
- **Greenhouse** — plant flower/mushroom/vine seeds, water them, watch them bloom into glowing plants that drop dream seeds. Plants keep growing while you're away.
- **Music Garden** — every painted instrument has its own synthesized voice (cello, saxophone, trumpet, harp, violin, lyre), plus singing flowers, hanging bells and a boop-shroom. The bunny teaches little echo-songs — any tune you play back is celebrated. No wrong notes.

Five more rooms are "still sparkling to life" (Potion Kitchen, Observatory, Story Library, Forest Trail, Bedroom).

## Tech Stack

- **Vite + TypeScript** — fast builds, zero framework overhead
- **HTML5 Canvas 2D** — custom rendering engine (no framework, ~50KB JS)
- **Web Audio API** — everything synthesized: ambient pad, chimes, instrument voices, mew/purr/chirp/hoot. No audio files.
- **AI watercolor art** — 80 assets generated via OpenRouter (Gemini Flash Image), optimized to ~17MB
- **Capacitor** (planned) — iOS/iPadOS native wrapper

## Getting Started

```bash
pnpm install
pnpm dev      # dev server at localhost:3000
pnpm build    # production build to dist/
pnpm preview  # preview production build
```

## Architecture

```
src/
├── engine/
│   ├── GameEngine.ts       # Main loop, scenes, transitions, global HUD (seeds + mute)
│   ├── AssetLoader.ts      # Two-phase preload (critical-first), cover-fit anchor math
│   ├── InputManager.ts     # Pointer/touch input (CSS px)
│   ├── AudioManager.ts     # Web Audio synthesis (ambient, SFX, creatures, instruments)
│   ├── ParticleSystem.ts   # Fireflies, sparkles, seeds, petals, hearts, notes, dust
│   ├── TransitionOverlay.ts# Fade transitions
│   ├── StoryboardOverlay.ts# Narration slides (first-visit aware)
│   ├── GameState.ts        # Debounced localStorage persistence
│   └── utils.ts            # Math, easing, radial-gradient glows
├── entities/
│   └── Kitten.ts           # Breathing, squash-and-stretch, pet/sleep/wake, dream bubbles
├── scenes/
│   ├── HubScene.ts         # Image-anchored doors, walkable zones, critters, shooting stars
│   ├── GreenhouseScene.ts  # Game 1: planting & growing
│   ├── MusicGardenScene.ts # Game 2: instruments & echo-songs
│   └── StubScene.ts        # "Coming soon" rooms
└── main.ts

tools/
├── generate_assets.py       # AI asset generation (OPENROUTER_API_KEY env)
├── generate_assets_extra.py
└── optimize_assets.py       # Mass-aware trim + downscale + JPEG backgrounds
```

All gameplay positions are anchored in background-image space and mapped through the cover-fit transform, so scenes look right at any viewport size.

## Deploy

Pushes to `main` auto-deploy to Vercel.
