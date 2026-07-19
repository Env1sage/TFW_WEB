export interface CatalogProduct {
  id: string; name: string; description: string; price: number;
  category: string; subcategory: string; image: string; images?: string[]; customizable: boolean;
  colors: string[]; sizes: string[]; stock: number;
  rating: number; reviewCount: number; featured: boolean;
}

export const CATALOG_SUBCATEGORIES: { parent: string; children: string[] }[] = [
  { parent: 'T-Shirts',        children: ["Men's T-Shirts", "Women's T-Shirts", "Oversized T-Shirts", "Full Sleeve T-Shirts", "Round Neck T-Shirts", "V-Neck T-Shirts", "Dry Fit T-Shirts", "Printed T-Shirts", "Sports T-Shirts"] },
  { parent: 'Polo T-Shirts',   children: ["Men's Polo", "Women's Polo", "Sports Polo", "Scott Polo", "Branded Polo"] },
  { parent: 'Shirts',          children: ["Formal Shirts", "Casual Shirts", "Embroidered Shirts", "Corporate Shirts"] },
  { parent: 'Hoodies',         children: ["Pullover Hoodies", "Zip Hoodies", "Sweatshirts", "French Terry Hoodies", "Women's Hoodies"] },
  { parent: 'Jackets',         children: ["Bomber Jackets", "Varsity Jacket", "Windcheaters", "Fleece Jackets", "Winter Jackets", "Sports Jackets"] },
  { parent: 'Kids Clothing',   children: ["Kids T-Shirts", "Kids Hoodies", "Kids Sportswear"] },
  { parent: 'Workwear',        children: ["Uniform Shirts & Polos", "Aprons & Coats", "Safety Wear", "Lab Coats"] },
  { parent: 'Headwear',        children: ["Baseball Caps", "Snapback Caps", "Dad Caps", "Bucket Hats", "Trucker Caps", "Beanies", "Balaclava", "Headbands & Branded Bands"] },
  { parent: 'Bags',            children: ["Backpacks", "Laptop Bags", "Office Bags", "Messenger & Portfolio Bags", "Printed Carry Bags", "Designer Shopping Bags", "Premium Gift Bags", "Potli Bags"] },
  { parent: 'Tote Bags',       children: ["Canvas Totes", "Jute Totes", "Leather Totes", "Paper Bags"] },
  { parent: 'Stickers',        children: ["Sheet Stickers", "Custom Shape Stickers", "UV Ink Transfer Stickers", "Window Stickers", "Car Stickers", "Floor Stickers", "QR Code Stickers", "Vinyl Stickers", "Specialty Stickers"] },
  { parent: 'Labels',          children: ["Product Labels", "Packaging Labels", "Shipping Labels", "Return Address Labels", "Transparent Labels", "Industrial Labels", "Iron-on Labels"] },
  { parent: 'Tags',            children: ["Hang Tags", "Folded Hang Tags", "Name Tags", "Baggage Tags"] },
  { parent: 'Mugs',            children: ["Ceramic Mugs", "Magic Mugs", "Travel Mugs", "Photo Mugs", "Coffee Tumblers"] },
  { parent: 'Bottles',         children: ["Steel Bottles", "Copper Bottles", "Sipper Bottles", "Sports Bottles", "Tumblers", "Tumbler Bottles"] },
  { parent: 'Canvas',          children: ["Canvas Prints", "Framed Canvas"] },
  { parent: 'Posters',         children: ["Posters", "Framed Posters", "Bulk Posters"] },
  { parent: 'Phone Cases',     children: ["iPhone Cases", "Android Cases"] },
  { parent: 'Visiting Cards',  children: ["Standard Visiting Cards", "Classic Visiting Cards", "Rounded Corner Cards", "Square Visiting Cards", "Leaf / Oval / Circle Cards", "QR Code Visiting Cards", "NFC Visiting Cards", "Spot UV Cards", "Raised Foil Cards", "Glossy Cards", "Matte Cards", "Bulk Visiting Cards", "Magnetic Cards", "Transparent Cards", "Premium Plus Cards", "Non-Tearable Cards", "Velvet Touch Cards", "Pearl Cards", "Kraft Cards", "Diamond Cards"] },
  { parent: 'Stationery',      children: ["Notebooks & Diaries", "Letterheads", "Calendars", "Pens & Personalised Pens", "ID Cards", "Office Supplies", "Brochures & Booklets", "Postcards & Rate Cards", "Loyalty Cards & Gift Certificates", "Mouse Pads", "Bookmarks", "Keychains", "Pin Badges", "Tablecloths & Table Runners", "Car Door Decals"] },
  { parent: 'Stamps & Ink',    children: ["Self Inking Stamps", "Rubber Stamps", "Stamp Ink"] },
  { parent: 'Gifts',           children: ["Gift Boxes & Sets", "Photo Gifts", "Keychains & Magnets", "Photo Albums", "Gift Hampers"] },
  { parent: 'Home & Living',   children: ["Wall Posters", "Framed Posters", "Canvas Prints", "Cushion Covers", "Pillow Covers", "Wall Decor", "Acrylic Frames"] },
  { parent: 'Signs & Displays',children: ["Banners & Roll-ups", "Foam Boards", "Acrylic Signs", "Standees", "Tabletop Standees", "Tabletop Signs", "Boards & Tablecloths"] },
  { parent: 'Branding',        children: ["Corporate Kits", "Packaging", "Printed Materials"] },
  { parent: 'Branding Add-ons',children: ["Neck Labels", "Hang Tags", "Custom Packaging", "Brand Inserts"] },
  { parent: 'Design Services', children: ["Logo Design", "QR Code Generator", "Brand Identity", "Custom Design"] },
  { parent: 'Rainwear',        children: ["Umbrellas", "Single Fold Umbrellas", "Rain Ponchos", "Raincoats"] },
];

