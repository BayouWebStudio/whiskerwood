#!/usr/bin/env python3
"""Generate all Whiskerwood game assets via OpenRouter image generation API."""
import requests
import json
import base64
import time
import os
import sys

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3.1-flash-image"  # Nano Banana 2 — image generation

ASSETS_DIR = "/Users/wesche/whiskerwood/public/assets"

# Style suffix to maintain consistency across all assets
STYLE = "soft watercolor children's book illustration, kawaii cute, rounded shapes, warm pastel colors, gentle storybook vibe, cozy and magical, no text, no words, no letters"

ASSETS = [
    # === KITTEN CHARACTER ===
    ("sprites/kitten_sitting.png", "Adorable kawaii chibi kitten sitting pose facing forward, cream and honey colored fur, huge sparkly expressive round blue eyes, tiny rounded fluffy body, stubby legs, fluffy tail curled around, wearing a tiny purple cape, " + STYLE + ", plain solid white background"),
    ("sprites/kitten_walking1.png", "Adorable kawaii chibi kitten walking pose facing right, cream and honey colored fur, huge sparkly expressive round blue eyes, tiny rounded fluffy body, stubby legs mid-step, fluffy tail up, wearing a tiny purple cape, " + STYLE + ", plain solid white background"),
    ("sprites/kitten_walking2.png", "Adorable kawaii chibi kitten walking pose facing right, cream and honey colored fur, huge sparkly expressive round blue eyes, tiny rounded fluffy body, stubby legs other leg forward, fluffy tail up, wearing a tiny purple cape, " + STYLE + ", plain solid white background"),
    ("sprites/kitten_happy.png", "Adorable kawaii chibi kitten jumping with joy, cream and honey colored fur, huge sparkly round blue eyes with star highlights, tiny body in air, stubby legs spread, fluffy tail up, wearing a tiny purple cape, " + STYLE + ", plain solid white background"),
    ("sprites/kitten_sleeping.png", "Adorable kawaii chibi kitten curled up sleeping, cream and honey colored fur, eyes closed contentedly, tiny body in a round ball, fluffy tail wrapped around, wearing a tiny purple cape, " + STYLE + ", plain solid white background"),
    
    # === KITTEN ACCESSORIES (as separate items for overlay) ===
    ("sprites/cape_purple.png", "Tiny purple cape for a small kitten character, cute kawaii style, no character just the cape accessory, " + STYLE + ", plain solid white background"),
    ("sprites/scarf_red.png", "Tiny red scarf for a small kitten character, cute kawaii style, no character just the scarf accessory, " + STYLE + ", plain solid white background"),
    ("sprites/glasses_round.png", "Tiny round glasses for a small kitten character, cute kawaii style, no character just the glasses accessory, " + STYLE + ", plain solid white background"),
    ("sprites/flower_hair.png", "Tiny pink flower hair accessory for a small kitten character, cute kawaii style, no character just the flower, " + STYLE + ", plain solid white background"),
    
    # === HUB SCENE BACKGROUND ===
    ("backgrounds/hub_bg.png", "Magical tree castle on a floating island, twilight sky with soft stars, warm glowing windows in tree trunk, hanging lanterns with warm golden light, bioluminescent glowing flowers in purple and blue, tiny wooden bridges connecting platforms, floating rocks, fireflies, cozy and dreamy, " + STYLE),
    ("backgrounds/hub_bg_wide.png", "Wide panoramic view of a magical tree castle on a floating island, deep twilight purple sky with twinkling stars, distant floating islands, glowing lanterns, bioluminescent flowers, fireflies, cozy and dreamy, " + STYLE),
    
    # === GREENHOUSE SCENE BACKGROUND ===
    ("backgrounds/greenhouse_bg.png", "Cozy magical greenhouse interior, glass roof with soft warm light streaming in, wooden shelves with potted plants, warm earthy green and brown tones, glowing magical flowers, small watering can, seed packets, fireflies, " + STYLE),
    
    # === SEED PACKETS ===
    ("ui/seed_flower.png", "Cute kawaii seed packet for magical flower seeds, small paper packet with a tiny flower illustration on it, pink and green colors, " + STYLE + ", plain solid white background"),
    ("ui/seed_mushroom.png", "Cute kawaii seed packet for magical mushroom seeds, small paper packet with a tiny mushroom illustration on it, orange and brown colors, " + STYLE + ", plain solid white background"),
    ("ui/seed_vine.png", "Cute kawaii seed packet for magical vine seeds, small paper packet with a tiny vine leaf illustration on it, green colors, " + STYLE + ", plain solid white background"),
    
    # === PLANT GROWTH STAGES ===
    ("plants/flower_stage1.png", "Tiny green sprout just emerging from soil, kawaii cute, two small leaves, " + STYLE + ", plain solid white background"),
    ("plants/flower_stage2.png", "Small green plant growing, kawaii cute, stem with a few leaves, " + STYLE + ", plain solid white background"),
    ("plants/flower_stage3.png", "Growing plant with bud, kawaii cute, green stem with leaves and a small pink bud forming, " + STYLE + ", plain solid white background"),
    ("plants/flower_stage4.png", "Beautiful fully bloomed magical pink flower with glowing center, kawaii cute, green stem with leaves, " + STYLE + ", plain solid white background"),
    ("plants/mushroom_stage1.png", "Tiny mushroom sprout just emerging from soil, kawaii cute, small button shape, " + STYLE + ", plain solid white background"),
    ("plants/mushroom_stage2.png", "Small mushroom growing, kawaii cute, red cap forming, " + STYLE + ", plain solid white background"),
    ("plants/mushroom_stage3.png", "Growing mushroom with red cap and white spots, kawaii cute, " + STYLE + ", plain solid white background"),
    ("plants/mushroom_stage4.png", "Fully grown magical mushroom with glowing red cap and white spots, kawaii cute, soft golden glow, " + STYLE + ", plain solid white background"),
    ("plants/vine_stage1.png", "Tiny green vine sprout just emerging from soil, kawaii cute, " + STYLE + ", plain solid white background"),
    ("plants/vine_stage2.png", "Small green vine growing with a few leaves, kawaii cute, " + STYLE + ", plain solid white background"),
    ("plants/vine_stage3.png", "Growing vine trailing with multiple leaves, kawaii cute, " + STYLE + ", plain solid white background"),
    ("plants/vine_stage4.png", "Fully grown magical trailing vine with glowing green leaves and small flowers, kawaii cute, soft green glow, " + STYLE + ", plain solid white background"),
    
    # === DECORATIVE ELEMENTS ===
    ("sprites/lantern.png", "Hanging magical lantern with warm golden glow, kawaii cute, ornate design, " + STYLE + ", plain solid white background"),
    ("sprites/biolum_flower_purple.png", "Glowing bioluminescent flower in purple and violet, kawaii cute, petals radiating soft light, " + STYLE + ", plain solid white background"),
    ("sprites/biolum_flower_blue.png", "Glowing bioluminescent flower in blue and cyan, kawaii cute, petals radiating soft light, " + STYLE + ", plain solid white background"),
    ("sprites/biolum_flower_pink.png", "Glowing bioluminescent flower in pink and magenta, kawaii cute, petals radiating soft light, " + STYLE + ", plain solid white background"),
    ("sprites/bridge.png", "Tiny wooden bridge connecting floating island platforms, kawaii cute, rope railings, " + STYLE + ", plain solid white background"),
    
    # === UI ELEMENTS ===
    ("ui/btn_home.png", "Round button with a home icon, kawaii cute, soft purple gradient, " + STYLE + ", plain solid white background"),
    ("ui/btn_water.png", "Round button with a watering can icon, kawaii cute, soft blue gradient, " + STYLE + ", plain solid white background"),
    ("ui/dream_seed.png", "Glowing magical dream seed, kawaii cute, soft golden green glow, small star shape, " + STYLE + ", plain solid white background"),
    ("ui/btn_exit.png", "Round back arrow button, kawaii cute, soft purple gradient, " + STYLE + ", plain solid white background"),
    
    # === STUB SCENE BACKGROUNDS ===
    ("backgrounds/stub_potion_kitchen.png", "Cozy magical potion kitchen, bubbling cauldrons with colorful potions, shelves with bottles, warm candlelight, berries and honey and stardust ingredients, " + STYLE + ", dark dim background with soft sparkles"),
    ("backgrounds/stub_observatory.png", "Magical observatory interior, large telescope pointing to starry sky, glowing constellation maps, comfy cushions, warm ambient light, " + STYLE + ", dark dim background with soft sparkles"),
    ("backgrounds/stub_story_library.png", "Cozy magical story library, tall bookshelves with glowing books, comfy reading nook, warm fireplace, floating pages, " + STYLE + ", dark dim background with soft sparkles"),
    ("backgrounds/stub_music_garden.png", "Magical music garden, flowers that look like instruments, glowing petals, small wind chimes, soft colorful light, " + STYLE + ", dark dim background with soft sparkles"),
    ("backgrounds/stub_forest_trail.png", "Magical forest trail, glowing mushrooms, friendly woodland creatures peeking from behind trees, soft firefly light, " + STYLE + ", dark dim background with soft sparkles"),
    ("backgrounds/stub_bedroom.png", "Cozy magical bedroom, small kitten-sized bed under stars, dreamcatcher, soft blankets, warm nightlight glow, " + STYLE + ", dark dim background with soft sparkles"),
]

