"""More precise chest area analysis - find the torso width profile."""
from PIL import Image
import numpy as np

out_dir = 'apps/web/public/mockups'

img = Image.open(f'{out_dir}/tshirt-front.png').convert('RGBA')
arr = np.array(img)
alpha = arr[:, :, 3]

print("=== FRONT T-shirt row-by-row width profile ===")
print("y | filled_px | left | right | center")
print("-" * 55)

for y in range(0, 920, 20):
    row_alpha = alpha[y, :]
    filled = np.where(row_alpha > 30)[0]
    if len(filled) > 0:
        left = filled[0]
        right = filled[-1]
        width = right - left
        center = (left + right) // 2
        print(f"{y:4d} | {width:4d}px | {left:4d} | {right:4d} | {center:4d}")

# The collar hole / neck opening creates a gap
# Let's find where the solid chest body starts (no gap in the middle)
print("\n=== Finding solid chest region (no neck gap) ===")
for y in range(0, 400, 5):
    row_alpha = alpha[y, :]
    filled = np.where(row_alpha > 30)[0]
    if len(filled) < 10:
        continue
    left = filled[0]
    right = filled[-1]
    center = (left + right) // 2
    
    # Check if center region (around x=400) is filled
    center_filled = np.sum(row_alpha[350:450] > 30)
    
    # Check for gaps (consecutive runs)
    gaps = 0
    in_gap = False
    for x in range(left, right):
        if row_alpha[x] <= 30:
            if not in_gap:
                gaps += 1
                in_gap = True
        else:
            in_gap = False
    
    if gaps == 0 and center_filled > 80:
        print(f"  First fully solid row: y={y} (width={right-left}, left={left}, right={right})")
        break

# Now find the neckline bottom (where the neck opening ends)
print("\n=== Neckline analysis ===")
for y in range(80, 300, 5):
    row_alpha = alpha[y, :]
    # Check a narrow center strip for the neck hole
    center_strip = row_alpha[340:460]
    center_filled = np.sum(center_strip > 30)
    total_center = len(center_strip)
    fill_pct = center_filled / total_center * 100
    
    # Also check full torso width
    torso = row_alpha[200:600]
    torso_filled = np.sum(torso > 30)
    torso_pct = torso_filled / len(torso) * 100
    
    print(f"  y={y:3d}: center fill={fill_pct:5.1f}%, torso fill={torso_pct:5.1f}%")

print("\n=== Back T-shirt neckline ===")
img_back = Image.open(f'{out_dir}/tshirt-back.png').convert('RGBA')
arr_back = np.array(img_back)
alpha_back = arr_back[:, :, 3]

for y in range(0, 300, 5):
    row_alpha = alpha_back[y, :]
    center_strip = row_alpha[340:460]
    center_filled = np.sum(center_strip > 30)
    fill_pct = center_filled / len(center_strip) * 100
    torso = row_alpha[200:600]
    torso_filled = np.sum(torso > 30)
    torso_pct = torso_filled / len(torso) * 100
    if torso_pct > 10:
        print(f"  y={y:3d}: center fill={fill_pct:5.1f}%, torso fill={torso_pct:5.1f}%")
