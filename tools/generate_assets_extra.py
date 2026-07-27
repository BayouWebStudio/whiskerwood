#!/usr/bin/env python3
"""Generate additional Whiskerwood assets — ambient, decorative, floating elements."""

import requests, json, base64, time, os, sys

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3.1-flash-image"
ASSETS_DIR = "/Users/wesche/whiskerwood/public/assets"
STYLE = "soft watercolor children's book illustration, kawaii cute, rounded shapes, warm pastel colors, gentle storybook vibe, cozy and magical, no text, no words, no letters"

ASSETS = [
    # === FLOATING AMBIENT ELEMENTS (for particle/decoration layer) ===
    ("sprites/firefly.png", f"A single glowing firefly with soft golden yellow light, tiny delicate wings, kawaii cute, magical sparkly glow, {STYLE}, plain solid white background"),
    ("sprites/sparkle_gold.png", f"A burst of golden sparkles and stars, magical fairy dust, kawaii cute, {STYLE}, plain solid white background"),
    ("sprites/sparkle_pink.png", f"A burst of pink sparkles and stars, magical fairy dust, kawaii cute, {STYLE}, plain solid white background"),
    ("sprites/floating_leaf.png", f"A single floating autumn leaf drifting in the wind, kawaii cute, soft green and gold, {STYLE}, plain solid white background"),
    ("sprites/floating_seed.png", f"A single glowing magical seed floating in the air, kawaii cute, soft green-gold glow, small and round, {STYLE}, plain solid white background"),
    ("sprites/petal_pink.png", f"A single pink flower petal floating in the wind, kawaii cute, soft watercolor, {STYLE}, plain solid white background"),
    ("sprites/petal_white.png", f"A single white flower petal floating in the wind, kawaii cute, soft watercolor, {STYLE}, plain solid white background"),
    ("sprites/dream_bubble.png", f"A glowing magical dream bubble, translucent and shimmering, kawaii cute, soft purple and blue iridescent, {STYLE}, plain solid white background"),
    ("sprites/shooting_star.png", f"A cute shooting star with a sparkly trailing tail, kawaii cute, soft blue and white glow, {STYLE}, plain solid white background"),
    ("sprites/dust_mote.png", f"A cluster of tiny floating dust motes catching light, kawaii cute, soft golden glow, {STYLE}, plain solid white background"),

    # === ISLAND / TERRAIN ELEMENTS ===
    ("sprites/floating_rock_small.png", f"A small floating rock chunk with moss and tiny flowers on top, kawaii cute, {STYLE}, plain solid white background"),
    ("sprites/floating_rock_large.png", f"A large floating rock chunk with grass, moss and a tiny tree, kawaii cute, {STYLE}, plain solid white background"),
    ("sprites/cloud_1.png", f"A soft fluffy cloud, kawaii cute, watercolor style, {STYLE}, plain solid white background"),
    ("sprites/cloud_2.png", f"A soft wispy cloud with rainbow tint, kawaii cute, watercolor style, {STYLE}, plain solid white background"),
    ("sprites/island_base.png", f"The rocky bottom of a floating island with hanging roots and rocks, kawaii cute, {STYLE}, plain solid white background"),

    # === HUB TREE ELEMENTS ===
    ("sprites/tree_trunk.png", f"A magical tree trunk with a door and glowing windows, kawaii cute, warm bark, {STYLE}, plain solid white background"),
    ("sprites/tree_canopy.png", f"A lush leafy tree canopy from above, kawaii cute, soft green watercolor, {STYLE}, plain solid white background"),
    ("sprites/star_tiny.png", f"A single tiny twinkling star, kawaii cute, soft white-yellow glow, {STYLE}, plain solid white background"),
    ("sprites/moon_crescent.png", f"A cute crescent moon with a sleepy face, kawaii cute, soft silver glow, {STYLE}, plain solid white background"),

    # === GREENHOUSE EXTRAS ===
    ("sprites/watering_can.png", f"A cute kawaii watering can with sparkling water drops, {STYLE}, plain solid white background"),
    ("sprites/soil_plot.png", f"A patch of rich dark soil in a wooden garden box, kawaii cute, {STYLE}, plain solid white background"),
    ("sprites/water_drop.png", f"A single cute kawaii water droplet with a sparkle, {STYLE}, plain solid white background"),
    ("sprites/greenhouse_shelf.png", f"A wooden greenhouse shelf with small pots and tools, kawaii cute, {STYLE}, plain solid white background"),

    # === FRIENDLY ANIMALS (for forest trail & ambient) ===
    ("sprites/animal_bunny.png", f"A tiny cute kawaii bunny sitting, soft brown fur, big eyes, {STYLE}, plain solid white background"),
    ("sprites/animal_bird.png", f"A tiny cute kawaii bluebird perched, fluffy round, big eyes, {STYLE}, plain solid white background"),
    ("sprites/animal_squirrel.png", f"A tiny cute kawaii squirrel with a big fluffy tail, holding an acorn, {STYLE}, plain solid white background"),
    ("sprites/animal_fox.png", f"A tiny cute kawaii baby fox sitting, soft orange fur, big eyes, {STYLE}, plain solid white background"),
    ("sprites/animal_owl.png", f"A tiny cute kawaii baby owl on a branch, fluffy round, big eyes, {STYLE}, plain solid white background"),

    # === EXTRA UI ===
    ("ui/star_counter.png", f"A cute kawaii glowing star icon for a counter, soft golden glow, {STYLE}, plain solid white background"),
    ("ui/btn_back.png", f"A round soft back arrow button, kawaii cute, purple gradient, {STYLE}, plain solid white background"),
    ("ui/coming_soon.png", f"A cute kawaii sparkling sign that says coming soon, soft purple and silver sparkles, {STYLE}, plain solid white background"),

    # === STORYBOARD / NARRATION DECORATIONS ===
    ("sprites/storybook_corner.png", f"Decorative storybook corner ornament, kawaii cute, soft gold and cream, {STYLE}, plain solid white background"),
    ("sprites/star_border.png", f"A decorative border of tiny stars and sparkles, kawaii cute, soft gold, {STYLE}, plain solid white background"),

    # === ROOM DOORS (individual) ===
    ("doors/door_greenhouse.png", f"A cute magical wooden door in a tree trunk leading to a greenhouse, green glow, flowers around it, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_potion_kitchen.png", f"A cute magical wooden door leading to a potion kitchen, purple and orange glow, potions in window, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_observatory.png", f"A cute magical wooden door leading to an observatory, blue starry glow, telescope in window, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_story_library.png", f"A cute magical wooden door leading to a story library, warm amber glow, books in window, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_music_garden.png", f"A cute magical wooden door leading to a music garden, pink and green glow, flowers in window, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_forest_trail.png", f"A cute magical wooden door leading to a forest trail, green glow, trees around it, kawaii cute, {STYLE}, plain solid white background"),
    ("doors/door_bedroom.png", f"A cute magical wooden door leading to a cozy bedroom, soft blue glow, moon and stars, kawaii cute, {STYLE}, plain solid white background"),
]

