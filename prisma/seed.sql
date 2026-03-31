-- Seed products
INSERT INTO products (id, name, slug, sku, "basePrice", "createdAt", "updatedAt")
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Classic Round Neck T-Shirt', 'classic-round-neck-tshirt', 'TSH-001', 599.00, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Premium V-Neck T-Shirt', 'premium-v-neck-tshirt', 'TSH-002', 799.00, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'Oversized Drop Shoulder T-Shirt', 'oversized-drop-shoulder-tshirt', 'TSH-003', 899.00, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

-- Seed colors for Classic Round Neck
INSERT INTO product_colors (id, name, "hexCode", "productId", "createdAt")
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'White', '#FFFFFF', '11111111-1111-1111-1111-111111111111', NOW()),
  ('c2222222-2222-2222-2222-222222222222', 'Black', '#000000', '11111111-1111-1111-1111-111111111111', NOW()),
  ('c3333333-3333-3333-3333-333333333333', 'Navy Blue', '#1B2A4A', '11111111-1111-1111-1111-111111111111', NOW()),
  ('c4444444-4444-4444-4444-444444444444', 'Red', '#DC2626', '11111111-1111-1111-1111-111111111111', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed colors for Premium V-Neck
INSERT INTO product_colors (id, name, "hexCode", "productId", "createdAt")
VALUES
  ('c5555555-5555-5555-5555-555555555555', 'White', '#FFFFFF', '22222222-2222-2222-2222-222222222222', NOW()),
  ('c6666666-6666-6666-6666-666666666666', 'Charcoal', '#374151', '22222222-2222-2222-2222-222222222222', NOW()),
  ('c7777777-7777-7777-7777-777777777777', 'Olive Green', '#4B5320', '22222222-2222-2222-2222-222222222222', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed colors for Oversized Drop Shoulder
INSERT INTO product_colors (id, name, "hexCode", "productId", "createdAt")
VALUES
  ('c8888888-8888-8888-8888-888888888888', 'White', '#FFFFFF', '33333333-3333-3333-3333-333333333333', NOW()),
  ('c9999999-9999-9999-9999-999999999999', 'Black', '#000000', '33333333-3333-3333-3333-333333333333', NOW()),
  ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beige', '#D4B896', '33333333-3333-3333-3333-333333333333', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed print areas for Classic Round Neck (Front + Back)
INSERT INTO print_areas (id, side, width, height, "xPosition", "yPosition", "safeZone", bleed, "additionalPrice", "realWidthInches", "realHeightInches", "productId", "createdAt")
VALUES
  ('pa111111-1111-1111-1111-111111111111', 'FRONT', 500, 600, 100, 100, 20, 10, 0, 12.0, 16.0, '11111111-1111-1111-1111-111111111111', NOW()),
  ('pa222222-2222-2222-2222-222222222222', 'BACK', 500, 600, 100, 100, 20, 10, 100, 12.0, 16.0, '11111111-1111-1111-1111-111111111111', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed print areas for Premium V-Neck (Front + Back)
INSERT INTO print_areas (id, side, width, height, "xPosition", "yPosition", "safeZone", bleed, "additionalPrice", "realWidthInches", "realHeightInches", "productId", "createdAt")
VALUES
  ('pa333333-3333-3333-3333-333333333333', 'FRONT', 500, 600, 100, 100, 20, 10, 0, 12.0, 16.0, '22222222-2222-2222-2222-222222222222', NOW()),
  ('pa444444-4444-4444-4444-444444444444', 'BACK', 500, 600, 100, 100, 20, 10, 100, 12.0, 16.0, '22222222-2222-2222-2222-222222222222', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed print areas for Oversized Drop Shoulder (Front + Back + Sleeves)
INSERT INTO print_areas (id, side, width, height, "xPosition", "yPosition", "safeZone", bleed, "additionalPrice", "realWidthInches", "realHeightInches", "productId", "createdAt")
VALUES
  ('pa555555-5555-5555-5555-555555555555', 'FRONT', 550, 650, 90, 90, 25, 12, 0, 13.0, 17.0, '33333333-3333-3333-3333-333333333333', NOW()),
  ('pa666666-6666-6666-6666-666666666666', 'BACK', 550, 650, 90, 90, 25, 12, 100, 13.0, 17.0, '33333333-3333-3333-3333-333333333333', NOW()),
  ('pa777777-7777-7777-7777-777777777777', 'LEFT_SLEEVE', 200, 200, 50, 50, 10, 5, 150, 4.0, 4.0, '33333333-3333-3333-3333-333333333333', NOW()),
  ('pa888888-8888-8888-8888-888888888888', 'RIGHT_SLEEVE', 200, 200, 50, 50, 10, 5, 150, 4.0, 4.0, '33333333-3333-3333-3333-333333333333', NOW())
ON CONFLICT (id) DO NOTHING;
