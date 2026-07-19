export interface CatalogProduct {
  id: string; name: string; description: string; price: number;
  category: string; subcategory: string; image: string; customizable: boolean;
  colors: string[]; sizes: string[]; stock: number;
  rating: number; reviewCount: number; featured: boolean;
}

export const CATALOG_SUBCATEGORIES: { parent: string; children: string[] }[] = [
  // Clothing & Apparel
  { parent: 'T-Shirts',        children: ["Men's T-Shirts", "Women's T-Shirts", "Oversized T-Shirts", "Full Sleeve T-Shirts", "Round Neck T-Shirts", "V-Neck T-Shirts", "Dry Fit T-Shirts", "Printed T-Shirts", "Sports T-Shirts"] },
  { parent: 'Polo T-Shirts',   children: ["Men's Polo", "Women's Polo", "Sports Polo", "Scott Polo", "Branded Polo"] },
  { parent: 'Shirts',          children: ["Formal Shirts", "Casual Shirts", "Embroidered Shirts", "Corporate Shirts"] },
  { parent: 'Hoodies',         children: ["Pullover Hoodies", "Zip Hoodies", "Sweatshirts", "French Terry Hoodies", "Women's Hoodies"] },
  { parent: 'Jackets',         children: ["Bomber Jackets", "Varsity Jacket", "Windcheaters", "Fleece Jackets", "Winter Jackets", "Sports Jackets"] },
  { parent: 'Kids Clothing',   children: ["Kids T-Shirts", "Kids Hoodies", "Kids Sportswear"] },
  { parent: 'Workwear',        children: ["Uniform Shirts & Polos", "Aprons & Coats", "Safety Wear", "Lab Coats"] },
  { parent: 'Headwear',        children: ["Baseball Caps", "Snapback Caps", "Dad Caps", "Bucket Hats", "Trucker Caps", "Beanies", "Balaclava", "Headbands & Branded Bands"] },
  // Bags & Carry
  { parent: 'Bags',            children: ["Backpacks", "Laptop Bags", "Office Bags", "Messenger & Portfolio Bags", "Printed Carry Bags", "Designer Shopping Bags", "Premium Gift Bags", "Potli Bags"] },
  { parent: 'Tote Bags',       children: ["Canvas Totes", "Jute Totes", "Leather Totes", "Paper Bags"] },
  // Stickers, Labels & Packaging
  { parent: 'Stickers',        children: ["Sheet Stickers", "Custom Shape Stickers", "UV Ink Transfer Stickers", "Window Stickers", "Car Stickers", "Floor Stickers", "QR Code Stickers", "Vinyl Stickers", "Specialty Stickers"] },
  { parent: 'Labels',          children: ["Product Labels", "Packaging Labels", "Shipping Labels", "Return Address Labels", "Transparent Labels", "Industrial Labels", "Iron-on Labels"] },
  { parent: 'Tags',            children: ["Hang Tags", "Folded Hang Tags", "Name Tags", "Baggage Tags"] },
  // Drinkware
  { parent: 'Mugs',            children: ["Ceramic Mugs", "Magic Mugs", "Travel Mugs", "Photo Mugs", "Coffee Tumblers"] },
  { parent: 'Bottles',         children: ["Steel Bottles", "Copper Bottles", "Sipper Bottles", "Sports Bottles", "Tumblers", "Tumbler Bottles"] },
  // Print / Art
  { parent: 'Canvas',          children: ["Canvas Prints", "Framed Canvas"] },
  { parent: 'Posters',         children: ["Posters", "Framed Posters", "Bulk Posters"] },
  // Tech
  { parent: 'Phone Cases',     children: ["iPhone Cases", "Android Cases"] },
  // Cards
  { parent: 'Visiting Cards',  children: ["Standard Visiting Cards", "Classic Visiting Cards", "Rounded Corner Cards", "Square Visiting Cards", "Leaf / Oval / Circle Cards", "QR Code Visiting Cards", "NFC Visiting Cards", "Spot UV Cards", "Raised Foil Cards", "Glossy Cards", "Matte Cards", "Bulk Visiting Cards", "Magnetic Cards", "Transparent Cards", "Premium Plus Cards", "Non-Tearable Cards", "Velvet Touch Cards", "Pearl Cards", "Kraft Cards", "Diamond Cards"] },
  // Office / Print
  { parent: 'Stationery',      children: ["Notebooks & Diaries", "Letterheads", "Calendars", "Pens & Personalised Pens", "ID Cards", "Office Supplies", "Brochures & Booklets", "Postcards & Rate Cards", "Loyalty Cards & Gift Certificates", "Mouse Pads", "Bookmarks", "Keychains", "Pin Badges", "Tablecloths & Table Runners", "Car Door Decals"] },
  { parent: 'Stamps & Ink',    children: ["Self Inking Stamps", "Rubber Stamps", "Stamp Ink"] },
  // Gifts & Home
  { parent: 'Gifts',           children: ["Gift Boxes & Sets", "Photo Gifts", "Keychains & Magnets", "Photo Albums", "Gift Hampers"] },
  { parent: 'Home & Living',   children: ["Wall Posters", "Framed Posters", "Canvas Prints", "Cushion Covers", "Pillow Covers", "Wall Decor", "Acrylic Frames"] },
  // Displays
  { parent: 'Signs & Displays',children: ["Banners & Roll-ups", "Foam Boards", "Acrylic Signs", "Standees", "Tabletop Standees", "Tabletop Signs", "Boards & Tablecloths"] },
  // Branding
  { parent: 'Branding',        children: ["Corporate Kits", "Packaging", "Printed Materials"] },
  { parent: 'Branding Add-ons',children: ["Neck Labels", "Hang Tags", "Custom Packaging", "Brand Inserts"] },
  { parent: 'Design Services', children: ["Logo Design", "QR Code Generator", "Brand Identity", "Custom Design"] },
  // Rainwear
  { parent: 'Rainwear',        children: ["Umbrellas", "Single Fold Umbrellas", "Rain Ponchos", "Raincoats"] },
];