def generate_image(prompt, output_path, retries=3):
    for attempt in range(retries):
        try:
            print(f"  Generating: {os.path.basename(output_path)} (attempt {attempt+1})...")
            response = requests.post(API_URL, headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json={"model": MODEL, "messages": [{"role": "user", "content": f"Generate an image: {prompt}"}]}, timeout=120)
            if response.status_code != 200:
                print(f"  Error {response.status_code}: {response.text[:200]}")
                if attempt < retries - 1: time.sleep(5); continue
                return False
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                if attempt < retries - 1: time.sleep(5); continue
                return False
            message = choices[0].get("message", {})
            images = message.get("images", [])
            if images:
                for item in images:
                    if isinstance(item, dict) and item.get("type") == "image_url":
                        image_url = item.get("image_url", {}).get("url", "")
                        if image_url.startswith("data:"):
                            b64_data = image_url.split(",", 1)[1]
                            img_data = base64.b64decode(b64_data)
                        else:
                            img_data = requests.get(image_url, timeout=60).content
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f: f.write(img_data)
                        print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                        return True
            content = message.get("content", [])
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "image_url":
                        image_url = item.get("image_url", {}).get("url", "")
                        if image_url.startswith("data:"):
                            b64_data = image_url.split(",", 1)[1]
                            img_data = base64.b64decode(b64_data)
                        else:
                            img_data = requests.get(image_url, timeout=60).content
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f: f.write(img_data)
                        print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                        return True
            if isinstance(content, str):
                import re
                match = re.search(r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)', content)
                if match:
                    img_data = base64.b64decode(match.group(1))
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f: f.write(img_data)
                    print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                    return True
                match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
                if match:
                    img_data = requests.get(match.group(1), timeout=60).content
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f: f.write(img_data)
                    print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                    return True
            print(f"  Could not find image in response.")
            if attempt < retries - 1: time.sleep(5)
        except Exception as e:
            print(f"  Exception: {e}")
            if attempt < retries - 1: time.sleep(5)
    return False

def main():
    assets = ASSETS
    if len(sys.argv) > 1:
        keyword = sys.argv[1]
        assets = [(p, prompt) for p, prompt in ASSETS if keyword in p]
    print(f"Generating {len(assets)} additional assets with model {MODEL}...\n")
    success_count = 0; fail_count = 0; failed = []
    for i, (path, prompt) in enumerate(assets):
        full_path = os.path.join(ASSETS_DIR, path)
        print(f"[{i+1}/{len(assets)}] {path}")
        if generate_image(prompt, full_path): success_count += 1
        else: fail_count += 1; failed.append(path)
        time.sleep(2)
    print(f"\n=== RESULTS ===\nSuccess: {success_count}\nFailed: {fail_count}")
    if failed: print(f"Failed assets: {failed}")
    return 0 if fail_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