def generate_image(prompt, output_path, retries=3):
    """Generate an image via OpenRouter and save it."""
    for attempt in range(retries):
        try:
            print(f"  Generating: {os.path.basename(output_path)} (attempt {attempt+1})...")
            
            response = requests.post(
                API_URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Generate an image: {prompt}"
                        }
                    ],
                },
                timeout=120
            )
            
            if response.status_code != 200:
                print(f"  Error {response.status_code}: {response.text[:200]}")
                if attempt < retries - 1:
                    time.sleep(5)
                    continue
                return False
            
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                print(f"  No choices in response")
                if attempt < retries - 1:
                    time.sleep(5)
                    continue
                return False
            
            message = choices[0].get("message", {})
            content = message.get("content", [])
            
            # OpenRouter image models return images in message.images array
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
                        with open(output_path, "wb") as f:
                            f.write(img_data)
                        print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                        return True
            
            # Fallback: check content array for image type
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "image_url":
                        image_url = item.get("image_url", {}).get("url", "")
                        if image_url.startswith("data:"):
                            # Base64 encoded
                            b64_data = image_url.split(",", 1)[1]
                            img_data = base64.b64decode(b64_data)
                        else:
                            # URL — download it
                            img_data = requests.get(image_url, timeout=60).content
                        
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(img_data)
                        print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                        return True
            
            # Check if content is a string with markdown image
            if isinstance(content, str):
                import re
                match = re.search(r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)', content)
                if match:
                    img_data = base64.b64decode(match.group(1))
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(img_data)
                    print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                    return True
                # Check for URL in markdown
                match = re.search(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
                if match:
                    img_data = requests.get(match.group(1), timeout=60).content
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(img_data)
                    print(f"  ✓ Saved: {output_path} ({len(img_data)} bytes)")
                    return True
            
            print(f"  Could not find image in response. Content type: {type(content)}")
            if isinstance(content, list):
                for item in content:
                    print(f"    Item type: {item.get('type') if isinstance(item, dict) else type(item)}")
            elif isinstance(content, str):
                print(f"    String content (first 200): {content[:200]}")
            
            if attempt < retries - 1:
                time.sleep(5)
                
        except Exception as e:
            print(f"  Exception: {e}")
            if attempt < retries - 1:
                time.sleep(5)
    
    return False

def main():
    # Filter to specific assets if provided as args
    assets = ASSETS
    if len(sys.argv) > 1:
        keyword = sys.argv[1]
        assets = [(p, prompt) for p, prompt in ASSETS if keyword in p]
    
    print(f"Generating {len(assets)} assets with model {MODEL}...")
    print()
    
    success_count = 0
    fail_count = 0
    failed = []
    
    for i, (path, prompt) in enumerate(assets):
        full_path = os.path.join(ASSETS_DIR, path)
        print(f"[{i+1}/{len(assets)}] {path}")
        
        if generate_image(prompt, full_path):
            success_count += 1
        else:
            fail_count += 1
            failed.append(path)
        
        # Small delay between requests
        time.sleep(2)
    
    print()
    print(f"=== RESULTS ===")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    if failed:
        print(f"Failed assets: {failed}")
    
    return 0 if fail_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
