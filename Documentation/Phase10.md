

# 🟢 PHASE 10 – CART & ORDER MODULE (E-COMMERCE CORE)

This phase converts your system from a design tool into a **sellable platform**.

After this phase you will have:

✅ Add to cart
✅ Store design JSON
✅ Store print-ready image reference
✅ Store selected color & sides
✅ Store quantity
✅ Price lock (backend verified)
✅ Create order
✅ Order status lifecycle
✅ Ready for payment integration

Everything still local.

---

# 🧠 ARCHITECTURE PRINCIPLE

⚠️ CRITICAL RULE

When user clicks **Add to Cart**:

We must store:

* Product ID
* Selected color ID
* Selected sides
* Quantity
* Design JSON (per side)
* Final backend-calculated price

Frontend price is ignored.

Backend recalculates before storing.

---

# 1️⃣ DATABASE EXPANSION

Open:

```prisma
prisma/schema.prisma
```

---

## 🔹 CART MODEL

```prisma
model Cart {
  id        String     @id @default(uuid())
  userId    String?
  items     CartItem[]

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}
```

---

## 🔹 CART ITEM MODEL

```prisma
model CartItem {
  id            String   @id @default(uuid())

  cart          Cart     @relation(fields: [cartId], references: [id])
  cartId        String

  productId     String
  colorId       String

  sides         Json     // ["FRONT","BACK"]
  quantity      Int

  designData    Json     // Fabric JSON per side
  lockedPrice   Float    // backend calculated final price

  createdAt     DateTime @default(now())
}
```

---

## 🔹 ORDER MODEL

```prisma
model Order {
  id            String       @id @default(uuid())
  orderNumber   String       @unique

  items         OrderItem[]

  totalAmount   Float
  status        OrderStatus  @default(PENDING)

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

---

## 🔹 ORDER ITEM MODEL

```prisma
model OrderItem {
  id            String   @id @default(uuid())

  order         Order    @relation(fields: [orderId], references: [id])
  orderId       String

  productId     String
  colorId       String

  sides         Json
  quantity      Int

  designData    Json
  lockedPrice   Float

  createdAt     DateTime @default(now())
}
```

---

## 🔹 ORDER STATUS ENUM

```prisma
enum OrderStatus {
  PENDING
  PAID
  IN_PRODUCTION
  SHIPPED
  DELIVERED
  CANCELLED
}
```

---

Run migration:

```bash
npx prisma migrate dev --name cart_order_system
```

---

# 2️⃣ CART MODULE STRUCTURE

Create:

```
modules/cart/
```

Files:

```
cart.module.ts
cart.controller.ts
cart.service.ts
dto/
```

---

# 3️⃣ ADD TO CART DTO

```ts
export class AddToCartDto {
  productId: string
  colorId: string
  sides: string[]
  quantity: number
  designData: any
}
```

---

# 4️⃣ CART SERVICE – ADD ITEM

⚠️ IMPORTANT: Recalculate price again.

```ts
@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService
  ) {}

  async addToCart(dto: AddToCartDto) {
    const pricing = await this.pricingService.calculate({
      productId: dto.productId,
      sides: dto.sides,
      quantity: dto.quantity
    })

    const cart = await this.prisma.cart.create({
      data: {
        items: {
          create: {
            productId: dto.productId,
            colorId: dto.colorId,
            sides: dto.sides,
            quantity: dto.quantity,
            designData: dto.designData,
            lockedPrice: pricing.finalPrice
          }
        }
      },
      include: { items: true }
    })

    return cart
  }
}
```

Now price is locked.

---

# 5️⃣ CART CONTROLLER

```ts
@Controller("cart")
export class CartController {
  constructor(private readonly service: CartService) {}

  @Post("add")
  add(@Body() dto: AddToCartDto) {
    return this.service.addToCart(dto)
  }
}
```

---

# 6️⃣ FRONTEND – ADD TO CART BUTTON

Inside editor:

When user clicks:

```ts
async function addToCart() {
  const response = await fetch("http://localhost:4000/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      colorId,
      sides: selectedSides,
      quantity,
      designData: savedSideJSON
    })
  })

  const data = await response.json()
}
```

Now design is saved in DB.

---

# 7️⃣ CREATE ORDER FROM CART

Create Order module:

```
modules/orders/
```

---

## 🔹 ORDER SERVICE

```ts
async createOrderFromCart(cartId: string) {
  const cart = await this.prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true }
  })

  let total = 0

  cart.items.forEach(item => {
    total += item.lockedPrice
  })

  const order = await this.prisma.order.create({
    data: {
      orderNumber: "ORD-" + Date.now(),
      totalAmount: total,
      items: {
        create: cart.items.map(item => ({
          productId: item.productId,
          colorId: item.colorId,
          sides: item.sides,
          quantity: item.quantity,
          designData: item.designData,
          lockedPrice: item.lockedPrice
        }))
      }
    }
  })

  return order
}
```

---

# 8️⃣ ORDER STATUS FLOW

Later:

Admin can update:

```
PENDING → PAID → IN_PRODUCTION → SHIPPED → DELIVERED
```

DesignData is stored for production team.

---

# 🧠 WHAT WE ACHIEVED

Now your system supports:

✅ Design save
✅ Locked pricing
✅ Cart storage
✅ Order creation
✅ Production-ready data
✅ Status lifecycle
✅ Future payment integration ready

You now have:

Full Custom Product E-commerce Engine.

---

# 📦 DELIVERABLE OF PHASE 10

Your platform now:

* Designs
* Prices
* Stores cart
* Creates orders
* Stores print-ready design JSON
* Tracks lifecycle

You officially built:

A commercial print customization backend.

---
