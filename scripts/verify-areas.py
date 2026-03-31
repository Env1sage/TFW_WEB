"""Verify per-side PSD-based print areas on actual mockup images."""
from PIL import Image, ImageDraw

out_dir = 'apps/web/public/mockups'

areas = {
    'front': {
        'Full':   (154, 110, 320, 330, 'blue'),
        'Medium': (189, 137, 250, 254, 'cyan'),
        'Small':  (248, 204, 132, 120, 'magenta'),
        'Pocket': (200, 180, 68, 60, 'green'),
    },
    'back': {
        'Full':   (199, 145, 380, 340, 'blue'),
        'Medium': (249, 177, 280, 270, 'cyan'),
        'Small':  (314, 247, 150, 130, 'magenta'),
        'Pocket': (310, 250, 68, 60, 'green'),
    },
}

for side, sizes in areas.items():
    img = Image.open(f'{out_dir}/tshirt-{side}.png').convert('RGBA')
    bg = Image.new('RGBA', img.size, (245, 245, 247, 255))
    bg.paste(img, (0, 0), img)
    draw = ImageDraw.Draw(bg)

    for name, (x, y, w, h, color) in sizes.items():
        draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        draw.text((x + 4, y + 4), f"{name} ({x},{y} {w}x{h})", fill=color)

    # PSD smart object reference (yellow)
    if side == 'front':
        draw.rectangle([195, 142, 195+238, 142+244], outline='yellow', width=1)
        draw.text((195, 130), "PSD Effect SO", fill='yellow')
    else:
        draw.rectangle([200, 162, 200+378, 162+300], outline='yellow', width=1)
        draw.text((200, 150), "PSD Effect SO", fill='yellow')

    bg.save(f'{out_dir}/_verify_{side}.png')
    print(f'Saved _verify_{side}.png')
