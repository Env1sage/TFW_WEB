import pg from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/* ── Schema bootstrap ── */
export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
        google_id TEXT UNIQUE,
        avatar TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price NUMERIC(10,2) NOT NULL,
        category TEXT NOT NULL,
        image TEXT NOT NULL DEFAULT '',
        images JSONB NOT NULL DEFAULT '[]',
        customizable BOOLEAN NOT NULL DEFAULT true,
        colors JSONB NOT NULL DEFAULT '[]',
        sizes JSONB NOT NULL DEFAULT '[]',
        stock INT NOT NULL DEFAULT 100,
        rating NUMERIC(3,2) NOT NULL DEFAULT 0,
        review_count INT NOT NULL DEFAULT 0,
        featured BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES website_users(id),
        items JSONB NOT NULL DEFAULT '[]',
        total NUMERIC(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        shipping_address TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_mockups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'T-Shirts',
        front_image TEXT NOT NULL DEFAULT '',
        back_image TEXT,
        front_shadow TEXT,
        back_shadow TEXT,
        print_area JSONB NOT NULL DEFAULT '{}',
        base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        front_print_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        back_print_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_design_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES website_users(id),
        product_type TEXT NOT NULL,
        color_hex TEXT NOT NULL DEFAULT '#ffffff',
        color_name TEXT NOT NULL DEFAULT 'White',
        print_size TEXT NOT NULL DEFAULT 'full',
        sides JSONB NOT NULL DEFAULT '[]',
        design_images JSONB NOT NULL DEFAULT '{}',
        uploaded_images JSONB NOT NULL DEFAULT '{}',
        quantity INT NOT NULL DEFAULT 1,
        unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        shipping_address TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_saved_designs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES website_users(id),
        name TEXT NOT NULL DEFAULT 'Untitled Design',
        product_type TEXT NOT NULL,
        color_hex TEXT NOT NULL DEFAULT '#ffffff',
        color_name TEXT NOT NULL DEFAULT 'White',
        print_size TEXT NOT NULL DEFAULT 'full',
        canvas_data JSONB NOT NULL DEFAULT '{}',
        thumbnail TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_corporate_inquiries (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        product_interest TEXT NOT NULL DEFAULT '',
        quantity INT NOT NULL DEFAULT 100,
        message TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        admin_notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_coupons (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
        min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_uses INT,
        use_count INT NOT NULL DEFAULT 0,
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT true,
        popup_enabled BOOLEAN NOT NULL DEFAULT false,
        popup_message TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Add popup columns to existing tables (safe for existing deployments)
      ALTER TABLE website_coupons ADD COLUMN IF NOT EXISTS popup_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE website_coupons ADD COLUMN IF NOT EXISTS popup_message TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS website_shipments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        shiprocket_order_id TEXT,
        shiprocket_shipment_id TEXT,
        awb_code TEXT,
        courier_name TEXT,
        courier_id INT,
        status TEXT NOT NULL DEFAULT 'pending',
        tracking_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS website_mockup_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add category_id column to products if not yet present
    await client.query(`
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES website_categories(id) ON DELETE SET NULL;
    `);

    // Add uploaded_images column to design orders if not yet present (migration for existing DBs)
    await client.query(`
      ALTER TABLE website_design_orders ADD COLUMN IF NOT EXISTS uploaded_images JSONB NOT NULL DEFAULT '{}';
    `);

    // Add mockup_id column to products for mockup-based display
    await client.query(`
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS mockup_id TEXT REFERENCES website_mockups(id) ON DELETE SET NULL;
    `);

    // Add payment and coupon columns to orders
    await client.query(`
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    `);

    // Add group_order_id for linking product + design orders from same checkout
    await client.query(`
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS group_order_id TEXT;
      ALTER TABLE website_design_orders ADD COLUMN IF NOT EXISTS group_order_id TEXT;
    `);

    // Drop FK on website_shipments.order_id if it exists (design orders are in a different table)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE website_shipments DROP CONSTRAINT IF EXISTS website_shipments_order_id_fkey;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `);

    // Add pricing columns to website_mockups if missing
    await client.query(`
      ALTER TABLE website_mockups ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) NOT NULL DEFAULT 0;
      ALTER TABLE website_mockups ADD COLUMN IF NOT EXISTS front_print_price NUMERIC(10,2) NOT NULL DEFAULT 0;
      ALTER TABLE website_mockups ADD COLUMN IF NOT EXISTS back_print_price NUMERIC(10,2) NOT NULL DEFAULT 0;
    `);

    // Add weight and dimensions to products
    await client.query(`
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS weight_grams INT NOT NULL DEFAULT 200;
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS length_cm INT NOT NULL DEFAULT 30;
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS breadth_cm INT NOT NULL DEFAULT 20;
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS height_cm INT NOT NULL DEFAULT 5;
    `);

    // Shipping zones table
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_shipping_zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        pin_patterns JSONB NOT NULL DEFAULT '[]',
        shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 49,
        free_above NUMERIC(10,2) NOT NULL DEFAULT 999,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure unique constraints exist on categories (safe to run repeatedly)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON website_categories(slug);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_ci ON website_categories(LOWER(name));
    `);

    // Ensure unique constraints exist on mockup categories
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mockup_categories_slug ON website_mockup_categories(slug);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mockup_categories_name_ci ON website_mockup_categories(LOWER(name));
    `);

    // Seed default admin if not exists
    const adminCheck = await client.query(`SELECT id FROM website_users WHERE email = $1`, ['admin@theframedwall.com']);
    if (adminCheck.rows.length === 0) {
      const defaultPw = process.env.ADMIN_DEFAULT_PASSWORD || 'TFW@dmin2026!Secure';
      const hashed = await bcrypt.hash(defaultPw, 12);
      await client.query(
        `INSERT INTO website_users (id, name, email, password, role, two_factor_enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        ['admin-001', 'Admin', 'admin@theframedwall.com', hashed, 'admin', false]
      );
      console.log('Created default admin: admin@theframedwall.com (password set via ADMIN_DEFAULT_PASSWORD env var or secure default)');
    }

    // Seed categories if empty
    const catCheck = await client.query(`SELECT COUNT(*) as cnt FROM website_categories`);
    if (parseInt(catCheck.rows[0].cnt) === 0) {
      await seedCategories(client);
    }

    // Always seed mockup categories (ON CONFLICT DO NOTHING is safe)
    await seedMockupCategories(client);

    // Seed default shipping zones if none exist
    const zoneCheck = await client.query(`SELECT COUNT(*) as cnt FROM website_shipping_zones`);
    if (parseInt(zoneCheck.rows[0].cnt) === 0) {
      await client.query(
        `INSERT INTO website_shipping_zones (id, name, label, pin_patterns, shipping_charge, free_above, sort_order, active, created_at) VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, NOW()),
         ($9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
        [
          uuidv4(), 'pune_local', 'Pune & PCMC', JSON.stringify(['411', '412']), 29, 499, 1, true,
          uuidv4(), 'india_rest', 'Rest of India (Courier)', JSON.stringify([]), 79, 999, 2, true,
        ]
      );
      console.log('Seeded default shipping zones');
    }

    // Seed products if empty
    const prodCheck = await client.query(`SELECT COUNT(*) as cnt FROM website_products`);
    if (parseInt(prodCheck.rows[0].cnt) === 0) {
      await seedProducts(client);
    }

    // Link any existing products that don't have a category_id yet
    await client.query(`
      UPDATE website_products p
      SET category_id = c.id
      FROM website_categories c
      WHERE LOWER(p.category) = LOWER(c.name) AND p.category_id IS NULL;
    `);
  } finally {
    client.release();
  }
}

