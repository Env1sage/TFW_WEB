import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { readPsd, initializeCanvas } from 'ag-psd';
import { createCanvas as makeCanvas, createImageData, Image } from 'canvas';
import sharp from 'sharp';

// Initialize ag-psd with proper node-canvas bridge
initializeCanvas(
  (w, h) => makeCanvas(Math.max(1, w), Math.max(1, h)),
  (imgData) => {
    // imgData is an ImageData-like { width, height, data }
    const c = makeCanvas(imgData.width, imgData.height);
    const ctx = c.getContext('2d');
    const iData = ctx.createImageData(imgData.width, imgData.height);
    iData.data.set(imgData.data);
    ctx.putImageData(iData, 0, 0);
    return c;
  },
  (w, h) => createImageData(Math.max(1, w), Math.max(1, h)),
);

const psdPath = 'Mockups/Front-Back-Man-T-shirt-Mockup/Front-Back-Man-T-shirt-Mockup.psd';
const outDir = 'apps/web/public/mockups';
mkdirSync(outDir, { recursive: true });

console.log('Reading PSD file with composite image...');
const buffer = readFileSync(psdPath);

// Read with composite image data (the flattened result)
const psd = readPsd(buffer, {
  skipLayerImageData: true,
  skipCompositeImageData: false,
  skipThumbnail: true,
});

console.log(`Canvas: ${psd.width} x ${psd.height}`);

if (psd.canvas) {
  console.log('Got composite canvas, extracting...');
  const pngBuf = psd.canvas.toBuffer('image/png');
  writeFileSync(`${outDir}/tshirt-composite.png`, pngBuf);
  console.log(`Wrote composite: ${pngBuf.length} bytes`);

  // The composite is 3000x2000 with front on left half, back on right half
  const halfW = Math.floor(psd.width / 2);

  // Extract front half (left side)
  await sharp(pngBuf)
    .extract({ left: 0, top: 0, width: halfW, height: psd.height })
    .resize(800, null, { fit: 'inside' })
    .png()
    .toFile(`${outDir}/tshirt-front.png`);
  console.log('Wrote tshirt-front.png');

  // Extract back half (right side)
  await sharp(pngBuf)
    .extract({ left: halfW, top: 0, width: halfW, height: psd.height })
    .resize(800, null, { fit: 'inside' })
    .png()
    .toFile(`${outDir}/tshirt-back.png`);
  console.log('Wrote tshirt-back.png');

  console.log('\nDone! Check apps/web/public/mockups/');
} else {
  console.log('No composite canvas found. Trying individual layers...');

  // Re-read with layer image data
  const psd2 = readPsd(buffer, {
    skipLayerImageData: false,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });

  function extractLayer(layers, name) {
    for (const l of layers) {
      if (l.name === name && l.canvas) return l;
      if (l.children) {
        const found = extractLayer(l.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  // Try to find and export any layers with canvas data
  function dumpLayers(layers, prefix = '') {
    for (const l of layers) {
      if (l.canvas) {
        const fn = `${outDir}/layer-${prefix}${l.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        const buf = l.canvas.toBuffer('image/png');
        writeFileSync(fn, buf);
        console.log(`Wrote: ${fn} (${l.canvas.width}x${l.canvas.height})`);
      }
      if (l.children) dumpLayers(l.children, `${prefix}${l.name}_`);
    }
  }

  dumpLayers(psd2.children);
}

console.log(`\nCanvas: ${psd.width} x ${psd.height}`);
console.log(`Children (top-level layers): ${psd.children?.length ?? 0}\n`);

function printLayers(layers, indent = 0) {
  if (!layers) return;
  for (const layer of layers) {
    const prefix = '  '.repeat(indent);
    const type = layer.children ? 'GROUP' : 'LAYER';
    const vis = layer.hidden ? '(hidden)' : '(visible)';
    const size = layer.canvas ? `${layer.canvas.width}x${layer.canvas.height}` : 'no-canvas';
    const blend = layer.blendMode || '';
    console.log(`${prefix}${type} "${layer.name}" ${vis} ${size} blend:${blend} opacity:${layer.opacity ?? 1}`);
    if (layer.children) {
      printLayers(layer.children, indent + 1);
    }
  }
}

printLayers(psd.children);

// Also try to get the composite (flattened) image
if (psd.canvas) {
  console.log(`\nComposite canvas: ${psd.canvas.width}x${psd.canvas.height}`);
  // Write composite as raw RGBA
  const { width, height, data } = psd.canvas;
  // We'll use sharp to convert
  console.log(`Composite data length: ${data.length} (expected ${width * height * 4})`);
}
