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
      ALTER TABLE website_shipping_zones ADD COLUMN IF NOT EXISTS weight_from_grams INT NOT NULL DEFAULT 0;
      ALTER TABLE website_shipping_zones ADD COLUMN IF NOT EXISTS weight_to_grams INT NOT NULL DEFAULT 99999;
      ALTER TABLE website_shipping_zones ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'standard';
      ALTER TABLE website_shipping_zones ADD COLUMN IF NOT EXISTS estimated_days TEXT NOT NULL DEFAULT '5-7 days';
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

    // Collections
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT NOT NULL DEFAULT '',
        tag TEXT NOT NULL DEFAULT 'Custom',
        gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)',
        glow TEXT NOT NULL DEFAULT '#0E7C61',
        shimmer TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.15)',
        symbol TEXT NOT NULL DEFAULT '✨',
        badge TEXT NOT NULL DEFAULT 'New',
        badge_color TEXT NOT NULL DEFAULT '#C6A75E',
        featured BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS website_collection_products (
        collection_id TEXT NOT NULL REFERENCES website_collections(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES website_products(id) ON DELETE CASCADE,
        sort_order INT NOT NULL DEFAULT 0,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection_id, product_id)
      );
    `);

    // Collections cover image migration
    await client.query(`
      ALTER TABLE website_collections ADD COLUMN IF NOT EXISTS cover_image TEXT NOT NULL DEFAULT '';
    `);

    // Phone-based OTP auth migrations
    await client.query(`
      ALTER TABLE website_users ALTER COLUMN email DROP NOT NULL;
      ALTER TABLE website_users ADD COLUMN IF NOT EXISTS phone TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON website_users(phone) WHERE phone IS NOT NULL;

      CREATE TABLE IF NOT EXISTS website_otp_sessions (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        otp TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Inventory management columns on products
    await client.query(`
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 10;
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';
    `);

    // Inventory audit log
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_inventory_logs (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES website_products(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        change_type TEXT NOT NULL DEFAULT 'adjustment',
        quantity_before INT NOT NULL,
        quantity_change INT NOT NULL,
        quantity_after INT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON website_inventory_logs(product_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inv_logs_created ON website_inventory_logs(created_at DESC);
    `);

    // Leads CRM
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        mobile TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT NOT NULL DEFAULT 'organic',
        products_viewed JSONB NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leads_status ON website_leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_created ON website_leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON website_leads(email) WHERE email != '';
      CREATE INDEX IF NOT EXISTS idx_leads_mobile ON website_leads(mobile) WHERE mobile != '';
    `);

    // Site-wide settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO website_settings (key, value) VALUES ('upload_enabled', 'true')
      ON CONFLICT (key) DO NOTHING;
    `);

    // ── Back-In-Stock notification requests ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_back_in_stock (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES website_products(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        mobile TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        notified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_bis_product ON website_back_in_stock(product_id, status);
      CREATE INDEX IF NOT EXISTS idx_bis_status ON website_back_in_stock(status);
      CREATE INDEX IF NOT EXISTS idx_bis_email ON website_back_in_stock(email) WHERE email != '';
      CREATE INDEX IF NOT EXISTS idx_bis_created ON website_back_in_stock(created_at DESC);
    `);

    // ── Courier Config (per-carrier settings) ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_courier_config (
        carrier TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT false,
        api_key TEXT NOT NULL DEFAULT '',
        api_secret TEXT NOT NULL DEFAULT '',
        api_url TEXT NOT NULL DEFAULT '',
        source_pincode TEXT NOT NULL DEFAULT '',
        volumetric_divisor NUMERIC(8,2) NOT NULL DEFAULT 5000,
        markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        markup_flat NUMERIC(10,2) NOT NULL DEFAULT 0,
        zone_rates JSONB NOT NULL DEFAULT '{}',
        credentials JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO website_courier_config (carrier, enabled, api_url, volumetric_divisor, zone_rates) VALUES
        ('shiprocket', false, 'https://apiv2.shiprocket.in/v1/external', 5000, '{}'),
        ('delhivery',  false, 'https://track.delhivery.com',             5000, '{"local":35,"regional":50,"national":80,"remote":120}'),
        ('bluedart',   false, 'https://api.bluedart.com',                5000, '{"local":60,"regional":80,"national":110,"remote":160}'),
        ('dtdc',       false, 'https://www.dtdc.in',                     5000, '{"local":40,"regional":60,"national":90,"remote":130}')
      ON CONFLICT (carrier) DO NOTHING;

      CREATE TABLE IF NOT EXISTS website_shipping_rate_cache (
        cache_key TEXT PRIMARY KEY,
        carrier TEXT NOT NULL,
        rates JSONB NOT NULL DEFAULT '[]',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rate_cache_exp ON website_shipping_rate_cache(expires_at);
    `);

    // ── Promotional Banners ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_banners (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL DEFAULT '',
        badge_text TEXT NOT NULL DEFAULT '',
        badge_type TEXT NOT NULL DEFAULT 'featured',
        image_url TEXT NOT NULL DEFAULT '',
        cta_label TEXT NOT NULL DEFAULT 'Shop Now',
        cta_url TEXT NOT NULL DEFAULT '/products',
        cta_label_2 TEXT NOT NULL DEFAULT '',
        cta_url_2 TEXT NOT NULL DEFAULT '',
        bg_gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)',
        accent_color TEXT NOT NULL DEFAULT '#C6A75E',
        text_color TEXT NOT NULL DEFAULT '#ffffff',
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_banners_active ON website_banners(active, sort_order);
    `);

    // ── Brands & Device Models (Category → Brand → Model → Design Studio) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo TEXT NOT NULL DEFAULT '',
        category_id TEXT REFERENCES website_categories(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_slug ON website_brands(slug);
      CREATE INDEX IF NOT EXISTS idx_brands_category ON website_brands(category_id, active, sort_order);

      CREATE TABLE IF NOT EXISTS website_device_models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        brand_id TEXT NOT NULL REFERENCES website_brands(id) ON DELETE CASCADE,
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(brand_id, slug)
      );
      CREATE INDEX IF NOT EXISTS idx_models_brand ON website_device_models(brand_id, active, sort_order);
    `);

    // Add brand_id and model_id to products
    await client.query(`
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS brand_id TEXT REFERENCES website_brands(id) ON DELETE SET NULL;
      ALTER TABLE website_products ADD COLUMN IF NOT EXISTS model_id TEXT REFERENCES website_device_models(id) ON DELETE SET NULL;
    `);

    // ── Delivery Method (Store Pickup · Hyperlocal · Standard) ──────────────
    await client.query(`
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'standard';
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS delivery_config JSONB NOT NULL DEFAULT '{}';
      ALTER TABLE website_orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
      ALTER TABLE website_design_orders ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'standard';
      ALTER TABLE website_design_orders ADD COLUMN IF NOT EXISTS delivery_config JSONB NOT NULL DEFAULT '{}';
      ALTER TABLE website_design_orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS website_delivery_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO website_delivery_settings (key, value) VALUES
        ('store_pickup', '{"enabled":false,"storeName":"TheFramedWall","address":"","city":"","state":"","pincode":"","phone":"","hours":"Mon–Sat, 10am–8pm","landmark":"","readyInDays":1}'),
        ('hyperlocal',   '{"enabled":false,"flatFee":99,"maxRadiusKm":15,"dunzo":{"enabled":false,"clientId":"","apiKey":""},"porter":{"enabled":false,"apiKey":""}}'),
        ('standard',     '{"enabled":true}')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Analytics events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_product_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        category TEXT,
        brand_id TEXT,
        brand_name TEXT,
        size TEXT,
        color TEXT,
        session_id TEXT NOT NULL,
        user_id TEXT,
        price NUMERIC(10,2),
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pev_type_created ON website_product_events(event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_pev_product_created ON website_product_events(product_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_pev_session ON website_product_events(session_id);
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
  id: string; name: string; email: string | null; phone?: string; password: string | null;
  role: string; twoFactorSecret?: string; twoFactorEnabled: boolean;
  googleId?: string; avatar?: string; createdAt: string;
}

function rowToUser(row: any): DBUser {
  return {
    id: row.id, name: row.name, email: row.email ?? null, phone: row.phone || undefined,
    password: row.password, role: row.role,
    twoFactorSecret: row.two_factor_secret || undefined,
    twoFactorEnabled: row.two_factor_enabled, googleId: row.google_id || undefined,
    avatar: row.avatar || undefined, createdAt: row.created_at,
  };
}

export async function addUser(u: { id: string; name: string; email?: string | null; phone?: string | null; password: string | null; role: string; twoFactorEnabled: boolean; googleId?: string; avatar?: string }) {
  await pool.query(
    `INSERT INTO website_users (id, name, email, phone, password, role, two_factor_enabled, google_id, avatar, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [u.id, u.name, u.email ?? null, u.phone ?? null, u.password, u.role, u.twoFactorEnabled, u.googleId || null, u.avatar || null]
  );
}

export async function findUserByEmail(email: string): Promise<DBUser | null> {
  const { rows } = await pool.query(`SELECT * FROM website_users WHERE email = $1`, [email]);
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function findUserByPhone(phone: string): Promise<DBUser | null> {
  const { rows } = await pool.query(`SELECT * FROM website_users WHERE phone = $1`, [phone]);
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
    name: 'name', email: 'email', phone: 'phone', password: 'password',
    twoFactorSecret: 'two_factor_secret', twoFactorEnabled: 'two_factor_enabled',
    avatar: 'avatar', googleId: 'google_id',
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

/* ── OTP session queries ── */
export async function createOtpSession(id: string, phone: string, otp: string, expiresAt: Date) {
  await pool.query(
    `INSERT INTO website_otp_sessions (id, phone, otp, expires_at, created_at) VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (phone) DO UPDATE SET id=$1, otp=$3, expires_at=$4, verified=false, created_at=NOW()`,
    [id, phone, otp, expiresAt]
  );
}

export async function findOtpSession(sessionId: string): Promise<{ id: string; phone: string; otp: string; expiresAt: Date; verified: boolean } | null> {
  const { rows } = await pool.query(
    `SELECT * FROM website_otp_sessions WHERE id=$1 AND verified=false AND expires_at > NOW()`,
    [sessionId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, phone: r.phone, otp: r.otp, expiresAt: r.expires_at, verified: r.verified };
}

export async function markOtpVerified(sessionId: string) {
  await pool.query(`UPDATE website_otp_sessions SET verified=true WHERE id=$1`, [sessionId]);
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

export async function getProducts(opts?: { category?: string; search?: string; featured?: boolean; sort?: string; minPrice?: number; maxPrice?: number; brandSlug?: string; modelSlug?: string }): Promise<DBProduct[]> {
  let where = ''; const params: any[] = []; let idx = 1;
  const conditions: string[] = [];
  if (opts?.category && opts.category !== 'all') { conditions.push(`p.category = $${idx}`); params.push(opts.category); idx++; }
  if (opts?.search) {
    // Split into words for wildcard matching — each word must appear in name or description
    const words = opts.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const wordConditions = words.map(w => {
      const p = `%${w}%`;
      params.push(p); params.push(p); params.push(p);
      const i = idx; idx += 3;
      return `(LOWER(p.name) LIKE $${i} OR LOWER(p.description) LIKE $${i+1} OR LOWER(p.category) LIKE $${i+2})`;
    });
    if (wordConditions.length) conditions.push(`(${wordConditions.join(' AND ')})`);
  }
  if (opts?.featured) { conditions.push(`p.featured = true`); }
  if (opts?.minPrice !== undefined && !isNaN(opts.minPrice)) { conditions.push(`p.price >= $${idx}`); params.push(opts.minPrice); idx++; }
  if (opts?.maxPrice !== undefined && !isNaN(opts.maxPrice)) { conditions.push(`p.price <= $${idx}`); params.push(opts.maxPrice); idx++; }
  if (opts?.brandSlug) {
    conditions.push(`p.brand_id = (SELECT id FROM website_brands WHERE slug = $${idx} LIMIT 1)`);
    params.push(opts.brandSlug); idx++;
  }
  if (opts?.modelSlug) {
    conditions.push(`p.model_id = (SELECT id FROM website_device_models WHERE slug = $${idx} LIMIT 1)`);
    params.push(opts.modelSlug); idx++;
  }
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
  weightFromGrams: number;
  weightToGrams: number;
  deliveryType: string;
  estimatedDays: string;
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
    weightFromGrams: row.weight_from_grams ?? 0,
    weightToGrams: row.weight_to_grams ?? 99999,
    deliveryType: row.delivery_type || 'standard',
    estimatedDays: row.estimated_days || '5-7 days',
  };
}

export async function getShippingZones(): Promise<DBShippingZone[]> {
  const { rows } = await pool.query(`SELECT * FROM website_shipping_zones ORDER BY sort_order ASC`);
  return rows.map(rowToShippingZone);
}

export async function addShippingZone(z: Omit<DBShippingZone, 'createdAt'>): Promise<DBShippingZone> {
  const { rows } = await pool.query(
    `INSERT INTO website_shipping_zones
       (id, name, label, pin_patterns, shipping_charge, free_above, sort_order, active,
        weight_from_grams, weight_to_grams, delivery_type, estimated_days, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *`,
    [z.id, z.name, z.label, JSON.stringify(z.pinPatterns), z.shippingCharge, z.freeAbove, z.sortOrder, z.active,
     z.weightFromGrams ?? 0, z.weightToGrams ?? 99999, z.deliveryType || 'standard', z.estimatedDays || '5-7 days']
  );
  return rowToShippingZone(rows[0]);
}

export async function updateShippingZone(id: string, patch: Partial<Omit<DBShippingZone, 'id' | 'createdAt'>>): Promise<DBShippingZone | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', label: 'label', shippingCharge: 'shipping_charge',
    freeAbove: 'free_above', sortOrder: 'sort_order', active: 'active',
    weightFromGrams: 'weight_from_grams', weightToGrams: 'weight_to_grams',
    deliveryType: 'delivery_type', estimatedDays: 'estimated_days',
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
  deliveryMethod: string;
  deliveryConfig: any;
  shippingCost: number;
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
    deliveryMethod: row.delivery_method || 'standard',
    deliveryConfig: row.delivery_config || {},
    shippingCost: parseFloat(row.shipping_cost || '0'),
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
  deliveryMethod?: string; deliveryConfig?: any; shippingCost?: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO website_orders
       (id, user_id, items, total, status, shipping_address,
        razorpay_order_id, payment_id, payment_status,
        coupon_code, discount_amount, group_order_id,
        delivery_method, delivery_config, shipping_cost, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW()) RETURNING *`,
    [o.id, o.userId, JSON.stringify(o.items), o.total, o.status, o.shippingAddress,
     o.razorpayOrderId || null, o.paymentId || null, o.paymentStatus || 'paid',
     o.couponCode || null, o.discountAmount || 0, o.groupOrderId || null,
     o.deliveryMethod || 'standard', JSON.stringify(o.deliveryConfig || {}), o.shippingCost || 0]
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

/* ── Collection queries ── */
export interface DBCollection {
  id: string; name: string; tagline: string; tag: string;
  gradient: string; glow: string; shimmer: string; symbol: string;
  badge: string; badgeColor: string; featured: boolean; active: boolean;
  sortOrder: number; createdAt: string; productCount?: number;
  coverImage: string;
}

function rowToCollection(row: any): DBCollection {
  return {
    id: row.id, name: row.name, tagline: row.tagline, tag: row.tag,
    gradient: row.gradient, glow: row.glow, shimmer: row.shimmer, symbol: row.symbol,
    badge: row.badge, badgeColor: row.badge_color, featured: row.featured,
    active: row.active, sortOrder: row.sort_order, createdAt: row.created_at,
    productCount: row.product_count ? parseInt(row.product_count) : 0,
    coverImage: row.cover_image || '',
  };
}

export async function getCollections(activeOnly = true): Promise<DBCollection[]> {
  const where = activeOnly ? 'WHERE c.active = true' : '';
  const { rows } = await pool.query(`
    SELECT c.*, COUNT(cp.product_id) as product_count
    FROM website_collections c
    LEFT JOIN website_collection_products cp ON cp.collection_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.created_at DESC
  `);
  return rows.map(rowToCollection);
}

export async function getCollectionById(id: string): Promise<DBCollection | null> {
  const { rows } = await pool.query(`
    SELECT c.*, COUNT(cp.product_id) as product_count
    FROM website_collections c
    LEFT JOIN website_collection_products cp ON cp.collection_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);
  return rows.length ? rowToCollection(rows[0]) : null;
}

export async function createCollection(c: Omit<DBCollection, 'createdAt' | 'productCount'>): Promise<DBCollection> {
  const { rows } = await pool.query(`
    INSERT INTO website_collections (id, name, tagline, tag, gradient, glow, shimmer, symbol, badge, badge_color, featured, active, sort_order, cover_image, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) RETURNING *
  `, [c.id, c.name, c.tagline, c.tag, c.gradient, c.glow, c.shimmer, c.symbol, c.badge, c.badgeColor, c.featured, c.active, c.sortOrder, c.coverImage || '']);
  return rowToCollection(rows[0]);
}

export async function updateCollection(id: string, patch: Partial<DBCollection>): Promise<DBCollection | null> {
  const fieldMap: Record<string, string> = {
    name: 'name', tagline: 'tagline', tag: 'tag', gradient: 'gradient',
    glow: 'glow', shimmer: 'shimmer', symbol: 'symbol', badge: 'badge',
    badgeColor: 'badge_color', featured: 'featured', active: 'active', sortOrder: 'sort_order',
    coverImage: 'cover_image',
  };
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in patch) { sets.push(`${col} = $${idx}`); vals.push((patch as any)[key]); idx++; }
  }
  if (!sets.length) return getCollectionById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE website_collections SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  return rows.length ? rowToCollection(rows[0]) : null;
}

export async function deleteCollection(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM website_collections WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function getCollectionProducts(collectionId: string): Promise<any[]> {
  const { rows } = await pool.query(`
    SELECT p.*, cp.sort_order as cp_sort
    FROM website_collection_products cp
    JOIN website_products p ON p.id = cp.product_id
    WHERE cp.collection_id = $1
    ORDER BY cp.sort_order ASC, cp.added_at ASC
  `, [collectionId]);
  return rows;
}

export async function addProductToCollection(collectionId: string, productId: string, sortOrder = 0): Promise<boolean> {
  await pool.query(
    `INSERT INTO website_collection_products (collection_id, product_id, sort_order, added_at)
     VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
    [collectionId, productId, sortOrder]
  );
  return true;
}

export async function removeProductFromCollection(collectionId: string, productId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM website_collection_products WHERE collection_id = $1 AND product_id = $2',
    [collectionId, productId]
  );
  return (rowCount ?? 0) > 0;
}

/* ── Brands ── */

export async function getBrands(categoryId?: string): Promise<any[]> {
  const q = categoryId
    ? `SELECT b.*, c.name AS category_name, c.slug AS category_slug,
              (SELECT COUNT(*) FROM website_device_models dm WHERE dm.brand_id = b.id AND dm.active = true) AS model_count
       FROM website_brands b
       LEFT JOIN website_categories c ON c.id = b.category_id
       WHERE b.category_id = $1 AND b.active = true
       ORDER BY b.sort_order, b.name`
    : `SELECT b.*, c.name AS category_name, c.slug AS category_slug,
              (SELECT COUNT(*) FROM website_device_models dm WHERE dm.brand_id = b.id AND dm.active = true) AS model_count
       FROM website_brands b
       LEFT JOIN website_categories c ON c.id = b.category_id
       WHERE b.active = true
       ORDER BY b.sort_order, b.name`;
  const { rows } = categoryId ? await pool.query(q, [categoryId]) : await pool.query(q);
  return rows;
}

export async function getAllBrands(): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT b.*, c.name AS category_name, c.slug AS category_slug,
            (SELECT COUNT(*) FROM website_device_models dm WHERE dm.brand_id = b.id) AS model_count
     FROM website_brands b
     LEFT JOIN website_categories c ON c.id = b.category_id
     ORDER BY b.sort_order, b.name`
  );
  return rows;
}

export async function getBrandBySlug(slug: string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT b.*, c.name AS category_name, c.slug AS category_slug
     FROM website_brands b
     LEFT JOIN website_categories c ON c.id = b.category_id
     WHERE b.slug = $1`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function createBrand(data: {
  id: string; name: string; slug: string; logo: string;
  categoryId?: string; active: boolean; sortOrder: number;
}): Promise<any> {
  const { rows } = await pool.query(
    `INSERT INTO website_brands (id, name, slug, logo, category_id, active, sort_order, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
    [data.id, data.name, data.slug, data.logo, data.categoryId || null, data.active, data.sortOrder]
  );
  return rows[0];
}

export async function updateBrand(id: string, data: {
  name?: string; slug?: string; logo?: string;
  categoryId?: string | null; active?: boolean; sortOrder?: number;
}): Promise<any | null> {
  const fields: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.name !== undefined)      { fields.push(`name=$${i++}`);       vals.push(data.name); }
  if (data.slug !== undefined)      { fields.push(`slug=$${i++}`);       vals.push(data.slug); }
  if (data.logo !== undefined)      { fields.push(`logo=$${i++}`);       vals.push(data.logo); }
  if ('categoryId' in data)         { fields.push(`category_id=$${i++}`); vals.push(data.categoryId ?? null); }
  if (data.active !== undefined)    { fields.push(`active=$${i++}`);     vals.push(data.active); }
  if (data.sortOrder !== undefined) { fields.push(`sort_order=$${i++}`); vals.push(data.sortOrder); }
  if (!fields.length) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE website_brands SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteBrand(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM website_brands WHERE id=$1', [id]);
  return (rowCount ?? 0) > 0;
}

/* ── Device Models ── */

export async function getModelsByBrand(brandId: string, activeOnly = true): Promise<any[]> {
  const q = activeOnly
    ? `SELECT dm.*, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug
       FROM website_device_models dm
       JOIN website_brands b ON b.id = dm.brand_id
       LEFT JOIN website_categories c ON c.id = b.category_id
       WHERE dm.brand_id = $1 AND dm.active = true
       ORDER BY dm.sort_order, dm.name`
    : `SELECT dm.*, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug
       FROM website_device_models dm
       JOIN website_brands b ON b.id = dm.brand_id
       LEFT JOIN website_categories c ON c.id = b.category_id
       WHERE dm.brand_id = $1
       ORDER BY dm.sort_order, dm.name`;
  const { rows } = await pool.query(q, [brandId]);
  return rows;
}

export async function getAllModels(): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT dm.*, b.name AS brand_name, b.slug AS brand_slug, c.name AS category_name, c.slug AS category_slug
     FROM website_device_models dm
     JOIN website_brands b ON b.id = dm.brand_id
     LEFT JOIN website_categories c ON c.id = b.category_id
     ORDER BY b.name, dm.sort_order, dm.name`
  );
  return rows;
}

export async function getModelBySlug(brandSlug: string, modelSlug: string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT dm.*, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug
     FROM website_device_models dm
     JOIN website_brands b ON b.id = dm.brand_id
     LEFT JOIN website_categories c ON c.id = b.category_id
     WHERE b.slug = $1 AND dm.slug = $2`,
    [brandSlug, modelSlug]
  );
  return rows[0] ?? null;
}

export async function createModel(data: {
  id: string; name: string; slug: string; displayName: string;
  brandId: string; active: boolean; sortOrder: number;
}): Promise<any> {
  const { rows } = await pool.query(
    `INSERT INTO website_device_models (id, name, slug, display_name, brand_id, active, sort_order, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
    [data.id, data.name, data.slug, data.displayName, data.brandId, data.active, data.sortOrder]
  );
  return rows[0];
}

export async function updateModel(id: string, data: {
  name?: string; slug?: string; displayName?: string;
  brandId?: string; active?: boolean; sortOrder?: number;
}): Promise<any | null> {
  const fields: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (data.name !== undefined)        { fields.push(`name=$${i++}`);         vals.push(data.name); }
  if (data.slug !== undefined)        { fields.push(`slug=$${i++}`);         vals.push(data.slug); }
  if (data.displayName !== undefined) { fields.push(`display_name=$${i++}`); vals.push(data.displayName); }
  if (data.brandId !== undefined)     { fields.push(`brand_id=$${i++}`);     vals.push(data.brandId); }
  if (data.active !== undefined)      { fields.push(`active=$${i++}`);       vals.push(data.active); }
  if (data.sortOrder !== undefined)   { fields.push(`sort_order=$${i++}`);   vals.push(data.sortOrder); }
  if (!fields.length) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE website_device_models SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteModel(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM website_device_models WHERE id=$1', [id]);
  return (rowCount ?? 0) > 0;
}

/* ── Promotional Banners ── */

export async function getActiveBanners(): Promise<any[]> {
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `SELECT * FROM website_banners
     WHERE active = true
       AND (start_date IS NULL OR start_date <= $1)
       AND (end_date IS NULL OR end_date >= $1)
     ORDER BY sort_order ASC, created_at ASC`,
    [now]
  );
  return rows;
}

export async function getAllBanners(): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT * FROM website_banners ORDER BY sort_order ASC, created_at DESC'
  );
  return rows;
}

export async function createBanner(data: {
  id: string; title: string; subtitle: string; badgeText: string; badgeType: string;
  imageUrl: string; ctaLabel: string; ctaUrl: string; ctaLabel2: string; ctaUrl2: string;
  bgGradient: string; accentColor: string; textColor: string;
  active: boolean; sortOrder: number; startDate?: string | null; endDate?: string | null;
}): Promise<any> {
  const { rows } = await pool.query(
    `INSERT INTO website_banners
       (id,title,subtitle,badge_text,badge_type,image_url,cta_label,cta_url,
        cta_label_2,cta_url_2,bg_gradient,accent_color,text_color,active,sort_order,start_date,end_date,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
     RETURNING *`,
    [data.id, data.title, data.subtitle, data.badgeText, data.badgeType,
     data.imageUrl, data.ctaLabel, data.ctaUrl, data.ctaLabel2, data.ctaUrl2,
     data.bgGradient, data.accentColor, data.textColor,
     data.active, data.sortOrder, data.startDate || null, data.endDate || null]
  );
  return rows[0];
}

export async function updateBanner(id: string, data: Partial<{
  title: string; subtitle: string; badgeText: string; badgeType: string;
  imageUrl: string; ctaLabel: string; ctaUrl: string; ctaLabel2: string; ctaUrl2: string;
  bgGradient: string; accentColor: string; textColor: string;
  active: boolean; sortOrder: number; startDate: string | null; endDate: string | null;
}>): Promise<any | null> {
  const MAP: Record<string, string> = {
    title: 'title', subtitle: 'subtitle', badgeText: 'badge_text', badgeType: 'badge_type',
    imageUrl: 'image_url', ctaLabel: 'cta_label', ctaUrl: 'cta_url',
    ctaLabel2: 'cta_label_2', ctaUrl2: 'cta_url_2',
    bgGradient: 'bg_gradient', accentColor: 'accent_color', textColor: 'text_color',
    active: 'active', sortOrder: 'sort_order', startDate: 'start_date', endDate: 'end_date',
  };
  const fields: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(MAP)) {
    if (key in data) { fields.push(`${col}=$${i++}`); vals.push((data as any)[key] ?? null); }
  }
  if (!fields.length) return null;
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE website_banners SET ${fields.join(',')} WHERE id=$${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteBanner(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM website_banners WHERE id=$1', [id]);
  return (rowCount ?? 0) > 0;
}

/* ── Courier Config ── */

export async function getCourierConfigs(): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT * FROM website_courier_config ORDER BY carrier ASC'
  );
  return rows;
}

export async function getCourierConfig(carrier: string): Promise<any | null> {
  const { rows } = await pool.query(
    'SELECT * FROM website_courier_config WHERE carrier=$1', [carrier]
  );
  return rows[0] ?? null;
}

export async function updateCourierConfig(carrier: string, data: {
  enabled?: boolean; apiKey?: string; apiSecret?: string; apiUrl?: string;
  sourcePincode?: string; volumetricDivisor?: number;
  markupPercent?: number; markupFlat?: number;
  zoneRates?: Record<string, number>; credentials?: Record<string, any>;
}): Promise<any | null> {
  const MAP: Record<string, string> = {
    enabled: 'enabled', apiKey: 'api_key', apiSecret: 'api_secret',
    apiUrl: 'api_url', sourcePincode: 'source_pincode',
    volumetricDivisor: 'volumetric_divisor',
    markupPercent: 'markup_percent', markupFlat: 'markup_flat',
    zoneRates: 'zone_rates', credentials: 'credentials',
  };
  const fields: string[] = ['updated_at=NOW()'];
  const vals: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(MAP)) {
    if (key in data) {
      const val = (data as any)[key];
      fields.push(`${col}=$${i++}`);
      vals.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
    }
  }
  vals.push(carrier);
  const { rows } = await pool.query(
    `UPDATE website_courier_config SET ${fields.join(',')} WHERE carrier=$${i} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

/* ── Shipping Rate Cache ── */

export async function getCachedRates(cacheKey: string): Promise<any[] | null> {
  const { rows } = await pool.query(
    'SELECT rates FROM website_shipping_rate_cache WHERE cache_key=$1 AND expires_at > NOW()',
    [cacheKey]
  );
  return rows[0]?.rates ?? null;
}

export async function setCachedRates(cacheKey: string, carrier: string, rates: any[], ttlSeconds = 300): Promise<void> {
  await pool.query(
    `INSERT INTO website_shipping_rate_cache (cache_key, carrier, rates, expires_at, created_at)
     VALUES ($1,$2,$3,NOW() + ($4 || ' seconds')::interval, NOW())
     ON CONFLICT (cache_key) DO UPDATE SET rates=$3, expires_at=NOW() + ($4 || ' seconds')::interval`,
    [cacheKey, carrier, JSON.stringify(rates), ttlSeconds]
  );
}

export async function evictExpiredRateCache(): Promise<void> {
  await pool.query('DELETE FROM website_shipping_rate_cache WHERE expires_at < NOW()');
}

/* ── Delivery Settings ── */

export async function getDeliverySettings(): Promise<Record<string, any>> {
  const { rows } = await pool.query('SELECT key, value FROM website_delivery_settings ORDER BY key');
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}

export async function getDeliverySettingByKey(key: string): Promise<any | null> {
  const { rows } = await pool.query(
    'SELECT value FROM website_delivery_settings WHERE key=$1', [key]
  );
  return rows[0]?.value ?? null;
}

export async function updateDeliverySetting(key: string, value: any): Promise<void> {
  await pool.query(
    `INSERT INTO website_delivery_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
    [key, JSON.stringify(value)]
  );
}

/* ── Design Order helpers (delivery fields) ── */
export async function addDesignOrderDelivery(orderId: string, deliveryMethod: string, deliveryConfig: any, shippingCost: number): Promise<void> {
  await pool.query(
    `UPDATE website_design_orders SET delivery_method=$1, delivery_config=$2::jsonb, shipping_cost=$3 WHERE id=$4`,
    [deliveryMethod, JSON.stringify(deliveryConfig), shippingCost, orderId]
  );
}

/* ── Analytics event tracking ── */
export interface ProductEvent {
  eventType: string; productId?: string; productName?: string; category?: string;
  brandId?: string; brandName?: string; size?: string; color?: string;
  sessionId: string; userId?: string; price?: number; quantity?: number;
}

export async function insertProductEvent(e: ProductEvent): Promise<void> {
  const { v4: uuidv4 } = await import('uuid');
  await pool.query(
    `INSERT INTO website_product_events
       (id, event_type, product_id, product_name, category, brand_id, brand_name,
        size, color, session_id, user_id, price, quantity, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
    [uuidv4(), e.eventType, e.productId||null, e.productName||null, e.category||null,
     e.brandId||null, e.brandName||null, e.size||null, e.color||null,
     e.sessionId, e.userId||null, e.price||null, e.quantity||1]
  );
}

export async function getAdvancedAnalytics(from: string, to: string, groupBy: 'day'|'week'|'month' = 'day') {
  const dateTrunc = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day';

  const [
    revenueRows, mostViewedRows, mostAddedRows, brandRows, sizeRows,
    funnelRows, categoryRevenueRows, designCustomRows, productPerfRows,
  ] = await Promise.all([
    // Revenue timeline
    pool.query(`
      SELECT DATE_TRUNC($3, created_at) as period,
             SUM(total) as revenue, COUNT(*) as orders
      FROM (
        SELECT total, created_at FROM website_orders WHERE status != 'cancelled' AND created_at BETWEEN $1 AND $2
        UNION ALL
        SELECT total, created_at FROM website_design_orders WHERE status != 'cancelled' AND created_at BETWEEN $1 AND $2
      ) t GROUP BY period ORDER BY period
    `, [from, to, dateTrunc]),

    // Most viewed products
    pool.query(`
      SELECT product_id, MAX(product_name) as product_name, MAX(category) as category,
             COUNT(*) as views
      FROM website_product_events
      WHERE event_type='view' AND created_at BETWEEN $1 AND $2 AND product_id IS NOT NULL
      GROUP BY product_id ORDER BY views DESC LIMIT 10
    `, [from, to]),

    // Most added-to-cart
    pool.query(`
      SELECT product_id, MAX(product_name) as product_name,
             COUNT(*) as add_count, SUM(quantity) as total_qty
      FROM website_product_events
      WHERE event_type='add_to_cart' AND created_at BETWEEN $1 AND $2 AND product_id IS NOT NULL
      GROUP BY product_id ORDER BY add_count DESC LIMIT 10
    `, [from, to]),

    // Most selected brands
    pool.query(`
      SELECT brand_id, MAX(brand_name) as brand_name, COUNT(*) as select_count
      FROM website_product_events
      WHERE event_type='add_to_cart' AND created_at BETWEEN $1 AND $2 AND brand_id IS NOT NULL
      GROUP BY brand_id ORDER BY select_count DESC LIMIT 10
    `, [from, to]),

    // Most selected sizes
    pool.query(`
      SELECT size, COUNT(*) as select_count
      FROM website_product_events
      WHERE event_type='add_to_cart' AND created_at BETWEEN $1 AND $2 AND size IS NOT NULL AND size != ''
      GROUP BY size ORDER BY select_count DESC LIMIT 12
    `, [from, to]),

    // Conversion funnel counts
    pool.query(`
      SELECT event_type, COUNT(DISTINCT session_id) as sessions
      FROM website_product_events
      WHERE event_type IN ('view','add_to_cart','checkout_start','purchase')
        AND created_at BETWEEN $1 AND $2
      GROUP BY event_type
    `, [from, to]),

    // Revenue by category (from orders)
    pool.query(`
      SELECT (item->>'category') as category,
             SUM((item->>'price')::numeric * (item->>'quantity')::int) as revenue,
             COUNT(*) as orders
      FROM website_orders, jsonb_array_elements(items) as item
      WHERE status != 'cancelled' AND created_at BETWEEN $1 AND $2
        AND (item->>'category') IS NOT NULL
      GROUP BY category ORDER BY revenue DESC LIMIT 8
    `, [from, to]),

    // Most customized products (from design orders)
    pool.query(`
      SELECT product_type, COUNT(*) as count, SUM(total) as revenue
      FROM website_design_orders
      WHERE status != 'cancelled' AND created_at BETWEEN $1 AND $2
      GROUP BY product_type ORDER BY count DESC LIMIT 10
    `, [from, to]),

    // Product performance: views + add_to_cart + purchases merged
    pool.query(`
      SELECT
        e.product_id,
        MAX(e.product_name) as product_name,
        MAX(e.category) as category,
        COUNT(*) FILTER (WHERE e.event_type = 'view') as views,
        COUNT(*) FILTER (WHERE e.event_type = 'add_to_cart') as add_to_cart,
        COUNT(*) FILTER (WHERE e.event_type = 'purchase') as purchases
      FROM website_product_events e
      WHERE e.created_at BETWEEN $1 AND $2 AND e.product_id IS NOT NULL
      GROUP BY e.product_id ORDER BY views DESC LIMIT 20
    `, [from, to]),
  ]);

  // Revenue from orders table for KPIs
  const [orderKpiRes, userCountRes] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(total),0) as revenue,
        COUNT(*) as orders,
        COALESCE(AVG(total),0) as aov
      FROM (
        SELECT total FROM website_orders WHERE status!='cancelled' AND created_at BETWEEN $1 AND $2
        UNION ALL
        SELECT total FROM website_design_orders WHERE status!='cancelled' AND created_at BETWEEN $1 AND $2
      ) t
    `, [from, to]),
    pool.query(`SELECT COUNT(DISTINCT user_id) as visitors FROM website_product_events WHERE created_at BETWEEN $1 AND $2`, [from, to]),
  ]);

  // Build funnel map
  const funnelMap: Record<string,number> = {};
  for (const r of funnelRows.rows) funnelMap[r.event_type] = parseInt(r.sessions)||0;
  const funnelViews    = funnelMap['view'] || 0;
  const funnelCart     = funnelMap['add_to_cart'] || 0;
  const funnelCheckout = funnelMap['checkout_start'] || 0;
  const funnelPurchase = funnelMap['purchase'] || 0;

  // Conversion rate: unique sessions with purchase / sessions with view
  const conversionRate = funnelViews > 0 ? ((funnelPurchase / funnelViews) * 100) : 0;

  // Cart abandonment: checkout_start sessions that didn't purchase
  const cartAbandonmentRate = funnelCheckout > 0
    ? (((funnelCheckout - funnelPurchase) / funnelCheckout) * 100) : 0;

  // Product performance with conversion
  const productPerf = productPerfRows.rows.map((r: any) => ({
    productId: r.product_id,
    name: r.product_name || r.product_id,
    category: r.category || '',
    views: parseInt(r.views)||0,
    addToCart: parseInt(r.add_to_cart)||0,
    purchases: parseInt(r.purchases)||0,
    conversionRate: (parseInt(r.views)||0) > 0
      ? (((parseInt(r.purchases)||0) / (parseInt(r.views)||0)) * 100).toFixed(1)
      : '0.0',
  }));

  return {
    // KPIs
    totalRevenue: parseFloat(orderKpiRes.rows[0]?.revenue || '0'),
    totalOrders: parseInt(orderKpiRes.rows[0]?.orders || '0'),
    avgOrderValue: parseFloat(orderKpiRes.rows[0]?.aov || '0'),
    uniqueVisitors: parseInt(userCountRes.rows[0]?.visitors || '0'),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    cartAbandonmentRate: parseFloat(cartAbandonmentRate.toFixed(2)),

    // Timeline
    revenueTimeline: revenueRows.rows.map((r: any) => ({
      date: r.period, revenue: parseFloat(r.revenue), orders: parseInt(r.orders),
    })),

    // Product analytics
    mostViewedProducts: mostViewedRows.rows.map((r: any) => ({
      productId: r.product_id, name: r.product_name||r.product_id,
      category: r.category||'', views: parseInt(r.views),
    })),
    mostAddedToCart: mostAddedRows.rows.map((r: any) => ({
      productId: r.product_id, name: r.product_name||r.product_id,
      addCount: parseInt(r.add_count), totalQty: parseInt(r.total_qty)||0,
    })),

    // Behavior
    mostSelectedBrands: brandRows.rows.map((r: any) => ({
      brandId: r.brand_id, brandName: r.brand_name||r.brand_id,
      selectCount: parseInt(r.select_count),
    })),
    mostSelectedSizes: sizeRows.rows.map((r: any) => ({
      size: r.size, selectCount: parseInt(r.select_count),
    })),

    // Funnel
    funnel: {
      views: funnelViews, addedToCart: funnelCart,
      checkoutStarted: funnelCheckout, purchased: funnelPurchase,
    },

    // Revenue breakdown
    categoryRevenue: categoryRevenueRows.rows.map((r: any) => ({
      category: r.category||'Other', revenue: parseFloat(r.revenue), orders: parseInt(r.orders),
    })),
    mostCustomizedProducts: designCustomRows.rows.map((r: any) => ({
      productType: r.product_type, count: parseInt(r.count), revenue: parseFloat(r.revenue)||0,
    })),

    // Product performance table
    productPerformance: productPerf,
  };
}