async function seedCategories(client: pg.PoolClient) {
  const defaults = [
    { name: 'T-Shirts',     slug: 't-shirts'     },
    { name: 'Hoodies',      slug: 'hoodies'      },
    { name: 'Mugs',         slug: 'mugs'         },
    { name: 'Phone Cases',  slug: 'phone-cases'  },
    { name: 'Posters',      slug: 'posters'      },
    { name: 'Canvas',       slug: 'canvas'       },
    { name: 'Stickers',     slug: 'stickers'     },
    { name: 'Tote Bags',    slug: 'tote-bags'    },
  ];
  for (const cat of defaults) {
    await client.query(
      `INSERT INTO website_categories (id, name, slug, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (slug) DO NOTHING`,
      [uuidv4(), cat.name, cat.slug]
    );
  }
  console.log('Seeded default categories');
}

async function seedMockupCategories(client: pg.PoolClient) {
  const defaults = [
    { name: 'T-Shirts',     slug: 't-shirts'     },
    { name: 'Hoodies',      slug: 'hoodies'      },
    { name: 'Mugs',         slug: 'mugs'         },
    { name: 'Phone Cases',  slug: 'phone-cases'  },
    { name: 'Posters',      slug: 'posters'      },
    { name: 'Canvas',       slug: 'canvas'       },
    { name: 'Tote Bags',    slug: 'tote-bags'    },
    { name: 'Stickers',     slug: 'stickers'     },
  ];
  for (const cat of defaults) {
    await client.query(
      `INSERT INTO website_mockup_categories (id, name, slug, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (slug) DO NOTHING`,
      [uuidv4(), cat.name, cat.slug]
    );
  }
  console.log('Seeded default mockup categories');
}

