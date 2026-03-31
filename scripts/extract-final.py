"""
Create final mockup images:
- tshirt-front.png / tshirt-back.png: Neutral (white/gray) shirt with transparent bg
- tshirt-front-shadow.png / tshirt-back-shadow.png: Multiply shadow overlay

Strategy: Use the Background layer's pixel sub-layer as the shirt base (it's the
actual photograph). The shirt is photographed on a solid background, so we can
extract the shirt silhouette from the Front/Back group clip masks.
"""
import os
from psd_tools import PSDImage
from PIL import Image, ImageOps
import numpy as np

psd_path = 'Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd'
out_dir = 'apps/web/public/mockups'
os.makedirs(out_dir, exist_ok=True)

CW, CH = 800, 1000
half_w = 1500

psd = PSDImage.open(psd_path)
print(f'PSD: {psd.width}x{psd.height}')

# ─── Step 1: Get the base shirt photograph ───
# The Background group has a pixel "Back" layer - that's the actual shirt photo
bg_group = None
for layer in psd:
    if layer.name == 'Background':
        bg_group = layer
        break

bg_pixel = None
for child in bg_group:
    if child.kind == 'pixel':
        bg_pixel = child
        break

print(f'Background pixel layer: "{bg_pixel.name}" bbox={bg_pixel.bbox}')
base_img = bg_pixel.composite()
print(f'Base image: {base_img.size}, mode={base_img.mode}')

# Place on full canvas
full_base = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
full_base.paste(base_img, (bg_pixel.bbox[0], bg_pixel.bbox[1]))

# ─── Step 2: Get shirt silhouettes from Front/Back groups ───
# The Front/Back groups have clip masks that define the shirt shape
front_group = back_group = None
for layer in psd:
    if layer.name == 'Front':
        front_group = layer
    elif layer.name == 'Back' and layer.kind == 'group':
        back_group = layer

# Get front shirt mask from the solid color fill layer (it fills the shirt shape)
for child in front_group:
    if child.kind == 'solidcolorfill' and child.visible:
        front_fill = child.composite()
        print(f'Front fill: {front_fill.size}, mode={front_fill.mode}, bbox={child.bbox}')
        front_mask_img = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
        front_mask_img.paste(front_fill, (child.bbox[0], child.bbox[1]))
        break

for child in back_group:
    if child.kind == 'solidcolorfill' and child.visible:
        back_fill = child.composite()
        print(f'Back fill: {back_fill.size}, mode={back_fill.mode}, bbox={child.bbox}')
        back_mask_img = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
        back_mask_img.paste(back_fill, (child.bbox[0], child.bbox[1]))
        break

# Extract alpha channels as masks
front_mask = front_mask_img.split()[3]  # Alpha channel
back_mask = back_mask_img.split()[3]

# ─── Step 3: Get Highlight layers ───
hl_multiply = hl_screen = None
for layer in psd:
    if layer.name == 'Highlights':
        for child in layer:
            img = child.composite()
            if img:
                full_img = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
                full_img.paste(img, (child.bbox[0], child.bbox[1]))
                if child.blend_mode.name == 'MULTIPLY':
                    hl_multiply = full_img
                    print(f'Highlight MULTIPLY: {img.size}')
                elif child.blend_mode.name == 'SCREEN':
                    hl_screen = full_img
                    print(f'Highlight SCREEN (opacity={child.opacity}): {img.size}')

# ─── Step 4: Composite the neutral shirt ───
# Base photo + Highlights applied with their blend modes
# For multiply: result = base * highlight / 255
# For screen: result = 255 - (255 - base) * (255 - highlight) / 255

base_arr = np.array(full_base).astype(np.float32)
result = base_arr.copy()

if hl_multiply is not None:
    hl_m = np.array(hl_multiply).astype(np.float32)
    # Only apply where highlight has alpha
    m_alpha = hl_m[:, :, 3:4] / 255.0
    m_rgb = hl_m[:, :, :3]
    # Multiply blend: base * overlay / 255
    blended = result[:, :, :3] * m_rgb / 255.0
    result[:, :, :3] = result[:, :, :3] * (1 - m_alpha) + blended * m_alpha

if hl_screen is not None:
    hl_s = np.array(hl_screen).astype(np.float32)
    s_alpha = hl_s[:, :, 3:4] / 255.0 * (64 / 255.0)  # screen layer has opacity 64
    s_rgb = hl_s[:, :, :3]
    # Screen blend: 255 - (255 - base) * (255 - overlay) / 255
    blended = 255.0 - (255.0 - result[:, :, :3]) * (255.0 - s_rgb) / 255.0
    result[:, :, :3] = result[:, :, :3] * (1 - s_alpha) + blended * s_alpha