const p = (f: string) => `/products/${f}`;
const APPAREL_SIZES = ['XS','S','M','L','XL','XXL'];
const NONE: string[] = [];

export const CATALOG_CATEGORIES = [
  // Clothing & Apparel
  'T-Shirts','Polo T-Shirts','Shirts','Hoodies','Jackets',
  'Kids Clothing','Workwear','Headwear',
  // Bags & Carry
  'Bags','Tote Bags',
  // Stickers, Labels & Packaging
  'Stickers','Labels','Tags',
  // Drinkware
  'Mugs','Bottles',
  // Print / Art
  'Canvas','Posters',
  // Tech
  'Phone Cases',
  // Cards
  'Visiting Cards',
  // Office
  'Stationery','Stamps & Ink',
  // Gifts & Home
  'Gifts','Home & Living',
  // Displays
  'Signs & Displays',
  // Branding
  'Branding','Branding Add-ons',
  // Services
  'Design Services',
  // Rainwear
  'Rainwear',
];

export const CATALOG_PRODUCTS: CatalogProduct[] = [

  // ── MEN'S T-SHIRTS ──────────────────────────────────────────────────────────
  { id:'ts_m_white',    name:'Plain White Round Neck T-Shirt',       description:'180 GSM 100% combed cotton. Bio-washed, pre-shrunk, seamless ribbed collar. Runs true to size.',                       price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('05285db3-9d73-4c14-96fc-31c5765ddd2e.avif'), customizable:true,  colors:['#ffffff','#f5f5f5'],                 sizes:APPAREL_SIZES, stock:300, rating:4.8, reviewCount:412, featured:true  },
  { id:'ts_m_black',    name:'Classic Black T-Shirt',                description:'Premium 180 GSM jet-black cotton. Double-stitched hem and sleeves for long-lasting durability.',                         price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('19df9ef3-a267-44b4-9d45-7e564ff01c66.avif'), customizable:true,  colors:['#1a1a1a'],                           sizes:APPAREL_SIZES, stock:280, rating:4.8, reviewCount:387, featured:true  },
  { id:'ts_m_navy',     name:'Navy Blue Crew Neck T-Shirt',          description:'Rich navy 180 GSM combed cotton. Classic fit, double-stitched hems. Corporate customisation favourite.',                 price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('1efd75b9-feeb-447d-bd67-84d7d166291f.avif'), customizable:true,  colors:['#1b2a4a'],                           sizes:APPAREL_SIZES, stock:250, rating:4.7, reviewCount:231, featured:false },
  { id:'ts_m_charcoal', name:'Charcoal Grey T-Shirt',               description:'180 GSM charcoal grey cotton. Subtle heathered texture, slim regular fit. A versatile wardrobe essential.',              price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('1faeda25-a9e2-447c-8076-9dd6ad5ece6b.avif'), customizable:true,  colors:['#36454f'],                           sizes:APPAREL_SIZES, stock:220, rating:4.7, reviewCount:198, featured:false },
  { id:'ts_m_green',    name:'Forest Green T-Shirt',                 description:'Deep forest green 180 GSM cotton tee. Earthy tone popular with outdoor brands and eco-conscious labels.',                price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('37e4eb5c-939e-40b5-be51-0efa814fd3bc.avif'), customizable:true,  colors:['#2d5a3d'],                           sizes:APPAREL_SIZES, stock:200, rating:4.6, reviewCount:167, featured:false },
  { id:'ts_m_red',      name:'Brick Red T-Shirt',                   description:'Bold brick-red 180 GSM cotton. Pre-shrunk, bio-washed. Eye-catching for events, sports teams, and brand merch.',         price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('39c49960-ee45-4ef9-b33f-9809b9077db6.avif'), customizable:true,  colors:['#c0392b'],                           sizes:APPAREL_SIZES, stock:180, rating:4.6, reviewCount:143, featured:false },
  { id:'ts_m_skyblue',  name:'Sky Blue T-Shirt',                    description:'Light sky-blue 180 GSM cotton. Fresh, summery tone ideal for casual wear, resorts, and team events.',                    price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('3c5206a9-268b-41bc-9dfa-d75511b34045.avif'), customizable:true,  colors:['#87ceeb'],                           sizes:APPAREL_SIZES, stock:200, rating:4.6, reviewCount:156, featured:false },
  { id:'ts_m_maroon',   name:'Maroon T-Shirt',                      description:'Deep maroon 180 GSM combed cotton. Rich colour, excellent print compatibility. Popular for college merch.',               price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('56612353-1214-49a3-bc2e-9ef1eb9337b0.avif'), customizable:true,  colors:['#8b1a2d'],                           sizes:APPAREL_SIZES, stock:180, rating:4.7, reviewCount:189, featured:false },
  { id:'ts_m_olive',    name:'Olive Green T-Shirt',                  description:'Muted olive 180 GSM cotton. Earthy military-inspired tone trending in streetwear and lifestyle brands.',                  price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('5aeda01e-a7e6-4cb7-b1a2-9ad2d93f0921.avif'), customizable:true,  colors:['#6b7c3f'],                           sizes:APPAREL_SIZES, stock:170, rating:4.6, reviewCount:134, featured:false },
  { id:'ts_m_cream',    name:'Off-White Cream T-Shirt',              description:'Warm off-white 180 GSM cotton. Softer alternative to white — pairs well with every print style and colour.',             price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('5b036a08-b247-4117-90b8-4c37e7837258.avif'), customizable:true,  colors:['#f5e6d3'],                           sizes:APPAREL_SIZES, stock:200, rating:4.7, reviewCount:178, featured:false },
  { id:'ts_m_slate',    name:'Slate Grey T-Shirt',                   description:'Cool slate-grey 180 GSM cotton. Versatile neutral — great for minimalist branding and everyday corporate wear.',          price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('6169294d-d865-40fa-b781-c3d3dd733835.avif'), customizable:true,  colors:['#708090'],                           sizes:APPAREL_SIZES, stock:190, rating:4.6, reviewCount:112, featured:false },
  { id:'ts_m_royal',    name:'Royal Blue T-Shirt',                   description:'Vibrant royal blue 180 GSM cotton. Bold, energetic colour for sports teams, events, and promotional campaigns.',          price:449,  category:'T-Shirts', subcategory:"Men's T-Shirts",    image:p('644bff25-c91c-4d85-93de-e274b6a60146.avif'), customizable:true,  colors:['#2962ff'],                           sizes:APPAREL_SIZES, stock:180, rating:4.7, reviewCount:145, featured:false },

  // ── WOMEN'S T-SHIRTS ────────────────────────────────────────────────────────
  { id:'ts_w_white',    name:"Women's White Crew Neck T-Shirt",      description:'180 GSM combed cotton women\'s fit. Slightly tapered cut, ribbed collar. Comfortable and versatile.',                    price:449,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('65c6e875-6a58-46f4-8aec-f6cc2c727d28.avif'), customizable:true,  colors:['#ffffff'],                           sizes:APPAREL_SIZES, stock:250, rating:4.8, reviewCount:312, featured:true  },
  { id:'ts_w_black',    name:"Women's Black Fitted T-Shirt",         description:'180 GSM jet-black women\'s fitted tee. Sleek modern cut, double-stitched seams. Goes with everything.',                  price:449,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('68833db0-f19b-41cc-b4f1-42e8684d4447.avif'), customizable:true,  colors:['#1a1a1a'],                           sizes:APPAREL_SIZES, stock:230, rating:4.8, reviewCount:278, featured:true  },
  { id:'ts_w_lavender', name:'Lavender Purple Women\'s T-Shirt',     description:'Soft lavender 180 GSM cotton. Delicate, feminine colour excellent for lifestyle and wellness brands.',                    price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('876cb342-721d-4d0b-844e-8849fd23df85.avif'), customizable:true,  colors:['#9b59b6'],                           sizes:APPAREL_SIZES, stock:180, rating:4.7, reviewCount:198, featured:false },
  { id:'ts_w_rose',     name:'Dusty Rose T-Shirt',                   description:'Muted dusty rose 180 GSM cotton. Trending pastel tone for women\'s fashion and beauty brands.',                          price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('9415abf0-1fff-47e7-8e00-74c2fda03c66.avif'), customizable:true,  colors:['#e8b4b8'],                           sizes:APPAREL_SIZES, stock:160, rating:4.7, reviewCount:167, featured:false },
  { id:'ts_w_mint',     name:"Women's Mint Green T-Shirt",           description:'Fresh mint green 180 GSM cotton tee. Light, breathable, and perfect for summer collections and wellness brands.',         price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('9a8e45ba-92f0-45cb-aace-42831206a809.avif'), customizable:true,  colors:['#98d8c8'],                           sizes:APPAREL_SIZES, stock:150, rating:4.6, reviewCount:134, featured:false },
  { id:'ts_w_blush',    name:'Blush Pink Women\'s T-Shirt',          description:'Warm blush pink 180 GSM cotton. Universally flattering tone for gifting, events, and fashion merch.',                    price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('9bd43925-3bff-4f53-9d92-80c14714fd19.avif'), customizable:true,  colors:['#f0a8b0'],                           sizes:APPAREL_SIZES, stock:170, rating:4.7, reviewCount:189, featured:false },
  { id:'ts_w_nude',     name:'Nude Beige Women\'s T-Shirt',          description:'Nude beige 180 GSM cotton. Neutral, minimal, and on-trend. Great base for any DTG or DTF print.',                       price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('9f6abf27-4402-422c-9df4-c46773dbd2ef.avif'), customizable:true,  colors:['#e8d5b7'],                           sizes:APPAREL_SIZES, stock:160, rating:4.6, reviewCount:112, featured:false },
  { id:'ts_w_cobalt',   name:"Women's Cobalt Blue T-Shirt",          description:'Vivid cobalt blue 180 GSM women\'s cotton tee. High-visibility colour for brands, teams, and events.',                   price:499,  category:'T-Shirts', subcategory:"Women's T-Shirts",  image:p('a96160ce-de24-48cd-91d9-1d7aaef351a6.avif'), customizable:true,  colors:['#0047ab'],                           sizes:APPAREL_SIZES, stock:140, rating:4.7, reviewCount:98,  featured:false },

  // ── OVERSIZED T-SHIRTS ──────────────────────────────────────────────────────
  { id:'ts_os_white',   name:'White Oversized Drop-Shoulder Tee',    description:'220 GSM heavyweight boxy fit. Dropped shoulders, ribbed collar — the street-style staple in clean white.',              price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('ae3b610e-78dc-4b0a-a877-f69237deb575.avif'), customizable:true,  colors:['#ffffff'],                           sizes:['S','M','L','XL','XXL'], stock:200, rating:4.9, reviewCount:534, featured:true  },
  { id:'ts_os_black',   name:'Black Oversized Boxy T-Shirt',         description:'220 GSM heavyweight oversized fit in jet black. Dropped shoulders, ribbed crew neck. Street essential.',                 price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('b10e9b51-65a6-43f7-9e93-0e184c5853e9.avif'), customizable:true,  colors:['#1a1a1a'],                           sizes:['S','M','L','XL','XXL'], stock:190, rating:4.9, reviewCount:489, featured:true  },
  { id:'ts_os_beige',   name:'Beige Oversized T-Shirt',              description:'220 GSM warm beige oversized tee. Relaxed boxy silhouette, ideal for minimalist and vintage-inspired brands.',           price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('b3aa346d-6808-4573-9441-0fdbd9f0f66e.avif'), customizable:true,  colors:['#f5e6d3'],                           sizes:['S','M','L','XL','XXL'], stock:170, rating:4.8, reviewCount:312, featured:false },
  { id:'ts_os_sage',    name:'Sage Green Oversized Tee',             description:'220 GSM sage green oversized cotton. Earthy, muted tone — trending for lifestyle, wellness, and eco brands.',            price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('d42bf518-cd45-411b-8eb0-d0c0384e3fd1.avif'), customizable:true,  colors:['#8faf77'],                           sizes:['S','M','L','XL','XXL'], stock:150, rating:4.8, reviewCount:267, featured:false },
  { id:'ts_os_charcoal',name:'Charcoal Oversized Heavy T-Shirt',     description:'220 GSM charcoal oversized fit. Dark, bold tone for urban streetwear prints. Heavyweight feel, premium quality.',        price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('d43953f1-2c3b-48a8-a645-b2fc6929f3bd.avif'), customizable:true,  colors:['#36454f'],                           sizes:['S','M','L','XL','XXL'], stock:160, rating:4.8, reviewCount:289, featured:false },
  { id:'ts_os_cream',   name:'Cream Oversized Longline Tee',         description:'220 GSM cream longline oversized fit. Extended hem, dropped shoulders. Great layering piece for contemporary brands.',   price:749,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('d535facc-edbb-4bd1-afea-de7739509b72.avif'), customizable:true,  colors:['#fdf5e6'],                           sizes:['S','M','L','XL','XXL'], stock:130, rating:4.8, reviewCount:198, featured:false },
  { id:'ts_os_dustblue', name:'Dusty Blue Oversized T-Shirt',        description:'220 GSM dusty blue oversized cotton. Soft, muted blue — wearable, on-trend, and brand-versatile.',                      price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('d537cfe7-11b7-41bd-b319-2ff637a74ba5.avif'), customizable:true,  colors:['#7ba3be'],                           sizes:['S','M','L','XL','XXL'], stock:140, rating:4.7, reviewCount:223, featured:false },
  { id:'ts_os_army',    name:'Army Green Oversized Tee',             description:'220 GSM army green heavyweight tee. Military tone, boxy fit. Popular for tactical, fitness, and streetwear drops.',      price:699,  category:'T-Shirts', subcategory:'Oversized T-Shirts', image:p('df1b411b-46ec-4c8f-aa0d-75b796bcda00.avif'), customizable:true,  colors:['#4b5320'],                           sizes:['S','M','L','XL','XXL'], stock:150, rating:4.8, reviewCount:245, featured:false },

  // ── SPORTS / DRY-FIT T-SHIRTS ───────────────────────────────────────────────
  { id:'ts_sp_white',   name:'White Dry-Fit Performance T-Shirt',    description:'140 GSM moisture-wicking polyester. Quick-dry, anti-odour, UPF 30. Ideal for gym, sports, and outdoor events.',        price:549,  category:'T-Shirts', subcategory:'Sports T-Shirts',   image:p('e0083e35-1a62-4c12-8c78-6b990646dcd2.avif'), customizable:true,  colors:['#ffffff'],                           sizes:APPAREL_SIZES, stock:200, rating:4.6, reviewCount:213, featured:false },
  { id:'ts_sp_black',   name:'Black Sports Gym T-Shirt',             description:'140 GSM black dry-fit polyester. Ergonomic cut, flat-lock seams. Full sublimation print ready for team kits.',           price:549,  category:'T-Shirts', subcategory:'Sports T-Shirts',   image:p('e04cd46a-c42b-448e-bff3-05cef0de9bdd.avif'), customizable:true,  colors:['#1a1a1a'],                           sizes:APPAREL_SIZES, stock:180, rating:4.7, reviewCount:189, featured:false },
  { id:'ts_sp_navy',    name:'Navy Moisture-Wicking T-Shirt',        description:'140 GSM navy dry-fit tee. Anti-sweat, breathable mesh weave. Great for sports clubs and school events.',                  price:549,  category:'T-Shirts', subcategory:'Sports T-Shirts',   image:p('eb4b0c27-02ab-4a23-8c02-e60e9460c4f6.avif'), customizable:true,  colors:['#1b2a4a'],                           sizes:APPAREL_SIZES, stock:160, rating:4.6, reviewCount:156, featured:false },
  { id:'ts_sp_red',     name:'Red Sports Performance Tee',           description:'140 GSM red dry-fit polyester. High-visibility colour for team uniforms, marathons, and fitness events.',                 price:549,  category:'T-Shirts', subcategory:'Sports T-Shirts',   image:p('ed1c34b0-8c27-4f6e-9619-70765e5dae81.avif'), customizable:true,  colors:['#c0392b'],                           sizes:APPAREL_SIZES, stock:150, rating:4.6, reviewCount:134, featured:false },
  { id:'ts_sp_grey',    name:'Grey Dry-Fit Training T-Shirt',        description:'140 GSM grey moisture-wicking tee. Classic training colour, quick-dry fabric. Print or sublimation ready.',               price:549,  category:'T-Shirts', subcategory:'Sports T-Shirts',   image:p('ef04b1fc-accb-4f0a-8ae0-9d98edc64cd7.avif'), customizable:true,  colors:['#9e9e9e'],                           sizes:APPAREL_SIZES, stock:170, rating:4.6, reviewCount:112, featured:false },

  // ── FULL SLEEVE & V-NECK ────────────────────────────────────────────────────
  { id:'ts_fs_black',   name:'Full Sleeve Round Neck T-Shirt',       description:'180 GSM full-sleeve cotton tee. Ribbed cuffs, slim regular fit. Great for printing, embroidery, or plain.',              price:499,  category:'T-Shirts', subcategory:'Full Sleeve T-Shirts', image:p('f39ec867-aff1-4947-8176-768e81358e99.avif'), customizable:true, colors:['#1a1a1a','#ffffff','#1b2a4a'],       sizes:APPAREL_SIZES, stock:150, rating:4.7, reviewCount:134, featured:false },
  { id:'ts_vneck_white', name:'V-Neck Half Sleeve T-Shirt',          description:'180 GSM V-neck cotton tee. Classic V-collar, slim fit. Clean look for casual wear and custom print projects.',            price:499,  category:'T-Shirts', subcategory:'V-Neck T-Shirts',  image:p('f6055cac-2f14-411b-a1f4-7b645d491813.avif'), customizable:true, colors:['#ffffff','#1a1a1a','#1b2a4a'],       sizes:APPAREL_SIZES, stock:160, rating:4.6, reviewCount:98,  featured:false },

];
