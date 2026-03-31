"""
Generate precise verification overlays using PSD smart object coordinates
and pixel analysis data. Create final coord recommendations.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out_dir = 'apps/web/public/mockups'

# PSD extraction parameters
PSD_W, PSD_H = 3000, 2000
HALF_W = 1500
CW, CH = 800, 1000
SCALE = CW / HALF_W  # 0.5333...
resize_h = int(CW * PSD_H / HALF_W)  # 1066
TOP_CROP = (resize_h - CH) // 2  # 33

def psd_to_canvas(x, y, x_offset=0):
    """Convert PSD coordinate to canvas coordinate."""
    cx = round((x - x_offset) * SCALE)
    cy = round(y * SCALE - TOP_CROP)
    return cx, cy

# Front Effect smart object: bbox(365, 328, 811, 785) in PSD coords
f_tl = psd_to_canvas(365, 328)
f_br = psd_to_canvas(811, 785)
f_cx = (f_tl[0] + f_br[0]) // 2
f_cy = (f_tl[1] + f_br[1]) // 2
f_w = f_br[0] - f_tl[0]
f_h = f_br[1] - f_tl[1]
print(f"Front PSD SO: ({f_tl[0]},{f_tl[1]}) to ({f_br[0]},{f_br[1]}) center=({f_cx},{f_cy}) size={f_w}x{f_h}")

# Back Effect smart object: bbox(1875, 366, 2583, 928) in PSD coords, offset by HALF_W
b_tl = psd_to_canvas(1875, 366, HALF_W)
b_br = psd_to_canvas(2583, 928, HALF_W)
b_cx = (b_tl[0] + b_br[0]) // 2
b_cy = (b_tl[1] + b_br[1]) // 2
b_w = b_br[0] - b_tl[0]
b_h = b_br[1] - b_tl[1]
print(f"Back PSD SO: ({b_tl[0]},{b_tl[1]}) to ({b_br[0]},{b_br[1]}) center=({b_cx},{b_cy}) size={b_w}x{b_h}")

# Define print areas based on PSD smart objects and pixel analysis
# FRONT: PSD center at (f_cx, f_cy), torso center x≈341, width≈401

# Full: expand PSD SO by ~25% → gives good chest coverage
full_fw = int(f_w * 1.25)
full_fh = int(f_h * 1.25)
front_areas = {
    'full':   {'x': f_cx - full_fw // 2, 'y': f_cy - full_fh // 2, 'w': full_fw, 'h': full_fh},
    'medium': {'x': f_tl[0], 'y': f_tl[1], 'w': f_w, 'h': f_h},   # = PSD smart object
    'small':  {'x': f_cx - int(f_w*0.6)//2, 'y': f_cy - int(f_h*0.6)//2, 'w': int(f_w*0.6), 'h': int(f_h*0.6)},
    'pocket': {'x': f_cx + 40, 'y': f_cy - f_h//2 + 20, 'w': 70, 'h': 70},  # wearer's left (viewer's right)
}

# BACK: PSD center at (b_cx, b_cy), torso center x≈394, width≈434
# PSD SO is already large for back, use as full
back_areas = {
    'full':   {'x': b_tl[0], 'y': b_tl[1], 'w': b_w, 'h': b_h},   # = PSD smart object
    'medium': {'x': b_cx - int(b_w*0.70)//2, 'y': b_cy - int(b_h*0.70)//2, 'w': int(b_w*0.70), 'h': int(b_h*0.70)},
    'small':  {'x': b_cx - int(b_w*0.45)//2, 'y': b_cy - int(b_h*0.45)//2, 'w': int(b_w*0.45), 'h': int(b_h*0.45)},
    'pocket': {'x': b_cx - 35, 'y': b_cy - b_h//2 + 20, 'w': 70, 'h': 70},  # centered upper back
}

print("\n=== FINAL FRONT AREAS ===")
for name, a in front_areas.items():
    cx = a['x'] + a['w']//2
    cy = a['y'] + a['h']//2
    print(f"  {name:7s}: {{ x: {a['x']}, y: {a['y']}, w: {a['w']}, h: {a['h']} }}  center=({cx},{cy})")

print("\n=== FINAL BACK AREAS ===")
for name, a in back_areas.items():
    cx = a['x'] + a['w']//2
    cy = a['y'] + a['h']//2
    print(f"  {name:7s}: {{ x: {a['x']}, y: {a['y']}, w: {a['w']}, h: {a['h']} }}  center=({cx},{cy})")

# Generate verification images
colors_map = {'full': 'blue', 'medium': 'cyan', 'small': 'magenta', 'pocket': 'green'}

for side, areas, so_rect in [
    ('front', front_areas, (f_tl[0], f_tl[1], f_br[0], f_br[1])),
    ('back', back_areas, (b_tl[0], b_tl[1], b_br[0], b_br[1]))
]:
    img = Image.open(f'{out_dir}/tshirt-{side}.png').convert('RGBA')
    bg = Image.new('RGBA', img.size, (240, 240, 242, 255))
    bg.paste(img, (0, 0), img)
    draw = ImageDraw.Draw(bg)

    # Draw PSD smart object reference (yellow dashed)
    draw.rectangle(so_rect, outline='yellow', width=2)
    draw.text((so_rect[0] + 2, so_rect[1] - 14), "PSD Effect SO", fill='yellow')

    # Draw center crosshair
    cx = (so_rect[0] + so_rect[2]) // 2
    cy = (so_rect[1] + so_rect[3]) // 2
    draw.line([(cx - 20, cy), (cx + 20, cy)], fill='yellow', width=1)
    draw.line([(cx, cy - 20), (cx, cy + 20)], fill='yellow', width=1)

    # Draw print areas
    for name, a in areas.items():
        x, y, w, h = a['x'], a['y'], a['w'], a['h']
        color = colors_map[name]
        draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        draw.text((x + 4, y + 4), f"{name} ({w}x{h})", fill=color)

    # Draw torso boundary markers
    if side == 'front':
        # Torso edges at chest level (y=400): left=147, right=556
        for marker_y in [200, 300, 400, 500]:
            draw.line([(147, marker_y), (160, marker_y)], fill='red', width=1)
            draw.line([(543, marker_y), (556, marker_y)], fill='red', width=1)
    else:
        for marker_y in [250, 350, 450, 550]:
            draw.line([(177, marker_y), (190, marker_y)], fill='red', width=1)
            draw.line([(598, marker_y), (611, marker_y)], fill='red', width=1)

    bg.save(f'{out_dir}/_verify_{side}_v2.png')
    print(f'\nSaved _verify_{side}_v2.png')

# Print the code-ready output
print("\n\n" + "="*60)
print("CODE-READY printAreasBySide:")
print("="*60)
print("    printAreasBySide: {")
print("      FRONT: {")
for name, a in front_areas.items():
    print(f"        {name}: {{ x: {a['x']}, y: {a['y']}, w: {a['w']}, h: {a['h']} }},")
print("      },")
print("      BACK: {")
for name, a in back_areas.items():
    print(f"        {name}: {{ x: {a['x']}, y: {a['y']}, w: {a['w']}, h: {a['h']} }},")
print("      },")
print("    },")
