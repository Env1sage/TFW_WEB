const fs = require('fs');
const f = 'c:/Projects/TFW_WEB/website/src/pages/Home.tsx';
let t = fs.readFileSync(f, 'utf8');

// Fix mojibake: UTF-8 bytes read as Latin-1
const replacements = [
  ['â€"', '\u2014'],  // em dash
  ['â€"', '\u2013'],  // en dash
  ['â‚¹', '\u20B9'],  // rupee sign
  ['â˜…', '\u2605'],  // black star
];

for (const [bad, good] of replacements) {
  while (t.includes(bad)) {
    t = t.replace(bad, good);
  }
}

fs.writeFileSync(f, t, 'utf8');
console.log('Fixed all mojibake in Home.tsx');
