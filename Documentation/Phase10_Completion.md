# Phase 10 Completion — Cart & Order Module (E-Commerce Core)

## Date: 2026-03-08

---

## Summary

Phase 10 converts the system from a design tool into a sellable platform with full cart-to-order lifecycle. Prices are backend-verified (never trusting frontend), design JSON is persisted, and orders follow a status lifecycle from PENDING to DELIVERED.

---

## What Was Implemented

### 1. Database Schema (Prisma)

**New Enum**: `OrderStatus` — PENDING, PAID, IN_PRODUCTION, SHIPPED, DELIVERED, CANCELLED

**New Models**:
- `Cart` — id, userId (optional), items relation
- `CartItem` — productId, colorId, sides (Json), quantity, designData (Json), lockedPrice (backend-calculated)
- `Order` — orderNumber (unique), totalAmount, status (OrderStatus), items relation
- `OrderItem` — productId, colorId, sides, quantity, designData, lockedPrice

**Migration**: `20260308173837_cart_order_system`

### 2. Cart Module

**Location**: `apps/api/src/modules/cart/`

**CartService** — Imports `PricingService` to recalculate price server-side. Creates cart with items, locks final price.

**Endpoints**:
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/cart/add` | Add item to cart (creates new cart + item, locks price) |
| GET | `/cart/:cartId` | Get cart with items |

**AddToCartDto** — Validated: productId, colorId, sides[], quantity (min 1), designData (object)

### 3. Orders Module

**Location**: `apps/api/src/modules/orders/`

**OrdersService** — Creates order from cart (sums locked prices, generates order number `ORD-{timestamp}`, copies items, deletes cart after).

**Endpoints**:
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/orders` | Create order from cart (cartId in body) |
| GET | `/orders` | List all orders (desc by date) |
| GET | `/orders/:orderId` | Get single order with items |
| PATCH | `/orders/:orderId/status` | Update order status |

**DTOs**: CreateOrderDto (cartId), UpdateOrderStatusDto (status enum)

### 4. Frontend — Add to Cart Button

Added to CanvasEditor pricing panel:
- Blue "Add to Cart" button with loading state
- Collects current canvas design JSON for all selected sides
- Sends to `POST /cart/add` with productId, colorId, sides, quantity, designData
- Shows cart ID on success

---

## Architecture: Price Locking Flow

```
Frontend (display price) → Add to Cart → Backend recalculates price → Stores locked price
                                                                     → Stores design JSON
Cart → Create Order → Uses locked prices → Order total = sum(lockedPrices)
```

Frontend price is **never trusted**. Backend always recalculates using `PricingService.calculate()`.

---

## Verification

- ✅ `POST /cart/add` — 201, returns cart with locked price ₹599 (FRONT only, qty 1)
- ✅ `GET /cart/:id` — 200, returns cart with items
- ✅ `POST /orders` — 201, creates order from cart (ORD-{timestamp}, total=599, status=PENDING)
- ✅ `GET /orders` — 200, lists all orders
- ✅ `GET /orders/:id` — 200, returns order with items
- ✅ `PATCH /orders/:id/status` — 200, PENDING → PAID → IN_PRODUCTION flow works
- ✅ Cart cleanup after order creation (cart deleted)
- ✅ `pnpm run build` in `apps/web` — compiled successfully, 0 errors
- ✅ Web editor with Add to Cart button at http://localhost:3000/editor
- ✅ API running at http://localhost:4000

---

## Order Status Lifecycle

```
PENDING → PAID → IN_PRODUCTION → SHIPPED → DELIVERED
                                           ↘ CANCELLED
```

---

## Next Phase

Phase 11 — PDF Generation & Production Files
