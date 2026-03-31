"""
Extract mockup assets from Mens_T-Shirt_Mockup.psd

PSD Structure (4000x4000):
  [V] Background - solidcolorfill (gray bg)
  [V] Shirt (group)
    [V] Shadows - pixel bbox=(888,3382,3081,3675) LINEAR_BURN op=179 (drop shadow)
    [V] Shirt - pixel bbox=(865,698,3086,3331) NORMAL (white shirt photo)
  [V] Collar - solidcolorfill LINEAR_BURN (collar color overlay)
  [V] Mockup (group)
    [V] Design > Front - smartobject bbox=(1168,687,2807,3343) MULTIPLY (design area)
    [V] Highlights > Highlights - pixel bbox=(865,698,3086,3331) SCREEN (fabric shine)

Output (3 separate layers for canvas compositing):
  1. tshirt-front.png       — Neutral white shirt body ONLY (no shadow), transparent bg
  2. tshirt-front-shadow.png — Drop shadow beneath the shirt
  3. tshirt-front-highlights.png — Fabric highlights overlay (SCREEN blend)
"""

import os
import numpy as np
from psd_tools import PSDImage
from PIL import Image

psd = PSDImage.open(r'C:\Projects\TFW_WEB\PSD_MOCKUP\Mens_T-Shirt_Mockup.psd')
out_dir = r'C:\Projects\TFW_WEB\website\public\mockups'
os.makedirs(out_dir, exist_ok=True)

print(f'PSD: {psd.width}x{psd.height}')

# --- Locate layers ---
shirt_pixel = None
shadows_pixel = None
highlights_pixel = None
front_smart = None

for layer in psd:
    if layer.name == 'Shirt' and layer.kind == 'group':
        for child in layer:
            if child.name == 'Shirt' and child.kind == 'pixel':
                shirt_pixel = child
            elif child.name == 'Shadows' and child.kind == 'pixel':
                shadows_pixel = child
    elif layer.name == 'Mockup' and layer.kind == 'group':
        for child in layer:
            if child.name == 'Highlights' and child.kind == 'group':
                for gc in child:
                    if gc.kind == 'pixel':
                        highlights_pixel = gc
            elif child.name == 'Design' and child.kind == 'group':
                for gc in child:
                    if gc.name == 'Front':
                        front_smart = gc

print(f'Shirt: bbox={shirt_pixel.bbox}')
print(f'Shadows: bbox={shadows_pixel.bbox} blend={shadows_pixel.blend_mode} op={shadows_pixel.opacity}')
print(f'Highlights: bbox={highlights_pixel.bbox} blend={highlights_pixel.blend_mode}')
print(f'Front design: bbox={front_smart.bbox}')

# --- Define crop region ---
# Include shirt + shadow area with padding
pad = 80
crop_left = min(shirt_pixel.bbox[0], shadows_pixel.bbox[0]) - pad
crop_top = shirt_pixel.bbox[1] - pad
crop_right = max(shirt_pixel.bbox[2], shadows_pixel.bbox[2]) + pad
crop_bottom = shadows_pixel.bbox[3] + pad

print(f'Crop region: ({crop_left},{crop_top}) to ({crop_right},{crop_bottom})')
crop_w = crop_right - crop_left

OUT_W = 800
scale = OUT_W / crop_w
OUT_H = int((crop_bottom - crop_top) * scale)
print(f'Output: {OUT_W}x{OUT_H} (scale={scale:.4f})')

# --- Helper: place layer into full canvas, crop, resize ---
def extract_layer(layer, name):
    img = layer.composite()
    if img is None:
        print(f'  WARNING: {name} composite returned None')
        return None
    full = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
    full.paste(img, (layer.bbox[0], layer.bbox[1]))
    cropped = full.crop((crop_left, crop_top, crop_right, crop_bottom))
    resized = cropped.resize((OUT_W, OUT_H), Image.LANCZOS)
    return resized

# --- 1. Extract shirt body ONLY (no drop shadow) ---
print('\n=== 1. Shirt body (no shadow) ===')
shirt_img = extract_layer(shirt_pixel, 'Shirt')
shirt_img.save(f'{out_dir}/tshirt-front.png')
sz = os.path.getsize(f'{out_dir}/tshirt-front.png')
print(f'  tshirt-front.png: {shirt_img.size}, {sz//1024}KB')

# --- 2. Extract drop shadow separately ---
print('\n=== 2. Drop shadow ===')
shadow_img = extract_layer(shadows_pixel, 'Shadows')
# Apply PSD opacity (179/255 ≈ 70%)
shadow_arr = np.array(shadow_img).copy()
shadow_arr[:, :, 3] = (shadow_arr[:, :, 3].astype(np.float32) * (179 / 255)).astype(np.uint8)
shadow_final = Image.fromarray(shadow_arr)
shadow_final.save(f'{out_dir}/tshirt-front-shadow.png')
sz = os.path.getsize(f'{out_dir}/tshirt-front-shadow.png')
print(f'  tshirt-front-shadow.png: {shadow_final.size}, {sz//1024}KB')

# --- 3. Extract highlights overlay (SCREEN blend) ---
print('\n=== 3. Highlights (SCREEN) ===')
hl_img = extract_layer(highlights_pixel, 'Highlights')
hl_img.save(f'{out_dir}/tshirt-front-highlights.png')
sz = os.path.getsize(f'{out_dir}/tshirt-front-highlights.png')
print(f'  tshirt-front-highlights.png: {hl_img.size}, {sz//1024}KB')

# --- Calculate print area ---
print('\n=== Print area calculation ===')
fx1, fy1, fx2, fy2 = front_smart.bbox
pa_left = (fx1 - crop_left) * scale / OUT_W
pa_top = (fy1 - crop_top) * scale / OUT_H
pa_width = (fx2 - fx1) * scale / OUT_W
pa_height = (fy2 - fy1) * scale / OUT_H
print(f'Full design area: left={pa_left:.4f} top={pa_top:.4f} width={pa_width:.4f} height={pa_height:.4f}')

# Center-chest print area (for centered design placement like TeePublic)
chest_left = 0.28
chest_top = 0.15
chest_width = 0.44
chest_height = 0.38
print(f'Center chest:    left={chest_left} top={chest_top} width={chest_width} height={chest_height}')

# --- Stats ---
print('\n=== Silhouette stats ===')
shirt_alpha = np.array(shirt_img)[:, :, 3]
print(f'  Transparent: {((shirt_alpha==0).sum()/shirt_alpha.size*100):.1f}%')
print(f'  Opaque:      {((shirt_alpha==255).sum()/shirt_alpha.size*100):.1f}%')

print('\n=== Final files ===')
for f in sorted(os.listdir(out_dir)):
    if f.startswith('tshirt-front'):
        fpath = os.path.join(out_dir, f)
        sz = os.path.getsize(fpath)
        img = Image.open(fpath)
        print(f'  {f}: {img.size}, {sz//1024}KB')

print('\nDONE')
