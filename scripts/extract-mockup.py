"""Extract front/back t-shirt mockups from the PSD file."""
import os
from psd_tools import PSDImage
from PIL import Image

psd_path = 'Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd'
out_dir = 'apps/web/public/mockups'
os.makedirs(out_dir, exist_ok=True)

print(f'Loading PSD: {psd_path}')
psd = PSDImage.open(psd_path)
print(f'PSD size: {psd.width} x {psd.height}')

# List all layers
def print_layers(layers, indent=0):
    for layer in layers:
        vis = 'visible' if layer.is_visible() else 'hidden'
        kind = layer.kind
        bbox = layer.bbox if hasattr(layer, 'bbox') else 'N/A'
        print(f"{'  ' * indent}{kind} '{layer.name}' ({vis}) bbox={bbox} opacity={layer.opacity}")
        if layer.is_group():
            print_layers(layer, indent + 1)

print('\nLayer tree:')
print_layers(psd)

# Composite (flatten) the full PSD
print('\nCompositing full PSD...')
composite = psd.composite()
print(f'Composite size: {composite.size}, mode: {composite.mode}')

# Save full composite
composite.save(f'{out_dir}/tshirt-composite.png')
print(f'Saved tshirt-composite.png')

# The image is 3000x2000 with front on left half, back on right half
half_w = psd.width // 2

# Extract front (left half)
front = composite.crop((0, 0, half_w, psd.height))
# Resize to fit our 800x1000 canvas  
# Front half is 1500x2000, aspect ratio 0.75
# Our canvas is 800x1000, aspect ratio 0.8
# Let's resize to 800 wide, maintaining aspect
front_resized = front.resize((800, int(800 * psd.height / half_w)), Image.LANCZOS)
front_resized.save(f'{out_dir}/tshirt-front.png')
print(f'Saved tshirt-front.png ({front_resized.size})')

# Extract back (right half)
back = composite.crop((half_w, 0, psd.width, psd.height))
back_resized = back.resize((800, int(800 * psd.height / half_w)), Image.LANCZOS)
back_resized.save(f'{out_dir}/tshirt-back.png')
print(f'Saved tshirt-back.png ({back_resized.size})')

# Also try compositing with individual groups hidden/visible for analysis
# Let's also extract just the shirt without the color adjustment layers
# to understand what we have
print('\n--- Individual group composites ---')
for layer in psd:
    if layer.is_group():
        try:
            img = layer.composite()
            if img:
                fname = f'{out_dir}/group-{layer.name.replace(" ", "_").replace("/","_")}.png'
                img.save(fname)
                print(f'Saved {fname} ({img.size})')
        except Exception as e:
            print(f'Could not composite group "{layer.name}": {e}')

print('\nDone!')
