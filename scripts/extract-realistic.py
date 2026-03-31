"""
Extract realistic mockup layers from PSD.
We need:
1. The base shirt photo (neutral white) - Background pixel layer
2. The Highlights layer (multiply + screen) - fabric folds/shadows
Then we'll composite them for a realistic white shirt that can be tinted in the browser.
"""
import os
from psd_tools import PSDImage
from PIL import Image, ImageChops
import numpy as np

psd_path = 'Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd'
out_dir = 'apps/web/public/mockups'
os.makedirs(out_dir, exist_ok=True)

CW, CH = 800, 1000
half_w = 1500  # PSD is 3000 wide

psd = PSDImage.open(psd_path)
print(f'PSD: {psd.width}x{psd.height}')

# ─── Strategy ───
# 1. Get full composite with ALL layers (this is the default view with color tint)
# 2. Get full composite with Front/Back color fill layers hidden (neutral shirt)
# 3. Get just the Highlights group (for fabric fold overlay)

# First, let's get the full composite as-is (for reference)
print('\n--- Full composite (as-is) ---')
full_comp = psd.composite()
print(f'Full composite: {full_comp.size}, mode={full_comp.mode}')
full_comp.save(f'{out_dir}/_debug_full.png')

# Now hide the color fill layers in Front/Back groups to get neutral shirt
for layer in psd:
    if layer.name == 'Front':
        for child in layer:
            if child.kind == 'solidcolorfill':
                child.visible = False
                print(f'Hidden: Front > "{child.name}" (blend={child.blend_mode})')
    elif layer.name == 'Back':
        for child in layer:
            if child.kind == 'solidcolorfill':
                child.visible = False
                print(f'Hidden: Back > "{child.name}" (blend={child.blend_mode})')

# Also hide the Color adjustment group
for layer in psd:
    if layer.name == 'Color':
        layer.visible = False
        print(f'Hidden: "{layer.name}"')

print('\n--- Neutral composite (no color tint) ---')
neutral = psd.composite()
print(f'Neutral: {neutral.size}, mode={neutral.mode}')
neutral.save(f'{out_dir}/_debug_neutral.png')

# Now extract just the Highlights group
for layer in psd:
    if layer.name == 'Highlights':
        print(f'\n--- Highlights group ---')
        for child in layer:
            print(f'  "{child.name}" kind={child.kind} blend={child.blend_mode} opacity={child.opacity} bbox={child.bbox}')
            img = child.composite()
            if img:
                print(f'    composite: {img.size}, mode={img.mode}')
                # Save each highlight layer
                name = child.name.lower().replace(' ', '_')
                bm = str(child.blend_mode).split('.')[-1].lower()
                full_img = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
                full_img.paste(img, (child.bbox[0], child.bbox[1]))
                full_img.save(f'{out_dir}/_debug_hl_{bm}_{name}.png')

# ─── Now create the actual mockup images ───
# We'll use the neutral composite (no color tint) as the base
# This should be a white/gray shirt with all fabric detail

def crop_and_resize(img, x_offset, name):
    """Crop to a half, resize to 800x1000."""
    half = img.crop((x_offset, 0, x_offset + half_w, psd.height))
    new_h = int(CW * psd.height / half_w)
    resized = half.resize((CW, new_h), Image.LANCZOS)
    # Center-crop vertically
    top_crop = (new_h - CH) // 2
    if top_crop > 0:
        resized = resized.crop((0, top_crop, CW, top_crop + CH))
    resized.save(f'{out_dir}/{name}')
    print(f'\nSaved {name}: {resized.size}, mode={resized.mode}')
    if resized.mode == 'RGBA':
        arr = np.array(resized)
        alpha = arr[:, :, 3]
        print(f'  Alpha: min={alpha.min()}, max={alpha.max()}, transparent={((alpha == 0).sum() / alpha.size * 100):.1f}%')
    return resized

# Neutral full for front/back
print('\n=== Creating final mockup images ===')
front = crop_and_resize(neutral, 0, 'tshirt-front.png')
back = crop_and_resize(neutral, half_w, 'tshirt-back.png')

# Also extract the Highlight multiply layer separately (for design overlay)
for layer in psd:
    if layer.name == 'Highlights':
        for child in layer:
            img = child.composite()
            if img and child.blend_mode.name == 'MULTIPLY':
                full_img = Image.new('RGBA', (psd.width, psd.height), (255, 255, 255, 0))
                full_img.paste(img, (child.bbox[0], child.bbox[1]))
                crop_and_resize(full_img, 0, 'tshirt-front-shadow.png')
                crop_and_resize(full_img, half_w, 'tshirt-back-shadow.png')
                print('  ^ These are the multiply shadow overlays')

print('\n=== Done! ===')
print('Files:')
for f in os.listdir(out_dir):
    size = os.path.getsize(f'{out_dir}/{f}')
    print(f'  {f}: {size//1024}KB')
