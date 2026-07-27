#!/usr/bin/env python3
"""Remove backgrounds from sprite images and trim to content."""
import os
import sys
from PIL import Image, ImageChops

def remove_white_bg(input_path, output_path, threshold=240):
    """Remove white/near-white background and make it transparent."""
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    new_data = []
    for pixel in data:
        r, g, b, a = pixel
        # If pixel is near-white, make it transparent
        if r > threshold and g > threshold and b > threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    return img

def trim_image(img):
    """Trim transparent borders from an image."""
    bg = Image.new(img.mode, img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if bbox:
        # Add small padding
        padding = 10
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(img.width, bbox[2] + padding)
        bottom = min(img.height, bbox[3] + padding)
        return img.crop((left, top, right, bottom))
    return img

def process_file(input_path, output_path=None, trim=True):
    """Process a single file: remove white bg and trim."""
    if output_path is None:
        output_path = input_path
    
    try:
        img = remove_white_bg(input_path, output_path)
        if trim:
            img = trim_image(img)
        img.save(output_path, "PNG")
        return True
    except Exception as e:
        print(f"  Error processing {input_path}: {e}")
        return False

def main():
    ASSETS_DIR = "/Users/wesche/whiskerwood/public/assets"
    
    # Only process sprites and UI elements (not backgrounds)
    # Backgrounds should keep their backgrounds
    process_dirs = ["sprites", "ui", "plants", "doors"]
    
    # Skip these — they're full scene backgrounds
    skip_dirs = ["backgrounds"]
    
    processed = 0
    failed = 0
    
    for dir_name in process_dirs:
        dir_path = os.path.join(ASSETS_DIR, dir_name)
        if not os.path.exists(dir_path):
            continue
        
        for filename in os.listdir(dir_path):
            if not filename.endswith(('.png', '.jpg', '.jpeg')):
                continue
            
            filepath = os.path.join(dir_path, filename)
            print(f"Processing: {dir_name}/{filename}", end=" ... ")
            
            try:
                img = remove_white_bg(filepath, filepath)
                img = trim_image(img)
                img.save(filepath, "PNG")
                print(f"✓ ({img.size[0]}x{img.size[1]})")
                processed += 1
            except Exception as e:
                print(f"✗ {e}")
                failed += 1
    
    print(f"\n=== RESULTS ===")
    print(f"Processed: {processed}")
    print(f"Failed: {failed}")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
