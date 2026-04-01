const fs = require('fs');
const f = 'c:/Projects/TFW_WEB/website/src/pages/OrderTracking.tsx';
const text = fs.readFileSync(f, 'utf8');
const marker = 'export default function OrderTracking()';
const first = text.indexOf(marker);
const second = text.indexOf(marker, first + 1);
if (second === -1) {
  console.log('No duplicate found, file is clean.');
  process.exit(0);
}
const out = text.substring(0, second).replace(/\s+$/, '') + '\n';
fs.writeFileSync(f, out);
console.log('SUCCESS: Removed duplicate function. File now ends at char', second - 1);
