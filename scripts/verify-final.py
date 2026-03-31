"""Final verification: overlay the EXACT coordinates now in mockups.ts onto the mockup images."""
from PIL import Image, ImageDraw

out_dir = 'apps/web/public/mockups'

# Exact coordinates from mockups.ts
front = {
    'Full (297x305)':   (166, 112, 297, 305, 'blue'),
    'Medium (238x244)': (195, 142, 238, 244, 'cyan'),
    'Small (142x146)':  (243, 191, 142, 146, 'magenta'),
    'Pocket (70x70)':   (354, 162, 70, 70, 'lime'),
}
back = {
    'Full (378x300)':   (200, 162, 378, 300, 'blue'),
    'Medium (264x210)': (257, 207, 264, 210, 'cyan'),
    'Small (170x135)':  (304, 245, 170, 135, 'magenta'),
    'Pocket (70x70)':   (354, 182, 70, 70, 'lime'),
}

for side, areas in [('front', front), ('back', back)]:
    img = Image.open(f'{out_dir}/tshirt-{side}.png').convert('RGBA')
    bg = Image.new('RGBA', img.size, (30, 30, 32, 255))
    bg.paste(img, (0, 0), img)
    draw = ImageDraw.Draw(bg)

    for label, (x, y, w, h, color) in areas.items():
        draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        draw.text((x + 4, y - 14), label, fill=color)
        # Center crosshair
        cx, cy = x + w//2, y + h//2
        draw.line([(cx-8, cy), (cx+8, cy)], fill=color, width=1)
        draw.line([(cx, cy-8), (cx, cy+8)], fill=color, width=1)

    bg.save(f'{out_dir}/_verify_{side}_final.png')
    print(f'Saved _verify_{side}_final.png')
