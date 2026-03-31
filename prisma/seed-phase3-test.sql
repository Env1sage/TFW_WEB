-- Phase 3 Test Seed: Insert a test product
INSERT INTO products (id, name, sku, "basePrice", "createdAt", "updatedAt")
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Test T-Shirt', 'TSH-TEST-001', 599.00, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;
