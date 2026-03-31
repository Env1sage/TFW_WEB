

# 🟢 PHASE 2 – LOCAL ENVIRONMENT & MONOREPO SETUP (VERY DETAILED)

⚠️ Goal of this phase:

* Fully working monorepo
* Dockerized PostgreSQL
* NestJS API connected to DB
* Next.js app running
* Admin app running
* Prisma working
* No feature modules yet
* Everything local
* Clean architecture from day 1

We do NOT move ahead until this runs smoothly.

---

# 1️⃣ PREREQUISITES (YOU MUST INSTALL)

Before starting, ensure:

### ✅ Node

```
node >= 18.0.0
```

Check:

```
node -v
```

---

### ✅ pnpm

Install globally:

```
npm install -g pnpm
```

Check:

```
pnpm -v
```

---

### ✅ Docker

Install Docker Desktop.

Check:

```
docker -v
docker compose version
```

---

If all above are ready → proceed.

---

# 2️⃣ CREATE PROJECT ROOT

Create main folder:

```
mkdir theframedwall
cd theframedwall
```

---

# 3️⃣ INITIALIZE ROOT PROJECT

Initialize package.json:

```
pnpm init
```

Edit root `package.json`:

```json
{
  "name": "theframedwall",
  "private": true,
  "packageManager": "pnpm@8",
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "dev:admin": "pnpm --filter admin dev",
    "dev": "concurrently \"pnpm dev:api\" \"pnpm dev:web\" \"pnpm dev:admin\""
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

Install dependencies:

```
pnpm install
```

---

# 4️⃣ CREATE WORKSPACE FILE

Create:

`pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

# 5️⃣ CREATE FOLDER STRUCTURE

```
mkdir apps
mkdir packages
mkdir prisma
mkdir docker
```

Inside apps:

```
mkdir apps/api
mkdir apps/web
mkdir apps/admin
```

---

# 6️⃣ SETUP NESTJS BACKEND (apps/api)

Go inside:

```
cd apps/api
```

Initialize NestJS:

```
pnpm create nest-app .
```

Choose:

* pnpm
* Yes to ESLint
* Yes to Prettier

After install:

Add Prisma:

```
pnpm add @prisma/client
pnpm add -D prisma
```

Initialize Prisma:

```
npx prisma init
```

This creates:

```
prisma/schema.prisma
.env
```

Delete local `.env` inside api — we will use root `.env`.

---

# 7️⃣ MOVE PRISMA TO ROOT

Move prisma folder:

```
mv prisma ../../prisma
```

Edit `apps/api/package.json`:

Add script:

```json
"prisma": "prisma"
```

---

# 8️⃣ CREATE ROOT .env FILE

Back to root folder:

Create `.env`

```env
DATABASE_URL="postgresql://tfw:tfwpassword@localhost:5432/tfw_db"
JWT_SECRET="supersecretkey"
PORT=4000
```

---

# 9️⃣ DOCKER SETUP FOR POSTGRES

Create:

`docker-compose.yml` (root)

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    container_name: tfw_postgres
    restart: always
    environment:
      POSTGRES_USER: tfw
      POSTGRES_PASSWORD: tfwpassword
      POSTGRES_DB: tfw_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start DB:

```
docker compose up -d
```

Check:

```
docker ps
```

You should see postgres running.

---

# 🔟 CONNECT PRISMA TO DB

Edit:

`prisma/schema.prisma`

Replace datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Now test connection:

```
npx prisma migrate dev --name init
```

If successful → DB is connected.

---

# 1️⃣1️⃣ CONFIGURE NESTJS TO USE ROOT .env

Install:

```
pnpm add @nestjs/config
```

Edit `app.module.ts`:

```ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
  ],
})
export class AppModule {}
```

---

# 1️⃣2️⃣ CREATE BASIC HEALTH CHECK

In `app.controller.ts`:

```ts
@Get()
getHealth() {
  return { status: "API running" };
}
```

Start backend:

```
pnpm run start:dev
```

Visit:

```
http://localhost:4000
```

You must see:

```
{ "status": "API running" }
```

---

# 1️⃣3️⃣ SETUP NEXT.JS PUBLIC WEBSITE (apps/web)

Go root:

```
cd apps
```

Create Next app:

```
pnpm create next-app web --typescript --tailwind --eslint --app
```

After install:

Go inside:

```
cd web
pnpm dev
```

Check:

```
http://localhost:3000
```

Working? Good.

Stop it.

---

# 1️⃣4️⃣ SETUP ADMIN (VITE + REACT)

Back to apps folder:

```
pnpm create vite admin --template react-ts
cd admin
pnpm install
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure Tailwind.

Start:

```
pnpm dev
```

Check:

```
http://localhost:5173
```

---

# 1️⃣5️⃣ FINAL PROJECT STRUCTURE SHOULD LOOK LIKE:

```
theframedwall/
│
├── apps/
│   ├── api/
│   ├── web/
│   └── admin/
│
├── prisma/
│   └── schema.prisma
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── .env
```

---

# 1️⃣6️⃣ VALIDATION CHECKLIST

Before approval, confirm:

✅ PostgreSQL running
✅ Prisma migration works
✅ NestJS running on 4000
✅ Next.js running on 3000
✅ Admin running on 5173
✅ No errors in console

---
