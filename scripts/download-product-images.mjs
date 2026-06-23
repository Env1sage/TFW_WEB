import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../website/public/products');
fs.mkdirSync(OUT, { recursive: true });

// Maps filename → Unsplash photo URL (verified format)
// Using high-confidence Unsplash photo IDs + picsum fallback
const IMAGES = [
  // Visiting Cards
  { file: 'vc-1.jpg',           url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80&auto=format&fit=crop' },
  { file: 'vc-2.jpg',           url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80&auto=format&fit=crop' },
  // T-Shirts
  { file: 'tshirt-white.jpg',   url: 'https://images.unsplash.com/photo-1583743814255-5f7be95af6c7?w=600&q=80&auto=format&fit=crop' },
  { file: 'tshirt-dark.jpg',    url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80&auto=format&fit=crop' },
  { file: 'tshirt-oversized.jpg', url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80&auto=format&fit=crop' },
  { file: 'tshirt-printed.jpg', url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&q=80&auto=format&fit=crop' },
  // Polo
  { file: 'polo.jpg',           url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80&auto=format&fit=crop' },
  // Shirts
  { file: 'shirt.jpg',          url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80&auto=format&fit=crop' },
  // Hoodies
  { file: 'hoodie.jpg',         url: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80&auto=format&fit=crop' },
  { file: 'hoodie-zip.jpg',     url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80&auto=format&fit=crop' },
  // Jackets
  { file: 'jacket.jpg',         url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80&auto=format&fit=crop' },
  { file: 'jacket-bomber.jpg',  url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80&auto=format&fit=crop' },
  // Kids
  { file: 'kids-tshirt.jpg',    url: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=600&q=80&auto=format&fit=crop' },
  // Workwear
  { file: 'workwear.jpg',       url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80&auto=format&fit=crop' },
  { file: 'apron.jpg',          url: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=600&q=80&auto=format&fit=crop' },
  // Headwear
  { file: 'cap.jpg',            url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80&auto=format&fit=crop' },
  { file: 'beanie.jpg',         url: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=600&q=80&auto=format&fit=crop' },
  { file: 'bucket-hat.jpg',     url: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&q=80&auto=format&fit=crop' },
  // Bags
  { file: 'tote.jpg',           url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80&auto=format&fit=crop' },
  { file: 'bag-laptop.jpg',     url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80&auto=format&fit=crop' },
  { file: 'bag-paper.jpg',      url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80&auto=format&fit=crop' },
  { file: 'bag-gift.jpg',       url: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&q=80&auto=format&fit=crop' },
  // Stickers
  { file: 'sticker.jpg',        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80&auto=format&fit=crop' },
  { file: 'sticker-qr.jpg',     url: 'https://images.unsplash.com/photo-1588515724527-074a7a56616c?w=600&q=80&auto=format&fit=crop' },
  // Labels & Tags
  { file: 'label.jpg',          url: 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?w=600&q=80&auto=format&fit=crop' },
  { file: 'tag.jpg',            url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80&auto=format&fit=crop' },
  // Signs & Displays
  { file: 'banner.jpg',         url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80&auto=format&fit=crop' },
  { file: 'acrylic-sign.jpg',   url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&auto=format&fit=crop' },
  // Stationery
  { file: 'notebook.jpg',       url: 'https://images.unsplash.com/photo-1542435503-956c469947f6?w=600&q=80&auto=format&fit=crop' },
  { file: 'diary.jpg',          url: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=600&q=80&auto=format&fit=crop' },
  { file: 'brochure.jpg',       url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80&auto=format&fit=crop' },
  { file: 'calendar.jpg',       url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80&auto=format&fit=crop' },
  { file: 'pen.jpg',            url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600&q=80&auto=format&fit=crop' },
  // Stamps
  { file: 'stamp.jpg',          url: 'https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=600&q=80&auto=format&fit=crop' },
  // Mugs
  { file: 'mug.jpg',            url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80&auto=format&fit=crop' },
  { file: 'mug-magic.jpg',      url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&auto=format&fit=crop' },
  { file: 'tumbler.jpg',        url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80&auto=format&fit=crop' },
  { file: 'bottle.jpg',         url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80&auto=format&fit=crop' },
  { file: 'sipper.jpg',         url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600&q=80&auto=format&fit=crop' },
  // Gifts
  { file: 'gift-box.jpg',       url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&q=80&auto=format&fit=crop' },
  { file: 'photo-album.jpg',    url: 'https://images.unsplash.com/photo-1555817128-342e1b550c27?w=600&q=80&auto=format&fit=crop' },
  { file: 'photo-gift.jpg',     url: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&q=80&auto=format&fit=crop' },
  // Canvas & Art
  { file: 'canvas.jpg',         url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80&auto=format&fit=crop' },
  // Posters
  { file: 'poster.jpg',         url: 'https://images.unsplash.com/photo-1579762593175-20226054cad0?w=600&q=80&auto=format&fit=crop' },
  // Home & Living
  { file: 'cushion.jpg',        url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80&auto=format&fit=crop' },
  { file: 'framed-poster.jpg',  url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80&auto=format&fit=crop' },
  { file: 'acrylic-frame.jpg',  url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80&auto=format&fit=crop' },
  // Branding
  { file: 'mousepad.jpg',       url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80&auto=format&fit=crop' },
  { file: 'keychain.jpg',       url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop' },
  { file: 'pin-badge.jpg',      url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&q=80&auto=format&fit=crop' },
  { file: 'packaging.jpg',      url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80&auto=format&fit=crop' },
  { file: 'tablecloth.jpg',     url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80&auto=format&fit=crop' },
  // Rainwear
  { file: 'umbrella.jpg',       url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=600&q=80&auto=format&fit=crop' },
];

function fetchWithRedirect(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchWithRedirect(next, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function download(entry) {
  const dest = path.join(OUT, entry.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
    process.stdout.write(`  skip  ${entry.file}\n`);
    return;
  }
  // Try primary URL, fall back to picsum
  const keyword = entry.file.replace(/[-\d.jpg]/g, ' ').trim();
  const fallback = `https://picsum.photos/seed/${entry.file.replace('.jpg','')}/600/600`;
  for (const url of [entry.url, fallback]) {
    try {
      process.stdout.write(`  dl    ${entry.file} ... `);
      const res = await fetchWithRedirect(url);
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
      });
      const size = fs.statSync(dest).size;
      if (size < 2000) { fs.unlinkSync(dest); throw new Error('file too small'); }
      process.stdout.write(`done (${(size/1024).toFixed(0)}KB)\n`);
      return;
    } catch (e) {
      process.stdout.write(`failed (${e.message})\n`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
  }
  process.stdout.write(`  WARN  ${entry.file} could not be downloaded\n`);
}

console.log(`Downloading ${IMAGES.length} product images to ${OUT}\n`);
for (const img of IMAGES) {
  await download(img);
}
console.log('\nDone.');
