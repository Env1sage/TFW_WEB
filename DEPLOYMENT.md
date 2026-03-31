# TFW Deployment Guide — Hostinger VPS

## Architecture

```
  Browser ─► Nginx (80/443) ─► Express App (5000) ─► PostgreSQL (5432)
                                    │
                              React SPA (static)
                              + API routes
                              + Uploads
```

## Prerequisites

- Hostinger VPS with Ubuntu 22.04+
- Domain pointed to VPS IP (A record)
- GitHub repo with SSH deploy key

---

## Step 1: Point Domain to VPS

In Hostinger **hPanel → Domains → DNS Zone**:
- Set **A record** for `@` → your VPS IP
- Set **A record** for `www` → your VPS IP

---

## Step 2: First-time VPS Setup

SSH into your VPS:
```bash
ssh root@YOUR_VPS_IP
```

Clone and run the setup script:
```bash
git clone git@github.com:YOUR_USERNAME/TFW_WEB.git /opt/tfw
cd /opt/tfw
bash scripts/setup-vps.sh theframedwall.com
```

---

## Step 3: Configure Environment

```bash
cd /opt/tfw
nano .env.production
```

Fill in all values — especially:
- `DB_PASSWORD` — strong random password
- `JWT_SECRET` — 64+ character random string  
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from Razorpay dashboard
- `CLIENT_URL` — your domain with https

---

## Step 4: Initial Deploy (HTTP first)

```bash
cd /opt/tfw

# Use HTTP-only nginx config first
cp nginx/default.http-only.conf nginx/default.conf

# Start everything
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Verify it's running
curl http://localhost:5000/api/health
curl http://YOUR_DOMAIN/api/health
```

---

## Step 5: SSL Certificate

```bash
# Get Let's Encrypt certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d theframedwall.com -d www.theframedwall.com \
  --email your@email.com --agree-tos --no-eff-email

# Switch to HTTPS nginx config
cp nginx/default.conf nginx/default.conf.bak
# The default.conf already has HTTPS config — just ensure the SSL cert paths match
# Restore the full SSL config:
cd /opt/tfw
git checkout nginx/default.conf

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Step 6: GitHub Actions CI/CD

Add these **secrets** in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USER` | `root` (or deploy user) |
| `VPS_SSH_KEY` | Private SSH key for the VPS |
| `VPS_PORT` | `22` (default) |

### Generate SSH key for deployment:
```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/tfw_deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/tfw_deploy.pub root@YOUR_VPS_IP

# Add the PRIVATE key content as VPS_SSH_KEY secret in GitHub
cat ~/.ssh/tfw_deploy
```

Now every push to `main` will auto-deploy.

---

## Manual Deploy

```bash
ssh root@YOUR_VPS_IP
cd /opt/tfw
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart app
docker compose -f docker-compose.prod.yml restart app

# Stop everything
docker compose -f docker-compose.prod.yml down

# DB backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U tfw tfw_db > backup_$(date +%Y%m%d).sql

# DB restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U tfw tfw_db

# SSL renew (manual — auto-renew runs in certbot container)
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

---

## File Structure

```
.github/workflows/deploy.yml   ← CI/CD pipeline
.env.production.example         ← env template
docker-compose.prod.yml         ← production containers
nginx/default.conf              ← HTTPS nginx config
nginx/default.http-only.conf    ← HTTP-only (initial setup)
nginx/ssl/                      ← SSL certs (auto-created)
website/Dockerfile              ← app container build
scripts/setup-vps.sh            ← one-time VPS setup
```
