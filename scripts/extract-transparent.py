"""Extract front/back t-shirt mockups WITHOUT background (transparent)."""
import os
from psd_tools import PSDImage
from PIL import Image
import numpy as np

psd_path = 'Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd'
out_dir = 'apps/web/public/mockups'
os.makedirs(out_dir, exist_ok=True)

CW, CH = 800, 1000

print(f'Loading PSD: {psd_path}')
psd = PSDImage.open(psd_path)
print(f'PSD size: {psd.width} x {psd.height}')

# List layer info
for layer in psd:
    print(f"  Layer '{layer.name}' kind={layer.kind} visible={layer.visible} bbox={layer.bbox}")

# Strategy: composite the Front and Back groups directly (they have alpha)
front_group = None
back_group = None
for layer in psd:
    if layer.name == 'Front':
        front_group = layer
    elif layer.name == 'Back':
        back_group = layer

half_w = psd.width // 2  # 1500

def extract_group(group, name, crop_x_offset=0):
    """Composite a group, crop to relevant half, resize to 800x1000."""
    print(f'\nProcessing group "{group.name}" (bbox={group.bbox})')
    img = group.composite()
    print(f'  Group composite: {img.size}, mode: {img.mode}')
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # The group composite is at the group's bbox position within the full PSD.
    # We need to place it on a full-PSD-sized transparent canvas first.
    full = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
    full.paste(img, (group.bbox[0], group.bbox[1]), img)
    
    # Crop to the relevant half
    half = full.crop((crop_x_offset, 0, crop_x_offset + half_w, psd.height))
    
    # Resize to 800 wide
    new_h = int(800 * psd.height / half_w)
    resized = half.resize((800, new_h), Image.LANCZOS)
    
    # Center-crop to 800x1000
    top_crop = (new_h - CH) // 2
    if top_crop > 0:
        resized = resized.crop((0, top_crop, CW, top_crop + CH))
    
    out_path = f'{out_dir}/{name}'
    resized.save(out_path)
    
    # Check alpha stats
    arr = np.array(resized)
    alpha = arr[:, :, 3]
    print(f'  Alpha: min={alpha.min()}, max={alpha.max()}, mean={alpha.mean():.1f}')
    transparent_pct = (alpha == 0).sum() / alpha.size * 100
    opaque_pct = (alpha == 255).sum() / alpha.size * 100
    print(f'  Transparent pixels: {transparent_pct:.1f}%, Opaque: {opaque_pct:.1f}%')
    print(f'  Saved {out_path} ({resized.size})')
    return resized

if front_group:
    extract_group(front_group, 'tshirt-front.png', crop_x_offset=0)
else:
    print('ERROR: Front group not found!')

if back_group:
    extract_group(back_group, 'tshirt-back.png', crop_x_offset=half_w)
else:
    print('ERROR: Back group not found!')

print('\nDone!')
