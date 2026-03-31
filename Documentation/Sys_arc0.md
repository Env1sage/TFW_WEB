

# 🏗 HIGH-LEVEL SYSTEM ARCHITECTURE

Here is the logical architecture of TheFramedWall.

---

## 🌐 1️⃣ Frontend Layer

### Public Website

Built with → Next.js
Purpose:

* Product pages
* Customization tool UI
* Cart & checkout
* User accounts

---

### Admin Portal

Built with:

* React 18 + Vite + TypeScript
  Purpose:
* Product management
* Print area setup
* Order management
* Corporate approvals
* Analytics

---

## 🧠 2️⃣ Application Layer (Backend)

Built with → NestJS

This is your central brain.

Modules:

* Auth Module (JWT)
* User Module
* Product Module
* Customization Module
* Order Module
* Corporate Module
* Pricing Engine Module
* File Storage Module
* PDF Export Module

All using → Prisma
Connected to → PostgreSQL

---

## 💾 3️⃣ Storage Layer

### Phase 1 (Local)

* `/uploads/designs`
* `/exports/pdf`
* `/mockups`

### Phase 2 (Cloud)

* Amazon S3

We design a StorageService abstraction from day one.

---

## 🎨 4️⃣ Customization Engine Layer (Frontend Core)

Inside Next.js:

* Fabric.js canvas engine
* Layer manager
* Safe zone overlay
* DPI validation
* JSON save system
* Export high-res PNG/SVG
* Send JSON to backend

Backend stores:

* Design JSON
* High-res export
* Placement coordinates

---

## 📦 5️⃣ Order Processing Flow

Customer:
Customize → Save Design → Add to Cart → Checkout

Backend:

* Calculate price via Pricing Engine
* Store design JSON
* Generate print-ready PDFs
* Admin downloads print file

---

## 🏢 6️⃣ Corporate Flow

Corporate user:
Submit bulk request → Backend generates quotation → Admin approves → Payment link → Order created

---

# 🔄 SYSTEM FLOW (Simplified)

```
User → Next.js → NestJS API → PostgreSQL
                         ↓
                   File Storage
                         ↓
                  PDF Export Engine
```

Clean. Scalable. Modular.

---

# 🚀 AGILE DEVELOPMENT ROADMAP

We build in **Modules (Backend first → Frontend next)**

---

# 🟢 PHASE 0 – Foundation Setup

Goal: Engineering stability

### Backend

* NestJS setup
* Prisma schema setup
* PostgreSQL Docker container
* JWT auth skeleton
* Role system

### Frontend

* Next.js setup
* Tailwind setup
* Theme CSS architecture
* Typography system
* Folder structure

Deliverable:
Monorepo ready.

---

# 🟢 PHASE 1 – Customization Engine Core (Backend First)

This is your core IP.

---

## 🔹 Phase 1A – Backend Customization Module

Create:

* Design entity
* Design JSON storage
* Save design API
* Load design API
* File upload endpoint
* Basic pricing calculation endpoint

Deliverable:
Backend can store & retrieve designs.

---

## 🔹 Phase 1B – Frontend Canvas Engine

Build:

* Fabric.js integration
* Upload image
* Add text
* Move/rotate/resize
* Layer list panel
* Save design JSON
* Load design JSON

Deliverable:
Working canvas editor (single side).

---

# 🟢 PHASE 2 – Multi Canvas + Print Logic

---

## 🔹 Phase 2A – Backend

* Support multiple print areas per design
* Add DPI validation logic
* Placement coordinate calculation
* High-res export service

---

## 🔹 Phase 2B – Frontend

* Front/Back/Sleeve toggle
* Safe zone overlay
* Snap alignment guides
* Undo/Redo stack
* Zoom controls

Deliverable:
Lumise-level editor MVP.

---

# 🟢 PHASE 3 – Print Export Engine

Backend:

* Convert design to 300 DPI
* Generate separate PDF per side
* Store layered JSON
* Attach to order

Deliverable:
Manufacturing-ready system.

---

# 🟢 PHASE 4 – Product & Admin Module

Backend:

* Product CRUD
* SKU logic
* Print area definition
* Mockup management

Frontend (Admin):

* Add product
* Define canvas dimensions visually
* Upload mockups
* Set pricing per side

Deliverable:
Admin can fully configure system.

---

# 🟢 PHASE 5 – E-commerce Layer

Backend:

* Cart module
* Order module
* Quantity discount logic
* Pricing engine finalization

Frontend:

* Product pages
* Add to cart
* Checkout
* Order history

---

# 🟢 PHASE 6 – Corporate Flow

Backend:

* Corporate inquiry model
* Quotation generator
* Approval system

Frontend:

* Corporate form
* Admin approval UI

---

# 🎯 Why This Order?

Because:

Customization Engine = Core value
E-commerce = Wrapper layer

If editor is strong → platform wins.

---

# 🧠 Architecture Decision You Made (Very Smart)

Building frontend & backend side-by-side module-wise is exactly how SaaS teams work.

Backend defines contract.
Frontend consumes it.

---
