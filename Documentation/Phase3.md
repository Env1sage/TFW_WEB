
# 🟢 PHASE 3 – CUSTOMIZATION MODULE (BACKEND FIRST)

Goal of this phase:

* Design database structure
* Multi-side design support
* Save design JSON
* Load design JSON
* Store preview image
* Associate with product
* Clean API contract
* No frontend yet

Everything local.

---

# 🎯 OBJECTIVE OF THIS MODULE

We are building:

> A system that stores layered canvas designs (like Lumise), multi-side, scalable.

---

# 1️⃣ DATABASE DESIGN (PRISMA MODELS)

Open:

```
prisma/schema.prisma
```

We now define foundational entities.

---

## 🔹 ENUMS

Add this first:

```prisma
enum UserRole {
  SUPER_ADMIN
  PRODUCT_MANAGER
  ORDER_MANAGER
  CUSTOMER
}

enum DesignStatus {
  DRAFT
  FINALIZED
}

enum PrintSide {
  FRONT
  BACK
  LEFT_SLEEVE
  RIGHT_SLEEVE
  WRAP
}
```

---

## 🔹 USER MODEL

```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  password  String
  role      UserRole  @default(CUSTOMER)

  designs   Design[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

---

## 🔹 PRODUCT MODEL (Minimal for Now)

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

---

## 🔹 PRINT AREA MODEL

Admin will define these later.

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
  additionalPrice Float

  createdAt    DateTime @default(now())
}
```

---

## 🔹 DESIGN MODEL (Core)

```prisma
model Design {
  id          String        @id @default(uuid())
  name        String
  status      DesignStatus  @default(DRAFT)

  user        User?         @relation(fields: [userId], references: [id])
  userId      String?

  product     Product       @relation(fields: [productId], references: [id])
  productId   String

  totalPrice  Float         @default(0)

  sides       DesignSide[]

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

---

## 🔹 DESIGN SIDE MODEL (VERY IMPORTANT)

This stores per canvas side.

```prisma
model DesignSide {
  id           String   @id @default(uuid())

  design       Design   @relation(fields: [designId], references: [id])
  designId     String

  side         PrintSide

  canvasWidth  Int
  canvasHeight Int

  jsonData     Json
  previewImagePath String?

  dpi          Int?

  createdAt    DateTime @default(now())
}
```

---

# 2️⃣ RUN MIGRATION

Save schema.

Then run:

```bash
npx prisma migrate dev --name customization_init
```

If successful → DB ready.

---

# 3️⃣ CREATE CUSTOMIZATION MODULE IN NESTJS

Inside:

```
apps/api/src/modules/
```

Create:

```
customization/
```

Inside:

```
customization.module.ts
customization.controller.ts
customization.service.ts
dto/
```

---

# 4️⃣ CREATE DTOs

Inside:

```
dto/create-design.dto.ts
```

```ts
export class CreateDesignDto {
  name: string
  productId: string
}
```

---

Inside:

```
dto/add-design-side.dto.ts
```

```ts
export class AddDesignSideDto {
  side: string
  canvasWidth: number
  canvasHeight: number
  jsonData: any
  previewImageBase64?: string
  dpi?: number
}
```

---

# 5️⃣ CUSTOMIZATION SERVICE

In `customization.service.ts`

Inject Prisma.

```ts
@Injectable()
export class CustomizationService {
  constructor(private prisma: PrismaService) {}

  async createDesign(dto: CreateDesignDto, userId?: string) {
    return this.prisma.design.create({
      data: {
        name: dto.name,
        productId: dto.productId,
        userId: userId ?? null,
      },
    })
  }

  async addDesignSide(designId: string, dto: AddDesignSideDto) {
    return this.prisma.designSide.create({
      data: {
        designId,
        side: dto.side as any,
        canvasWidth: dto.canvasWidth,
        canvasHeight: dto.canvasHeight,
        jsonData: dto.jsonData,
        previewImagePath: null,
        dpi: dto.dpi ?? null,
      },
    })
  }

  async getDesign(designId: string) {
    return this.prisma.design.findUnique({
      where: { id: designId },
      include: { sides: true },
    })
  }
}
```

---

# 6️⃣ CONTROLLER

In `customization.controller.ts`

```ts
@Controller('designs')
export class CustomizationController {
  constructor(private readonly service: CustomizationService) {}

  @Post()
  create(@Body() dto: CreateDesignDto) {
    return this.service.createDesign(dto)
  }

  @Post(':id/sides')
  addSide(@Param('id') id: string, @Body() dto: AddDesignSideDto) {
    return this.service.addDesignSide(id, dto)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getDesign(id)
  }
}
```

---

# 7️⃣ REGISTER MODULE

In `app.module.ts`

```ts
imports: [
  ConfigModule.forRoot(...),
  CustomizationModule,
]
```

---

# 8️⃣ TEST API USING POSTMAN

### 1️⃣ Create Design

POST

```
http://localhost:4000/designs
```

Body:

```json
{
  "name": "My First Design",
  "productId": "some-product-id"
}
```

---

### 2️⃣ Add Side

POST

```
http://localhost:4000/designs/{designId}/sides
```

Body:

```json
{
  "side": "FRONT",
  "canvasWidth": 800,
  "canvasHeight": 1000,
  "jsonData": {
    "objects": []
  }
}
```

---

### 3️⃣ Get Design

GET

```
http://localhost:4000/designs/{designId}
```

You should receive full design with sides.

---

# 🧠 WHAT WE ACHIEVED

We now have:

* Multi-side design system
* JSON layer storage
* Product association
* Ready for Fabric.js integration
* Scalable for print export

This is foundation of entire platform.

---

# 📦 DELIVERABLE OF PHASE 3

Backend can now:

* Create design
* Add canvas sides
* Retrieve full layered design

No pricing yet.
No image storage yet.
No auth yet.

Pure design storage.

---