result = np.clip(result, 0, 255).astype(np.uint8)
neutral_full = Image.fromarray(result, 'RGBA')

# ─── Step 5: Apply masks and crop to front/back ───
def crop_half(img, mask, x_offset, name):
    """Crop to half, apply mask, resize to 800x1000."""
    # Apply mask to alpha channel
    masked = img.copy()
    r, g, b, a = masked.split()
    # Combine existing alpha with mask
    mask_crop = mask.crop((x_offset, 0, x_offset + half_w, psd.height))
    a_crop = a.crop((x_offset, 0, x_offset + half_w, psd.height))
    # Use minimum of existing alpha and mask
    combined_alpha = Image.fromarray(np.minimum(np.array(a_crop), np.array(mask_crop)))
    
    half = img.crop((x_offset, 0, x_offset + half_w, psd.height))
    half.putalpha(combined_alpha)
    
    new_h = int(CW * psd.height / half_w)
    resized = half.resize((CW, new_h), Image.LANCZOS)
    top_crop = (new_h - CH) // 2
    if top_crop > 0:
        resized = resized.crop((0, top_crop, CW, top_crop + CH))
    
    resized.save(f'{out_dir}/{name}')
    arr = np.array(resized)
    alpha = arr[:, :, 3]
    print(f'{name}: {resized.size}, transparent={((alpha == 0).sum()/alpha.size*100):.1f}%, opaque={((alpha == 255).sum()/alpha.size*100):.1f}%')
    return resized

# Combine front + back masks
full_mask = Image.fromarray(np.maximum(np.array(front_mask), np.array(back_mask)))

print('\n=== Final images ===')
crop_half(neutral_full, front_mask, 0, 'tshirt-front.png')
crop_half(neutral_full, back_mask, half_w, 'tshirt-back.png')

# Also extract shadow overlays (multiply highlight masked to shirt shape)
if hl_multiply is not None:
    crop_half(hl_multiply, front_mask, 0, 'tshirt-front-shadow.png')
    crop_half(hl_multiply, back_mask, half_w, 'tshirt-back-shadow.png')

# ─── Step 6: Print area coordinates ───
scale = CW / half_w
top_crop_px = (int(CW * psd.height / half_w) - CH) // 2

# Front Effect smart object: bbox(365, 328, 811, 785) in PSD coords
fx = round((365 - 0) * scale)
fy = round((328 - 0) * scale - top_crop_px)
fw = round((811 - 365) * scale)
fh = round((785 - 328) * scale)
print(f'\nFront print area (Effect smart object): x={fx}, y={fy}, w={fw}, h={fh}')

# Back Effect smart object: bbox(1875, 366, 2583, 928) in PSD coords
bx = round((1875 - half_w) * scale)
by = round((366 - 0) * scale - top_crop_px)
bw = round((2583 - 1875) * scale)
bh = round((928 - 366) * scale)
print(f'Back print area (Effect smart object): x={bx}, y={by}, w={bw}, h={bh}')

# But these are the smart object areas (existing design preview), not the max printable area
# The shirt body bounds should be used for the max print area
# Front shirt body: bbox=(132, 0, 1381, 1772) → just the front half (0-1500)
fb_left = round(132 * scale)
fb_top = round(0 * scale - top_crop_px)
fb_right = round(1381 * scale)
fb_bot = round(1772 * scale - top_crop_px)
print(f'\nFront shirt body bounds: left={fb_left}, top={fb_top}, right={fb_right}, bottom={fb_bot}')
print(f'  → cx={(fb_left+fb_right)//2}, width={fb_right-fb_left}, height={fb_bot-fb_top}')

# Back shirt body: bbox=(1562, 63, 2941, 1904) → relative to right half
bb_left = round((1562 - half_w) * scale)
bb_top = round(63 * scale - top_crop_px)
bb_right = round((2941 - half_w) * scale)
bb_bot = round(1904 * scale - top_crop_px)
print(f'Back shirt body bounds: left={bb_left}, top={bb_top}, right={bb_right}, bottom={bb_bot}')
print(f'  → cx={(bb_left+bb_right)//2}, width={bb_right-bb_left}, height={bb_bot-bb_top}')

# Clean up debug files
for f in os.listdir(out_dir):
    if f.startswith('_debug'):
        os.remove(f'{out_dir}/{f}')
        print(f'Removed debug: {f}')

print('\n=== Final files ===')
for f in sorted(os.listdir(out_dir)):
    size = os.path.getsize(f'{out_dir}/{f}')
    print(f'  {f}: {size//1024}KB')
