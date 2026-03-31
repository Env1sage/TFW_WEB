"""Visualize print area overlays on the extracted shirt images to verify alignment."""
from PIL import Image, ImageDraw, ImageFont
import os

out_dir = 'apps/web/public/mockups'
CW, CH = 800, 1000

# PSD smart object coords (in our 800x1000 images):
# Front Effect: x=195, y=142, w=238, h=244  (center: 314, 264)
# Back Effect:  x=200, y=162, w=378, h=300  (center: 389, 312)
# Front body bounds: left=70, top=0, right=737, bottom=912 → cx=403

# Let's find the actual shirt content region by analyzing alpha
import numpy as np

for side in ['front', 'back']:
    img = Image.open(f'{out_dir}/tshirt-{side}.png').convert('RGBA')
    arr = np.array(img)
    alpha = arr[:, :, 3]
    
    # Find bounding box of non-transparent pixels
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    print(f'\n{side.upper()} shirt visible area:')
    print(f'  x: {cmin} to {cmax} (width={cmax-cmin})')
    print(f'  y: {rmin} to {rmax} (height={rmax-rmin})')
    print(f'  center: ({(cmin+cmax)//2}, {(rmin+rmax)//2})')
    
    # Find the row where the collar/neckline is (first significant alpha row)
    # and estimate where the chest starts
    for y in range(rmin, rmax):
        row_alpha = alpha[y, :]
        row_filled = np.sum(row_alpha > 50)
        # The collar area has a gap (neck hole), chest is wider
        if row_filled > 200:  # substantial fill = below collar
            print(f'  Chest starts at y={y} (first row with >200 filled pixels)')
            chest_start = y
            break
    
    # Find shoulder width (widest point near top)
    max_width = 0
    max_width_y = rmin
    for y in range(rmin, min(rmin + 200, rmax)):
        row_alpha = alpha[y, :]
        filled = np.sum(row_alpha > 50)
        if filled > max_width:
            max_width = filled
            max_width_y = y
    print(f'  Widest point: y={max_width_y}, width={max_width}px')
    
    # Draw debug visualization
    debug = img.copy().convert('RGBA')
    draw = ImageDraw.Draw(debug)
    
    # Body bounding box (red)
    draw.rectangle([cmin, rmin, cmax, rmax], outline='red', width=2)
    
    # PSD smart object area (green)
    if side == 'front':
        draw.rectangle([195, 142, 195+238, 142+244], outline='green', width=2)
        draw.text((195, 130), "PSD Effect", fill='green')
    else:
        draw.rectangle([200, 162, 200+378, 162+300], outline='green', width=2)
        draw.text((200, 150), "PSD Effect", fill='green')
    
    # Proposed print areas (blue)
    # New BODIES: cx=400, top=100, w=440, h=500
    cx, top, bw, bh = 400, 100, 440, 500
    
    # Full print (widthRatio=0.82, heightRatio=0.62)
    pw, ph = round(bw * 0.82), round(bh * 0.62)
    cy = top + bh * 0.40
    fx, fy = round(cx - pw/2), round(cy - ph/2)
    draw.rectangle([fx, fy, fx+pw, fy+ph], outline='blue', width=2)
    draw.text((fx, fy-15), f"Full: ({fx},{fy},{pw}x{ph})", fill='blue')
    
    # Medium print
    pw2, ph2 = round(bw * 0.58), round(bh * 0.42)
    fx2, fy2 = round(cx - pw2/2), round(cy - ph2/2)
    draw.rectangle([fx2, fy2, fx2+pw2, fy2+ph2], outline='cyan', width=1)
    draw.text((fx2, fy2-15), f"Med: ({fx2},{fy2},{pw2}x{ph2})", fill='cyan')
    
    # Small print
    pw3, ph3 = round(bw * 0.35), round(bh * 0.22)
    fx3, fy3 = round(cx - pw3/2), round(cy - ph3/2)
    draw.rectangle([fx3, fy3, fx3+pw3, fy3+ph3], outline='magenta', width=1)
    
    # Center crosshair
    draw.line([cx-10, cy, cx+10, cy], fill='yellow', width=2)
    draw.line([cx, cy-10, cx, cy+10], fill='yellow', width=2)
    
    debug.save(f'{out_dir}/_debug_alignment_{side}.png')
    print(f'  Saved alignment debug: _debug_alignment_{side}.png')

print('\nDone! Check _debug_alignment_*.png files')