async function seedProducts(client: pg.PoolClient) {
  const products = [
    { id: 'prod_1', sku: 'TFW-TS-1001-WHT', name: 'Classic Custom T-Shirt', description: 'Premium 100% combed cotton t-shirt with your custom design. Bio-washed, pre-shrunk, and perfect for everyday wear.', price: 599, category: 'T-Shirts', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500', customizable: true, colors: ['#ffffff', '#1a1a1a', '#1b2a4a', '#c0392b', '#2d5a3d'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], stock: 150, rating: 4.8, reviewCount: 234, featured: true },
    { id: 'prod_2', sku: 'TFW-HD-1001-BLK', name: 'Premium Custom Hoodie', description: 'Cozy fleece-lined hoodie with custom print. 300 GSM terry cotton, warm and uniquely yours.', price: 1299, category: 'Hoodies', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500', customizable: true, colors: ['#1a1a1a', '#1b2a4a', '#36454f', '#6b1c23', '#ffffff'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 80, rating: 4.7, reviewCount: 156, featured: true },
    { id: 'prod_3', sku: 'TFW-MG-1001-WHT', name: 'Personalized Ceramic Mug', description: 'High-quality 11oz ceramic mug with vibrant custom print. Dishwasher & microwave safe.', price: 399, category: 'Mugs', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500', customizable: true, colors: ['#ffffff'], sizes: ['11oz', '15oz'], stock: 200, rating: 4.9, reviewCount: 312, featured: true },
    { id: 'prod_4', sku: 'TFW-PC-1001-WHT', name: 'Custom Phone Case', description: 'Slim-fit protective phone case with your design. Impact-resistant and scratch-proof.', price: 499, category: 'Phone Cases', image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500', customizable: true, colors: ['#ffffff', '#1a1a1a', '#87ceeb'], sizes: ['iPhone 14', 'iPhone 15', 'iPhone 16', 'Samsung S24', 'Pixel 8'], stock: 120, rating: 4.6, reviewCount: 189, featured: false },
    { id: 'prod_5', sku: 'TFW-PS-1001', name: 'Custom Art Poster', description: 'Museum-quality poster printed on thick, durable matte paper. Perfect for any room.', price: 449, category: 'Posters', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500', customizable: true, colors: [], sizes: ['12x16', '18x24', '24x36'], stock: 300, rating: 4.8, reviewCount: 267, featured: true },
    { id: 'prod_6', sku: 'TFW-CV-1001', name: 'Canvas Print', description: 'Gallery-wrapped canvas with your custom artwork. Ready to hang with a modern edge.', price: 999, category: 'Canvas', image: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?w=500', customizable: true, colors: [], sizes: ['8x10', '16x20', '24x36', '30x40'], stock: 60, rating: 4.9, reviewCount: 98, featured: true },
    { id: 'prod_7', sku: 'TFW-ST-1001', name: 'Custom Vinyl Stickers', description: 'Weather-resistant vinyl sticker pack with your designs. Perfect for laptops, bottles, and more.', price: 199, category: 'Stickers', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500', customizable: true, colors: [], sizes: ['3 Pack', '6 Pack', '12 Pack'], stock: 500, rating: 4.7, reviewCount: 421, featured: false },
    { id: 'prod_8', sku: 'TFW-TB-1001-WHT', name: 'Custom Tote Bag', description: 'Durable cotton canvas tote with custom print. Eco-friendly and stylish for everyday use.', price: 349, category: 'Tote Bags', image: 'https://images.unsplash.com/photo-1597633425046-08f5110420b5?w=500', customizable: true, colors: ['#ffffff', '#1a1a1a', '#c2b280'], sizes: ['Standard'], stock: 100, rating: 4.5, reviewCount: 143, featured: false },
    { id: 'prod_9', sku: 'TFW-TS-1002-AOP', name: 'All-Over Print Tee', description: 'Full sublimation print t-shirt. Your design wraps around the entire shirt for maximum impact.', price: 899, category: 'T-Shirts', image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500', customizable: true, colors: [], sizes: ['S', 'M', 'L', 'XL'], stock: 70, rating: 4.6, reviewCount: 87, featured: false },
    { id: 'prod_10', sku: 'TFW-HD-1002-ZIP', name: 'Custom Zip Hoodie', description: 'Full-zip hoodie with custom design. 300 GSM, perfect layering piece for any season.', price: 1499, category: 'Hoodies', image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500', customizable: true, colors: ['#1a1a1a', '#36454f', '#1b2a4a'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], stock: 55, rating: 4.8, reviewCount: 67, featured: false },
    { id: 'prod_11', sku: 'TFW-MG-1002-TRV', name: 'Travel Mug', description: 'Stainless steel insulated travel mug with custom print. Keeps drinks hot for 12 hours.', price: 649, category: 'Mugs', image: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500', customizable: true, colors: ['#ffffff', '#1a1a1a'], sizes: ['16oz', '20oz'], stock: 90, rating: 4.7, reviewCount: 134, featured: false },
    { id: 'prod_12', sku: 'TFW-CV-1002-FRM', name: 'Framed Art Print', description: 'Custom art in a sleek modern frame. Premium paper with vivid colour reproduction.', price: 1299, category: 'Canvas', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=500', customizable: true, colors: [], sizes: ['8x10', '11x14', '16x20'], stock: 45, rating: 4.9, reviewCount: 76, featured: true },
  ];
  for (const p of products) {
    await client.query(
      `INSERT INTO website_products (id, sku, name, description, price, category, image, images, customizable, colors, sizes, stock, rating, review_count, featured, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
      [p.id, p.sku, p.name, p.description, p.price, p.category, p.image, '[]', p.customizable, JSON.stringify(p.colors), JSON.stringify(p.sizes), p.stock, p.rating, p.reviewCount, p.featured]
    );
  }
  console.log(`Seeded ${products.length} products`);
}

/* ── User queries ── */
export interface DBUser {
  id: string; name: string; email: string; password: string | null;
  role: string; twoFactorSecret?: string; twoFactorEnabled: boolean;
  googleId?: string; avatar?: string; createdAt: string;
}

function rowToUser(row: any): DBUser {
  return {
    id: row.id, name: row.name, email: row.email, password: row.password,
    role: row.role, twoFactorSecret: row.two_factor_secret || undefined,
    twoFactorEnabled: row.two_factor_enabled, googleId: row.google_id || undefined,
    avatar: row.avatar || undefined, createdAt: row.created_at,
  };
}

export async function addUser(u: { id: string; name: string; email: string; password: string | null; role: string; twoFactorEnabled: boolean; googleId?: string; avatar?: string }) {
  await pool.query(
    `INSERT INTO website_users (id, name, email, password, role, two_factor_enabled, google_id, avatar, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [u.id, u.name, u.email, u.password, u.role, u.twoFactorEnabled, u.googleId || null, u.avatar || null]
  );
}

export async function findUserByEmail(email: string): Promise<DBUser | null> {
  const { rows } = await pool.query(`SELECT * FROM website_users WHERE email = $1`, [email]);
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<DBUser | null> {
  const { rows } = await pool.query(`SELECT * FROM website_users WHERE id = $1`, [id]);
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function findUserByGoogleId(googleId: string): Promise<DBUser | null> {
  const { rows } = await pool.query(`SELECT * FROM website_users WHERE google_id = $1`, [googleId]);
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function updateUser(id: string, patch: Record<string, any>): Promise<DBUser | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', password: 'password', twoFactorSecret: 'two_factor_secret',
    twoFactorEnabled: 'two_factor_enabled', avatar: 'avatar', googleId: 'google_id',
  };
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col} = $${idx}`); vals.push(patch[key] ?? null); idx++; }
  }
  if (sets.length === 0) return findUserById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToUser(rows[0]) : null;
}

/* ── Product queries ── */
export interface DBProduct {
  id: string; name: string; description: string; price: number;
  category: string; categoryId?: string; mockupId?: string;
  image: string; images: string[]; customizable: boolean; colors: string[];
  sizes: string[]; stock: number; rating: number; reviewCount: number;
  featured: boolean; createdAt: string;
  weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number;
  mockup?: { id: string; frontImage: string; backImage?: string; frontShadow?: string; backShadow?: string; printArea: any };
}

function rowToProduct(row: any): DBProduct {
  const product: DBProduct = {
    id: row.id, name: row.name, description: row.description,
    price: parseFloat(row.price), category: row.category,
    categoryId: row.category_id || undefined,
    mockupId: row.mockup_id || undefined,
    image: row.image,
    images: row.images || [], customizable: row.customizable,
    colors: row.colors || [], sizes: row.sizes || [],
    stock: row.stock, rating: parseFloat(row.rating), reviewCount: row.review_count,
    featured: row.featured, createdAt: row.created_at,
    weightGrams: row.weight_grams || 200, lengthCm: row.length_cm || 30,
    breadthCm: row.breadth_cm || 20, heightCm: row.height_cm || 5,
  };
  // Attach mockup data if joined
  if (row.m_id) {
    product.mockup = {
      id: row.m_id, frontImage: row.m_front_image,
      backImage: row.m_back_image || undefined,
      frontShadow: row.m_front_shadow || undefined,
      backShadow: row.m_back_shadow || undefined,
      printArea: row.m_print_area || {},
    };
  }
  return product;
}

export async function getProducts(opts?: { category?: string; search?: string; featured?: boolean; sort?: string; minPrice?: number; maxPrice?: number }): Promise<DBProduct[]> {
  let where = ''; const params: any[] = []; let idx = 1;
  const conditions: string[] = [];
  if (opts?.category && opts.category !== 'all') { conditions.push(`p.category = $${idx}`); params.push(opts.category); idx++; }
  if (opts?.search) { conditions.push(`(LOWER(p.name) LIKE $${idx} OR LOWER(p.description) LIKE $${idx})`); params.push(`%${opts.search.toLowerCase()}%`); idx++; }
  if (opts?.featured) { conditions.push(`p.featured = true`); }
  if (opts?.minPrice !== undefined && !isNaN(opts.minPrice)) { conditions.push(`p.price >= $${idx}`); params.push(opts.minPrice); idx++; }
  if (opts?.maxPrice !== undefined && !isNaN(opts.maxPrice)) { conditions.push(`p.price <= $${idx}`); params.push(opts.maxPrice); idx++; }
  if (conditions.length) where = 'WHERE ' + conditions.join(' AND ');

  let orderBy = 'ORDER BY p.created_at DESC';
  if (opts?.sort === 'price-asc') orderBy = 'ORDER BY p.price ASC';
  else if (opts?.sort === 'price-desc') orderBy = 'ORDER BY p.price DESC';
  else if (opts?.sort === 'rating') orderBy = 'ORDER BY p.rating DESC';

  const { rows } = await pool.query(
    `SELECT p.*, m.id AS m_id, m.front_image AS m_front_image, m.back_image AS m_back_image,
            m.front_shadow AS m_front_shadow, m.back_shadow AS m_back_shadow, m.print_area AS m_print_area
     FROM website_products p
     LEFT JOIN website_mockups m ON m.id = p.mockup_id
     ${where} ${orderBy}`, params);
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<DBProduct | null> {
  const { rows } = await pool.query(
    `SELECT p.*, m.id AS m_id, m.front_image AS m_front_image, m.back_image AS m_back_image,
            m.front_shadow AS m_front_shadow, m.back_shadow AS m_back_shadow, m.print_area AS m_print_area
     FROM website_products p
     LEFT JOIN website_mockups m ON m.id = p.mockup_id
     WHERE p.id = $1`, [id]);
  return rows.length ? rowToProduct(rows[0]) : null;
}

/* ── Category queries ── */
export interface DBCategory {
  id: string; name: string; slug: string; createdAt: string;
}

function rowToCategory(row: any): DBCategory {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

export async function getCategories(): Promise<DBCategory[]> {
  const { rows } = await pool.query(`SELECT * FROM website_categories ORDER BY name`);
  return rows.map(rowToCategory);
}

export async function getCategoryById(id: string): Promise<DBCategory | null> {
  const { rows } = await pool.query(`SELECT * FROM website_categories WHERE id = $1`, [id]);
  return rows.length ? rowToCategory(rows[0]) : null;
}

export async function addCategory(c: { id: string; name: string; slug: string }): Promise<DBCategory> {
  const { rows } = await pool.query(
    `INSERT INTO website_categories (id, name, slug, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
    [c.id, c.name, c.slug]
  );
  return rowToCategory(rows[0]);
}

export async function updateCategory(id: string, patch: { name?: string; slug?: string }): Promise<DBCategory | null> {
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (patch.name !== undefined) { sets.push(`name = $${idx}`); vals.push(patch.name); idx++; }
  if (patch.slug !== undefined) { sets.push(`slug = $${idx}`); vals.push(patch.slug); idx++; }
  if (sets.length === 0) return getCategoryById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_categories SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToCategory(rows[0]) : null;
}

export async function deleteCategory(id: string) {
  await pool.query(`DELETE FROM website_categories WHERE id = $1`, [id]);
}

/* ── Mockup Category queries ── */
export interface DBMockupCategory {
  id: string; name: string; slug: string; createdAt: string;
}

function rowToMockupCategory(row: any): DBMockupCategory {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

export async function getMockupCategories(): Promise<DBMockupCategory[]> {
  const { rows } = await pool.query(`SELECT * FROM website_mockup_categories ORDER BY name`);
  return rows.map(rowToMockupCategory);
}

export async function getMockupCategoryById(id: string): Promise<DBMockupCategory | null> {
  const { rows } = await pool.query(`SELECT * FROM website_mockup_categories WHERE id = $1`, [id]);
  return rows.length ? rowToMockupCategory(rows[0]) : null;
}

export async function addMockupCategory(c: { id: string; name: string; slug: string }): Promise<DBMockupCategory> {
  const { rows } = await pool.query(
    `INSERT INTO website_mockup_categories (id, name, slug, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
    [c.id, c.name, c.slug]
  );
  return rowToMockupCategory(rows[0]);
}

export async function updateMockupCategory(id: string, patch: { name?: string; slug?: string }): Promise<DBMockupCategory | null> {
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (patch.name !== undefined) { sets.push(`name = $${idx}`); vals.push(patch.name); idx++; }
  if (patch.slug !== undefined) { sets.push(`slug = $${idx}`); vals.push(patch.slug); idx++; }
  if (sets.length === 0) return getMockupCategoryById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_mockup_categories SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToMockupCategory(rows[0]) : null;
}

export async function deleteMockupCategory(id: string) {
  await pool.query(`DELETE FROM website_mockup_categories WHERE id = $1`, [id]);
}

export async function addProduct(p: any): Promise<DBProduct> {
  const { rows } = await pool.query(
    `INSERT INTO website_products (id, name, description, price, category, category_id, mockup_id, image, images, customizable, colors, sizes, stock, rating, review_count, featured, weight_grams, length_cm, breadth_cm, height_cm, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW()) RETURNING *`,
    [p.id, p.name, p.description || '', p.price, p.category, p.categoryId || null, p.mockupId || null, p.image || '', JSON.stringify(p.images || []), p.customizable ?? true, JSON.stringify(p.colors || []), JSON.stringify(p.sizes || []), p.stock ?? 100, p.rating || 0, p.reviewCount || 0, p.featured ?? false, p.weightGrams ?? 200, p.lengthCm ?? 30, p.breadthCm ?? 20, p.heightCm ?? 5]
  );
  return rowToProduct(rows[0]);
}

export async function updateProduct(id: string, patch: Record<string, any>): Promise<DBProduct | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', description: 'description', price: 'price', category: 'category',
    categoryId: 'category_id', mockupId: 'mockup_id',
    image: 'image', customizable: 'customizable', stock: 'stock',
    rating: 'rating', reviewCount: 'review_count', featured: 'featured',
    weightGrams: 'weight_grams', lengthCm: 'length_cm', breadthCm: 'breadth_cm', heightCm: 'height_cm',
  };
  const jsonFields = ['images', 'colors', 'sizes'];
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col} = $${idx}`); vals.push(patch[key]); idx++; }
  }
  for (const key of jsonFields) {
    if (key in patch) { sets.push(`${key} = $${idx}`); vals.push(JSON.stringify(patch[key])); idx++; }
  }
  if (sets.length === 0) return getProductById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToProduct(rows[0]) : null;
}

export async function deleteProduct(id: string) {
  await pool.query(`DELETE FROM website_products WHERE id = $1`, [id]);
}

/* ── Shipping Zone queries ── */
export interface DBShippingZone {
  id: string; name: string; label: string;
  pinPatterns: string[];
  shippingCharge: number; freeAbove: number;
  sortOrder: number; active: boolean; createdAt: string;
}

function rowToShippingZone(row: any): DBShippingZone {
  return {
    id: row.id, name: row.name, label: row.label,
    pinPatterns: row.pin_patterns || [],
    shippingCharge: parseFloat(row.shipping_charge),
    freeAbove: parseFloat(row.free_above),
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getShippingZones(): Promise<DBShippingZone[]> {
  const { rows } = await pool.query(`SELECT * FROM website_shipping_zones ORDER BY sort_order ASC`);
  return rows.map(rowToShippingZone);
}

export async function addShippingZone(z: Omit<DBShippingZone, 'createdAt'>): Promise<DBShippingZone> {
  const { rows } = await pool.query(
    `INSERT INTO website_shipping_zones (id, name, label, pin_patterns, shipping_charge, free_above, sort_order, active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
    [z.id, z.name, z.label, JSON.stringify(z.pinPatterns), z.shippingCharge, z.freeAbove, z.sortOrder, z.active]
  );
  return rowToShippingZone(rows[0]);
}

export async function updateShippingZone(id: string, patch: Partial<Omit<DBShippingZone, 'id' | 'createdAt'>>): Promise<DBShippingZone | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', label: 'label', shippingCharge: 'shipping_charge',
    freeAbove: 'free_above', sortOrder: 'sort_order', active: 'active',
  };
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col} = $${idx}`); vals.push((patch as any)[key]); idx++; }
  }
  if ('pinPatterns' in patch) { sets.push(`pin_patterns = $${idx}`); vals.push(JSON.stringify(patch.pinPatterns)); idx++; }
  if (sets.length === 0) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE website_shipping_zones SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals
  );
  return rows.length ? rowToShippingZone(rows[0]) : null;
}

export async function deleteShippingZone(id: string) {
  await pool.query(`DELETE FROM website_shipping_zones WHERE id = $1`, [id]);
}

/* ── Order queries ── */
export interface DBOrder {
  id: string; userId: string; items: any[]; total: number; status: string;
  shippingAddress: string; createdAt: string;
  razorpayOrderId?: string; paymentId?: string; paymentStatus: string;
  couponCode?: string; discountAmount: number;
  groupOrderId?: string;
  customerName?: string; customerEmail?: string;
  shipment?: DBShipment;
}

function rowToOrder(row: any): DBOrder {
  return {
    id: row.id, userId: row.user_id, items: row.items || [],
    total: parseFloat(row.total), status: row.status,
    shippingAddress: row.shipping_address, createdAt: row.created_at,
    razorpayOrderId: row.razorpay_order_id || undefined,
    paymentId: row.payment_id || undefined,
    paymentStatus: row.payment_status || 'pending',
    couponCode: row.coupon_code || undefined,
    discountAmount: parseFloat(row.discount_amount || '0'),
    groupOrderId: row.group_order_id || undefined,
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    shipment: row.ship_id ? {
      id: row.ship_id, orderId: row.id,
      shiprocketOrderId: row.ship_sr_order_id || undefined,
      shiprocketShipmentId: row.ship_sr_shipment_id || undefined,
      awbCode: row.ship_awb || undefined,
      courierName: row.ship_courier || undefined,
      status: row.ship_status || 'pending',
      trackingData: row.ship_tracking || {},
      createdAt: row.ship_created_at,
    } : undefined,
  };
}

export async function addOrder(o: {
  id: string; userId: string; items: any[]; total: number; status: string;
  shippingAddress: string; razorpayOrderId?: string; paymentId?: string;
  paymentStatus?: string; couponCode?: string; discountAmount?: number;
  groupOrderId?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO website_orders (id, user_id, items, total, status, shipping_address, razorpay_order_id, payment_id, payment_status, coupon_code, discount_amount, group_order_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *`,
    [o.id, o.userId, JSON.stringify(o.items), o.total, o.status, o.shippingAddress,
     o.razorpayOrderId || null, o.paymentId || null, o.paymentStatus || 'paid',
     o.couponCode || null, o.discountAmount || 0, o.groupOrderId || null]
  );
  return rowToOrder(rows[0]);
}

export async function getOrdersByUser(userId: string): Promise<DBOrder[]> {
  const { rows } = await pool.query(
    `SELECT o.*,
            s.id AS ship_id, s.shiprocket_order_id AS ship_sr_order_id,
            s.shiprocket_shipment_id AS ship_sr_shipment_id,
            s.awb_code AS ship_awb, s.courier_name AS ship_courier,
            s.status AS ship_status, s.tracking_data AS ship_tracking,
            s.created_at AS ship_created_at
     FROM website_orders o
     LEFT JOIN website_shipments s ON s.order_id = o.id
     WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [userId]);
  return rows.map(rowToOrder);
}

export async function getAllOrders(): Promise<DBOrder[]> {
  const { rows } = await pool.query(
    `SELECT o.*, u.name as customer_name, u.email as customer_email,
            s.id AS ship_id, s.shiprocket_order_id AS ship_sr_order_id,
            s.shiprocket_shipment_id AS ship_sr_shipment_id,
            s.awb_code AS ship_awb, s.courier_name AS ship_courier,
            s.status AS ship_status, s.tracking_data AS ship_tracking,
            s.created_at AS ship_created_at
     FROM website_orders o
     LEFT JOIN website_users u ON o.user_id = u.id
     LEFT JOIN website_shipments s ON s.order_id = o.id
     ORDER BY o.created_at DESC`
  );
  return rows.map(rowToOrder);
}

export async function getOrderById(id: string): Promise<DBOrder | null> {
  const { rows } = await pool.query(
    `SELECT o.*, u.name as customer_name, u.email as customer_email,
            s.id AS ship_id, s.shiprocket_order_id AS ship_sr_order_id,
            s.shiprocket_shipment_id AS ship_sr_shipment_id,
            s.awb_code AS ship_awb, s.courier_name AS ship_courier,
            s.status AS ship_status, s.tracking_data AS ship_tracking,
            s.created_at AS ship_created_at
     FROM website_orders o
     LEFT JOIN website_users u ON o.user_id = u.id
     LEFT JOIN website_shipments s ON s.order_id = o.id
     WHERE o.id = $1`,
    [id]
  );
  return rows.length ? rowToOrder(rows[0]) : null;
}

export async function updateOrder(id: string, patch: { status?: string }): Promise<DBOrder | null> {
  if (!patch.status) return null;
  const { rows } = await pool.query(`UPDATE website_orders SET status = $1 WHERE id = $2 RETURNING *`, [patch.status, id]);
  return rows.length ? rowToOrder(rows[0]) : null;
}

export async function getOrdersByGroupId(groupOrderId: string): Promise<DBOrder[]> {
  const { rows } = await pool.query(
    `SELECT o.*, u.name as customer_name, u.email as customer_email
     FROM website_orders o
     LEFT JOIN website_users u ON o.user_id = u.id
     WHERE o.group_order_id = $1`,
    [groupOrderId]
  );
  return rows.map(rowToOrder);
}

/* ── Coupon queries ── */
export interface DBCoupon {
  id: string; code: string; description: string;
  discountType: 'percentage' | 'fixed'; discountValue: number;
  minOrderAmount: number; maxUses: number | null; useCount: number;
  validFrom: string | null; validUntil: string | null;
  active: boolean; popupEnabled: boolean; popupMessage: string; createdAt: string;
}

function rowToCoupon(r: any): DBCoupon {
  return {
    id: r.id, code: r.code, description: r.description,
    discountType: r.discount_type, discountValue: parseFloat(r.discount_value),
    minOrderAmount: parseFloat(r.min_order_amount),
    maxUses: r.max_uses ? parseInt(r.max_uses) : null,
    useCount: parseInt(r.use_count), validFrom: r.valid_from || null,
    validUntil: r.valid_until || null, active: r.active,
    popupEnabled: !!r.popup_enabled, popupMessage: r.popup_message || '',
    createdAt: r.created_at,
  };
}

export async function getCoupons(): Promise<DBCoupon[]> {
  const { rows } = await pool.query(`SELECT * FROM website_coupons ORDER BY created_at DESC`);
  return rows.map(rowToCoupon);
}

export async function getCouponByCode(code: string): Promise<DBCoupon | null> {
  const { rows } = await pool.query(`SELECT * FROM website_coupons WHERE UPPER(code) = UPPER($1)`, [code]);
  return rows.length ? rowToCoupon(rows[0]) : null;
}

export async function addCoupon(c: {
  id: string; code: string; description: string;
  discountType: string; discountValue: number;
  minOrderAmount: number; maxUses?: number | null;
  validFrom?: string | null; validUntil?: string | null;
  popupEnabled?: boolean; popupMessage?: string;
}): Promise<DBCoupon> {
  const { rows } = await pool.query(
    `INSERT INTO website_coupons (id, code, description, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, active, popup_enabled, popup_message, created_at)
     VALUES ($1, UPPER($2), $3, $4, $5, $6, $7, $8, $9, true, $10, $11, NOW()) RETURNING *`,
    [c.id, c.code, c.description, c.discountType, c.discountValue, c.minOrderAmount,
     c.maxUses || null, c.validFrom || null, c.validUntil || null,
     c.popupEnabled ?? false, c.popupMessage ?? '']
  );
  return rowToCoupon(rows[0]);
}

export async function updateCoupon(id: string, patch: Partial<Omit<DBCoupon, 'id' | 'createdAt' | 'useCount'>>): Promise<DBCoupon | null> {
  const fieldMap: Record<string, string> = {
    code: 'code', description: 'description', discountType: 'discount_type',
    discountValue: 'discount_value', minOrderAmount: 'min_order_amount',
    maxUses: 'max_uses', validFrom: 'valid_from', validUntil: 'valid_until',
    active: 'active', popupEnabled: 'popup_enabled', popupMessage: 'popup_message',
  };
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) {
      const val = (patch as any)[key];
      sets.push(key === 'code' ? `${col} = UPPER($${idx})` : `${col} = $${idx}`);
      vals.push(val ?? null); idx++;
    }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_coupons SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToCoupon(rows[0]) : null;
}

export async function deleteCoupon(id: string) {
  await pool.query(`DELETE FROM website_coupons WHERE id = $1`, [id]);
}

export async function incrementCouponUseCount(code: string) {
  await pool.query(`UPDATE website_coupons SET use_count = use_count + 1 WHERE UPPER(code) = UPPER($1)`, [code]);
}

export async function getActivePopupCoupon(): Promise<DBCoupon | null> {
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `SELECT * FROM website_coupons
     WHERE popup_enabled = true AND active = true
       AND (valid_from IS NULL OR valid_from <= $1)
       AND (valid_until IS NULL OR valid_until >= $1)
       AND (max_uses IS NULL OR use_count < max_uses)
     ORDER BY created_at DESC LIMIT 1`,
    [now]
  );
  return rows.length ? rowToCoupon(rows[0]) : null;
}

export async function getActiveCoupons(): Promise<DBCoupon[]> {
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `SELECT * FROM website_coupons
     WHERE active = true AND popup_enabled = true
       AND (valid_from IS NULL OR valid_from <= $1)
       AND (valid_until IS NULL OR valid_until >= $1)
       AND (max_uses IS NULL OR use_count < max_uses)
     ORDER BY created_at DESC`,
    [now]
  );
  return rows.map(rowToCoupon);
}

/* ── Shipment queries ── */
export interface DBShipment {
  id: string; orderId: string;
  shiprocketOrderId?: string; shiprocketShipmentId?: string;
  awbCode?: string; courierName?: string; courierId?: number;
  status: string; trackingData: any; createdAt: string;
}

function rowToShipment(r: any): DBShipment {
  return {
    id: r.id, orderId: r.order_id,
    shiprocketOrderId: r.shiprocket_order_id || undefined,
    shiprocketShipmentId: r.shiprocket_shipment_id || undefined,
    awbCode: r.awb_code || undefined, courierName: r.courier_name || undefined,
    courierId: r.courier_id || undefined, status: r.status,
    trackingData: r.tracking_data || {}, createdAt: r.created_at,
  };
}

export async function getShipmentByOrderId(orderId: string): Promise<DBShipment | null> {
  const { rows } = await pool.query(`SELECT * FROM website_shipments WHERE order_id = $1`, [orderId]);
  return rows.length ? rowToShipment(rows[0]) : null;
}

export async function addShipment(s: {
  id: string; orderId: string; shiprocketOrderId?: string;
  shiprocketShipmentId?: string; awbCode?: string;
  courierName?: string; courierId?: number; status?: string;
}): Promise<DBShipment> {
  const { rows } = await pool.query(
    `INSERT INTO website_shipments (id, order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, courier_name, courier_id, status, tracking_data, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}',NOW(),NOW()) RETURNING *`,
    [s.id, s.orderId, s.shiprocketOrderId || null, s.shiprocketShipmentId || null,
     s.awbCode || null, s.courierName || null, s.courierId || null, s.status || 'processing']
  );
  return rowToShipment(rows[0]);
}

export async function deleteShipment(id: string): Promise<void> {
  await pool.query(`DELETE FROM website_shipments WHERE id = $1`, [id]);
}

export async function updateShipment(id: string, patch: {
  awbCode?: string; courierName?: string; courierId?: number;
  status?: string; trackingData?: any; shiprocketShipmentId?: string;
}): Promise<DBShipment | null> {
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (patch.awbCode !== undefined) { sets.push(`awb_code = $${idx}`); vals.push(patch.awbCode); idx++; }
  if (patch.courierName !== undefined) { sets.push(`courier_name = $${idx}`); vals.push(patch.courierName); idx++; }
  if (patch.courierId !== undefined) { sets.push(`courier_id = $${idx}`); vals.push(patch.courierId); idx++; }
  if (patch.status !== undefined) { sets.push(`status = $${idx}`); vals.push(patch.status); idx++; }
  if (patch.trackingData !== undefined) { sets.push(`tracking_data = $${idx}`); vals.push(JSON.stringify(patch.trackingData)); idx++; }
  if (patch.shiprocketShipmentId !== undefined) { sets.push(`shiprocket_shipment_id = $${idx}`); vals.push(patch.shiprocketShipmentId); idx++; }
  if (!sets.length) return null;
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_shipments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToShipment(rows[0]) : null;
}

/* ── Mockup queries ── */
export interface DBMockup {
  id: string; name: string; category: string;
  frontImage: string; backImage?: string;
  frontShadow?: string; backShadow?: string;
  printArea: any; basePrice: number; active: boolean; createdAt: string;
}

function rowToMockup(row: any): DBMockup {
  return {
    id: row.id, name: row.name, category: row.category,
    frontImage: row.front_image, backImage: row.back_image || undefined,
    frontShadow: row.front_shadow || undefined, backShadow: row.back_shadow || undefined,
    printArea: row.print_area || {}, basePrice: parseFloat(row.base_price || '0'),
    active: row.active, createdAt: row.created_at,
  };
}

export async function getAllMockups(): Promise<DBMockup[]> {
  const { rows } = await pool.query(`SELECT * FROM website_mockups ORDER BY created_at DESC`);
  return rows.map(rowToMockup);
}

export async function addMockup(m: { id: string; name: string; category: string; frontImage: string; backImage?: string; frontShadow?: string; backShadow?: string; printArea?: any; basePrice?: number }): Promise<DBMockup> {
  const { rows } = await pool.query(
    `INSERT INTO website_mockups (id, name, category, front_image, back_image, front_shadow, back_shadow, print_area, base_price, active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW()) RETURNING *`,
    [m.id, m.name, m.category, m.frontImage, m.backImage || null, m.frontShadow || null, m.backShadow || null, JSON.stringify(m.printArea || {}), m.basePrice || 0]
  );
  return rowToMockup(rows[0]);
}

export async function updateMockup(id: string, patch: Record<string, any>): Promise<DBMockup | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', category: 'category', frontImage: 'front_image',
    backImage: 'back_image', frontShadow: 'front_shadow', backShadow: 'back_shadow',
    basePrice: 'base_price', active: 'active',
  };
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col} = $${idx}`); vals.push(patch[key] ?? null); idx++; }
  }
  if ('printArea' in patch) { sets.push(`print_area = $${idx}`); vals.push(JSON.stringify(patch.printArea)); idx++; }
  if (sets.length === 0) return null;
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_mockups SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToMockup(rows[0]) : null;
}

export async function deleteMockup(id: string) {
  await pool.query(`DELETE FROM website_mockups WHERE id = $1`, [id]);
}

/* ── Analytics queries ── */
export async function getAnalytics() {
  const [usersRes, productsRes, ordersRes, revenueRes, recentOrdersRes, topProductsRes, statusRes, dailyRevenueRes,
    designOrdersRes, designRevenueRes, designStatusRes, designDailyRes, recentDesignRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM website_users`),
    pool.query(`SELECT COUNT(*) as count FROM website_products`),
    pool.query(`SELECT COUNT(*) as count FROM website_orders`),
    pool.query(`SELECT COALESCE(SUM(total), 0) as total FROM website_orders WHERE status != 'cancelled'`),
    pool.query(`SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM website_orders o LEFT JOIN website_users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10`),
    pool.query(`
      SELECT p.name, COUNT(oi.product_id) as order_count, SUM(oi.quantity) as total_quantity
      FROM website_products p
      LEFT JOIN (
        SELECT (item->>'productId') as product_id, (item->>'quantity')::int as quantity
        FROM website_orders, jsonb_array_elements(items) as item
        WHERE status != 'cancelled'
      ) oi ON oi.product_id = p.id
      GROUP BY p.id, p.name
      ORDER BY total_quantity DESC NULLS LAST
      LIMIT 5
    `),
    pool.query(`SELECT status, COUNT(*) as count FROM website_orders GROUP BY status`),
    pool.query(`
      SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
      FROM website_orders WHERE status != 'cancelled' AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date
    `),
    // Design orders analytics
    pool.query(`SELECT COUNT(*) as count FROM website_design_orders`),
    pool.query(`SELECT COALESCE(SUM(total), 0) as total FROM website_design_orders WHERE status != 'cancelled'`),
    pool.query(`SELECT status, COUNT(*) as count FROM website_design_orders GROUP BY status`),
    pool.query(`
      SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
      FROM website_design_orders WHERE status != 'cancelled' AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date
    `),
    pool.query(`SELECT d.*, u.name AS customer_name, u.email AS customer_email FROM website_design_orders d LEFT JOIN website_users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 10`),
  ]);

  // Combine status counts from both order types
  const combinedStatus: Record<string, number> = {};
  for (const r of statusRes.rows) { combinedStatus[r.status] = (combinedStatus[r.status] || 0) + parseInt(r.count); }
  for (const r of designStatusRes.rows) { combinedStatus[r.status] = (combinedStatus[r.status] || 0) + parseInt(r.count); }

  // Combine daily revenue from both order types
  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  for (const r of dailyRevenueRes.rows) {
    const key = r.date;
    dailyMap[key] = { revenue: parseFloat(r.revenue), orders: parseInt(r.orders) };
  }
  for (const r of designDailyRes.rows) {
    const key = r.date;
    if (dailyMap[key]) { dailyMap[key].revenue += parseFloat(r.revenue); dailyMap[key].orders += parseInt(r.orders); }
    else { dailyMap[key] = { revenue: parseFloat(r.revenue), orders: parseInt(r.orders) }; }
  }
  const combinedDaily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }));

  // Combine recent orders (merge and sort by date, take top 10)
  const normalRecent = recentOrdersRes.rows.map((r: any) => ({ ...rowToOrder(r), orderType: 'normal' as const }));
  const designRecent = recentDesignRes.rows.map((r: any) => ({ ...rowToDesignOrder(r), orderType: 'custom' as const }));
  const allRecent = [...normalRecent, ...designRecent]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const normalCount = parseInt(ordersRes.rows[0].count);
  const designCount = parseInt(designOrdersRes.rows[0].count);
  const normalRevenue = parseFloat(revenueRes.rows[0].total);
  const designRevenue = parseFloat(designRevenueRes.rows[0].total);

  return {
    totalUsers: parseInt(usersRes.rows[0].count),
    totalProducts: parseInt(productsRes.rows[0].count),
    totalOrders: normalCount + designCount,
    normalOrders: normalCount,
    designOrders: designCount,
    totalRevenue: normalRevenue + designRevenue,
    normalRevenue,
    designRevenue,
    recentOrders: allRecent,
    topProducts: topProductsRes.rows.map(r => ({ name: r.name, orderCount: parseInt(r.order_count), totalQuantity: parseInt(r.total_quantity) || 0 })),
    ordersByStatus: combinedStatus,
    dailyRevenue: combinedDaily,
  };
}

