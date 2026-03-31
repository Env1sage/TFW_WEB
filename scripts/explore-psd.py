"""Deep-explore PSD layer tree: sublayers, blend modes, opacity, types."""
from psd_tools import PSDImage
from psd_tools.constants import BlendMode

psd = PSDImage.open('Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd')
print(f'PSD: {psd.width}x{psd.height}, mode={psd.color_mode}, channels={psd.channels}')

def show(layer, indent=0):
    pad = '  ' * indent
    bm = getattr(layer, 'blend_mode', '?')
    op = getattr(layer, 'opacity', '?')
    vis = getattr(layer, 'visible', '?')
    kind = getattr(layer, 'kind', '?')
    bbox = getattr(layer, 'bbox', '?')
    print(f'{pad}[{kind}] "{layer.name}"  blend={bm}  opacity={op}  visible={vis}  bbox={bbox}')
    if hasattr(layer, '__iter__'):
        for child in layer:
            show(child, indent + 1)

for layer in psd:
    show(layer)
