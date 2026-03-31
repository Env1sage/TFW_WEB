

# 🟢 PHASE 8 – PRICING ENGINE (BACKEND AUTHORITY + REAL-TIME SYNC)

⚠️ Goals:

* Backend-controlled pricing (no frontend manipulation)
* Price based on:

  * Base product price
  * Printed sides
  * Side-specific price
  * Quantity tiers
* Live preview pricing on frontend
* Final authoritative price during checkout
* Clean extensible pricing architecture

Everything still local.

---

# 🧠 ARCHITECTURE PRINCIPLE

⚠️ IMPORTANT RULE:

Frontend shows **estimated price**
Backend calculates **final price**

Frontend price is cosmetic.
Backend price is truth.

---

# 1️⃣ DATABASE UPDATE – ADD PRICING CONFIG

Open:

```prisma
prisma/schema.prisma
```

We enhance `Product` and `PrintArea`.

---

## 🔹 Update Product

```prisma
model Product {
  id          String   @id @default(uuid())
  name        String
  sku         String   @unique
  basePrice   Float

  printAreas  PrintArea[]
  designs     Design[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

(Already present, basePrice used)

---

## 🔹 Update PrintArea

Add:

```prisma
model PrintArea {
  id           String   @id @default(uuid())
  product      Product  @relation(fields: [productId], references: [id])
  productId    String

  side         PrintSide
  width        Int
  height       Int
  safeZone     Int
  bleed        Int

  additionalPrice Float   // price for printing on this side

  createdAt    DateTime @default(now())
}
```

If already exists → ensure `additionalPrice` is present.

---

Run migration:

```bash
npx prisma migrate dev --name pricing_update
```

---

# 2️⃣ CREATE PRICING MODULE (BACKEND)

Inside:

```bash
apps/api/src/modules/
```

Create:

```bash
pricing/
```

Files:

```bash
pricing.module.ts
pricing.service.ts
pricing.controller.ts
dto/
```

---

# 3️⃣ CREATE PRICE CALCULATION DTO

Inside:

```bash
dto/calculate-price.dto.ts
```

```ts
export class CalculatePriceDto {
  productId: string
  sides: string[]  // ["FRONT", "BACK"]
  quantity: number
}
```

---

# 4️⃣ PRICING SERVICE (CORE LOGIC)

Inside `pricing.service.ts`:

```ts
import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async calculate(dto: any) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { printAreas: true }
    })

    if (!product) throw new Error("Product not found")

    let base = product.basePrice

    let sideTotal = 0

    for (const side of dto.sides) {
      const area = product.printAreas.find(p => p.side === side)
      if (area) {
        sideTotal += area.additionalPrice
      }
    }

    let subtotal = base + sideTotal

    // Quantity multiplier
    subtotal = subtotal * dto.quantity

    // Quantity discount logic
    let discount = 0

    if (dto.quantity >= 6 && dto.quantity <= 20) {
      discount = 0.05
    } else if (dto.quantity >= 21 && dto.quantity <= 50) {
      discount = 0.10
    } else if (dto.quantity > 50) {
      discount = 0.15
    }

    const finalPrice = subtotal - (subtotal * discount)

    return {
      basePrice: base,
      sideTotal,
      quantity: dto.quantity,
      discountPercentage: discount * 100,
      finalPrice
    }
  }
}
```

This is clean, extensible logic.

---

# 5️⃣ PRICING CONTROLLER

```ts
import { Controller, Post, Body } from "@nestjs/common"
import { PricingService } from "./pricing.service"

@Controller("pricing")
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Post("calculate")
  calculate(@Body() dto: any) {
    return this.service.calculate(dto)
  }
}
```

---

# 6️⃣ REGISTER MODULE

In `app.module.ts`:

```ts
imports: [
  PricingModule,
]
```

---

# 7️⃣ TEST IN POSTMAN

POST:

```
http://localhost:4000/pricing/calculate
```

Body:

```json
{
  "productId": "your-product-id",
  "sides": ["FRONT", "BACK"],
  "quantity": 10
}
```

Expected response:

```json
{
  "basePrice": 499,
  "sideTotal": 228,
  "quantity": 10,
  "discountPercentage": 5,
  "finalPrice": 6900
}
```

If this works → backend pricing is complete.

---

# 8️⃣ CONNECT FRONTEND TO PRICING

Inside `CanvasEditor.tsx`

Add:

```ts
const [quantity, setQuantity] = useState(1)
const [price, setPrice] = useState(null)
```

Add function:

```ts
async function calculatePrice(selectedSides: string[]) {
  const response = await fetch("http://localhost:4000/pricing/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: "your-product-id",
      sides: selectedSides,
      quantity
    })
  })

  const data = await response.json()
  setPrice(data.finalPrice)
}
```

Call this whenever:

* Side toggled
* Quantity changed

Add UI:

```tsx
<input
  type="number"
  min="1"
  value={quantity}
  onChange={(e) => setQuantity(Number(e.target.value))}
/>

<div>
  Estimated Price: ₹{price}
</div>
```

---

# 🧠 WHAT WE ACHIEVED

Now your system has:

✅ Backend-controlled pricing
✅ Side-based pricing
✅ Quantity discounts
✅ Real-time frontend sync
✅ Extensible pricing architecture
✅ Clean separation of concern

You now have:

Design Tool + Mockup + Real Pricing

This is now a real business engine.

---

# 📦 DELIVERABLE OF PHASE 8

Editor now:

* Calculates price dynamically
* Respects backend logic
* Handles multi-side pricing
* Supports quantity discounts

---

# 🚀 NEXT STRATEGIC STEP

Now we must choose carefully:

### Option A – Build Cart + Order Module

### Option B – Build Print Export Engine (300 DPI PDF)

### Option C – Build Admin Product Configuration System

Correct product sequence:

👉 Next = Admin Product Configuration System

Why?
Because pricing & mockups should not be hardcoded.
Admin must define:

* Print areas
* Side pricing
* Mockup images
* Base price

We remove hardcoded logic.

---
