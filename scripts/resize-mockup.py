"""Resize mockup images to 800x1000 and calculate print area coordinates."""
import os
from PIL import Image

out_dir = 'apps/web/public/mockups'

# Our canvas is 800x1000
CW, CH = 800, 1000

# PSD dimensions: 3000x2000, half = 1500x2000

# Front shirt in PSD: bbox(132, 0, 1381, 1772) within left half (0-1500)
# Front Effect (design area) in PSD: bbox(365, 328, 811, 785) 
# Back shirt in PSD: bbox(1562, 63, 2941, 1904) within right half (1500-3000)
# Back Effect (design area) in PSD: bbox(1875, 366, 2583, 928)

# Each half is 1500x2000. We cropped each half and resized to 800 wide.
# Scale factor from PSD half to our image:
scale = 800 / 1500  # = 0.5333
print(f'Scale factor: {scale:.4f}')

# For front (cropped from left half 0-1500):
front_effect_x1 = (365 - 0) * scale  # design left edge relative to left half
front_effect_y1 = (328 - 0) * scale
front_effect_x2 = (811 - 0) * scale
front_effect_y2 = (785 - 0) * scale
print(f'\nFront design area (in 800x1066 image):')
print(f'  x: {front_effect_x1:.0f} to {front_effect_x2:.0f} = w:{front_effect_x2 - front_effect_x1:.0f}')
print(f'  y: {front_effect_y1:.0f} to {front_effect_y2:.0f} = h:{front_effect_y2 - front_effect_y1:.0f}')

# For back (cropped from right half 1500-3000):
back_effect_x1 = (1875 - 1500) * scale
back_effect_y1 = (366 - 0) * scale
back_effect_x2 = (2583 - 1500) * scale
back_effect_y2 = (928 - 0) * scale
print(f'\nBack design area (in 800x1066 image):')
print(f'  x: {back_effect_x1:.0f} to {back_effect_x2:.0f} = w:{back_effect_x2 - back_effect_x1:.0f}')
print(f'  y: {back_effect_y1:.0f} to {back_effect_y2:.0f} = h:{back_effect_y2 - back_effect_y1:.0f}')

# Now resize the 800x1066 images to 800x1000
# We'll center-crop vertically (remove 33px from top and bottom)
for name in ['tshirt-front.png', 'tshirt-back.png']:
    img = Image.open(f'{out_dir}/{name}')
    w, h = img.size
    print(f'\n{name}: original {w}x{h}')
    
    if h > CH:
        # Center-crop vertically
        top_crop = (h - CH) // 2
        img = img.crop((0, top_crop, w, top_crop + CH))
        print(f'  Cropped to {img.size} (removed {top_crop}px from top)')
    elif h < CH:
        # Pad with transparent/white
        new_img = Image.new('RGB', (CW, CH), (245, 245, 247))  # match our bg
        y_offset = (CH - h) // 2
        new_img.paste(img, (0, y_offset))
        img = new_img
        print(f'  Padded to {img.size}')
    
    img.save(f'{out_dir}/{name}')
    print(f'  Saved {name} ({img.size})')

# Recalculate design coords after the vertical crop
top_crop = (1066 - 1000) // 2  # = 33px
print(f'\nVertical crop offset: {top_crop}px from top')

# Adjusted front design area (after crop)
fx1 = front_effect_x1
fy1 = front_effect_y1 - top_crop
fx2 = front_effect_x2
fy2 = front_effect_y2 - top_crop
print(f'\nFRONT design area (in final 800x1000):')
print(f'  x={fx1:.0f}, y={fy1:.0f}, w={fx2-fx1:.0f}, h={fy2-fy1:.0f}')

bx1 = back_effect_x1
by1 = back_effect_y1 - top_crop
bx2 = back_effect_x2
by2 = back_effect_y2 - top_crop
print(f'\nBACK design area (in final 800x1000):')
print(f'  x={bx1:.0f}, y={by1:.0f}, w={bx2-bx1:.0f}, h={by2-by1:.0f}')

# These are the "full print" coordinates. Other sizes are proportional.
print('\n\n--- Values for mockups.ts ---')
print(f'Front full: {{ x: {fx1:.0f}, y: {fy1:.0f}, w: {fx2-fx1:.0f}, h: {fy2-fy1:.0f} }}')
print(f'Back full:  {{ x: {bx1:.0f}, y: {by1:.0f}, w: {bx2-bx1:.0f}, h: {by2-by1:.0f} }}')
