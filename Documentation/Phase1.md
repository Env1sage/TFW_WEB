

# 🟢 PHASE 1 – HIGH LEVEL SYSTEM ARCHITECTURE (LOCAL-FIRST)

This phase is purely architectural.
No feature code yet. Only structure and decisions.

If we get this right → development becomes smooth.

---

# 1️⃣ OVERALL ARCHITECTURE (LOCAL ENVIRONMENT)

We will use a **Modular Monolith Architecture**.

Not microservices.

Why?

Because:

* Easier local development
* Faster iteration
* Less DevOps complexity
* Easier debugging
* Still scalable later

---

# 2️⃣ MONOREPO STRUCTURE

We use **pnpm workspaces**.

### Root Structure:

```id="arch-root"
theframedwall/
│
├── apps/
│   ├── api/              # NestJS backend
│   ├── web/              # Next.js public site
│   └── admin/            # React Admin (Vite)
│
├── packages/
│   ├── ui/               # Shared UI components
│   ├── types/            # Shared TypeScript types
│   ├── config/           # Shared configs (eslint, tsconfig)
│   └── utils/            # Shared utility functions
│
├── prisma/
│   └── schema.prisma
│
├── docker/
│   ├── postgres/
│   └── api/
│
├── docker-compose.yml
├── .env
└── pnpm-workspace.yaml
```

---

# 3️⃣ LOCAL INFRASTRUCTURE (DOCKER BASED)

Everything runs locally using Docker.

### Containers:

1. PostgreSQL
2. NestJS API
3. (Optional later) Redis
4. (Optional later) ClamAV for virus scan

---

## docker-compose.yml (Conceptual Structure)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: tfw_postgres
    environment:
      POSTGRES_USER: tfw
      POSTGRES_PASSWORD: tfwpassword
      POSTGRES_DB: tfw_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./apps/api
    container_name: tfw_api
    depends_on:
      - postgres
    ports:
      - "4000:4000"
    env_file:
      - .env
    volumes:
      - ./apps/api:/usr/src/app
    command: pnpm run start:dev

volumes:
  postgres_data:
```

---

# 4️⃣ APPLICATION ARCHITECTURE (NESTJS – MODULAR MONOLITH)

Inside `apps/api/src`

```id="nestjs-structure"
src/
│
├── main.ts
├── app.module.ts
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── customization/
│   ├── pricing/
│   ├── orders/
│   ├── corporate/
│   ├── storage/
│   └── pdf/
│
├── common/
│   ├── guards/
│   ├── decorators/
│   ├── interceptors/
│   ├── filters/
│   └── utils/
│
└── config/
```

Each module contains:

* controller.ts
* service.ts
* dto/
* entity (Prisma-based)
* interfaces

---

# 5️⃣ DATABASE ARCHITECTURE (POSTGRES + PRISMA)

We will use:

* Soft deletes
* UUID primary keys
* Proper indexing
* Relation integrity

High-level entity groups:

### Core Entities

* User
* Role
* Product
* ProductVariant
* PrintArea
* Design
* DesignSide
* Order
* OrderItem
* CorporateInquiry
* Quote

---

# 6️⃣ FILE STORAGE (LOCAL FIRST)

Local directory:

```
/uploads/
    /designs/
    /exports/
    /mockups/
```

Very important:

We DO NOT hardcode paths.

We create:

`StorageService`

```ts
interface StorageProvider {
  upload(file: Buffer, path: string): Promise<string>
  delete(path: string): Promise<void>
  get(path: string): Promise<Buffer>
}
```

LocalStorageProvider implements this.

Later → S3Provider.

No code rewrite needed.

---

# 7️⃣ CUSTOMIZATION ENGINE ARCHITECTURE (CRITICAL)

Frontend: Fabric.js inside Next.js.

Flow:

1. User edits canvas
2. Canvas exports:

   * JSON (layer data)
   * High-res PNG (preview)
   * SVG (optional)
3. Frontend sends:

   * JSON
   * Metadata
   * Used print sides
4. Backend:

   * Stores JSON in DB
   * Stores preview image
   * Associates with Product

---

### Design Data Model Concept

Design:

* id
* userId
* productId
* name
* status (draft/final)
* totalPrice
* createdAt

DesignSide:

* id
* designId
* side (front/back/sleeve)
* canvasWidth
* canvasHeight
* safeZone
* bleed
* jsonData
* previewImagePath

This allows multi-canvas support.

---

# 8️⃣ PRICING ENGINE ARCHITECTURE

Pricing is NOT calculated on frontend permanently.

Frontend:

* Shows estimated price

Backend:

* Final authority on price
* Uses PricingService

This prevents tampering.

---

# 9️⃣ AUTHENTICATION ARCHITECTURE

JWT based.

Roles:

* SUPER_ADMIN
* PRODUCT_MANAGER
* ORDER_MANAGER
* CUSTOMER

Admin portal uses role guard.

---

# 🔟 API COMMUNICATION

Public Website:

* REST API calls to NestJS

Admin:

* Same API
* Different endpoints secured by role guards

---

# 1️⃣1️⃣ ERROR HANDLING

Global Exception Filter in NestJS.

Standard API response:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Errors:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid DPI"
}
```

---

# 1️⃣2️⃣ SECURITY BASELINE (LOCAL PHASE)

* File size limit (10MB images)
* MIME type validation
* Sanitize SVG
* Rate limit login
* Helmet security headers

---

# 1️⃣3️⃣ DEVELOPMENT FLOW (AGILE STYLE)

For EACH module:

Step 1 – Backend DTO + Prisma Model
Step 2 – Backend Controller + Service
Step 3 – Unit test
Step 4 – Frontend integration
Step 5 – UI layer
Step 6 – Manual QA

No skipping.

---

# 🧠 WHY THIS ARCHITECTURE IS STRONG

* Modular
* Scalable
* Replaceable storage
* Replaceable pricing logic
* Clean domain separation
* Ready for AWS later
* No technical debt early

---