/* ── Database viewer ── */
export async function getDbViewer() {
  const tables = ['website_users', 'website_products', 'website_orders', 'website_mockups', 'website_design_orders'];
  const result: Record<string, { count: number; columns: string[]; rows: any[] }> = {};
  for (const table of tables) {
    const countRes = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]
    );
    const rowsRes = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 50`);
    // Redact passwords
    const rows = rowsRes.rows.map(r => {
      const row = { ...r };
      if ('password' in row) row.password = '***';
      if ('two_factor_secret' in row) row.two_factor_secret = row.two_factor_secret ? '***' : null;
      return row;
    });
    result[table] = {
      count: parseInt(countRes.rows[0].count),
      columns: colRes.rows.map(r => r.column_name),
      rows,
    };
  }
  return result;
}

/* ── Design Order queries ── */
export interface DBDesignOrder {
  id: string; userId: string | null; productType: string;
  colorHex: string; colorName: string; printSize: string;
  sides: string[]; designImages: Record<string, string>;
  uploadedImages: Record<string, string[]>;
  quantity: number; unitPrice: number; total: number;
  status: string; shippingAddress: string; createdAt: string;
  groupOrderId?: string;
  customerName?: string; customerEmail?: string;
  shipment?: DBShipment;
}

function rowToDesignOrder(row: any): DBDesignOrder {
  return {
    id: row.id, userId: row.user_id, productType: row.product_type,
    colorHex: row.color_hex, colorName: row.color_name, printSize: row.print_size,
    sides: row.sides || [], designImages: row.design_images || {},
    uploadedImages: row.uploaded_images || {},
    quantity: row.quantity, unitPrice: parseFloat(row.unit_price),
    total: parseFloat(row.total), status: row.status,
    shippingAddress: row.shipping_address, createdAt: row.created_at,
    groupOrderId: row.group_order_id || undefined,
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    shipment: row.ship_id ? {
      id: row.ship_id, orderId: row.id,
      shiprocketOrderId: row.ship_sr_order_id || undefined,
      shiprocketShipmentId: row.ship_sr_shipment_id || undefined,
      awbCode: row.ship_awb || undefined,
      courierName: row.ship_courier || undefined,
      status: row.ship_status || 'pending',
      trackingData: row.ship_tracking || {},
      createdAt: row.ship_created_at,
    } : undefined,
  };
}

export async function addDesignOrder(o: {
  id: string; userId: string | null; productType: string;
  colorHex: string; colorName: string; printSize: string;
  sides: string[]; designImages: Record<string, string>;
  uploadedImages?: Record<string, string[]>;
  quantity: number; unitPrice: number; total: number;
  shippingAddress: string; groupOrderId?: string;
}): Promise<DBDesignOrder> {
  const { rows } = await pool.query(
    `INSERT INTO website_design_orders (id, user_id, product_type, color_hex, color_name, print_size, sides, design_images, uploaded_images, quantity, unit_price, total, status, shipping_address, group_order_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$14,NOW()) RETURNING *`,
    [o.id, o.userId, o.productType, o.colorHex, o.colorName, o.printSize,
     JSON.stringify(o.sides), JSON.stringify(o.designImages),
     JSON.stringify(o.uploadedImages || {}),
     o.quantity, o.unitPrice, o.total, o.shippingAddress, o.groupOrderId || null]
  );
  return rowToDesignOrder(rows[0]);
}

export async function getAllDesignOrders(): Promise<DBDesignOrder[]> {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS customer_name, u.email AS customer_email,
            s.id AS ship_id, s.shiprocket_order_id AS ship_sr_order_id,
            s.shiprocket_shipment_id AS ship_sr_shipment_id,
            s.awb_code AS ship_awb, s.courier_name AS ship_courier,
            s.status AS ship_status, s.tracking_data AS ship_tracking,
            s.created_at AS ship_created_at
     FROM website_design_orders d
     LEFT JOIN website_users u ON u.id = d.user_id
     LEFT JOIN website_shipments s ON s.order_id = d.id
     ORDER BY d.created_at DESC`
  );
  return rows.map(rowToDesignOrder);
}

