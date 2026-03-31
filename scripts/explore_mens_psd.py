from psd_tools import PSDImage
import os

psd = PSDImage.open(r'C:\Projects\TFW_WEB\PSD_MOCKUP\Mens_T-Shirt_Mockup.psd')
out = r'C:\Projects\TFW_WEB\svr_status.txt'

lines = []
lines.append(f'PSD: {psd.width}x{psd.height}')
for layer in psd:
    vis = 'V' if layer.visible else 'H'
    lines.append(f'[{vis}] {layer.name} kind={layer.kind} blend={layer.blend_mode} op={layer.opacity}')
    if hasattr(layer, '__iter__'):
        for child in layer:
            vis2 = 'V' if child.visible else 'H'
            lines.append(f'  [{vis2}] {child.name} kind={child.kind} bbox={child.bbox} blend={child.blend_mode} op={child.opacity}')
            if hasattr(child, '__iter__'):
                for gc in child:
                    vis3 = 'V' if gc.visible else 'H'
                    lines.append(f'    [{vis3}] {gc.name} kind={gc.kind} bbox={gc.bbox} blend={gc.blend_mode} op={gc.opacity}')
                    if hasattr(gc, '__iter__'):
                        for ggc in gc:
                            vis4 = 'V' if ggc.visible else 'H'
                            lines.append(f'      [{vis4}] {ggc.name} kind={ggc.kind} bbox={ggc.bbox} blend={ggc.blend_mode} op={ggc.opacity}')

with open(out, 'w') as f:
    f.write('\n'.join(lines))
print(f'Written {len(lines)} lines to {out}')
