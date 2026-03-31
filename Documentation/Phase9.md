
---

# 🟢 PHASE 9 – ADMIN PRODUCT CONFIGURATION MODULE

This phase makes your system:

✅ Multi-product ready
✅ Fully dynamic
✅ Admin controlled
✅ Production deployable
✅ Future marketplace compatible

Everything still local.

---

# 🎯 OBJECTIVES OF THIS PHASE

Admin must be able to:

1. Create products
2. Set base price
3. Upload mockups (per color & side)
4. Define print areas
5. Set side-specific additional pricing
6. Activate / deactivate product
7. Control future scalability

No hardcoded values left.

---

# 🧠 DATABASE REDESIGN (CRITICAL)

We expand schema properly.

Open:

```prisma
prisma/schema.prisma
```

We add professional structure.

---

# 1️⃣ UPDATED PRODUCT MODEL

Replace Product with:

```prisma
model Product {
  id            String   @id @default(uuid())
  name          String
  slug          String   @unique
  description   String?
  sku           String   @unique
  basePrice     Float
  isActive      Boolean  @default(true)

  colors        ProductColor[]
  printAreas    PrintArea[]
  designs       Design[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

# 2️⃣ PRODUCT COLOR MODEL

Each product can have multiple colors.

```prisma
model ProductColor {
  id          String   @id @default(uuid())
  name        String
  hexCode     String

  product     Product  @relation(fields: [productId], references: [id])
  productId   String

  mockups     MockupImage[]

  createdAt   DateTime @default(now())
}
```

---

# 3️⃣ MOCKUP IMAGE MODEL (PER SIDE PER COLOR)

```prisma
model MockupImage {
  id         String   @id @default(uuid())
  side       PrintSide
  imageUrl   String

  color      ProductColor @relation(fields: [colorId], references: [id])
  colorId    String

  createdAt  DateTime @default(now())
}
```

Now:
White T-shirt can have:

* Front image
* Back image
  Black T-shirt same.

Professional.

---

# 4️⃣ PRINT AREA MODEL (KEEP BUT CLEAN)

```prisma
model PrintArea {
  id              String   @id @default(uuid())
  side            PrintSide
  width           Int
  height          Int
  xPosition       Int
  yPosition       Int
  safeZone        Int
  bleed           Int
  additionalPrice Float

  product         Product  @relation(fields: [productId], references: [id])
  productId       String

  createdAt       DateTime @default(now())
}
```

⚠️ Notice:
We added:

* xPosition
* yPosition

Now print placement is dynamic, not hardcoded.

---

# 5️⃣ ENUM

Ensure exists:

```prisma
enum PrintSide {
  FRONT
  BACK
  LEFT_SLEEVE
  RIGHT_SLEEVE
}
```

---

Run migration:

```bash
npx prisma migrate dev --name admin_product_system
```

---

# 🧠 BACKEND MODULE STRUCTURE

Inside:

```bash
apps/api/src/modules/
```

Create:

```bash
admin-products/
```

Files:

```
admin-products.module.ts
admin-products.controller.ts
admin-products.service.ts
dto/
```

---

# 6️⃣ CREATE PRODUCT DTO

Inside:

```ts
dto/create-product.dto.ts
```

```ts
export class CreateProductDto {
  name: string
  slug: string
  description?: string
  sku: string
  basePrice: number
}
```

---

# 7️⃣ PRODUCT SERVICE

Inside `admin-products.service.ts`

```ts
@Injectable()
export class AdminProductsService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: dto
    })
  }

  async getAll() {
    return this.prisma.product.findMany({
      include: {
        colors: true,
        printAreas: true
      }
    })
  }
}
```

---

# 8️⃣ PRODUCT CONTROLLER

```ts
@Controller("admin/products")
export class AdminProductsController {
  constructor(private readonly service: AdminProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto)
  }

  @Get()
  getAll() {
    return this.service.getAll()
  }
}
```

---

# 9️⃣ COLOR CREATION ENDPOINT

Add in service:

```ts
async addColor(productId: string, name: string, hexCode: string) {
  return this.prisma.productColor.create({
    data: {
      name,
      hexCode,
      productId
    }
  })
}
```

---

# 🔟 MOCKUP IMAGE UPLOAD (LOCAL FILE)

We use local upload first.

Install:

```bash
npm install multer
```

In controller:

```ts
@Post(":colorId/mockup")
@UseInterceptors(FileInterceptor("file"))
uploadMockup(
  @Param("colorId") colorId: string,
  @UploadedFile() file: Express.Multer.File,
  @Body("side") side: string
) {
  const imageUrl = `/uploads/${file.filename}`

  return this.prisma.mockupImage.create({
    data: {
      side,
      imageUrl,
      colorId
    }
  })
}
```

---

# 🧠 FRONTEND UPDATE (DYNAMIC LOADING)

Now instead of:

```ts
/mockups/tshirt/white/front.png
```

You fetch:

```ts
GET /products/:slug
```

Include:

* Colors
* Mockups
* PrintAreas

Then dynamically:

```ts
const selectedColor = product.colors.find(c => c.id === colorId)

const mockup = selectedColor.mockups.find(m => m.side === side)
```

Then load:

```ts
fabric.Image.fromURL(mockup.imageUrl, ...)
```

Now everything is dynamic.

---

# 🧠 PRINT AREA CLIP PATH DYNAMIC

Instead of hardcoding:

```ts
new fabric.Rect({ left: 100, top: 100 })
```

Use:

```ts
const area = product.printAreas.find(p => p.side === side)

new fabric.Rect({
  left: area.xPosition,
  top: area.yPosition,
  width: area.width,
  height: area.height
})
```

Now admin controls placement visually.

---

# 🧠 WHAT WE ACHIEVED

System now supports:

✅ Multiple products
✅ Multiple colors
✅ Multiple sides
✅ Dynamic mockups
✅ Dynamic print placement
✅ Admin-controlled pricing
✅ Scalable architecture

You now have:

Lumise-level foundation.

---

# 📦 DELIVERABLE OF PHASE 9

You removed:
❌ Hardcoded mockups
❌ Hardcoded print areas
❌ Hardcoded pricing

And replaced with:
✅ Admin-configured dynamic system

---
