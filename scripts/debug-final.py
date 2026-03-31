"""Generate final alignment debug image with new BODIES values."""
from PIL import Image, ImageDraw
import numpy as np

out_dir = 'apps/web/public/mockups'

# New BODIES: cx=370, top=130, w=380, h=500
cx, top, bw, bh = 370, 130, 380, 500
cy = top + bh * 0.40  # = 330

areas = {
    'Full': (0.82, 0.62, 'blue'),
    'Medium': (0.58, 0.42, 'cyan'),
    'Small': (0.35, 0.22, 'magenta'),
}

for side in ['front', 'back']:
    img = Image.open(f'{out_dir}/tshirt-{side}.png').convert('RGBA')
    # Add a white background behind
    bg = Image.new('RGBA', img.size, (245, 245, 247, 255))
    bg.paste(img, (0, 0), img)
    draw = ImageDraw.Draw(bg)
    
    for name, (wr, hr, color) in areas.items():
        pw, ph = round(bw * wr), round(bh * hr)
        x = round(cx - pw / 2)
        y = round(cy - ph / 2)
        draw.rectangle([x, y, x + pw, y + ph], outline=color, width=2)
        draw.text((x + 4, y + 4), f"{name} ({x},{y},{pw}x{ph})", fill=color)
    
    # Pocket
    pw, ph = round(bw * 0.18), round(bh * 0.12)
    px_x = cx + (-80) - pw // 2
    draw.rectangle([px_x, 200, px_x + pw, 200 + ph], outline='green', width=2)
    draw.text((px_x + 4, 200 + 4), "Pocket", fill='green')
    
    # Center crosshair
    draw.line([cx - 15, cy, cx + 15, cy], fill='yellow', width=2)
    draw.line([cx, cy - 15, cx, cy + 15], fill='yellow', width=2)
    
    bg.save(f'{out_dir}/_debug_final_{side}.png')
    print(f'Saved _debug_final_{side}.png')