const p = (f: string) => `/products/${f}`;
const APPAREL_SIZES = ['XS','S','M','L','XL','XXL'];
const KIDS_SIZES   = ['2Y','4Y','6Y','8Y','10Y','12Y','14Y'];
const NONE: string[] = [];

export const CATALOG_CATEGORIES = [
  'T-Shirts','Polo T-Shirts','Shirts','Hoodies','Jackets',
  'Kids Clothing','Workwear','Headwear',
  'Bags','Tote Bags',
  'Stickers','Labels','Tags',
  'Mugs','Bottles',
  'Canvas','Posters',
  'Phone Cases',
  'Visiting Cards',
  'Stationery','Stamps & Ink',
  'Gifts','Home & Living',
  'Signs & Displays',
  'Branding','Branding Add-ons',
  'Design Services',
  'Rainwear',
];

export const CATALOG_PRODUCTS: CatalogProduct[] = [

  // ── T-SHIRTS ────────────────────────────────────────────────────────────────
  {
    id: 'ts_mens_round_neck',
    name: "Men's Round Neck T-Shirt",
    description: '180 GSM 100% combed cotton. Bio-washed, pre-shrunk, seamless ribbed collar. Available in multiple colours. Runs true to size.',
    price: 449,
    category: 'T-Shirts', subcategory: "Men's T-Shirts",
    image: p('mens_tshirt.avif'),
    images: [p('mens_tshirt2.avif'), p('mens_tshirt3.avif'), p('mens_tshirt_back.avif'), p('mens_tshirt_closeup.avif')],
    customizable: true,
    colors: ['#ffffff','#1a1a1a','#1b2a4a','#c0392b','#2d5a3d','#36454f'],
    sizes: APPAREL_SIZES, stock: 500, rating: 4.8, reviewCount: 412, featured: true,
  },
  {
    id: 'ts_mens_black',
    name: "Men's Classic Black T-Shirt",
    description: 'Premium 180 GSM jet-black combed cotton. Double-stitched hem and sleeves. The everyday essential that pairs with everything.',
    price: 449,
    category: 'T-Shirts', subcategory: "Men's T-Shirts",
    image: p('mens_black_tshirt.avif'),
    images: [],
    customizable: true,
    colors: ['#1a1a1a'],
    sizes: APPAREL_SIZES, stock: 300, rating: 4.8, reviewCount: 387, featured: true,
  },
  {
    id: 'ts_oversized',
    name: 'Oversized Drop-Shoulder T-Shirt',
    description: '220 GSM heavyweight boxy fit. Dropped shoulders, ribbed collar. Available in white and green — the street-style staple.',
    price: 699,
    category: 'T-Shirts', subcategory: 'Oversized T-Shirts',
    image: p('oversized_tshirt.avif'),
    images: [p('oversized_tshirt_green.avif'), p('mens_oversized_tshirt_2.avif')],
    customizable: true,
    colors: ['#ffffff','#2d5a3d','#1a1a1a','#f5e6d3'],
    sizes: ['S','M','L','XL','XXL'], stock: 250, rating: 4.9, reviewCount: 534, featured: true,
  },

  // ── HOODIES ─────────────────────────────────────────────────────────────────
  {
    id: 'hoodie_pullover',
    name: "Men's Pullover Hoodie",
    description: '320 GSM fleece-lined pullover. Kangaroo pocket, ribbed hem and cuffs. Available in grey, black, and more. Pre-shrunk cotton-poly blend.',
    price: 1199,
    category: 'Hoodies', subcategory: 'Pullover Hoodies',
    image: p('mens_hoodie.avif'),
    images: [p('mens_hoodie2.avif'), p('mens_hoodie_black.avif'), p('mens_hoodie_closeup.avif')],
    customizable: true,
    colors: ['#9e9e9e','#1a1a1a','#36454f','#1b2a4a'],
    sizes: APPAREL_SIZES, stock: 200, rating: 4.9, reviewCount: 534, featured: true,
  },

  // ── KIDS CLOTHING ────────────────────────────────────────────────────────────
  {
    id: 'kids_tshirt',
    name: "Kids Round Neck T-Shirt",
    description: '160 GSM 100% combed cotton kids tee. Pre-shrunk, bio-washed, seamless collar. Child-safe dyes. Available in ages 2–14.',
    price: 349,
    category: 'Kids Clothing', subcategory: "Kids T-Shirts",
    image: p('kid_tshirt.avif'),
    images: [p('kids_tshirt2.avif'), p('kids_tshirt3.avif'), p('kids_tshirt3_2.avif')],
    customizable: true,
    colors: ['#ffffff','#1a1a1a','#c0392b','#1b2a4a','#fce4ec','#e3f2fd'],
    sizes: KIDS_SIZES, stock: 300, rating: 4.7, reviewCount: 187, featured: true,
  },

  // ── HEADWEAR ─────────────────────────────────────────────────────────────────
  {
    id: 'cap_baseball',
    name: 'Classic Baseball Cap',
    description: 'Cotton-twill 6-panel cap with structured front. Embroidery-ready. Adjustable back strap. One size fits most.',
    price: 499,
    category: 'Headwear', subcategory: 'Baseball Caps',
    image: p('cap.avif'),
    images: [p('cap_sideview.avif')],
    customizable: true,
    colors: ['#1a1a1a','#ffffff','#1b2a4a','#c0392b'],
    sizes: NONE, stock: 200, rating: 4.7, reviewCount: 312, featured: true,
  },
  {
    id: 'cap_red',
    name: 'Red Baseball Cap',
    description: 'Bold red cotton-twill 6-panel cap. High-visibility colour for sports teams, events, and brand campaigns. Adjustable strap.',
    price: 499,
    category: 'Headwear', subcategory: 'Baseball Caps',
    image: p('red_cap.avif'),
    images: [p('red_cap_back.avif')],
    customizable: true,
    colors: ['#c0392b'],
    sizes: NONE, stock: 150, rating: 4.6, reviewCount: 198, featured: false,
  },

  // ── MUGS ─────────────────────────────────────────────────────────────────────
  {
    id: 'mug_ceramic',
    name: 'Classic Ceramic Mug (320ml)',
    description: 'Dishwasher-safe ceramic mug. Full-colour sublimation print, wraparound or single-side. 320ml capacity. Perfect for gifting.',
    price: 349,
    category: 'Mugs', subcategory: 'Ceramic Mugs',
    image: p('mug.avif'),
    images: [p('mug2.avif'), p('mug3.avif'), p('mug4.avif')],
    customizable: true,
    colors: ['#ffffff'],
    sizes: NONE, stock: 500, rating: 4.7, reviewCount: 534, featured: true,
  },

  // ── STATIONERY ───────────────────────────────────────────────────────────────
  {
    id: 'stationery_sketchbook',
    name: 'Custom Sketchbook / Notebook',
    description: 'A5 hardcover sketchbook with 160 GSM acid-free pages. Custom-printed cover. Ideal for artists, students, and corporate gifting.',
    price: 599,
    category: 'Stationery', subcategory: 'Notebooks & Diaries',
    image: p('sketchbook.avif'),
    images: [p('sketchbook2.avif'), p('sketchbook3.avif'), p('sketchbook4.avif')],
    customizable: true,
    colors: ['#ffffff','#1a1a1a','#f5e6d3'],
    sizes: NONE, stock: 200, rating: 4.6, reviewCount: 134, featured: false,
  },

  // ── TOTE BAGS ────────────────────────────────────────────────────────────────
  {
    id: 'tote_canvas',
    name: 'Natural Canvas Tote Bag',
    description: '12 oz 100% cotton canvas. Natural undyed colour. Comfortable 68cm handle drop. Screen print or embroidery on front or back.',
    price: 399,
    category: 'Tote Bags', subcategory: 'Canvas Totes',
    image: p('tote_bag.avif'),
    images: [p('tote_bag2.avif'), p('totebag3.avif')],
    customizable: true,
    colors: ['#f5e6d3'],
    sizes: NONE, stock: 300, rating: 4.7, reviewCount: 312, featured: true,
  },

  // ── BOTTLES / DRINKWARE ──────────────────────────────────────────────────────
  {
    id: 'tumbler_coffee',
    name: 'Coffee Tumbler (400ml)',
    description: '400ml double-wall steel tumbler with sliding lid. Keeps hot 6hr, cold 12hr. Fits most car holders. Laser engrave or full-wrap print.',
    price: 899,
    category: 'Bottles', subcategory: 'Tumblers',
    image: p('tumbler.avif'),
    images: [p('tumbler2.avif'), p('tumbler3.avif')],
    customizable: true,
    colors: ['#9e9e9e','#1a1a1a','#6b4c3b'],
    sizes: NONE, stock: 150, rating: 4.8, reviewCount: 267, featured: true,
  },

];
