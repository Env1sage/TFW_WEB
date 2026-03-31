# TFW Website — Gap Implementation Testing Checklist

Below is a comprehensive testing guide for all 14 gaps that were implemented. Test each section in order.

---

## Pre-requisites
- Start the database: `docker compose up -d postgres`
- Start the server: `cd website && npm run dev:server` (port 5000)
- Start the frontend: `cd website && npm run dev` (port 3000)
- **Note:** On first run, drop and re-create the DB so new tables/columns take effect:
  ```
  docker exec -it tfw_postgres psql -U tfw -d tfw_db -c "DROP TABLE IF EXISTS website_corporate_inquiries, website_saved_designs, website_orders, website_products, website_users CASCADE;"
  ```
  Then restart the server — it will re-create all tables and seed data.

---

## Gap 1: Typography System
**What changed:** PRD fonts (Poppins, Inter, Montserrat, Open Sans) added as CSS variables.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Open homepage | Headings use Poppins font, body text uses Inter |
| 2 | Inspect `:root` in DevTools | See `--font-heading: 'Poppins', ...` and `--font-body: 'Inter', ...` |
| 3 | Check navbar brand, hero, section headers | All use `var(--font-heading)` (no hardcoded Space Grotesk) |

---

## Gap 2: Hardcoded Colors Fixed
**What changed:** Inline hex values in DesignStudioCart and other pages replaced with CSS variable classes.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Go to `/design-studio`, add an item, go to cart | All colors use theme variables (no hardcoded #0f172a, #1e293b, etc.) |
| 2 | Inspect DesignStudioCart elements | Classes like `.dsc-page`, `.dsc-card` use `var(--surface)`, `var(--border)` |
| 3 | Check ProductDetail and Cart pages | Borders use `var(--border)` instead of `#ddd` |

---

## Gap 3: Design System Documentation
**What changed:** Created `Documentation/DESIGN_SYSTEM.md`.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Open `Documentation/DESIGN_SYSTEM.md` | Contains typography tokens, color palette, shape tokens, shadows, buttons, breakpoints |

---

## Gap 4: Price Range Filter
**What changed:** Products page has min/max price filter inputs.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Go to `/products` | See two number inputs "Min ₹" and "Max ₹" in the toolbar |
| 2 | Enter min: 500, max: 1000 | Only products priced ₹500–₹1000 show (e.g. T-Shirt ₹599, Mug ₹399 hidden) |
| 3 | Clear the filter | All products return |
| 4 | Enter only min: 1200 | Only products ≥ ₹1200 appear (Hoodies, Framed Print, Zip Hoodie) |

---

## Gap 5: Product Detail (Size Chart, Fabric, Delivery)
**What changed:** ProductDetail page now shows size chart, fabric info, and delivery estimate.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Go to any T-Shirt product detail | See "📐 Size Chart" toggle — click it |
| 2 | Size chart expands | Table with columns: Size, Chest, Length, Sleeve (XS–XXL) |
| 3 | Check fabric info section | Shows "100% combed cotton, bio-washed, 180 GSM" for T-Shirts |
| 4 | Check delivery estimate | Shows "🚚 Estimated delivery: 3-5 business days across India" |
| 5 | Check a Hoodie product | Size chart shows different measurements; fabric says "300 GSM terry cotton" |

---

## Gap 6: Layer Management (Flip & Lock)
**What changed:** Design Studio left panel has Flip H, Flip V, Lock/Unlock buttons.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Open `/design-studio`, add an image | Select the image on canvas |
| 2 | Click "↔ Flip H" | Image flips horizontally |
| 3 | Click "↕ Flip V" | Image flips vertically |
| 4 | Click "🔓 Unlock" | Button changes to "🔒 Locked", image cannot be moved/scaled/rotated |
| 5 | Click "🔒 Locked" | Unlocks — image can be manipulated again |

---

## Gap 7: Mobile Responsive Editor
**What changed:** Design Studio shows a mobile toolbar on screens <700px.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Open `/design-studio` on mobile (or resize browser <700px) | See horizontal scrollable toolbar at bottom |
| 2 | Toolbar has buttons | Text, Image, Del, Copy, Center, Flip H, Flip V, Lock, Preview |
| 3 | Tap buttons | Each performs its action (add text, upload image, etc.) |
| 4 | Resize back to >700px | Mobile toolbar disappears, desktop panels return |

---

## Gap 8: Razorpay Checkout
**What changed:** Cart checkout uses Razorpay payment flow (test mode with simulated fallback).

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Add products to cart, fill address, click "Pay with Razorpay" | If Razorpay test keys configured: Razorpay modal opens |
| 2 | With placeholder keys | Simulated payment runs, order is placed with "simulated" payment ID |
| 3 | Check Orders page | New order appears with correct total and items |

---

## Gap 9: Saved Designs & Invoice Download
**What changed:** Saved Designs page + Invoice download button on Orders page.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Log in, go to `/saved-designs` | Shows empty state with "Open Design Studio" button |
| 2 | Go to `/orders`, find an order | See "📄 Invoice" button in order footer |
| 3 | Click Invoice button | Downloads an HTML invoice file with order details, items table, total |
| 4 | Open the downloaded HTML | Shows TFW branded invoice with order ID, date, items, prices in ₹ |
| 5 | Check profile dropdown | "Saved Designs" link appears below "My Orders" |

---

## Gap 10: Product SKUs & INR Pricing
**What changed:** All products have SKU codes (TFW-XX-XXXX) and prices in ₹ (Indian Rupees).

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Go to `/products` | All prices show in ₹ (e.g. ₹599, ₹1299, ₹399) |
| 2 | Check DB (or API response) | Products have `sku` field: TFW-TS-1001-WHT, TFW-HD-1001-BLK, etc. |
| 3 | Classic T-Shirt | ₹599 (was $24.99) |
| 4 | Premium Hoodie | ₹1299 (was $44.99) |
| 5 | Canvas Print | ₹999 (was $39.99) |
| 6 | Vinyl Stickers | ₹199 (was $8.99) |

---

## Gap 11: Role-Based Access Control
**What changed:** 5 roles (user, order_manager, product_manager, admin, super_admin) with specific route guards.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Login as admin (admin@theframedwall.com / admin123) | Can access all admin routes |
| 2 | Manually update a user's role to `product_manager` in DB | Can access product CRUD and mockup routes |
| 3 | `product_manager` tries to update order status | Returns 403 "Requires role: admin or order_manager" |
| 4 | User with role `order_manager` | Can update order/design-order status, manage corporate inquiries |
| 5 | `order_manager` tries to create a product | Returns 403 |
| 6 | `super_admin` | Can access everything (bypasses all role checks) |
| 7 | Admin panel link in Navbar | Visible for admin, super_admin, product_manager, order_manager |

---

## Gap 12: Corporate/Bulk Inquiry System
**What changed:** New `/corporate` page with inquiry form + backend storage.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Go to `/corporate` | See "Corporate & Bulk Orders" page with benefits cards |
| 2 | Fill form (company, name, email required) + submit | Success screen: "Inquiry Submitted!" |
| 3 | Leave required fields blank, submit | Toast error "Please fill all required fields" |
| 4 | Check footer | "Corporate Orders" link appears under Company column |
| 5 | As admin, GET `/api/products/corporate-inquiries` | Returns list with the submitted inquiry |
| 6 | PUT `/api/products/corporate-inquiries/:id` with `{status: "contacted"}` | Updates inquiry status |

---

## Gap 13: Image Compression Pipeline
**What changed:** Images >500KB are auto-compressed before adding to Design Studio canvas.

| # | Test Step | Expected |
|---|-----------|----------|
| 1 | Open `/design-studio` | Upload a large image (>1MB) |
| 2 | Image appears on canvas | Compresses to WebP, max 2048x2048, 85% quality |
| 3 | Upload a small image (<500KB) | Skips compression, adds directly |
| 4 | Check `website/src/utils/imageCompression.ts` | Contains `compressImage()` and `compressToDataURL()` utilities |

---

## Gap 14: Cross-Feature Smoke Test

| # | Test Area | Verification |
|---|-----------|-------------|
| 1 | Homepage | Loads with correct fonts, ₹ prices in featured products |
| 2 | Products grid | Filters work (category, price range), ₹ symbol throughout |
| 3 | Product detail | Size chart, fabric info, delivery estimate visible |
| 4 | Design Studio | Add text/image, flip, lock, mobile toolbar works |
| 5 | Cart & Checkout | Razorpay flow (or simulated), order placed |
| 6 | Orders | Invoice download, order history with ₹ totals |
| 7 | Profile dropdown | Shows Orders, Saved Designs, Admin (if admin role) |
| 8 | Corporate page | Form submits, success screen |
| 9 | Admin panel | Accessible by admin/super_admin/product_manager/order_manager |
| 10 | Theme consistency | No hardcoded colors, all use CSS variables |

---

## Summary of All Files Modified/Created

### Modified Files:
1. `website/index.html` — Google Fonts + Razorpay script
2. `website/src/index.css` — Font vars, .dsc-* classes, price filter, product detail, invoice, saved designs CSS
3. `website/src/App.tsx` — SavedDesigns + CorporateInquiry routes
4. `website/src/api.ts` — Razorpay, saved designs, invoice, corporate inquiry API methods
5. `website/src/components/Navbar.tsx` — Saved Designs link, multi-role admin check
6. `website/src/components/Footer.tsx` — Corporate Orders link
7. `website/src/components/ProtectedRoute.tsx` — Multi-role admin check
8. `website/src/components/designer/Designer.tsx` — Image compression, flip/lock, mobile toolbar
9. `website/src/components/designer/Designer.css` — Mobile toolbar CSS
10. `website/src/components/designer/LeftPanel.tsx` — Flip/Lock buttons
11. `website/src/pages/Products.tsx` — Price range filter
12. `website/src/pages/ProductDetail.tsx` — Size chart, fabric info, delivery estimate
13. `website/src/pages/Cart.tsx` — Razorpay checkout flow
14. `website/src/pages/DesignStudioCart.tsx` — CSS variable classes
15. `website/src/pages/Orders.tsx` — Invoice download button
16. `website/server/database.ts` — SKU column, INR prices, saved_designs table, corporate_inquiries table
17. `website/server/db.json` — INR prices + SKU fields
18. `website/server/routes/products.ts` — Razorpay, saved designs, invoice, corporate inquiry routes, role guards
19. `website/server/middleware/auth.ts` — requireRole() factory, ROLES constant

### New Files:
20. `website/src/pages/SavedDesigns.tsx` — Saved Designs page
21. `website/src/pages/CorporateInquiry.tsx` — Corporate/Bulk inquiry form
22. `website/src/utils/imageCompression.ts` — Client-side image compression utility
23. `Documentation/DESIGN_SYSTEM.md` — Design system documentation
24. `Documentation/TESTING_CHECKLIST.md` — This file