export async function getDesignOrdersByUser(userId: string): Promise<DBDesignOrder[]> {
  const { rows } = await pool.query(`SELECT * FROM website_design_orders WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return rows.map(rowToDesignOrder);
}

export async function getDesignOrderById(id: string): Promise<DBDesignOrder | null> {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS customer_name, u.email AS customer_email
     FROM website_design_orders d
     LEFT JOIN website_users u ON u.id = d.user_id
     WHERE d.id = $1`,
    [id]
  );
  return rows.length ? rowToDesignOrder(rows[0]) : null;
}

export async function updateDesignOrder(id: string, patch: { status?: string; shippingAddress?: string }): Promise<DBDesignOrder | null> {
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (patch.status) { sets.push(`status = $${idx}`); vals.push(patch.status); idx++; }
  if (patch.shippingAddress) { sets.push(`shipping_address = $${idx}`); vals.push(patch.shippingAddress); idx++; }
  if (sets.length === 0) return getDesignOrderById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_design_orders SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToDesignOrder(rows[0]) : null;
}

/* ── Saved Designs ── */
export interface DBSavedDesign {
  id: string; userId: string; name: string; productType: string;
  colorHex: string; colorName: string; printSize: string;
  canvasData: object; thumbnail: string; createdAt: string; updatedAt: string;
}

