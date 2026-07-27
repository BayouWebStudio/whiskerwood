# Whiskerwood

A cozy, magical exploration game for ages 4-5. No fail states, no timers, no ads. Just curiosity, creativity, and kindness.

## Tech Stack

- **Vite + TypeScript** — fast builds, zero framework overhead
- **HTML5 Canvas 2D** — custom rendering engine
- **Web Audio API** — procedural ambient music + interaction sounds
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
├── engine/          # Game engine core
│   ├── GameEngine.ts      # Main loop, scene management, transitions
│   ├── InputManager.ts    # Pointer/touch input
│   ├── AudioManager.ts     # Web Audio synthesis (ambient + SFX)
│   ├── ParticleSystem.ts   # Fireflies, sparkles, seeds, petals
│   ├── TransitionOverlay.ts # Fade transitions between scenes
│   ├── StoryboardOverlay.ts # Text narration slides
│   ├── GameState.ts        # localStorage persistence
│   ├── types.ts            # Scene/RenderContext interfaces
│   └── utils.ts            # Math, easing, color helpers
├── entities/
│   └── Kitten.ts           # Customizable kitten character
├── scenes/
│   ├── HubScene.ts          # Tree castle hub with all room doors
│   ├── GreenhouseScene.ts   # Playable: plant/grow/collect
│   └── StubScene.ts         # Coming soon placeholder
└── main.ts                 # Entry point
```

## Design Principles

- No fail states, no timers, no scores, no game over
- Big buttons, minimal text, positive feedback only
- Soft watercolor aesthetic, warm lighting, rounded shapes
- Gentle storybook narration via storyboard overlays
- Everything saves automatically (localStorage)

## Roadmap

- [x] Hub scene with all room doors
- [x] Greenhouse room (fully playable)
- [x] Kitten character with accessories
- [x] Procedural ambient audio
- [x] Storyboard narration system
- [ ] Potion Kitchen room
- [ ] Observatory room
- [ ] Story Library room
- [ ] Music Garden room
- [ ] Forest Trail room
- [ ] Bedroom room
- [ ] Capacitor iOS wrapper
- [ ] App Store submission
