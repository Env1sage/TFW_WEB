INSERT INTO products (id, name, sku, "basePrice", "createdAt", "updatedAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'Test T-Shirt', 'TSH-001', 599.00, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;