function rowToSavedDesign(row: any): DBSavedDesign {
  return {
    id: row.id, userId: row.user_id, name: row.name, productType: row.product_type,
    colorHex: row.color_hex, colorName: row.color_name, printSize: row.print_size,
    canvasData: row.canvas_data, thumbnail: row.thumbnail,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getSavedDesignsByUser(userId: string): Promise<DBSavedDesign[]> {
  const { rows } = await pool.query(`SELECT * FROM website_saved_designs WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map(rowToSavedDesign);
}

export async function addSavedDesign(d: {
  id: string; userId: string; name: string; productType: string;
  colorHex: string; colorName: string; printSize: string;
  canvasData: object; thumbnail: string;
}): Promise<DBSavedDesign> {
  const { rows } = await pool.query(
    `INSERT INTO website_saved_designs (id, user_id, name, product_type, color_hex, color_name, print_size, canvas_data, thumbnail, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
    [d.id, d.userId, d.name, d.productType, d.colorHex, d.colorName, d.printSize, JSON.stringify(d.canvasData), d.thumbnail]
  );
  return rowToSavedDesign(rows[0]);
}

export async function deleteSavedDesign(id: string, userId: string): Promise<void> {
  await pool.query(`DELETE FROM website_saved_designs WHERE id = $1 AND user_id = $2`, [id, userId]);
}

/* ── Invoice helper (generates order data for PDF) ── */
export async function getOrderForInvoice(orderId: string): Promise<any> {
  const { rows } = await pool.query(`SELECT * FROM website_orders WHERE id = $1`, [orderId]);
  if (!rows.length) return null;
  const order = rows[0];
  const orderItems = order.items || [];
  const productIds = orderItems.map((i: any) => i.productId).filter(Boolean);
  let products: Record<string, DBProduct> = {};
  if (productIds.length) {
    const { rows: pRows } = await pool.query(`SELECT * FROM website_products WHERE id = ANY($1)`, [productIds]);
    products = Object.fromEntries(pRows.map((r: any) => [r.id, rowToProduct(r)]));
  }
  return {
    orderId: order.id,
    date: order.created_at,
    status: order.status,
    subtotal: parseFloat(order.total) + parseFloat(order.discount_amount || '0'),
    discountAmount: parseFloat(order.discount_amount || '0'),
    couponCode: order.coupon_code || null,
    total: parseFloat(order.total),
    shippingAddress: order.shipping_address,
    items: orderItems.map((i: any) => ({
      name: products[i.productId]?.name || 'Custom Item',
      quantity: i.quantity,
      price: i.price,
      color: i.color,
      size: i.size,
    })),
  };
}

/* ── Corporate Inquiries ── */
export interface DBCorporateInquiry {
  id: string; companyName: string; contactName: string; email: string;
  phone: string; productInterest: string; quantity: number;
  message: string; status: string; adminNotes: string; createdAt: string;
}

function rowToInquiry(r: any): DBCorporateInquiry {
  return { id: r.id, companyName: r.company_name, contactName: r.contact_name, email: r.email,
    phone: r.phone, productInterest: r.product_interest, quantity: r.quantity,
    message: r.message, status: r.status, adminNotes: r.admin_notes, createdAt: r.created_at };
}

export async function getCorporateInquiries(): Promise<DBCorporateInquiry[]> {
  const { rows } = await pool.query(`SELECT * FROM website_corporate_inquiries ORDER BY created_at DESC`);
  return rows.map(rowToInquiry);
}

export async function addCorporateInquiry(data: Omit<DBCorporateInquiry, 'id' | 'status' | 'adminNotes' | 'createdAt'>): Promise<DBCorporateInquiry> {
  const id = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { rows } = await pool.query(
    `INSERT INTO website_corporate_inquiries (id, company_name, contact_name, email, phone, product_interest, quantity, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, data.companyName, data.contactName, data.email, data.phone, data.productInterest, data.quantity, data.message]
  );
  return rowToInquiry(rows[0]);
}

export async function updateInquiryStatus(id: string, status: string, adminNotes: string): Promise<DBCorporateInquiry | null> {
  const { rows } = await pool.query(
    `UPDATE website_corporate_inquiries SET status = $1, admin_notes = $2 WHERE id = $3 RETURNING *`,
    [status, adminNotes, id]
  );
  return rows.length ? rowToInquiry(rows[0]) : null;
}
