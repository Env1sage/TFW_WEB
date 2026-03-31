from PIL import Image, ImageDraw
import numpy as np

# Generate final verification images with NEW print areas
# ---- FRONT ----
img_f = Image.open('website/public/mockups/tshirt-front.png').convert('RGBA')
overlay_f = Image.new('RGBA', img_f.size, (0,0,0,0))
draw_f = ImageDraw.Draw(overlay_f)

new_front = {
    'full':   {'x': 233, 'y': 170, 'w': 300, 'h': 330, 'color': (0,200,0,60)},
    'medium': {'x': 263, 'y': 200, 'w': 240, 'h': 260, 'color': (0,100,255,60)},
    'small':  {'x': 308, 'y': 250, 'w': 150, 'h': 155, 'color': (255,200,0,60)},
    'pocket': {'x': 433, 'y': 200, 'w': 70,  'h': 70,  'color': (255,0,200,60)},
}

for name, a in new_front.items():
    box = (a['x'], a['y'], a['x']+a['w'], a['y']+a['h'])
    draw_f.rectangle(box, fill=a['color'], outline=(a['color'][0], a['color'][1], a['color'][2], 200), width=2)
    w_str = str(a['w'])
    h_str = str(a['h'])
    draw_f.text((a['x']+5, a['y']+5), name + ' ' + w_str + 'x' + h_str, fill=(255,255,255))

# Mark garment center line
alpha_f = np.array(img_f)[:,:,3]
visible_f = alpha_f > 10
for y in range(100, 800, 5):
    row = np.where(visible_f[y])[0]
    if len(row) > 0:
        cx = (int(row[0]) + int(row[-1])) // 2
        draw_f.point((cx, y), fill=(255,0,0,128))

result_f = Image.alpha_composite(img_f, overlay_f)
result_f.save('website/public/mockups/_verify_front_new.png')
print('Front verification saved')

# ---- BACK ----
img_b = Image.open('website/public/mockups/tshirt-back.png').convert('RGBA')
overlay_b = Image.new('RGBA', img_b.size, (0,0,0,0))
draw_b = ImageDraw.Draw(overlay_b)

new_back = {
    'full':   {'x': 234, 'y': 170, 'w': 320, 'h': 340, 'color': (0,200,0,60)},
    'medium': {'x': 266, 'y': 200, 'w': 256, 'h': 272, 'color': (0,100,255,60)},
    'small':  {'x': 314, 'y': 245, 'w': 160, 'h': 170, 'color': (255,200,0,60)},
    'pocket': {'x': 434, 'y': 200, 'w': 70,  'h': 70,  'color': (255,0,200,60)},
}

for name, a in new_back.items():
    box = (a['x'], a['y'], a['x']+a['w'], a['y']+a['h'])
    draw_b.rectangle(box, fill=a['color'], outline=(a['color'][0], a['color'][1], a['color'][2], 200), width=2)
    w_str = str(a['w'])
    h_str = str(a['h'])
    draw_b.text((a['x']+5, a['y']+5), name + ' ' + w_str + 'x' + h_str, fill=(255,255,255))

alpha_b = np.array(img_b)[:,:,3]
visible_b = alpha_b > 10
for y in range(100, 900, 5):
    row = np.where(visible_b[y])[0]
    if len(row) > 0:
        cx = (int(row[0]) + int(row[-1])) // 2
        draw_b.point((cx, y), fill=(255,0,0,128))

result_b = Image.alpha_composite(img_b, overlay_b)
result_b.save('website/public/mockups/_verify_back_new.png')
print('Back verification saved')

# Print final summary
print()
print('== FRONT print areas ==')
for name, a in new_front.items():
    cx = a['x'] + a['w'] / 2
    cy = a['y'] + a['h'] / 2
    print('  %8s: (%d,%d) %dx%d  center=(%.0f,%.0f)' % (name, a['x'], a['y'], a['w'], a['h'], cx, cy))

print('== BACK print areas ==')
for name, a in new_back.items():
    cx = a['x'] + a['w'] / 2
    cy = a['y'] + a['h'] / 2
    print('  %8s: (%d,%d) %dx%d  center=(%.0f,%.0f)' % (name, a['x'], a['y'], a['w'], a['h'], cx, cy))
