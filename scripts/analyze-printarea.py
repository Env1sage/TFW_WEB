"""
Thorough pixel analysis of front & back mockup images.
Finds the exact visible shirt boundaries, torso (excluding sleeves),
and derives ideal print areas that center precisely on the chest.
"""
import numpy as np
from PIL import Image

def analyze_side(path, label):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    w, h = img.size
    alpha = arr[:, :, 3]
    
    print(f"\n{'='*60}")
    print(f"  {label}  ({w}x{h})")
    print(f"{'='*60}")
    
    # Overall visible bounds (alpha > 10)
    visible = alpha > 10
    rows_any = np.any(visible, axis=1)
    cols_any = np.any(visible, axis=0)
    y_min, y_max = np.where(rows_any)[0][[0, -1]]
    x_min, x_max = np.where(cols_any)[0][[0, -1]]
    print(f"\nOverall visible bounds:")
    print(f"  X: {x_min} to {x_max}  (width {x_max - x_min})")
    print(f"  Y: {y_min} to {y_max}  (height {y_max - y_min})")
    
    # Width profile at key Y positions (find where sleeves end)
    print(f"\nWidth profile at key Y positions:")
    for y in range(0, h, 50):
        row_vis = np.where(visible[y])[0]
        if len(row_vis) > 0:
            left, right = row_vis[0], row_vis[-1]
            width = right - left
            center = (left + right) // 2
            sleeve_note = ""
            if width > 500:
                sleeve_note = "  << SLEEVES"
            elif width > 400:
                sleeve_note = "  << wide torso"
            print(f"  y={y:3d}: left={left:3d} right={right:3d} width={width:3d} center={center:3d}{sleeve_note}")
    
    # Find the torso region (where width stabilizes/narrows after sleeves)
    # Scan from top to find where width drops below a threshold
    print(f"\nDetailed scan around sleeve/torso transition:")
    torso_start_y = None
    for y in range(100, 500):
        row_vis = np.where(visible[y])[0]
        if len(row_vis) == 0:
            continue
        left, right = row_vis[0], row_vis[-1]
        width = right - left
        if width < 450 and torso_start_y is None:
            torso_start_y = y
            print(f"  Torso narrows at y={y}: width={width}, left={left}, right={right}")
            break
    
    # Find torso center and bounds in the mid-chest area
    chest_y_start = torso_start_y if torso_start_y else 200
    chest_y_end = min(chest_y_start + 300, h - 50)
    
    centers = []
    lefts = []
    rights = []
    for y in range(chest_y_start, chest_y_end):
        row_vis = np.where(visible[y])[0]
        if len(row_vis) > 0:
            left, right = row_vis[0], row_vis[-1]
            centers.append((left + right) // 2)
            lefts.append(left)
            rights.append(right)
    
    if centers:
        avg_center = int(np.mean(centers))
        avg_left = int(np.mean(lefts))
        avg_right = int(np.mean(rights))
        avg_width = avg_right - avg_left
        print(f"\nTorso region ({chest_y_start} to {chest_y_end}):")
        print(f"  Average center: {avg_center}")
        print(f"  Average left edge: {avg_left}")
        print(f"  Average right edge: {avg_right}")
        print(f"  Average torso width: {avg_width}")
        
        # The printable area should be roughly 70-80% of torso width
        # and centered on the torso center
        full_w = int(avg_width * 0.72)
        full_h = int(full_w * 1.0)  # roughly square for full print
        
        # Vertical center should be between neckline and waist
        # Usually the neckline is near the top of torso, design starts below
        neckline_y = chest_y_start + 20
        
        # Full print area: centered on torso, from just below neckline
        full_x = avg_center - full_w // 2
        full_y = neckline_y
        
        print(f"\n--- RECOMMENDED PRINT AREAS ---")
        print(f"  Full:   x={full_x}, y={full_y}, w={full_w}, h={full_h}")
        
        med_w = int(full_w * 0.72)
        med_h = int(full_h * 0.72)
        med_x = avg_center - med_w // 2
        med_y = full_y + (full_h - med_h) // 2
        print(f"  Medium: x={med_x}, y={med_y}, w={med_w}, h={med_h}")
        
        small_w = int(full_w * 0.42)
        small_h = int(full_h * 0.42)
        small_x = avg_center - small_w // 2
        small_y = full_y + (full_h - small_h) // 2
        print(f"  Small:  x={small_x}, y={small_y}, w={small_w}, h={small_h}")
        
        # Pocket: upper-left chest area (viewer's right = wearer's left)
        # For front: pocket is typically on the left side of the shirt (viewer's right)
        pocket_w = int(full_w * 0.22)
        pocket_h = int(pocket_w * 0.9)
        pocket_x = avg_center + int(avg_width * 0.02)  # slightly right of center for front
        pocket_y = neckline_y + 30
        print(f"  Pocket: x={pocket_x}, y={pocket_y}, w={pocket_w}, h={pocket_h}")
        
        return {
            'torso_start': chest_y_start,
            'avg_center': avg_center,
            'avg_left': avg_left,
            'avg_right': avg_right,
            'avg_width': avg_width,
            'neckline_y': neckline_y,
        }
    return None

# Also look at the PSD smart object positions for reference
print("PSD SMART OBJECT REFERENCE:")
print("  Front Effect: bbox (365,328) to (811,785) in 2400x3000 PSD")
print("    → scaled to 800x1000: (121,109) to (270,261) → center (196, 185), size 149x152")
print("  Back Effect: bbox (1875,366) to (2583,928) in 2400x3000 PSD")  
print("    → The back is offset by 1200px (second half of PSD)")
print("    → Local coords: (675,366) to (1383,928)")
print("    → scaled: (225,122) to (461,309) → center (343, 216), size 236x187")

print("\n\nLet me recalculate the PSD coords more carefully:")
print("PSD is 4800x3000, front is left half (0-2400), back is right half (2400-4800)")
print("Each half is 2400x3000, scaled to 800x1000 → scale factor 1/3")

# Front
fx1, fy1, fx2, fy2 = 365, 328, 811, 785
print(f"\nFront Effect in PSD: ({fx1},{fy1}) to ({fx2},{fy2})")
print(f"  Scaled /3: ({fx1/3:.0f},{fy1/3:.0f}) to ({fx2/3:.0f},{fy2/3:.0f})")
print(f"  Center: ({(fx1+fx2)/6:.0f}, {(fy1+fy2)/6:.0f})")
print(f"  Size: {(fx2-fx1)/3:.0f} x {(fy2-fy1)/3:.0f}")

# Back - need to check if back bbox is in global or local coords
bx1, by1, bx2, by2 = 1875, 366, 2583, 928
print(f"\nBack Effect in PSD: ({bx1},{by1}) to ({bx2},{by2})")
# If these are global coords, back starts at x=2400 in 4800-wide PSD
# But wait - the back image is its own 800x1000 crop
# Let me check if back is right half or if the PSD has separate artboards
print(f"  If global coords and PSD is 4800 wide:")
print(f"    Local to back half: ({bx1-2400},{by1}) to ({bx2-2400},{by2})")
print(f"    But that gives negative x={bx1-2400}... so PSD may not be 4800 wide")
print(f"  If PSD is 2400x3000 and back is same canvas:")
print(f"    These coords would be in the right portion")
print(f"    Scaled /3: ({bx1/3:.0f},{by1/3:.0f}) to ({bx2/3:.0f},{by2/3:.0f})")
print(f"    Center: ({(bx1+bx2)/6:.0f}, {(by1+by2)/6:.0f})")
print(f"    Size: {(bx2-bx1)/3:.0f} x {(by2-by1)/3:.0f}")

print("\n\n" + "="*60)
print("ACTUAL PIXEL ANALYSIS OF MOCKUP IMAGES")
print("="*60)

front_info = analyze_side('apps/web/public/mockups/tshirt-front.png', 'FRONT')
back_info = analyze_side('apps/web/public/mockups/tshirt-back.png', 'BACK')

# Now generate final recommended values
if front_info and back_info:
    print("\n\n" + "="*60)
    print("FINAL RECOMMENDED printAreasBySide VALUES")
    print("="*60)
    
    for label, info in [('FRONT', front_info), ('BACK', back_info)]:
        cx = info['avg_center']
        tw = info['avg_width']
        ny = info['neckline_y']
        
        # Full: ~72% of torso width, aspect ratio ~1:1.05
        fw = int(tw * 0.70)
        fh = int(fw * 1.05)
        fx = cx - fw // 2
        fy = ny
        
        # Medium: ~52% of torso width
        mw = int(tw * 0.52)
        mh = int(mw * 1.05)
        mx = cx - mw // 2
        my = ny + (fh - mh) // 2
        
        # Small: ~30% of torso width
        sw = int(tw * 0.30)
        sh = int(sw * 1.05)
        sx = cx - sw // 2
        sy = ny + (fh - sh) // 2
        
        # Pocket: ~16% of torso width, on left chest (viewer's right for front, left for back)
        pw = int(tw * 0.16)
        ph = int(pw * 0.9)
        if label == 'FRONT':
            # Viewer's left chest = wearer's right
            px = cx - int(tw * 0.18)
            py = ny + 30
        else:
            # Back pocket/logo area: centered
            px = cx - pw // 2
            py = ny + 30
        
        print(f"\n  {label}:")
        print(f"    full:   {{ x: {fx}, y: {fy}, w: {fw}, h: {fh} }},")
        print(f"    medium: {{ x: {mx}, y: {my}, w: {mw}, h: {mh} }},")
        print(f"    small:  {{ x: {sx}, y: {sy}, w: {sw}, h: {sh} }},")
        print(f"    pocket: {{ x: {px}, y: {py}, w: {pw}, h: {ph} }},")
